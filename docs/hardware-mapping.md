# KoshBox — Hardware Mapping

## Overview

The KoshBox simulator maps each software component to a real physical hardware component. This document defines that mapping to support future real hardware deployment and to aid understanding of the exploded view visualization.

---

## Device Summary

The simulated device is based on a compact merchant soundbox form factor (120mm × 80mm × 40mm), designed for counter placement in retail environments.

```
┌──────────────────────────────────────┐
│              KoshBox                 │
│                                      │
│  [QR DISPLAY]    [STATUS LEDS]       │
│                                      │
│  ████████████    ● PWR               │
│  ████████████    ● NET               │
│  ████████████    ● PAY               │
│  ████████████    ● BAT               │
│                                      │
│  ─────────────────────────────────   │
│  [SPEAKER GRILLE]                    │
│                                      │
└──────────────────────────────────────┘
           [USB-C PORT]  [RESET]
```

---

## Component Map

### 1. ESP32-S3 (Main Controller)

| Property | Value |
|---|---|
| Simulated by | `firmware/esp-runtime.js` |
| Real part | ESP32-S3-WROOM-1 |
| Function | Main MCU — handles WiFi, BLE, payment logic, display, audio |
| Clock | 240 MHz (simulated as 60 FPS update loop) |
| Flash | 8 MB (simulated as JSON store) |
| RAM | 512 KB (simulated as JS heap) |
| Simulator metric | CPU load %, memory usage % |

**Simulated behaviour:**
The ESP32 state is managed in `firmware/esp-runtime.js`. The firmware editor allows modification of this file. Changes to the file affect how the simulator processes payments, handles power states, and generates announcements — mirroring what real firmware changes would do.

---

### 2. Battery (Li-ion 3.7V 2000mAh)

| Property | Value |
|---|---|
| Simulated by | `frontend/scripts/components/battery.js` |
| Real part | 18650 Li-ion cell, 2000mAh |
| Function | Powers the device. Charges via USB-C. |
| Nominal voltage | 3.7V |
| Max charge | 4.2V |
| Low battery threshold | 20% |
| Critical threshold | 5% |

**Drain model (simulated):**

| Activity | Drain Rate |
|---|---|
| Idle | 0.05% per minute |
| Screen on | 0.15% per minute |
| Payment processing | 0.3% per event |
| Audio announcement | 0.2% per announcement |
| Network reconnect | 0.25% per event |

Charging rate: 1% per 6 seconds (simulated fast charge).

---

### 3. Speaker (Mono 8Ω 2W)

| Property | Value |
|---|---|
| Simulated by | `frontend/scripts/components/audio-engine.js` |
| Real part | 8Ω 2W mylar cone speaker |
| Function | Payment announcements, alerts, system sounds |
| Driver | PAM8403 class-D amplifier |
| Languages | English, Hindi (extensible) |

**Audio pipeline:**

Real device uses:
- Pre-recorded phrase audio files stored in ESP32 flash
- DFPlayer Mini module for MP3 playback of static phrases
- Real-time concatenation: static phrases + dynamically rendered numbers

Simulator uses:
- Local MP3 files for static phrases
- `window.speechSynthesis` for dynamic values
- JavaScript queue for sequenced playback

---

### 4. WiFi Module (ESP32 Internal)

| Property | Value |
|---|---|
| Simulated by | `frontend/scripts/components/network.js` |
| Real part | ESP32 internal 802.11 b/g/n |
| Function | Connects to merchant WiFi, polls blockchain node |
| Frequency | 2.4 GHz |
| Security | WPA2 (simulated as always-connected) |

**Network state machine:**

```
DISCONNECTED
    │
    ▼ (WiFi credentials available)
CONNECTING (2–4 second simulated delay)
    │
    ▼ (DHCP acquired)
CONNECTED
    │
    ├── WEAK_SIGNAL (simulated packet loss)
    │
    └── DISCONNECTED (simulated network failure)
```

---

### 5. QR Display Module (E-Ink / LCD)

| Property | Value |
|---|---|
| Simulated by | `frontend/scripts/components/qr-module.js` |
| Real part | 2.9" E-Ink display OR 2.4" TFT LCD |
| Function | Shows merchant QR code for customer scanning |
| Resolution | 296×128 (E-Ink) or 240×320 (LCD) |
| Refresh rate | E-Ink: 2s full refresh; LCD: 60fps |

**QR modes:**

- **Fixed** — Merchant wallet address encoded as QR. Never changes. Used for general payments.
- **Dynamic** — New QR generated at configurable interval. Encodes a time-limited payment session URL. Reduces replay attack surface.

---

### 6. Amplifier (PAM8403)

| Property | Value |
|---|---|
| Simulated by | Volume controls in `device.js` |
| Real part | PAM8403 stereo class-D amplifier |
| Function | Amplifies audio signal from ESP32 DAC to speaker |
| Power | 3W per channel at 4Ω |
| Input | 3.5mm line-in from ESP32 |
| Volume | Software-controlled via ESP32 GPIO |

---

### 7. Power Circuit (TP4056 + MT3608)

| Property | Value |
|---|---|
| Simulated by | `battery.js` charging/discharging logic |
| Real part | TP4056 Li-ion charger + MT3608 boost converter |
| Function | Manages USB-C charging, converts 3.7V to 5V system rail |
| Charge rate | 1A (USB-C input) |
| Output | 5V regulated |

---

## LED Indicators

| LED | Color | States |
|---|---|---|
| PWR | White | Off, Breathing (sleep), Solid (on) |
| NET | White | Off, Blinking (connecting), Solid (connected), Fast blink (weak) |
| PAY | White | Off, Flash (payment received), Solid hold (error) |
| BAT | White | Solid (normal), Slow blink (low), Fast blink (critical) |

In the simulator, these are represented as CSS-animated circles that replicate the same visual behaviour.

---

## Physical Dimensions

```
KoshBox Device
Width:  120mm
Height: 80mm
Depth:  40mm
Weight: ~180g (estimated with battery)

Counter footprint: 120mm × 80mm
Cable: USB-C, 1m
```

---

## Assembly Overview

```
EXPLODED VIEW (top-to-bottom layer order):

┌──────────────────────────────┐  ← Top shell (ABS plastic)
│    QR E-Ink Display          │  ← Glued to top shell interior
│    Status LED PCB            │  ← 4x LED + current limiters
├──────────────────────────────┤
│    Main PCB                  │
│    ├── ESP32-S3 module        │
│    ├── TP4056 charging IC     │
│    ├── MT3608 boost converter │
│    └── PAM8403 amplifier      │
├──────────────────────────────┤
│    Speaker                   │  ← 8Ω 2W, face-down grille
├──────────────────────────────┤
│    Li-ion Battery             │  ← 18650 cell with protection
└──────────────────────────────┘  ← Bottom shell (ABS plastic)
```

---

## Simulator-to-Hardware Fidelity

| Feature | Simulator | Real Device |
|---|---|---|
| Payment flow | Full simulation | Same, via blockchain node |
| Audio announcement | Web Speech + MP3 | DFPlayer + ESP32 DAC |
| QR display | HTML canvas | E-Ink refresh |
| Battery drain | Mathematical model | Real coulomb counting |
| Network states | Simulated delays | Real WiFi RSSI |
| Blockchain confirmations | Simulated 3s blocks | Real Polygon blocks (~2s) |
| Firmware editing | Monaco + sandbox | OTA flash via ArduinoOTA |
