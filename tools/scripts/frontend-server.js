/**
 * KoshBox — Frontend-Only Server
 * Serves the frontend without the API backend.
 * The simulator runs in offline/mock mode.
 * Run: npm run frontend
 */

"use strict";

const http = require("http");
const fs   = require("fs");
const path = require("path");

const PORT         = process.env.FRONTEND_PORT || 3000;
const FRONTEND_DIR = path.join(__dirname, "../../frontend");

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

const server = http.createServer((req, res) => {
  let urlPath = req.url.split("?")[0];
  if (urlPath === "/" || urlPath === "") urlPath = "/index.html";

  const filePath = path.join(FRONTEND_DIR, urlPath);
  const ext      = path.extname(filePath);
  const mimeType = MIME_TYPES[ext] || "text/plain";

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === "ENOENT") {
        fs.readFile(path.join(FRONTEND_DIR, "index.html"), (err2, indexData) => {
          if (err2) { res.writeHead(404); res.end("Not found"); return; }
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(indexData);
        });
      } else {
        res.writeHead(500); res.end("Server error");
      }
      return;
    }
    res.writeHead(200, { "Content-Type": mimeType });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`\n[KoshBox] Frontend running at http://localhost:${PORT}`);
  console.log("[KoshBox] Offline mode — API calls will use local mock data\n");
});
