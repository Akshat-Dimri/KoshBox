/**
 * KoshBox — Reset Script
 * Resets the blockchain to genesis state.
 * Wallets are preserved. Only chain and txpool are cleared.
 * Run: npm run reset
 */

"use strict";

const persistence = require("../../backend/services/persistence-service");
const chain       = require("../../backend/blockchain/chain");
const txPool      = require("../../backend/blockchain/transactions/transaction-pool");

async function reset() {
  console.log("\n[Reset] Resetting KoshBox chain to genesis...\n");

  try {
    await persistence.ensureDataDir();

    // Reset chain to genesis
    await chain.init();
    await chain.reset();
    console.log("[Reset] Chain reset to genesis block");

    // Clear transaction pool
    await persistence.saveTxPool({ pending: [], confirming: [], confirmed: [], failed: [] });
    console.log("[Reset] Transaction pool cleared");

    console.log("\n[Reset] Complete. Wallets preserved. Run: npm run dev\n");
  } catch (err) {
    console.error("[Reset] Failed:", err.message);
    process.exit(1);
  }
}

reset();
