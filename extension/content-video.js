// WatchTogether — video kontrol içeriği. HER frame'de çalışır (all_frames: true).
// Sayfadaki <video> elementini bulur, uzaktan gelen komutları uygular ve
// yerel kullanıcı aksiyonlarını panele raporlar.

(() => {
  if (window.__wtVideoInjected) return;
  window.__wtVideoInjected = true;

  let video = null;
  let applyingRemote = false;      // uzak komut uygularken yerel event'i bastır
  const SEEK_EPS = 1.25;           // bu saniyeden az farkı görmezden gel → küçük kaymalarda
                                   //   hard-seek yapıp videoyu dondurmaz (akıcı senkron)

  // Tüm videoları topla — açık shadow DOM'ların içindekiler dahil.
  function allVideos(root = document, acc = []) {
    for (const v of root.querySelectorAll('video')) acc.push(v);
    for (const el of root.querySelectorAll('*')) {
      if (el.shadowRoot) allVideos(el.shadowRoot, acc);
    }
    return acc;
  }

  // Video puanı: OYNAYAN >> görünür >> alan. Böylece durmuş/gizli kopyalara takılmayız.
  function scoreVideo(v) {
    const r = v.getBoundingClientRect();
    const area = Math.max(0, r.width) * Math.max(0, r.height);
    const visible = r.width > 4 && r.height > 4 && r.bottom > 0 && r.top < (innerHeight || 800);
    const playing = !v.paused && !v.ended && v.readyState > 2;
    const hasTime = v.duration > 0 && isFinite(v.duration);
    return (playing ? 1e12 : 0) + (visible ? 1e9 : 0) + (hasTime ? 1e6 : 0) + area;
  }
  function pickVideo() {
    const vids = allVideos();
    if (!vids.length) return null;
    return vids.reduce((a, b) => (scoreVideo(b) > scoreVideo(a) ? b : a));
  }

  // Her çağrıda en iyi (oynayan/görünür) videoya geç — YouTube mini-player gibi
  // durumlarda durmuş eski elemente kilitlenmeyi önler.
  function ensureVideo() {
    const best = pickVideo();
    if (best && best !== video) {
      // Yalnızca gerçekten daha iyiyse geç (oynayan/görünür), gereksiz zıplama olmasın
      if (!video || !document.contains(video) || scoreVideo(best) > scoreVideo(video)) {
        video = best;
        if (!video.__wtHooked) hookVideo(video);
      }
    }
    return video;
  }

  function report(event) {
    chrome.runtime.sendMessage({ wt: true, kind: 'video-event', event }, () => void chrome.runtime.lastError);
  }

  function hookVideo(v) {
    v.__wtHooked = true;
    const emit = (type) => () => {
      if (applyingRemote || v !== video) return;   // yalnızca seçili video raporlar
      report({ type, time: v.currentTime, rate: v.playbackRate, dur: v.duration });
    };
    v.addEventListener('play', emit('play'));
    v.addEventListener('pause', emit('pause'));
    v.addEventListener('seeked', emit('seek'));
    v.addEventListener('ratechange', emit('rate'));
    // timeupdate: (a) ani sıçramayı seek say, (b) ~500ms'de bir GERÇEK durumu it
    // → panel bar'ı hep videoyla aynı kalır + host daha sık heartbeat yollar.
    let lastT = v.currentTime, lastPush = 0;
    v.addEventListener('timeupdate', () => {
      if (v !== video) return;
      if (applyingRemote) { lastT = v.currentTime; return; }
      if (Math.abs(v.currentTime - lastT) > 1.5) {
        report({ type: 'seek', time: v.currentTime, rate: v.playbackRate, dur: v.duration });
      }
      lastT = v.currentTime;
      const now = Date.now();
      if (now - lastPush > 500) {
        lastPush = now;
        report({ type: v.paused ? 'pause' : 'play', time: v.currentTime, rate: v.playbackRate, dur: v.duration, query: true });
      }
    });
  }

  // Uzaktan gelen komutu uygula (feedback loop olmadan)
  function applyCmd(cmd) {
    const v = ensureVideo();
    if (!v) return;
    applyingRemote = true;
    try {
      if (typeof cmd.time === 'number' && Math.abs(v.currentTime - cmd.time) > SEEK_EPS) {
        v.currentTime = cmd.time;
      }
      if (typeof cmd.rate === 'number' && Math.abs(v.playbackRate - cmd.rate) > 0.01) {
        v.playbackRate = cmd.rate;
      }
      if (cmd.type === 'play' && v.paused) v.play().catch(() => {});
      if (cmd.type === 'pause' && !v.paused) v.pause();
    } finally {
      // Uygulanan event'lerin geri dönmemesi için kısa bir pencere bırak
      setTimeout(() => { applyingRemote = false; }, 120);
    }
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg || !msg.wt) return;
    if (msg.kind === 'video-cmd') {
      applyCmd(msg.cmd);
    } else if (msg.kind === 'video-query') {
      const v = ensureVideo();
      if (v) report({ type: v.paused ? 'pause' : 'play', time: v.currentTime, rate: v.playbackRate, dur: v.duration, query: true });
      else report({ type: 'none', query: true });   // bu frame'de video yok
    }
  });

  // Video geç yüklenebilir; periyodik tara.
  const scan = setInterval(() => { ensureVideo(); }, 1500);
  window.addEventListener('pagehide', () => clearInterval(scan));
  ensureVideo();
})();
