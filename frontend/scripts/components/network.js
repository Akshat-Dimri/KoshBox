/**
 * KoshBox — Network Manager
 * Manages frontend network state machine.
 * Syncs with backend network simulator and updates all network UI.
 */

"use strict";

const NetworkManager = (() => {

  const state = window.SimulatorState;
  let _reconnectTimer = null;
  let _recoveryTimer  = null;

  // ── Init ──────────────────────────────────────────────────────────────────
  function init() {
    _syncNetworkUI(state.device.network);

    document.addEventListener("koshbox:state-changed", (e) => {
      if (e.detail.slice === "device" && e.detail.patch.network !== undefined) {
        _syncNetworkUI(e.detail.patch.network);
        DeviceController.updateNetworkLED();
      }
    });
  }

  // ── Connect ───────────────────────────────────────────────────────────────
  async function connect() {
    if (state.device.network === "connected") return;

    _transition("connecting");
    DevConsole.log("Connecting to network...", "info");

    try {
      await ApiClient.Device.networkConnect();
    } catch (_) {}

    // Simulate connect delay
    const delay = _randomBetween(2000, 4000);
    const failed = Math.random() < 0.10;

    setTimeout(async () => {
      if (failed) {
        _transition("disconnected");
        DevConsole.log("Network connection failed — retrying in 30s", "warn");
        _scheduleReconnect();
      } else {
        _transition("connected");
        await AudioEngine.announceSystem("network_connected");
        DevConsole.log("Network connected", "success");
      }
    }, delay);
  }

  // ── Disconnect ────────────────────────────────────────────────────────────
  async function disconnect() {
    _clearTimers();
    _transition("disconnected");
    try { await ApiClient.Device.networkDisconnect(); } catch (_) {}
  }

  // ── Simulate Failure ──────────────────────────────────────────────────────
  async function simulateFailure() {
    _clearTimers();
    _transition("disconnected");
    await AudioEngine.announceSystem("network_disconnected");
    DevConsole.log("Network failure", "error");
    try { await ApiClient.Device.networkFailure(); } catch (_) {}
    _scheduleReconnect();
  }

  // ── Simulate Weak Signal ──────────────────────────────────────────────────
  async function simulateWeak() {
    if (state.device.network !== "connected") return;
    _transition("weak");
    DevConsole.log("Weak network signal", "warn");
    try { await ApiClient.Device.networkWeak(); } catch (_) {}
    _scheduleWeakRecovery();
  }

  // ── State Transition ──────────────────────────────────────────────────────
  function _transition(status) {
    state.update("device", { network: status });
    _syncNetworkUI(status);
    DeviceController.updateNetworkLED();
    document.dispatchEvent(new CustomEvent("koshbox:network-change", {
      detail: { status }
    }));
  }

  // ── UI Sync ───────────────────────────────────────────────────────────────
  function _syncNetworkUI(status) {
    // Header dot
    const headerDot = document.getElementById("header-network-dot");
    if (headerDot) {
      headerDot.classList.toggle("active", status === "connected");
    }

    // Right panel network items
    const wifiDot   = document.getElementById("net-dot-wifi");
    const wifiLabel = document.getElementById("net-label-wifi");
    const sigDot    = document.getElementById("net-dot-4g");
    const sigLabel  = document.getElementById("net-label-signal");
    const chainDot  = document.getElementById("net-dot-chain");
    const chainLabel= document.getElementById("net-label-chain");

    const connected    = status === "connected";
    const weak         = status === "weak";
    const connecting   = status === "connecting" || status === "reconnecting";
    const disconnected = status === "disconnected";

    if (wifiDot) {
      wifiDot.className = "network-status-item__dot";
      if (connected)  wifiDot.classList.add("connected");
      else if (weak)  wifiDot.classList.add("weak");
      else            wifiDot.classList.add("disconnected");
    }
    if (wifiLabel) {
      wifiLabel.textContent = connected    ? "Wi-Fi: Connected"
        : weak               ? "Wi-Fi: Weak"
        : connecting         ? "Wi-Fi: Connecting..."
        : "Wi-Fi: Disconnected";
    }

    if (sigDot) {
      sigDot.className = "network-status-item__dot";
      sigDot.classList.add(connected ? "connected" : weak ? "weak" : "disconnected");
    }
    if (sigLabel) {
      sigLabel.textContent = connected ? "4G: Strong"
        : weak             ? "4G: Weak"
        : "Signal: None";
    }

    if (chainDot) {
      chainDot.className = "network-status-item__dot";
      chainDot.classList.add(connected ? "connected" : "disconnected");
    }
    if (chainLabel) {
      chainLabel.textContent = connected ? "Chain: Synced" : "Chain: Offline";
    }
  }

  // ── Reconnect Timer ───────────────────────────────────────────────────────
  function _scheduleReconnect() {
    _clearTimers();
    _reconnectTimer = setTimeout(() => {
      if (state.device.network === "disconnected" && state.device.power === "on") {
        _transition("reconnecting");
        setTimeout(() => connect(), 1000);
      }
    }, 30000);
  }

  function _scheduleWeakRecovery() {
    _recoveryTimer = setTimeout(() => {
      if (state.device.network !== "weak") return;
      const escalate = Math.random() < 0.20;
      if (escalate) {
        _transition("disconnected");
        DevConsole.log("Weak signal lost — reconnecting", "warn");
        _scheduleReconnect();
      } else {
        _transition("connected");
        DevConsole.log("Signal recovered", "success");
      }
    }, _randomBetween(10000, 30000));
  }

  function _clearTimers() {
    if (_reconnectTimer) { clearTimeout(_reconnectTimer); _reconnectTimer = null; }
    if (_recoveryTimer)  { clearTimeout(_recoveryTimer);  _recoveryTimer  = null; }
  }

  function _randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  // ── Public API ────────────────────────────────────────────────────────────
  return {
    init,
    connect,
    disconnect,
    simulateFailure,
    simulateWeak
  };

})();

window.NetworkManager = NetworkManager;
