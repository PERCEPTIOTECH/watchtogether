// WatchTogether — headless uçtan uca test botu.
// Gerçek extension/rtc.js kodunu (Mesh) Node'da WebRTC polyfill'i ile çalıştırır:
// iki sahte kullanıcı signaling üzerinden buluşur, P2P data channel kurar,
// senkron (play/seek) + chat mesajı alışverişi yapar. Tarayıcı gerektirmez.

import * as ndc from 'node-datachannel/polyfill';

// --- Tarayıcı global'lerini sağla (rtc.js bunları bekliyor) ---
const P = ndc.default || ndc;
globalThis.RTCPeerConnection = P.RTCPeerConnection;
globalThis.RTCSessionDescription = P.RTCSessionDescription;
globalThis.RTCIceCandidate = P.RTCIceCandidate;
globalThis.MediaStream = P.MediaStream || class { addTrack() {} getTracks() { return []; } };
// WebSocket ve crypto → Node 21+ global olarak var.

const { Mesh } = await import('../extension/rtc.js');

const ROOM = 'BOTEST';
const results = { aSawB: false, bSawA: false, syncOK: false, chatOK: false, hbOK: false, srcOK: false, ctlOK: false, presOK: false };

function makePeer(name) {
  const m = new Mesh();
  m.onStatus = (s) => log(`[${name}] durum: ${s}`);
  return m;
}
function log(...a) { console.log(...a); }

const A = makePeer('Ali');
const B = makePeer('Veli');

// Ali, Veli'yi görünce senkron mesajı yollar
A.onPeer = (id, nm) => {
  results.aSawB = true;
  log(`[Ali] eş bağlandı: ${nm} (${id.slice(0,6)})`);
  setTimeout(() => {
    log('[Ali] -> sendSync {play, time:42}');
    A.sendSync({ type: 'play', time: 42, rate: 1 });
    // Heartbeat: HOST (A, ilk giren) yollar → guest kabul eder
    log('[Ali] host → sendHeartbeat {time:100, paused:false}');
    A.sendHeartbeat({ time: 100, paused: false });
  }, 300);
};

// Heartbeat'i takipçi taraf almalı
const onHb = (who) => (id, hb) => {
  log(`[${who}] <- heartbeat:`, JSON.stringify(hb));
  if (hb.time === 100 && hb.paused === false) results.hbOK = true;
  finishSoon();
};
A.onHeartbeat = onHb('Ali');
B.onHeartbeat = onHb('Veli');

// Host-takip: A "şu an bunu izliyorum" der, B almalı
B.onSource = (id, url) => {
  log(`[Veli] <- source (host şunu izliyor): ${url}`);
  if (url === 'https://site.tld/bolum-3') results.srcOK = true;
  finishSoon();
};
// Kontrol yetkisi: A (host) Veli'ye kontrol verir, B almalı
B.onControl = (id, ids) => {
  log(`[Veli] <- control ids: ${JSON.stringify(ids)}`);
  if (Array.isArray(ids) && ids.includes(B.selfId)) results.ctlOK = true;
  finishSoon();
};
B.onPresence = (id, url) => { if (url === 'https://site.tld/bolum-3') results.presOK = true; finishSoon(); };
A.onPeer = ((orig) => (id, nm) => {
  orig(id, nm);
  setTimeout(() => { A.sendSource('https://site.tld/bolum-3'); A.sendControl([B.selfId]); A.sendPresence('https://site.tld/bolum-3'); }, 400);
})(A.onPeer);
A.onChat = (id, text) => {
  log(`[Ali] <- chat: "${text}"`);
  if (text === 'selam kanka') results.chatOK = true;
  finishSoon();
};

// Veli, Ali'yi görünce chat yollar; senkronu alınca doğrular
B.onPeer = (id, nm) => {
  results.bSawA = true;
  log(`[Veli] eş bağlandı: ${nm} (${id.slice(0,6)})`);
  setTimeout(() => {
    log('[Veli] -> sendChat "selam kanka"');
    B.sendChat('selam kanka');
  }, 500);
};
B.onSync = (id, sync) => {
  log(`[Veli] <- sync:`, JSON.stringify(sync));
  if (sync.type === 'play' && sync.time === 42) results.syncOK = true;
  finishSoon();
};

let finished = false;
function finishSoon() {
  if (results.syncOK && results.chatOK && results.hbOK && results.srcOK && results.ctlOK && results.presOK && !finished) done(true);
}
function done(ok) {
  if (finished) return;
  finished = true;
  log('\n──────── SONUÇ ────────');
  log('Ali, Veli yi gördü   :', results.aSawB ? '✅' : '❌');
  log('Veli, Ali yi gördü   :', results.bSawA ? '✅' : '❌');
  log('Senkron (play@42)    :', results.syncOK ? '✅' : '❌');
  log('Heartbeat hizalama   :', results.hbOK ? '✅' : '❌');
  log('Host-takip (source)  :', results.srcOK ? '✅' : '❌');
  log('Kontrol yetkisi      :', results.ctlOK ? '✅' : '❌');
  log('Presence (kim nerede) :', results.presOK ? '✅' : '❌');
  log('Chat iletildi        :', results.chatOK ? '✅' : '❌');
  const pass = results.aSawB && results.bSawA && results.syncOK && results.hbOK && results.srcOK && results.ctlOK && results.presOK && results.chatOK;
  log(pass ? '\n🎉 UÇTAN UCA GEÇTİ — P2P birlikte-izle çalışıyor' : '\n❌ TEST BAŞARISIZ');
  try { A.leave(); B.leave(); } catch {}
  setTimeout(() => process.exit(pass ? 0 : 1), 300);
}

// Başlat: önce Ali, kısa süre sonra Veli
A.connect(ROOM, 'Ali');
setTimeout(() => B.connect(ROOM, 'Veli'), 600);

// Güvenlik zaman aşımı
setTimeout(() => { log('\n⏱ zaman aşımı'); done(false); }, 20000);
