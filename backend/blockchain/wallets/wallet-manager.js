/**
 * KoshBox — Wallet Manager
 * Manages merchant and customer wallets.
 * Deterministic address generation from seeds.
 * When migrating to Polygon: replace generateAddress() with ethers.Wallet.createRandom()
 */

"use strict";

const { generateAddress, sha256 } = require("../utils");
const persistence = require("../../services/persistence-service");
const config = require("../../config");

class WalletManager {
  constructor() {
    this.wallets = new Map();
    this.initialized = false;
  }

  /**
   * Initialize wallet manager — load from disk or create defaults.
   */
  async init() {
    const stored = await persistence.loadWallets();

    if (stored && stored.length > 0) {
      stored.forEach(w => this.wallets.set(w.address, w));
    } else {
      await this._createDefaultWallets();
    }

    this.initialized = true;
    console.log(`[WalletManager] Loaded ${this.wallets.size} wallets`);
  }

  /**
   * Create default merchant wallet and system wallets on first run.
   */
  async _createDefaultWallets() {
    const merchantWallet = this._buildWallet(
      config.merchant.defaultSeed,
      "merchant",
      config.merchant.defaultName,
      { KOSH: "10000.00", ETH: "0.00", MATIC: "0.00", USDT: "500.00" }
    );

    // Override with canonical merchant address from config
    merchantWallet.address = config.merchant.defaultAddress;

    const systemWallet = this._buildWallet(
      "koshbox-system-wallet-seed",
      "system",
      "Kosh Testnet Faucet",
      { KOSH: "1000000.00", ETH: "0.00", MATIC: "0.00", USDT: "0.00" }
    );

    // Pre-generate 5 test customer wallets
    const testCustomers = [
      { seed: "customer-rahul-v1",  name: "Rahul" },
      { seed: "customer-priya-v1",  name: "Priya" },
      { seed: "customer-arjun-v1",  name: "Arjun" },
      { seed: "customer-sneha-v1",  name: "Sneha" },
      { seed: "customer-vikram-v1", name: "Vikram" }
    ];

    this.wallets.set(merchantWallet.address, merchantWallet);
    this.wallets.set(systemWallet.address, systemWallet);

    testCustomers.forEach(c => {
      const wallet = this._buildWallet(
        c.seed, "customer", c.name,
        { KOSH: "5000.00", ETH: "0.00", MATIC: "0.00", USDT: "200.00" }
      );
      this.wallets.set(wallet.address, wallet);
    });

    await this._persist();
  }

  /**
   * Build a wallet object from a seed.
   */
  _buildWallet(seed, type, label, initialBalances) {
    return {
      address: generateAddress(seed),
      label,
      type,
      seed: sha256(seed),   // store hashed seed only
      balance: { ...initialBalances },
      nonce: 0,
      transactionCount: 0,
      createdAt: Date.now()
    };
  }

  /**
   * Get a wallet by address.
   * @param {string} address
   * @returns {object|null}
   */
  getWallet(address) {
    return this.wallets.get(address) || null;
  }

  /**
   * Get the merchant wallet.
   * @returns {object}
   */
  getMerchantWallet() {
    return this.wallets.get(config.merchant.defaultAddress);
  }

  /**
   * Get all wallets as array.
   * @returns {object[]}
   */
  getAllWallets() {
    return Array.from(this.wallets.values());
  }

  /**
   * Get all customer wallets.
   * @returns {object[]}
   */
  getCustomerWallets() {
    return this.getAllWallets().filter(w => w.type === "customer");
  }

  /**
   * Create or retrieve a customer wallet by sender name.
   * In simulation, each unique name gets a deterministic wallet.
   * @param {string} senderName
   * @returns {object}
   */
  getOrCreateCustomerWallet(senderName) {
    const seed = `customer-${senderName.toLowerCase().trim()}-v1`;
    const address = generateAddress(seed);

    if (this.wallets.has(address)) {
      return this.wallets.get(address);
    }

    const wallet = this._buildWallet(
      seed, "customer", senderName,
      { KOSH: "5000.00", ETH: "0.00", MATIC: "0.00", USDT: "200.00" }
    );
    this.wallets.set(wallet.address, wallet);
    this._persist();
    return wallet;
  }

  /**
   * Apply a confirmed transaction to wallet balances.
   * Deducts from sender, credits to receiver.
   * @param {object} tx - confirmed transaction
   */
  async applyTransaction(tx) {
    const sender = this.wallets.get(tx.from);
    const receiver = this.wallets.get(tx.to);
    const amount = parseFloat(tx.amount);
    const coin = tx.coin;

    if (sender) {
      const currentBalance = parseFloat(sender.balance[coin] || "0");
      sender.balance[coin] = Math.max(0, currentBalance - amount).toFixed(2);
      sender.nonce += 1;
      sender.transactionCount += 1;
    }

    if (receiver) {
      const currentBalance = parseFloat(receiver.balance[coin] || "0");
      receiver.balance[coin] = (currentBalance + amount).toFixed(2);
      receiver.transactionCount += 1;
    }

    await this._persist();
  }

  /**
   * Get balance of a wallet for a specific coin.
   * @param {string} address
   * @param {string} coin
   * @returns {string}
   */
  getBalance(address, coin = "KOSH") {
    const wallet = this.wallets.get(address);
    if (!wallet) return "0.00";
    return wallet.balance[coin] || "0.00";
  }

  /**
   * Validate that a sender has sufficient balance.
   * @param {string} address
   * @param {string} coin
   * @param {number} amount
   * @returns {boolean}
   */
  hasSufficientBalance(address, coin, amount) {
    const balance = parseFloat(this.getBalance(address, coin));
    return balance >= amount;
  }

  /**
   * Persist wallet state to disk.
   */
  async _persist() {
    await persistence.saveWallets(Array.from(this.wallets.values()));
  }
}

// Export singleton
const walletManager = new WalletManager();
module.exports = walletManager;
