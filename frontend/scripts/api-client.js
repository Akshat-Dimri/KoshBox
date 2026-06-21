/**
 * KoshBox — API Client
 * Wraps all backend fetch() calls.
 * Falls back to local mock responses when backend is unreachable.
 * This makes the simulator fully functional without a running server.
 */

"use strict";

const ApiClient = (() => {

  const BASE_URL = "http://localhost:3001";
  let _isOnline = null;  // null = unknown, true = online, false = offline

  // ── Connectivity Check ────────────────────────────────────────────────────

  async function checkConnectivity() {
    try {
      const res = await fetch(`${BASE_URL}/api/health`, {
        signal: AbortSignal.timeout(2000)
      });
      _isOnline = res.ok;
    } catch (_) {
      _isOnline = false;
    }
    return _isOnline;
  }

  function isOnline() { return _isOnline === true; }

  // ── Core Request ──────────────────────────────────────────────────────────

  async function request(method, path, body = null) {
    if (_isOnline === null) await checkConnectivity();

    if (!_isOnline) {
      return _mockResponse(method, path, body);
    }

    try {
      const opts = {
        method,
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(5000)
      };
      if (body) opts.body = JSON.stringify(body);

      const res = await fetch(`${BASE_URL}${path}`, opts);
      const data = await res.json();
      return data;

    } catch (err) {
      console.warn(`[ApiClient] Request failed (${path}), switching to offline mode`);
      _isOnline = false;
      return _mockResponse(method, path, body);
    }
  }

  const get  = (path)        => request("GET",  path);
  const post = (path, body)  => request("POST", path, body);

  // ── API Methods ───────────────────────────────────────────────────────────

  const Transactions = {
    submit:        (data)     => post("/api/transactions/submit", data),
    inject:        (data)     => post("/api/transactions/inject", data),
    status:        (txHash)   => get(`/api/transactions/status/${txHash}`),
    history:       (limit=50) => get(`/api/transactions/history?limit=${limit}`),
    all:           ()         => get("/api/transactions/all"),
    stats:         ()         => get("/api/transactions/stats"),
    markAnnounced: (txHash)   => post(`/api/transactions/${txHash}/mark-announced`),
    announcement:  (txHash, lang) => get(`/api/transactions/announcement/${txHash}?lang=${lang}`)
  };

  const Blockchain = {
    status:    ()      => get("/api/blockchain/status"),
    blocks:    (n=10)  => get(`/api/blockchain/blocks?limit=${n}`),
    block:     (index) => get(`/api/blockchain/blocks/${index}`),
    validate:  ()      => get("/api/blockchain/validate"),
    wallets:   ()      => get("/api/blockchain/wallets")
  };

  const Device = {
    getState:          ()       => get("/api/device/state"),
    setState:          (patch)  => post("/api/device/state", patch),
    analytics:         ()       => get("/api/device/analytics"),
    network:           ()       => get("/api/device/network"),
    networkConnect:    ()       => post("/api/device/network/connect"),
    networkFailure:    ()       => post("/api/device/network/failure"),
    networkWeak:       ()       => post("/api/device/network/weak"),
    networkDisconnect: ()       => post("/api/device/network/disconnect"),
    setBattery:        (l, c)   => post("/api/device/battery", { level: l, charging: c }),
    simulateLowBattery:()       => post("/api/device/battery/simulate-low"),
    reset:             ()       => post("/api/device/reset"),
    announcement:      (key, lang) => get(`/api/device/announcements/${key}?lang=${lang}`)
  };

  const Merchant = {
    info:            ()           => get("/api/merchant/info"),
    fixedQR:         (address)    => get(`/api/merchant/qr/fixed?address=${address}`),
    dynamicQR:       (address, interval) => get(`/api/merchant/qr/dynamic?address=${address}&interval=${interval}`),
    validateSession: (sessionId)  => post("/api/merchant/qr/validate-session", { sessionId }),
    coins:           ()           => get("/api/merchant/coins")
  };

  // ── Mock Responses (offline mode) ────────────────────────────────────────

  let _mockTxCounter = 0;
  const _mockConfirmed = [];

  function _mockResponse(method, path, body) {
    const state = window.SimulatorState;

    // Health check
    if (path === "/api/health") {
      return { status: "ok", service: "KoshBox API (mock)" };
    }

    // Transaction submit / inject
    if (path.includes("/transactions/submit") || path.includes("/transactions/inject")) {
      const txHash = "0x" + Math.random().toString(16).substring(2).padEnd(64, "0");
      const tx = {
        txHash,
        from:       "0xMockCustomer",
        to:         state.qr.merchantAddress,
        amount:     body?.amount || "100.00",
        coin:       body?.coin || "KOSH",
        senderName: body?.senderName || "Demo",
        status:     "pending",
        timestamp:  Date.now(),
        blockIndex: null,
        confirmations: 0,
        announced:  false
      };
      _mockConfirmed.push(tx);

      // Auto-confirm after 3 seconds
      setTimeout(() => {
        tx.status = "confirmed";
        tx.blockIndex = ++_mockTxCounter;
        tx.confirmations = 2;
        state.addTransaction(tx);
        document.dispatchEvent(new CustomEvent("koshbox:transaction-confirmed", { detail: { tx } }));
      }, 3000);

      state.addTransaction(tx);
      return { success: true, txHash, status: "pending", timestamp: tx.timestamp, estimatedConfirmation: 3000 };
    }

    // Transaction status
    if (path.includes("/transactions/status/")) {
      const hash = path.split("/").pop();
      const tx = _mockConfirmed.find(t => t.txHash === hash);
      if (!tx) return { success: false, error: "Not found" };
      return { success: true, ...tx };
    }

    // Transaction history
    if (path.includes("/transactions/history")) {
      const confirmed = _mockConfirmed.filter(t => t.status === "confirmed" || t.status === "finalized");
      return { success: true, count: confirmed.length, transactions: confirmed.slice(0, 50) };
    }

    // Blockchain status
    if (path.includes("/blockchain/status")) {
      return {
        success: true,
        chain: {
          networkId: "kosh-testnet-1 (mock)",
          latestBlock: _mockTxCounter,
          pendingTransactions: 0,
          totalTransactions: _mockConfirmed.length,
          uptime: state.device.uptime * 1000
        }
      };
    }

    // Device state GET
    if (method === "GET" && path.includes("/device/state")) {
      return { success: true, device: { ...state.device } };
    }

    // Device state POST
    if (method === "POST" && path.includes("/device/state")) {
      state.update("device", body || {});
      return { success: true, device: { ...state.device } };
    }

    // Device battery simulate-low
    if (path.includes("/battery/simulate-low")) {
      state.update("device", { battery: 15 });
      return { success: true, level: 15 };
    }

    // Device battery set
    if (method === "POST" && path.includes("/device/battery")) {
      state.update("device", { battery: body?.level ?? state.device.battery, batteryCharging: !!body?.charging });
      return { success: true };
    }

    // Network operations
    if (path.includes("/network/failure")) {
      state.update("device", { network: "disconnected" });
      return { success: true };
    }
    if (path.includes("/network/connect")) {
      state.update("device", { network: "connecting" });
      setTimeout(() => {
        state.update("device", { network: "connected" });
        document.dispatchEvent(new CustomEvent("koshbox:network-change", { detail: { status: "connected" } }));
      }, 2500);
      return { success: true };
    }
    if (path.includes("/network/weak")) {
      state.update("device", { network: "weak" });
      return { success: true };
    }
    if (path.includes("/network/disconnect")) {
      state.update("device", { network: "disconnected" });
      return { success: true };
    }

    // Merchant info
    if (path.includes("/merchant/info")) {
      return {
        success: true,
        merchant: {
          name: "KoshBox Merchant",
          address: state.qr.merchantAddress,
          network: "kosh-testnet-1",
          balance: { KOSH: "10000.00" }
        }
      };
    }

    // QR payloads
    if (path.includes("/merchant/qr/fixed")) {
      return {
        success: true,
        mode: "fixed",
        payload: `http://localhost:3000/pages/payment.html?to=${state.qr.merchantAddress}&network=kosh-testnet-1&type=fixed`,
        merchantAddress: state.qr.merchantAddress
      };
    }
    if (path.includes("/merchant/qr/dynamic")) {
      const sessionId = Math.random().toString(16).substring(2, 18);
      const expiresAt = Date.now() + (state.qr.rotationInterval || 1800000) + 300000;
      return {
        success: true,
        mode: "dynamic",
        payload: `http://localhost:3000/pages/payment.html?to=${state.qr.merchantAddress}&session=${sessionId}&expires=${expiresAt}&type=dynamic`,
        sessionId,
        expiresAt
      };
    }

    // Device reset
    if (path.includes("/device/reset")) {
      state.update("device", { power: "off", network: "disconnected", volume: 70, muted: false, language: "en" });
      return { success: true };
    }

    // Mark announced
    if (path.includes("/mark-announced")) {
      return { success: true };
    }

    // Default fallback
    return { success: true, message: "Mock response" };
  }

  // ── Public API ────────────────────────────────────────────────────────────

  return {
    checkConnectivity,
    isOnline,
    Transactions,
    Blockchain,
    Device,
    Merchant
  };

})();

window.ApiClient = ApiClient;
