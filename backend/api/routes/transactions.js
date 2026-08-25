/**
 * KoshBox — Transactions API Routes
 * POST /api/transactions/submit
 * GET  /api/transactions/status/:txHash
 * GET  /api/transactions/history
 * POST /api/transactions/inject  (test/demo injection)
 */

"use strict";

const express = require("express");
const router = express.Router();

const txPool        = require("../../blockchain/transactions/transaction-pool");
const walletManager = require("../../blockchain/wallets/wallet-manager");
const deviceTwin    = require("../../simulator/device-twin");
const announcementService = require("../../services/announcement-service");
const config        = require("../../config");

/**
 * POST /api/transactions/submit
 * Submit a new payment transaction from the customer payment page.
 */
router.post("/submit", async (req, res) => {
  try {
    const { merchantAddress, amount, coin, senderName, senderAddress } = req.body;

    // Get or create customer wallet
    const customerWallet = walletManager.getOrCreateCustomerWallet(senderName);
    const resolvedSenderAddress = senderAddress || customerWallet.address;

    // Validate balance (simulated — customers always have enough in testnet)
    const parsedAmount = parseFloat(amount);
    if (!walletManager.hasSufficientBalance(resolvedSenderAddress, coin, parsedAmount)) {
      return res.status(400).json({
        success: false,
        error: "Insufficient balance for this transaction"
      });
    }

    const txData = {
      merchantAddress: merchantAddress || config.merchant.defaultAddress,
      senderAddress:   resolvedSenderAddress,
      amount:          parsedAmount.toFixed(2),
      coin:            coin || "KOSH",
      senderName:      senderName.trim()
    };

    const tx = await txPool.submit(txData);

    return res.status(201).json({
      success: true,
      txHash:              tx.txHash,
      status:              tx.status,
      timestamp:           tx.timestamp,
      estimatedConfirmation: config.blockchain.blockTime * 2
    });

  } catch (err) {
    console.error("[/transactions/submit]", err.message);
    return res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/transactions/status/:txHash
 * Poll the status of a specific transaction.
 */
router.get("/status/:txHash", (req, res) => {
  const tx = txPool.getTransaction(req.params.txHash);

  if (!tx) {
    return res.status(404).json({ success: false, error: "Transaction not found" });
  }

  return res.json({
    success:       true,
    txHash:        tx.txHash,
    status:        tx.status,
    blockIndex:    tx.blockIndex,
    confirmations: tx.confirmations,
    amount:        tx.amount,
    coin:          tx.coin,
    senderName:    tx.senderName,
    timestamp:     tx.timestamp,
    announced:     tx.announced
  });
});

/**
 * GET /api/transactions/history
 * Get recent transaction history for the merchant dashboard.
 */
router.get("/history", (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);
  const transactions = txPool.getRecentConfirmed(limit);

  return res.json({
    success: true,
    count:   transactions.length,
    transactions: transactions.map(tx => ({
      txHash:     tx.txHash,
      amount:     tx.amount,
      coin:       tx.coin,
      senderName: tx.senderName,
      status:     tx.status,
      blockIndex: tx.blockIndex,
      timestamp:  tx.timestamp,
      announced:  tx.announced
    }))
  });
});

/**
 * GET /api/transactions/all
 * Get all transactions (pending + confirmed + failed) for the full history modal.
 */
router.get("/all", (req, res) => {
  const all = txPool.getAllTransactions();
  return res.json({ success: true, count: all.length, transactions: all });
});

/**
 * GET /api/transactions/stats
 * Get mempool statistics.
 */
router.get("/stats", (req, res) => {
  return res.json({ success: true, stats: txPool.getStats() });
});

/**
 * POST /api/transactions/inject
 * Inject a test/demo transaction directly (skips payment page flow).
 * Used by Inject Test Transaction button and demo mode.
 */
router.post("/inject", async (req, res) => {
  try {
    const senderName    = req.body.senderName    || "Demo Customer";
    const amount        = req.body.amount        || "100.00";
    const coin          = req.body.coin          || "KOSH";
    const merchantAddress = req.body.merchantAddress || config.merchant.defaultAddress;

    const customerWallet = walletManager.getOrCreateCustomerWallet(senderName);

    const txData = {
      merchantAddress,
      senderAddress: customerWallet.address,
      amount:        parseFloat(amount).toFixed(2),
      coin,
      senderName:    senderName.trim()
    };

    const tx = await txPool.submit(txData);

    return res.status(201).json({
      success:   true,
      txHash:    tx.txHash,
      status:    tx.status,
      timestamp: tx.timestamp,
      message:   "Test transaction injected into mempool"
    });

  } catch (err) {
    console.error("[/transactions/inject]", err.message);
    return res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/transactions/:txHash/mark-announced
 * Mark a transaction as announced (called by frontend after audio plays).
 */
router.post("/:txHash/mark-announced", async (req, res) => {
  const tx = await txPool.markAnnounced(req.params.txHash);
  if (!tx) {
    return res.status(404).json({ success: false, error: "Transaction not found" });
  }

  await deviceTwin.recordPayment(tx);

  return res.json({ success: true });
});

/**
 * GET /api/transactions/announcement/:txHash
 * Get the announcement sequence for a confirmed transaction.
 */
router.get("/announcement/:txHash", (req, res) => {
  const tx = txPool.getTransaction(req.params.txHash);
  if (!tx) {
    return res.status(404).json({ success: false, error: "Transaction not found" });
  }

  const language = req.query.lang || config.device.defaultLanguage;
  const sequence = announcementService.buildPaymentAnnouncement(tx, language);

  return res.json({ success: true, sequence });
});

module.exports = router;
