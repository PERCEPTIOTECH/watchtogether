# WatchTogether — Gizlilik Politikası / Privacy Policy

_Son güncelleme: 2026 · Geliştirici: PERCEPT_

## Türkçe

WatchTogether, arkadaşlarınızla aynı videoyu senkron izlemenizi; sesli, kameralı ve
yazılı sohbet etmenizi sağlayan bir tarayıcı eklentisidir.

### Ne topluyoruz / işliyoruz
- **Kamera ve mikrofon:** Yalnızca bir odaya katıldığınızda ve izin verdiğinizde açılır.
  Ses ve görüntü, **doğrudan katılımcılar arasında (P2P / WebRTC)** akar. **Hiçbir sunucuda
  saklanmaz, kaydedilmez veya üçüncü taraflarla paylaşılmaz.**
- **Görünen adınız:** Odadaki diğer katılımcılara gösterilir. Yerel olarak tarayıcınızda
  (chrome.storage) saklanır; bize gönderilmez.
- **İzlediğiniz sayfanın adresi (URL):** Senkron için oda içindeki katılımcılarla paylaşılır
  (herkesin aynı videoda olması için). Bu bilgi sunucuda saklanmaz.
- **Sohbet mesajları:** Doğrudan katılımcılar arasında (P2P) iletilir, sunucuda saklanmaz.

### Sunucu (signaling)
Yalnızca katılımcıların ilk **bağlantı el sıkışmasını** (WebRTC signaling) iletmek için
minik bir sunucu kullanılır. Bu sunucudan **video, ses, kamera veya sohbet içeriği GEÇMEZ**;
yalnızca "kim kiminle bağlanacak" bilgisi geçici olarak röle edilir ve saklanmaz.

### Toplamadıklarımız
- Analitik / izleme yok. Reklam yok. Çerez yok.
- Kişisel verilerinizi **satmıyoruz** ve satmayacağız.
- Verilerinizi, eklentinin çekirdek işlevi (birlikte izleme) dışında **hiçbir amaçla
  kullanmıyoruz**.

### İzinler neden gerekli
- **`<all_urls>` / içerik betikleri:** Herhangi bir video sitesinde `<video>` öğesini bulup
  senkron kontrol edebilmek için.
- **`tabs`:** "Video kaynağı" seçiminde açık sekmeleri listelemek ve komutları doğru sekmeye
  yönlendirmek için.
- **`storage`:** Adınızı ve sunucu ayarını yerel olarak hatırlamak için.

### İletişim
Sorular için: geliştirici PERCEPT · GitHub: github.com/PERCEPTIOTECH/watchtogether

---

## English (summary)

WatchTogether lets you watch videos in sync with friends, with voice, camera and chat.
Camera/microphone are used only when you join a room and grant permission, and stream
**peer-to-peer (WebRTC)** — never stored on any server or shared with third parties. Your
display name and server setting are stored **locally** in your browser. The page URL is
shared **only with people in your room** for sync and is not stored. A minimal signaling
server relays only the initial WebRTC handshake — **no media, audio, camera or chat content
passes through it**. No analytics, no ads, no cookies, no data selling.
