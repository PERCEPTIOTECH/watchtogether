// WatchTogether — saf yardımcıların birim testi (DOM'suz mantık kapsamı).
import { basePage, shortUrl, initials, fmt, hashStr, nextButtonScore } from '../extension/util.js';

let fail = 0;
const eq = (name, got, exp) => {
  const ok = JSON.stringify(got) === JSON.stringify(exp);
  if (!ok) { fail++; console.log(`❌ ${name}: beklenen ${JSON.stringify(exp)}, gelen ${JSON.stringify(got)}`); }
};

// basePage: hash atılır, query korunur
eq('basePage hash', basePage('https://youtube.com/watch?v=abc#wt-join=X'), 'https://youtube.com/watch?v=abc');
eq('basePage no-hash', basePage('https://site.tld/dizi/bolum-2'), 'https://site.tld/dizi/bolum-2');
eq('basePage empty', basePage(''), '');

// shortUrl
eq('shortUrl yt', shortUrl('https://www.youtube.com/watch?v=abc'), 'youtube.com · watch');
eq('shortUrl dizi', shortUrl('https://filmmakinesi.to/dizi/the-blacklist/sezon-1/bolum-2/'), 'filmmakinesi.to · bolum-2');
eq('shortUrl invalid', shortUrl('saçma'), 'saçma');

// initials
eq('initials', initials('Kanka'), 'KA');
eq('initials empty', initials(''), '?');

// fmt
eq('fmt 0', fmt(0), '0:00');
eq('fmt 65', fmt(65), '1:05');
eq('fmt 3627', fmt(3627), '60:27');
eq('fmt neg/NaN', fmt(NaN), '0:00');

// hashStr deterministik
eq('hash deterministik', hashStr('abc') === hashStr('abc'), true);
eq('hash farklı', hashStr('abc') !== hashStr('abd'), true);

// nextButtonScore
eq('next strict tr', nextButtonScore('Sonraki Bölüm »'), 2);
eq('next strict en', nextButtonScore('Next Episode'), 2);
eq('next loose', nextButtonScore('Sonraki'), 1);
eq('next none home', nextButtonScore('Anasayfa'), 0);
eq('next none long', nextButtonScore('Bu çok uzun bir metin sonraki kelimesi geçse de düğme değil'), 0);
eq('next empty', nextButtonScore(''), 0);

console.log('\n──────── SONUÇ ────────');
console.log(fail === 0 ? '🎉 YARDIMCI BİRİM TESTLERİ GEÇTİ' : `❌ ${fail} test başarısız`);
process.exit(fail === 0 ? 0 : 1);
