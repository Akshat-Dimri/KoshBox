/**
 * KoshBox — Global Simulator State
 * Single source of truth for the entire frontend simulator.
 * All components read from and write to this object.
 * Components communicate via CustomEvents — never direct calls between siblings.
 */

"use strict";

const SimulatorState = {

  device: {
    power:           "off",     // off | booting | on | sleep | shutdown
    battery:         85,        // 0–100
    batteryCharging: false,
    network:         "disconnected", // disconnected | connecting | connected | weak | reconnecting
    volume:          70,        // 0–100
    muted:           false,
    language:        "en",      // en | hi
    uptime:          0,         // seconds since boot
    bootCount:       0,
    totalPayments:   0,
    totalVolume:     "0.00",
    lastPaymentAt:   null
  },

  qr: {
    mode:             "fixed",  // fixed | dynamic
    rotationInterval: 1800000,  // ms
    lastRotated:      null,
    currentData:      null,     // QR payload string
    sessionId:        null,
    sessionExpiry:    null,
    merchantAddress:  "0x742d35Cc6634C0532925a3b8D4C9b7F3a7C2F1E"
  },

  blockchain: {
    status:      "offline",     // offline | syncing | synced
    latestBlock: 0,
    pendingCount: 0,
    networkId:   "kosh-testnet-1"
  },

  transactions: [],             // Array of TransactionRecord

  ui: {
    explodedViewOpen:    false,
    firmwareEditorOpen:  false,
    activeModal:         null,
    demoActive:          false,
    demoStep:            -1
  },

  /**
   * Update a slice of state and emit a state:changed event.
   * @param {string} slice - top-level key: "device" | "qr" | "blockchain" | "ui"
   * @param {object} patch - partial object to merge into the slice
   */
  update(slice, patch) {
    if (!this[slice] || typeof this[slice] !== "object") {
      console.warn(`[State] Unknown slice: ${slice}`);
      return;
    }
    Object.assign(this[slice], patch);
    document.dispatchEvent(new CustomEvent("koshbox:state-changed", {
      detail: { slice, patch, state: this[slice] }
    }));
  },

  /**
   * Add a transaction to the local log.
   * Newest first. Capped at 200.
   * @param {object} tx
   */
  addTransaction(tx) {
    const existing = this.transactions.findIndex(t => t.txHash === tx.txHash);
    if (existing >= 0) {
      this.transactions[existing] = { ...this.transactions[existing], ...tx };
    } else {
      this.transactions.unshift(tx);
      if (this.transactions.length > 200) {
        this.transactions = this.transactions.slice(0, 200);
      }
    }
    document.dispatchEvent(new CustomEvent("koshbox:transaction-updated", {
      detail: { tx }
    }));
  },

  /**
   * Get a transaction by hash.
   * @param {string} txHash
   * @returns {object|null}
   */
  getTransaction(txHash) {
    return this.transactions.find(t => t.txHash === txHash) || null;
  },

  /**
   * Get recent confirmed transactions.
   * @param {number} limit
   * @returns {object[]}
   */
  getRecentConfirmed(limit = 10) {
    return this.transactions
      .filter(t => t.status === "confirmed" || t.status === "finalized")
      .slice(0, limit);
  }
};

// Make globally available
window.SimulatorState = SimulatorState;
