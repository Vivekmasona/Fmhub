const express = require("express");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { WebSocketServer } = require("ws");

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

let broadcasterFilePath = null; // currently streamed file
let broadcasterWs = null;

// Root
app.get("/", (req, res) => res.send("🎧 Bihar FM Live Server"));

// Serve audio file as mp3 URL
app.get("/stream", (req, res) => {
  if(!broadcasterFilePath || !fs.existsSync(broadcasterFilePath)){
    res.status(404).send("No stream available");
    return;
  }
  const stat = fs.statSync(broadcasterFilePath);
  const total = stat.size;

  let range = req.headers.range;
  if (!range) range = "bytes=0-";

  const parts = range.replace(/bytes=/, "").split("-");
  const start = parseInt(parts[0], 10);
  const end = parts[1] ? parseInt(parts[1], 10) : total - 1;

  const chunkSize = (end - start) + 1;
  const stream = fs.createReadStream(broadcasterFilePath, { start, end });

  res.writeHead(206, {
    "Content-Range": `bytes ${start}-${end}/${total}`,
    "Accept-Ranges": "bytes",
    "Content-Length": chunkSize,
    "Content-Type": "audio/mpeg"
  });
  stream.pipe(res);
});

// WebSocket for broadcaster panel
wss.on("connection", ws => {
  ws.on("message", msg => {
    try{
      const data = JSON.parse(msg);
      if(data.type==="register" && data.role==="broadcaster"){
        broadcasterWs = ws;
        console.log("Broadcaster connected");
      }

      // Receive file path from broadcaster
      if(data.type==="file"){
        // Server stores file path to serve to listeners
        broadcasterFilePath = data.payload.path;
        console.log("Broadcaster streaming file:", broadcasterFilePath);
      }
    }catch(e){}
  });

  ws.on("close", ()=> {
    if(ws===broadcasterWs) {
      broadcasterWs=null;
      broadcasterFilePath=null;
      console.log("Broadcaster disconnected, stream stopped");
    }
  });
});

// Start server
const PORT = 3000;
server.listen(PORT, ()=>console.log(`✅ Bihar FM Server running on port ${PORT}`));
