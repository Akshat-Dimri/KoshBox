/**
 * KoshBox — Main Application Entry Point
 * Bootstrap sequence, global event wiring, modal system, clock, header.
 * All component instances are initialized here after DOM ready.
 */

"use strict";

document.addEventListener("DOMContentLoaded", async () => {

  const state = window.SimulatorState;

  // ── Clock ──────────────────────────────────────────────────────────────────
  function updateClock() {
    const el = document.getElementById("header-clock");
    if (el) el.textContent = new Date().toLocaleTimeString("en-GB");
  }
  updateClock();
  setInterval(updateClock, 1000);

  // ── Modal System ───────────────────────────────────────────────────────────
  function openModal(id) {
    const overlay = document.getElementById(id);
    if (!overlay) return;
    overlay.classList.add("active");
    state.update("ui", { activeModal: id });
  }

  function closeModal(id) {
    const overlay = document.getElementById(id);
    if (!overlay) return;
    overlay.classList.remove("active");
    state.update("ui", { activeModal: null });
  }

  // Close buttons (data-close attribute)
  document.querySelectorAll("[data-close]").forEach(btn => {
    btn.addEventListener("click", () => closeModal(btn.dataset.close));
  });

  // Close on overlay click
  document.querySelectorAll(".modal-overlay").forEach(overlay => {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeModal(overlay.id);
    });
  });

  // Close on Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && state.ui.activeModal) {
      closeModal(state.ui.activeModal);
    }
  });

  window.KoshBox = { openModal, closeModal };

  // ── Header Network Dot ─────────────────────────────────────────────────────
  function updateHeaderNetwork(status) {
    const dot = document.getElementById("header-network-dot");
    if (!dot) return;
    dot.classList.toggle("active", status === "connected" || status === "synced");
  }

  // ── API Connectivity ───────────────────────────────────────────────────────
  await ApiClient.checkConnectivity();
  DevConsole.log(
    ApiClient.isOnline()
      ? "Backend connected — Kosh Testnet online"
      : "Backend offline — running in mock mode",
    ApiClient.isOnline() ? "success" : "warn"
  );

  // ── Initialize Components ──────────────────────────────────────────────────
  BatterySimulator.init();
  NetworkManager.init();
  QRModule.init();
  AudioEngine.init();
  ExplodedView.init();
  DemoSequencer.init();
  DeviceController.init();
  TransactionController.init();

  // ── Right Panel Wiring ─────────────────────────────────────────────────────

  // (Power on/off and volume controls are now wired further below via the
  // power toggle switch and volume slider — see toggle-power / volume-slider)

  // Power toggle switch
  document.getElementById("toggle-power")?.addEventListener("change", (e) => {
    if (e.target.checked) {
      DeviceController.powerOn();
    } else {
      DeviceController.powerOff();
    }
  });

  // Volume slider + step buttons
  const volSlider = document.getElementById("volume-slider");
  function _applyVolume(vol) {
    const clamped = Math.max(0, Math.min(100, vol));
    DeviceController.setVolume(clamped);
    if (volSlider) volSlider.value = clamped;
    const label = document.getElementById("volume-value-label");
    if (label) label.textContent = `${clamped}%`;
  }
  volSlider?.addEventListener("input", (e) => _applyVolume(parseInt(e.target.value)));
  document.getElementById("btn-vol-up")?.addEventListener("click", () => {
    _applyVolume(state.device.volume + 10);
  });
  document.getElementById("btn-vol-down")?.addEventListener("click", () => {
    _applyVolume(state.device.volume - 10);
  });

  // Mute button (not a toggle — explicit Mute/Unmute action)
  document.getElementById("btn-mute")?.addEventListener("click", (e) => {
    const willMute = !state.device.muted;
    DeviceController.setMute(willMute);
    e.target.textContent = willMute ? "Unmute" : "Mute";
  });

  // Language big toggle
  document.getElementById("toggle-language")?.addEventListener("change", (e) => {
    DeviceController.setLanguage(e.target.checked ? "hi" : "en");
  });

  // QR rotation interval — dropdown + confirm/reset
  const rotationSelect = document.getElementById("rotation-interval-select");
  let _rotationOriginalValue = rotationSelect?.value;

  document.getElementById("btn-qr-confirm")?.addEventListener("click", () => {
    if (!rotationSelect) return;
    const interval = parseInt(rotationSelect.value);
    QRModule.setRotationInterval(interval);
    _rotationOriginalValue = rotationSelect.value;
    const label = rotationSelect.options[rotationSelect.selectedIndex].text;
    UiUtils.toast(`QR rotation set to every ${label}`, "info");
  });

  document.getElementById("btn-qr-reset")?.addEventListener("click", () => {
    if (!rotationSelect) return;
    rotationSelect.value = _rotationOriginalValue;
    UiUtils.toast("QR rotation setting reset", "warn");
  });

  // Merchant address — click to copy
  document.getElementById("merchant-address-badge")?.addEventListener("click", () => {
    const full = state.qr.merchantAddress || "";
    navigator.clipboard?.writeText(full).then(() => {
      UiUtils.toast("Address copied to clipboard", "info");
    }).catch(() => {
      UiUtils.toast("Could not copy address", "error");
    });
  });

  // Charging toggle
  document.getElementById("toggle-charging")?.addEventListener("change", (e) => {
    BatterySimulator.setCharging(e.target.checked);
  });

  // Inject transaction
  document.getElementById("btn-inject-tx")?.addEventListener("click", async () => {
    if (state.device.power !== "on") {
      DevConsole.log("Device must be powered on to inject transactions", "warn");
      return;
    }
    await TransactionController.injectTest();
  });

  // Demo mode toggle
  document.getElementById("toggle-demo")?.addEventListener("change", (e) => {
    if (e.target.checked) {
      DemoSequencer.start();
    } else {
      DemoSequencer.stop();
    }
  });

  // Transaction history
  document.getElementById("btn-tx-history")?.addEventListener("click", () => {
    TransactionController.openHistoryModal();
    openModal("modal-tx-history");
  });

  // Open firmware editor
  document.getElementById("btn-open-firmware")?.addEventListener("click", () => {
    window.open("pages/firmware.html", "_blank");
  });

  // Reset device
  document.getElementById("btn-reset-device")?.addEventListener("click", async () => {
    DeviceController.reset();
  });

  // Simulate network failure
  document.getElementById("btn-sim-network-fail")?.addEventListener("click", async () => {
    NetworkManager.simulateFailure();
    DevConsole.log("Network failure simulated", "warn");
  });

  // Simulate low battery
  document.getElementById("btn-sim-low-battery")?.addEventListener("click", async () => {
    BatterySimulator.simulateLow();
    DevConsole.log("Low battery simulated", "warn");
  });

  // Custom device screen background image
  const bgInput     = document.getElementById("bg-upload-input");
  const bgBtnUpload  = document.getElementById("btn-bg-upload");
  const bgBtnReset   = document.getElementById("btn-bg-reset");
  const deviceScreen = document.getElementById("device-screen");

  bgBtnUpload?.addEventListener("click", () => bgInput?.click());

  bgInput?.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      UiUtils.toast("Please choose an image file", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      deviceScreen.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.35),rgba(0,0,0,0.35)), url(${ev.target.result})`;
      bgBtnReset.style.display = "inline-flex";
      UiUtils.toast("Background image applied", "info");
    };
    reader.readAsDataURL(file);
  });

  bgBtnReset?.addEventListener("click", () => {
    deviceScreen.style.backgroundImage = "";
    bgBtnReset.style.display = "none";
    UiUtils.toast("Background reset", "warn");
  });

  // Device body interactions
  DeviceController.bindInteractions();

  // ── Dockable Windows (snapped in place; click "Float" to undock) ───────
  UiUtils.makeDockable(document.getElementById("window-utilities"),  { title: "System Utilities" });
  UiUtils.makeDockable(document.getElementById("window-diagnostics"), { title: "Diagnostics & Simulations" });
  UiUtils.makeDockable(document.getElementById("window-console"),    { title: "Developer Console" });

  // ── Global Event Listeners ─────────────────────────────────────────────────

  document.addEventListener("koshbox:state-changed", (e) => {
    const { slice, patch } = e.detail;

    if (slice === "device") {
      updateHeaderNetwork(patch.network || state.device.network);
      updateDeviceInfoStrip();
    }
    if (slice === "blockchain") {
      updateHeaderNetwork(patch.status);
      document.getElementById("info-block-height").textContent =
        state.blockchain.latestBlock || "—";
    }
  });

  document.addEventListener("koshbox:transaction-confirmed", (e) => {
    updateRecentPayments();
  });

  document.addEventListener("koshbox:transaction-updated", () => {
    updateRecentPayments();
  });

  // ── UI Updaters ────────────────────────────────────────────────────────────

  function updateDeviceInfoStrip() {
    const uptimeSec = state.device.uptime;
    const uptimeStr = uptimeSec < 60
      ? `${uptimeSec}s`
      : uptimeSec < 3600
        ? `${Math.floor(uptimeSec / 60)}m ${uptimeSec % 60}s`
        : `${Math.floor(uptimeSec / 3600)}h ${Math.floor((uptimeSec % 3600) / 60)}m`;

    const uptimeEl = document.getElementById("info-uptime");
    if (uptimeEl) uptimeEl.textContent = state.device.power === "on" ? uptimeStr : "—";

    const paymentsEl = document.getElementById("info-total-payments");
    if (paymentsEl) paymentsEl.textContent = state.device.totalPayments;
  }

  function updateRecentPayments() {
    const tbody = document.getElementById("recent-payments-body");
    if (!tbody) return;

    const recent = state.getRecentConfirmed(6);

    if (recent.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" class="payments-empty">No payments yet</td></tr>';
      return;
    }

    tbody.innerHTML = recent.map(tx => {
      const statusClass = tx.status === "confirmed" || tx.status === "finalized"
        ? "status-confirmed"
        : tx.status === "pending" ? "status-pending" : "status-failed";
      const nameShort = (tx.senderName || "—").substring(0, 8);
      const statusShort = tx.status === "finalized" ? "Confirmed" :
        tx.status.charAt(0).toUpperCase() + tx.status.slice(1);

      return `
        <tr>
          <td class="payments-table__name">${nameShort}</td>
          <td class="payments-table__status ${statusClass}">${statusShort}</td>
          <td class="payments-table__amount">${tx.coin} ${tx.amount}</td>
        </tr>
      `;
    }).join("");
  }

  // ── Blockchain Polling ─────────────────────────────────────────────────────
  async function pollBlockchain() {
    try {
      const res = await ApiClient.Blockchain.status();
      if (res.success) {
        state.update("blockchain", {
          status: "synced",
          latestBlock: res.chain.latestBlock,
          pendingCount: res.chain.pendingTransactions
        });
      }
    } catch (_) {
      state.update("blockchain", { status: "offline" });
    }
  }

  // Start blockchain polling every 5 seconds
  pollBlockchain();
  setInterval(pollBlockchain, 5000);

  DevConsole.log("Simulator initialized — device ready", "info");
});

// ── Developer Console Helper ──────────────────────────────────────────────────
const DevConsole = {
  log(message, level = "info") {
    const container = document.getElementById("dev-console");
    if (!container) return;

    const time = new Date().toLocaleTimeString("en-GB");
    const line = document.createElement("div");
    line.className = "dev-console__line";
    line.innerHTML = `
      <span class="dev-console__time">${time}</span>
      <span class="dev-console__msg ${level}">${message}</span>
    `;
    container.appendChild(line);
    container.scrollTop = container.scrollHeight;

    // Keep only last 50 lines
    while (container.children.length > 50) {
      container.removeChild(container.firstChild);
    }
  }
};

window.DevConsole = DevConsole;
