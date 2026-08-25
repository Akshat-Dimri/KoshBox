/**
 * KoshBox — QR Module Component
 * Handles fixed and dynamic QR code generation, rotation timer,
 * canvas rendering, and mode switching.
 * Depends on: qrcode.js (CDN), state.js, api-client.js
 */

"use strict";

const QRModule = (() => {

  const state       = window.SimulatorState;
  let _qrInstance   = null;
  let _rotationTimer = null;
  let _countdownTimer = null;
  let _nextRotation  = null;

  // ── DOM refs ──────────────────────────────────────────────────────────────
  const els = () => ({
    canvas:        document.getElementById("qr-canvas"),
    wrapper:       document.getElementById("qr-canvas-wrapper"),
    refreshOverlay:document.getElementById("qr-refresh-overlay"),
    frameLabel:    document.getElementById("qr-frame-label"),
    modeBadge:     document.getElementById("qr-mode-badge"),
    modeLabel:     document.getElementById("qr-mode-label"),
    rotationTimer: document.getElementById("qr-rotation-timer"),
    countdown:     document.getElementById("qr-timer-countdown"),
    addressDisplay:document.getElementById("merchant-address-display"),
    networkDisplay:document.getElementById("merchant-network-display"),
    sectionTitle:  document.getElementById("qr-section-title"),
    modeToggle:    document.getElementById("toggle-qr-mode"),
    labelFixed:    document.getElementById("qr-mode-toggle-label-fixed"),
    labelDynamic:  document.getElementById("qr-mode-toggle-label-dynamic"),
    changeBtn:     document.getElementById("btn-qr-change")
  });

  // ── Init ──────────────────────────────────────────────────────────────────
  async function init() {
    await _loadMerchantInfo();
    _renderFixed();
    _wireModeControls();
    DevConsole.log("QR module initialized", "info");
  }

  // ── Sync the Fixed/Dynamic toggle, labels, and section title to state ─────
  function _syncModeUI(mode) {
    const e = els();
    if (e.sectionTitle) {
      e.sectionTitle.textContent = mode === "dynamic" ? "Dynamic Merchant QR" : "Fixed Merchant QR";
    }
    if (e.modeToggle) e.modeToggle.checked = mode === "dynamic";
    if (e.labelFixed)   e.labelFixed.classList.toggle("active", mode === "fixed");
    if (e.labelDynamic) e.labelDynamic.classList.toggle("active", mode === "dynamic");
  }

  // ── Wire mode toggle + Change QR button (called once, on init) ────────────
  function _wireModeControls() {
    const e = els();
    e.modeToggle?.addEventListener("change", (evt) => {
      if (evt.target.checked) {
        switchToDynamic();
      } else {
        switchToFixed();
      }
    });
    e.changeBtn?.addEventListener("click", () => refresh());
  }

  // ── Change QR (manual, on-demand) ─────────────────────────────────────────
  // Fixed mode: re-fetches/re-renders the merchant's QR (useful after the
  // merchant address changes on the backend, or just to force a redraw).
  // Dynamic mode: rotates immediately instead of waiting for the timer.
  async function refresh() {
    if (state.qr.mode === "dynamic") {
      _clearRotationTimer();
      await _renderDynamic();
      _startRotationTimer();
      UiUtils?.toast?.("QR changed", "info");
    } else {
      await _renderFixed();
      UiUtils?.toast?.("QR refreshed", "info");
    }
  }

  // ── Truncate address for display ────────────────────────────────────────
  function _truncate(addr) {
    if (!addr || addr.length <= 16) return addr;
    return `${addr.slice(0, 10)}...${addr.slice(-6)}`;
  }

  // ── Load merchant info from API ───────────────────────────────────────────
  async function _loadMerchantInfo() {
    try {
      const res = await ApiClient.Merchant.info();
      if (res.success && res.merchant) {
        state.update("qr", { merchantAddress: res.merchant.address });
        const e = els();
        if (e.addressDisplay) e.addressDisplay.textContent = _truncate(res.merchant.address);
        if (e.networkDisplay) e.networkDisplay.textContent =
          `${res.merchant.network} — ${Object.keys(res.merchant.balance || {})[0] || "KOSH"}`;
      }
    } catch (_) {
      // Use default address from state
      const e = els();
      if (e.addressDisplay) e.addressDisplay.textContent = _truncate(state.qr.merchantAddress);
    }
  }

  // ── Render Fixed QR ───────────────────────────────────────────────────────
  async function _renderFixed() {
    try {
      const res = await ApiClient.Merchant.fixedQR(state.qr.merchantAddress);
      const payload = res.success ? res.payload : _buildLocalFixedPayload();

      state.update("qr", { mode: "fixed", currentData: payload });
      _renderQR(payload);

      const e = els();
      if (e.frameLabel)  e.frameLabel.textContent  = "KOSHBOX_FIXED_QR";
      if (e.modeLabel)   e.modeLabel.textContent    = "Fixed";
      if (e.modeBadge) {
        e.modeBadge.classList.remove("qr-mode-badge--dynamic");
      }
      if (e.rotationTimer) e.rotationTimer.classList.add("hidden");
      _syncModeUI("fixed");

    } catch (err) {
      DevConsole.log(`QR render error: ${err.message}`, "error");
    }
  }

  // ── Render Dynamic QR ─────────────────────────────────────────────────────
  async function _renderDynamic() {
    _showRefreshOverlay(true);

    try {
      const res = await ApiClient.Merchant.dynamicQR(
        state.qr.merchantAddress,
        state.qr.rotationInterval
      );

      const payload   = res.success ? res.payload   : _buildLocalDynamicPayload();
      const sessionId = res.success ? res.sessionId : null;
      const expiresAt = res.success ? res.expiresAt : Date.now() + state.qr.rotationInterval;

      state.update("qr", {
        mode:          "dynamic",
        currentData:   payload,
        sessionId,
        sessionExpiry: expiresAt,
        lastRotated:   Date.now()
      });

      _renderQR(payload);

      const e = els();
      if (e.frameLabel) e.frameLabel.textContent = "KOSHBOX_DYNAMIC_QR";
      if (e.modeLabel)  e.modeLabel.textContent  = "Dynamic";
      if (e.modeBadge)  e.modeBadge.classList.add("qr-mode-badge--dynamic");
      if (e.rotationTimer) e.rotationTimer.classList.remove("hidden");
      _syncModeUI("dynamic");

      _startCountdown(expiresAt);

      document.dispatchEvent(new CustomEvent("koshbox:qr-rotated", {
        detail: { data: payload, sessionId }
      }));

      DevConsole.log("Dynamic QR rotated", "info");

    } catch (err) {
      DevConsole.log(`Dynamic QR error: ${err.message}`, "error");
    } finally {
      _showRefreshOverlay(false);
    }
  }

  // ── Core QR Renderer ──────────────────────────────────────────────────────
  function _renderQR(data) {
    const e = els();
    if (!e.canvas) return;

    // Clear previous
    e.canvas.innerHTML = "";
    _qrInstance = null;

    if (!window.QRCode) {
      // Fallback: show text if qrcode.js not loaded
      e.canvas.innerHTML = `<div style="padding:8px;font-size:9px;word-break:break-all;color:#333;max-width:160px;">${data}</div>`;
      return;
    }

    try {
      _qrInstance = new QRCode(e.canvas, {
        text:          data,
        width:         160,
        height:        160,
        colorDark:     "#000000",
        colorLight:    "#ffffff",
        correctLevel:  QRCode.CorrectLevel.M
      });
    } catch (err) {
      DevConsole.log(`QRCode render error: ${err.message}`, "error");
    }
  }

  // ── Placeholder QR (device off) ───────────────────────────────────────────
  function showPlaceholder() {
    const e = els();
    if (!e.canvas) return;
    e.canvas.innerHTML = `
      <div class="qr-placeholder">
        <span class="qr-placeholder__text">Device Off</span>
      </div>
    `;
    _qrInstance = null;
  }

  // ── Regenerate (called on power on) ──────────────────────────────────────
  async function regenerate() {
    if (state.qr.mode === "dynamic") {
      await _renderDynamic();
      _startRotationTimer();
    } else {
      await _renderFixed();
    }
  }

  // ── Switch Mode ──────────────────────────────────────────────────────────
  async function switchToFixed() {
    _clearRotationTimer();
    await _renderFixed();
    DevConsole.log("QR mode: Fixed", "info");
  }

  async function switchToDynamic() {
    await _renderDynamic();
    _startRotationTimer();
    DevConsole.log(`QR mode: Dynamic (${_formatInterval(state.qr.rotationInterval)})`, "info");
  }

  // ── Set Rotation Interval ─────────────────────────────────────────────────
  async function setRotationInterval(intervalMs) {
    state.update("qr", { rotationInterval: intervalMs });
    if (state.qr.mode === "dynamic") {
      _clearRotationTimer();
      await _renderDynamic();
      _startRotationTimer();
    }
    DevConsole.log(`QR rotation interval: ${_formatInterval(intervalMs)}`, "info");
  }

  // ── Rotation Timer ────────────────────────────────────────────────────────
  function _startRotationTimer() {
    _clearRotationTimer();
    _rotationTimer = setTimeout(async () => {
      if (state.device.power === "on" && state.qr.mode === "dynamic") {
        await _renderDynamic();
        _startRotationTimer();
      }
    }, state.qr.rotationInterval);
  }

  function _clearRotationTimer() {
    if (_rotationTimer) { clearTimeout(_rotationTimer);  _rotationTimer  = null; }
    if (_countdownTimer){ clearInterval(_countdownTimer); _countdownTimer = null; }
  }

  // ── Countdown Display ─────────────────────────────────────────────────────
  function _startCountdown(expiresAt) {
    if (_countdownTimer) clearInterval(_countdownTimer);

    _countdownTimer = setInterval(() => {
      const e = els();
      if (!e.countdown) return;

      const remaining = Math.max(0, expiresAt - Date.now());
      if (remaining === 0) {
        e.countdown.textContent = "Rotating...";
        clearInterval(_countdownTimer);
        return;
      }

      const mins = Math.floor(remaining / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);
      e.countdown.textContent = `${String(mins).padStart(2,"0")}:${String(secs).padStart(2,"0")}`;
    }, 1000);
  }

  // ── Refresh Overlay ───────────────────────────────────────────────────────
  function _showRefreshOverlay(show) {
    const e = els();
    if (e.refreshOverlay) {
      e.refreshOverlay.classList.toggle("active", show);
    }
  }

  // ── Local Payload Builders (offline fallback) ─────────────────────────────
  function _buildLocalFixedPayload() {
    const addr = state.qr.merchantAddress;
    return `${location.origin}/pages/payment.html?to=${addr}&network=kosh-testnet-1&type=fixed`;
  }

  function _buildLocalDynamicPayload() {
    const addr    = state.qr.merchantAddress;
    const session = Math.random().toString(16).substring(2, 18);
    const expires = Date.now() + state.qr.rotationInterval + 300000;
    return `${location.origin}/pages/payment.html?to=${addr}&session=${session}&expires=${expires}&type=dynamic`;
  }

  // ── Format Interval ───────────────────────────────────────────────────────
  function _formatInterval(ms) {
    if (ms < 3600000) return `${ms / 60000} minutes`;
    return `${ms / 3600000} hour${ms / 3600000 !== 1 ? "s" : ""}`;
  }

  // ── Public API ────────────────────────────────────────────────────────────
  return {
    init,
    regenerate,
    showPlaceholder,
    switchToFixed,
    switchToDynamic,
    setRotationInterval,
    refresh
  };

})();

window.QRModule = QRModule;
