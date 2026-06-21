/**
 * KoshBox — Root Test Runner
 * Runs all frontend and backend tests.
 * Run: npm test
 */

"use strict";

const { execSync } = require("child_process");

const suites = [
  { name: "Frontend Logic", cmd: "node tests/frontend/run.js" },
  { name: "Backend Unit",   cmd: "node tests/backend/run.js" }
];

let passed = 0;
let failed = 0;

console.log("\n╔══════════════════════════════════════╗");
console.log("║        KoshBox Test Suite            ║");
console.log("╚══════════════════════════════════════╝\n");

for (const suite of suites) {
  console.log(`▶ ${suite.name}`);
  try {
    execSync(suite.cmd, { stdio: "inherit" });
    passed++;
    console.log(`✓ ${suite.name} passed\n`);
  } catch (_) {
    failed++;
    console.log(`✗ ${suite.name} failed\n`);
  }
}

console.log("──────────────────────────────────────");
console.log(`Suites: ${passed} passed, ${failed} failed`);
console.log("──────────────────────────────────────\n");

process.exit(failed > 0 ? 1 : 0);
