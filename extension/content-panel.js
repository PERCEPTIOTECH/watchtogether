// WatchTogether — panel enjekte edici. YALNIZCA üst frame'de çalışır.
// Sağ tarafa, eklenti-origin'li bir iframe (panel.html) yerleştirir.
// Kamera/mikrofon izni bu iframe'de (eklenti origin) istenir → sayfaya bağımlı değil.
// Ayrıca "Sinema Modu" (sayfayı karart + videoyu ortala) ve senkron geçişi yönetir.

(() => {
  if (window.top !== window.self) return;      // sadece top frame
  if (window.__wtPanelInjected) return;
  window.__wtPanelInjected = true;

  const PANEL_W = 400;
  let host = null, iframe = null, open = false;
  let cinemaOn = false, backdrop = null, cinemaEl = null, cinemaPrev = '';
  let hostStylePrev = '', htmlOverflowPrev = '', escHandler = null, exitBtn = null;

  function build() {
    host = document.createElement('div');
    host.id = 'wt-host';
    Object.assign(host.style, {
      position: 'fixed', top: '0', right: '0', width: PANEL_W + 'px', height: '100vh',
      zIndex: '2147483647', border: 'none', boxShadow: '-8px 0 40px rgba(0,0,0,.5)',
      transition: 'transform .25s cubic-bezier(.2,.8,.2,1)', transform: 'translateX(100%)',
      background: 'transparent',
    });
    iframe = document.createElement('iframe');
    iframe.src = chrome.runtime.getURL('panel.html');
    iframe.allow = 'camera; microphone; autoplay; display-capture; clipboard-write';
    Object.assign(iframe.style, { width: '100%', height: '100%', border: 'none', background: '#0a0b14' });
    host.appendChild(iframe);
    document.documentElement.appendChild(host);
  }

  function toggle(force) {
    if (!host) build();
    open = typeof force === 'boolean' ? force : !open;
    host.style.transform = open ? 'translateX(0)' : 'translateX(100%)';
    if (!open && cinemaOn) cinema(false);
  }

  // ---- Sinema Modu ----
  function biggestBy(sel) {
    let best = null, bestA = 0;
    for (const el of document.querySelectorAll(sel)) {
      const r = el.getBoundingClientRect();
      const a = r.width * r.height;
      if (a > bestA) { bestA = a; best = el; }
    }
    return bestA > 40000 ? best : null;   // çok küçükleri ele
  }

  function cinema(on) {
    if (on === cinemaOn) return;
    cinemaOn = on;
    if (on) {
      if (!host) build();
      toggle(true);                                   // panel (kameralar) açık olsun
      cinemaEl = biggestBy('video') || biggestBy('iframe');

      // Gövde kaydırmayı kilitle (tam ekran hissi)
      htmlOverflowPrev = document.documentElement.style.overflow;
      document.documentElement.style.overflow = 'hidden';

      // Tam siyah arka fon
      backdrop = document.createElement('div');
      Object.assign(backdrop.style, { position: 'fixed', inset: '0', background: '#000', zIndex: '2147483000', opacity: '0', transition: 'opacity .3s' });
      document.documentElement.appendChild(backdrop);
      requestAnimationFrame(() => { backdrop.style.opacity = '1'; });

      // Videoyu TÜM ekrana yay (letterbox siyah)
      if (cinemaEl) {
        cinemaPrev = cinemaEl.getAttribute('style') || '';
        Object.assign(cinemaEl.style, {
          position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh',
          zIndex: '2147483100', background: '#000', objectFit: 'contain', margin: '0',
          maxWidth: 'none', maxHeight: 'none', borderRadius: '0',
        });
      }

      // Paneli yüzen karta çevir (video üstünde, kameralar görünür)
      hostStylePrev = host.getAttribute('style') || '';
      Object.assign(host.style, {
        top: '14px', right: '14px', bottom: '14px', left: 'auto', height: 'auto', width: '372px',
        borderRadius: '16px', overflow: 'hidden', zIndex: '2147483200',
        boxShadow: '0 24px 70px rgba(0,0,0,.6)', transform: 'none', transition: 'none',
      });

      // Çıkış butonu (sol üst) + ESC
      exitBtn = document.createElement('button');
      exitBtn.textContent = '✕  Sinemadan çık  ·  ESC';
      Object.assign(exitBtn.style, {
        position: 'fixed', top: '16px', left: '16px', zIndex: '2147483300',
        background: 'rgba(20,20,26,.75)', color: '#e9eef2', border: '1px solid rgba(255,255,255,.15)',
        borderRadius: '10px', padding: '8px 12px', font: '13px Inter,-apple-system,sans-serif',
        cursor: 'pointer', backdropFilter: 'blur(6px)', opacity: '0', transition: 'opacity .3s',
      });
      exitBtn.addEventListener('click', () => cinema(false));
      document.documentElement.appendChild(exitBtn);
      requestAnimationFrame(() => { exitBtn.style.opacity = '.9'; });
      escHandler = (e) => { if (e.key === 'Escape') cinema(false); };
      window.addEventListener('keydown', escHandler, true);
    } else {
      if (backdrop) { backdrop.remove(); backdrop = null; }
      if (cinemaEl) { cinemaEl.setAttribute('style', cinemaPrev); cinemaEl = null; }
      if (exitBtn) { exitBtn.remove(); exitBtn = null; }
      document.documentElement.style.overflow = htmlOverflowPrev;
      if (host) host.setAttribute('style', hostStylePrev);
      if (escHandler) { window.removeEventListener('keydown', escHandler, true); escHandler = null; }
    }
    if (iframe) iframe.contentWindow.postMessage({ wt: true, kind: 'cinema-state', on: cinemaOn }, '*');
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg || !msg.wt) return;
    if (msg.kind === 'toggle-panel') { toggle(); return; }
    if (msg.kind === 'video-event' && iframe) {
      iframe.contentWindow.postMessage({ wt: true, kind: 'video-event', event: msg.event }, '*');
    }
  });

  window.addEventListener('message', (e) => {
    const m = e.data;
    if (!m || !m.wt || m.source !== 'panel') return;
    if (m.kind === 'video-cmd') {
      chrome.runtime.sendMessage({ wt: true, kind: 'video-cmd', cmd: m.cmd }, () => void chrome.runtime.lastError);
    } else if (m.kind === 'video-query') {
      chrome.runtime.sendMessage({ wt: true, kind: 'video-query' }, () => void chrome.runtime.lastError);
    } else if (m.kind === 'request-url') {
      sendPageUrl();
    } else if (m.kind === 'session-active') {
      // Panel bir odaya girdi/çıktı → sayfa oturumunda sakla ki bölüm değişince oda korunsun
      try {
        if (m.on) sessionStorage.setItem('wt-session', JSON.stringify({ room: m.room, name: m.name, creator: m.creator, token: m.token }));
        else sessionStorage.removeItem('wt-session');
      } catch (_) {}
    } else if (m.kind === 'cinema') {
      cinema(typeof m.on === 'boolean' ? m.on : !cinemaOn);
    } else if (m.kind === 'list-tabs') {
      chrome.runtime.sendMessage({ wt: true, kind: 'list-tabs' }, (resp) => {
        if (chrome.runtime.lastError || !resp || !iframe) return;
        iframe.contentWindow.postMessage({ wt: true, kind: 'tabs', tabs: resp.tabs, current: resp.current, target: resp.target }, '*');
      });
    } else if (m.kind === 'set-target') {
      chrome.runtime.sendMessage({ wt: true, kind: 'set-target', tabId: m.tabId }, () => void chrome.runtime.lastError);
    } else if (m.kind === 'navigate' && m.url) {
      chrome.runtime.sendMessage({ wt: true, kind: 'navigate-tab', url: m.url }, () => void chrome.runtime.lastError);
    } else if (m.kind === 'next-episode') {
      const ok = clickNext();
      if (iframe) iframe.contentWindow.postMessage({ wt: true, kind: 'next-result', ok }, '*');
    } else if (m.kind === 'chat-echo') {
      pushChat(m);   // tam ekran sohbet katmanı için
    } else if (m.kind === 'close-panel') {
      toggle(false);
    }
  });

  // Sayfadaki "Sonraki Bölüm / Next Episode" düğmesini bulup tıkla (siteye özel değil, metinden)
  function clickNext() {
    const strict = /(sonraki\s*böl|sıradaki\s*böl|next\s*episode|next\s*bölüm)/i;
    const loose = /(sonraki|next\s*video|ileri|next)/i;
    const txt = (el) => (el.textContent || el.getAttribute('aria-label') || el.title || '').trim();
    const els = [...document.querySelectorAll('a, button, [role="button"]')].filter((el) => el.offsetParent !== null);
    let btn = els.find((el) => strict.test(txt(el)));
    if (!btn) btn = els.find((el) => { const t = txt(el); return t.length < 30 && loose.test(t); });
    if (btn) { btn.click(); return true; }
    return false;
  }

  function readSession() {
    try { return JSON.parse(sessionStorage.getItem('wt-session') || 'null'); } catch { return null; }
  }
  function sendPageUrl() {
    if (iframe) iframe.contentWindow.postMessage({ wt: true, kind: 'page-url', url: location.href, session: readSession() }, '*');
  }

  // SPA URL değişimini yakala (YouTube gibi siteler sayfayı yenilemeden video değiştirir)
  let lastUrl = location.href;
  function checkUrl() {
    if (location.href !== lastUrl) { lastUrl = location.href; sendPageUrl(); }
  }
  setInterval(checkUrl, 1000);
  window.addEventListener('popstate', checkUrl);
  window.addEventListener('hashchange', checkUrl);

  // ---- Tam ekran sohbet katmanı ----
  // Native tam ekranda (video'nun kendi tam ekran butonu) panel iframe'i görünmez; en azından
  // sohbeti tam ekranın İÇİNE enjekte ediyoruz (metin frame'ler arası taşınabilir).
  const chatBuf = [];
  let fsOverlay = null;

  function pushChat(m) {
    chatBuf.push(m); if (chatBuf.length > 50) chatBuf.shift();
    if (fsOverlay) { renderChatLine(m); const b = fsOverlay.querySelector('.wtfs-msgs'); b.scrollTop = b.scrollHeight; }
  }
  function renderChatLine(m) {
    const box = fsOverlay && fsOverlay.querySelector('.wtfs-msgs'); if (!box) return;
    const el = document.createElement('div');
    if (m.sys) { el.style.cssText = 'color:#9298a3;font-size:11px;font-style:italic;text-align:center;margin:2px 0'; el.textContent = m.text; }
    else {
      el.style.cssText = 'margin:3px 0;font-size:13px;line-height:1.35;max-width:100%;word-break:break-word;' + (m.mine ? 'text-align:right;color:#fff' : 'color:#e9eef2');
      if (!m.mine) { const w = document.createElement('b'); w.textContent = (m.who || '') + ': '; w.style.color = m.color || '#ff5a5f'; el.appendChild(w); }
      el.appendChild(document.createTextNode(m.text));
    }
    box.appendChild(el);
  }
  function openFsOverlay() {
    if (fsOverlay || !document.fullscreenElement || !readSession()) return;   // yalnızca odadayken
    const o = document.createElement('div');
    o.className = 'wtfs';
    o.style.cssText = 'position:fixed;right:20px;bottom:20px;width:300px;max-height:44vh;z-index:2147483647;display:flex;flex-direction:column;background:rgba(14,14,18,.92);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.12);border-radius:14px;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,.5);font-family:Inter,-apple-system,sans-serif';
    o.innerHTML =
      '<div class="wtfs-h" style="display:flex;align-items:center;gap:8px;padding:9px 11px;cursor:move;background:rgba(255,255,255,.04);border-bottom:1px solid rgba(255,255,255,.08)">' +
        '<span style="width:8px;height:8px;border-radius:50%;background:#ff5a5f"></span>' +
        '<b style="font-size:12px;color:#e9eef2;font-weight:600">Sohbet</b>' +
        '<span style="flex:1"></span>' +
        '<button class="wtfs-cinema" title="Sinema modu (kamera+sohbet)" style="background:none;border:1px solid rgba(255,255,255,.15);color:#c7ccd6;border-radius:7px;padding:3px 7px;font-size:11px;cursor:pointer">🎬 Sinema</button>' +
        '<button class="wtfs-min" title="Küçült/sabitle" style="background:none;border:none;color:#9298a3;font-size:15px;cursor:pointer;padding:0 4px">–</button>' +
      '</div>' +
      '<div class="wtfs-msgs" style="flex:1;overflow:auto;padding:9px 11px"></div>' +
      '<form class="wtfs-form" style="display:flex;gap:6px;padding:9px 11px;border-top:1px solid rgba(255,255,255,.08)">' +
        '<input class="wtfs-in" placeholder="Mesaj yaz…" autocomplete="off" style="flex:1;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:#edeef2;border-radius:9px;padding:8px 10px;font:inherit;font-size:12.5px;outline:none">' +
        '<button type="submit" style="background:linear-gradient(120deg,#ff5a5f,#ff3d6b);border:none;color:#fff;border-radius:9px;padding:0 12px;font-weight:600;cursor:pointer">➤</button>' +
      '</form>';
    document.fullscreenElement.appendChild(o);
    fsOverlay = o;
    chatBuf.forEach(renderChatLine);
    const box = o.querySelector('.wtfs-msgs'); box.scrollTop = box.scrollHeight;

    // mesaj gönder
    o.querySelector('.wtfs-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const inp = o.querySelector('.wtfs-in'); const t = inp.value.trim(); if (!t) return;
      if (iframe) iframe.contentWindow.postMessage({ wt: true, kind: 'chat-send', text: t }, '*');
      inp.value = '';
    });
    // küçült / sabitle → sadece başlık pili
    let min = false; const minBtn = o.querySelector('.wtfs-min');
    minBtn.addEventListener('click', () => {
      min = !min;
      o.querySelector('.wtfs-msgs').style.display = min ? 'none' : '';
      o.querySelector('.wtfs-form').style.display = min ? 'none' : '';
      o.querySelector('.wtfs-cinema').style.display = min ? 'none' : '';
      o.style.width = min ? 'auto' : '300px';
      minBtn.textContent = min ? '+' : '–';
    });
    // sinema moduna geç (kameralar için)
    o.querySelector('.wtfs-cinema').addEventListener('click', () => {
      try { document.exitFullscreen(); } catch {}
      toggle(true); setTimeout(() => cinema(true), 120);
    });
    // sürükle
    const h = o.querySelector('.wtfs-h'); let dx = 0, dy = 0, dragging = false;
    h.addEventListener('mousedown', (e) => { if (e.target.tagName === 'BUTTON') return; dragging = true; const r = o.getBoundingClientRect(); dx = e.clientX - r.left; dy = e.clientY - r.top; e.preventDefault(); });
    window.addEventListener('mousemove', (e) => { if (!dragging) return; o.style.left = (e.clientX - dx) + 'px'; o.style.top = (e.clientY - dy) + 'px'; o.style.right = 'auto'; o.style.bottom = 'auto'; });
    window.addEventListener('mouseup', () => { dragging = false; });
  }
  function closeFsOverlay() { if (fsOverlay) { fsOverlay.remove(); fsOverlay = null; } }
  document.addEventListener('fullscreenchange', () => { if (document.fullscreenElement) openFsOverlay(); else closeFsOverlay(); });

  // Davet linkiyle gelindiyse VEYA bu sekmede aktif bir oturum varsa (bölüm değişimi) paneli aç
  if (location.hash.includes('wt-join=') || readSession()) toggle(true);
})();
