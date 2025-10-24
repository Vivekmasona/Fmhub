const express = require("express");
const http = require("http");
const { WebSocketServer } = require("ws");
const { RTCPeerConnection, RTCSessionDescription } = require("wrtc");
const { PassThrough } = require("stream");

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Central broadcaster
let broadcasterPc = null;
const listenerPcs = new Map();

// Live MP3 stream
const mp3Stream = new PassThrough();

// HTTP endpoint to test stream
app.get("/fm.mp3", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "audio/mpeg",
    "Connection": "keep-alive",
    "Cache-Control": "no-cache"
  });
  mp3Stream.pipe(res);
});

// WebSocket signaling
wss.on("connection", ws => {
  ws.on("message", async raw => {
    const data = JSON.parse(raw);

    if (data.type === "register" && data.role === "broadcaster") {
      console.log("✅ Broadcaster connected");
      broadcasterPc = new RTCPeerConnection();

      broadcasterPc.ontrack = (event) => {
        console.log("Audio track received from broadcaster");
        // Forward to all listener peer connections
        for (const [, pc] of listenerPcs) {
          pc.addTrack(event.track);
        }

        // Optional: pipe PCM → MP3 here for /fm.mp3 endpoint
        // This requires minimal server-side encoding
        // For testing, can pipe raw PCM for now
        // TODO: add conversion if needed
      };

      const offer = new RTCSessionDescription(data.offer);
      await broadcasterPc.setRemoteDescription(offer);
      const answer = await broadcasterPc.createAnswer();
      await broadcasterPc.setLocalDescription(answer);

      ws.send(JSON.stringify({ type: "answer", answer: broadcasterPc.localDescription }));
    }

    if (data.type === "register" && data.role === "listener") {
      console.log("✅ Listener connected:", data.id);
      const pc = new RTCPeerConnection();
      listenerPcs.set(data.id, pc);

      if (broadcasterPc) {
        broadcasterPc.getSenders().forEach(sender => pc.addTrack(sender.track));
      }

      const offer = new RTCSessionDescription(data.offer);
      await pc.setRemoteDescription(offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      ws.send(JSON.stringify({ type: "answer", answer: pc.localDescription }));
    }
  });

  ws.on("close", () => console.log("Client disconnected"));
});

// Root page
app.get("/", (req, res) => res.send("🎧 Bihar FM WebRTC Relay Server with /fm.mp3"));

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
