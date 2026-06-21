/**
 * KoshBox — Main Server
 * Express API server entry point.
 * Initializes all backend services and starts the blockchain.
 */

"use strict";

const express = require("express");
const cors    = require("cors");
const path    = require("path");
const config  = require("./backend/config");

// ── Services ────────────────────────────────────────────────────────────────
const persistence    = require("./backend/services/persistence-service");
const chain          = require("./backend/blockchain/chain");
const txPool         = require("./backend/blockchain/transactions/transaction-pool");
const walletManager  = require("./backend/blockchain/wallets/wallet-manager");
const blockBuilder   = require("./backend/blockchain/blocks/block-builder");
const deviceTwin     = require("./backend/simulator/device-twin");
const networkSim     = require("./backend/simulator/network-simulator");

// ── Routes ──────────────────────────────────────────────────────────────────
const transactionRoutes = require("./backend/api/routes/transactions");
const blockchainRoutes  = require("./backend/api/routes/blockchain");
const deviceRoutes      = require("./backend/api/routes/device");
const merchantRoutes    = require("./backend/api/routes/merchant");

const app = express();

// ── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({ origin: config.server.corsOrigins }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend static files
app.use(express.static(path.join(__dirname, "frontend")));

// Request logger (development)
if (process.env.NODE_ENV !== "production") {
  app.use((req, res, next) => {
    if (req.path.startsWith("/api")) {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    }
    next();
  });
}

// ── API Routes ───────────────────────────────────────────────────────────────
app.use("/api/transactions", transactionRoutes);
app.use("/api/blockchain",   blockchainRoutes);
app.use("/api/device",       deviceRoutes);
app.use("/api/merchant",     merchantRoutes);

// ── Health Check ─────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({
    status:  "ok",
    service: "KoshBox API",
    version: "1.0.0",
    uptime:  process.uptime(),
    network: config.blockchain.networkId,
    time:    new Date().toISOString()
  });
});

// ── Frontend Fallback ────────────────────────────────────────────────────────
// Serve index.html for any non-API route (SPA fallback)
app.get("*", (req, res) => {
  if (!req.path.startsWith("/api")) {
    res.sendFile(path.join(__dirname, "frontend", "index.html"));
  } else {
    res.status(404).json({ success: false, error: "API endpoint not found" });
  }
});

// ── Error Handler ────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("[Server Error]", err.message);
  res.status(500).json({ success: false, error: "Internal server error" });
});

// ── Startup Sequence ─────────────────────────────────────────────────────────
async function startServer() {
  console.log("\n╔══════════════════════════════════════╗");
  console.log("║         KoshBox API Server           ║");
  console.log("╚══════════════════════════════════════╝\n");

  try {
    // Ensure data directory exists
    await persistence.ensureDataDir();

    // Initialize blockchain
    console.log("[Boot] Initializing Kosh Testnet...");
    await chain.init();

    // Initialize transaction pool
    console.log("[Boot] Initializing transaction pool...");
    await txPool.init();

    // Initialize wallet manager
    console.log("[Boot] Initializing wallet manager...");
    await walletManager.init();

    // Initialize device twin
    console.log("[Boot] Initializing device twin...");
    await deviceTwin.init();

    // Bind network simulator to device twin
    networkSim.bind(deviceTwin);

    // Wire up blockchain events to device twin
    txPool.on("tx:confirmed", async (tx) => {
      // Device twin tracks payment metrics
      // Announcement is triggered client-side via polling
      console.log(`[Event] Transaction confirmed: ${tx.txHash}`);
    });

    // Start block builder (mining timer)
    console.log("[Boot] Starting block builder...");
    blockBuilder.start(chain, txPool);

    // Start listening
    app.listen(config.server.port, () => {
      console.log(`\n[Ready] KoshBox API running at http://localhost:${config.server.port}`);
      console.log(`[Ready] Frontend at http://localhost:${config.server.port}`);
      console.log(`[Ready] Network: ${config.blockchain.networkId}`);
      console.log(`[Ready] Block time: ${config.blockchain.blockTime}ms\n`);
    });

  } catch (err) {
    console.error("[Boot] Fatal error during startup:", err);
    process.exit(1);
  }
}

// ── Graceful Shutdown ────────────────────────────────────────────────────────
process.on("SIGTERM", () => {
  console.log("\n[Shutdown] SIGTERM received — stopping block builder...");
  blockBuilder.stop();
  deviceTwin.destroy();
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("\n[Shutdown] SIGINT received — stopping block builder...");
  blockBuilder.stop();
  deviceTwin.destroy();
  process.exit(0);
});

startServer();
