/**
 * KoshBox — Kosh Testnet Chain Manager
 * Manages the canonical blockchain: genesis, block addition, chain validation.
 * Persists to JSON. Emits events on new blocks.
 * Migration path: replace this module with an ethers.js RPC client for Polygon.
 */

"use strict";

const { computeBlockHash, computeMerkleRoot } = require("./utils");
const persistence = require("../services/persistence-service");
const config = require("../config");
const EventEmitter = require("events");

class KoshChain extends EventEmitter {
  constructor() {
    super();
    this.blocks = [];
    this.startTime = null;
    this.initialized = false;
  }

  /**
   * Initialize the chain — load from disk or create genesis block.
   */
  async init() {
    const stored = await persistence.loadChain();

    if (stored && stored.length > 0) {
      this.blocks = stored;
      console.log(`[KoshChain] Loaded chain — ${this.blocks.length} blocks`);
    } else {
      const genesis = this._createGenesisBlock();
      this.blocks = [genesis];
      await this._persist();
      console.log("[KoshChain] Genesis block created");
    }

    this.startTime = Date.now();
    this.initialized = true;
  }

  /**
   * Create the genesis block.
   * @returns {object}
   */
  _createGenesisBlock() {
    const block = {
      index: 0,
      timestamp: config.blockchain.genesisTimestamp,
      previousHash: "0000000000000000000000000000000000000000000000000000000000000000",
      merkleRoot: computeMerkleRoot([]),
      nonce: 0,
      transactionCount: 0,
      transactions: [],
      hash: ""
    };

    block.hash = computeBlockHash(block);
    return block;
  }

  /**
   * Add a new block to the chain.
   * Validates block integrity before appending.
   * @param {object} block
   */
  async addBlock(block) {
    const latest = this.getLatestBlock();

    if (block.index !== latest.index + 1) {
      throw new Error(`Invalid block index: expected ${latest.index + 1}, got ${block.index}`);
    }

    if (block.previousHash !== latest.hash) {
      throw new Error("Invalid previousHash — chain integrity violation");
    }

    const expectedHash = computeBlockHash(block);
    if (block.hash !== expectedHash) {
      throw new Error("Invalid block hash — block data corrupted");
    }

    this.blocks.push(block);
    await this._persist();

    this.emit("block:added", block);
    return block;
  }

  /**
   * Get the latest (tip) block.
   * @returns {object}
   */
  getLatestBlock() {
    return this.blocks[this.blocks.length - 1];
  }

  /**
   * Get a block by index.
   * @param {number} index
   * @returns {object|null}
   */
  getBlock(index) {
    return this.blocks[index] || null;
  }

  /**
   * Get the most recent N blocks (newest first).
   * @param {number} limit
   * @returns {object[]}
   */
  getRecentBlocks(limit = 10) {
    return [...this.blocks]
      .reverse()
      .slice(0, limit)
      .map(b => this._sanitizeBlock(b));
  }

  /**
   * Get chain status summary.
   * @returns {object}
   */
  getStatus() {
    const latest = this.getLatestBlock();
    return {
      networkId:     config.blockchain.networkId,
      chainId:       config.blockchain.chainId,
      latestBlock:   latest.index,
      latestHash:    latest.hash,
      totalBlocks:   this.blocks.length,
      uptime:        this.startTime ? Date.now() - this.startTime : 0,
      currency:      config.blockchain.currencySymbol,
      blockTime:     config.blockchain.blockTime
    };
  }

  /**
   * Validate the entire chain integrity (hash linking).
   * @returns {{ valid: boolean, error: string|null }}
   */
  validateChain() {
    for (let i = 1; i < this.blocks.length; i++) {
      const current = this.blocks[i];
      const previous = this.blocks[i - 1];

      if (current.previousHash !== previous.hash) {
        return { valid: false, error: `Chain broken at block ${i}: previousHash mismatch` };
      }

      const expectedHash = computeBlockHash(current);
      if (current.hash !== expectedHash) {
        return { valid: false, error: `Block ${i} hash is invalid` };
      }
    }

    return { valid: true, error: null };
  }

  /**
   * Get total transaction count across all blocks.
   * @returns {number}
   */
  getTotalTransactionCount() {
    return this.blocks.reduce((sum, b) => sum + b.transactionCount, 0);
  }

  /**
   * Strip large transaction arrays from block for lightweight API responses.
   * @param {object} block
   * @returns {object}
   */
  _sanitizeBlock(block) {
    return {
      index:            block.index,
      timestamp:        block.timestamp,
      hash:             block.hash,
      previousHash:     block.previousHash,
      merkleRoot:       block.merkleRoot,
      nonce:            block.nonce,
      transactionCount: block.transactionCount
    };
  }

  /**
   * Reset chain to genesis (used by reset tool).
   */
  async reset() {
    const genesis = this._createGenesisBlock();
    this.blocks = [genesis];
    await this._persist();
    console.log("[KoshChain] Chain reset to genesis");
  }

  /**
   * Persist chain to disk.
   */
  async _persist() {
    // Store only last 1000 blocks to prevent unbounded growth in demo use
    const toStore = this.blocks.slice(-1000);
    await persistence.saveChain(toStore);
  }
}

// Export singleton
const koshChain = new KoshChain();
module.exports = koshChain;
