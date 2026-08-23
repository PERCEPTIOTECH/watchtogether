# Chrome Web Store — Gönderim Paketi

Bu dosya, WatchTogether'ı mağazaya yüklemek için gereken **her şeyi** içerir: yüklenecek
paket, listeleme metinleri, izin gerekçeleri, gizlilik beyanı ve adım adım rehber.

Yüklenecek paket: **`watchtogether-store-v0.1.0.zip`** (bu repoda hazır).

---

## 1) Temel bilgiler

| Alan | Değer |
|---|---|
| **Ad** | WatchTogether — Birlikte İzle |
| **Kategori** | İletişim / Sosyal (Social & Communication) |
| **Dil** | Türkçe (birincil) |
| **Gizlilik Politikası URL** | https://github.com/PERCEPTIOTECH/watchtogether/blob/main/PRIVACY.md |
| **Web sitesi (ops.)** | https://github.com/PERCEPTIOTECH/watchtogether |

## 2) Kısa açıklama (Summary — en fazla 132 karakter)

```
Arkadaşınla aynı videoyu, aynı an izle. Oynat/durdur/sar senkron + sesli, kameralı ve yazılı sohbet. Herhangi bir video sitesinde çalışır.
```

## 3) Ayrıntılı açıklama (Detailed description)

```
WatchTogether ile arkadaşınla aynı videoyu tam olarak aynı anda izleyin — oynat, durdur ve
ileri sarma herkeste eşitlenir. Üstüne sesli, kameralı ve yazılı sohbet.

Herhangi bir video sitesinde çalışır (YouTube, dizi/film siteleri ve daha fazlası). Tamamen
uçtan uca (P2P): video, ses ve kamera doğrudan aranızda akar, kimsenin sunucusunda saklanmaz.

ÖZELLİKLER
• Senkron oynatma — oynat/durdur/ileri sar herkeste aynı an. Kendi oynatıcı çubuğu; karşının
  konumunu görürsün.
• Sesli + kameralı — yan panelde kamera kutuları, konuşanın etrafında canlı halka.
• Yazılı sohbet — renkli isimler, tıklanabilir linkler.
• Host kontrolü — kontrol sende; istersen tek tıkla başkasına da yetki ver.
• Sonraki bölüm — host bölüm değiştirince herkes otomatik takip eder.
• Sinema modu — sayfayı karartıp videoyu ortalar.
• Tek tık davet — oda kurunca davet linki panoya kopyalanır.
• Kim nerede — herkesin hangi videoda olduğunu ve senkron mu olduğunu gör.

NASIL ÇALIŞIR
1. Bir video sayfası aç, eklenti ikonuna tıkla, "Oda oluştur" de — davet linki kopyalanır.
2. Linki arkadaşına gönder; o linke tıklayınca aynı odaya ve aynı bölüme düşer.
3. Kamera/mikrofon izni verin, birlikte izlemeye başlayın.

GİZLİLİK
Video, ses, kamera ve sohbet doğrudan katılımcılar arasında (WebRTC) akar; hiçbir sunucuda
saklanmaz. Reklam yok, analitik yok, veri satışı yok. Ayrıntı: gizlilik politikası.

PERCEPT tarafından geliştirildi.
```

## 4) Tek amaç beyanı (Single purpose)

```
Kullanıcıların arkadaşlarıyla herhangi bir video sitesindeki videoyu senkron izlemesini ve
gerçek zamanlı (P2P) sesli/kameralı/yazılı iletişim kurmasını sağlamak.
```

## 5) İzin gerekçeleri (Permission justifications)

- **host_permissions `<all_urls>` + içerik betikleri:** Eklentinin herhangi bir video
  sitesindeki `<video>` öğesini bulup senkron kontrol edebilmesi ve paneli gösterebilmesi için
  tüm sitelerde çalışması gerekir.
- **`tabs`:** "Video kaynağı" özelliğinde açık sekmeleri listelemek ve senkron komutlarını
  doğru sekmeye yönlendirmek için.
- **`scripting`:** Panel ve video-kontrol betiklerini sayfaya enjekte etmek için.
- **`storage`:** Kullanıcının adını ve (isteğe bağlı) signaling sunucu adresini yerelde
  hatırlamak için.
- **Kamera/Mikrofon (getUserMedia):** Yalnızca kullanıcı bir odaya katılıp açıkça izin
  verdiğinde; sesli/kameralı görüşme için. İçerik P2P akar, saklanmaz.

## 6) Veri kullanımı beyanı (Privacy practices sekmesi)

Formda şunları işaretle:
- Toplanan veri türleri → **Personal communications** (sesli/görüntülü/yazılı sohbet) ve
  **Web history** (senkron için paylaşılan sayfa URL'i). Not: bunlar **P2P** iletilir,
  geliştiricinin sunucusunda **saklanmaz**.
- **Kimliği doğrulanabilir bilgi satılmıyor.** ✅
- **Veri, eklentinin tek amacı dışında kullanılmıyor.** ✅
- **Veri, kredi düzeltme/borç toplama için kullanılmıyor.** ✅
- Üç zorunlu sertifikasyon kutusunu işaretle.

## 7) Görseller

- **Mağaza ikonu (128×128):** `extension/icons/128.png` ✅
- **Ekran görüntüleri (1280×800):** `store-assets/screenshot-1.png … 3.png` ✅ (bu repoda)
- **Küçük tanıtım karesi (440×280, ops.):** `store-assets/promo-440x280.png` ✅

---

## 8) ADIM ADIM GÖNDERİM (senin yapacakların)

1. **Geliştirici hesabı:** https://chrome.google.com/webstore/devconsole → Google hesabınla
   gir → **tek seferlik 5 USD** kayıt ücretini öde.
2. **Yeni öğe:** "New item" → `watchtogether-store-v0.1.0.zip` dosyasını yükle.
3. **Store listing** sekmesi:
   - Ad, kategori (İletişim), dil (Türkçe)
   - Kısa açıklama (§2) ve ayrıntılı açıklama (§3) yapıştır
   - Mağaza ikonu (128) + ekran görüntüleri (`store-assets/`) yükle
4. **Privacy** sekmesi:
   - **Single purpose** (§4) yapıştır
   - Her izin için gerekçe (§5)
   - Gizlilik politikası URL'i (§1)
   - Veri kullanımı (§6) işaretle
5. **Distribution:** Görünürlük "Public" (herkese açık) ya da "Unlisted" (sadece linki
   olanlar) seç. → İlk denemede **Unlisted** öneririm.
6. **Submit for review.** İnceleme genelde 1–3 gün sürer.

> Not: `<all_urls>` geniş izin olduğu için inceleme birkaç ek soru sorabilir; §5'teki
> gerekçeler bunu karşılar. Reddedilirse gelen maildeki gerekçeyi bana ilet, düzeltiriz.

## 9) Sürüm güncelleme
Kod değişince `manifest.json`'daki `version`'ı artır (ör. 0.1.0 → 0.1.1), yeni ZIP oluştur,
Developer Console'da "Package" → yeni sürümü yükle → Submit. Panel versiyonu otomatik güncellenir.
