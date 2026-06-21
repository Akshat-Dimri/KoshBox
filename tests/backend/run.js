/**
 * KoshBox — Backend Test Runner
 * Runs all backend tests in sequence.
 */

"use strict";

const { execSync } = require("child_process");
const path = require("path");

const tests = [
  "tests/backend/blockchain.test.js",
  "tests/backend/api.test.js"
];

let totalPass = 0;
let totalFail = 0;

console.log("\n╔══════════════════════════════════════╗");
console.log("║      KoshBox Backend Test Runner     ║");
console.log("╚══════════════════════════════════════╝");

for (const testFile of tests) {
  console.log(`\nRunning: ${testFile}`);
  console.log("─".repeat(40));
  try {
    execSync(`node ${testFile}`, {
      stdio: "inherit",
      cwd: path.join(__dirname, "../..")
    });
    totalPass++;
  } catch (_) {
    totalFail++;
  }
}

console.log("\n╔══════════════════════════════════════╗");
console.log(`║  Suites passed: ${totalPass}/${tests.length}                   ║`);
console.log("╚══════════════════════════════════════╝\n");

process.exit(totalFail > 0 ? 1 : 0);
