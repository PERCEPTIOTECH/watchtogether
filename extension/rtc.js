// WatchTogether — P2P mesh + signaling.
// Her eş, odadaki diğer her eşe RTCPeerConnection açar (full mesh, küçük grup için ideal).
// Bir data channel taşır: senkron + chat + medya-durumu. Ayrıca ses/kamera track'leri.
// Renegotiation "perfect negotiation" desenıyle yönetilir (geç kamera açma güvenli).

const SIGNAL_URL = 'ws://localhost:8080';   // yayına alınca wss://... yap

const ICE = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    // Ücretsiz TURN (katı NAT'lar için yedek). Yoğun kullanımda kendi coturn'unu kur.
    {
      urls: [
        'turn:openrelay.metered.ca:80',
        'turn:openrelay.metered.ca:443',
        'turn:openrelay.metered.ca:443?transport=tcp',
      ],
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
};

function rid(n = 6) {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < n; i++) s += a[(crypto.getRandomValues(new Uint8Array(1))[0]) % a.length];
  return s;
}

export class Mesh {
  constructor() {
    this.selfId = rid(10);
    this.room = null;
    this.name = 'Misafir';
    this.ws = null;
    this.signalUrl = null;       // panelden ayarlanır; boşsa SIGNAL_URL (localhost)
    this.localStream = null;
    this.peers = new Map();   // peerId -> { pc, dc, name, polite, makingOffer, ignoreOffer }

    // Dışarıdan atanacak geri çağrılar
    this.onStatus = () => {};
    this.onPeer = () => {};        // (peerId, name)
    this.onLeave = () => {};       // (peerId)
    this.onStream = () => {};      // (peerId, MediaStream)
    this.onChat = () => {};        // (peerId, text)
    this.onSync = () => {};        // (peerId, syncObj) — anlık kullanıcı aksiyonu
    this.onHeartbeat = () => {};   // (peerId, {time, paused}) — liderden periyodik hizalama
    this.onMediaState = () => {};  // (peerId, {mic, cam})
    this.onNavigate = () => {};    // (peerId, url) — herkesi başka linke götür
    this.onQueue = () => {};       // (peerId, items) — paylaşımlı sıradaki listesi
    this.onSource = () => {};      // (peerId, url) — host'un şu an izlediği sayfa (takip et)
    this.onControl = () => {};     // (peerId, ids[]) — kontrol yetkisi olan kullanıcılar
  }

  static newRoom() { return rid(6); }

  // Oda üyeleri (kendisi dahil) ve lider seçimi (en küçük id = lider, deterministik)
  memberIds() { return [this.selfId, ...this.peers.keys()]; }
  isLeader() { return this.memberIds().sort()[0] === this.selfId; }

  async setLocalStream(stream) {
    this.localStream = stream;
    // Mevcut tüm bağlantılara track ekle (renegotiation tetiklenir)
    for (const { pc } of this.peers.values()) this._addTracks(pc);
  }

  _addTracks(pc) {
    if (!this.localStream) return;
    const existing = new Set(pc.getSenders().map(s => s.track));
    for (const track of this.localStream.getTracks()) {
      if (!existing.has(track)) pc.addTrack(track, this.localStream);
    }
  }

  connect(room, name) {
    this.room = room;
    this.name = name || 'Misafir';
    this.onStatus('bağlanıyor…');
    const ws = new WebSocket(this.signalUrl || SIGNAL_URL);
    this.ws = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'join', room: this.room, peer: this.selfId }));
      this.onStatus('bağlı, eşler bekleniyor');
    };
    ws.onclose = () => this.onStatus('signaling koptu');
    ws.onerror = () => this.onStatus('signaling hatası (sunucu açık mı?)');

    ws.onmessage = async (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.type === 'peers') {
        // Mevcut eşlere offer'ı BEN başlatırım (glare'i azaltır)
        for (const pid of msg.peers) this._ensurePeer(pid, true);
      } else if (msg.type === 'peer-joined') {
        // Yeni gelen bana offer atacak; ben sadece bağlantıyı hazırlarım
        this._ensurePeer(msg.peer, false);
      } else if (msg.type === 'peer-left') {
        this._dropPeer(msg.peer);
      } else if (msg.type === 'signal') {
        await this._onSignal(msg.from, msg.data);
      }
    };
  }

  _signal(to, data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'signal', to, data }));
    }
  }

  _ensurePeer(peerId, initiator) {
    if (this.peers.has(peerId)) return this.peers.get(peerId);

    const pc = new RTCPeerConnection(ICE);
    // Politeness: id karşılaştırması → her çift için deterministik
    const polite = this.selfId > peerId;
    const state = { pc, dc: null, name: null, polite, makingOffer: false, ignoreOffer: false, pendingCands: [], remoteReady: false, negotiated: false };
    this.peers.set(peerId, state);

    this._addTracks(pc);

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) this._signal(peerId, { candidate });
    };

    // İlk teklifi başlatıcı AÇIKÇA yollar (aşağıda). onnegotiationneeded yalnızca
    // bağlantı kurulduktan SONRAKİ değişiklikler (geç kamera ekleme) için yedek —
    // ilk kurulumda tetiklenirse (Chrome) çift teklifi önlemek için 'negotiated' guard'ı.
    pc.onnegotiationneeded = () => { if (state.negotiated) this._makeOffer(peerId); };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') { state.negotiated = true; this.onStatus('bağlı'); }
      if (['failed', 'closed'].includes(pc.connectionState)) this._dropPeer(peerId);
    };

    const remoteStream = new MediaStream();
    pc.ontrack = (e) => {
      for (const t of e.streams[0] ? e.streams[0].getTracks() : [e.track]) remoteStream.addTrack(t);
      this.onStream(peerId, remoteStream);
    };

    // Data channel: initiator oluşturur, diğeri ondatachannel ile alır
    if (initiator) {
      const dc = pc.createDataChannel('wt', { ordered: true });
      this._wireChannel(peerId, state, dc);
      this._makeOffer(peerId);   // ilk teklifi açıkça başlat
    } else {
      pc.ondatachannel = (e) => this._wireChannel(peerId, state, e.channel);
    }

    return state;
  }

  async _makeOffer(peerId) {
    const state = this.peers.get(peerId);
    if (!state) return;
    const pc = state.pc;
    try {
      state.makingOffer = true;
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this._signal(peerId, { description: pc.localDescription });
    } catch (e) {
      console.warn('[wt] offer error', e);
    } finally {
      state.makingOffer = false;
    }
  }

  _wireChannel(peerId, state, dc) {
    state.dc = dc;
    dc.onopen = () => {
      this.onPeer(peerId, state.name || peerId);
      // Kendini tanıt
      this._send(dc, { t: 'hello', name: this.name });
    };
    dc.onmessage = (e) => {
      let m; try { m = JSON.parse(e.data); } catch { return; }
      if (m.t === 'hello') { state.name = m.name; this.onPeer(peerId, m.name); }
      else if (m.t === 'chat') this.onChat(peerId, m.text);
      else if (m.t === 'sync') this.onSync(peerId, m);
      else if (m.t === 'hb') this.onHeartbeat(peerId, m);
      else if (m.t === 'media') this.onMediaState(peerId, { mic: m.mic, cam: m.cam });
      else if (m.t === 'nav') this.onNavigate(peerId, m.url);
      else if (m.t === 'queue') this.onQueue(peerId, m.items);
      else if (m.t === 'src') this.onSource(peerId, m.url);
      else if (m.t === 'ctl') this.onControl(peerId, m.ids);
    };
  }

  async _onSignal(peerId, data) {
    const state = this._ensurePeer(peerId, false);
    const pc = state.pc;

    if (data.description) {
      const desc = data.description;
      const offerCollision =
        desc.type === 'offer' && (state.makingOffer || pc.signalingState !== 'stable');
      state.ignoreOffer = !state.polite && offerCollision;
      if (state.ignoreOffer) return;

      await pc.setRemoteDescription(desc);
      state.remoteReady = true;
      // Remote description hazır → bekleyen ICE aday'larını boşalt
      for (const c of state.pendingCands.splice(0)) {
        try { await pc.addIceCandidate(c); } catch (e) { console.warn('[wt] ICE flush fail', e); }
      }
      if (desc.type === 'offer') {
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        this._signal(peerId, { description: pc.localDescription });
      }
    } else if (data.candidate) {
      // Remote description gelmeden aday eklenemez → gelene kadar kuyrukla
      if (!state.remoteReady) { state.pendingCands.push(data.candidate); return; }
      try { await pc.addIceCandidate(data.candidate); }
      catch (e) { if (!state.ignoreOffer) console.warn('[wt] ICE add fail', e); }
    }
  }

  _dropPeer(peerId) {
    const state = this.peers.get(peerId);
    if (!state) return;
    try { state.pc.close(); } catch {}
    this.peers.delete(peerId);
    this.onLeave(peerId);
  }

  _send(dc, obj) {
    if (dc && dc.readyState === 'open') dc.send(JSON.stringify(obj));
  }

  broadcast(obj) {
    for (const { dc } of this.peers.values()) this._send(dc, obj);
  }

  sendChat(text) { this.broadcast({ t: 'chat', text }); }
  sendSync(sync) { this.broadcast({ t: 'sync', ...sync }); }
  sendHeartbeat(hb) { this.broadcast({ t: 'hb', ...hb }); }
  sendNavigate(url) { this.broadcast({ t: 'nav', url }); }
  sendQueue(items) { this.broadcast({ t: 'queue', items }); }
  sendSource(url) { this.broadcast({ t: 'src', url }); }
  sendControl(ids) { this.broadcast({ t: 'ctl', ids }); }
  sendMediaState(mic, cam) { this.broadcast({ t: 'media', mic, cam }); }

  leave() {
    try { this.ws && this.ws.send(JSON.stringify({ type: 'leave' })); } catch {}
    for (const id of [...this.peers.keys()]) this._dropPeer(id);
    try { this.ws && this.ws.close(); } catch {}
    if (this.localStream) for (const t of this.localStream.getTracks()) t.stop();
    this.localStream = null;
  }
}
