/**
 * KoshBox — Development Server
 * Starts both the API backend and a static frontend server concurrently.
 * Run: npm run dev
 */

"use strict";

const { spawn } = require("child_process");
const http      = require("http");
const fs        = require("fs");
const path      = require("path");

const API_PORT      = 3001;
const FRONTEND_PORT = 3000;
const FRONTEND_DIR  = path.join(__dirname, "../../frontend");

// ── Static Frontend Server ────────────────────────────────────────────────────
const MIME_TYPES = {
  ".html": "text/html",
  ".css":  "text/css",
  ".js":   "application/javascript",
  ".json": "application/json",
  ".png":  "image/png",
  ".svg":  "image/svg+xml",
  ".mp3":  "audio/mpeg",
  ".ico":  "image/x-icon"
};

const frontendServer = http.createServer((req, res) => {
  let urlPath = req.url.split("?")[0];
  if (urlPath === "/" || urlPath === "") urlPath = "/index.html";

  const filePath = path.join(FRONTEND_DIR, urlPath);
  const ext      = path.extname(filePath);
  const mimeType = MIME_TYPES[ext] || "text/plain";

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === "ENOENT") {
        // Fallback to index.html for client-side routing
        fs.readFile(path.join(FRONTEND_DIR, "index.html"), (err2, indexData) => {
          if (err2) {
            res.writeHead(404);
            res.end("Not found");
          } else {
            res.writeHead(200, { "Content-Type": "text/html" });
            res.end(indexData);
          }
        });
      } else {
        res.writeHead(500);
        res.end("Server error");
      }
      return;
    }
    res.writeHead(200, { "Content-Type": mimeType });
    res.end(data);
  });
});

frontendServer.listen(FRONTEND_PORT, () => {
  console.log(`[Frontend] Serving at http://localhost:${FRONTEND_PORT}`);
});

// ── API Backend Process ───────────────────────────────────────────────────────
const apiProcess = spawn("node", ["server.js"], {
  cwd:   path.join(__dirname, "../.."),
  stdio: "inherit",
  env:   { ...process.env, NODE_ENV: "development" }
});

apiProcess.on("exit", (code) => {
  console.log(`[API] Process exited with code ${code}`);
  process.exit(code);
});

// ── Graceful Shutdown ────────────────────────────────────────────────────────
process.on("SIGINT", () => {
  console.log("\n[DevServer] Shutting down...");
  frontendServer.close();
  apiProcess.kill("SIGINT");
  process.exit(0);
});

console.log("\n╔══════════════════════════════════════════════╗");
console.log("║        KoshBox Development Server            ║");
console.log("╠══════════════════════════════════════════════╣");
console.log(`║  Frontend  →  http://localhost:${FRONTEND_PORT}           ║`);
console.log(`║  API       →  http://localhost:${API_PORT}           ║`);
console.log("╚══════════════════════════════════════════════╝\n");
