const express = require("express");
const http = require("http");
const { WebSocketServer } = require("ws");
const { PassThrough } = require("stream");
const cp = require("child_process");

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Live MP3 stream
const mp3Stream = new PassThrough();

// Serve HTTP /stream
app.get("/stream", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "audio/mpeg",
    "Connection": "keep-alive",
    "Cache-Control": "no-cache"
  });
  mp3Stream.pipe(res);
});

// WebSocket for broadcaster
let broadcasterWs = null;
wss.on("connection", ws => {
  ws.binaryType = "arraybuffer"; // direct ArrayBuffer
  ws.on("message", msg => {
    if (ws === broadcasterWs) {
      ffmpeg.stdin.write(Buffer.from(msg)); // direct write, no conversion
    } else {
      try {
        const data = JSON.parse(msg);
        if (data.type === "register" && data.role === "broadcaster") {
          broadcasterWs = ws;
          console.log("✅ Broadcaster connected, ready for live");
        }
      } catch {}
    }
  });

  ws.on("close", () => {
    if (ws === broadcasterWs) {
      broadcasterWs = null;
      console.log("⚠ Broadcaster disconnected, stream stopped");
    }
  });
});

// Optimized ffmpeg for low latency
const ffmpeg = cp.spawn("ffmpeg", [
  "-f", "s16le",      // 16-bit PCM
  "-ar", "22050",      // lower sample rate → faster encoding
  "-ac", "1",          // mono
  "-i", "pipe:0",
  "-f", "mp3",
  "-b:a", "64k",       // lower bitrate
  "-preset", "ultrafast", // minimal CPU buffering
  "pipe:1"
]);

ffmpeg.stdout.pipe(mp3Stream);

// Root page
app.get("/", (req, res) => res.send("🎧 Bihar FM Live Server"));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`✅ Live FM Server vivek running on port ${PORT}`));

