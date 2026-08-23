# Kendi TURN sunucun (coturn)

Katı NAT / güvenlik duvarındaki arkadaşların da **her zaman bağlanabilmesi** için kendi
TURN sunucun. İki yol var — kolay olandan başla:

---

## ⭐ Yol A — Sunucu KURMADAN (Metered.ca ücretsiz, önerilen)

En kolay. VPS gerekmez, 50GB/ay ücretsiz.

1. https://www.metered.ca/tools/openrelay/ → ücretsiz hesap aç
2. Dashboard → **TURN Credentials** → sana bir **host**, **username**, **password** verir
3. Eklenti panelinde **Sunucu ayarı (gelişmiş)** → **TURN** alanına yaz:
   ```
   <host> <username> <password>
   ```
   (üç değeri boşlukla ayır; ör. `a.relay.metered.ca 1a2b… xyz…`)
4. Kaydedilir; yeni bağlantılarda geçerli olur. Bitti.

> Cloudflare'in de ücretsiz TURN'ü var (Realtime/Calls) — o da olur.

---

## Yol B — Kendi VPS'inde coturn (tam kontrol)

Aylık ~€4 bir VPS (Hetzner, DigitalOcean, Contabo…) yeterli. **Public IP** şart.

### 1. Firewall'da portları aç
- UDP **3478**, **5349**, **49152-65535**
- TCP **3478**, **5349**

### 2. Bu klasörü sunucuya kopyala, `turnserver.conf`'u düzenle
- `user=watchtogether:DEGISTIR_GUCLU_SIFRE` → güçlü bir şifre koy
- `external-ip=SENIN_PUBLIC_IP` satırını yorumdan çıkar, VPS'in public IP'sini yaz

### 3. Çalıştır
```bash
docker compose up -d
```
(Docker yoksa: `apt install coturn` + aynı conf ile `turnserver -c turnserver.conf`.)

### 4. Eklentiye gir
Panel → **Sunucu ayarı (gelişmiş)** → **TURN** alanına:
```
turn:SENIN_PUBLIC_IP:3478 watchtogether SIFREN
```

### 5. Test
`turn:` çalışıyor mu diye https://icetest.info veya Trickle ICE
(https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/) ile dene —
`relay` adayı görüyorsan TURN çalışıyor.

---

## Neden gerekli?
Ücretsiz `openrelay` TURN güvenilmez/limitli. İki kişi de ev ağındaysa (NAT) doğrudan P2P
kurulamayabilir; TURN devreye girip trafiği relay eder. Kendi TURN'ün = herkes her ağdan
bağlanır. Eklentide kendi TURN'ün **önce** denenir, olmazsa openrelay son çare kalır.
