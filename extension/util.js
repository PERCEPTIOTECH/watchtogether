// WatchTogether — saf (DOM'suz) yardımcılar. Hem panel.js kullanır hem test edilir.

// URL'in hash'siz hâli (?query korunur — YouTube ?v=… için önemli)
export const basePage = (u) => (u || '').split('#')[0];

// Kısa okunur URL etiketi: host + son yol parçası
export function shortUrl(u) {
  try {
    const x = new URL(u);
    const last = x.pathname.split('/').filter(Boolean).slice(-1)[0];
    return x.hostname.replace(/^www\./, '') + (last ? ' · ' + last : '');
  } catch { return u || ''; }
}

// Avatar baş harfleri
export const initials = (n) => (n || '?').trim().slice(0, 2).toUpperCase();

// Saniye → m:ss
export function fmt(sec) {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Renk paleti indeksleme (deterministik)
export function hashStr(s) { let h = 0; for (let i = 0; i < (s || '').length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }

// "Sonraki bölüm" düğme metni puanı: 2=kesin, 1=zayıf, 0=değil
export function nextButtonScore(text) {
  const t = (text || '').trim();
  if (!t) return 0;
  if (/(sonraki\s*böl|sıradaki\s*böl|next\s*episode|next\s*bölüm)/i.test(t)) return 2;
  if (t.length < 30 && /(sonraki|next\s*video|ileri|next)/i.test(t)) return 1;
  return 0;
}
