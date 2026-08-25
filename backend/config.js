/**
 * KoshBox — Backend Configuration
 * All runtime configuration is defined here.
 * To migrate to Polygon, update the blockchain section and set rpcUrl + contractAddress.
 */

"use strict";

const config = {
  server: {
    port: process.env.PORT || 3001,
    frontendPort: process.env.FRONTEND_PORT || 3000,
    host: "localhost",
    corsOrigins: process.env.PUBLIC_URL
      ? ["http://localhost:3000", "http://127.0.0.1:3000", process.env.PUBLIC_URL]
      : ["http://localhost:3000", "http://127.0.0.1:3000"]
  },

  blockchain: {
    networkId: "kosh-testnet-1",
    chainId: 99991,
    currencySymbol: "KOSH",
    blockTime: 3000,              // ms between block mining attempts
    confirmationsRequired: 2,
    miningDelay: { min: 500, max: 1500 },  // simulated mining time range (ms)
    maxMempoolSize: 100,
    txExpiryMs: 300000,           // 5 minutes
    maxTxPerBlock: 10,
    genesisTimestamp: 1718000000000,

    // Future Polygon migration — set these when migrating:
    rpcUrl: null,                 // e.g. "https://rpc-amoy.polygon.technology"
    contractAddress: null,        // deployed KoshPayment.sol address
    merchantPrivateKey: process.env.MERCHANT_PRIVATE_KEY || null
  },

  device: {
    batteryDrainRateIdle: 0.008,    // % per 10-second tick at idle
    batteryDrainRateActive: 0.015,  // % per 10-second tick when screen active
    batteryDrainPerPayment: 0.3,    // % per payment event
    batteryDrainPerAnnouncement: 0.2,
    batteryDrainPerReconnect: 0.25,
    batteryChargeRate: 1.0,         // % per 6-second tick when charging
    batteryLowThreshold: 20,
    batteryCriticalThreshold: 5,
    defaultLanguage: "en",
    defaultVolume: 70,
    inactivityTimeoutMs: 60000,     // 1 minute before sleep
    bootDurationMs: 2500,
    shutdownDurationMs: 1500
  },

  qr: {
    defaultMode: "fixed",
    defaultRotationInterval: 3600000,  // 1 hour
    rotationIntervals: [
      { label: "30 Minutes", value: 1800000 },
      { label: "1 Hour",     value: 3600000 },
      { label: "3 Hours",    value: 10800000 },
      { label: "6 Hours",    value: 21600000 },
      { label: "12 Hours",   value: 43200000 },
      { label: "24 Hours",   value: 86400000 }
    ],
    // Set PUBLIC_URL once on your host (e.g. https://your-app.onrender.com) so
    // QR codes point at the real public site instead of localhost.
    paymentBaseUrl: `${process.env.PUBLIC_URL || "http://localhost:3000"}/pages/payment.html`,
    sessionExpiryBuffer: 300000  // 5 minute buffer before showing QR as expiring
  },

  network: {
    reconnectIntervalMs: 30000,
    connectDelayMin: 2000,
    connectDelayMax: 4000,
    connectFailureChance: 0.10,     // 10% chance of simulated connect failure
    weakSignalRecoveryMin: 10000,
    weakSignalRecoveryMax: 30000,
    weakSignalEscalationChance: 0.20
  },

  persistence: {
    dataDir: "./data",
    chainFile: "./data/chain.json",
    walletsFile: "./data/wallets.json",
    txPoolFile: "./data/txpool.json",
    deviceFile: "./data/device.json"
  },

  coins: {
    KOSH: { symbol: "KOSH", name: "Kosh Token", decimals: 2, type: "native" },
    ETH:  { symbol: "ETH",  name: "Ethereum",   decimals: 6, type: "evm-compatible" },
    MATIC:{ symbol: "MATIC",name: "Polygon",     decimals: 6, type: "evm-compatible" },
    USDT: { symbol: "USDT", name: "Tether USD",  decimals: 2, type: "stablecoin" }
  },

  merchant: {
    defaultName: "KoshBox Merchant",
    defaultAddress: "0x742d35Cc6634C0532925a3b8D4C9b7F3a7C2F1E",
    defaultSeed: "koshbox-merchant-seed-v1"
  }
};

module.exports = config;
