/**
 * KoshBox — Frontend Test Runner
 */

"use strict";

const { execSync } = require("child_process");
const path = require("path");

const tests = [
  "tests/frontend/transaction-flow.test.js"
];

console.log("\n╔══════════════════════════════════════╗");
console.log("║     KoshBox Frontend Test Runner     ║");
console.log("╚══════════════════════════════════════╝");

let totalFail = 0;

for (const testFile of tests) {
  console.log(`\nRunning: ${testFile}`);
  console.log("─".repeat(40));
  try {
    execSync(`node ${testFile}`, {
      stdio: "inherit",
      cwd: path.join(__dirname, "../..")
    });
  } catch (_) {
    totalFail++;
  }
}

process.exit(totalFail > 0 ? 1 : 0);
