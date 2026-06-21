/**
 * KoshBox — Audio Engine (v3)
 *
 * Plays recorded voice sample files (.wav) instead of Web Speech API
 * wherever a sample exists. Falls back to TTS automatically when a
 * file is missing for a given event/language (so the app keeps working
 * while you're still recording samples).
 *
 * Folder layout expected:
 *   frontend/assets/audio/en/*.wav
 *   frontend/assets/audio/hi/*.wav
 *
 * Payment announcements are stitched from fixed recorded segments
 * plus TTS for the two variable parts (amount, sender name):
 *   payment_recieved.wav -> amount.wav -> TTS(amount) -> rupees.wav -> from.wav -> TTS(name)
 */

"use strict";

const AudioEngine = (() => {

  const state   = window.SimulatorState;
  let _muted    = false;
  let _language = "en";
  let _voices   = [];
  let _ready    = false;

  const AUDIO_BASE = "assets/audio";

  // ── File map ──────────────────────────────────────────────────────────────
  // Maps internal event keys (used elsewhere in the codebase) to the actual
  // .wav filenames sitting in assets/audio/<lang>/. Update here if you
  // rename files instead of touching the rest of the app.
  const AUDIO_FILES = {
    power_on:             "power_on.wav",
    power_off:            "power_off.wav",
    network_connected:    "network_connected.wav",
    network_disconnected: "network_disconnected.wav",
    low_battery:          "low_battery.wav",
    critical_battery:     "critical_battery.wav",
    qr_rotated:           "qr_update.wav",       // note: file is named qr_update
    device_ready:         "device_ready.wav",
    payment_received:     "payment_recieved.wav", // note: file is misspelled "recieved"
    amount_of:            "amount.wav",
    received_from:        "from.wav",
    rupees:               "rupees.wav"
  };

  // ── Fallback TTS phrase text (used only if a .wav file is missing) ─────────
  const PHRASE_TEXT = {
    en: {
      payment_received:     "Payment received",
      amount_of:            "Amount",
      received_from:        "from",
      rupees:               "rupees",
      network_connected:    "Network connected",
      network_disconnected: "Network disconnected",
      power_on:             "KoshBox is ready",
      power_off:            "Shutting down",
      low_battery:          "Low battery. Please charge.",
      critical_battery:     "Critical battery. Sleeping now.",
      qr_rotated:           "QR code updated",
      device_ready:         "Device ready"
    },
    hi: {
      payment_received:     "Bhugtan prapt hua",
      amount_of:            "Rashi",
      received_from:        "prapt karta",
      rupees:               "rupaye",
      network_connected:    "Network jud gaya",
      network_disconnected: "Network cut gaya",
      power_on:             "KoshBox taiyar hai",
      power_off:            "Band ho raha hai",
      low_battery:          "Battery kam hai, charge karein",
      critical_battery:     "Battery khatam. So raha hoon.",
      qr_rotated:           "QR code badal gaya",
      device_ready:         "Taiyar hai"
    }
  };

  // Cache of Audio() objects so repeat events don't re-fetch the file
  const _audioCache = {};

  // Serialization queue — different components (device, network, battery,
  // transactions) all trigger announcements independently and don't know
  // about each other, so without this, two events firing close together
  // (e.g. power_on + network_connected on boot) would play on top of each
  // other. Every public announce call is funneled through here so only
  // one clip/utterance plays at a time, in call order.
  let _queue = Promise.resolve();

  function _enqueue(fn) {
    const run = () => fn();
    _queue = _queue.then(run, run); // keep going even if a prior call errors
    return _queue;
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  function init() {
    _muted    = state.device.muted;
    _language = state.device.language;

    if (!window.speechSynthesis) {
      DevConsole.log("Web Speech API not available — TTS fallback disabled", "warn");
    } else {
      _voices = window.speechSynthesis.getVoices();
      if (_voices.length === 0) {
        window.speechSynthesis.addEventListener("voiceschanged", () => {
          _voices = window.speechSynthesis.getVoices();
          _ready  = true;
        }, { once: true });
      } else {
        _ready = true;
      }
    }

    DevConsole.log("Audio engine initialized (sample playback mode)", "info");
  }

  // ── Set Controls ──────────────────────────────────────────────────────────
  function setVolume(_level) {
    // Device volume control is reflected in the UI only.
    // Real hardware uses PAM8403 hardware volume control instead.
  }

  function setMute(muted) {
    _muted = muted;
    if (muted) {
      window.speechSynthesis && window.speechSynthesis.cancel();
      Object.values(_audioCache).forEach(a => { a.pause(); a.currentTime = 0; });
      _queue = Promise.resolve(); // drop anything queued up
    }
  }

  function setLanguage(lang) {
    _language = ["en", "hi"].includes(lang) ? lang : "en";
  }

  // ── Play a recorded sample, falling back to TTS if missing ─────────────────
  function _playSample(key, lang) {
    return new Promise((resolve) => {
      const filename = AUDIO_FILES[key];
      if (!filename) { resolve(); return; }

      const cacheKey = `${lang}/${filename}`;
      let audio = _audioCache[cacheKey];

      if (!audio) {
        audio = new Audio(`${AUDIO_BASE}/${lang}/${filename}`);
        _audioCache[cacheKey] = audio;
      } else {
        audio.currentTime = 0;
      }

      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        audio.removeEventListener("ended", finish);
        audio.removeEventListener("error", onError);
        resolve();
      };
      const onError = async () => {
        if (settled) return;
        settled = true;
        DevConsole.log(`Audio sample missing/failed: ${cacheKey} — falling back to TTS`, "warn");
        await _speakFallback(key, lang);
        resolve();
      };

      audio.addEventListener("ended", finish, { once: true });
      audio.addEventListener("error", onError, { once: true });

      audio.play().catch(onError);
    });
  }

  // ── Small gap between stitched clips ────────────────────────────────────
  function _pause(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  // ── Announce Payment ──────────────────────────────────────────────────────
  // Recorded segments for fixed phrases, TTS for the variable amount/name.
  function announcePayment(tx) {
    return _enqueue(async () => {
      if (_muted) return;

      const lang   = _language;
      const amount = parseFloat(tx.amount).toFixed(0);
      const name   = tx.senderName || "";

      await _playSample("payment_received", lang);
      await _pause(120);
      await _playSample("amount_of", lang);
      await _pause(80);
      await _speak(amount, lang);
      await _pause(80);
      await _playSample("rupees", lang);
      await _pause(120);
      await _playSample("received_from", lang);
      await _pause(80);
      await _speak(name, lang);

      BatterySimulator.applyEventDrain("announcement");
    });
  }

  // ── Announce System Event ─────────────────────────────────────────────────
  function announceSystem(eventKey) {
    return _enqueue(async () => {
      if (_muted) return;
      await _playSample(eventKey, _language);
    });
  }

  // ── TTS fallback for a whole event key (when its .wav is missing) ──────────
  function _speakFallback(key, lang) {
    const phrases = PHRASE_TEXT[lang] || PHRASE_TEXT.en;
    const text = phrases[key];
    if (!text) return Promise.resolve();
    return _speak(text, lang);
  }

  // ── Core TTS Speak (used for variable parts + fallback) ────────────────────
  function _speak(text, lang) {
    return new Promise((resolve) => {
      if (!window.speechSynthesis || !text) { resolve(); return; }

      window.speechSynthesis.cancel();

      setTimeout(() => {
        const utterance  = new SpeechSynthesisUtterance(text);
        utterance.volume = 1.0;
        utterance.rate   = 0.88;
        utterance.pitch  = 1.0;
        utterance.lang   = lang === "hi" ? "hi-IN" : "en-US";

        const voice = _findVoice(lang);
        if (voice) utterance.voice = voice;

        utterance.onend   = resolve;
        utterance.onerror = (e) => {
          DevConsole.log(`Speech error: ${e.error}`, "warn");
          resolve();
        };

        window.speechSynthesis.speak(utterance);
      }, 80);
    });
  }

  // ── Find Best Voice ───────────────────────────────────────────────────────
  function _findVoice(lang) {
    if (!_voices || !_voices.length) return null;

    if (lang === "hi") {
      return (
        _voices.find(v => v.lang === "hi-IN") ||
        _voices.find(v => v.lang.startsWith("hi")) ||
        null
      );
    }

    return (
      _voices.find(v => v.lang === "en-US" && !v.name.toLowerCase().includes("zira")) ||
      _voices.find(v => v.lang === "en-GB") ||
      _voices.find(v => v.lang === "en-AU") ||
      _voices.find(v => v.lang === "en-IN") ||
      _voices.find(v => v.lang.startsWith("en")) ||
      null
    );
  }

  // ── Public API ────────────────────────────────────────────────────────────
  return {
    init,
    setVolume,
    setMute,
    setLanguage,
    announcePayment,
    announceSystem
  };

})();

window.AudioEngine = AudioEngine;
