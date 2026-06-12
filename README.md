# KoshBox

**Merchant Payment Infrastructure Simulator & Digital Twin Platform**

KoshBox is a fully interactive browser-based simulator that replicates the behaviour of a real-world merchant QR payment soundbox ecosystem. It demonstrates crypto-enabled payment flows, simulated blockchain confirmations, hardware twin visualization, and merchant-facing UX — all without requiring real hardware or real cryptocurrency.

---

## Purpose

| Use Case | Description |
|---|---|
| Technical Interviews | Demonstrate full-stack architecture, blockchain design, and embedded systems thinking |
| Recruiter Demonstrations | One-click demo mode that showcases the complete payment lifecycle |
| College Presentations | Visual hardware exploded view, firmware editor, and annotated blockchain |
| National Hackathons | Production-grade prototype with migration path to real hardware |
| Prototype Validation | Validate UX and flow assumptions before committing to hardware |
| Future Hardware Deployment | Architecture is designed to map 1:1 to real ESP32 deployment |

---

## Quick Start

### Prerequisites

- Node.js v18 or higher
- npm v9 or higher

### Installation

```bash
git clone https://github.com/yourorg/koshbox.git
cd koshbox
npm install
```

### Run (Development)

```bash
npm run dev
```

This starts:
- Backend API server on `http://localhost:3001`
- Frontend served on `http://localhost:3000`

### Run (Production)

```bash
npm run build
npm start
```

### Run (Frontend Only)

If you only want to explore the UI without a backend:

```bash
npm run frontend
```

The simulator will run in offline mode with all blockchain calls mocked locally.

---

## Project Structure

```
koshbox/
├── frontend/
│   ├── assets/
│   │   ├── audio/          # Static audio phrases (MP3)
│   │   └── images/         # Device icons, hardware diagrams
│   ├── styles/
│   │   ├── base.css         # Reset, variables, typography
│   │   ├── layout.css       # Three-column grid
│   │   ├── device.css       # Soundbox device visual
│   │   ├── qr.css           # QR panel styles
│   │   ├── controls.css     # Right panel controls
│   │   ├── exploded.css     # Hardware exploded view
│   │   └── modal.css        # Modals and overlays
│   ├── scripts/
│   │   ├── components/
│   │   │   ├── device.js        # Device state machine
│   │   │   ├── qr-module.js     # QR generation and rotation
│   │   │   ├── audio-engine.js  # Hybrid TTS pipeline
│   │   │   ├── blockchain.js    # Frontend blockchain client
│   │   │   ├── transaction.js   # Transaction flow controller
│   │   │   ├── battery.js       # Battery simulation
│   │   │   ├── network.js       # Network state simulation
│   │   │   ├── exploded.js      # Hardware exploded view
│   │   │   └── demo.js          # Demo mode sequencer
│   │   ├── api-client.js    # Backend API wrapper
│   │   ├── state.js         # Global simulator state
│   │   └── main.js          # Application entry point
│   ├── pages/
│   │   ├── payment.html     # Customer payment page
│   │   └── firmware.html    # Firmware editor workspace
│   └── index.html           # Main simulator page
├── backend/
│   ├── api/
│   │   └── routes/
│   │       ├── transactions.js
│   │       ├── blockchain.js
│   │       ├── device.js
│   │       └── merchant.js
│   ├── services/
│   │   ├── qr-service.js
│   │   ├── announcement-service.js
│   │   └── persistence-service.js
│   ├── simulator/
│   │   ├── device-twin.js
│   │   └── network-simulator.js
│   └── blockchain/
│       ├── chain.js
│       ├── wallets/
│       │   └── wallet-manager.js
│       ├── transactions/
│       │   └── transaction-pool.js
│       └── blocks/
│           └── block-builder.js
├── firmware/
│   └── esp-runtime.js       # Simulated ESP32 firmware
├── docs/
│   ├── architecture.md
│   ├── blockchain-design.md
│   ├── hardware-mapping.md
│   ├── simulator-design.md
│   ├── esp32-roadmap.md
│   └── polygon-migration.md
├── tests/
│   ├── frontend/
│   │   └── transaction-flow.test.js
│   └── backend/
│       ├── blockchain.test.js
│       └── api.test.js
├── tools/
│   └── scripts/
│       ├── seed-wallets.js
│       ├── generate-test-tx.js
│       └── reset-chain.js
├── package.json
├── server.js
└── README.md
```

---

## Features

### Device Simulation
- Full power lifecycle: boot sequence, idle, sleep, wake, shutdown
- Battery drain model driven by real usage events
- Network state machine: connected, disconnected, weak signal, reconnecting
- Volume control with per-language announcement support

### QR System
- **Fixed Merchant QR** — Permanent address-based QR code
- **Dynamic QR** — Rotates on configurable interval (30min to 24h)
- Hardware-perspective display mounted on device frame

### Payment Flow
1. Customer opens payment URL from QR scan
2. Enters amount, sender name, and coin type
3. Transaction submitted to Kosh Testnet
4. Pending → confirming → confirmed state transitions
5. Soundbox announces payment in selected language
6. Merchant dashboard updates in real time

### Kosh Testnet
- Simulated blockchain: wallets, addresses, transactions, blocks
- SHA-256 based block hashing
- Architecture-compatible with future Polygon Amoy migration

### Audio Engine
- Static MP3 phrases for common announcements
- Dynamic values (amount, name, coin) via Web Speech API
- Seamless pipeline combining both sources
- English and Hindi language support

### Hardware Exploded View
- Double-click device to open animated exploded view
- Components: ESP32, Battery, Speaker, WiFi Module, Amplifier, Power Circuit, QR Display
- Each component is clickable — shows specs, purpose, live simulated metrics

### Firmware Editor
- Monaco Editor embedded via iframe
- Edits `firmware/esp-runtime.js`
- Changes stay sandboxed — do not auto-deploy

### Demo Mode
- One-click fully automated showcase
- Walks through complete payment lifecycle in 10–20 seconds
- Replayable, smooth, no jitter

---

## Scripts Reference

| Command | Description |
|---|---|
| `npm run dev` | Start both frontend and backend in development mode |
| `npm start` | Start production server |
| `npm run frontend` | Serve frontend only (offline mode) |
| `npm run seed` | Seed the blockchain with test wallets and genesis block |
| `npm run reset` | Reset chain state to genesis |
| `npm run test` | Run all tests |
| `npm run test:backend` | Run backend tests only |
| `npm run test:frontend` | Run frontend tests only |
| `npm run generate:tx` | Inject a test transaction into the simulator |

---

## Configuration

All runtime configuration lives in `backend/config.js`:

```js
{
  port: 3001,
  blockchain: {
    networkId: "kosh-testnet-1",
    blockTime: 3000,        // ms between block confirmations
    confirmationsRequired: 2
  },
  device: {
    batteryDrainRate: 0.1,  // % per minute at idle
    defaultLanguage: "en",
    defaultVolume: 70
  },
  qr: {
    defaultRotationInterval: 3600000  // 1 hour in ms
  }
}
```

---

## Architecture Overview

See [`docs/architecture.md`](docs/architecture.md) for the full system design.

**Summary:**

```
Browser (Simulator UI)
    │
    ├── Device State Machine (JS)
    ├── QR Module (JS + qrcode.js)
    ├── Audio Engine (JS + Web Speech API)
    ├── Blockchain Client (JS)
    │
    └── HTTP API (fetch)
          │
          └── Express Server (Node.js)
                │
                ├── Kosh Testnet (simulated blockchain)
                ├── Device Twin (state management)
                ├── QR Service
                └── Persistence (JSON files)
```

---

## License

MIT — See LICENSE for details.
