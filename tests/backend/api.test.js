/**
 * KoshBox — Backend API Tests
 * Tests all API routes and blockchain behaviour.
 * Run: npm run test:backend
 */

"use strict";

const http = require("http");

let passed = 0;
let failed = 0;
const results = [];

// ── Test Runner ────────────────────────────────────────────────────────────

async function test(name, fn) {
  try {
    await fn();
    passed++;
    results.push({ name, status: "PASS" });
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    results.push({ name, status: "FAIL", error: err.message });
    console.log(`  ✗ ${name}`);
    console.log(`    → ${err.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || "Assertion failed");
}

function assertEqual(a, b, message) {
  if (a !== b) throw new Error(message || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

// ── HTTP Helpers ───────────────────────────────────────────────────────────

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: "localhost",
      port: 3001,
      path,
      method,
      headers: { "Content-Type": "application/json" }
    };
    if (data) opts.headers["Content-Length"] = Buffer.byteLength(data);

    const req = http.request(opts, (res) => {
      let raw = "";
      res.on("data", c => raw += c);
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch (_) { resolve({ status: res.statusCode, body: raw }); }
      });
    });

    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

const get  = (path)       => request("GET",  path);
const post = (path, body) => request("POST", path, body);

// ── Tests ──────────────────────────────────────────────────────────────────

async function runAll() {
  console.log("\n╔══════════════════════════════════════╗");
  console.log("║     KoshBox Backend Test Suite       ║");
  console.log("╚══════════════════════════════════════╝\n");

  // Health check first
  try {
    const health = await get("/api/health");
    if (health.status !== 200) {
      console.error("✗ Server not reachable. Is it running? (npm run dev)\n");
      process.exit(1);
    }
  } catch (_) {
    console.error("✗ Server not reachable. Is it running? (npm run dev)\n");
    process.exit(1);
  }

  console.log("── Health ─────────────────────────────");
  await test("GET /api/health returns 200", async () => {
    const res = await get("/api/health");
    assertEqual(res.status, 200);
    assert(res.body.status === "ok", "Status should be ok");
  });

  console.log("\n── Blockchain ─────────────────────────");
  await test("GET /api/blockchain/status returns chain info", async () => {
    const res = await get("/api/blockchain/status");
    assertEqual(res.status, 200);
    assert(res.body.success, "success should be true");
    assert(res.body.chain.networkId === "kosh-testnet-1", "network ID mismatch");
    assert(typeof res.body.chain.latestBlock === "number", "latestBlock should be number");
  });

  await test("GET /api/blockchain/blocks returns array", async () => {
    const res = await get("/api/blockchain/blocks?limit=5");
    assertEqual(res.status, 200);
    assert(Array.isArray(res.body.blocks), "blocks should be array");
    assert(res.body.blocks.length >= 1, "should have at least genesis block");
  });

  await test("GET /api/blockchain/blocks/0 returns genesis block", async () => {
    const res = await get("/api/blockchain/blocks/0");
    assertEqual(res.status, 200);
    assert(res.body.block.index === 0, "genesis block index should be 0");
    assert(
      res.body.block.previousHash.startsWith("0000"),
      "genesis previousHash should start with 0000"
    );
  });

  await test("GET /api/blockchain/validate confirms chain integrity", async () => {
    const res = await get("/api/blockchain/validate");
    assertEqual(res.status, 200);
    assert(res.body.valid === true, "chain should be valid");
  });

  await test("GET /api/blockchain/wallets returns wallet list", async () => {
    const res = await get("/api/blockchain/wallets");
    assertEqual(res.status, 200);
    assert(Array.isArray(res.body.wallets), "wallets should be array");
    assert(res.body.wallets.length >= 2, "should have merchant + system wallets");
  });

  console.log("\n── Merchant ───────────────────────────");
  await test("GET /api/merchant/info returns merchant data", async () => {
    const res = await get("/api/merchant/info");
    assertEqual(res.status, 200);
    assert(res.body.merchant.address, "merchant address should exist");
    assert(res.body.merchant.address.startsWith("0x"), "address should start with 0x");
  });

  await test("GET /api/merchant/qr/fixed returns QR payload", async () => {
    const res = await get("/api/merchant/qr/fixed");
    assertEqual(res.status, 200);
    assert(res.body.payload.includes("payment.html"), "payload should be payment URL");
    assertEqual(res.body.mode, "fixed");
  });

  await test("GET /api/merchant/qr/dynamic returns session data", async () => {
    const res = await get("/api/merchant/qr/dynamic");
    assertEqual(res.status, 200);
    assert(res.body.sessionId, "sessionId should exist");
    assert(res.body.expiresAt > Date.now(), "expiresAt should be in future");
    assertEqual(res.body.mode, "dynamic");
  });

  await test("POST /api/merchant/qr/validate-session validates active session", async () => {
    const qrRes = await get("/api/merchant/qr/dynamic");
    const { sessionId } = qrRes.body;
    const res = await post("/api/merchant/qr/validate-session", { sessionId });
    assertEqual(res.status, 200);
    assert(res.body.valid === true, "active session should be valid");
  });

  await test("POST /api/merchant/qr/validate-session rejects invalid session", async () => {
    const res = await post("/api/merchant/qr/validate-session", { sessionId: "invalid-session-xyz" });
    assertEqual(res.status, 200);
    assert(res.body.valid === false, "invalid session should be rejected");
  });

  console.log("\n── Transactions ───────────────────────");
  let testTxHash = null;

  await test("POST /api/transactions/inject creates pending transaction", async () => {
    const res = await post("/api/transactions/inject", {
      senderName: "TestUser",
      amount: "100.00",
      coin: "KOSH"
    });
    assertEqual(res.status, 201);
    assert(res.body.success, "should succeed");
    assert(res.body.txHash, "txHash should exist");
    assert(res.body.txHash.startsWith("0x"), "txHash should start with 0x");
    assert(res.body.status === "pending", "status should be pending");
    testTxHash = res.body.txHash;
  });

  await test("GET /api/transactions/status/:hash returns tx data", async () => {
    assert(testTxHash, "need a txHash from previous test");
    const res = await get(`/api/transactions/status/${testTxHash}`);
    assertEqual(res.status, 200);
    assert(res.body.txHash === testTxHash, "txHash should match");
    assert(res.body.amount === "100.00", "amount should match");
  });

  await test("GET /api/transactions/stats returns pool stats", async () => {
    const res = await get("/api/transactions/stats");
    assertEqual(res.status, 200);
    assert(typeof res.body.stats.pending === "number", "pending should be number");
    assert(typeof res.body.stats.confirmed === "number", "confirmed should be number");
  });

  await test("POST /api/transactions/submit validates required fields", async () => {
    const res = await post("/api/transactions/submit", { amount: "50.00" });
    assertEqual(res.status, 400);
    assert(!res.body.success, "should fail with missing fields");
  });

  await test("POST /api/transactions/submit rejects invalid coin", async () => {
    const res = await post("/api/transactions/submit", {
      merchantAddress: "0x742d35Cc6634C0532925a3b8D4C9b7F3a7C2F1E",
      amount: "50.00",
      coin: "INVALIDCOIN",
      senderName: "Test",
      senderAddress: "0xabc123"
    });
    assertEqual(res.status, 400);
    assert(!res.body.success, "invalid coin should be rejected");
  });

  await test("GET /api/transactions/history returns array", async () => {
    const res = await get("/api/transactions/history?limit=10");
    assertEqual(res.status, 200);
    assert(Array.isArray(res.body.transactions), "transactions should be array");
  });

  await test("GET /api/transactions/history reports announced status (regression: audio replay on restart)", async () => {
    // Find any confirmed/finalized tx and mark it announced.
    const before = await get("/api/transactions/history?limit=50");
    const tx = before.body.transactions.find(
      t => t.status === "confirmed" || t.status === "finalized"
    );
    assert(tx, "need at least one confirmed transaction to test against");

    await post(`/api/transactions/${tx.txHash}/mark-announced`);

    const after = await get("/api/transactions/history?limit=50");
    const updated = after.body.transactions.find(t => t.txHash === tx.txHash);
    assert(updated, "transaction should still be in history");
    assertEqual(
      updated.announced,
      true,
      "history must expose `announced` — otherwise every server restart / page " +
      "reload re-plays the full payment audio history, since the frontend poller " +
      "relies on this flag to skip already-announced transactions"
    );
  });

  console.log("\n── Device ─────────────────────────────");
  await test("GET /api/device/state returns device state", async () => {
    const res = await get("/api/device/state");
    assertEqual(res.status, 200);
    assert(res.body.device, "device state should exist");
    assert(typeof res.body.device.battery === "number", "battery should be number");
    assert(typeof res.body.device.volume === "number", "volume should be number");
  });

  await test("POST /api/device/state updates device state", async () => {
    const res = await post("/api/device/state", { volume: 55, language: "hi" });
    assertEqual(res.status, 200);
    assert(res.body.device.volume === 55, "volume should be updated");
    assert(res.body.device.language === "hi", "language should be updated");
    // Reset
    await post("/api/device/state", { volume: 70, language: "en" });
  });

  await test("GET /api/device/analytics returns analytics summary", async () => {
    const res = await get("/api/device/analytics");
    assertEqual(res.status, 200);
    assert(res.body.analytics, "analytics should exist");
    assert(typeof res.body.analytics.totalPayments === "number");
  });

  await test("POST /api/device/network/failure changes network to disconnected", async () => {
    const res = await post("/api/device/network/failure");
    assertEqual(res.status, 200);
    assert(res.body.success, "should succeed");
    const stateRes = await get("/api/device/state");
    assertEqual(stateRes.body.device.network, "disconnected");
  });

  await test("POST /api/device/battery sets battery level", async () => {
    const res = await post("/api/device/battery", { level: 60, charging: true });
    assertEqual(res.status, 200);
    assert(res.body.success, "should succeed");
    const stateRes = await get("/api/device/state");
    assertEqual(stateRes.body.device.battery, 60);
    assertEqual(stateRes.body.device.batteryCharging, true);
    // Reset
    await post("/api/device/battery", { level: 85, charging: false });
  });

  await test("POST /api/device/battery rejects invalid level", async () => {
    const res = await post("/api/device/battery", { level: "notanumber" });
    assertEqual(res.status, 400);
    assert(!res.body.success);
  });

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log("\n──────────────────────────────────────");
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Total:  ${passed + failed}`);
  console.log("──────────────────────────────────────\n");

  if (failed > 0) {
    console.log("Failed tests:");
    results.filter(r => r.status === "FAIL").forEach(r => {
      console.log(`  ✗ ${r.name}`);
      console.log(`    ${r.error}`);
    });
    console.log();
    process.exit(1);
  }

  process.exit(0);
}

runAll();
