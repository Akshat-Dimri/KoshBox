# KoshBox — ESP32 Hardware Deployment Roadmap

## Overview

This document outlines the path from the current software simulator to a fully deployed physical KoshBox device running on real ESP32 hardware. The architecture was designed from day one to make this transition require minimal code changes.

---

## Phase 1: Simulator (Current)

- Browser-based digital twin
- No physical hardware required
- Full payment flow simulation
- Firmware editor (sandboxed)

---

## Phase 2: ESP32 Firmware Development

### Hardware Required
- ESP32-S3-DevKitC-1 development board
- USB-C breakout for power testing
- Breadboard speaker + PAM8403 amplifier module
- 2.9" Waveshare E-Ink display or 2.4" ILI9341 TFT
- 18650 Li-ion cell + TP4056 charging module

### Steps
1. Set up Arduino IDE with ESP32-S3 board support
2. Port `firmware/esp-runtime.js` logic to C++ (Arduino framework)
3. Implement WiFiManager for credential provisioning
4. Implement HTTPClient for blockchain API calls
5. Implement DFPlayer Mini library for static phrase playback
6. Implement ESP32 DAC for dynamic TTS (use Google TTS API or offline TTS model)
7. Implement display driver (GxEPD2 for E-Ink, TFT_eSPI for LCD)
8. Implement QR generation on-device (qrcode-generator library for Arduino)

---

## Phase 3: PCB Design

- Design PCB combining all modules (ESP32-S3 + TP4056 + MT3608 + PAM8403 + LED circuit)
- Use KiCad (open source) for schematic and layout
- Produce Gerber files for JLCPCB manufacturing
- Estimated cost per board: ₹800–₹1200 ($10–$15 USD)

---

## Phase 4: Enclosure

- Design enclosure in Fusion 360
- 3D print prototype in PLA
- Injection mold production units in ABS

---

## Phase 5: OTA Firmware Updates

- Implement ArduinoOTA or ESP-IDF OTA partition
- Firmware editor in KoshBox web app generates update bundle
- Device polls update endpoint on boot
- Update validated by SHA-256 checksum before flashing

---

## Firmware Function Mapping

| Simulator (`esp-runtime.js`) | Real ESP32 (C++) |
|---|---|
| `handlePayment(tx)` | `void handlePayment(Transaction tx)` |
| `announcePayment(tx)` | `void playAnnouncement(Transaction tx)` |
| `setVolume(level)` | `dfPlayer.volume(level / 10)` |
| `setLanguage(lang)` | `loadPhraseBank(lang)` |
| `refreshQR(data)` | `drawQRCode(display, data)` |
| `getBatteryLevel()` | `analogRead(BATTERY_PIN) / 4095.0 * 100` |
| `getNetworkStatus()` | `WiFi.status() == WL_CONNECTED` |
| `sleep()` | `esp_light_sleep_start()` |
| `wake()` | `esp_sleep_enable_gpio_wakeup()` |
