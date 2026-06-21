/**
 * KoshBox — Network Simulator
 * Simulates WiFi/4G network conditions for the device twin.
 * Controls connection state transitions with realistic timing.
 */

"use strict";

const config = require("../config");
const EventEmitter = require("events");

class NetworkSimulator extends EventEmitter {
  constructor() {
    super();
    this.status = "disconnected";
    this.reconnectTimer = null;
    this.recoveryTimer = null;
    this.deviceTwin = null;
  }

  /**
   * Bind to the device twin for state updates.
   * @param {object} deviceTwin
   */
  bind(deviceTwin) {
    this.deviceTwin = deviceTwin;
  }

  /**
   * Initiate a connection attempt.
   * Simulates DHCP delay and occasional failure.
   */
  connect() {
    if (this.status === "connected") return;
    this._transition("connecting");

    const delay = this._randomBetween(
      config.network.connectDelayMin,
      config.network.connectDelayMax
    );

    setTimeout(() => {
      const failed = Math.random() < config.network.connectFailureChance;
      if (failed) {
        console.log("[NetworkSimulator] Connection attempt failed (simulated)");
        this._transition("disconnected");
        this._scheduleReconnect();
      } else {
        this._transition("connected");
      }
    }, delay);
  }

  /**
   * Simulate a network failure (triggered by control panel button).
   */
  simulateFailure() {
    this._clearTimers();
    this._transition("disconnected");
    this._scheduleReconnect();
    console.log("[NetworkSimulator] Network failure simulated");
  }

  /**
   * Simulate weak signal (triggered by control panel button).
   */
  simulateWeakSignal() {
    if (this.status !== "connected") return;
    this._transition("weak");
    this._scheduleWeakRecovery();
    console.log("[NetworkSimulator] Weak signal simulated");
  }

  /**
   * Force disconnect (triggered by power off).
   */
  disconnect() {
    this._clearTimers();
    this._transition("disconnected");
  }

  /**
   * Get current network status.
   * @returns {string}
   */
  getStatus() {
    return this.status;
  }

  /**
   * Get network status with signal quality info.
   * @returns {object}
   */
  getStatusDetail() {
    const signalStrength = {
      connected:    { bars: 4, label: "Strong" },
      weak:         { bars: 2, label: "Weak" },
      connecting:   { bars: 0, label: "Connecting..." },
      reconnecting: { bars: 1, label: "Reconnecting..." },
      disconnected: { bars: 0, label: "Disconnected" }
    };

    return {
      status: this.status,
      signal: signalStrength[this.status] || { bars: 0, label: "Unknown" }
    };
  }

  /**
   * Transition to a new network state and notify listeners.
   * @param {string} newStatus
   */
  _transition(newStatus) {
    const previous = this.status;
    this.status = newStatus;

    if (this.deviceTwin) {
      this.deviceTwin.setNetwork(newStatus);
    }

    this.emit("status:changed", { status: newStatus, previous });
    console.log(`[NetworkSimulator] ${previous} → ${newStatus}`);
  }

  /**
   * Schedule automatic reconnect attempt after disconnect.
   */
  _scheduleReconnect() {
    this._clearTimers();
    this.reconnectTimer = setTimeout(() => {
      if (this.status === "disconnected") {
        this._transition("reconnecting");
        setTimeout(() => this.connect(), 1000);
      }
    }, config.network.reconnectIntervalMs);
  }

  /**
   * Schedule weak signal recovery or escalation to disconnected.
   */
  _scheduleWeakRecovery() {
    if (this.recoveryTimer) clearTimeout(this.recoveryTimer);

    const delay = this._randomBetween(
      config.network.weakSignalRecoveryMin,
      config.network.weakSignalRecoveryMax
    );

    this.recoveryTimer = setTimeout(() => {
      if (this.status !== "weak") return;

      const escalate = Math.random() < config.network.weakSignalEscalationChance;
      if (escalate) {
        console.log("[NetworkSimulator] Weak signal escalated to disconnected");
        this._transition("disconnected");
        this._scheduleReconnect();
      } else {
        console.log("[NetworkSimulator] Weak signal recovered to connected");
        this._transition("connected");
      }
    }, delay);
  }

  /**
   * Clear all pending timers.
   */
  _clearTimers() {
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    if (this.recoveryTimer)  { clearTimeout(this.recoveryTimer);  this.recoveryTimer = null;  }
  }

  /**
   * Random integer between min and max (inclusive).
   */
  _randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}

// Export singleton
const networkSimulator = new NetworkSimulator();
module.exports = networkSimulator;
