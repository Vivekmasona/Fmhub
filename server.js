const express = require("express");
const http = require("http");
const { WebSocketServer } = require("ws");
const { RTCPeerConnection, RTCSessionDescription } = require("wrtc");

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

let broadcasterPc = null;
let listenerPcs = new Map(); // id -> RTCPeerConnection

wss.on("connection", ws => {
  ws.on("message", async msg => {
    const data = JSON.parse(msg);

    if (data.type === "register" && data.role === "broadcaster") {
      console.log("Broadcaster connected");
      broadcasterPc = new RTCPeerConnection();

      // Relay broadcaster audio to listeners
      broadcasterPc.ontrack = (event) => {
        console.log("Audio track received from broadcaster");
        // TODO: Forward to listeners
        for (const [, pc] of listenerPcs) {
          pc.addTrack(event.track);
        }
      };

      // Handle offer from broadcaster
      const offer = new RTCSessionDescription(data.offer);
      await broadcasterPc.setRemoteDescription(offer);
      const answer = await broadcasterPc.createAnswer();
      await broadcasterPc.setLocalDescription(answer);

      ws.send(JSON.stringify({ type: "answer", answer: broadcasterPc.localDescription }));
    }

    if (data.type === "register" && data.role === "listener") {
      console.log("Listener connected");
      const pc = new RTCPeerConnection();
      listenerPcs.set(data.id, pc);

      // Forward broadcaster tracks
      if (broadcasterPc) {
        broadcasterPc.getSenders().forEach(sender => {
          pc.addTrack(sender.track);
        });
      }

      const offer = new RTCSessionDescription(data.offer);
      await pc.setRemoteDescription(offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      ws.send(JSON.stringify({ type: "answer", answer: pc.localDescription }));
    }
  });

  ws.on("close", () => {
    console.log("Client disconnected");
  });
});

app.get("/", (req, res) => res.send("🎧 Bihar FM WebRTC Relay Server"));

server.listen(process.env.PORT || 3000, () => console.log("✅ Server running"));
