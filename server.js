// server.js — Bihar FM Central Relay Server
const express = require("express");
const http = require("http");
const { WebSocketServer } = require("ws");
const crypto = require("crypto");

const app = express();

// Root route check
app.get("/", (req, res) => {
  res.send("🎧 Bihar FM Central Relay Server is Live!");
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// State
let broadcaster = null; // Only one broadcaster allowed
const listeners = new Map(); // id -> ws

// Safe send helper
function safeSend(ws, data) {
  if (ws.readyState === ws.OPEN) {
    try { ws.send(JSON.stringify(data)); } 
    catch (e) { console.error("Send error:", e.message); }
  }
}

// Keep-alive ping
setInterval(() => {
  if (broadcaster && broadcaster.readyState === broadcaster.OPEN) {
    safeSend(broadcaster, { type: "ping" });
  }
  for (const ws of listeners.values()) {
    if (ws.readyState === ws.OPEN) safeSend(ws, { type: "ping" });
  }
}, 25000);

// WebSocket handling
wss.on("connection", (ws, req) => {
  const origin = req.headers.origin || "";
  if (!origin.includes("yourdomain.com")) { // replace with your domain
    ws.close(1008, "Unauthorized domain");
    return;
  }

  const id = crypto.randomUUID();
  console.log("🔗 New connection:", id);

  ws.on("message", (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    const { type, role, payload } = msg;

    if (type === "register") {
      if (role === "broadcaster") {
        if (broadcaster) { 
          safeSend(ws, { type: "error", message: "Broadcaster already connected" });
          ws.close();
          return;
        }
        broadcaster = ws;
        console.log(`🧩 Broadcaster registered: ${id}`);
      } else if (role === "listener") {
        listeners.set(id, ws);
        console.log(`🧩 Listener registered: ${id}`);
        if (broadcaster) safeSend(broadcaster, { type: "listener-joined", id });
      }
      return;
    }

    // Relay metadata
    if (type === "metadata" && ws === broadcaster) {
      for (const listener of listeners.values()) {
        safeSend(listener, {
          type: "metadata",
          title: payload.title,
          artist: payload.artist,
          cover: payload.cover
        });
      }
      return;
    }

    // Relay audio chunks
    if (type === "audio" && ws === broadcaster) {
      for (const listener of listeners.values()) {
        safeSend(listener, { type: "audio", payload });
      }
      return;
    }
  });

  ws.on("close", () => {
    if (ws === broadcaster) {
      console.log("❌ Broadcaster disconnected");
      broadcaster = null;
      for (const listener of listeners.values()) {
        safeSend(listener, { type: "broadcaster-left" });
      }
    } else if (listeners.has(id)) {
      listeners.delete(id);
      console.log(`❌ Listener disconnected: ${id}`);
    }
  });

  ws.on("error", (err) => console.error("WebSocket error:", err.message));
});

server.keepAliveTimeout = 70000;
server.headersTimeout = 75000;
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`✅ Bihar FM Server running on port ${PORT}`));
