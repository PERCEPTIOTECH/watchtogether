// WatchTogether — "sonraki bölüm" senaryosu + ping-pong yokluğu testi.
// Gerçek Mesh (WebRTC data channel) üzerinden panelin host-takip kuralını modeller:
//   - host (isCreator) source yayar, ASLA takip etmez
//   - misafir farklı bölümdeyse bir kez host'un URL'sine geçer, sonra durur
//   - host bölüm değiştirip YENİDEN bağlanınca (yeni id) yine host kalır → geri çekilmez

import * as ndc from 'node-datachannel/polyfill';
const P = ndc.default || ndc;
globalThis.RTCPeerConnection = P.RTCPeerConnection;
globalThis.RTCSessionDescription = P.RTCSessionDescription;
globalThis.RTCIceCandidate = P.RTCIceCandidate;
globalThis.MediaStream = P.MediaStream || class { addTrack() {} getTracks() { return []; } };

const { Mesh } = await import('../extension/rtc.js');
const ROOM = 'NEXTEP';
const base0 = (u) => (u || '').split('#')[0];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function client(name, creator, startBase) {
  const st = { name, creator, base: startBase, navs: [], token: null, m: new Mesh() };
  st.m.onHostToken = (t) => { st.token = t; };                         // host token'ı sakla (sayfa değişince reclaim)
  st.m.onPeer = () => { if (st.m.amHost()) st.m.sendSource(st.base); };
  st.m.onSource = (id, url) => {
    if (st.m.amHost()) return;                                         // host takip ETMEZ (ping-pong önlenir)
    if (url && base0(url) !== base0(st.base)) { st.navs.push(base0(url)); st.base = base0(url); }
  };
  return st;
}

const log = (...a) => console.log(...a);

// Bölüm 2'de host Ali + misafir Veli
let ali = client('Ali', true, 'https://site.tld/bolum-2');
const veli = client('Veli', false, 'https://site.tld/bolum-2');

ali.m.connect(ROOM, 'Ali');
await wait(600); veli.m.connect(ROOM, 'Veli');
await wait(3000);
log(`Faz 1 — ikisi de bölüm-2. Veli takip sayısı: ${veli.navs.length} (0 olmalı)`);

// Host "Sonraki Bölüm"e geçiyor: eski bağlantıyı bırak, YENİ id ile (ama yine host) tekrar bağlan
log('Host bölüm-3\'e geçiyor (sayfa yenilenmesi simülasyonu)…');
const savedToken = ali.token;                            // host token'ı sakla
ali.m.leave();
await wait(500);
ali = client('Ali', true, 'https://site.tld/bolum-3');   // yeni Mesh = yeni selfId
ali.m.hostToken = savedToken;                            // token'la host'luğu geri al
ali.m.connect(ROOM, 'Ali');
await wait(3500);
ali.m.sendSource(ali.base);                               // periyodik kaynak yayını
await wait(1500);

log('\n──────── SONUÇ ────────');
const veliFollowed = veli.navs.length === 1 && veli.navs[0] === 'https://site.tld/bolum-3';
const veliStable = veli.navs.length === 1;                // birden fazla kez zıplamadı
const hostNeverFollowed = ali.navs.length === 0;
log('Misafir host\'u bölüm-3\'e takip etti :', veliFollowed ? '✅' : `❌ (${JSON.stringify(veli.navs)})`);
log('Misafir tek sefer geçti (ping yok)   :', veliStable ? '✅' : `❌ (${veli.navs.length})`);
log('Host asla geri çekilmedi             :', hostNeverFollowed ? '✅' : '❌');
const pass = veliFollowed && veliStable && hostNeverFollowed;
log(pass ? '\n🎉 SONRAKİ BÖLÜM AKIŞI GEÇTİ — ping-pong yok' : '\n❌ BAŞARISIZ');
try { ali.m.leave(); veli.m.leave(); } catch {}
setTimeout(() => process.exit(pass ? 0 : 1), 300);
