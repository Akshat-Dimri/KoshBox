/**
 * KoshBox — Device API Routes
 * GET  /api/device/state
 * POST /api/device/state
 * GET  /api/device/analytics
 * POST /api/device/network/failure
 * POST /api/device/network/weak
 * POST /api/device/battery
 * GET  /api/device/announcements/:eventKey
 */

"use strict";

const express = require("express");
const router = express.Router();

const deviceTwin        = require("../../simulator/device-twin");
const networkSimulator  = require("../../simulator/network-simulator");
const announcementService = require("../../services/announcement-service");
const config            = require("../../config");

/**
 * GET /api/device/state
 * Returns the current device state.
 */
router.get("/state", (req, res) => {
  return res.json({ success: true, device: deviceTwin.getState() });
});

/**
 * POST /api/device/state
 * Update device state (power, volume, language, etc).
 * Body: partial device state patch.
 */
router.post("/state", async (req, res) => {
  try {
    await deviceTwin.updateState(req.body);
    return res.json({ success: true, device: deviceTwin.getState() });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/device/analytics
 * Returns device analytics summary.
 */
router.get("/analytics", (req, res) => {
  return res.json({ success: true, analytics: deviceTwin.getAnalytics() });
});

/**
 * GET /api/device/network
 * Returns current network status with signal detail.
 */
router.get("/network", (req, res) => {
  return res.json({ success: true, network: networkSimulator.getStatusDetail() });
});

/**
 * POST /api/device/network/connect
 * Initiate a network connection.
 */
router.post("/network/connect", (req, res) => {
  networkSimulator.connect();
  return res.json({ success: true, message: "Connection attempt initiated" });
});

/**
 * POST /api/device/network/failure
 * Simulate a network failure.
 */
router.post("/network/failure", (req, res) => {
  networkSimulator.simulateFailure();
  return res.json({ success: true, message: "Network failure simulated" });
});

/**
 * POST /api/device/network/weak
 * Simulate weak signal conditions.
 */
router.post("/network/weak", (req, res) => {
  networkSimulator.simulateWeakSignal();
  return res.json({ success: true, message: "Weak signal simulated" });
});

/**
 * POST /api/device/network/disconnect
 * Force disconnect (used by power off).
 */
router.post("/network/disconnect", (req, res) => {
  networkSimulator.disconnect();
  return res.json({ success: true, message: "Network disconnected" });
});

/**
 * POST /api/device/battery
 * Set battery level and charging state.
 * Body: { level: number, charging: boolean }
 */
router.post("/battery", async (req, res) => {
  try {
    const { level, charging } = req.body;
    if (level === undefined || isNaN(parseFloat(level))) {
      return res.status(400).json({ success: false, error: "Invalid battery level" });
    }
    await deviceTwin.setBattery(parseFloat(level), !!charging);
    return res.json({ success: true, battery: deviceTwin.getState().battery });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/device/battery/simulate-low
 * Set battery to low threshold for demonstration.
 */
router.post("/battery/simulate-low", async (req, res) => {
  await deviceTwin.setBattery(config.device.batteryLowThreshold - 1, false);
  return res.json({ success: true, message: "Low battery simulated", level: deviceTwin.getState().battery });
});

/**
 * GET /api/device/announcements/:eventKey
 * Get announcement sequence for a system event.
 */
router.get("/announcements/:eventKey", (req, res) => {
  const language = req.query.lang || config.device.defaultLanguage;
  const sequence = announcementService.buildSystemAnnouncement(req.params.eventKey, language);

  if (sequence.length === 0) {
    return res.status(404).json({ success: false, error: "Unknown event key" });
  }

  return res.json({ success: true, sequence });
});

/**
 * GET /api/device/announcements
 * List all available announcement phrase keys and their text.
 */
router.get("/announcements", (req, res) => {
  const languages = announcementService.getSupportedLanguages();
  const paths = {};
  languages.forEach(lang => {
    paths[lang] = announcementService.getPhraseFilePaths(lang);
  });

  return res.json({ success: true, languages, paths });
});

/**
 * POST /api/device/reset
 * Reset device to default state (power off, default settings).
 */
router.post("/reset", async (req, res) => {
  await deviceTwin.updateState({
    power:          "off",
    network:        "disconnected",
    volume:         config.device.defaultVolume,
    muted:          false,
    language:       config.device.defaultLanguage,
    batteryCharging:false
  });
  networkSimulator.disconnect();
  return res.json({ success: true, message: "Device reset to defaults" });
});

module.exports = router;
