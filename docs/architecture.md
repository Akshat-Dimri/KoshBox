# KoshBox — System Architecture

## Overview

KoshBox is structured as a monorepo containing a frontend simulator, a Node.js backend, a simulated blockchain engine, and a sandboxed firmware workspace. All components are designed so that real hardware deployment or migration to a live blockchain requires changes only at the integration boundary — not inside core business logic.

---

## High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        Browser (Simulator)                       │
│                                                                  │
│  ┌─────────────┐   ┌──────────────┐   ┌──────────────────────┐  │
│  │  LEFT PANEL │   │ CENTER PANEL │   │    RIGHT PANEL       │  │
│  │             │   │              │   │                      │  │
│  │  QR Module  │   │  Device Twin │   │  Control Center      │  │
│  │  - Fixed QR │   │  - Power     │   │  - Power controls    │  │
│  │  - Dynamic  │   │  - Battery   │   │  - Volume            │  │
│  │    QR       │   │  - Network   │   │  - Language          │  │
│  │             │   │  - Speaker   │   │  - Tx injection      │  │
│  └─────────────┘   └──────────────┘   │  - Demo mode         │  │
│                           │           │  - Firmware editor   │  │
│                    ┌──────┴──────┐    └──────────────────────┘  │
│                    │  Exploded   │                               │
│                    │  View Modal │                               │
│                    └─────────────┘                               │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │                   Core JS Layer                          │    │
│  │                                                          │    │
│  │  state.js      ← Global simulator state                  │    │
│  │  main.js       ← Bootstrap and event wiring             │    │
│  │  api-client.js ← HTTP wrapper with offline fallback     │    │
│  │                                                          │    │
│  │  Components:                                             │    │
│  │  device.js       → Device state machine                 │    │
│  │  qr-module.js    → QR generation, rotation timer        │    │
│  │  audio-engine.js → Hybrid TTS pipeline                  │    │
│  │  blockchain.js   → Frontend chain client                │    │
│  │  transaction.js  → Payment flow controller              │    │
│  │  battery.js      → Battery model                        │    │
│  │  network.js      → Network state machine                │    │
│  │  exploded.js     → Exploded view controller             │    │
│  │  demo.js         → Demo sequencer                       │    │
│  └──────────────────────────────────────────────────────────┘    │
│                             │                                    │
│                      fetch() / HTTP                              │
└──────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────▼────────────────────────────────────┐
│                    Express API Server (Node.js)                  │
│                                                                  │
│  Routes:                                                         │
│  POST /api/transactions/submit                                   │
│  GET  /api/transactions/history                                  │
│  GET  /api/blockchain/status                                     │
│  GET  /api/blockchain/blocks                                     │
│  POST /api/device/state                                          │
│  GET  /api/device/state                                          │
│  GET  /api/merchant/qr                                           │
│                                                                  │
│  Services:                                                       │
│  qr-service.js          → QR data generation                    │
│  announcement-service.js → Announcement text assembly           │
│  persistence-service.js  → JSON read/write                      │
│                                                                  │
│  Simulator:                                                      │
│  device-twin.js         → Server-side device state              │
│  network-simulator.js   → Network condition simulation          │
│                                                                  │
│  Blockchain:                                                     │
│  chain.js               → Main chain manager                    │
│  block-builder.js       → Block construction + hashing          │
│  transaction-pool.js    → Mempool management                    │
│  wallet-manager.js      → Address generation + balances         │
└──────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────▼──────────┐
                    │   JSON Storage     │
                    │                   │
                    │  data/chain.json   │
                    │  data/wallets.json │
                    │  data/txpool.json  │
                    │  data/device.json  │
                    └────────────────────┘
```

---

## Component Responsibilities

### Frontend: `state.js`

Central state store for the entire simulator. All components read from and write to this store. The state object contains:

- `device` — Power state, battery level, network status, volume, language
- `qr` — Current QR mode, rotation interval, last rotated timestamp
- `transactions` — Array of all transactions in this session
- `blockchain` — Latest block number, confirmation count, chain status
- `ui` — Panel visibility flags, modal open/closed, exploded view state
- `demo` — Whether demo mode is active, current step index

### Frontend: `api-client.js`

Wraps all `fetch()` calls to the backend. If the backend is unreachable (offline mode or frontend-only run), falls back to a local mock that simulates the same responses using in-memory state. This makes the simulator fully functional without a running backend for presentation use.

### Frontend: `device.js`

Implements a finite state machine with the following states:

```
OFF → BOOTING → IDLE → ACTIVE → SLEEP → WAKING → SHUTDOWN → OFF
```

Transitions are triggered by UI controls (power button), automatic inactivity timers, or demo mode commands. Each transition fires appropriate audio announcements and visual indicator changes.

### Frontend: `audio-engine.js`

Two-layer playback pipeline:

1. **Static layer** — Loads MP3 files for fixed phrases ("Payment received", "Network connected", etc.)
2. **Dynamic layer** — Uses `window.speechSynthesis` for variable content (amounts, names, coin types)
3. **Sequencer** — Queues static and dynamic segments in order, plays them in sequence with correct timing

### Frontend: `blockchain.js`

Client-side interface to the Kosh Testnet. In online mode, calls backend API. In offline mode, maintains a local mini-chain in memory. Exposes:

- `submitTransaction(tx)` — Submit a transaction
- `getStatus()` — Chain health
- `getRecentBlocks(n)` — Last n blocks
- `watchTransaction(hash, callback)` — Poll for confirmation

### Backend: `chain.js`

Core blockchain logic. Manages:

- The canonical chain array (in memory + persisted to JSON)
- Genesis block creation
- Block mining with configurable interval
- Transaction confirmation lifecycle
- Chain integrity verification (hash linking)

---

## Data Flow: Payment Transaction

```
1. Customer opens /pages/payment.html
   (URL contains merchant address and optional amount)

2. Customer fills form: amount, sender name, coin type
   → Frontend validates form

3. frontend/scripts/components/transaction.js
   → Calls api-client.js → POST /api/transactions/submit

4. backend/api/routes/transactions.js
   → Validates payload
   → Calls blockchain/transactions/transaction-pool.js
   → Adds to mempool
   → Returns { txHash, status: "pending" }

5. backend/blockchain/chain.js (block timer fires)
   → Picks transactions from mempool
   → Calls block-builder.js → builds block
   → Mines block (simulated delay)
   → Moves transactions to confirmed

6. frontend/scripts/components/transaction.js (polling watchTransaction)
   → Detects confirmed status
   → Updates state.js
   → Triggers audio-engine.js announcement
   → Triggers device.js payment animation
   → Triggers QR module refresh (if dynamic)

7. Right panel transaction history updates live
```

---

## Data Flow: Demo Mode

```
demo.js reads DEMO_SCRIPT constant (array of steps with timing)

Each step specifies:
- action: string identifier
- delay: ms to wait before this step
- payload: optional data

Supported actions:
- POWER_ON        → device.js.boot()
- NETWORK_CONNECT → network.js.connect()
- GENERATE_QR     → qr-module.js.regenerate()
- INJECT_TX       → transaction.js.submitDemo()
- ANNOUNCE        → audio-engine.js.play()
- UPDATE_BATTERY  → battery.js.setLevel()
- POWER_OFF       → device.js.shutdown()

Steps fire in sequence.
Each step waits its delay before executing.
Demo can be interrupted by user clicking Stop Demo.
```

---

## Offline Mode

When `api-client.js` fails to reach the backend (network error or 5xx), it switches to local mock mode. Mock responses are defined inline in `api-client.js` and replicate the exact API response shape. This ensures:

- The simulator works during presentations without a running server
- Frontend demos are fully self-contained
- The payment flow, blockchain simulation, and announcements all work

---

## State Persistence

Backend persists to JSON files under `/data/`:

| File | Contents |
|---|---|
| `data/chain.json` | Full blockchain: blocks array |
| `data/wallets.json` | Merchant and test wallets |
| `data/txpool.json` | Pending mempool transactions |
| `data/device.json` | Last known device state |

On server restart, the chain is loaded from disk. A seed script initializes these files with genesis data.

---

## Security Considerations (Simulator Context)

KoshBox is a simulator. The following are intentional simplifications:

- No real private keys — wallet addresses are deterministic from seeds
- No real cryptographic signing — transactions use simulated signatures
- No authentication on the API — intended for local/demo use only
- Payment page is public — this is intentional for QR scan simulation

For real deployment, these points would need full cryptographic implementation.

---

## Performance Design

- No heavy frontend frameworks — Vanilla JS only
- No Three.js — CSS transforms for all 3D effects
- QR generation via qrcode.js — canvas-based, fast
- Audio preloaded on boot — no latency on first announcement
- Blockchain polling interval: 2 seconds (configurable)
- All CSS animations use `transform` and `opacity` only (GPU composited)
