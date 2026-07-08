// WatchTogether — minimal WebRTC signaling relay.
// Yalnızca oda üyeliği + offer/answer/ICE aday değişimi yapar.
// Medya (ses/kamera) ve senkron/chat verisi buradan GEÇMEZ; P2P data channel/track ile akar.

const http = require('http');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 8080;

// roomId -> Map(peerId -> ws)
const rooms = new Map();

const server = http.createServer((req, res) => {
  // Basit sağlık kontrolü (Render/Fly health check için)
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('WatchTogether signaling OK\n');
});

const wss = new WebSocketServer({ server });

function send(ws, msg) {
  if (ws && ws.readyState === ws.OPEN) {
    try { ws.send(JSON.stringify(msg)); } catch (_) {}
  }
}

wss.on('connection', (ws) => {
  let roomId = null;
  let peerId = null;

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    switch (msg.type) {
      case 'join': {
        roomId = String(msg.room || '').slice(0, 64);
        peerId = String(msg.peer || '').slice(0, 64);
        if (!roomId || !peerId) return;
        if (!rooms.has(roomId)) rooms.set(roomId, new Map());
        const room = rooms.get(roomId);

        // Yeni gelene mevcut eşleri bildir (offer'ları yeni gelen başlatır → glare yok)
        send(ws, { type: 'peers', peers: [...room.keys()], self: peerId });
        // Mevcut eşlere yeni katılımcıyı bildir
        for (const [id, peerWs] of room) {
          if (id !== peerId) send(peerWs, { type: 'peer-joined', peer: peerId });
        }
        room.set(peerId, ws);
        break;
      }

      case 'signal': {
        // offer/answer/candidate'i hedef eşe ilet
        const room = rooms.get(roomId);
        if (!room) return;
        const target = room.get(msg.to);
        if (target) send(target, { type: 'signal', from: peerId, data: msg.data });
        break;
      }

      case 'leave': {
        cleanup();
        break;
      }
    }
  });

  ws.on('close', cleanup);
  ws.on('error', cleanup);

  function cleanup() {
    const room = rooms.get(roomId);
    if (!room) return;
    if (room.get(peerId) === ws) room.delete(peerId);
    for (const [, peerWs] of room) send(peerWs, { type: 'peer-left', peer: peerId });
    if (room.size === 0) rooms.delete(roomId);
    roomId = peerId = null;
  }
});

server.listen(PORT, () => {
  console.log(`WatchTogether signaling listening on :${PORT}`);
});
