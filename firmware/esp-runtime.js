/**
 * KoshBox — Simulated ESP32 Firmware Runtime
 * ============================================
 * This file represents the firmware running on the KoshBox ESP32-S3 device.
 * In the simulator, this is loaded into the Monaco firmware editor.
 * Changes here affect simulator behaviour but do NOT auto-deploy.
 *
 * When deploying to real hardware, this logic is ported to C++ (Arduino framework).
 * See docs/esp32-roadmap.md for the full porting guide.
 *
 * FIRMWARE VERSION: 1.0.0
 * TARGET:           ESP32-S3-WROOM-1
 * NETWORK:          Kosh Testnet
 */

"use strict";

// ── Firmware Configuration ─────────────────────────────────────────────────
const FIRMWARE_CONFIG = {
  version:          "1.0.0",
  deviceId:         "KOSHBOX-001",
  wifiSSID:         "KoshBox_Network",
  apiEndpoint:      "http://localhost:3001",
  pollIntervalMs:   2000,       // how often to check for new confirmed transactions
  maxRetries:       3,
  audioEnabled:     true,
  displayEnabled:   true,
  ledEnabled:       true,
  deepSleepEnabled: true,
  inactivityTimeoutS: 60
};

// ── Hardware Pin Mapping (ESP32-S3) ────────────────────────────────────────
// In simulation, these are unused. On real hardware, these map to GPIO pins.
const PIN_MAP = {
  LED_POWER:   2,    // GPIO2  — White power LED
  LED_NETWORK: 4,    // GPIO4  — White network LED
  LED_PAYMENT: 16,   // GPIO16 — White payment LED
  LED_BATTERY: 17,   // GPIO17 — White battery LED
  SPEAKER_DAC: 25,   // GPIO25 — DAC output to PAM8403 amplifier
  DFPLAYER_TX: 26,   // GPIO26 — UART TX to DFPlayer Mini
  DFPLAYER_RX: 27,   // GPIO27 — UART RX from DFPlayer Mini
  EINK_CS:     5,    // GPIO5  — E-Ink display chip select
  EINK_DC:     17,   // GPIO17 — E-Ink data/command
  EINK_RST:    16,   // GPIO16 — E-Ink reset
  EINK_BUSY:   4,    // GPIO4  — E-Ink busy signal
  BATTERY_ADC: 34,   // GPIO34 — Battery voltage ADC (analog read)
  USB_DETECT:  35    // GPIO35 — USB-C connected detection
};

// ── Device State ───────────────────────────────────────────────────────────
let deviceState = {
  power:           "booting",
  batteryLevel:    85,
  batteryCharging: false,
  networkStatus:   "disconnected",
  volume:          70,
  language:        "en",
  lastTxHash:      null,
  uptime:          0
};

// ── Payment Handler ────────────────────────────────────────────────────────
/**
 * Called when a transaction is confirmed on the blockchain.
 * Triggers audio announcement and LED flash.
 *
 * @param {object} tx - confirmed transaction
 * @param {object} ctx - simulator context (audio, leds, display)
 */
async function handlePayment(tx, ctx) {
  if (!FIRMWARE_CONFIG.audioEnabled) return;

  deviceState.lastTxHash = tx.txHash;

  // Flash payment LED
  if (FIRMWARE_CONFIG.ledEnabled && ctx.leds) {
    ctx.leds.flash("payment", 3, 200);
  }

  // Build and play announcement
  const sequence = buildAnnouncementSequence(tx, deviceState.language);
  if (ctx.audio) {
    await ctx.audio.playSequence(sequence);
  }

  // Update display to show last payment
  if (FIRMWARE_CONFIG.displayEnabled && ctx.display) {
    ctx.display.showPaymentConfirmed(tx);
  }
}

// ── Announcement Builder ───────────────────────────────────────────────────
/**
 * Build the audio announcement sequence for a payment.
 * Returns array of segments to play in order.
 *
 * @param {object} tx
 * @param {string} lang - "en" | "hi"
 * @returns {object[]}
 */
function buildAnnouncementSequence(tx, lang) {
  return [
    { type: "static",  file: `payment_received_${lang}.mp3` },
    { type: "static",  file: `amount_of_${lang}.mp3` },
    { type: "dynamic", value: tx.amount, synthesize: true },
    { type: "static",  file: `rupees_${lang}.mp3` },
    { type: "static",  file: `received_from_${lang}.mp3` },
    { type: "dynamic", value: tx.senderName, synthesize: true }
  ];
}

// ── Battery Monitor ────────────────────────────────────────────────────────
/**
 * Read battery level from ADC.
 * On real hardware: analogRead(PIN_MAP.BATTERY_ADC) / 4095.0 * 100
 * In simulator: returns deviceState.batteryLevel
 *
 * @returns {number} battery percentage 0–100
 */
function getBatteryLevel() {
  return deviceState.batteryLevel;
}

/**
 * Check if USB-C charging is connected.
 * On real hardware: digitalRead(PIN_MAP.USB_DETECT) === HIGH
 * @returns {boolean}
 */
function isCharging() {
  return deviceState.batteryCharging;
}

// ── Network Monitor ────────────────────────────────────────────────────────
/**
 * Check if device is connected to WiFi.
 * On real hardware: WiFi.status() == WL_CONNECTED
 * @returns {boolean}
 */
function isNetworkConnected() {
  return deviceState.networkStatus === "connected";
}

// ── Volume Control ─────────────────────────────────────────────────────────
/**
 * Set speaker volume.
 * On real hardware: dfPlayer.volume(level / 10)  // DFPlayer takes 0–30
 * In simulator: sets volume in device state
 *
 * @param {number} level - 0 to 100
 */
function setVolume(level) {
  deviceState.volume = Math.max(0, Math.min(100, level));
}

// ── Language Control ───────────────────────────────────────────────────────
/**
 * Switch announcement language.
 * Causes phrase bank to reload from flash (real hardware) or update state (simulator).
 *
 * @param {string} lang - "en" | "hi"
 */
function setLanguage(lang) {
  const supported = ["en", "hi"];
  if (supported.includes(lang)) {
    deviceState.language = lang;
  }
}

// ── QR Refresh ─────────────────────────────────────────────────────────────
/**
 * Render a new QR code to the E-Ink display.
 * On real hardware: GxEPD2 library full/partial refresh.
 * In simulator: triggers QR module re-render.
 *
 * @param {string} data - QR payload string
 * @param {object} ctx - simulator context
 */
async function refreshQR(data, ctx) {
  if (!FIRMWARE_CONFIG.displayEnabled) return;
  if (ctx.display) {
    await ctx.display.renderQR(data);
  }
}

// ── Power Management ───────────────────────────────────────────────────────
/**
 * Enter light sleep mode.
 * On real hardware: esp_light_sleep_start()
 * Wake sources: GPIO (payment notification), timer (poll interval)
 */
function sleep() {
  deviceState.power = "sleep";
}

/**
 * Wake from sleep.
 * On real hardware: called after esp_sleep_enable_gpio_wakeup()
 */
function wake() {
  deviceState.power = "on";
}

// ── Firmware Exports ───────────────────────────────────────────────────────
// These exports are the interface between firmware and the simulator runtime.
// On real hardware, these become public functions in the Arduino sketch.
module.exports = {
  FIRMWARE_CONFIG,
  PIN_MAP,
  deviceState,
  handlePayment,
  buildAnnouncementSequence,
  getBatteryLevel,
  isCharging,
  isNetworkConnected,
  setVolume,
  setLanguage,
  refreshQR,
  sleep,
  wake
};
