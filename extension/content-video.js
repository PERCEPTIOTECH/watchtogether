// WatchTogether — video kontrol içeriği. HER frame'de çalışır (all_frames: true).
// Sayfadaki <video> elementini bulur, uzaktan gelen komutları uygular ve
// yerel kullanıcı aksiyonlarını panele raporlar.

(() => {
  if (window.__wtVideoInjected) return;
  window.__wtVideoInjected = true;

  let video = null;
  let applyingRemote = false;      // uzak komut uygularken yerel event'i bastır
  const SEEK_EPS = 0.75;           // bu saniyeden az farkı görmezden gel (drift toleransı)

  // Tüm videoları topla — açık shadow DOM'ların içindekiler dahil.
  function allVideos(root = document, acc = []) {
    for (const v of root.querySelectorAll('video')) acc.push(v);
    for (const el of root.querySelectorAll('*')) {
      if (el.shadowRoot) allVideos(el.shadowRoot, acc);
    }
    return acc;
  }

  // Sayfadaki en "önemli" videoyu seç (en büyük görünen ve/veya oynayan).
  function pickVideo() {
    const vids = allVideos();
    if (!vids.length) return null;
    let best = null, bestScore = -1;
    for (const v of vids) {
      const r = v.getBoundingClientRect();
      const area = Math.max(0, r.width) * Math.max(0, r.height);
      const playing = !v.paused && !v.ended && v.readyState > 2 ? 1e9 : 0;
      const score = area + playing;
      if (score > bestScore) { bestScore = score; best = v; }
    }
    return best;
  }

  function ensureVideo() {
    if (video && document.contains(video)) return video;
    video = pickVideo();
    if (video && !video.__wtHooked) hookVideo(video);
    return video;
  }

  function report(event) {
    chrome.runtime.sendMessage({ wt: true, kind: 'video-event', event }, () => void chrome.runtime.lastError);
  }

  function hookVideo(v) {
    v.__wtHooked = true;
    const emit = (type) => () => {
      if (applyingRemote) return;
      report({ type, time: v.currentTime, rate: v.playbackRate, dur: v.duration });
    };
    v.addEventListener('play', emit('play'));
    v.addEventListener('pause', emit('pause'));
    v.addEventListener('seeked', emit('seek'));
    v.addEventListener('ratechange', emit('rate'));
    // Bazı özel oynatıcılar 'seeked' tetiklemez → timeupdate'te ani sıçramayı seek say
    let lastT = v.currentTime;
    v.addEventListener('timeupdate', () => {
      if (applyingRemote) { lastT = v.currentTime; return; }
      if (Math.abs(v.currentTime - lastT) > 1.5) {
        report({ type: 'seek', time: v.currentTime, rate: v.playbackRate, dur: v.duration });
      }
      lastT = v.currentTime;
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
