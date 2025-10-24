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
  ws.on("message", msg => {
    if (ws === broadcasterWs) {
      // raw PCM Float32Array from broadcaster
      ffmpeg.stdin.write(Buffer.from(msg));
    } else {
      try {
        const data = JSON.parse(msg);
        if (data.type === "register" && data.role === "broadcaster") {
          broadcasterWs = ws;
          console.log("Broadcaster connected");
        }
      } catch {}
    }
  });

  ws.on("close", () => {
    if (ws === broadcasterWs) {
      broadcasterWs = null;
      console.log("Broadcaster disconnected, stream stopped");
    }
  });
});

// Start ffmpeg for live MP3 encoding
const ffmpeg = cp.spawn("ffmpeg", [
  "-f", "f32le",
  "-ar", "44100",
  "-ac", "2",
  "-i", "pipe:0",
  "-f", "mp3",
  "-b:a", "128k",
  "pipe:1"
]);

ffmpeg.stdout.pipe(mp3Stream);

server.listen(process.env.PORT || 3000, ()=>console.log("✅ Live FM Server running"));
