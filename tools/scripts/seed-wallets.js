/**
 * KoshBox — Seed Script
 * Initializes the blockchain with genesis block and default wallets.
 * Run once before first use: npm run seed
 */

"use strict";

const persistence   = require("../../backend/services/persistence-service");
const chain         = require("../../backend/blockchain/chain");
const walletManager = require("../../backend/blockchain/wallets/wallet-manager");
const txPool        = require("../../backend/blockchain/transactions/transaction-pool");

async function seed() {
  console.log("\n[Seed] Starting KoshBox seed process...\n");

  try {
    await persistence.ensureDataDir();
    await persistence.clearAllData();
    console.log("[Seed] Cleared existing data");

    await chain.init();
    console.log(`[Seed] Genesis block created: ${chain.getLatestBlock().hash.substring(0, 16)}...`);

    await walletManager.init();
    const wallets = walletManager.getAllWallets();
    console.log(`[Seed] Created ${wallets.length} wallets:`);
    wallets.forEach(w => {
      console.log(`       [${w.type.padEnd(8)}] ${w.label.padEnd(20)} ${w.address}`);
    });

    await txPool.init();
    console.log("[Seed] Transaction pool initialized");

    console.log("\n[Seed] Complete. Run: npm run dev\n");
  } catch (err) {
    console.error("[Seed] Failed:", err.message);
    process.exit(1);
  }
}

seed();
