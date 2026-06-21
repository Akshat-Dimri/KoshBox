/**
 * KoshBox — Persistence Service
 * Handles all JSON file read/write operations.
 * All blockchain and device state is stored here.
 */

"use strict";

const fs = require("fs").promises;
const path = require("path");
const config = require("../config");

/**
 * Ensure the data directory exists.
 */
async function ensureDataDir() {
  try {
    await fs.mkdir(config.persistence.dataDir, { recursive: true });
  } catch (err) {
    if (err.code !== "EEXIST") throw err;
  }
}

/**
 * Read a JSON file safely. Returns null if file does not exist.
 * @param {string} filePath
 * @returns {any|null}
 */
async function readJson(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === "ENOENT") return null;
    console.error(`[Persistence] Failed to read ${filePath}:`, err.message);
    return null;
  }
}

/**
 * Write data as JSON to a file atomically (write to temp, then rename).
 * @param {string} filePath
 * @param {any} data
 */
async function writeJson(filePath, data) {
  await ensureDataDir();
  const tmpPath = filePath + ".tmp";
  try {
    await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), "utf8");
    await fs.rename(tmpPath, filePath);
  } catch (err) {
    console.error(`[Persistence] Failed to write ${filePath}:`, err.message);
    // Attempt cleanup of temp file
    try { await fs.unlink(tmpPath); } catch (_) {}
    throw err;
  }
}

// ── Chain ──────────────────────────────────────────────────────────────────

async function loadChain() {
  return readJson(config.persistence.chainFile);
}

async function saveChain(blocks) {
  return writeJson(config.persistence.chainFile, blocks);
}

// ── Wallets ────────────────────────────────────────────────────────────────

async function loadWallets() {
  return readJson(config.persistence.walletsFile);
}

async function saveWallets(wallets) {
  return writeJson(config.persistence.walletsFile, wallets);
}

// ── Transaction Pool ───────────────────────────────────────────────────────

async function loadTxPool() {
  return readJson(config.persistence.txPoolFile);
}

async function saveTxPool(poolState) {
  return writeJson(config.persistence.txPoolFile, poolState);
}

// ── Device State ───────────────────────────────────────────────────────────

async function loadDeviceState() {
  return readJson(config.persistence.deviceFile);
}

async function saveDeviceState(state) {
  return writeJson(config.persistence.deviceFile, state);
}

// ── Utilities ──────────────────────────────────────────────────────────────

/**
 * Delete all data files (used by reset tool).
 */
async function clearAllData() {
  const files = [
    config.persistence.chainFile,
    config.persistence.walletsFile,
    config.persistence.txPoolFile,
    config.persistence.deviceFile
  ];

  for (const file of files) {
    try {
      await fs.unlink(file);
      console.log(`[Persistence] Deleted: ${file}`);
    } catch (err) {
      if (err.code !== "ENOENT") {
        console.warn(`[Persistence] Could not delete ${file}:`, err.message);
      }
    }
  }
}

module.exports = {
  loadChain,
  saveChain,
  loadWallets,
  saveWallets,
  loadTxPool,
  saveTxPool,
  loadDeviceState,
  saveDeviceState,
  clearAllData,
  ensureDataDir
};
