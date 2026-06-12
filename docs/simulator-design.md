# KoshBox — Simulator Design

## Overview

This document describes the internal design of the KoshBox simulator: how the frontend components are structured, how state flows between them, and how the system achieves realistic device behaviour using only Vanilla JS.

---

## Design Principles

1. **No frameworks** — Vanilla JS + HTML + CSS. Every interaction is a direct DOM manipulation or event dispatch. This keeps the codebase readable by any engineer regardless of framework familiarity.

2. **State first** — All simulator state lives in `state.js`. Components never hold state internally except for transient UI state (animation frames, timeout handles). This makes the demo sequencer reliable — it can inject state changes and trust that all components will react correctly.

3. **Event-driven communication** — Components communicate via `CustomEvent` dispatched on `document`. No direct function calls between sibling components. This preserves modularity and makes it easy to add new components that respond to existing events.

4. **Offline-capable** — The `api-client.js` layer makes every backend call optional. The simulator degrades gracefully when no backend is running.

5. **Hardware fidelity over visual complexity** — Interactions mimic real device behaviour (boot sequences, sleep modes, battery drain) rather than prioritising visual effects.

---

## State Schema

`frontend/scripts/state.js` exports a single `SimulatorState` object:

```js
{
  device: {
    power: "off",           // off | booting | on | sleep | shutdown
    battery: 85,            // 0–100
    batteryCharging: false,
    network: "disconnected", // disconnected | connecting | connected | weak | reconnecting
    volume: 70,             // 0–100
    muted: false,
    language: "en",         // en | hi
    uptime: 0,              // seconds since boot
    lastPayment: null       // timestamp of last payment
  },
  qr: {
    mode: "fixed",          // fixed | dynamic
    rotationInterval: 3600000,
    lastRotated: null,
    currentData: null,      // QR payload string
    merchantAddress: null
  },
  blockchain: {
    status: "offline",      // offline | syncing | synced
    latestBlock: 0,
    pendingCount: 0,
    networkId: "kosh-testnet-1"
  },
  transactions: [],         // Array of TransactionRecord
  ui: {
    explodedViewOpen: false,
    firmwareEditorOpen: false,
    activeModal: null,
    demoActive: false
  }
}
```

### TransactionRecord

```js
{
  txHash: "0xab12...",
  amount: "150.00",
  coin: "KOSH",
  senderName: "Rahul",
  senderAddress: "0xabc...",
  merchantAddress: "0x742d...",
  status: "pending",        // pending | confirming | confirmed | failed
  timestamp: 1718000000000,
  blockIndex: null,
  confirmations: 0,
  announced: false
}
```

---

## Event System

Components fire and listen to events on `document`:

### Events Fired

| Event | Fired by | Payload |
|---|---|---|
| `koshbox:power-on` | `device.js` | `{}` |
| `koshbox:power-off` | `device.js` | `{}` |
| `koshbox:sleep` | `device.js` | `{}` |
| `koshbox:wake` | `device.js` | `{}` |
| `koshbox:network-change` | `network.js` | `{ status }` |
| `koshbox:battery-update` | `battery.js` | `{ level, charging }` |
| `koshbox:transaction-pending` | `transaction.js` | `{ tx }` |
| `koshbox:transaction-confirmed` | `transaction.js` | `{ tx }` |
| `koshbox:qr-rotated` | `qr-module.js` | `{ data }` |
| `koshbox:announce` | `audio-engine.js` | `{ text, lang }` |
| `koshbox:volume-change` | `device.js` | `{ volume, muted }` |
| `koshbox:language-change` | `device.js` | `{ language }` |
| `koshbox:demo-step` | `demo.js` | `{ step, action }` |

### Listening Pattern

```js
document.addEventListener("koshbox:transaction-confirmed", (e) => {
  const { tx } = e.detail;
  audioEngine.announcePayment(tx);
  updateTransactionHistory(tx);
});
```

---

## Device State Machine

```
                    ┌──────────┐
              ┌────▶│   OFF    │◀────┐
              │     └────┬─────┘     │
              │          │ powerOn() │
              │          ▼           │
              │     ┌──────────┐     │
              │     │ BOOTING  │     │ shutdown
              │     └────┬─────┘     │ complete
              │          │ boot      │
              │          │ complete  │
              │          ▼           │
              │     ┌──────────┐     │
              │     │   IDLE   │─────┤
              │     └────┬─────┘     │
              │          │           │
              │   activity│          │
              │          ▼           │
              │     ┌──────────┐     │
              │     │  ACTIVE  │     │ powerOff()
              │     └────┬─────┘     │
              │          │           │
              │  inactivity│         │
              │   timeout │          │
              │          ▼           │
              │     ┌──────────┐     │
              │     │  SLEEP   │     │
              │     └────┬─────┘     │
              │          │ activity  │
              │          ▼           │
              │     ┌──────────┐     │
              │     │  WAKING  │─────┘
              │     └──────────┘
              │
              └── powerOff() from any state except OFF
                  → triggers SHUTDOWN → OFF
```

**Boot sequence (2.5 seconds):**
1. Screen flicker on (CSS animation)
2. Status LEDs cycle once
3. Audio: "Power on" announcement
4. Network module init → starts connecting
5. QR module init → renders merchant QR
6. State transitions to IDLE

**Shutdown sequence (1.5 seconds):**
1. Audio: "Power off" announcement
2. LEDs fade out
3. Screen fade
4. All timers cleared
5. State transitions to OFF

---

## Battery Simulation

Battery drain is calculated on a 10-second tick:

```js
function calculateDrain(state) {
  let drain = BASE_DRAIN; // 0.05% per minute → ~0.008% per 10s

  if (state.device.power === "on") drain += 0.015;
  if (state.device.network === "connected") drain += 0.008;
  if (state.device.network === "reconnecting") drain += 0.020;
  if (state.ui.explodedViewOpen) drain += 0.005;

  return drain;
}
```

Payment events add a fixed drain burst:
- Payment processing: +0.3%
- Audio announcement: +0.2%

Charging:
- If `batteryCharging === true`: +1% per 6 seconds
- Charging is toggled by "Charge" button in control panel

Low battery at 20%:
- Audio announcement fires once: "Low battery"
- BAT LED begins slow blink

Critical at 5%:
- Device enters forced sleep
- BAT LED fast blinks

---

## Network Simulation

Network state transitions and their triggers:

| From | To | Trigger | Delay |
|---|---|---|---|
| `disconnected` | `connecting` | Auto on boot, or manual reconnect | 0ms |
| `connecting` | `connected` | Simulated DHCP success | 2000–4000ms random |
| `connecting` | `disconnected` | Simulated failure (10% chance) | 4000ms |
| `connected` | `weak` | "Simulate Weak Signal" button | 0ms |
| `connected` | `disconnected` | "Simulate Network Failure" button | 0ms |
| `disconnected` | `connecting` | Automatic retry every 30 seconds | 30000ms |
| `weak` | `connected` | Auto-recover after 10–30 seconds | random |
| `weak` | `disconnected` | Escalation (20% chance) | random |

---

## QR Module

### Fixed QR
Encodes the merchant wallet address as a payment URL:
```
koshbox://pay?to=0x742d35Cc...&network=kosh-testnet-1
```

This URL, when scanned, opens `/pages/payment.html?to=0x742d35Cc...`.

### Dynamic QR
Encodes a session-specific payment URL:
```
koshbox://pay?to=0x742d35Cc...&session=abc123&expires=1718003600000
```

The session ID is regenerated on each rotation. The payment page validates that the session has not expired before allowing submission.

### Rotation Timer
Runs in the background when mode is `dynamic`. On rotation:
1. New session ID generated
2. New QR rendered to canvas
3. Subtle CSS fade transition on QR panel
4. `koshbox:qr-rotated` event dispatched
5. `state.qr.lastRotated` updated

---

## Audio Engine Pipeline

```
announcePayment(tx)
    │
    ▼
buildAnnouncementSequence(tx, language)
    │
    Returns array of segments:
    [
      { type: "static", key: "payment_received" },
      { type: "dynamic", text: "150" },
      { type: "static", key: "rupees" },
      { type: "static", key: "received_from" },
      { type: "dynamic", text: "Rahul" }
    ]
    │
    ▼
playSegmentQueue(segments)
    │
    ├── type === "static" → play preloaded Audio object
    │       wait for audio.onended
    │
    └── type === "dynamic" → window.speechSynthesis.speak(utterance)
            wait for utterance.onend
    │
    ▼ (all segments complete)
emit("koshbox:announce-complete")
```

Volume: All audio objects and utterances have their volume set from `state.device.volume / 100`.

Mute: If `state.device.muted === true`, all audio is created but immediately paused. The device behaves as if announcing (LED flashes, status indicator) but produces no sound.

---

## Exploded View

The exploded view is a pure CSS + SVG animation. No Three.js.

Opening sequence:
1. Overlay fades in (300ms)
2. Device shell splits vertically (400ms, CSS transform)
3. Components translate outward from center (600ms, staggered `animation-delay`)
4. Component labels fade in (200ms, after components settle)

Each component is a `<div>` with:
- A hardware-style top-down schematic SVG icon
- A label
- A click handler that opens the component detail panel

Component detail panel shows:
- Name and part number
- Function description
- Simulated live metrics (CPU%, battery voltage, signal strength, etc.)
- "Open Firmware" button (ESP32 component only)

Closing: reverse animation, 400ms.

---

## Demo Sequencer

`frontend/scripts/components/demo.js` defines the demo script as a static array:

```js
const DEMO_SCRIPT = [
  { delay: 0,    action: "POWER_ON" },
  { delay: 3000, action: "NETWORK_CONNECT" },
  { delay: 5000, action: "GENERATE_QR" },
  { delay: 6500, action: "INJECT_TX", payload: {
      amount: "250.00", coin: "KOSH", senderName: "Priya"
  }},
  { delay: 8000, action: "SHOW_PENDING" },
  { delay: 10000, action: "CONFIRM_TX" },
  { delay: 10500, action: "ANNOUNCE" },
  { delay: 12000, action: "UPDATE_HISTORY" },
  { delay: 13000, action: "UPDATE_BATTERY" },
  { delay: 15000, action: "SHOW_ANALYTICS" },
  { delay: 18000, action: "DEMO_COMPLETE" }
];
```

Each action calls the same public API that real user interactions use. The demo is not a special code path — it drives the exact same system.
