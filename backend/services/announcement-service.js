/**
 * KoshBox — Announcement Service
 * Builds structured announcement sequences for the audio engine.
 * Returns ordered arrays of segments (static phrase keys + dynamic text).
 * The frontend audio-engine.js executes these sequences.
 */

"use strict";

/**
 * Announcement phrase keys mapped to language strings.
 * Static phrases correspond to pre-recorded MP3 files in /frontend/assets/audio/.
 * Naming convention: {key}_{lang}.mp3  e.g. payment_received_en.mp3
 */
const PHRASES = {
  en: {
    payment_received:    "Payment received",
    amount_of:           "Amount of",
    received_from:       "Received from",
    rupees:              "rupees",
    network_connected:   "Network connected",
    network_disconnected:"Network disconnected",
    power_on:            "KoshBox powered on",
    power_off:           "KoshBox powered off",
    low_battery:         "Low battery. Please charge your device.",
    critical_battery:    "Critical battery. Device will sleep soon.",
    qr_rotated:          "QR code updated",
    device_ready:        "Device ready",
    transaction_failed:  "Transaction failed. Please try again."
  },
  hi: {
    payment_received:    "Bhugtan prapt hua",
    amount_of:           "Rashi",
    received_from:       "Prapt karta",
    rupees:              "rupaye",
    network_connected:   "Network jud gaya",
    network_disconnected:"Network cut gaya",
    power_on:            "KoshBox chalu ho gaya",
    power_off:           "KoshBox band ho raha hai",
    low_battery:         "Battery kam hai. Kripya charge karein.",
    critical_battery:    "Battery bahut kam hai. Device jald so jayega.",
    qr_rotated:          "QR code badal gaya",
    device_ready:        "Device taiyar hai",
    transaction_failed:  "Bhugtan asafal. Kripya dobara koshish karein."
  }
};

class AnnouncementService {
  /**
   * Build a payment announcement sequence for a confirmed transaction.
   * Returns an ordered array of segments for the audio engine.
   *
   * English example: "Payment received. Amount of [250] rupees. Received from [Rahul]."
   * Hindi example:   "Bhugtan prapt hua. Rashi [250] rupaye. Prapt karta [Rahul]."
   *
   * @param {object} tx - confirmed transaction
   * @param {string} language - "en" | "hi"
   * @returns {object[]} announcement segments
   */
  buildPaymentAnnouncement(tx, language = "en") {
    const lang = PHRASES[language] ? language : "en";

    return [
      { type: "static",  key: "payment_received", lang },
      { type: "static",  key: "amount_of",        lang },
      { type: "dynamic", text: tx.amount,          lang },
      { type: "static",  key: "rupees",            lang },
      { type: "static",  key: "received_from",     lang },
      { type: "dynamic", text: tx.senderName,      lang }
    ];
  }

  /**
   * Build a system event announcement sequence.
   * @param {string} eventKey - key from PHRASES
   * @param {string} language
   * @returns {object[]}
   */
  buildSystemAnnouncement(eventKey, language = "en") {
    const lang = PHRASES[language] ? language : "en";
    if (!PHRASES[lang][eventKey]) {
      console.warn(`[AnnouncementService] Unknown phrase key: ${eventKey}`);
      return [];
    }
    return [{ type: "static", key: eventKey, lang }];
  }

  /**
   * Get all phrase keys for a given language (used by audio engine to preload).
   * @param {string} language
   * @returns {string[]} array of MP3 file paths
   */
  getPhraseFilePaths(language = "en") {
    const lang = PHRASES[language] ? language : "en";
    return Object.keys(PHRASES[lang]).map(key => `/assets/audio/${key}_${lang}.mp3`);
  }

  /**
   * Get the text string for a phrase key (used for TTS fallback if MP3 missing).
   * @param {string} key
   * @param {string} language
   * @returns {string}
   */
  getPhraseText(key, language = "en") {
    const lang = PHRASES[language] ? language : "en";
    return PHRASES[lang][key] || key;
  }

  /**
   * Get all supported languages.
   * @returns {string[]}
   */
  getSupportedLanguages() {
    return Object.keys(PHRASES);
  }
}

// Export singleton
const announcementService = new AnnouncementService();
module.exports = announcementService;
