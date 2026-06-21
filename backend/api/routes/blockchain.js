/**
 * KoshBox — Blockchain API Routes
 * GET /api/blockchain/status
 * GET /api/blockchain/blocks
 * GET /api/blockchain/blocks/:index
 * GET /api/blockchain/validate
 */

"use strict";

const express = require("express");
const router = express.Router();

const chain         = require("../../blockchain/chain");
const txPool        = require("../../blockchain/transactions/transaction-pool");
const walletManager = require("../../blockchain/wallets/wallet-manager");

/**
 * GET /api/blockchain/status
 * Returns chain health, latest block, and network info.
 */
router.get("/status", (req, res) => {
  const status   = chain.getStatus();
  const txStats  = txPool.getStats();

  return res.json({
    success: true,
    chain: {
      ...status,
      pendingTransactions: txStats.pending,
      confirmingTransactions: txStats.confirming,
      totalTransactions: chain.getTotalTransactionCount()
    }
  });
});

/**
 * GET /api/blockchain/blocks
 * Returns recent blocks (lightweight, no full tx arrays).
 */
router.get("/blocks", (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 10, 50);
  const blocks = chain.getRecentBlocks(limit);

  return res.json({
    success: true,
    count:   blocks.length,
    blocks
  });
});

/**
 * GET /api/blockchain/blocks/:index
 * Returns a specific block including its full transaction list.
 */
router.get("/blocks/:index", (req, res) => {
  const index = parseInt(req.params.index);
  if (isNaN(index) || index < 0) {
    return res.status(400).json({ success: false, error: "Invalid block index" });
  }

  const block = chain.getBlock(index);
  if (!block) {
    return res.status(404).json({ success: false, error: `Block ${index} not found` });
  }

  return res.json({ success: true, block });
});

/**
 * GET /api/blockchain/validate
 * Validates the entire chain integrity.
 */
router.get("/validate", (req, res) => {
  const result = chain.validateChain();
  return res.json({ success: true, ...result });
});

/**
 * GET /api/blockchain/wallets
 * Returns all wallets (for diagnostics and developer console).
 */
router.get("/wallets", (req, res) => {
  const wallets = walletManager.getAllWallets().map(w => ({
    address: w.address,
    label:   w.label,
    type:    w.type,
    balance: w.balance,
    nonce:   w.nonce,
    transactionCount: w.transactionCount
  }));

  return res.json({ success: true, count: wallets.length, wallets });
});

/**
 * GET /api/blockchain/wallets/:address
 * Returns a specific wallet's details and balance.
 */
router.get("/wallets/:address", (req, res) => {
  const wallet = walletManager.getWallet(req.params.address);
  if (!wallet) {
    return res.status(404).json({ success: false, error: "Wallet not found" });
  }

  return res.json({
    success: true,
    wallet: {
      address: wallet.address,
      label:   wallet.label,
      type:    wallet.type,
      balance: wallet.balance,
      nonce:   wallet.nonce,
      transactionCount: wallet.transactionCount,
      createdAt: wallet.createdAt
    }
  });
});

module.exports = router;
