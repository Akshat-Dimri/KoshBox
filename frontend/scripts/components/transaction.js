/**
 * KoshBox — Transaction Controller (v2)
 * Manages payment flow: submit, poll for confirmation, trigger announcement.
 *
 * KEY FIX: Added a global backend poller that watches for ANY newly confirmed
 * transaction — including those injected from external apps (demo-app.html).
 * The simulator now announces payments regardless of which client submitted them.
 */

"use strict";

const TransactionController = (() => {

  const state = window.SimulatorState;
  const _pollingMap  = new Map();   // txHash → intervalId (local submissions)
  const _announcedSet = new Set();  // txHashes already announced this session

  // ── Init ──────────────────────────────────────────────────────────────────
  function init() {
    // Listen for confirmed transactions (local submissions)
    document.addEventListener("koshbox:transaction-confirmed", async (e) => {
      const { tx } = e.detail;
      if (!_announcedSet.has(tx.txHash)) {
        await _onConfirmed(tx);
      }
    });

    // ── Global backend poller ──────────────────────────────────────────────
    // Polls /api/transactions/history every 2s.
    // Catches transactions confirmed by ANY client (demo-app, curl, etc.)
    // This is what makes external payments trigger the soundbox announcement.
    _startGlobalPoller();

    DevConsole.log("Transaction controller ready", "info");
  }

  // ── Global Poller — catches external injections ───────────────────────────
  function _startGlobalPoller() {
    setInterval(async () => {
      // Only announce when device is on
      if (state.device.power !== "on") return;

      try {
        const res = await ApiClient.Transactions.history(20);
        if (!res.success || !res.transactions) return;

        for (const tx of res.transactions) {
          // Skip if already announced this session, not confirmed, or
          // already marked announced server-side (e.g. from a previous
          // session — without this check, every page reload would replay
          // audio for the entire payment history).
          if (_announcedSet.has(tx.txHash)) continue;
          if (tx.status !== "confirmed" && tx.status !== "finalized") continue;
          if (tx.announced) {
            _announcedSet.add(tx.txHash);
            state.addTransaction(tx);
            continue;
          }

          // New confirmed tx we haven't seen — trigger announcement
          state.addTransaction(tx);

          // Small random delay (2–5 seconds) before announcing
          // Makes it feel like the soundbox is processing, not instant
          const delay = 2000 + Math.random() * 3000;
          setTimeout(async () => {
            if (!_announcedSet.has(tx.txHash)) {
              await _onConfirmed(tx);
            }
          }, delay);
        }
      } catch (_) {
        // Polling failure — silent, keep trying
      }
    }, 2000);
  }

  // ── Inject Test Transaction ───────────────────────────────────────────────
  async function injectTest() {
    const names   = ["Rahul", "Priya", "Arjun", "Sneha", "Vikram", "Meera"];
    const amounts = ["75.00", "150.00", "250.00", "90.00", "500.00", "1200.00"];
    const coins   = ["KOSH", "KOSH", "KOSH", "USDT"];

    const payload = {
      senderName: names[Math.floor(Math.random() * names.length)],
      amount:     amounts[Math.floor(Math.random() * amounts.length)],
      coin:       coins[Math.floor(Math.random() * coins.length)]
    };

    DevConsole.log(`Injecting: ${payload.amount} ${payload.coin} from ${payload.senderName}`, "info");

    try {
      const res = await ApiClient.Transactions.inject(payload);
      if (!res.success) {
        DevConsole.log(`Inject failed: ${res.error}`, "error");
        return;
      }

      state.addTransaction({
        txHash:        res.txHash,
        amount:        payload.amount,
        coin:          payload.coin,
        senderName:    payload.senderName,
        status:        "pending",
        timestamp:     res.timestamp || Date.now(),
        blockIndex:    null,
        confirmations: 0
      });

      DevConsole.log(`Tx submitted: ${res.txHash.substring(0, 14)}...`, "success");

    } catch (err) {
      DevConsole.log(`Transaction error: ${err.message}`, "error");
    }
  }

  // ── Submit from Payment Page ──────────────────────────────────────────────
  async function submit(payload) {
    try {
      const res = await ApiClient.Transactions.submit(payload);
      if (!res.success) throw new Error(res.error);

      state.addTransaction({
        txHash:        res.txHash,
        amount:        payload.amount,
        coin:          payload.coin,
        senderName:    payload.senderName,
        status:        "pending",
        timestamp:     res.timestamp || Date.now(),
        blockIndex:    null,
        confirmations: 0
      });

      return { success: true, txHash: res.txHash };

    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // ── On Confirmed — fires for ALL confirmed transactions ───────────────────
  async function _onConfirmed(tx) {
    // Guard: mark announced immediately to prevent double-firing
    if (_announcedSet.has(tx.txHash)) return;
    _announcedSet.add(tx.txHash);

    DevConsole.log(
      `Announcing: ${tx.amount} ${tx.coin} from ${tx.senderName}`,
      "success"
    );

    // Update device payment count
    const total = state.device.totalPayments + 1;
    const vol   = (parseFloat(state.device.totalVolume) + parseFloat(tx.amount)).toFixed(2);
    state.update("device", {
      totalPayments: total,
      totalVolume:   vol,
      lastPaymentAt: tx.timestamp
    });

    // Battery drain
    BatterySimulator.applyEventDrain("payment");

    // Device screen flash
    DeviceController.flashPayment(tx);

    // Audio announcement
    await AudioEngine.announcePayment(tx);

    // Mark announced on backend
    try { await ApiClient.Transactions.markAnnounced(tx.txHash); } catch (_) {}

    // Update info strip
    const paymentsEl = document.getElementById("info-total-payments");
    if (paymentsEl) paymentsEl.textContent = state.device.totalPayments;
  }

  // ── Open History Modal ────────────────────────────────────────────────────
  async function openHistoryModal() {
    const tbody = document.getElementById("tx-history-body");
    if (!tbody) return;

    try {
      const res = await ApiClient.Transactions.all();
      if (res.success && res.transactions.length > 0) {
        res.transactions.forEach(tx => state.addTransaction(tx));
      }
    } catch (_) {}

    const all = state.transactions;

    if (all.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="color:var(--text-muted);text-align:center;padding:var(--space-4);">
            No transactions yet
          </td>
        </tr>`;
      return;
    }

    tbody.innerHTML = all.slice(0, 50).map(tx => {
      const statusClass =
        tx.status === "confirmed" || tx.status === "finalized" ? "status-confirmed" :
        tx.status === "pending"   || tx.status === "confirming" ? "status-pending" :
        "status-failed";

      const timeStr   = new Date(tx.timestamp).toLocaleTimeString("en-GB");
      const shortHash = tx.txHash
        ? `${tx.txHash.substring(0,6)}...${tx.txHash.slice(-4)}`
        : "—";
      const statusStr = tx.status === "finalized" ? "Confirmed" :
        tx.status.charAt(0).toUpperCase() + tx.status.slice(1);

      return `
        <tr>
          <td class="tx-hash-cell">${shortHash}</td>
          <td>${tx.senderName || "—"}</td>
          <td style="font-family:var(--font-mono);font-size:var(--text-xs);">${tx.coin} ${tx.amount}</td>
          <td class="${statusClass}" style="font-weight:600;font-size:var(--text-xs);">${statusStr}</td>
          <td style="color:var(--text-muted);font-size:var(--text-xs);">${timeStr}</td>
        </tr>`;
    }).join("");
  }

  // ── Public API ────────────────────────────────────────────────────────────
  return { init, injectTest, submit, openHistoryModal };

})();

window.TransactionController = TransactionController;
