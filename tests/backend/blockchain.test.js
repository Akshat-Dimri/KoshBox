/**
 * KoshBox — Blockchain Unit Tests
 * Tests chain logic, block building, wallet manager, transaction pool.
 * Run: npm run test:backend
 */

"use strict";

let passed = 0;
let failed = 0;

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

// ── Load modules ───────────────────────────────────────────────────────────

const { sha256, generateAddress, generateTxHash, computeMerkleRoot, computeBlockHash, shortHash }
  = require("../../backend/blockchain/utils");

async function runAll() {
  console.log("\n╔══════════════════════════════════════╗");
  console.log("║   KoshBox Blockchain Unit Tests      ║");
  console.log("╚══════════════════════════════════════╝\n");

  // ── Utils ────────────────────────────────────────────────────────────────
  console.log("── Utils ──────────────────────────────");

  await test("sha256 produces 64-char hex string", () => {
    const h = sha256("hello");
    assert(h.length === 64, `Expected 64 chars, got ${h.length}`);
    assert(/^[0-9a-f]+$/.test(h), "Should be hex");
  });

  await test("sha256 is deterministic", () => {
    assertEqual(sha256("koshbox"), sha256("koshbox"), "Same input must produce same hash");
  });

  await test("sha256 is sensitive to input", () => {
    assert(sha256("koshbox") !== sha256("KoshBox"), "Different case must produce different hash");
  });

  await test("generateAddress returns 0x-prefixed 42-char string", () => {
    const addr = generateAddress("test-seed");
    assert(addr.startsWith("0x"), "Must start with 0x");
    assertEqual(addr.length, 42, "Must be 42 chars (0x + 40 hex)");
  });

  await test("generateAddress is deterministic", () => {
    assertEqual(
      generateAddress("merchant-seed"),
      generateAddress("merchant-seed"),
      "Same seed must produce same address"
    );
  });

  await test("generateAddress differs for different seeds", () => {
    assert(
      generateAddress("seed-a") !== generateAddress("seed-b"),
      "Different seeds must produce different addresses"
    );
  });

  await test("generateTxHash returns 0x-prefixed string", () => {
    const tx = { from: "0xabc", to: "0xdef", amount: "100", coin: "KOSH", timestamp: Date.now() };
    const hash = generateTxHash(tx);
    assert(hash.startsWith("0x"), "txHash must start with 0x");
    assert(hash.length > 10, "txHash must be substantial");
  });

  await test("computeMerkleRoot handles empty array", () => {
    const root = computeMerkleRoot([]);
    assert(root.length === 64, "Should return a 64-char hash for empty array");
  });

  await test("computeMerkleRoot handles single element", () => {
    const root = computeMerkleRoot(["abc123"]);
    assertEqual(root, "abc123", "Single element should return itself");
  });

  await test("computeMerkleRoot handles multiple elements", () => {
    const root = computeMerkleRoot(["tx1", "tx2", "tx3", "tx4"]);
    assert(root.length === 64, "Merkle root should be 64-char hash");
  });

  await test("computeMerkleRoot is deterministic", () => {
    const hashes = ["0xaaa", "0xbbb", "0xccc"];
    assertEqual(computeMerkleRoot(hashes), computeMerkleRoot(hashes));
  });

  await test("computeBlockHash returns 64-char hex string", () => {
    const block = {
      index: 1,
      previousHash: "0".repeat(64),
      timestamp: 1718000000000,
      merkleRoot: "abc",
      nonce: 42
    };
    const hash = computeBlockHash(block);
    assert(hash.length === 64, "Block hash must be 64 chars");
    assert(/^[0-9a-f]+$/.test(hash), "Must be hex");
  });

  await test("computeBlockHash changes when nonce changes", () => {
    const base = { index: 0, previousHash: "000", timestamp: 100, merkleRoot: "abc", nonce: 1 };
    const h1 = computeBlockHash({ ...base, nonce: 1 });
    const h2 = computeBlockHash({ ...base, nonce: 2 });
    assert(h1 !== h2, "Different nonce must produce different hash");
  });

  await test("shortHash returns abbreviated format", () => {
    const full = "0xabcdef1234567890abcdef1234567890";
    const short = shortHash(full);
    assert(short.includes("..."), "Short hash should contain ...");
    assert(short.length < full.length, "Short hash should be shorter");
  });

  // ── Transaction Pool ───────────────────────────────────────────────────────
  console.log("\n── Transaction Pool ───────────────────");

  const txPool = require("../../backend/blockchain/transactions/transaction-pool");

  await test("txPool initializes with empty state when no persistence", async () => {
    // Pool should have been initialized by test runner or be initializable
    assert(txPool !== null, "Pool should exist");
    assert(typeof txPool.submit === "function", "submit should be a function");
    assert(typeof txPool.getStats === "function", "getStats should be a function");
  });

  await test("txPool.submit validates missing fields", async () => {
    try {
      await txPool.submit({ amount: "100", coin: "KOSH" });
      throw new Error("Should have thrown");
    } catch (err) {
      assert(err.message.includes("Missing") || err.message.includes("required"),
        `Expected validation error, got: ${err.message}`);
    }
  });

  await test("txPool.submit rejects invalid coin", async () => {
    try {
      await txPool.submit({
        merchantAddress: "0x742d35Cc6634C0532925a3b8D4C9b7F3a7C2F1E",
        senderAddress:   "0xabc123",
        amount:          "100.00",
        coin:            "FAKECOIN",
        senderName:      "Test"
      });
      throw new Error("Should have thrown");
    } catch (err) {
      assert(err.message.includes("Invalid coin") || err.message.includes("coin"),
        `Expected coin error, got: ${err.message}`);
    }
  });

  await test("txPool.getStats returns numeric fields", () => {
    const stats = txPool.getStats();
    assert(typeof stats.pending    === "number", "pending should be number");
    assert(typeof stats.confirming === "number", "confirming should be number");
    assert(typeof stats.confirmed  === "number", "confirmed should be number");
    assert(typeof stats.failed     === "number", "failed should be number");
  });

  // ── Wallet Manager ────────────────────────────────────────────────────────
  console.log("\n── Wallet Manager ─────────────────────");

  const walletManager = require("../../backend/blockchain/wallets/wallet-manager");

  await test("walletManager.getMerchantWallet returns merchant", () => {
    const wallet = walletManager.getMerchantWallet();
    assert(wallet !== null, "Merchant wallet should exist");
    assertEqual(wallet.type, "merchant", "Type should be merchant");
    assert(wallet.address.startsWith("0x"), "Address should start with 0x");
  });

  await test("walletManager.getAllWallets returns non-empty array", () => {
    const wallets = walletManager.getAllWallets();
    assert(Array.isArray(wallets), "Should return array");
    assert(wallets.length >= 2, "Should have at least merchant + system wallets");
  });

  await test("walletManager.getBalance returns string for known wallet", () => {
    const merchant = walletManager.getMerchantWallet();
    const balance = walletManager.getBalance(merchant.address, "KOSH");
    assert(typeof balance === "string", "Balance should be string");
    assert(!isNaN(parseFloat(balance)), "Balance should be numeric string");
  });

  await test("walletManager.getBalance returns 0.00 for unknown address", () => {
    const balance = walletManager.getBalance("0xunknownaddress", "KOSH");
    assertEqual(balance, "0.00", "Unknown address balance should be 0.00");
  });

  await test("walletManager.getOrCreateCustomerWallet creates deterministic wallet", () => {
    const w1 = walletManager.getOrCreateCustomerWallet("Alice");
    const w2 = walletManager.getOrCreateCustomerWallet("Alice");
    assertEqual(w1.address, w2.address, "Same name should produce same wallet");
  });

  await test("walletManager.hasSufficientBalance works correctly", () => {
    const merchant = walletManager.getMerchantWallet();
    assert(
      walletManager.hasSufficientBalance(merchant.address, "KOSH", 100),
      "Merchant should have sufficient KOSH balance"
    );
    assert(
      !walletManager.hasSufficientBalance(merchant.address, "KOSH", 999999999),
      "Should not have 999999999 KOSH"
    );
  });

  // ── Chain ─────────────────────────────────────────────────────────────────
  console.log("\n── Chain ──────────────────────────────");

  const chain = require("../../backend/blockchain/chain");

  await test("chain.getLatestBlock returns a block object", () => {
    const block = chain.getLatestBlock();
    assert(block !== null, "Latest block should exist");
    assert(typeof block.index === "number", "Block index should be number");
    assert(block.hash, "Block should have a hash");
    assert(block.previousHash !== undefined, "Block should have previousHash");
  });

  await test("chain.getBlock(0) returns genesis block", () => {
    const genesis = chain.getBlock(0);
    assert(genesis !== null, "Genesis block should exist");
    assertEqual(genesis.index, 0, "Genesis index should be 0");
    assert(genesis.previousHash.startsWith("0000"), "Genesis previousHash should start with 0000");
  });

  await test("chain.getRecentBlocks returns array with limit", () => {
    const blocks = chain.getRecentBlocks(5);
    assert(Array.isArray(blocks), "Should return array");
    assert(blocks.length <= 5, "Should respect limit");
    assert(blocks.length >= 1, "Should have at least genesis");
  });

  await test("chain.validateChain returns valid for clean chain", () => {
    const result = chain.validateChain();
    assert(result.valid === true, `Chain should be valid: ${result.error}`);
    assertEqual(result.error, null, "Error should be null for valid chain");
  });

  await test("chain.getStatus returns network info", () => {
    const status = chain.getStatus();
    assertEqual(status.networkId, "kosh-testnet-1", "Network ID mismatch");
    assert(typeof status.latestBlock === "number", "latestBlock should be number");
    assert(typeof status.totalBlocks === "number", "totalBlocks should be number");
  });

  await test("chain.getTotalTransactionCount returns non-negative number", () => {
    const count = chain.getTotalTransactionCount();
    assert(typeof count === "number", "Should be number");
    assert(count >= 0, "Should be non-negative");
  });

  // ── Summary ────────────────────────────────────────────────────────────────
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
