const fs = require("fs");
const http = require("http");
const net = require("net");
const path = require("path");
const crypto = require("crypto");

const args = new Map();
for (let i = 2; i < process.argv.length; i += 1) {
  const key = process.argv[i];
  if (key.startsWith("--")) {
    args.set(key.slice(2), process.argv[i + 1]);
    i += 1;
  }
}

const clientRoot = path.resolve(__dirname, "..");
const webRoot = path.resolve(args.get("web-root") || path.join(clientRoot, "web"));
const listenHost = args.get("host") || "127.0.0.1";
const listenPort = Number(args.get("port") || 8088);
const gameHost = args.get("game-host") || "127.0.0.1";
const protocolVersion = Number(args.get("protocol-version") || 1);
const ports = {
  game1: Number(args.get("game1-port") || 5001),
  game2: Number(args.get("game2-port") || 5002),
};

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
};

function sendHttp(res, status, body, contentType = "text/plain; charset=utf-8") {
  res.writeHead(status, {
    "content-type": contentType,
    "cache-control": "no-store",
  });
  res.end(body);
}

function safeStaticPath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const relative = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "");
  const filePath = path.resolve(webRoot, relative);
  return filePath.startsWith(webRoot) ? filePath : null;
}

function wsAcceptKey(key) {
  return crypto
    .createHash("sha1")
    .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest("base64");
}

function sendWs(socket, value) {
  if (socket.destroyed) {
    return;
  }
  const payload = Buffer.from(value, "utf8");
  let header;
  if (payload.length < 126) {
    header = Buffer.from([0x81, payload.length]);
  } else if (payload.length < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(payload.length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(payload.length), 2);
  }
  socket.write(Buffer.concat([header, payload]));
}

function closeWs(socket, code = 1000, reason = "") {
  if (socket.destroyed) {
    return;
  }
  const reasonBuffer = Buffer.from(reason, "utf8");
  const payload = Buffer.alloc(2 + reasonBuffer.length);
  payload.writeUInt16BE(code, 0);
  reasonBuffer.copy(payload, 2);
  socket.write(Buffer.concat([Buffer.from([0x88, payload.length]), payload]));
  socket.end();
}

function parseWsFrames(state, chunk, onText, onClose) {
  state.buffer = Buffer.concat([state.buffer, chunk]);
  while (state.buffer.length >= 2) {
    const first = state.buffer[0];
    const second = state.buffer[1];
    const opcode = first & 0x0f;
    const masked = (second & 0x80) !== 0;
    let length = second & 0x7f;
    let offset = 2;

    if (length === 126) {
      if (state.buffer.length < offset + 2) return;
      length = state.buffer.readUInt16BE(offset);
      offset += 2;
    } else if (length === 127) {
      if (state.buffer.length < offset + 8) return;
      const large = state.buffer.readBigUInt64BE(offset);
      if (large > BigInt(Number.MAX_SAFE_INTEGER)) {
        onClose();
        return;
      }
      length = Number(large);
      offset += 8;
    }

    if (!masked || state.buffer.length < offset + 4 + length) {
      return;
    }

    const mask = state.buffer.subarray(offset, offset + 4);
    offset += 4;
    const payload = Buffer.from(state.buffer.subarray(offset, offset + length));
    state.buffer = state.buffer.subarray(offset + length);

    for (let i = 0; i < payload.length; i += 1) {
      payload[i] ^= mask[i % 4];
    }

    if (opcode === 0x8) {
      onClose();
      return;
    }
    if (opcode === 0x9) {
      state.socket.write(Buffer.from([0x8a, 0x00]));
      continue;
    }
    if (opcode === 0x1) {
      onText(payload.toString("utf8"));
    }
  }
}

function sendGateway(ws, status, detail = {}) {
  sendWs(ws, JSON.stringify({ type: "gateway", version: protocolVersion, status, ...detail }));
}

function handleUpgrade(req, socket) {
  const url = new URL(req.url, `http://${req.headers.host || "127.0.0.1"}`);
  if (url.pathname !== "/ws") {
    socket.destroy();
    return;
  }

  const key = req.headers["sec-websocket-key"];
  if (!key) {
    socket.destroy();
    return;
  }

  const shard = url.searchParams.get("shard") === "game2" ? "game2" : "game1";
  const targetPort = ports[shard];
  socket.write(
    "HTTP/1.1 101 Switching Protocols\r\n" +
      "Upgrade: websocket\r\n" +
      "Connection: Upgrade\r\n" +
      `Sec-WebSocket-Accept: ${wsAcceptKey(key)}\r\n\r\n`
  );

  const tcp = net.createConnection({ host: gameHost, port: targetPort });
  const state = { buffer: Buffer.alloc(0), socket };
  let lineBuffer = "";

  tcp.on("connect", () => {
    sendGateway(socket, "connected", { shard, host: gameHost, port: targetPort });
  });

  tcp.on("data", (chunk) => {
    lineBuffer += chunk.toString("utf8");
    const lines = lineBuffer.split(/\r?\n/);
    lineBuffer = lines.pop() || "";
    for (const line of lines) {
      if (line.trim()) {
        sendWs(socket, line);
      }
    }
  });

  tcp.on("error", (error) => {
    sendGateway(socket, "tcp_error", { message: error.message, shard, port: targetPort });
    closeWs(socket, 1011, error.message);
  });

  tcp.on("close", () => {
    sendGateway(socket, "tcp_closed", { shard });
    closeWs(socket, 1000, "tcp closed");
  });

  socket.on("data", (chunk) => {
    parseWsFrames(
      state,
      chunk,
      (text) => {
        if (tcp.destroyed) {
          sendGateway(socket, "tcp_closed", { shard });
          return;
        }
        let wire = text.replace(/\r?\n/g, " ");
        try {
          const message = JSON.parse(wire);
          if (message && typeof message === "object" && !Array.isArray(message)) {
            message.version ??= protocolVersion;
            message.transport ??= "websocket";
            message.client ??= "web";
            wire = JSON.stringify(message);
          }
        } catch {
          // Keep raw text lines available for legacy manual testing.
        }
        tcp.write(`${wire}\n`);
      },
      () => {
        tcp.end();
        socket.end();
      }
    );
  });

  socket.on("close", () => tcp.destroy());
  socket.on("error", () => tcp.destroy());
}

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    sendHttp(res, 200, JSON.stringify({ ok: true, protocolVersion, webRoot, ports }), "application/json; charset=utf-8");
    return;
  }

  const filePath = safeStaticPath(req.url || "/");
  if (!filePath) {
    sendHttp(res, 403, "Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      sendHttp(res, error.code === "ENOENT" ? 404 : 500, error.code === "ENOENT" ? "Not found" : error.message);
      return;
    }
    sendHttp(res, 200, content, mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream");
  });
});

server.on("upgrade", handleUpgrade);
server.listen(listenPort, listenHost, () => {
  console.log(`[web-client] http://${listenHost}:${listenPort}`);
  console.log(`[web-client] serving ${webRoot}`);
  console.log(`[web-client] forwarding game1=${gameHost}:${ports.game1}, game2=${gameHost}:${ports.game2}`);
});
