/**
 * KoshBox — Exploded View Component
 * Renders the hardware component list and detail panel inside the modal.
 * Each component is clickable and shows specs + live metrics.
 */

"use strict";

const ExplodedView = (() => {

  const state = window.SimulatorState;

  // ── Component Definitions ─────────────────────────────────────────────────
  const COMPONENTS = [
    {
      id:       "top-shell",
      name:     "Top Shell",
      part:     "ABS Plastic — 120×80×5mm",
      desc:     "Injection-moulded ABS enclosure. Houses the E-Ink display aperture, LED light pipes, and speaker grille cutout. Matte black finish with subtle texture.",
      metrics:  [
        { label: "Material",   value: "ABS Plastic" },
        { label: "Thickness",  value: "2.5mm" },
        { label: "Finish",     value: "Matte Black" }
      ],
      firmware: false
    },
    {
      id:       "qr-display",
      name:     "QR Display Module",
      part:     "Waveshare 2.9\" E-Ink",
      desc:     "296×128 resolution E-Ink display. Zero power consumption when idle — only draws current during refresh. Connected to ESP32 via SPI. Used for both fixed and dynamic QR codes.",
      metrics:  [
        { label: "Resolution", value: "296×128 px" },
        { label: "Interface",  value: "SPI" },
        { label: "Refresh",    value: "2.0s full" },
        { label: "Power",      value: "~26mA active" }
      ],
      firmware: false
    },
    {
      id:       "esp32",
      name:     "ESP32-S3",
      part:     "ESP32-S3-WROOM-1",
      desc:     "Main microcontroller. Dual-core Xtensa LX7 at 240MHz. Handles WiFi connectivity, payment logic, QR generation, display output, and audio processing. 8MB flash for firmware and audio phrase storage.",
      metrics:  [
        { label: "CPU",        value: "240 MHz" },
        { label: "Flash",      value: "8 MB" },
        { label: "RAM",        value: "512 KB" },
        { label: "WiFi",       value: "802.11 b/g/n" },
        { label: "Load",       value: () => `${_simCpuLoad()}%` }
      ],
      firmware: true
    },
    {
      id:       "amplifier",
      name:     "Amplifier",
      part:     "PAM8403 Class-D",
      desc:     "Stereo class-D amplifier module. Accepts 3.5mm line-in from ESP32 DAC output. Drives the 8Ω speaker at up to 3W. Software volume controlled via ESP32 GPIO PWM.",
      metrics:  [
        { label: "Output",     value: "3W @ 4Ω" },
        { label: "Input",      value: "3.5mm line" },
        { label: "Class",      value: "D (digital)" },
        { label: "Volume",     value: () => `${state.device.volume}%` }
      ],
      firmware: false
    },
    {
      id:       "speaker",
      name:     "Speaker",
      part:     "8Ω 2W Mylar Cone",
      desc:     "Compact mylar cone speaker optimised for voice-range frequencies (300Hz–4kHz). Ideal for payment announcements. Face-down mounting with grille cutout in bottom shell.",
      metrics:  [
        { label: "Impedance",  value: "8 Ω" },
        { label: "Power",      value: "2W max" },
        { label: "Range",      value: "300–4000 Hz" },
        { label: "Muted",      value: () => state.device.muted ? "Yes" : "No" }
      ],
      firmware: false
    },
    {
      id:       "battery",
      name:     "Battery",
      part:     "18650 Li-ion 3.7V 2000mAh",
      desc:     "Standard 18650 lithium-ion cell with built-in protection circuit. Charged via TP4056 IC at 1A from USB-C input. Provides approximately 8–12 hours of continuous use.",
      metrics:  [
        { label: "Capacity",   value: "2000 mAh" },
        { label: "Voltage",    value: "3.7V nominal" },
        { label: "Level",      value: () => `${Math.round(state.device.battery)}%` },
        { label: "Status",     value: () => state.device.batteryCharging ? "Charging" : "Discharging" }
      ],
      firmware: false
    },
    {
      id:       "power-circuit",
      name:     "Power Circuit",
      part:     "TP4056 + MT3608",
      desc:     "Two-IC power management: TP4056 handles Li-ion charging from USB-C at 1A. MT3608 boost converter steps up 3.7V battery to 5V regulated system rail for ESP32 and peripherals.",
      metrics:  [
        { label: "Input",      value: "5V USB-C" },
        { label: "Output",     value: "5V regulated" },
        { label: "Charge rate","value": "1A" },
        { label: "Charging",   value: () => state.device.batteryCharging ? "Active" : "Idle" }
      ],
      firmware: false
    }
  ];

  let _selectedId = null;

  // ── Init ──────────────────────────────────────────────────────────────────
  function init() {
    _renderComponentList();
  }

  // ── Open ──────────────────────────────────────────────────────────────────
  function open() {
    _renderComponentList();
    _showDefaultDetail();
    DevConsole.log("Hardware exploded view opened", "info");
  }

  // ── Render Component List ─────────────────────────────────────────────────
  function _renderComponentList() {
    const container = document.getElementById("exploded-components");
    if (!container) return;

    container.innerHTML = COMPONENTS.map((comp, i) => {
      const isOnline = state.device.power === "on";
      return `
        <div
          class="component-layer${_selectedId === comp.id ? " selected" : ""}"
          data-component-id="${comp.id}"
          style="animation-delay:${i * 0.05}s"
        >
          <div class="component-layer__icon">
            ${_getComponentSVG(comp.id)}
          </div>
          <div class="component-layer__info">
            <div class="component-layer__name">${comp.name}</div>
            <div class="component-layer__part">${comp.part}</div>
          </div>
          <div class="component-layer__status${!isOnline ? " offline" : ""}"></div>
        </div>
      `;
    }).join("");

    // Bind click handlers
    container.querySelectorAll(".component-layer").forEach(el => {
      el.addEventListener("click", () => {
        const id = el.dataset.componentId;
        _selectComponent(id);
      });
    });
  }

  // ── Select Component ──────────────────────────────────────────────────────
  function _selectComponent(id) {
    _selectedId = id;

    // Update selected state in list
    document.querySelectorAll(".component-layer").forEach(el => {
      el.classList.toggle("selected", el.dataset.componentId === id);
    });

    const comp = COMPONENTS.find(c => c.id === id);
    if (comp) _renderDetail(comp);
  }

  // ── Render Detail ─────────────────────────────────────────────────────────
  function _renderDetail(comp) {
    const panel = document.getElementById("component-detail");
    if (!panel) return;

    const metricsHTML = comp.metrics.map(m => {
      const value = typeof m.value === "function" ? m.value() : m.value;
      return `
        <div class="component-metric">
          <span class="component-metric__label">${m.label}</span>
          <span class="component-metric__value">${value}</span>
        </div>
      `;
    }).join("");

    const firmwareBtn = comp.firmware ? `
      <button class="btn btn--accent btn--full" onclick="window.open('pages/firmware.html','_blank')" style="margin-top:var(--space-3);">
        Edit ESP System Code
      </button>
    ` : "";

    panel.innerHTML = `
      <div class="component-detail__name">${comp.name}</div>
      <div class="component-detail__part">${comp.part}</div>
      <div class="component-detail__desc">${comp.desc}</div>
      <div class="component-detail__metrics">
        <div class="data-label" style="margin-bottom:var(--space-2);">Live Metrics</div>
        ${metricsHTML}
      </div>
      ${firmwareBtn}
    `;

    // Refresh live metrics every 2 seconds while panel is open
    _startMetricRefresh(comp);
  }

  // ── Live Metric Refresh ───────────────────────────────────────────────────
  let _metricInterval = null;

  function _startMetricRefresh(comp) {
    if (_metricInterval) clearInterval(_metricInterval);

    _metricInterval = setInterval(() => {
      const panel = document.getElementById("component-detail");
      if (!panel || !document.getElementById("modal-exploded")?.classList.contains("active")) {
        clearInterval(_metricInterval);
        return;
      }

      // Update only dynamic metric values
      const metricEls = panel.querySelectorAll(".component-metric__value");
      comp.metrics.forEach((m, i) => {
        if (typeof m.value === "function" && metricEls[i]) {
          metricEls[i].textContent = m.value();
        }
      });
    }, 2000);
  }

  // ── Default Detail ────────────────────────────────────────────────────────
  function _showDefaultDetail() {
    const panel = document.getElementById("component-detail");
    if (!panel) return;
    panel.innerHTML = `
      <div style="color:var(--text-muted);font-size:var(--text-sm);line-height:1.6;">
        Select a component from the list to view its specifications, purpose, and live simulated metrics.
      </div>
    `;
  }

  // ── Simulated CPU Load ────────────────────────────────────────────────────
  function _simCpuLoad() {
    if (state.device.power !== "on") return 0;
    const base = 12;
    const networkLoad = state.device.network === "connected" ? 8 : 2;
    const jitter = Math.floor(Math.random() * 6);
    return Math.min(99, base + networkLoad + jitter);
  }

  // ── Component SVG Icons ───────────────────────────────────────────────────
  function _getComponentSVG(id) {
    const icons = {
      "top-shell": `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="3"/></svg>`,
      "qr-display": `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="3" height="3"/><rect x="19" y="14" width="2" height="2"/><rect x="14" y="19" width="2" height="2"/><rect x="19" y="19" width="2" height="2"/></svg>`,
      "esp32": `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="6" width="16" height="12" rx="2"/><path d="M8 6V4M12 6V4M16 6V4M8 18v2M12 18v2M16 18v2M4 10H2M4 14H2M20 10h2M20 14h2"/></svg>`,
      "amplifier": `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>`,
      "speaker": `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`,
      "battery": `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="7" width="18" height="10" rx="2"/><path d="M20 11h2v2h-2z"/></svg>`,
      "power-circuit": `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2v6M12 16v6M4.93 4.93l4.24 4.24M14.83 14.83l4.24 4.24M2 12h6M16 12h6M4.93 19.07l4.24-4.24M14.83 9.17l4.24-4.24"/></svg>`
    };
    return icons[id] || `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="8"/></svg>`;
  }

  // ── Public API ────────────────────────────────────────────────────────────
  return { init, open };

})();

window.ExplodedView = ExplodedView;
