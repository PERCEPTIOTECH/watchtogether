// WatchTogether — panel UI (v6: profesyonel arayüz + kontrol yetkisi).
import { Mesh } from './rtc.js';
import { basePage, shortUrl, initials, fmt, hashStr } from './util.js';

const $ = (id) => document.getElementById(id);
const mesh = new Mesh();

let pageUrl = '', joined = false, micOn = true, camOn = true, cinemaOn = false;
let isCreator = false, autoTried = false, curRoom = '', curName = '';
const roster = new Map();               // key ('self'|peerId) -> {name, mic, cam}
const grantedNames = new Set();         // host: kontrol verilen İSİMLER (F5 sonrası id değişse de korunur)
let queue = [];
let vstate = { time: 0, duration: 0, paused: true, at: 0 };
let seeking = false, loopTimer = null, hasVideo = false, noVideoTimer = null;

const realId = (key) => (key === 'self' ? mesh.selfId : key);
// Otorite artık sunucu-belirli: host = mesh.hostId, kontrol = mesh.controllers
const canControl = () => mesh.iCanControl();
const amHost = () => mesh.amHost();

// Düz renk avatar paleti (profesyonel, tek renk)
const PAL = ['#ff5a5f', '#ff9f45', '#ffd23f', '#2ee6a0', '#38bdf8', '#a78bfa', '#f472b6', '#22d3c5'];
const palOf = (id) => PAL[hashStr(id) % PAL.length];

// SVG ikonlar (stroke, sade)
const svg = (p, s, fill) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}">${fill ? `<path d="${p}" fill="currentColor"/>` : `<path d="${p}" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`}</svg>`;
const IC = {
  mic: (s = 16) => svg('M12 3a3 3 0 013 3v6a3 3 0 01-6 0V6a3 3 0 013-3zM6 11a6 6 0 0012 0M12 17v4', s),
  micOff: (s = 16) => svg('M15 9V6a3 3 0 00-5.6-1.5M9 9.5V12a3 3 0 004.5 2.6M6 11a7 7 0 0010.5 5.5M12 17v4M4 4l16 16', s),
  cam: (s = 16) => svg('M3 7h11v10H3zM14 10l7-3v10l-7-3', s),
  camOff: (s = 16) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}"><path d="M3 7h11v10H3zM14 10l7-3v10l-7-3" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linejoin="round"/><path d="M3 3l18 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  host: (s = 14) => svg('M5 8l3.5 3L12 6l3.5 5L19 8l-1.5 9h-11z', s, true),
  key: (s = 14) => svg('M14 7a3 3 0 100 6 3 3 0 000-6zM11.5 11.5L6 17v2h2v-1.5h1.5V16l2-2', s),
};

// ---- Köprü ----
function toParent(kind, extra = {}) { parent.postMessage({ wt: true, source: 'panel', kind, ...extra }, '*'); }
function videoCmd(cmd) { toParent('video-cmd', { cmd }); }

let ownUrl = '', tabsCache = [], targetTabId = null;
window.addEventListener('message', (e) => {
  const m = e.data;
  if (!m || !m.wt) return;
  if (m.kind === 'page-url') {
    const url = m.url || '';
    ownUrl = url;                                   // kendi sekmemizin güncel URL'i (SPA dahil)
    if (targetTabId == null) {
      const changed = pageUrl && basePage(pageUrl) !== basePage(url);
      pageUrl = url;                                // özel kaynak seçilmediyse host bunu yayar
      if (changed && joined && amHost()) { mesh.sendSource(basePage(pageUrl)); toParent('video-query'); }  // anında bildir
    }
    maybeAutoJoin(m.session);
  }
  else if (m.kind === 'video-event') handleVideoEvent(m.event);
  else if (m.kind === 'cinema-state') { cinemaOn = m.on; $('cinemaBtn').classList.toggle('on', cinemaOn); }
  else if (m.kind === 'tabs') populateTabs(m.tabs, m.current, m.target);
  else if (m.kind === 'next-result') { if (!m.ok) addSys('Bu sayfada "sonraki bölüm" düğmesi bulunamadı — sıradakiyle veya elle geçebilirsin'); }
  else if (m.kind === 'chat-send') { const t = (m.text || '').trim(); if (t) { mesh.sendChat(t); addMsg('Sen', t, true, mesh.selfId); } }
});
toParent('request-url');

// ---- Tutorial ----
function showTut() { $('tutorial').classList.remove('hidden'); }
function hideTut() { $('tutorial').classList.add('hidden'); try { localStorage.setItem('wt-tut', '1'); } catch {} }
$('helpBtn').onclick = showTut;
$('tutX').onclick = hideTut;
$('tutDone').onclick = hideTut;
try { if (!localStorage.getItem('wt-tut')) setTimeout(showTut, 500); } catch {}

// ---- Signaling sunucu adresi ----
const DEFAULT_SIGNAL = 'wss://watchtogether-signaling.onrender.com';   // deploy edilen sunucu (varsayılan)
mesh.signalUrl = DEFAULT_SIGNAL;
try {
  chrome?.storage?.local?.get?.('wt-signal', (r) => {
    const u = (r && r['wt-signal']) || DEFAULT_SIGNAL;   // kaydedilmiş varsa onu, yoksa varsayılanı
    mesh.signalUrl = u;
    if ($('signalInput')) $('signalInput').value = u;
  });
} catch {}
$('signalInput')?.addEventListener('change', () => {
  const u = $('signalInput').value.trim();
  mesh.signalUrl = u || null;
  try { chrome?.storage?.local?.set?.({ 'wt-signal': u }); } catch {}
  addSys(u ? ('Sunucu ayarlandı: ' + u) : 'Sunucu: localhost');
});

// ---- Select Video (hangi sekmedeki video) ----
function bgSend(msg, cb) {
  try { if (chrome?.runtime?.sendMessage) { chrome.runtime.sendMessage({ wt: true, ...msg }, (r) => { void chrome.runtime.lastError; cb && cb(r); }); return true; } } catch {}
  return false;
}
function requestTabs() {
  // Panel bir eklenti sayfası → chrome.tabs'e DOĞRUDAN erişebilir (röleye gerek yok)
  try {
    if (chrome?.tabs?.query) {
      chrome.tabs.query({}, (all) => {
        if (chrome.runtime.lastError || !all) { toParent('list-tabs'); return; }
        chrome.tabs.query({ active: true, lastFocusedWindow: true }, (act) => {
          const current = act && act[0] ? act[0].id : null;
          const list = all.filter((t) => t.id != null && /^https?:/.test(t.url || ''))
            .map((t) => ({ id: t.id, title: t.title || t.url, url: t.url }));
          populateTabs(list, current, targetTabId);
        });
      });
      return;
    }
  } catch {}
  toParent('list-tabs');   // yedek: content-panel üzerinden
}
function populateTabs(tabs, current, target) {
  tabsCache = tabs || [];
  const sel = $('videoSelect'), prev = sel.value;
  sel.innerHTML = '';
  const cur = document.createElement('option'); cur.value = ''; cur.textContent = 'Bu sekme (video burada)';
  sel.appendChild(cur);
  for (const t of tabsCache) {
    if (t.id === current) continue;
    const o = document.createElement('option'); o.value = String(t.id);
    o.textContent = (t.title || t.url || '').slice(0, 52);
    sel.appendChild(o);
  }
  sel.value = (target != null ? String(target) : '') || prev || '';
}
$('videoSelect').addEventListener('focus', requestTabs);
$('tabRefresh').onclick = requestTabs;
$('videoSelect').onchange = () => {
  const v = $('videoSelect').value;
  targetTabId = v ? Number(v) : null;
  // Hedefi doğrudan background'a bildir (content-panel eski olsa bile çalışsın), yedek röle
  if (!bgSend({ kind: 'set-target', tabId: targetTabId })) toParent('set-target', { tabId: targetTabId });
  if (v) { const t = tabsCache.find((x) => String(x.id) === v); if (t) { pageUrl = t.url; addSys('Video kaynağı: ' + (t.title || t.url).slice(0, 40)); } }
  else { pageUrl = ownUrl; addSys('Video kaynağı: bu sekme'); }
  setTimeout(() => toParent('video-query'), 200);
};

// ---- Otomatik katılma ----
function maybeAutoJoin(session) {
  if (autoTried || joined) return;
  // 1) Sayfa oturumu (aynı sekme) → sessizce yeniden katıl
  if (session && session.room) {
    autoTried = true;
    startRoom(session.room, { creator: !!session.creator, silent: true, token: session.token, name: session.name });
    return;
  }
  // 2) Davet linki (#wt-join) → eklenti deposunda isim varsa SORMADAN katıl, yoksa isim iste
  const match = /wt-join=([A-Z0-9]+)/i.exec((pageUrl.split('#')[1]) || '');
  if (!match) return;
  const hashRoom = match[1].toUpperCase();
  autoTried = true;
  let handled = false;
  try {
    if (chrome?.storage?.local?.get) {
      handled = true;
      chrome.storage.local.get('wt-last', (r) => {
        const last = (r && r['wt-last']) || null;
        if (last && last.name) {
          const sameRoom = last.room === hashRoom;   // aynı oda → host token'ıyla reclaim
          startRoom(hashRoom, { creator: sameRoom && !!last.creator, token: sameRoom ? last.token : null, silent: true, name: last.name });
        } else enterJoinMode(hashRoom);
      });
    }
  } catch {}
  if (!handled) enterJoinMode(hashRoom);
}
function enterJoinMode(code) {
  document.querySelector('.hero-title').textContent = 'Odaya katıl';
  document.querySelector('.hero-sub').textContent = `Oda kodu: ${code}`;
  $('createBtn').classList.add('hidden');
  $('lobbyOr').classList.add('hidden');
  $('roomInput').value = code; $('roomInput').readOnly = true;
  $('joinBtn').textContent = 'Bu odaya katıl';
}

// ---- Video senkron çekirdeği ----
function handleVideoEvent(ev) {
  if (ev.type === 'none') return;
  hasVideo = true; clearTimeout(noVideoTimer);          // gerçek video bulundu
  const paused = ev.type === 'pause';
  vstate = { time: ev.time || 0, duration: ev.dur || vstate.duration || 0, paused, at: Date.now() };
  setSync(paused ? 'ok-pause' : 'ok-play');
  if (ev.query) {
    if (joined && amHost()) mesh.sendHeartbeat({ time: ev.time, paused, dur: ev.dur });
  } else {
    // Gerçek kullanıcı aksiyonu SADECE yetkisi olan kişide odaya yayılır
    if (joined && canControl()) mesh.sendSync(ev);
  }
}

// ---- Medya + konuşma ----
let audioCtx = null; const analysers = new Map();
function watchSpeaking(id, stream) {
  if (!stream.getAudioTracks().length) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const src = audioCtx.createMediaStreamSource(stream);
    const an = audioCtx.createAnalyser(); an.fftSize = 512; src.connect(an);
    analysers.set(id, { analyser: an, data: new Uint8Array(an.frequencyBinCount) });
  } catch {}
}
function speakingLoop() {
  for (const [id, { analyser, data }] of analysers) {
    analyser.getByteFrequencyData(data);
    let sum = 0; for (const v of data) sum += v;
    const spk = (sum / data.length) > 12;
    document.querySelector(`.tile[data-id="${CSS.escape(id)}"]`)?.classList.toggle('speaking', spk);
    document.querySelector(`.urow[data-id="${CSS.escape(id)}"]`)?.classList.toggle('speaking', spk);
  }
  requestAnimationFrame(speakingLoop);
}
requestAnimationFrame(speakingLoop);

async function initMedia() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    await mesh.setLocalStream(stream);
    addTile('self', roster.get('self')?.name || 'Sen', stream, true);
    watchSpeaking('self', stream);
  } catch {
    micOn = camOn = false; updateMediaButtons();
    const r = roster.get('self'); if (r) { r.mic = false; r.cam = false; }
    addSys('Kamera/mikrofon kapalı — yalnızca izleme ve sohbet');
  }
}

// ---- Oda akışı ----
$('createBtn').onclick = () => startRoom(Mesh.newRoom(), { creator: true });
$('joinBtn').onclick = () => { const c = $('roomInput').value.trim().toUpperCase(); if (c) startRoom(c, { creator: false }); };
$('roomInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('joinBtn').click(); });

function saveIdentity() {
  try { chrome?.storage?.local?.set?.({ 'wt-last': { room: curRoom, name: curName, creator: isCreator, token: mesh.hostToken } }); } catch {}
}
async function startRoom(room, opts = {}) {
  const name = (opts.name || $('nameInput').value.trim() || 'Misafir');
  $('nameInput').value = name;
  isCreator = !!opts.creator; curRoom = room; curName = name;
  mesh.hostToken = opts.token || null;      // token varsa host'luğu geri al (sayfa değişimi)
  saveIdentity();                            // ismi/odayı/token'ı eklenti deposuna sakla
  roster.set('self', { name, mic: micOn, cam: camOn });
  wireMesh();
  await initMedia();
  mesh.connect(room, name);
  joined = true;
  $('lobby').classList.add('hidden');
  $('room').classList.remove('hidden');
  $('roomCode').textContent = room;
  renderUsers(); setSync('wait'); renderQueue(); updateControlUI(); requestTabs();
  hasVideo = false;                                     // video var mı? 6sn içinde rapor gelmezse uyar
  clearTimeout(noVideoTimer);
  noVideoTimer = setTimeout(() => { if (joined && !hasVideo) setSync('err-novideo'); }, 6000);
  toParent('session-active', { on: true, room, name, creator: isCreator, token: mesh.hostToken });

  if (!opts.silent) {
    addSys(`Odaya katıldın · ${room}`);
    if (isCreator) {
      const link = `${basePage(pageUrl)}#wt-join=${room}`;
      const ok = await copyText(link);
      if (ok) addSys('Davet linki panoya kopyalandı — arkadaşına gönder.');
      else { addSys('Davet linki (elle kopyala):'); addSys(link); }
    }
  }
  let tick = 0;
  clearInterval(loopTimer);                            // eski döngü varsa durdur (üst üste binmesin)
  loopTimer = setInterval(() => {
    if (!joined) return;
    toParent('video-query');
    if (amHost()) refreshHostUrl();                   // gerçek sekme URL'ini oku (SPA dahil)
    if (tick % 2 === 0) {                              // ~2sn'de bir
      mesh.sendPresence(basePage(pageUrl));           // "ben şu an buradayım" (herkes)
      if (amHost()) mesh.sendSource(basePage(pageUrl));
    }
    // Ölçülen gecikmeyi durum çubuğunda göster
    if (mesh.peers.size) {
      let sum = 0, n = 0;
      for (const [pid] of mesh.peers) { const r = mesh.rttTo(pid); if (r) { sum += r; n++; } }
      if (n) renderConn(sum / n);
    }
    tick++;
  }, 1000);
  setTimeout(() => toParent('video-query'), 500);
}

// Panelin kendi sekme id'si (aktif sekme DEĞİL → host başka sekmeye geçince kimseyi sürüklemez)
let myTabId = null;
try { chrome?.tabs?.getCurrent?.((t) => { if (t && t.id != null) myTabId = t.id; }); } catch {}

// Host: kontrol ettiği sekmenin URL'ini chrome.tabs ile DOĞRUDAN oku. Değişince (başka
// video/bölüm) hemen herkese yay. Sekme id'si bilinmiyorsa content-panel'in bildirimine güven.
function refreshHostUrl() {
  const id = targetTabId != null ? targetTabId : myTabId;
  if (id == null) return;
  try { chrome?.tabs?.get?.(id, (t) => { if (!chrome.runtime.lastError && t && t.url) applyHostUrl(t.url); }); } catch {}
}
function applyHostUrl(url) {
  if (!/^https?:/.test(url)) return;
  if (basePage(url) !== basePage(pageUrl)) {
    pageUrl = url; ownUrl = url;
    mesh.sendSource(basePage(pageUrl));
    addSys('Video değişti — herkese yayınlanıyor');
    toParent('video-query');
  }
}

function wireMesh() {
  mesh.onStatus = setConn;
  // Sunucu host'u belirledi/değiştirdi → UI tazele
  mesh.onHost = () => { updateControlUI(); renderUsers(); };
  // Sunucu bana host token verdi → oturuma kaydet (sayfa değişince reclaim)
  mesh.onHostToken = (tok) => { toParent('session-active', { on: true, room: curRoom, name: curName, creator: isCreator, token: tok }); saveIdentity(); };
  mesh.onPeer = (id, name) => {
    const r = roster.get(id) || { mic: true, cam: true }; r.name = name; roster.set(id, r);
    renderUsers(); renderName(id, name);
    if (amHost()) { mesh.sendSource(basePage(pageUrl)); recomputeControllers(); }   // isme göre yetkiyi yeniden uygula
  };
  mesh.onLeave = (id, info) => {
    const nm = roster.get(id)?.name;
    roster.delete(id); mesh.controllers.delete(id); removeTile(id); analysers.delete(id); renderUsers();
    if (info && info.connected === false) addSys(`⚠️ ${nm || 'Bir kullanıcı'} ile bağlantı kurulamadı — ağ/güvenlik duvarı engelliyor olabilir`);
    else addSys(`${nm || 'Bir katılımcı'} ayrıldı`);
  };
  mesh.onStream = (id, stream) => { addTile(id, roster.get(id)?.name || 'Katılımcı', stream, false); watchSpeaking(id, stream); };
  mesh.onChat = (id, text) => addMsg(roster.get(id)?.name || 'Katılımcı', text, false, realId(id));
  mesh.onSync = (id, sync) => {
    // Gecikme telafisi (oynarken): gönderenden bize gelen tek-yön gecikmeyi ekle
    const willPlay = sync.type === 'play' ? true : sync.type === 'pause' ? false : !vstate.paused;
    const oneWay = Math.min(2, (mesh.rttTo(id) / 2) / 1000);
    const cmd = { ...sync };
    if (typeof sync.time === 'number') cmd.time = sync.time + (willPlay ? oneWay : 0);
    videoCmd(cmd);
    // Bar'ı ANINDA güncelle (video 'seeked' olayı applyingRemote yüzünden bastırılıyor)
    if (typeof cmd.time === 'number') { vstate.time = cmd.time; vstate.at = Date.now(); }
    if (sync.type === 'play' || sync.type === 'pause') vstate.paused = sync.type === 'pause';
    flashSync(sync);
  };
  mesh.onHeartbeat = (id, hb) => {
    if (amHost()) return;
    // Gecikme telafisi: host'un konumu, mesaj bize ulaşana dek ilerledi → tek-yön ekle (oynarken)
    const oneWay = Math.min(2, (mesh.hostRtt() / 2) / 1000);
    const t = (hb.time || 0) + (hb.paused ? 0 : oneWay);
    videoCmd({ type: hb.paused ? 'pause' : 'play', time: t, dur: hb.dur });
    vstate = { time: t, duration: hb.dur || vstate.duration || 0, paused: hb.paused, at: Date.now() };
    setSync(hb.paused ? 'ok-pause' : 'ok-play');
  };
  mesh.onMediaState = (id, st) => {
    const r = roster.get(id) || {}; r.mic = st.mic; r.cam = st.cam; roster.set(id, r);
    document.querySelector(`.tile[data-id="${CSS.escape(id)}"]`)?.classList.toggle('camoff', !st.cam);
    renderUsers();
  };
  mesh.onPresence = (id, url) => { const r = roster.get(id); if (r) { r.url = url; renderUsers(); } };
  mesh.onReqNext = () => { if (amHost()) doNextEpisode(); };   // yetkili istedi → host uygular → herkes geçer
  mesh.onNavigate = (id, url) => toParent('navigate', { url });
  mesh.onQueue = (id, items) => { queue = items || []; renderQueue(); };
  mesh.onSource = (id, url) => {
    // rtc yalnızca host'tan geçirir; ben host'sam takip etmem
    if (amHost()) return;
    if (url && basePage(url) !== basePage(pageUrl)) {
      const room = $('roomCode').textContent;
      addSys('Host sonraki bölüme geçti — takip ediliyor');
      toParent('navigate', { url: `${basePage(url)}#wt-join=${room}` });
    }
  };
  mesh.onControl = () => {
    // rtc, host'tan gelen ctl ile mesh.controllers'ı zaten güncelledi
    updateControlUI(); renderUsers();
    if (!amHost() && mesh.controllers.has(mesh.selfId)) addSys('Kontrol sana verildi — artık oynatabilir/sarabilirsin');
  };
}

// ---- Kontrol yetkisi UI ----
function updateControlUI() {
  const allowed = canControl();
  $('player').classList.toggle('locked', !allowed);
  $('syncAllBtn').classList.toggle('hidden', !amHost());   // sadece host "herkesi eşitle" görür
  $('nextEpBtn').classList.toggle('hidden', !allowed);     // kontrol yetkisi olan "sonraki bölüm" görür
  const note = !mesh.hostId ? 'Host bekleniyor…' : allowed ? (amHost() ? 'Kontrol sende (host)' : 'Kontrol sende') : 'Kontrol host’ta';
  $('ctlNote').textContent = note;
}
function toggleGrant(rid, name) {
  if (!amHost()) return;
  if (grantedNames.has(name)) grantedNames.delete(name); else grantedNames.add(name);
  recomputeControllers();
}
// Host: verilen İSİMLERE göre kontrol id listesini yeniden kur ve yayınla
function recomputeControllers() {
  if (!amHost()) return;
  const ids = [];
  for (const [key, u] of roster) { if (key === 'self') continue; if (grantedNames.has(u.name)) ids.push(realId(key)); }
  mesh.sendControl(ids); renderUsers(); updateControlUI();
}

// Katılımcı senkron özeti (kaçı seninle aynı videoda)
function updateSyncSummary() {
  const el = $('syncSummary'); if (!el) return;
  const myBase = basePage(pageUrl);
  let total = 0, together = 0;
  for (const [key, u] of roster) { if (key === 'self') continue; total++; if (u.url === myBase) together++; }
  el.classList.remove('ok', 'warn');
  if (total === 0) { el.textContent = ''; return; }
  if (together === total) { el.textContent = 'hepsi senkron'; el.classList.add('ok'); }
  else { el.textContent = `${total - together} kişi farklı videoda`; el.classList.add('warn'); }
}

// ---- Katılımcı listesi ----
function renderUsers() {
  const list = $('userList'); list.innerHTML = '';
  $('userCount').textContent = roster.size;
  updateSyncSummary();
  const keys = [...roster.keys()].sort((a) => (a === 'self' ? -1 : 1));
  for (const key of keys) {
    const u = roster.get(key), rid = realId(key), host = rid === mesh.hostId;
    const row = document.createElement('div');
    row.className = 'urow'; row.dataset.id = key;

    const av = document.createElement('span'); av.className = 'uav';
    av.style.background = palOf(rid); av.textContent = initials(u.name);

    const nmWrap = document.createElement('div'); nmWrap.className = 'uname-wrap';
    const nm = document.createElement('span'); nm.className = 'uname';
    nm.textContent = u.name + (key === 'self' ? ' (sen)' : '');
    nmWrap.appendChild(nm);
    if (key !== 'self') {                                  // hangi videoda + senkron mu
      const sub = document.createElement('span'); sub.className = 'usub';
      const myBase = basePage(pageUrl);
      if (!u.url) sub.textContent = 'bağlanıyor…';
      else if (u.url === myBase) { sub.classList.add('ok'); sub.textContent = 'senkron · aynı videoda'; }
      else { sub.classList.add('diff'); sub.textContent = 'farklı: ' + shortUrl(u.url); sub.title = u.url; }
      nmWrap.appendChild(sub);
    }

    const st = document.createElement('span'); st.className = 'ustatus';
    if (host) st.insertAdjacentHTML('beforeend', `<span class="s-host" title="Host">${IC.host(14)}</span>`);
    if (u.mic === false) st.insertAdjacentHTML('beforeend', `<span class="s-mute" title="Mikrofon kapalı">${IC.micOff(15)}</span>`);
    // Kontrol yetkisi göstergesi / host için ver-al düğmesi
    if (!host) {
      const granted = amHost() ? grantedNames.has(u.name) : mesh.controllers.has(rid);
      if (amHost()) {
        const b = document.createElement('span');
        b.className = 's-ctl' + (granted ? ' granted' : '');
        b.title = granted ? 'Kontrol yetkisini al' : 'Kontrol yetkisi ver';
        b.innerHTML = IC.key(14);
        b.onclick = () => toggleGrant(rid, u.name);
        st.appendChild(b);
      } else if (granted) {
        st.insertAdjacentHTML('beforeend', `<span class="s-ctl granted" title="Kontrol yetkisi var">${IC.key(14)}</span>`);
      }
    }
    row.append(av, nmWrap, st); list.appendChild(row);
  }
}

// ---- Kutucuklar ----
function addTile(id, name, stream, isSelf) {
  let tile = document.querySelector(`.tile[data-id="${CSS.escape(id)}"]`);
  if (!tile) {
    tile = document.createElement('div'); tile.className = 'tile'; tile.dataset.id = id;
    if (isSelf) tile.dataset.self = '1';
    const v = document.createElement('video'); v.autoplay = true; v.playsInline = true; if (isSelf) v.muted = true;
    const off = document.createElement('div'); off.className = 'tile-off'; off.innerHTML = IC.camOff(26);
    const label = document.createElement('span'); label.className = 'name'; label.textContent = isSelf ? `${name} (sen)` : name;
    tile.append(v, off, label); $('videos').appendChild(tile);
  }
  tile.querySelector('video').srcObject = stream;
}
function removeTile(id) { document.querySelector(`.tile[data-id="${CSS.escape(id)}"]`)?.remove(); }
function renderName(id, name) { const t = document.querySelector(`.tile[data-id="${CSS.escape(id)}"] .name`); if (t) t.textContent = name; }

// ---- Senkron durumu ----
function setSync(kind) {
  const b = $('syncBadge'), t = $('syncText');
  b.classList.remove('ok', 'warn', 'err');
  if (kind === 'wait') { t.textContent = 'eşitleniyor…'; b.classList.add('warn'); }
  else if (kind === 'ok-play') { t.textContent = 'Eşitlendi · oynatılıyor'; b.classList.add('ok'); }
  else if (kind === 'ok-pause') { t.textContent = 'Eşitlendi · duraklatıldı'; b.classList.add('ok'); }
  else if (kind === 'err-novideo') { t.textContent = 'Bu sekmede video bulunamadı'; b.classList.add('err'); }
}
let flashTimer = null;
function flashSync(sync) {
  const b = $('syncBadge'); b.classList.remove('ok'); b.classList.add('warn'); $('syncText').textContent = 'eşitleniyor…';
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => setSync(sync.type === 'pause' ? 'ok-pause' : 'ok-play'), 500);
}
let connText = 'hazır';
function setConn(text) {
  connText = text;
  const p = $('connPill');
  p.classList.remove('on', 'wait');
  if (text.trim() === 'bağlı') p.classList.add('on'); else if (/bağlan|eşler|bekleniyor/.test(text)) p.classList.add('wait');
  renderConn();
}
function renderConn(ms) {
  const ping = (ms && ms > 0) ? ` · ${Math.round(ms)}ms` : '';
  $('connPill').innerHTML = `<i class="pulse"></i> ${connText}${ping}`;
}

// ---- Player ----
const PLAY_SVG = svg('M8 5v14l11-7z', 16, true);
const PAUSE_SVG = '<svg viewBox="0 0 24 24" width="16" height="16"><path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor"/></svg>';
function playerLoop() {
  let t = vstate.time;
  if (!vstate.paused && vstate.duration) t = Math.min(vstate.duration, vstate.time + (Date.now() - vstate.at) / 1000);
  if (!seeking && vstate.duration > 0) {
    const r = Math.max(0, Math.min(1, t / vstate.duration)) * 100;
    $('seekFill').style.width = r + '%'; $('seekKnob').style.left = r + '%';
    $('curTime').textContent = fmt(t); $('durTime').textContent = fmt(vstate.duration);
  }
  $('playBtn').innerHTML = vstate.paused ? PLAY_SVG : PAUSE_SVG;
  requestAnimationFrame(playerLoop);
}
requestAnimationFrame(playerLoop);

$('playBtn').onclick = () => {
  if (!canControl()) return;
  const play = vstate.paused, type = play ? 'play' : 'pause';
  videoCmd({ type }); if (joined) mesh.sendSync({ type });
  vstate.paused = !play; vstate.at = Date.now();
};
const seekEl = $('seek');
function ratioAt(e) { const r = seekEl.getBoundingClientRect(); return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)); }
function previewSeek(e) {
  const p = ratioAt(e) * 100;
  $('seekFill').style.width = p + '%'; $('seekKnob').style.left = p + '%';
  if (vstate.duration) $('curTime').textContent = fmt(ratioAt(e) * vstate.duration);
}
seekEl.addEventListener('pointerdown', (e) => { if (!canControl() || !vstate.duration) return; seeking = true; seekEl.setPointerCapture(e.pointerId); previewSeek(e); });
seekEl.addEventListener('pointermove', (e) => { if (seeking) previewSeek(e); });
seekEl.addEventListener('pointerup', (e) => {
  if (!seeking) return; seeking = false;
  const t = ratioAt(e) * vstate.duration, type = vstate.paused ? 'pause' : 'play';
  videoCmd({ type, time: t }); if (joined) mesh.sendSync({ type, time: t });
  vstate.time = t; vstate.at = Date.now();
});

// ---- Sohbet ----
$('chatForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const text = $('chatInput').value.trim(); if (!text) return;
  mesh.sendChat(text); addMsg('Sen', text, true, mesh.selfId); $('chatInput').value = '';
});
function addMsg(who, text, mine, id) {
  const el = document.createElement('div'); el.className = 'msg ' + (mine ? 'me' : 'them');
  if (!mine) { const w = document.createElement('span'); w.className = 'who'; w.textContent = who; if (id) w.style.color = palOf(id); el.appendChild(w); }
  el.appendChild(linkify(text));
  $('messages').appendChild(el); $('messages').scrollTop = $('messages').scrollHeight;
  toParent('chat-echo', { who: mine ? 'Sen' : who, text, mine: !!mine, color: id ? palOf(id) : '' });   // tam ekran katmanı için
}
function addSys(text) { const el = document.createElement('div'); el.className = 'msg sys'; el.textContent = text; $('messages').appendChild(el); $('messages').scrollTop = $('messages').scrollHeight; toParent('chat-echo', { text, sys: true }); }
function linkify(text) {
  const frag = document.createDocumentFragment(); const re = /(https?:\/\/[^\s]+)/g; let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
    const a = document.createElement('a'); a.href = m[0]; a.textContent = m[0]; a.target = '_blank'; a.rel = 'noopener';
    frag.appendChild(a); last = m.index + m[0].length;
  }
  if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
  return frag;
}
function escapeHtml(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

// ---- Sıradaki ----
$('queueAddBtn').onclick = addToQueue;
$('queueInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addToQueue(); } });
function addToQueue() {
  let url = $('queueInput').value.trim(); if (!url) return;
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  queue.push({ url, label: shortUrl(url) });
  $('queueInput').value = ''; renderQueue(); if (joined) mesh.sendQueue(queue);
}
function renderQueue() {
  const list = $('queueList'); list.innerHTML = '';
  if (!queue.length) { list.innerHTML = `<div class="qempty">Sonraki bölüm/film linkini ekleyin</div>`; return; }
  queue.forEach((q) => {
    const row = document.createElement('div'); row.className = 'qrow';
    row.innerHTML = `<span class="qtxt" title="${escapeHtml(q.url)}">${escapeHtml(q.label)}</span>`;
    const go = document.createElement('button'); go.className = 'qgo'; go.textContent = canControl() ? 'Herkesi götür' : 'Sırada';
    if (canControl()) go.onclick = () => goTo(q); else go.disabled = true;
    row.appendChild(go); list.appendChild(row);
  });
}
function goTo(q) {
  const room = $('roomCode').textContent, url = `${q.url.split('#')[0]}#wt-join=${room}`;
  if (joined) mesh.sendNavigate(url);
  toParent('navigate', { url });
}

// ---- Kontroller / medya / oda çubuğu ----
$('resyncBtn').onclick = () => toParent('video-query');
$('syncAllBtn').onclick = () => {
  if (!amHost() || !joined) return;
  mesh.sendSource(basePage(pageUrl));                                   // herkesi bu videoya getir
  mesh.sendSync({ type: vstate.paused ? 'pause' : 'play', time: vstate.time });  // ve bu konuma
  addSys('Herkes sana eşitlendi');
};
// Sonraki bölüm: host doğrudan uygular; yetkili guest host'a istek yollar → karşılıklı çalışır
function doNextEpisode() { toParent('next-episode'); }
$('nextEpBtn').onclick = () => {
  if (!canControl() || !joined) return;
  if (amHost()) doNextEpisode();
  else { mesh.sendReqNext(); addSys('Sonraki bölüm istendi…'); }
};
$('cinemaBtn').onclick = () => toParent('cinema');
$('camToggle').onclick = () => $('camSection').classList.toggle('collapsed');
$('chatToggle').onclick = () => document.querySelector('.chat')?.classList.toggle('collapsed');

$('micBtn').onclick = () => {
  micOn = !micOn; mesh.localStream?.getAudioTracks().forEach((t) => t.enabled = micOn);
  const r = roster.get('self'); if (r) r.mic = micOn;
  mesh.sendMediaState(micOn, camOn); updateMediaButtons(); renderUsers();
};
$('camBtn').onclick = () => {
  camOn = !camOn; mesh.localStream?.getVideoTracks().forEach((t) => t.enabled = camOn);
  const r = roster.get('self'); if (r) r.cam = camOn;
  mesh.sendMediaState(micOn, camOn); updateMediaButtons();
  document.querySelector('.tile[data-self="1"]')?.classList.toggle('camoff', !camOn);
};
function updateMediaButtons() {
  $('micBtn').innerHTML = micOn ? IC.mic(16) : IC.micOff(16); $('micBtn').classList.toggle('off', !micOn);
  $('camBtn').innerHTML = camOn ? IC.cam(16) : IC.camOff(16); $('camBtn').classList.toggle('off', !camOn);
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch {}
  try {
    const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.top = '0'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.focus(); ta.select();
    const ok = document.execCommand('copy'); ta.remove(); return ok;
  } catch { return false; }
}
async function doInvite() {
  const room = $('roomCode').textContent, link = `${(pageUrl || '').split('#')[0]}#wt-join=${room}`;
  const ok = await copyText(link);
  if (ok) addSys('Davet linki kopyalandı — arkadaşına gönder');
  else { addSys('Otomatik kopyalanamadı, elle kopyala:'); addSys(link); $('chatInput').value = link; $('chatInput').select(); }
}
$('inviteBtn').onclick = doInvite;
$('copyLink').onclick = doInvite;
$('leaveBtn').onclick = () => {
  mesh.leave(); joined = false; clearInterval(loopTimer); clearTimeout(noVideoTimer); if (cinemaOn) toParent('cinema', { on: false });
  toParent('session-active', { on: false });
  roster.clear(); mesh.controllers.clear(); grantedNames.clear(); mesh.hostId = null; mesh.hostToken = null; analysers.clear(); queue = [];
  $('videos').innerHTML = ''; $('messages').innerHTML = ''; $('userList').innerHTML = '';
  $('room').classList.add('hidden'); $('lobby').classList.remove('hidden');
};
$('closeBtn').onclick = () => toParent('close-panel');

updateMediaButtons();

// Marka + versiyon (manifest'ten)
try {
  const v = chrome?.runtime?.getManifest?.().version;
  if (v) document.querySelectorAll('.appver').forEach((el) => { el.textContent = 'v' + v; });
} catch {}
