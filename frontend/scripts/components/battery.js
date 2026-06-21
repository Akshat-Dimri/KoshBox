/**
 * KoshBox — Battery Simulator
 * Manages battery drain, charging, low battery alerts,
 * and syncs the right-panel battery bar with device state.
 */

"use strict";

const BatterySimulator = (() => {

  const state = window.SimulatorState;
  let _drainInterval  = null;
  let _lowAlertFired  = false;
  let _critAlertFired = false;

  const DRAIN_TICK_MS  = 10000;  // 10 seconds
  const CHARGE_RATE    = 1.0;    // % per tick when charging
  const DRAIN_IDLE     = 0.008;
  const DRAIN_ACTIVE   = 0.015;
  const DRAIN_NETWORK  = 0.008;
  const DRAIN_WEAK_NET = 0.020;

  // ── Init ──────────────────────────────────────────────────────────────────
  function init() {
    _syncUI(state.device.battery, state.device.batteryCharging);

    // Charging toggle syncs UI
    const chargingToggle = document.getElementById("toggle-charging");
    if (chargingToggle) {
      chargingToggle.checked = state.device.batteryCharging;
    }

    // Listen for battery updates from state
    document.addEventListener("koshbox:state-changed", (e) => {
      if (e.detail.slice === "device") {
        const { battery, batteryCharging } = e.detail.state;
        if (battery !== undefined) {
          _syncUI(battery, batteryCharging);
          DeviceController.updateBatteryLED();
        }
      }
    });
  }

  // ── Start Drain Timer ────────────────────────────────────────────────────
  function startDrain() {
    stopDrain();
    _lowAlertFired  = false;
    _critAlertFired = false;

    _drainInterval = setInterval(() => {
      if (state.device.power !== "on") return;

      let delta;

      if (state.device.batteryCharging) {
        // Charging
        delta = +CHARGE_RATE;
      } else {
        // Discharging
        delta  = -DRAIN_ACTIVE;
        if (state.device.network === "connected")    delta -= DRAIN_NETWORK;
        if (state.device.network === "reconnecting") delta -= DRAIN_WEAK_NET;
      }

      const newLevel = Math.max(0, Math.min(100,
        parseFloat((state.device.battery + delta).toFixed(1))
      ));

      state.update("device", { battery: newLevel });
      _checkThresholds(newLevel);

    }, DRAIN_TICK_MS);
  }

  // ── Stop Drain Timer ──────────────────────────────────────────────────────
  function stopDrain() {
    if (_drainInterval) {
      clearInterval(_drainInterval);
      _drainInterval = null;
    }
  }

  // ── Apply Event Drain Burst ───────────────────────────────────────────────
  function applyEventDrain(type) {
    const drainMap = {
      payment:      0.3,
      announcement: 0.2,
      reconnect:    0.25
    };
    const drain = drainMap[type] || 0;
    if (drain === 0 || state.device.batteryCharging) return;

    const newLevel = Math.max(0, parseFloat((state.device.battery - drain).toFixed(1)));
    state.update("device", { battery: newLevel });
  }

  // ── Set Charging ──────────────────────────────────────────────────────────
  function setCharging(charging) {
    state.update("device", { batteryCharging: charging });
    _syncUI(state.device.battery, charging);
    DevConsole.log(charging ? "Charging started" : "Charging stopped", "info");

    // Sync toggle UI
    const badge = document.getElementById("charging-badge");
    if (badge) badge.classList.toggle("visible", charging);
  }

  // ── Simulate Low Battery ──────────────────────────────────────────────────
  function simulateLow() {
    const lowLevel = 15;
    state.update("device", { battery: lowLevel, batteryCharging: false });
    _syncUI(lowLevel, false);

    const chargingToggle = document.getElementById("toggle-charging");
    if (chargingToggle) chargingToggle.checked = false;

    _lowAlertFired  = false; // allow alert to fire
    _critAlertFired = false;
    _checkThresholds(lowLevel);
  }

  // ── Threshold Checks ──────────────────────────────────────────────────────
  function _checkThresholds(level) {
    if (level <= 5 && !_critAlertFired) {
      _critAlertFired = true;
      AudioEngine.announceSystem("critical_battery");
      DevConsole.log("Critical battery — device will sleep", "error");
      setTimeout(() => DeviceController.sleep(), 3000);

    } else if (level <= 20 && !_lowAlertFired) {
      _lowAlertFired = true;
      AudioEngine.announceSystem("low_battery");
      DevConsole.log("Low battery warning", "warn");
    }
  }

  // ── Sync UI ───────────────────────────────────────────────────────────────
  function _syncUI(level, charging) {
    const fill    = document.getElementById("battery-bar-fill");
    const pctLabel= document.getElementById("battery-percentage-label");
    const badge   = document.getElementById("charging-badge");

    if (fill) {
      fill.style.width = `${level}%`;
      fill.classList.toggle("low",      level <= 20 && level > 5);
      fill.classList.toggle("critical", level <= 5);
    }

    if (pctLabel) {
      pctLabel.textContent = `${Math.round(level)}%`;
    }

    if (badge) {
      badge.classList.toggle("visible", !!charging);
    }

    // Also update right-panel network section info strip
    const infoUptime = document.getElementById("info-uptime");
    if (infoUptime && state.device.power !== "on") {
      infoUptime.textContent = "—";
    }
  }

  // ── Public API ────────────────────────────────────────────────────────────
  return {
    init,
    startDrain,
    stopDrain,
    applyEventDrain,
    setCharging,
    simulateLow
  };

})();

window.BatterySimulator = BatterySimulator;
