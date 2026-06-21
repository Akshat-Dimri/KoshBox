/**
 * KoshBox — Generate Test Transaction
 * Injects a test transaction into the mempool via API.
 * Requires server to be running.
 * Run: npm run generate:tx
 */

"use strict";

const http = require("http");

const TEST_TRANSACTIONS = [
  { senderName: "Rahul",  amount: "250.00", coin: "KOSH" },
  { senderName: "Priya",  amount: "75.50",  coin: "KOSH" },
  { senderName: "Arjun",  amount: "1200.00",coin: "KOSH" },
  { senderName: "Sneha",  amount: "300.00", coin: "USDT" },
  { senderName: "Vikram", amount: "50.00",  coin: "KOSH" }
];

function postJson(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const options = {
      hostname: "localhost",
      port:     3001,
      path,
      method:   "POST",
      headers: {
        "Content-Type":   "application/json",
        "Content-Length": Buffer.byteLength(data)
      }
    };

    const req = http.request(options, (res) => {
      let raw = "";
      res.on("data", chunk => { raw += chunk; });
      res.on("end", () => {
        try { resolve(JSON.parse(raw)); }
        catch (_) { resolve({ raw }); }
      });
    });

    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

async function generateTestTx() {
  const tx = TEST_TRANSACTIONS[Math.floor(Math.random() * TEST_TRANSACTIONS.length)];
  console.log(`\n[TestTx] Injecting: ${tx.amount} ${tx.coin} from ${tx.senderName}\n`);

  try {
    const result = await postJson("/api/transactions/inject", tx);
    if (result.success) {
      console.log(`[TestTx] Submitted — txHash: ${result.txHash}`);
      console.log(`[TestTx] Status: ${result.status}`);
      console.log(`[TestTx] Est. confirmation in: ${result.estimatedConfirmation || 6000}ms\n`);
    } else {
      console.error("[TestTx] Failed:", result.error);
    }
  } catch (err) {
    console.error("[TestTx] Could not reach server. Is it running? (npm run dev)");
    console.error(err.message);
  }
}

generateTestTx();
