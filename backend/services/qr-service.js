/**
 * KoshBox — QR Service
 * Generates QR payload strings for fixed and dynamic merchant QR codes.
 * The actual QR image is rendered client-side using qrcode.js.
 */

"use strict";

const { sha256 } = require("../blockchain/utils");
const config = require("../config");

class QRService {
  constructor() {
    this.currentSession = null;
    this.sessionExpiry = null;
  }

  /**
   * Generate the fixed merchant QR payload.
   * Encodes the merchant's permanent wallet address.
   * This QR never changes — it is the merchant's permanent payment identity.
   * @param {string} merchantAddress
   * @returns {string} URL payload for QR encoding
   */
  generateFixedQRPayload(merchantAddress) {
    const params = new URLSearchParams({
      to:      merchantAddress,
      network: config.blockchain.networkId,
      type:    "fixed"
    });
    return `${config.qr.paymentBaseUrl}?${params.toString()}`;
  }

  /**
   * Generate a dynamic QR payload with a time-limited session.
   * Each rotation produces a new session ID and expiry timestamp.
   * @param {string} merchantAddress
   * @param {number} rotationInterval - ms until next rotation
   * @returns {object} { payload, sessionId, expiresAt }
   */
  generateDynamicQRPayload(merchantAddress, rotationInterval) {
    const sessionId = this._generateSessionId(merchantAddress);
    const expiresAt = Date.now() + rotationInterval + config.qr.sessionExpiryBuffer;

    this.currentSession = sessionId;
    this.sessionExpiry = expiresAt;

    const params = new URLSearchParams({
      to:        merchantAddress,
      network:   config.blockchain.networkId,
      session:   sessionId,
      expires:   expiresAt.toString(),
      type:      "dynamic"
    });

    return {
      payload:   `${config.qr.paymentBaseUrl}?${params.toString()}`,
      sessionId,
      expiresAt
    };
  }

  /**
   * Validate a dynamic session ID — check it matches current session and has not expired.
   * @param {string} sessionId
   * @returns {{ valid: boolean, reason: string|null }}
   */
  validateSession(sessionId) {
    if (!this.currentSession) {
      return { valid: false, reason: "No active dynamic session" };
    }
    if (sessionId !== this.currentSession) {
      return { valid: false, reason: "Session ID does not match current session — QR may have rotated" };
    }
    if (Date.now() > this.sessionExpiry) {
      return { valid: false, reason: "Session expired — please scan the latest QR code" };
    }
    return { valid: true, reason: null };
  }

  /**
   * Get the current rotation interval options for the UI.
   * @returns {object[]}
   */
  getRotationIntervals() {
    return config.qr.rotationIntervals;
  }

  /**
   * Generate a unique session ID from merchant address and current timestamp.
   * @param {string} merchantAddress
   * @returns {string} 16-char hex session ID
   */
  _generateSessionId(merchantAddress) {
    const raw = merchantAddress + Date.now() + Math.random();
    return sha256(raw).substring(0, 16);
  }
}

// Export singleton
const qrService = new QRService();
module.exports = qrService;
