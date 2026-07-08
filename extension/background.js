// WatchTogether — arka plan (service worker).
//  - Toolbar ikonu: paneli aç/kapat.
//  - Panel ↔ video-frame mesaj rölesi.
//  - "Select Video": komutları seçilen HEDEF sekmeye yönlendirir (panel başka sekmedeyken bile).

let panelTab = null;    // panelin bulunduğu sekme
let targetTab = null;   // kontrol edilen video sekmesi (null => panelTab ile aynı)

chrome.action.onClicked.addListener((tab) => {
  if (tab.id) chrome.tabs.sendMessage(tab.id, { wt: true, kind: 'toggle-panel' }, () => void chrome.runtime.lastError);
});

function toTab(id, msg) {
  if (id != null) chrome.tabs.sendMessage(id, msg, () => void chrome.runtime.lastError);
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.wt) return;
  const from = sender.tab && sender.tab.id;

  switch (msg.kind) {
    case 'list-tabs':
      chrome.tabs.query({}, (tabs) => {
        const list = tabs
          .filter((t) => t.id != null && /^https?:/.test(t.url || ''))
          .map((t) => ({ id: t.id, title: t.title || t.url, url: t.url }));
        sendResponse({ tabs: list, current: from, target: targetTab });
      });
      return true;   // async yanıt

    case 'set-target':
      panelTab = from;
      targetTab = (msg.tabId && msg.tabId !== from) ? msg.tabId : null;
      return;

    case 'video-cmd':
      panelTab = from;
      toTab(targetTab || from, { wt: true, kind: 'video-cmd', cmd: msg.cmd });
      return;

    case 'video-query':
      panelTab = from;
      toTab(targetTab || from, { wt: true, kind: 'video-query' });
      return;

    case 'video-event':
      // Video sekmesinden geldi → panel sekmesine ilet
      toTab(panelTab || from, { wt: true, kind: 'video-event', event: msg.event });
      return;

    case 'navigate-tab':
      chrome.tabs.update(targetTab || panelTab || from, { url: msg.url });
      return;
  }
});
