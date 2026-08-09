// WatchTogether — mesaj YETKİLENDİRME testi.
// Sunucu host'u belirler; alıcı taraf yetkisiz privileged mesajları reddetmeli.
// Senaryo: host A + guest B.
//  - B (guest) nav/hb/ctl/erken-sync yollar → A KABUL ETMEMELİ (görmezden gel)
//  - A (host) nav yollar → B kabul etmeli
//  - A, B'ye kontrol verir → B kabul etmeli; sonra B'nin sync'i A'ya ULAŞMALI

import * as ndc from 'node-datachannel/polyfill';
const P = ndc.default || ndc;
globalThis.RTCPeerConnection = P.RTCPeerConnection;
globalThis.RTCSessionDescription = P.RTCSessionDescription;
globalThis.RTCIceCandidate = P.RTCIceCandidate;
globalThis.MediaStream = P.MediaStream || class { addTrack() {} getTracks() { return []; } };

const { Mesh } = await import('../extension/rtc.js');
const log = (...a) => console.log(...a);
const ROOM = 'AUTHTEST';

const A = new Mesh(), B = new Mesh();
const g = { aUnauthNav: false, aUnauthHb: false, aUnauthCtl: false, bHostNav: false, bCtl: false, aSyncTimes: [] };

// A (host) — guest'ten gelen yetkisiz mesajları ASLA görmemeli
A.onNavigate = () => { g.aUnauthNav = true; };
A.onHeartbeat = () => { g.aUnauthHb = true; };
A.onControl = () => { g.aUnauthCtl = true; };
A.onSync = (id, s) => { g.aSyncTimes.push(s.time); };
g.reqNextCount = 0;
A.onReqNext = () => { g.reqNextCount++; };   // yetkisizken 0, yetki verilince 1 olmalı

// B (guest) — host'tan gelen mesajları kabul etmeli
B.onNavigate = () => { g.bHostNav = true; };
B.onControl = () => { g.bCtl = true; };

let bArmed = false, aArmed = false;            // onPeer dc-open + hello ile 2 kez tetiklenir → tek sefere sabitle
B.onPeer = () => {
  if (bArmed) return; bArmed = true;
  // B guest: yetkisiz denemeler (hepsi reddedilmeli) + erken sync/reqnext (kontrol yokken)
  B.sendNavigate('https://evil.example');
  B.sendHeartbeat({ time: 5, paused: false });
  B.sendControl([B.selfId]);
  B.sendSync({ type: 'play', time: 1 });     // kontrol yokken → reddedilmeli
  B.sendReqNext();                            // kontrol yokken → host almamalı
};
A.onPeer = () => {
  if (aArmed) return; aArmed = true;
  setTimeout(() => {
    A.sendNavigate('https://good.example');  // host → B kabul etmeli
    A.sendControl([B.selfId]);               // B'ye kontrol ver
    setTimeout(() => { B.sendSync({ type: 'play', time: 9 }); B.sendReqNext(); }, 600);  // artık B controller → A kabul etmeli
  }, 700);
};

A.connect(ROOM, 'A');
setTimeout(() => B.connect(ROOM, 'B'), 500);

setTimeout(() => {
  const hostOk = A.amHost() && !B.amHost() && B.hostId === A.selfId;
  const rejectOk = !g.aUnauthNav && !g.aUnauthHb && !g.aUnauthCtl && !g.aSyncTimes.includes(1);
  const acceptOk = g.bHostNav && g.bCtl && g.aSyncTimes.includes(9);
  const reqNextOk = g.reqNextCount === 1;   // yetkisiz reddedildi, yetkiliyken 1 kez geçti
  log('\n──────── SONUÇ ────────');
  log('Sunucu host\'u doğru belirledi        :', hostOk ? '✅' : '❌');
  log('Yetkisiz guest mesajları reddedildi  :', rejectOk ? '✅' : `❌ nav=${g.aUnauthNav} hb=${g.aUnauthHb} ctl=${g.aUnauthCtl} sync1=${g.aSyncTimes.includes(1)}`);
  log('Host mesajları + verilen yetki geçti :', acceptOk ? '✅' : `❌ nav=${g.bHostNav} ctl=${g.bCtl} sync9=${g.aSyncTimes.includes(9)}`);
  log('Sonraki-bölüm isteği yetki denetimi  :', reqNextOk ? '✅' : `❌ (${g.reqNextCount})`);
  const pass = hostOk && rejectOk && acceptOk && reqNextOk;
  log(pass ? '\n🎉 MESAJ YETKİLENDİRME ÇALIŞIYOR' : '\n❌ BAŞARISIZ');
  process.on('uncaughtException', () => {});
  try { A.leave(); B.leave(); } catch {}
  setTimeout(() => process.exit(pass ? 0 : 1), 200);
}, 4000);
