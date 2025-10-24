const express = require("express");
const http = require("http");
const { WebSocketServer } = require("ws");
const { RTCPeerConnection, RTCVideoSource, RTCAudioSource } = require("wrtc");
const { PassThrough } = require("stream");

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Live stream
const mp3Stream = new PassThrough();
let broadcasterPc = null;

app.get("/fm.mp3", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "audio/mpeg",
    "Connection": "keep-alive",
    "Cache-Control": "no-cache",
  });
  mp3Stream.pipe(res);
});

wss.on("connection", ws => {
  ws.on("message", async raw => {
    const data = JSON.parse(raw);

    if (data.type === "register" && data.role === "broadcaster") {
      console.log("Broadcaster connected");
      broadcasterPc = new RTCPeerConnection();

      // TODO: Receive WebRTC track from broadcaster and pipe to mp3Stream
      // Use wrtc RTCAudioSource or MediaStreamTrack → encode to MP3 in memory

      const offer = data.offer;
      await broadcasterPc.setRemoteDescription(offer);
      const answer = await broadcasterPc.createAnswer();
      await broadcasterPc.setLocalDescription(answer);

      ws.send(JSON.stringify({ type: "answer", answer: broadcasterPc.localDescription }));
    }
  });
});

server.listen(3000, () => console.log("✅ Server running on port 3000"));
