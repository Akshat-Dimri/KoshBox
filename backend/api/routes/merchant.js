/**
 * KoshBox — Merchant API Routes
 * GET /api/merchant/info
 * GET /api/merchant/qr/fixed
 * GET /api/merchant/qr/dynamic
 * POST /api/merchant/qr/validate-session
 */

"use strict";

const express = require("express");
const router = express.Router();

const walletManager = require("../../blockchain/wallets/wallet-manager");
const qrService     = require("../../services/qr-service");
const config        = require("../../config");

/**
 * GET /api/merchant/info
 * Returns merchant identity and wallet summary.
 */
router.get("/info", (req, res) => {
  const wallet = walletManager.getMerchantWallet();

  return res.json({
    success: true,
    merchant: {
      name:    config.merchant.defaultName,
      address: config.merchant.defaultAddress,
      network: config.blockchain.networkId,
      balance: wallet ? wallet.balance : {},
      totalTransactions: wallet ? wallet.transactionCount : 0
    }
  });
});

/**
 * GET /api/merchant/qr/fixed
 * Returns the fixed merchant QR payload (permanent address QR).
 */
router.get("/qr/fixed", (req, res) => {
  const merchantAddress = req.query.address || config.merchant.defaultAddress;
  const payload = qrService.generateFixedQRPayload(merchantAddress);

  return res.json({
    success: true,
    mode:    "fixed",
    payload,
    merchantAddress
  });
});

/**
 * GET /api/merchant/qr/dynamic
 * Returns a new dynamic QR payload with a fresh session.
 * Query params:
 *   interval - rotation interval in ms (defaults to config)
 *   address  - merchant address (defaults to config)
 */
router.get("/qr/dynamic", (req, res) => {
  const merchantAddress    = req.query.address  || config.merchant.defaultAddress;
  const rotationInterval   = parseInt(req.query.interval) || config.qr.defaultRotationInterval;

  const result = qrService.generateDynamicQRPayload(merchantAddress, rotationInterval);

  return res.json({
    success: true,
    mode:    "dynamic",
    payload:    result.payload,
    sessionId:  result.sessionId,
    expiresAt:  result.expiresAt,
    rotationInterval,
    merchantAddress
  });
});

/**
 * POST /api/merchant/qr/validate-session
 * Validates a dynamic QR session before allowing payment submission.
 * Body: { sessionId: string }
 */
router.post("/qr/validate-session", (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) {
    return res.status(400).json({ success: false, error: "sessionId is required" });
  }

  const result = qrService.validateSession(sessionId);
  return res.json({ success: true, ...result });
});

/**
 * GET /api/merchant/qr/intervals
 * Returns the available QR rotation intervals for the UI dropdown.
 */
router.get("/qr/intervals", (req, res) => {
  return res.json({
    success: true,
    intervals: qrService.getRotationIntervals()
  });
});

/**
 * GET /api/merchant/coins
 * Returns the supported coin types for the payment form.
 */
router.get("/coins", (req, res) => {
  return res.json({
    success: true,
    coins: config.coins
  });
});

module.exports = router;
