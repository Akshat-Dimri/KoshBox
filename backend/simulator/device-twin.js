/**
 * KoshBox — Device Twin
 * Server-side representation of the KoshBox device state.
 * Mirrors the frontend device state machine.
 * State is persisted so the device remembers its last state on server restart.
 */

"use strict";

const persistence = require("../services/persistence-service");
const config = require("../config");
const EventEmitter = require("events");

const VALID_STATES = ["off", "booting", "on", "sleep", "shutdown"];

class DeviceTwin extends EventEmitter {
  constructor() {
    super();
    this.state = this._defaultState();
    this.initialized = false;
    this._batteryTimer = null;
    this._uptimeTimer = null;
  }

  /**
   * Default device state on first boot.
   */
  _defaultState() {
    return {
      power:          "off",
      battery:        85,
      batteryCharging:false,
      network:        "disconnected",
      volume:         config.device.defaultVolume,
      muted:          false,
      language:       config.device.defaultLanguage,
      uptime:         0,
      lastPayment:    null,
      lastPaymentAt:  null,
      bootCount:      0,
      totalPayments:  0,
      totalVolume:    "0.00"
    };
  }

  /**
   * Initialize device twin — load persisted state or use defaults.
   */
  async init() {
    const stored = await persistence.loadDeviceState();
    if (stored) {
      this.state = { ...this._defaultState(), ...stored };
      // Always boot in off state regardless of last known state
      this.state.power = "off";
      this.state.network = "disconnected";
      this.state.uptime = 0;
    }
    this.initialized = true;
    this._startBatteryTimer();
    console.log("[DeviceTwin] Initialized");
  }

  /**
   * Get a copy of the current device state.
   * @returns {object}
   */
  getState() {
    return { ...this.state };
  }

  /**
   * Update device state with a partial patch.
   * @param {object} patch - fields to update
   */
  async updateState(patch) {
    const allowedFields = [
      "power", "battery", "batteryCharging", "network",
      "volume", "muted", "language", "lastPayment", "lastPaymentAt"
    ];

    for (const key of allowedFields) {
      if (patch[key] !== undefined) {
        this.state[key] = patch[key];
      }
    }

    if (patch.power === "booting") {
      this.state.bootCount += 1;
      this.state.uptime = 0;
    }

    await this._persist();
    this.emit("state:updated", this.getState());
  }

  /**
   * Record a completed payment on the device twin.
   * @param {object} tx - confirmed transaction
   */
  async recordPayment(tx) {
    this.state.lastPayment = tx.txHash;
    this.state.lastPaymentAt = tx.timestamp;
    this.state.totalPayments += 1;

    const current = parseFloat(this.state.totalVolume) || 0;
    this.state.totalVolume = (current + parseFloat(tx.amount)).toFixed(2);

    // Battery drain from payment event
    this.state.battery = Math.max(
      0,
      this.state.battery - config.device.batteryDrainPerPayment
    );

    await this._persist();
    this.emit("payment:recorded", tx);
  }

  /**
   * Set battery level directly (used by simulate low battery, charging).
   * @param {number} level - 0 to 100
   * @param {boolean} charging
   */
  async setBattery(level, charging = false) {
    this.state.battery = Math.max(0, Math.min(100, parseFloat(level.toFixed(1))));
    this.state.batteryCharging = charging;
    await this._persist();
    this.emit("battery:updated", { level: this.state.battery, charging });
  }

  /**
   * Set network status.
   * @param {string} status - connected | disconnected | weak | connecting | reconnecting
   */
  async setNetwork(status) {
    this.state.network = status;
    await this._persist();
    this.emit("network:changed", { status });
  }

  /**
   * Start the battery drain simulation timer (runs server-side).
   * Frontend also runs its own drain model — this keeps server state in sync.
   */
  _startBatteryTimer() {
    this._batteryTimer = setInterval(async () => {
      if (this.state.power !== "on") return;

      if (this.state.batteryCharging) {
        // Charging
        const newLevel = Math.min(100, this.state.battery + config.device.batteryChargeRate / 10);
        this.state.battery = parseFloat(newLevel.toFixed(1));
      } else {
        // Draining
        const drain = this.state.power === "on"
          ? config.device.batteryDrainRateActive
          : config.device.batteryDrainRateIdle;
        this.state.battery = Math.max(0, parseFloat((this.state.battery - drain).toFixed(1)));
      }

      // Update uptime
      this.state.uptime += 10;

      // Persist every 30 seconds (every 3rd tick)
      if (this.state.uptime % 30 === 0) {
        await this._persist();
      }

      this.emit("battery:tick", { level: this.state.battery, charging: this.state.batteryCharging });

    }, 10000);  // every 10 seconds
  }

  /**
   * Get device analytics summary.
   * @returns {object}
   */
  getAnalytics() {
    return {
      power:         this.state.power,
      battery:       this.state.battery,
      charging:      this.state.batteryCharging,
      network:       this.state.network,
      uptime:        this.state.uptime,
      bootCount:     this.state.bootCount,
      totalPayments: this.state.totalPayments,
      totalVolume:   this.state.totalVolume,
      language:      this.state.language,
      volume:        this.state.volume,
      muted:         this.state.muted,
      lastPaymentAt: this.state.lastPaymentAt
    };
  }

  /**
   * Persist device state to disk.
   */
  async _persist() {
    await persistence.saveDeviceState(this.state);
  }

  /**
   * Clean up timers on shutdown.
   */
  destroy() {
    if (this._batteryTimer) clearInterval(this._batteryTimer);
  }
}

// Export singleton
const deviceTwin = new DeviceTwin();
module.exports = deviceTwin;
