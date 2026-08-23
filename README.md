<div align="center">

<img src="extension/icons/128.png" width="96" height="96" alt="WatchTogether" />

# WatchTogether

**Arkadaşınla aynı videoyu, aynı anda — sesli ve kameralı izle.**

Herhangi bir video sitesinde (YouTube, dizi/film siteleri…) oynat / durdur / ileri sar
herkeste eşitlenir. Üstüne sesli + kameralı sohbet. Tamamen **P2P** — video, ses ve kamera
kimsenin sunucusundan geçmez, doğrudan aranızda akar.

![status](https://img.shields.io/badge/durum-çalışıyor-3ecf8e) ![tests](https://img.shields.io/badge/testler-6%2F6-6470ff) ![license](https://img.shields.io/badge/lisans-MIT-969ba8)

</div>

---

## Ne yapar?

| | Özellik |
|---|---|
| 🎬 | **Senkron oynatma** — oynat/durdur/sar herkeste aynı an. Kendi oynatıcı çubuğu, karşının konumunu görürsün |
| 🎙️ | **Sesli + kameralı** — yan panelde kameralar, konuşanın etrafında yeşil halka |
| 💬 | **Sohbet** — renkli isimler, tıklanabilir linkler |
| 👑 | **Host kontrolü** — kontrol host'ta; istersen anahtar ikonuyla başkasına da yetki ver |
| 🍿 | **Sinema modu** — sayfayı karartıp videoyu ortalar |
| ⏭️ | **Sonraki bölüm** — host bölüm değiştirince herkes otomatik takip eder |
| 🔗 | **Tek tık davet** — oda kurunca link panoya kopyalanır |
| 🔒 | **Güvenli** — sunucu host'u belirler; yetkisiz kimse oynatmayı/yönlendirmeyi ele geçiremez |
| 🔁 | **Dayanıklı** — ağ kesilirse otomatik yeniden bağlanır; F5 atınca diğeri bozulmaz |

## Kurulum (2 dakika — sen ve arkadaşın)

> Eklenti henüz mağazada değil, ikiniz de aynı kurulumu yapın. Chrome / Brave / Edge. Telefon desteklenmiyor.

1. **İndir:** [bu repo](https://github.com/PERCEPTIOTECH/watchtogether) → yeşil **`< > Code`** → **Download ZIP**
2. **Aç:** inen ZIP'e çift tıkla → `watchtogether-main` klasörü çıkar
3. Tarayıcıda **`chrome://extensions`** (Brave: `brave://extensions`) aç
4. Sağ üstten **Developer mode / Geliştirici modu**'nu aç
5. **Load unpacked** → `watchtogether-main/extension` klasörünü seç
6. Araç çubuğunda 🧩 puzzle ikonundan **WatchTogether**'ı sabitle

## Kullanım

**Sen (host):** video sayfasını aç → eklenti ikonuna tıkla → adını yaz → **Oda oluştur** →
davet linki kopyalanır → arkadaşına gönder.

**Arkadaşın:** (kurulumdan sonra) linke tıklar → adını yazar → **Bu odaya katıl**.

İkiniz de kamera/mikrofon iznini verin. İlk bağlantı ~30-60 sn sürebilir (sunucu uyanıyor).

## Geliştirici / test

```bash
cd signaling
npm install
npm start        # yerel signaling (ws://localhost:8080)
npm test         # 6 senaryo: e2e, sonraki-bölüm, signal, yetki, reconnect, refresh
```

Kendi signaling sunucunu yayına almak için `render.yaml` hazır (Render → New → Blueprint).
Adresi eklenti panelinde **Sunucu ayarı (gelişmiş)** alanına yazarsın (`wss://…`).

## Nasıl çalışır? (mimari)

```
Tarayıcı A  ──┐                          ┌──  Tarayıcı B
 content-video │  (video <video> kontrol) │ content-video
 panel (iframe)│                          │ panel (iframe)
      │        │                          │      │
      └── P2P WebRTC (video-senkron + ses + kamera + sohbet) ──┘
                         │
              signaling (sadece el sıkışma + host belirleme)
                    wss://…onrender.com
```

- **content-video** her frame'de çalışır, oynayan `<video>`'yu bulup kontrol eder
- **P2P mesh** — herkes herkese bağlanır (küçük grup için ideal)
- **signaling** yalnızca ilk el sıkışma + kimin host olduğu için; medya buradan geçmez

## Bilinen sınırlar (dürüst)

- **Reklam farkı:** bir tarafta reklam çıkıp diğerinde çıkmazsa o an senkron kayabilir (sitenin kendi oynatıcısını eşliyoruz, Metastream gibi stream'i çıkarmıyoruz)
- **Kalabalık:** full-mesh olduğu için 2-5 kişi ideal; daha fazlası kamera yükünü artırır
- **Katı NAT:** nadiren ücretsiz TURN yetmeyebilir (kendi TURN'ünü kurmak en sağlamı)
- **Telefon:** tarayıcı eklentisi olduğu için mobilde çalışmaz

## Lisans

**PERCEPT** tarafından geliştirildi · [MIT](LICENSE) © Muhammed Kızılkaya
