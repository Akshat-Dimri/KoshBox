# KoshBox — Setup Guide

## Requirements

- Node.js v18 or higher
- npm v9 or higher
- A modern browser (Chrome or Edge recommended for Web Speech API)

---

## First-Time Setup

```bash
# 1. Clone the repository
git clone https://github.com/Akshat-Dimri/KoshBox.git
cd KoshBox

# 2. Install dependencies
npm install

# 3. Seed the blockchain (creates wallets + genesis block)
npm run seed

# 4. Start the development server
npm run dev
```

Then open: **http://localhost:3000**

---

## Run Modes

### Full Stack (recommended)
```bash
npm run dev
```
Starts both the API server (port 3001) and frontend server (port 3000).

### Frontend Only (no backend needed)
```bash
npm run frontend
```
Opens the simulator in offline/mock mode. All features work without a backend.
Useful for presentations and demos on a laptop without running a server.

### Production
```bash
npm start
```
Starts the API server which also serves the frontend statically.
Open: **http://localhost:3001**

---

## Simulator Usage

### Power On the Device
Click **Power On** in the Control Center (right panel).
Watch the boot sequence on the device screen.

### Test a Payment
1. Click **Inject Test Transaction** — sends a mock payment directly
2. Or scan the QR code with your phone — opens the payment page
3. Fill in amount, name, and coin — submit
4. Watch the device screen flash and hear the announcement

### Demo Mode
Toggle **Demo Mode** in the Control Center.
A 15-second automated showcase runs through the complete payment lifecycle.

### Hardware Exploded View
**Double-click** the device body in the center panel.
Click any component to see specifications and live metrics.
Click **Edit ESP System Code** on the ESP32 component to open the firmware editor.

### Firmware Editor
Click **Open Firmware** in the Control Center, or double-click the device and select ESP32.
Edit `firmware/esp-runtime.js` in Monaco Editor.
Click **Apply to Simulator** — changes are sandboxed, not auto-deployed.

### Simulate Failures
- **Simulate Network Failure** — triggers disconnected state and reconnect sequence
- **Simulate Low Battery** — drops battery to 15%, triggers low battery announcement
- **Reset Device** — returns device to factory defaults

---

## Blockchain Tools

```bash
# Inject a test transaction via CLI
npm run generate:tx

# Reset chain to genesis (keeps wallets)
npm run reset

# Full reset (chain + wallets)
npm run seed
```

---

## Running Tests

```bash
# All tests
npm test

# Backend only (unit + API tests)
npm run test:backend

# Frontend logic tests
npm run test:frontend
```

> Note: `test:backend` API tests require the server to be running (`npm run dev` in another terminal).

---

## Project Structure Summary

```
KoshBox/
├── frontend/           ← Browser simulator (HTML + CSS + JS)
│   ├── index.html      ← Main simulator page
│   ├── styles/         ← All CSS (base, layout, device, QR, modals)
│   ├── scripts/        ← All JS components
│   └── pages/          ← payment.html, firmware.html
├── backend/            ← Express API + blockchain engine
│   ├── api/routes/     ← transactions, blockchain, device, merchant
│   ├── blockchain/     ← chain, block-builder, tx-pool, wallets
│   ├── services/       ← QR, announcements, persistence
│   └── simulator/      ← device-twin, network-simulator
├── firmware/           ← esp-runtime.js (simulated ESP32 firmware)
├── docs/               ← Architecture, blockchain design, roadmaps
├── tests/              ← Backend unit + API tests, frontend logic tests
├── tools/scripts/      ← seed, reset, generate-tx, dev-server
├── data/               ← JSON persistence (auto-created on first run)
└── server.js           ← Express entry point
```

---

## Troubleshooting

**QR code not rendering**
The simulator uses qrcode.js from CDN. Ensure you have internet access, or host the file locally at `frontend/assets/qrcode.min.js` and update the script tag in `index.html`.

**No audio announcements**
Web Speech API requires a secure context or localhost. Make sure you're opening via `http://localhost:3000` and not `file://`. Also check browser permissions for speech synthesis.

**Backend not connecting**
Run `npm run seed` first to initialize the data directory, then `npm run dev`.

**Port already in use**
Change `PORT` and `FRONTEND_PORT` in `.env` (copy from `.env.example`).
