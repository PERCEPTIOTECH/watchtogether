// WatchTogether — gecikme (RTT) ölçümü testi.
// İki eş bağlanır, ping/pong ile RTT ölçülür; rttTo(peer) pozitif ve makul olmalı.

import * as ndc from 'node-datachannel/polyfill';
const P = ndc.default || ndc;
globalThis.RTCPeerConnection = P.RTCPeerConnection;
globalThis.RTCSessionDescription = P.RTCSessionDescription;
globalThis.RTCIceCandidate = P.RTCIceCandidate;
globalThis.MediaStream = P.MediaStream || class { addTrack() {} getTracks() { return []; } };

const { Mesh } = await import('../extension/rtc.js');
const log = (...a) => console.log(...a);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ROOM = 'RTTTEST';

const A = new Mesh(), B = new Mesh();
A.connect(ROOM, 'A');
await wait(600); B.connect(ROOM, 'B');

// ping döngüsü 2sn → birkaç tur bekle
await wait(6000);

const ab = A.rttTo(B.selfId);
const ba = B.rttTo(A.selfId);
log(`A→B RTT: ${ab.toFixed(1)}ms · B→A RTT: ${ba.toFixed(1)}ms`);

log('\n──────── SONUÇ ────────');
const abOk = ab > 0 && isFinite(ab) && ab < 5000;
const baOk = ba > 0 && isFinite(ba) && ba < 5000;
log('A→B gecikme ölçüldü :', abOk ? '✅' : '❌');
log('B→A gecikme ölçüldü :', baOk ? '✅' : '❌');
const pass = abOk && baOk;
log(pass ? '\n🎉 GECİKME ÖLÇÜMÜ ÇALIŞIYOR (telafi için hazır)' : '\n❌ BAŞARISIZ');
process.on('uncaughtException', () => {});
try { A.leave(); B.leave(); } catch {}
setTimeout(() => process.exit(pass ? 0 : 1), 200);
