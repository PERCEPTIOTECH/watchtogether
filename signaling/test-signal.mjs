// WatchTogether — signalUrl override testi.
// mesh.signalUrl ayarlanınca Mesh'in VARSAYILAN (8080) yerine o adrese bağlandığını kanıtlar:
// özel portta (8091) bir relay çalıştırır, iki mesh'i oraya yönlendirir, P2P kurulmasını
// ve relay'in join'leri GÖRMESİNİ doğrular. Override çalışmasaydı 8091 hiç join görmezdi.

import * as ndc from 'node-datachannel/polyfill';
import { WebSocketServer } from 'ws';
const P = ndc.default || ndc;
globalThis.RTCPeerConnection = P.RTCPeerConnection;
globalThis.RTCSessionDescription = P.RTCSessionDescription;
globalThis.RTCIceCandidate = P.RTCIceCandidate;
globalThis.MediaStream = P.MediaStream || class { addTrack() {} getTracks() { return []; } };

const { Mesh } = await import('../extension/rtc.js');
const PORT = 8091;
let joinCount = 0;

// Minimal relay (server.js ile aynı protokol) — 8091'de
const rooms = new Map();
const send = (ws, m) => { try { ws.send(JSON.stringify(m)); } catch {} };
const wss = new WebSocketServer({ port: PORT });
wss.on('connection', (ws) => {
  let room, peer;
  ws.on('message', (raw) => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (m.type === 'join') {
      room = m.room; peer = m.peer; joinCount++;
      if (!rooms.has(room)) rooms.set(room, new Map());
      const r = rooms.get(room);
      send(ws, { type: 'peers', peers: [...r.keys()], self: peer });
      for (const [, w] of r) send(w, { type: 'peer-joined', peer });
      r.set(peer, ws);
    } else if (m.type === 'signal') {
      const t = rooms.get(room)?.get(m.to); if (t) send(t, { type: 'signal', from: peer, data: m.data });
    }
  });
});

const results = { connected: false, sawJoins: false };
const A = new Mesh(), B = new Mesh();
A.signalUrl = `ws://localhost:${PORT}`;
B.signalUrl = `ws://localhost:${PORT}`;
A.onPeer = () => { results.connected = true; finish(); };

A.connect('SIGTEST', 'A');
setTimeout(() => B.connect('SIGTEST', 'B'), 500);

let done = false;
function finish() {
  if (done) return; done = true;
  process.on('uncaughtException', () => {});   // kapanışta datachannel gürültüsünü yут
  results.sawJoins = joinCount >= 2;
  console.log('\n──────── SONUÇ ────────');
  console.log('Özel porta (8091) bağlandı :', results.sawJoins ? '✅' : '❌ (join sayısı ' + joinCount + ')');
  console.log('P2P kuruldu               :', results.connected ? '✅' : '❌');
  const pass = results.sawJoins && results.connected;
  console.log(pass ? '\n🎉 SIGNAL OVERRIDE ÇALIŞIYOR' : '\n❌ BAŞARISIZ');
  try { A.leave(); B.leave(); wss.close(); } catch {}
  setTimeout(() => process.exit(pass ? 0 : 1), 200);
}
setTimeout(() => finish(), 12000);
