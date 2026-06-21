/**
 * KoshBox — Transaction Pool (Mempool)
 * Manages pending transactions waiting to be included in a block.
 * FIFO ordering. Max pool size enforced. Expiry handled.
 */

"use strict";

const { generateTxHash } = require("../utils");
const persistence = require("../../services/persistence-service");
const config = require("../../config");
const EventEmitter = require("events");

class TransactionPool extends EventEmitter {
  constructor() {
    super();
    this.pending = [];       // waiting for block inclusion
    this.confirming = [];    // currently being mined
    this.confirmed = [];     // included in a block
    this.failed = [];        // rejected or expired
    this.initialized = false;
  }

  /**
   * Initialize pool — load persisted state from disk.
   */
  async init() {
    const stored = await persistence.loadTxPool();
    if (stored) {
      this.pending    = stored.pending    || [];
      this.confirming = stored.confirming || [];
      this.confirmed  = stored.confirmed  || [];
      this.failed     = stored.failed     || [];

      // Move any stuck confirming transactions back to pending on restart
      if (this.confirming.length > 0) {
        this.pending.unshift(...this.confirming);
        this.confirming = [];
      }
    }

    this.initialized = true;
    this._startExpiryTimer();
    console.log(`[TxPool] Initialized — pending: ${this.pending.length}, confirmed: ${this.confirmed.length}`);
  }

  /**
   * Submit a new transaction to the pool.
   * @param {object} txData - raw transaction data from API
   * @returns {object} created transaction record
   */
  async submit(txData) {
    if (this.pending.length >= config.blockchain.maxMempoolSize) {
      throw new Error("Mempool full — try again shortly");
    }

    this._validateTxData(txData);

    const tx = {
      txHash:        generateTxHash(txData),
      from:          txData.senderAddress,
      to:            txData.merchantAddress,
      amount:        parseFloat(txData.amount).toFixed(2),
      coin:          txData.coin,
      senderName:    txData.senderName,
      status:        "pending",
      timestamp:     Date.now(),
      blockIndex:    null,
      confirmations: 0,
      announced:     false,
      expiresAt:     Date.now() + config.blockchain.txExpiryMs
    };

    this.pending.push(tx);
    await this._persist();

    this.emit("tx:submitted", tx);
    console.log(`[TxPool] Transaction submitted: ${tx.txHash}`);
    return tx;
  }

  /**
   * Move the next batch of pending transactions to confirming state.
   * Called by the block builder before mining.
   * @returns {object[]} transactions to include in next block
   */
  async dequeueForMining() {
    const batch = this.pending.splice(0, config.blockchain.maxTxPerBlock);
    batch.forEach(tx => {
      tx.status = "confirming";
    });
    this.confirming.push(...batch);
    await this._persist();
    return batch;
  }

  /**
   * Mark transactions as confirmed after block is mined.
   * @param {string[]} txHashes - hashes of confirmed transactions
   * @param {number} blockIndex - block they were included in
   */
  async confirmTransactions(txHashes, blockIndex) {
    const hashSet = new Set(txHashes);
    const stillConfirming = [];

    for (const tx of this.confirming) {
      if (hashSet.has(tx.txHash)) {
        tx.status = "confirmed";
        tx.blockIndex = blockIndex;
        tx.confirmations = 1;
        this.confirmed.push(tx);
        this.emit("tx:confirmed", tx);
        console.log(`[TxPool] Confirmed: ${tx.txHash} in block ${blockIndex}`);
      } else {
        stillConfirming.push(tx);
      }
    }

    this.confirming = stillConfirming;

    // Increment confirmation count for already-confirmed transactions
    this.confirmed.forEach(tx => {
      if (tx.blockIndex !== null && tx.blockIndex < blockIndex) {
        tx.confirmations = Math.min(tx.confirmations + 1, 99);
        if (tx.confirmations >= config.blockchain.confirmationsRequired) {
          tx.status = "finalized";
        }
      }
    });

    await this._persist();
  }

  /**
   * Get a transaction by hash — searches all pools.
   * @param {string} txHash
   * @returns {object|null}
   */
  getTransaction(txHash) {
    return (
      this.pending.find(tx => tx.txHash === txHash) ||
      this.confirming.find(tx => tx.txHash === txHash) ||
      this.confirmed.find(tx => tx.txHash === txHash) ||
      this.failed.find(tx => tx.txHash === txHash) ||
      null
    );
  }

  /**
   * Get recent confirmed transactions for history display.
   * @param {number} limit
   * @returns {object[]}
   */
  getRecentConfirmed(limit = 50) {
    return [...this.confirmed]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Get all transactions across all pools (for full history view).
   * @returns {object[]}
   */
  getAllTransactions() {
    return [
      ...this.confirmed,
      ...this.pending,
      ...this.confirming,
      ...this.failed
    ].sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get current pool statistics.
   * @returns {object}
   */
  getStats() {
    return {
      pending:    this.pending.length,
      confirming: this.confirming.length,
      confirmed:  this.confirmed.length,
      failed:     this.failed.length,
      total:      this.pending.length + this.confirming.length + this.confirmed.length + this.failed.length
    };
  }

  /**
   * Validate raw transaction data from API input.
   * @param {object} txData
   */
  _validateTxData(txData) {
    const required = ["merchantAddress", "amount", "coin", "senderName", "senderAddress"];
    for (const field of required) {
      if (!txData[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    const amount = parseFloat(txData.amount);
    if (isNaN(amount) || amount <= 0) {
      throw new Error("Amount must be a positive number");
    }

    const validCoins = Object.keys(require("../../config").coins);
    if (!validCoins.includes(txData.coin)) {
      throw new Error(`Invalid coin type: ${txData.coin}. Valid: ${validCoins.join(", ")}`);
    }
  }

  /**
   * Expire transactions that have been pending too long.
   */
  _expireStale() {
    const now = Date.now();
    const expired = this.pending.filter(tx => tx.expiresAt && tx.expiresAt < now);

    if (expired.length > 0) {
      expired.forEach(tx => {
        tx.status = "failed";
        tx.failReason = "expired";
        this.failed.push(tx);
        this.emit("tx:expired", tx);
      });
      this.pending = this.pending.filter(tx => !tx.expiresAt || tx.expiresAt >= now);
      this._persist();
      console.log(`[TxPool] Expired ${expired.length} stale transactions`);
    }
  }

  /**
   * Start the periodic expiry check timer.
   */
  _startExpiryTimer() {
    setInterval(() => this._expireStale(), 30000);  // check every 30 seconds
  }

  /**
   * Persist pool state to disk.
   */
  async _persist() {
    await persistence.saveTxPool({
      pending:    this.pending,
      confirming: this.confirming,
      confirmed:  this.confirmed.slice(-200),  // keep last 200 confirmed
      failed:     this.failed.slice(-50)
    });
  }
}

// Export singleton
const txPool = new TransactionPool();
module.exports = txPool;
