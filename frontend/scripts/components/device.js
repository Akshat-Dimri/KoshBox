/**
 * KoshBox — Device Controller
 * Implements the device finite state machine.
 * Controls power lifecycle, LED indicators, screen content,
 * and all device body interactions (click, double-click, long press).
 */

"use strict";

const DeviceController = (() => {

  const state = window.SimulatorState;
  let _uptimeInterval  = null;
  let _longPressTimer  = null;
  let _longPressActive = false;
  let _lastClickTime   = 0;
  const DOUBLE_CLICK_THRESHOLD = 300;   // ms
  const LONG_PRESS_THRESHOLD   = 700;   // ms

  // ── DOM refs ──────────────────────────────────────────────────────────────
  const el = (id) => document.getElementById(id);

  // ── Init ──────────────────────────────────────────────────────────────────
  function init() {
    _updateAllIndicators();
    _syncControlsToState();
    DevConsole.log("Device controller ready", "info");
  }

  // ── Power On ──────────────────────────────────────────────────────────────
  async function powerOn() {
    if (state.device.power === "on" || state.device.power === "booting") return;

    DevConsole.log("Booting device...", "info");
    state.update("device", { power: "booting" });
    _updateAllIndicators();

    // Boot sequence animation
    await _runBootSequence();

    // Connect network
    state.update("device", { power: "on" });
    state.update("device", { bootCount: state.device.bootCount + 1 });
    _updateAllIndicators();

    // Start uptime counter
    _startUptimeCounter();

    // Init QR
    await QRModule.regenerate();

    // Connect network
    NetworkManager.connect();

    // Start battery drain
    BatterySimulator.startDrain();

    // Announce power on
    await AudioEngine.announceSystem("power_on");

    document.dispatchEvent(new CustomEvent("koshbox:power-on"));
    DevConsole.log("Device online", "success");

    _setScreenContent("KOSHBOX", "IDLE / READY");
  }

  // ── Power Off ─────────────────────────────────────────────────────────────
  async function powerOff() {
    if (state.device.power === "off" || state.device.power === "shutdown") return;

    DevConsole.log("Shutting down device...", "warn");
    state.update("device", { power: "shutdown" });
    _updateAllIndicators();

    await AudioEngine.announceSystem("power_off");

    // Shutdown animation
    await _runShutdownSequence();

    state.update("device", { power: "off", uptime: 0 });
    _stopUptimeCounter();
    BatterySimulator.stopDrain();
    NetworkManager.disconnect();
    QRModule.showPlaceholder();

    _updateAllIndicators();
    _clearScreen();

    document.dispatchEvent(new CustomEvent("koshbox:power-off"));
    DevConsole.log("Device powered off", "info");
  }

  // ── Sleep ─────────────────────────────────────────────────────────────────
  async function sleep() {
    if (state.device.power !== "on") return;
    state.update("device", { power: "sleep" });
    _updateAllIndicators();
    _setScreenContent("", "— SLEEP —");
    DevConsole.log("Device sleeping", "info");
    document.dispatchEvent(new CustomEvent("koshbox:sleep"));
  }

  // ── Wake ──────────────────────────────────────────────────────────────────
  async function wake() {
    if (state.device.power !== "sleep") return;
    state.update("device", { power: "on" });
    _updateAllIndicators();
    _setScreenContent("KOSHBOX", "IDLE / READY");
    DevConsole.log("Device woke from sleep", "info");
    document.dispatchEvent(new CustomEvent("koshbox:wake"));
  }

  // ── Reset ─────────────────────────────────────────────────────────────────
  async function reset() {
    DevConsole.log("Resetting device...", "warn");
    await powerOff();
    await ApiClient.Device.reset();
    state.update("device", {
      volume:          70,
      muted:           false,
      language:        "en",
      totalPayments:   0,
      totalVolume:     "0.00"
    });
    _syncControlsToState();
    DevConsole.log("Device reset to defaults", "success");
  }

  // ── Volume ────────────────────────────────────────────────────────────────
  function setVolume(level) {
    const clamped = Math.max(0, Math.min(100, level));
    state.update("device", { volume: clamped });
    AudioEngine.setVolume(clamped);
    _updateVolumeIndicator();
    DevConsole.log(`Volume: ${clamped}%`, "info");
  }

  function setMute(muted) {
    state.update("device", { muted });
    AudioEngine.setMute(muted);
    _updateVolumeIndicator();
    DevConsole.log(muted ? "Muted" : "Unmuted", "info");
  }

  // ── Language ──────────────────────────────────────────────────────────────
  function setLanguage(lang) {
    state.update("device", { language: lang });
    AudioEngine.setLanguage(lang);
    const langEl = el("led-lang-label");
    if (langEl) langEl.textContent = lang.toUpperCase();
    const en = el("lang-label-en");
    const hi = el("lang-label-hi");
    if (en) en.classList.toggle("active", lang === "en");
    if (hi) hi.classList.toggle("active", lang === "hi");
    DevConsole.log(`Language: ${lang === "en" ? "English" : "Hindi"}`, "info");
  }

  // ── Payment Flash ─────────────────────────────────────────────────────────
  function flashPayment(tx) {
    if (state.device.power !== "on") return;

    // Flash payment LED
    const ledPayment = el("led-payment");
    if (ledPayment) {
      ledPayment.classList.remove("active", "flash");
      void ledPayment.offsetWidth; // reflow
      ledPayment.classList.add("flash");
      setTimeout(() => {
        ledPayment.classList.remove("flash");
        ledPayment.classList.add("active");
        setTimeout(() => ledPayment.classList.remove("active"), 3000);
      }, 1800);
    }

    // Show payment on screen
    const flashEl  = el("payment-flash");
    const amountEl = el("payment-flash-amount");
    const labelEl  = el("payment-flash-label");
    const videoEl  = el("payment-flash-video");
    const gifEl    = el("payment-flash-gif");
    const tickEl   = el("payment-tick");

    if (flashEl && amountEl) {
      amountEl.textContent = `${tx.coin} ${tx.amount}`;
      if (labelEl) labelEl.textContent = tx.senderName
        ? `RECEIVED FROM ${tx.senderName.toUpperCase()}`
        : "PAYMENT RECEIVED";

      flashEl.classList.remove("visible", "has-media");
      videoEl?.classList.remove("active");
      gifEl?.classList.remove("active");
      if (tickEl) tickEl.style.display = "";
      void flashEl.offsetWidth; // reflow — restarts the tick draw animation

      // Prefer the provided video; fall back to gif; fall back to the
      // built-in tick checkmark if neither animation file is present.
      let displayMs = 4000;
      if (videoEl && videoEl.readyState >= 2 && !videoEl.error) {
        videoEl.currentTime = 0;
        videoEl.classList.add("active");
        flashEl.classList.add("has-media");
        if (tickEl) tickEl.style.display = "none";
        videoEl.play().catch(() => {});
        if (isFinite(videoEl.duration) && videoEl.duration > 0) {
          displayMs = Math.max(1500, videoEl.duration * 1000 + 300);
        }
      } else if (gifEl && gifEl.complete && gifEl.naturalWidth > 0) {
        gifEl.src = `${gifEl.src.split("?")[0]}?t=${Date.now()}`; // restart the gif loop
        gifEl.classList.add("active");
        flashEl.classList.add("has-media");
        if (tickEl) tickEl.style.display = "none";
      }

      flashEl.classList.add("visible");
      setTimeout(() => flashEl.classList.remove("visible"), displayMs);
    }

    // Update payment label
    const payLabel = el("led-payment-label");
    if (payLabel) {
      payLabel.textContent = `+${tx.amount}`;
      setTimeout(() => { payLabel.textContent = "—"; }, 4000);
    }

    // Device body active state
    const body = el("device-body");
    if (body) {
      body.style.boxShadow = "0 0 30px rgba(34,197,94,0.15), 0 8px 40px rgba(0,0,0,0.7)";
      setTimeout(() => { body.style.boxShadow = ""; }, 3000);
    }
  }

  // ── Boot Sequence Animation ───────────────────────────────────────────────
  async function _runBootSequence() {
    const bootSeq = el("boot-sequence");
    const bootBar = el("boot-bar");
    const bootTxt = el("boot-text");
    const content = el("screen-content");

    if (content) content.style.opacity = "0";
    if (bootSeq) bootSeq.classList.add("active");

    const steps = [
      { text: "Initializing hardware...",   pct: 20,  delay: 400 },
      { text: "Loading firmware v1.0.0...", pct: 45,  delay: 400 },
      { text: "Connecting network...",      pct: 65,  delay: 350 },
      { text: "Starting blockchain...",     pct: 80,  delay: 350 },
      { text: "Loading QR module...",       pct: 95,  delay: 300 },
      { text: "Ready",                      pct: 100, delay: 300 }
    ];

    for (const step of steps) {
      if (bootTxt) bootTxt.textContent = step.text;
      if (bootBar) bootBar.style.width = step.pct + "%";
      await _delay(step.delay);
    }

    await _delay(300);
    if (bootSeq) bootSeq.classList.remove("active");
    if (content) content.style.opacity = "1";

    // Reset bar for next boot
    setTimeout(() => { if (bootBar) bootBar.style.width = "0%"; }, 500);
  }

  // ── Shutdown Sequence Animation ───────────────────────────────────────────
  async function _runShutdownSequence() {
    const screen = el("device-screen");
    if (screen) {
      screen.style.transition = "opacity 0.8s ease";
      screen.style.opacity    = "0.3";
    }
    await _delay(800);
    if (screen) {
      screen.style.opacity = "0";
    }
    await _delay(700);
    if (screen) {
      screen.style.transition = "";
      screen.style.opacity    = "";
    }
  }

  // ── Screen Content ────────────────────────────────────────────────────────
  function _setScreenContent(brand, hint, status = "") {
    const brandEl  = el("screen-brand");
    const hintEl   = el("screen-hint");
    const statusEl = el("screen-status");
    if (brandEl)  brandEl.textContent  = brand;
    if (hintEl)   hintEl.textContent   = hint;
    if (statusEl) statusEl.textContent = status;
  }

  function _clearScreen() {
    _setScreenContent("", "", "");
  }

  // ── LED Indicator Updates ─────────────────────────────────────────────────
  function _updateAllIndicators() {
    _updatePowerLED();
    _updateBatteryLED();
    _updateNetworkLED();
    _updateVolumeIndicator();
    _updateDeviceBodyClass();
  }

  function _updatePowerLED() {
    const led   = el("led-power");
    const label = el("led-power-label");
    if (!led) return;

    led.className = "status-indicator__led";
    const power = state.device.power;

    const map = {
      on:       { cls: "on",    text: "ON"      },
      booting:  { cls: "sleep", text: "BOOTING" },
      sleep:    { cls: "sleep", text: "SLEEP"   },
      shutdown: { cls: "",      text: "OFF"     },
      off:      { cls: "",      text: "OFF"     }
    };

    const cfg = map[power] || map.off;
    if (cfg.cls) led.classList.add(cfg.cls);
    if (label)   label.textContent = cfg.text;

    const toggle = el("toggle-power");
    if (toggle) toggle.checked = power === "on" || power === "sleep" || power === "booting";

    const switchLabel = el("power-switch-label");
    const labelMap = {
      on: "Powered On", booting: "Booting...", sleep: "Sleeping",
      shutdown: "Shutting Down", off: "Powered Off"
    };
    if (switchLabel) switchLabel.textContent = labelMap[power] || "Powered Off";
  }

  function _updateBatteryLED() {
    const led   = el("led-battery");
    const label = el("led-battery-label");
    if (!led) return;

    led.className = "status-indicator__led";
    const bat = state.device.battery;

    if (state.device.power === "off") {
      if (label) label.textContent = `${Math.round(bat)}%`;
      return;
    }

    if (bat <= 5) {
      led.classList.add("critical");
    } else if (bat <= 20) {
      led.classList.add("low");
    } else {
      led.classList.add("normal");
    }

    if (label) label.textContent = `${Math.round(bat)}%`;

    const phoneBat  = el("phone-status-battery");
    const phoneFill = el("phone-battery-fill");
    if (phoneBat)  phoneBat.textContent = `${Math.round(bat)}%`;
    if (phoneFill) phoneFill.setAttribute("width", (Math.max(0, Math.min(100, bat)) / 100 * 15).toFixed(1));
  }

  function _updateNetworkLED() {
    const led   = el("led-network");
    const label = el("led-network-label");
    if (!led) return;

    led.className = "status-indicator__led";
    const net = state.device.network;

    const map = {
      connected:    { cls: "connected",    text: "Connected"    },
      weak:         { cls: "weak",         text: "Weak Signal"  },
      connecting:   { cls: "connecting",   text: "Connecting"   },
      reconnecting: { cls: "reconnecting", text: "Reconnecting" },
      disconnected: { cls: "",             text: "Offline"      }
    };

    const cfg = map[net] || map.disconnected;
    if (cfg.cls) led.classList.add(cfg.cls);
    if (label)   label.textContent = cfg.text;

    const phoneNet = el("phone-status-network");
    if (phoneNet) phoneNet.textContent = cfg.text;
  }

  function _updateVolumeIndicator() {
    const label = el("led-volume-label");
    if (label) {
      label.textContent = state.device.muted ? "MUTE" : `${state.device.volume}%`;
    }
    const phoneVol = el("phone-status-volume");
    if (phoneVol) {
      phoneVol.textContent = state.device.muted ? "MUTE" : `${state.device.volume}%`;
    }
  }

  function _updateDeviceBodyClass() {
    const body = el("device-body");
    if (!body) return;
    body.classList.toggle("powered-off", state.device.power === "off");
  }

  // ── Uptime Counter ────────────────────────────────────────────────────────
  function _startUptimeCounter() {
    _stopUptimeCounter();
    _uptimeInterval = setInterval(() => {
      state.update("device", { uptime: state.device.uptime + 1 });
    }, 1000);
  }

  function _stopUptimeCounter() {
    if (_uptimeInterval) {
      clearInterval(_uptimeInterval);
      _uptimeInterval = null;
    }
  }

  // ── Device Body Interactions ──────────────────────────────────────────────
  function bindInteractions() {
    const body    = el("device-body");
    const tooltip = el("device-tooltip");
    if (!body) return;

    // Show tooltip on hover
    body.addEventListener("mouseenter", () => {
      if (tooltip) tooltip.classList.add("visible");
    });
    body.addEventListener("mouseleave", () => {
      if (tooltip) tooltip.classList.remove("visible");
      _longPressActive = false;
      if (_longPressTimer) clearTimeout(_longPressTimer);
    });

    // Mouse down — start long press timer
    body.addEventListener("mousedown", () => {
      _longPressActive = false;
      _longPressTimer = setTimeout(() => {
        _longPressActive = true;
        _onLongPress();
      }, LONG_PRESS_THRESHOLD);
    });

    // Mouse up — determine single vs double click
    body.addEventListener("mouseup", () => {
      if (_longPressTimer) clearTimeout(_longPressTimer);
      if (_longPressActive) return; // already handled

      const now  = Date.now();
      const diff = now - _lastClickTime;

      if (diff < DOUBLE_CLICK_THRESHOLD && _lastClickTime > 0) {
        _lastClickTime = 0;
        _onDoubleClick();
      } else {
        _lastClickTime = now;
        setTimeout(() => {
          if (_lastClickTime === now) {
            _onSingleClick();
            _lastClickTime = 0;
          }
        }, DOUBLE_CLICK_THRESHOLD);
      }
    });

    // Touch support
    body.addEventListener("touchstart", (e) => {
      e.preventDefault();
      _longPressTimer = setTimeout(() => {
        _longPressActive = true;
        _onLongPress();
      }, LONG_PRESS_THRESHOLD);
    }, { passive: false });

    body.addEventListener("touchend", () => {
      if (_longPressTimer) clearTimeout(_longPressTimer);
      if (!_longPressActive) _onSingleClick();
      _longPressActive = false;
    });
  }

  function _onSingleClick() {
    // Open device info modal
    _updateDeviceInfoModal();
    window.KoshBox.openModal("modal-device-info");
  }

  function _onDoubleClick() {
    // Open hardware exploded view
    ExplodedView.open();
    window.KoshBox.openModal("modal-exploded");
  }

  function _onLongPress() {
    // Open advanced diagnostics
    _updateDiagnosticsModal();
    window.KoshBox.openModal("modal-diagnostics");
  }

  // ── Modal Data Updates ────────────────────────────────────────────────────
  function _updateDeviceInfoModal() {
    const uptimeSec = state.device.uptime;
    const uptimeStr = _formatUptime(uptimeSec);

    const setEl = (id, val) => {
      const e = document.getElementById(id);
      if (e) e.textContent = val;
    };

    setEl("info-modal-power",   state.device.power.toUpperCase());
    setEl("info-modal-battery", `${Math.round(state.device.battery)}%${state.device.batteryCharging ? " (charging)" : ""}`);
    setEl("info-modal-uptime",  state.device.power === "on" ? uptimeStr : "—");
    setEl("info-modal-address", state.qr.merchantAddress);
  }

  function _updateDiagnosticsModal() {
    const setEl = (id, val) => {
      const e = document.getElementById(id);
      if (e) e.textContent = val;
    };

    setEl("diag-battery",       `${Math.round(state.device.battery)}%`);
    setEl("diag-battery-state", state.device.batteryCharging ? "Charging" : "Discharging");
    setEl("diag-network",       state.device.network.charAt(0).toUpperCase() + state.device.network.slice(1));
    setEl("diag-block",         state.blockchain.latestBlock);
    setEl("diag-pending",       state.blockchain.pendingCount);
    setEl("diag-uptime",        _formatUptime(state.device.uptime));
    setEl("diag-payments",      state.device.totalPayments);
    setEl("diag-volume",        `Vol: ${state.device.totalVolume} KOSH`);
  }

  // ── Sync Controls to State ────────────────────────────────────────────────
  function _syncControlsToState() {
    const powerToggle = document.getElementById("toggle-power");
    if (powerToggle) powerToggle.checked = state.device.power === "on" || state.device.power === "sleep";

    const langToggle = document.getElementById("toggle-language");
    if (langToggle) langToggle.checked = state.device.language === "hi";
    _updateLangLabels();

    const muteBtn = document.getElementById("btn-mute");
    if (muteBtn) muteBtn.textContent = state.device.muted ? "Unmute" : "Mute";

    const volSlider = document.getElementById("volume-slider");
    if (volSlider) volSlider.value = state.device.volume;
    const volLabel = document.getElementById("volume-value-label");
    if (volLabel) volLabel.textContent = `${state.device.volume}%`;
  }

  function _updateLangLabels() {
    const en = document.getElementById("lang-label-en");
    const hi = document.getElementById("lang-label-hi");
    if (en) en.classList.toggle("active", state.device.language === "en");
    if (hi) hi.classList.toggle("active", state.device.language === "hi");
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function _formatUptime(seconds) {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds/60)}m ${seconds%60}s`;
    return `${Math.floor(seconds/3600)}h ${Math.floor((seconds%3600)/60)}m`;
  }

  function _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ── Public API ────────────────────────────────────────────────────────────
  return {
    init,
    powerOn,
    powerOff,
    sleep,
    wake,
    reset,
    setVolume,
    setMute,
    setLanguage,
    flashPayment,
    bindInteractions,
    updateNetworkLED:  _updateNetworkLED,
    updateBatteryLED:  _updateBatteryLED,
    updateAllIndicators: _updateAllIndicators
  };

})();

window.DeviceController = DeviceController;
