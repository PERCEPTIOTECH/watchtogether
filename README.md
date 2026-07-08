# WatchTogether 🎬

Metastream benzeri "birlikte izle" Chrome eklentisi. **Herhangi bir** video sitesinde
(filmmakinesi dahil) videoyu senkron oynat/durdur/sar + yazılı sohbet + katılımcı listesi
+ **sesli & kameralı** görüşme. Tamamen **P2P (WebRTC)** — video/ses/kamera kimsenin
sunucusundan geçmez, doğrudan eşler arasında akar. Sunucu sadece ilk el sıkışma (signaling) için.

## Yapı

```
watchtogether/
  extension/            # Chrome eklentisi (Manifest V3)
    manifest.json
    background.js       # frame'ler + panel arası mesaj rölesi
    content-video.js    # tüm frame'lerde çalışır, <video>'yu bulur ve kontrol eder
    content-panel.js    # üst frame'e yan paneli (iframe) enjekte eder
    panel.html/.css/.js # UI: kamera kutuları, chat, katılımcılar, oda linki
    rtc.js              # P2P mesh + signaling + data channel
  signaling/            # minik WebSocket signaling sunucusu
    server.js
    package.json
```

## Çalıştırma

### 1) Signaling sunucusu
```
cd signaling
npm install
npm start          # ws://localhost:8080
```
Ücretsiz yayına almak için: Render / Fly.io / Deno Deploy free tier. Sonra
`extension/rtc.js` içindeki `SIGNAL_URL`'i o adrese çevir (wss://...).

### 1b) Headless test botu (tarayıcısız uçtan uca doğrulama)
```
cd signaling
npm test          # gerçek rtc.js'i 2 sahte kullanıcıyla çalıştırır: P2P + senkron + chat
```
Beklenen çıktı: `🎉 UÇTAN UCA GEÇTİ`. (WebRTC için node-datachannel devDependency'sini kullanır.)

### 2) Eklentiyi yükle
1. Chrome → `chrome://extensions`
2. Sağ üstten **Developer mode** aç
3. **Load unpacked** → `watchtogether/extension` klasörünü seç

### 3) Kullan
1. filmmakinesi (veya herhangi bir) video sayfasını aç
2. Eklenti ikonuna tıkla → panel açılır → **Oda Oluştur**
3. Çıkan linki arkadaşına yolla, o da linke tıklayıp aynı sayfada panelden **Katıl** desin
4. Kamera/mikrofon izni ver → oynat/durdur/sar artık senkron

> Not: P2P bağlantı bazı katı NAT/ağlarda TURN gerektirir. `rtc.js` içinde ücretsiz
> openrelay TURN tanımlı; yoğun kullanımda kendi TURN'ünü (coturn) kurabilirsin.
