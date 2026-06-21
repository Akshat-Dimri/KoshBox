/**
 * KoshBox — Frontend Transaction Flow Tests
 * Tests state management, API client mock, and transaction lifecycle.
 * Runs in Node.js (no DOM required for core logic tests).
 * Run: npm run test:frontend
 */

"use strict";

let passed = 0;
let failed = 0;

// ── Minimal DOM stub ──────────────────────────────────────────────────────
// Allows state.js to run without a real browser
global.document = {
  _listeners: {},
  addEventListener(event, fn) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(fn);
  },
  dispatchEvent(evt) {
    const listeners = this._listeners[evt.type] || [];
    listeners.forEach(fn => fn(evt));
  }
};

global.CustomEvent = class CustomEvent {
  constructor(type, opts = {}) {
    this.type   = type;
    this.detail = opts.detail || {};
  }
};

global.window = {};

// ── Load State ────────────────────────────────────────────────────────────
require("../../frontend/scripts/state.js");
const state = global.window.SimulatorState;

// ── Test Runner ────────────────────────────────────────────────────────────

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    console.log(`  ✗ ${name}`);
    console.log(`    → ${err.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || "Assertion failed");
}

function assertEqual(a, b, msg) {
  if (a !== b) throw new Error(msg || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

// ── Tests ──────────────────────────────────────────────────────────────────

async function runAll() {
  console.log("\n╔══════════════════════════════════════╗");
  console.log("║  KoshBox Frontend Logic Tests        ║");
  console.log("╚══════════════════════════════════════╝\n");

  // ── State ────────────────────────────────────────────────────────────────
  console.log("── State Management ───────────────────");

  await test("Initial device state has correct defaults", () => {
    assertEqual(state.device.power,    "off",          "power should be off");
    assertEqual(state.device.language, "en",           "language should be en");
    assertEqual(state.device.volume,   70,             "volume should be 70");
    assert(!state.device.muted,                        "muted should be false");
    assert(!state.device.batteryCharging,              "charging should be false");
    assert(state.device.battery > 0,                   "battery should be positive");
  });

  await test("Initial QR state has correct defaults", () => {
    assertEqual(state.qr.mode, "fixed", "QR mode should be fixed");
    assert(state.qr.merchantAddress.startsWith("0x"), "merchant address should start with 0x");
    assert(state.qr.rotationInterval > 0, "rotation interval should be positive");
  });

  await test("Initial blockchain state is offline", () => {
    assertEqual(state.blockchain.status, "offline", "blockchain status should be offline");
    assertEqual(state.blockchain.latestBlock, 0, "latest block should be 0");
  });

  await test("state.update() merges patch into slice", () => {
    state.update("device", { power: "on", volume: 80 });
    assertEqual(state.device.power,  "on", "power should be on");
    assertEqual(state.device.volume, 80,   "volume should be 80");
    // Reset
    state.update("device", { power: "off", volume: 70 });
  });

  await test("state.update() does not overwrite unpatched fields", () => {
    const originalLang = state.device.language;
    state.update("device", { volume: 55 });
    assertEqual(state.device.language, originalLang, "language should be unchanged");
    state.update("device", { volume: 70 });
  });

  await test("state.update() emits koshbox:state-changed event", () => {
    let eventFired = false;
    document.addEventListener("koshbox:state-changed", () => { eventFired = true; });
    state.update("device", { volume: 65 });
    assert(eventFired, "state-changed event should have fired");
    state.update("device", { volume: 70 });
  });

  await test("state.update() ignores unknown slices", () => {
    // Should not throw
    state.update("nonexistent", { foo: "bar" });
    assert(true, "Should not throw for unknown slice");
  });

  // ── Transaction Management ─────────────────────────────────────────────
  console.log("\n── Transaction Management ─────────────");

  await test("state.addTransaction() adds new transaction", () => {
    const tx = {
      txHash:     "0xtest001",
      amount:     "100.00",
      coin:       "KOSH",
      senderName: "TestUser",
      status:     "pending",
      timestamp:  Date.now()
    };
    state.addTransaction(tx);
    const found = state.getTransaction("0xtest001");
    assert(found !== null, "Transaction should be found");
    assertEqual(found.amount, "100.00", "Amount should match");
  });

  await test("state.addTransaction() updates existing transaction", () => {
    const tx = {
      txHash:     "0xtest001",
      status:     "confirmed",
      blockIndex: 5,
      confirmations: 2
    };
    state.addTransaction(tx);
    const found = state.getTransaction("0xtest001");
    assertEqual(found.status, "confirmed", "Status should be updated");
    assertEqual(found.blockIndex, 5, "blockIndex should be updated");
    assertEqual(found.amount, "100.00", "Amount should be preserved from original");
  });

  await test("state.getTransaction() returns null for unknown hash", () => {
    const result = state.getTransaction("0xnonexistent");
    assert(result === null, "Should return null for unknown hash");
  });

  await test("state.getRecentConfirmed() returns only confirmed/finalized", () => {
    // Add a pending tx
    state.addTransaction({
      txHash: "0xpending001", amount: "50", coin: "KOSH",
      senderName: "PendingUser", status: "pending", timestamp: Date.now()
    });

    const confirmed = state.getRecentConfirmed(10);
    const allPending = confirmed.filter(t => t.status === "pending");
    assertEqual(allPending.length, 0, "Should not include pending transactions");
  });

  await test("state.addTransaction() emits transaction-updated event", () => {
    let eventFired = false;
    document.addEventListener("koshbox:transaction-updated", () => { eventFired = true; });
    state.addTransaction({
      txHash: "0xeventtest", amount: "75", coin: "KOSH",
      senderName: "EventTest", status: "pending", timestamp: Date.now()
    });
    assert(eventFired, "transaction-updated event should fire");
  });

  await test("state.transactions array is capped at 200", () => {
    // Add 210 transactions
    for (let i = 0; i < 210; i++) {
      state.addTransaction({
        txHash: `0xcap${i}`, amount: "1.00", coin: "KOSH",
        senderName: "Cap", status: "confirmed", timestamp: Date.now()
      });
    }
    assert(state.transactions.length <= 200, `Should cap at 200, got ${state.transactions.length}`);
  });

  // ── Blockchain State ───────────────────────────────────────────────────
  console.log("\n── Blockchain State ───────────────────");

  await test("state.update() can update blockchain slice", () => {
    state.update("blockchain", { status: "synced", latestBlock: 10 });
    assertEqual(state.blockchain.status,      "synced", "status should be synced");
    assertEqual(state.blockchain.latestBlock, 10,       "latestBlock should be 10");
    state.update("blockchain", { status: "offline", latestBlock: 0 });
  });

  await test("state.update() can update UI slice", () => {
    state.update("ui", { demoActive: true });
    assert(state.ui.demoActive, "demoActive should be true");
    state.update("ui", { demoActive: false });
  });

  // ── QR State ───────────────────────────────────────────────────────────
  console.log("\n── QR State ───────────────────────────");

  await test("QR state can switch mode", () => {
    state.update("qr", { mode: "dynamic", rotationInterval: 1800000 });
    assertEqual(state.qr.mode, "dynamic", "mode should be dynamic");
    assertEqual(state.qr.rotationInterval, 1800000, "interval should be set");
    state.update("qr", { mode: "fixed" });
  });

  await test("QR merchant address is valid format", () => {
    assert(state.qr.merchantAddress.startsWith("0x"), "Should start with 0x");
    assert(state.qr.merchantAddress.length === 42, "Should be 42 chars");
  });

  // ── Summary ────────────────────────────────────────────────────────────
  console.log("\n──────────────────────────────────────");
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Total:  ${passed + failed}`);
  console.log("──────────────────────────────────────\n");

  process.exit(failed > 0 ? 1 : 0);
}

runAll().catch(err => {
  console.error("Test runner error:", err);
  process.exit(1);
});
