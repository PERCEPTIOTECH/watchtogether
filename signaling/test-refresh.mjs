// WatchTogether — misafir F5 (refresh) dayanıklılık senaryosu.
// Misafir sayfayı yenileyince (yeni peerId) HOST bozulmamalı ve kontrol yetkisi İSME göre
// otomatik geri gelmeli. Host'un panel mantığı (isme göre re-grant) burada modellenir.

import * as ndc from 'node-datachannel/polyfill';
const P = ndc.default || ndc;
globalThis.RTCPeerConnection = P.RTCPeerConnection;
globalThis.RTCSessionDescription = P.RTCSessionDescription;
globalThis.RTCIceCandidate = P.RTCIceCandidate;
globalThis.MediaStream = P.MediaStream || class { addTrack() {} getTracks() { return []; } };

const { Mesh } = await import('../extension/rtc.js');
const log = (...a) => console.log(...a);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ROOM = 'REFRESHTEST';

const grantedNames = new Set(['Bguest']);  // host, "Bguest" ismine kontrol vermiş durumda
const A = new Mesh();                       // host
A.onSyncTimes = [];
A.onSync = (id, s) => A.onSyncTimes.push(s.time);
// Host panel mantığı: granted isimli bir eş (yeniden) katılınca ona kontrol ver
A.onPeer = (id, name) => { if (A.amHost() && grantedNames.has(name)) A.sendControl([id]); };

function makeGuest() {
  const B = new Mesh();
  return B;
}

A.connect(ROOM, 'Ahost');
await wait(600);
let B = makeGuest();
B.connect(ROOM, 'Bguest');
await wait(2500);
const hostStableBefore = A.amHost();
log(`Faz 1 — bağlandılar. Host mu: ${hostStableBefore}, B kontrol: ${B.iCanControl()}`);

// Misafir F5: bağlantıyı bırak, YENİ id ile aynı isimle tekrar bağlan
log('Misafir F5 (yeniden bağlanıyor, yeni id)…');
B.leave();
await wait(600);
B = makeGuest();
B.connect(ROOM, 'Bguest');
await wait(3000);

// Artık B (yeni id) kontrol sahibi olmalı → sync'i host'a ulaşmalı
B.sendSync({ type: 'play', time: 9 });
await wait(1200);

log('\n──────── SONUÇ ────────');
const hostStable = A.amHost();
const reGranted = B.iCanControl();
const syncReached = A.onSyncTimes.includes(9);
log('Host, refresh boyunca host kaldı     :', (hostStableBefore && hostStable) ? '✅' : '❌');
log('Kontrol isme göre geri geldi (B2)    :', reGranted ? '✅' : '❌');
log('B2 sync host\'a ulaştı (yetki aktif)  :', syncReached ? '✅' : '❌');
const pass = hostStableBefore && hostStable && reGranted && syncReached;
log(pass ? '\n🎉 REFRESH DAYANIKLILIĞI ÇALIŞIYOR' : '\n❌ BAŞARISIZ');
process.on('uncaughtException', () => {});
try { A.leave(); B.leave(); } catch {}
setTimeout(() => process.exit(pass ? 0 : 1), 200);
