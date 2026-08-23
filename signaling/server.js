// WatchTogether — signaling relay + HOST OTORİTESİ.
// Sunucu, odanın host'unu belirler ve herkese resmî olarak bildirir. Host, gizli bir
// host-token ile tanımlanır → sayfa değişip yeniden bağlansa bile aynı kişi host kalır
// (guest kendini host ilan edemez). Host ayrılırsa 8sn sonra kalan en eski üye terfi eder.

const http = require('http');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 8080;
const GRACE_MS = 12000;   // host'un sayfa yenileme/kısa kesinti sonrası dönmesi için pencere
const rooms = new Map(); // roomId -> { peers:Map(peerId->ws), hostPeer, hostToken, claimed, grace }

const rid = (n = 24) => crypto.randomBytes(n).toString('hex').slice(0, n);
function send(ws, msg) { if (ws && ws.readyState === ws.OPEN) { try { ws.send(JSON.stringify(msg)); } catch {} } }
function broadcast(R, msg) { for (const [, w] of R.peers) send(w, msg); }

const server = http.createServer((req, res) => { res.writeHead(200); res.end('WatchTogether signaling OK\n'); });
const wss = new WebSocketServer({ server });

// Keepalive: proxy/idle ws kopmalarını önle + ölü bağlantıları temizle (her 30sn)
const keepAlive = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) { try { ws.terminate(); } catch {} return; }
    ws.isAlive = false; try { ws.ping(); } catch {}
  });
}, 30000);
wss.on('close', () => clearInterval(keepAlive));

wss.on('connection', (ws) => {
  let roomId = null, peerId = null;
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (raw) => {
    let msg; try { msg = JSON.parse(raw); } catch { return; }

    if (msg.type === 'join') {
      roomId = String(msg.room || '').slice(0, 64);
      peerId = String(msg.peer || '').slice(0, 64);
      if (!roomId || !peerId) return;
      if (!rooms.has(roomId)) rooms.set(roomId, { peers: new Map(), hostPeer: null, hostToken: rid(24), claimed: false, grace: null });
      const R = rooms.get(roomId);

      // Host belirleme: geçerli token → reclaim; yoksa ilk gelen (brand-new) → host + token
      if (msg.hostToken && msg.hostToken === R.hostToken) {
        if (R.grace) { clearTimeout(R.grace); R.grace = null; }
        R.hostPeer = peerId;
      } else if (!R.claimed && R.hostPeer === null && R.peers.size === 0) {
        R.hostPeer = peerId; R.claimed = true;
        send(ws, { type: 'host-token', token: R.hostToken });
      }

      // Yeni gelene mevcut eşler + host; mevcutlara yeni katılan
      send(ws, { type: 'peers', peers: [...R.peers.keys()], self: peerId, host: R.hostPeer });
      for (const [id, w] of R.peers) if (id !== peerId) send(w, { type: 'peer-joined', peer: peerId, host: R.hostPeer });
      R.peers.set(peerId, ws);
      broadcast(R, { type: 'host', peer: R.hostPeer });   // herkes host'u kesin bilsin

    } else if (msg.type === 'signal') {
      const R = rooms.get(roomId); if (!R) return;
      const t = R.peers.get(msg.to);
      if (t) send(t, { type: 'signal', from: peerId, data: msg.data });

    } else if (msg.type === 'leave') {
      cleanup();
    }
  });

  ws.on('close', cleanup);
  ws.on('error', cleanup);

  function cleanup() {
    const R = rooms.get(roomId); if (!R) return;
    if (R.peers.get(peerId) === ws) R.peers.delete(peerId);
    for (const [, w] of R.peers) send(w, { type: 'peer-left', peer: peerId });

    if (peerId === R.hostPeer) {
      R.hostPeer = null;
      broadcast(R, { type: 'host', peer: null });     // host yok → kimse otorite değil (ping-pong önlenir)
      if (R.grace) clearTimeout(R.grace);
      R.grace = setTimeout(() => {                     // host token'la dönmezse en eskiyi terfi et
        R.grace = null;
        const next = R.peers.keys().next().value;
        if (next) {
          R.hostToken = rid(24);                       // token'ı YENİLE → eski host geri dönüp çakışamaz
          R.hostPeer = next;
          send(R.peers.get(next), { type: 'host-token', token: R.hostToken });
          broadcast(R, { type: 'host', peer: next });
        }
      }, GRACE_MS);
    }

    if (R.peers.size === 0) { if (R.grace) clearTimeout(R.grace); rooms.delete(roomId); }
    roomId = peerId = null;
  }
});

server.listen(PORT, () => console.log(`WatchTogether signaling listening on :${PORT}`));
