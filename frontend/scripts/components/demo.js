/**
 * KoshBox — Demo Sequencer
 * Automated showcase mode. Drives the complete payment lifecycle
 * using the same public APIs as real user interactions.
 */

"use strict";

const DemoSequencer = (() => {

  const state = window.SimulatorState;
  let _active  = false;
  let _timers  = [];
  let _stepIndex = -1;

  // ── Demo Script ───────────────────────────────────────────────────────────
  const STEPS = [
    { id: 0, delay: 0,     label: "Power on device",    action: _stepPowerOn       },
    { id: 1, delay: 3500,  label: "Connect network",    action: _stepConnect        },
    { id: 2, delay: 6500,  label: "Generate QR",        action: _stepGenerateQR    },
    { id: 3, delay: 8000,  label: "Customer payment",   action: _stepInjectPayment },
    { id: 4, delay: 12000, label: "Blockchain confirm",  action: _stepAwaitConfirm  },
    { id: 5, delay: 13000, label: "Sound announcement", action: _stepAnnounce      },
    { id: 6, delay: 15000, label: "Update history",     action: _stepUpdateHistory }
  ];

  // ── Init ──────────────────────────────────────────────────────────────────
  function init() {
    DevConsole.log("Demo sequencer ready", "info");
  }

  // ── Start ─────────────────────────────────────────────────────────────────
  function start() {
    if (_active) return;
    _active    = true;
    _stepIndex = -1;

    _showProgress(true);
    DevConsole.log("Demo mode started", "info");

    STEPS.forEach((step, i) => {
      const t = setTimeout(async () => {
        if (!_active) return;
        _stepIndex = i;
        _highlightStep(i);
        DevConsole.log(`Demo: ${step.label}`, "info");
        await step.action();
      }, step.delay);
      _timers.push(t);
    });

    // Auto-stop after last step + 3s buffer
    const endTimer = setTimeout(() => {
      if (_active) stop(false);
    }, STEPS[STEPS.length - 1].delay + 3000);
    _timers.push(endTimer);
  }

  // ── Stop ──────────────────────────────────────────────────────────────────
  function stop(resetToggle = true) {
    _active = false;
    _timers.forEach(t => clearTimeout(t));
    _timers = [];
    _stepIndex = -1;

    _showProgress(false);
    _resetStepHighlights();

    if (resetToggle) {
      const toggle = document.getElementById("toggle-demo");
      if (toggle) toggle.checked = false;
    }

    DevConsole.log("Demo mode stopped", "info");
  }

  // ── Step Actions ──────────────────────────────────────────────────────────
  async function _stepPowerOn() {
    if (state.device.power !== "on") {
      await DeviceController.powerOn();
    }
  }

  async function _stepConnect() {
    if (state.device.network !== "connected") {
      NetworkManager.connect();
    }
  }

  async function _stepGenerateQR() {
    await QRModule.regenerate();
  }

  async function _stepInjectPayment() {
    await TransactionController.injectTest();
  }

  async function _stepAwaitConfirm() {
    DevConsole.log("Awaiting blockchain confirmation...", "info");
  }

  async function _stepAnnounce() {
    // Announcement is triggered automatically on confirmation
  }

  async function _stepUpdateHistory() {
    await TransactionController.openHistoryModal();
  }

  // ── Progress UI ───────────────────────────────────────────────────────────
  function _showProgress(visible) {
    const el = document.getElementById("demo-progress");
    if (el) el.classList.toggle("hidden", !visible);
  }

  function _highlightStep(index) {
    STEPS.forEach((step, i) => {
      const el = document.getElementById(`demo-step-${i}`);
      if (!el) return;
      el.classList.remove("current", "done");
      if (i < index)  el.classList.add("done");
      if (i === index) el.classList.add("current");
    });
  }

  function _resetStepHighlights() {
    STEPS.forEach((_, i) => {
      const el = document.getElementById(`demo-step-${i}`);
      if (el) el.classList.remove("current", "done");
    });
  }

  // ── Public API ────────────────────────────────────────────────────────────
  return { init, start, stop };

})();

window.DemoSequencer = DemoSequencer;
