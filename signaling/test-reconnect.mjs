// WatchTogether — signaling otomatik yeniden bağlanma testi.
// ws düşünce Mesh, backoff ile yeniden bağlanıp odaya TEKRAR join etmeli (host token'la).
// Özel relay join'leri sayar: kopma sonrası aynı peer'ın 2. join'ini görürsek reconnect çalışıyor.

import * as ndc from 'node-datachannel/polyfill';
import { WebSocketServer } from 'ws';
const P = ndc.default || ndc;
globalThis.RTCPeerConnection = P.RTCPeerConnection;
globalThis.RTCSessionDescription = P.RTCSessionDescription;
globalThis.RTCIceCandidate = P.RTCIceCandidate;
globalThis.MediaStream = P.MediaStream || class { addTrack() {} getTracks() { return []; } };

const { Mesh } = await import('../extension/rtc.js');
const PORT = 8092;
const joins = new Map();
const send = (ws, m) => { try { ws.send(JSON.stringify(m)); } catch {} };

const wss = new WebSocketServer({ port: PORT });
wss.on('connection', (ws) => {
  ws.on('message', (raw) => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (m.type === 'join') {
      joins.set(m.peer, (joins.get(m.peer) || 0) + 1);
      send(ws, { type: 'peers', peers: [], self: m.peer, host: m.peer });
    }
  });
});

const log = (...a) => console.log(...a);
const A = new Mesh();
A.signalUrl = `ws://localhost:${PORT}`;
let sawReconnecting = false;
A.onStatus = (s) => { if (/yeniden bağlan/.test(s)) sawReconnecting = true; };

A.connect('RECONN', 'A');
// 1.5sn sonra bağlantıyı zorla kopar (ağ kesintisi simülasyonu)
setTimeout(() => { log('ws koparılıyor (ağ kesintisi)…'); try { A.ws.close(); } catch {} }, 1500);

setTimeout(() => {
  const j = joins.get(A.selfId) || 0;
  log('\n──────── SONUÇ ────────');
  log(`Aynı peer tekrar join etti (${j} kez) :`, j >= 2 ? '✅' : '❌');
  log('Yeniden-bağlanıyor durumu görüldü    :', sawReconnecting ? '✅' : '❌');
  const pass = j >= 2 && sawReconnecting;
  log(pass ? '\n🎉 OTOMATİK YENİDEN BAĞLANMA ÇALIŞIYOR' : '\n❌ BAŞARISIZ');
  process.on('uncaughtException', () => {});
  try { A.leave(); wss.close(); } catch {}
  setTimeout(() => process.exit(pass ? 0 : 1), 200);
}, 5000);
