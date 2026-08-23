// WatchTogether — arka plan (service worker).
//  - Toolbar ikonu: paneli aç/kapat.
//  - Panel ↔ video-frame mesaj rölesi (SEKME BAŞINA — birden çok sekme/oda çakışmaz).
//  - "Select Video": komutları seçilen HEDEF sekmeye yönlendirir.

const targets = new Map();   // panelTabId -> targetTabId (Select Video)
const panelOf = new Map();   // videoTabId -> panelTabId (olayları doğru panele döndür)

const destFor = (panelTabId) => targets.get(panelTabId) || panelTabId;
function toTab(id, msg) { if (id != null) chrome.tabs.sendMessage(id, msg, () => void chrome.runtime.lastError); }

chrome.action.onClicked.addListener((tab) => {
  if (tab.id) toTab(tab.id, { wt: true, kind: 'toggle-panel' });
});

chrome.tabs.onRemoved.addListener((tabId) => {   // kapanan sekmelerin haritalarını temizle
  targets.delete(tabId); panelOf.delete(tabId);
  for (const [v, p] of panelOf) if (p === tabId) panelOf.delete(v);
  for (const [p, t] of targets) if (t === tabId) targets.delete(p);
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.wt) return;
  const from = sender.tab && sender.tab.id;
  if (from == null && msg.kind !== 'list-tabs') return;

  switch (msg.kind) {
    case 'list-tabs':
      chrome.tabs.query({}, (tabs) => {
        const list = tabs.filter((t) => t.id != null && /^https?:/.test(t.url || ''))
          .map((t) => ({ id: t.id, title: t.title || t.url, url: t.url }));
        sendResponse({ tabs: list, current: from, target: targets.get(from) || null });
      });
      return true;

    case 'set-target':
      if (msg.tabId && msg.tabId !== from) targets.set(from, msg.tabId); else targets.delete(from);
      panelOf.set(destFor(from), from);
      return;

    case 'video-cmd': { const d = destFor(from); panelOf.set(d, from); toTab(d, { wt: true, kind: 'video-cmd', cmd: msg.cmd }); return; }
    case 'video-query': { const d = destFor(from); panelOf.set(d, from); toTab(d, { wt: true, kind: 'video-query' }); return; }
    case 'video-event': { toTab(panelOf.get(from) || from, { wt: true, kind: 'video-event', event: msg.event }); return; }
    case 'navigate-tab': chrome.tabs.update(destFor(from), { url: msg.url }); return;
  }
});
