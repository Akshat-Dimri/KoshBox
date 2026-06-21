"use strict";

/* ════════════════════ API CLIENT ════════════════════ */
const KoshAPI = (() => {
  const BASE = "http://localhost:3001";
  async function req(method, path, body) {
    const opts = { method, headers: { "Content-Type": "application/json" } };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${BASE}${path}`, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  }
  return {
    merchantInfo:      ()              => req("GET", "/api/merchant/info"),
    coins:             ()              => req("GET", "/api/merchant/coins"),
    chainStatus:       ()              => req("GET", "/api/blockchain/status"),
    submit:            (body)          => req("POST", "/api/transactions/submit", body),
    inject:            (body)          => req("POST", "/api/transactions/inject", body),
    status:            (hash)          => req("GET", `/api/transactions/status/${hash}`),
    history:           (limit=50)      => req("GET", `/api/transactions/history?limit=${limit}`),
    all:               ()              => req("GET", "/api/transactions/all"),
  };
})();

/* ════════════════════ NAVIGATION ════════════════════ */
const Nav = (() => {
  let current = "screen-boot";
  function go(id) {
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    const el = document.getElementById(id);
    if (el) el.classList.add("active");
    current = id;
    window.scrollTo(0, 0);
  }
  function back(id) { go(id || "screen-home"); }
  return { go, back, current: () => current };
})();

/* ════════════════════ TOAST ════════════════════ */
function toast(msg, kind = "info") {
  const el = document.getElementById("toast");
  const dot = document.getElementById("toast-dot");
  const colors = { info: "var(--status-info)", ok: "var(--status-confirmed)", err: "var(--status-failed)" };
  dot.style.background = colors[kind] || colors.info;
  document.getElementById("toast-text").textContent = msg;
  el.classList.add("show");
  clearTimeout(window.__toastT);
  window.__toastT = setTimeout(() => el.classList.remove("show"), 2600);
}

/* ════════════════════ LOCAL IDENTITY ════════════════════ */
const Identity = (() => {
  let name = localStorage.getItem("koshpay_name") || "";
  let addr = localStorage.getItem("koshpay_addr") || "";
  function ensure() {
    if (!name) {
      name = "Customer " + Math.floor(1000 + Math.random() * 9000);
      localStorage.setItem("koshpay_name", name);
    }
    if (!addr) {
      addr = "0x" + Array.from({length: 40}, () => "0123456789abcdef"[Math.floor(Math.random()*16)]).join("");
      localStorage.setItem("koshpay_addr", addr);
    }
    return { name, addr };
  }
  return { ensure };
})();

/* ════════════════════ NEWS CAROUSEL ════════════════════ */
const NEWS = [
  { title: "What's a block confirmation?", body: "A transaction is considered final once a set number of new blocks are mined on top of it — making it tamper-resistant.", color: "purple", icon: "block" },
  { title: "NFC vs QR payments", body: "NFC taps exchange data over radio waves at a few centimetres; QR codes encode the same payment intent visually — KoshBox uses both.", color: "teal", icon: "nfc" },
  { title: "Why testnets exist", body: "Testnets like kosh-testnet-1 let developers simulate real transactions without risking real funds.", color: "amber", icon: "lab" },
  { title: "Gas-free on KoshChain", body: "KoshBox's simulated chain charges no gas fees, so the amount you send is exactly the amount the merchant receives.", color: "purple", icon: "spark" },
  { title: "Mempools, explained", body: "Before confirmation, every transaction waits in a pool of pending transfers called the mempool.", color: "teal", icon: "pool" },
  { title: "Dynamic QR sessions", body: "Some merchant QR codes rotate on a timer, generating a fresh session ID to prevent stale or reused codes.", color: "amber", icon: "qr" },
];
const NEWS_ICONS = {
  block: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/></svg>',
  nfc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 8a8 8 0 0 1 0 8M10 5a12 12 0 0 1 0 14M14 10a4 4 0 0 1 0 4"/></svg>',
  lab: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 2v7L4 19a1 1 0 0 0 1 2h14a1 1 0 0 0 1-2l-5-10V2M9 2h6"/></svg>',
  spark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z"/></svg>',
  pool: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M8 12h8M12 8v8"/></svg>',
  qr: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3zM18 18h3v3h-3z"/></svg>'
};
const NEWS_BG = { purple: "var(--accent-purple-l)", teal: "var(--accent-teal-l)", amber: "var(--accent-amber-l)" };
const NEWS_FG = { purple: "var(--accent-purple)", teal: "var(--accent-teal)", amber: "var(--accent-amber)" };

let newsIdx = 0, newsTimer = null;
function renderNews() {
  const item = NEWS[newsIdx];
  const art = document.getElementById("news-art");
  art.style.background = NEWS_BG[item.color];
  art.style.color = NEWS_FG[item.color];
  art.innerHTML = NEWS_ICONS[item.icon];
  document.getElementById("news-title").textContent = item.title;
  document.getElementById("news-body").textContent = item.body;
  const dots = document.getElementById("news-dots");
  dots.innerHTML = NEWS.map((_, i) => `<span class="${i === newsIdx ? "on" : ""}"></span>`).join("");
}
function startNewsCarousel() {
  renderNews();
  clearInterval(newsTimer);
  newsTimer = setInterval(() => { newsIdx = (newsIdx + 1) % NEWS.length; renderNews(); }, 5000);
}

/* ════════════════════ DEVLOGS ════════════════════ */
const DevLogs = (() => {
  let open = false, pollTimer = null;
  const feed = () => document.getElementById("devlogs-feed");
  function log(msg, cls = "log-info") {
    const f = feed();
    if (!f) return;
    const ts = new Date().toLocaleTimeString("en-US", { hour12: false });
    const div = document.createElement("div");
    div.className = cls;
    div.textContent = `[${ts}] ${msg}`;
    f.appendChild(div);
    f.scrollTop = f.scrollHeight;
    while (f.children.length > 200) f.removeChild(f.firstChild);
  }
  async function pollChain() {
    try {
      const res = await KoshAPI.chainStatus();
      document.getElementById("dl-chain").textContent = res.chain.networkId || "—";
      document.getElementById("dl-pending").textContent = res.chain.pendingTransactions ?? "—";
      document.getElementById("dl-block").textContent = res.chain.height ?? res.chain.latestBlock?.index ?? "—";
      log(`chain status ok · height=${res.chain.height ?? "?"} · pending=${res.chain.pendingTransactions}`, "log-net");
    } catch (e) {
      document.getElementById("dl-chain").textContent = "offline";
      log(`chain status fetch failed: ${e.message}`, "log-err");
    }
  }
  function show() {
    open = true;
    document.getElementById("news-banner").classList.add("hidden");
    document.getElementById("devlogs-panel").classList.add("show");
    document.getElementById("devlog-dot").style.display = "block";
    log("dev console attached", "log-ok");
    pollChain();
    pollTimer = setInterval(pollChain, 4000);
  }
  function hide() {
    open = false;
    document.getElementById("news-banner").classList.remove("hidden");
    document.getElementById("devlogs-panel").classList.remove("show");
    document.getElementById("devlog-dot").style.display = "none";
    clearInterval(pollTimer);
  }
  function toggle() { open ? hide() : show(); }
  return { log, toggle, show, hide, isOpen: () => open };
})();

/* ════════════════════ QR SCANNER ════════════════════ */
const Scanner = (() => {
  let stream = null, raf = null;
  const video = () => document.getElementById("scan-video");

  function parsePayload(text) {
    try {
      const url = new URL(text);
      const to = url.searchParams.get("to");
      const session = url.searchParams.get("session");
      if (to) return { address: to, session };
    } catch (_) { /* not a URL — try raw address */ }
    if (/^0x[a-fA-F0-9]{10,}$/.test(text.trim())) return { address: text.trim(), session: null };
    return null;
  }

  function showError(msg) {
    document.getElementById("scanner-error-text").textContent = msg;
    document.getElementById("scanner-error").style.display = "flex";
  }

  async function start() {
    document.getElementById("scanner-error").style.display = "none";
    DevLogs.log("camera: requesting permission…", "log-info");
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      const v = video();
      v.srcObject = stream;
      await v.play();
      DevLogs.log("camera: stream acquired, scanning…", "log-ok");
      tick();
    } catch (e) {
      DevLogs.log(`camera: ${e.message}`, "log-err");
      showError("Couldn't access the camera. You can still enter the address manually.");
    }
  }

  function tick() {
    const v = video();
    if (!v || v.readyState !== v.HAVE_ENOUGH_DATA) { raf = requestAnimationFrame(tick); return; }
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth; canvas.height = v.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = window.jsQR ? window.jsQR(img.data, img.width, img.height) : null;
    if (code && code.data) {
      const parsed = parsePayload(code.data);
      if (parsed) {
        DevLogs.log(`qr decoded → ${parsed.address}`, "log-tx");
        stop();
        document.getElementById("pay-address").value = parsed.address;
        document.getElementById("pay-title").textContent = "Pay Merchant";
        document.getElementById("pay-hint").textContent = parsed.session ? `Dynamic session: ${parsed.session.slice(0,18)}…` : "Fixed merchant address";
        Nav.go("screen-pay");
        return;
      }
    }
    raf = requestAnimationFrame(tick);
  }

  function stop() {
    cancelAnimationFrame(raf);
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
  }

  return { start, stop };
})();

/* ════════════════════ PAYMENT FLOW ════════════════════ */
async function runPayment({ address, amount, coin, sender, splitTag }) {
  Nav.go("screen-result");
  document.getElementById("result-headtitle").textContent = "Processing";
  document.getElementById("result-spinner").style.display = "block";
  document.getElementById("result-title").textContent = "Confirming on KoshChain…";
  document.getElementById("result-sub").textContent = "Broadcasting transaction to the mempool";
  document.getElementById("result-hash").style.display = "none";
  document.getElementById("result-actions").style.display = "none";
  document.querySelectorAll("#result-flow .checkmark, #result-flow .crossmark").forEach(n => n.remove());

  const id = Identity.ensure();
  const senderName = (sender && sender.trim()) || id.name;

  DevLogs.log(`submitting tx → to=${address} amount=${amount} ${coin}${splitTag ? " ["+splitTag+"]" : ""}`, "log-tx");

  try {
    const res = await KoshAPI.submit({
      merchantAddress: address,
      amount: parseFloat(amount).toFixed(2),
      coin,
      senderName: splitTag ? `${senderName} (${splitTag})` : senderName,
      senderAddress: id.addr
    });
    DevLogs.log(`tx accepted → hash=${res.txHash} status=${res.status}`, "log-ok");
    document.getElementById("result-hash").textContent = res.txHash;
    pollStatus(res.txHash);
  } catch (e) {
    DevLogs.log(`tx submit failed: ${e.message}`, "log-err");
    showResultFailure(e.message);
  }
}

async function pollStatus(hash, attempt = 0) {
  try {
    const res = await KoshAPI.status(hash);
    if (res.status === "confirmed") {
      DevLogs.log(`tx confirmed → block=${res.blockIndex} confirmations=${res.confirmations}`, "log-ok");
      showResultSuccess(res);
      return;
    }
    if (res.status === "failed") {
      DevLogs.log(`tx failed on-chain`, "log-err");
      showResultFailure("The transaction was rejected by the network.");
      return;
    }
    if (attempt > 12) { showResultSuccess(res, true); return; }
    document.getElementById("result-sub").textContent = `Status: ${res.status} · confirmations ${res.confirmations || 0}`;
    setTimeout(() => pollStatus(hash, attempt + 1), 1500);
  } catch (e) {
    if (attempt > 4) { showResultFailure("Lost connection while confirming."); return; }
    setTimeout(() => pollStatus(hash, attempt + 1), 1800);
  }
}

function showResultSuccess(tx, partial) {
  document.getElementById("result-spinner").style.display = "none";
  document.getElementById("result-headtitle").textContent = "Success";
  const check = document.createElement("div");
  check.className = "checkmark";
  check.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 13l4 4L19 7"/></svg>';
  document.getElementById("result-flow").insertBefore(check, document.getElementById("result-title"));
  document.getElementById("result-title").textContent = partial ? "Submitted — confirming" : "Payment Confirmed";
  document.getElementById("result-sub").textContent = partial
    ? "Still finalizing on-chain. It'll appear in history shortly."
    : `${tx.amount} ${tx.coin} sent successfully`;
  document.getElementById("result-hash").style.display = "block";
  document.getElementById("result-actions").style.display = "flex";
  toast("Payment confirmed", "ok");
}

function showResultFailure(msg) {
  document.getElementById("result-spinner").style.display = "none";
  document.getElementById("result-headtitle").textContent = "Failed";
  const cross = document.createElement("div");
  cross.className = "crossmark";
  cross.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>';
  document.getElementById("result-flow").insertBefore(cross, document.getElementById("result-title"));
  document.getElementById("result-title").textContent = "Payment Failed";
  document.getElementById("result-sub").textContent = msg;
  document.getElementById("result-actions").style.display = "flex";
  document.querySelector("#result-actions button[data-go]").style.display = "none";
  toast("Payment failed", "err");
}

/* ════════════════════ PAYMENT HISTORY ════════════════════ */
function txIcon(status) {
  if (status === "confirmed") return { cls: "status-confirmed", bg: "rgba(34,197,94,0.12)", fg: "var(--status-confirmed)", svg: '<path d="M5 13l4 4L19 7"/>' };
  if (status === "failed") return { cls: "status-failed", bg: "rgba(239,68,68,0.12)", fg: "var(--status-failed)", svg: '<path d="M18 6 6 18M6 6l12 12"/>' };
  if (status === "confirming") return { cls: "status-confirming", bg: "rgba(59,130,246,0.12)", fg: "var(--status-info)", svg: '<path d="M12 6v6l4 2"/><circle cx="12" cy="12" r="9"/>' };
  return { cls: "status-pending", bg: "rgba(245,158,11,0.12)", fg: "var(--status-pending)", svg: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>' };
}

async function loadHistory() {
  const body = document.getElementById("history-body");
  body.innerHTML = '<div class="empty-state"><p>Loading transactions…</p></div>';
  try {
    const res = await KoshAPI.all();
    const txs = (res.transactions || []).slice().sort((a,b) => b.timestamp - a.timestamp);
    document.getElementById("history-sub").textContent = `${txs.length} transaction${txs.length === 1 ? "" : "s"} on kosh-testnet-1`;
    if (!txs.length) {
      body.innerHTML = `<div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M12 7v5l3 3"/></svg>
        <p>No transactions yet. Make a payment to see it here.</p>
      </div>`;
      return;
    }
    body.innerHTML = txs.map(tx => {
      const ic = txIcon(tx.status);
      const date = new Date(tx.timestamp).toLocaleString("en-IN", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" });
      return `<div class="tx-item">
        <div class="tx-icon" style="background:${ic.bg};color:${ic.fg}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${ic.svg}</svg>
        </div>
        <div class="tx-mid">
          <div class="tx-name">${escapeHtml(tx.senderName || "Customer")}</div>
          <div class="tx-meta">${date} · ${(tx.txHash||"").slice(0,14)}…</div>
        </div>
        <div class="tx-amt">
          <b>${tx.amount} ${tx.coin}</b>
          <div class="tx-status ${ic.cls}">${tx.status}</div>
        </div>
      </div>`;
    }).join("");
  } catch (e) {
    body.innerHTML = `<div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v5M12 16h.01"/></svg>
      <p>Couldn't load history.<br>${escapeHtml(e.message)}</p>
    </div>`;
  }
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c])); }

/* ════════════════════ SPLIT PAYMENT ════════════════════ */
let splitCount = 3;
function renderSplit() {
  const total = parseFloat(document.getElementById("split-total").value) || 0;
  const coin = document.getElementById("split-coin").value;
  const share = total > 0 ? (total / splitCount) : 0;
  const list = document.getElementById("split-shares");
  if (total <= 0) { list.innerHTML = ""; return; }
  let rows = "";
  for (let i = 1; i <= splitCount; i++) {
    rows += `<div class="share-row"><span>${i === 1 ? "You" : "Person " + i}</span><span class="share-amt">${share.toFixed(2)} ${coin}</span></div>`;
  }
  list.innerHTML = rows;
}

/* ════════════════════ INIT & BINDINGS ════════════════════ */
function bindNav() {
  document.querySelectorAll("[data-go]").forEach(el => el.addEventListener("click", () => Nav.go(el.dataset.go)));
  document.querySelectorAll("[data-back]").forEach(el => el.addEventListener("click", () => Nav.back(el.dataset.back)));
}

function tickClock() {
  const el = document.getElementById("clock");
  if (el) el.textContent = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }).replace(/^0/, "");
}

async function loadIdentityAndBalance() {
  const id = Identity.ensure();
  document.getElementById("user-name").textContent = id.name;
  document.getElementById("user-addr").textContent = id.addr.slice(0, 8) + "…" + id.addr.slice(-6);
  document.getElementById("avatar-initial").textContent = id.name.charAt(0).toUpperCase();
  try {
    const res = await KoshAPI.merchantInfo();
    DevLogs.log(`merchant info loaded · ${res.merchant.name}`, "log-net");
  } catch (e) {
    DevLogs.log(`merchant info unavailable: ${e.message}`, "log-warn");
  }
  document.getElementById("balance-amount").innerHTML = `1,250.00<span>KOSH</span>`;
}

document.addEventListener("DOMContentLoaded", () => {
  bindNav();
  tickClock(); setInterval(tickClock, 30000);
  startNewsCarousel();
  loadIdentityAndBalance();

  // Boot → home
  setTimeout(() => Nav.go("screen-home"), 2200);

  // DevLogs toggles
  document.getElementById("btn-devlogs-toggle").addEventListener("click", () => DevLogs.toggle());
  document.getElementById("btn-devlogs-toggle-2").addEventListener("click", () => DevLogs.toggle());
  document.getElementById("btn-devlogs-close").addEventListener("click", () => DevLogs.hide());

  document.getElementById("btn-refresh-balance").addEventListener("click", () => {
    toast("Balance refreshed", "ok");
  });

  // Scan QR
  document.querySelectorAll('[data-go="screen-scan"]').forEach(el => el.addEventListener("click", () => {
    Nav.go("screen-scan");
    Scanner.start();
  }));
  document.getElementById("btn-manual-entry").addEventListener("click", () => {
    Scanner.stop();
    document.getElementById("pay-address").value = "";
    document.getElementById("pay-title").textContent = "Pay Merchant";
    document.getElementById("pay-hint").textContent = "";
    Nav.go("screen-pay");
  });
  document.getElementById("btn-manual-entry-2").addEventListener("click", () => {
    document.getElementById("pay-address").value = "";
    document.getElementById("pay-title").textContent = "Pay Merchant";
    Nav.go("screen-pay");
  });
  document.getElementById("btn-pay-back").addEventListener("click", () => { Scanner.stop(); Nav.go("screen-home"); });

  // Pay confirm
  document.getElementById("btn-pay-confirm").addEventListener("click", () => {
    const address = document.getElementById("pay-address").value.trim();
    const amount = document.getElementById("pay-amount").value;
    const coin = document.getElementById("pay-coin").value;
    const sender = document.getElementById("pay-sender").value;
    if (!address) return toast("Enter a recipient address", "err");
    if (!amount || parseFloat(amount) <= 0) return toast("Enter a valid amount", "err");
    runPayment({ address, amount, coin, sender });
  });

  // Send to address
  document.getElementById("btn-send-continue").addEventListener("click", () => {
    const address = document.getElementById("send-address").value.trim();
    const amount = document.getElementById("send-amount").value;
    if (!address) return toast("Enter a recipient address", "err");
    if (!amount || parseFloat(amount) <= 0) return toast("Enter a valid amount", "err");
    document.getElementById("pay-address").value = address;
    document.getElementById("pay-amount").value = amount;
    document.getElementById("pay-coin").value = document.getElementById("send-coin").value;
    document.getElementById("pay-sender").value = document.getElementById("send-sender").value;
    document.getElementById("pay-title").textContent = "Confirm Transfer";
    document.getElementById("pay-hint").textContent = "Direct wallet-to-wallet transfer";
    Nav.go("screen-pay");
  });

  // History
  document.querySelectorAll('[data-go="screen-history"]').forEach(el => el.addEventListener("click", loadHistory));
  document.getElementById("btn-history-refresh").addEventListener("click", loadHistory);

  // Split
  document.getElementById("split-count-grid").addEventListener("click", (e) => {
    const pill = e.target.closest(".split-pill");
    if (!pill) return;
    document.querySelectorAll(".split-pill").forEach(p => p.classList.remove("on"));
    pill.classList.add("on");
    splitCount = parseInt(pill.dataset.count);
    renderSplit();
  });
  document.getElementById("split-total").addEventListener("input", renderSplit);
  document.getElementById("split-coin").addEventListener("change", renderSplit);
  document.getElementById("btn-split-send").addEventListener("click", () => {
    const address = document.getElementById("split-address").value.trim();
    const total = parseFloat(document.getElementById("split-total").value);
    const coin = document.getElementById("split-coin").value;
    if (!address) return toast("Enter the merchant address", "err");
    if (!total || total <= 0) return toast("Enter a valid total amount", "err");
    const share = total / splitCount;
    runPayment({ address, amount: share.toFixed(2), coin, sender: "", splitTag: `split 1/${splitCount}` });
  });
});
