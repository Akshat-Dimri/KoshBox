/**
 * KoshBox — Block Builder
 * Constructs blocks from mempool transactions.
 * Simulates mining delay. Computes block hashes.
 * Runs on a configurable timer interval.
 */

"use strict";

const { computeBlockHash, computeMerkleRoot } = require("../utils");
const config = require("../../config");
const EventEmitter = require("events");

class BlockBuilder extends EventEmitter {
  constructor() {
    super();
    this.isRunning = false;
    this.isMining = false;
    this.timer = null;
  }

  /**
   * Start the block mining timer.
   * @param {object} chain - reference to the KoshChain instance
   * @param {object} txPool - reference to the TransactionPool instance
   */
  start(chain, txPool) {
    if (this.isRunning) return;
    this.chain = chain;
    this.txPool = txPool;
    this.isRunning = true;
    this.timer = setInterval(() => this._miningCycle(), config.blockchain.blockTime);
    console.log(`[BlockBuilder] Started — block time: ${config.blockchain.blockTime}ms`);
  }

  /**
   * Stop the mining timer.
   */
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    console.log("[BlockBuilder] Stopped");
  }

  /**
   * One mining cycle — check mempool, build block if transactions exist.
   */
  async _miningCycle() {
    if (this.isMining) return;  // prevent overlapping cycles

    const stats = this.txPool.getStats();
    if (stats.pending === 0) return;  // no empty blocks

    this.isMining = true;

    try {
      // Dequeue pending transactions
      const transactions = await this.txPool.dequeueForMining();
      if (transactions.length === 0) {
        this.isMining = false;
        return;
      }

      console.log(`[BlockBuilder] Mining block with ${transactions.length} transaction(s)...`);
      this.emit("block:mining", { txCount: transactions.length });

      // Simulate mining delay
      await this._simulateMiningDelay();

      // Build the block
      const block = await this._buildBlock(transactions);

      // Add to chain
      await this.chain.addBlock(block);

      // Confirm transactions in pool
      const txHashes = transactions.map(tx => tx.txHash);
      await this.txPool.confirmTransactions(txHashes, block.index);

      console.log(`[BlockBuilder] Block ${block.index} mined — hash: ${block.hash.substring(0, 16)}...`);
      this.emit("block:mined", block);

    } catch (err) {
      console.error("[BlockBuilder] Mining error:", err.message);
      this.emit("block:error", { error: err.message });
    } finally {
      this.isMining = false;
    }
  }

  /**
   * Construct a block from a set of transactions.
   * @param {object[]} transactions
   * @returns {object} complete block
   */
  async _buildBlock(transactions) {
    const latestBlock = this.chain.getLatestBlock();
    const index = latestBlock.index + 1;
    const previousHash = latestBlock.hash;
    const timestamp = Date.now();
    const merkleRoot = computeMerkleRoot(transactions.map(tx => tx.txHash));
    const nonce = this._generateNonce();

    const block = {
      index,
      timestamp,
      previousHash,
      merkleRoot,
      nonce,
      transactionCount: transactions.length,
      transactions,
      hash: ""
    };

    block.hash = computeBlockHash(block);
    return block;
  }

  /**
   * Simulate a random mining delay within configured range.
   * @returns {Promise<void>}
   */
  _simulateMiningDelay() {
    const { min, max } = config.blockchain.miningDelay;
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Generate a simulated nonce value.
   * Not real proof-of-work — just for structural authenticity.
   * @returns {number}
   */
  _generateNonce() {
    return Math.floor(Math.random() * 1000000);
  }

  /**
   * Force-mine a block immediately (used by demo mode and test tools).
   * @returns {Promise<object>} the mined block
   */
  async forceMine() {
    if (this.txPool.getStats().pending === 0) {
      throw new Error("No pending transactions to mine");
    }
    await this._miningCycle();
  }
}

// Export singleton
const blockBuilder = new BlockBuilder();
module.exports = blockBuilder;
