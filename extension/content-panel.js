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
      // Video üst-belgede mi (video), yoksa çapraz-origin iframe içinde mi?
      cinemaEl = biggestBy('video') || biggestBy('iframe');
      backdrop = document.createElement('div');
      Object.assign(backdrop.style, {
        position: 'fixed', inset: '0', background: 'rgba(3,4,10,.94)', zIndex: '2147483000',
        transition: 'opacity .25s', opacity: '0',
      });
      document.documentElement.appendChild(backdrop);
      requestAnimationFrame(() => { backdrop.style.opacity = '1'; });
      if (cinemaEl) {
        cinemaPrev = cinemaEl.getAttribute('style') || '';
        Object.assign(cinemaEl.style, {
          position: 'fixed', top: '0', left: '0',
          width: `calc(100vw - ${open ? PANEL_W : 0}px)`, height: '100vh',
          zIndex: '2147483200', background: '#000', objectFit: 'contain', margin: '0',
          maxWidth: 'none', maxHeight: 'none',
        });
      }
    } else {
      if (backdrop) { backdrop.remove(); backdrop = null; }
      if (cinemaEl) { cinemaEl.setAttribute('style', cinemaPrev); cinemaEl = null; }
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
        if (m.on) sessionStorage.setItem('wt-session', JSON.stringify({ room: m.room, name: m.name, creator: m.creator }));
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
    } else if (m.kind === 'close-panel') {
      toggle(false);
    }
  });

  function readSession() {
    try { return JSON.parse(sessionStorage.getItem('wt-session') || 'null'); } catch { return null; }
  }
  function sendPageUrl() {
    if (iframe) iframe.contentWindow.postMessage({ wt: true, kind: 'page-url', url: location.href, session: readSession() }, '*');
  }

  // Davet linkiyle gelindiyse VEYA bu sekmede aktif bir oturum varsa (bölüm değişimi) paneli aç
  if (location.hash.includes('wt-join=') || readSession()) toggle(true);
})();
