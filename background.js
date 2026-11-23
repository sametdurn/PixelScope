const api = chrome;
// Metinler _locales/ altından gelir: tarayıcı dili Türkçe ise Türkçe, aksi halde İngilizce.
const t = key => api.i18n.getMessage(key);

const ITEMS = [
  ['gk-open', 'menuOpen', false, 'open'],
  ['gk-save', 'menuSave', false, 'save'],
  ['gk-copy', 'menuCopy', false, 'copy'],
  ['gk-open-o', 'menuOpenOrig', true, 'open'],
  ['gk-save-o', 'menuSaveOrig', true, 'save'],
  ['gk-copy-o', 'menuCopyOrig', true, 'copy']
];

function buildMenus() {
  api.contextMenus.removeAll(() => {
    ITEMS.forEach(([id, key]) => api.contextMenus.create(
      { id, title: t(key), contexts: ['all'] },
      () => void api.runtime.lastError
    ));
  });
}
api.runtime.onInstalled.addListener(buildMenus);
api.runtime.onStartup.addListener(buildMenus); // tarayıcı dili değişmişse menüleri yenile

const okUrl = u => typeof u === 'string' && /^(https?:|data:image\/)/i.test(u);

// Dosya adı sayfadan geldiği için temizlenir: yol ayracı yok, uzantı yalnızca görsel uzantıları olabilir
// (aksi halde "x.exe" gibi bir adla çalıştırılabilir dosya indirilebilirdi).
const IMG_EXT = /^(jpe?g|png|gif|webp|avif|svg|bmp|ico|tiff?|heic|heif)$/i;
const MAX_BYTES = 50 * 1024 * 1024; // arka planda indirilecek görsel için üst sınır
const fname = u => {
  const base = t('fileBase');
  if (u.startsWith('data:')) {
    if (/^data:image\/svg/i.test(u)) return base + '.svg';
    const e = ((u.match(/^data:image\/([a-z0-9]+)/i) || [])[1] || 'png').toLowerCase().replace('jpeg', 'jpg');
    return base + '.' + (IMG_EXT.test(e) ? e : 'png');
  }
  let n = '';
  try { n = decodeURIComponent(u.split(/[?#]/)[0].split('/').pop() || ''); } catch (e) {}
  n = n.replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').replace(/^\.+/, '').replace(/[. ]+$/, '').slice(0, 100) || base;
  const ext = (n.match(/\.([a-z0-9]{2,5})$/i) || [])[1];
  return ext && IMG_EXT.test(ext) ? n : n + '.jpg';
};

api.contextMenus.onClicked.addListener(async (info, tab) => {
  const it = ITEMS.find(i => i[0] === info.menuItemId);
  if (!it || !tab) return;
  const [, , orig, act] = it;
  let res = null;
  try { res = await api.tabs.sendMessage(tab.id, { action: 'get', orig }, { frameId: info.frameId || 0 }); } catch (e) {}
  const url = res && okUrl(res.url) ? res.url : null;
  if (!url) {
    try {
      await api.scripting.executeScript({ target: { tabId: tab.id, frameIds: [info.frameId || 0] }, args: [t('alertNoImage')], func: msg => alert(msg) });
    } catch (e) {}
    return;
  }
  if (act === 'copy') {
    const target = { tabId: tab.id, frameIds: [info.frameId || 0] };
    let ok = false;
    const errs = [], msgOf = e => String(e && e.message || e);
    // 1) Önce sayfa içi içerik scripti indirip PNG'ye çevirir (sitenin kendi origin'i ile CORS'a daha uygun)
    let data = null;
    try {
      const r = await api.tabs.sendMessage(tab.id, { action: 'copy', orig }, { frameId: info.frameId || 0 });
      data = r && r.data; if (!data) errs.push('page: ' + ((r && r.err) || 'no data'));
    } catch (e) { errs.push('page: ' + msgOf(e)); }
    // 2) Olmazsa arka planda indir ve çevir
    if (!data) { try { data = await urlToPng(url); } catch (e) { errs.push('bg: ' + msgOf(e)); } }
    if (data) {
      // Chrome/Brave 1. yol: sayfa içinde yaz (site CSP / odak kısıtlarına takılabilir)
      if (!ok) {
        try {
          const [r] = await api.scripting.executeScript({ target, args: [data], func: pageCopy });
          ok = !!(r && r.result && r.result.ok);
          if (!ok) errs.push('clip: ' + ((r && r.result && r.result.err) || 'failed'));
        } catch (e) { errs.push('clip: ' + msgOf(e)); }
      }
      // 2. yol: eklentinin kendi küçük penceresinde yaz (siteden bağımsız)
      if (!ok) {
        const r2 = await copyViaWindow(data);
        ok = r2.ok; if (!ok) errs.push('win: ' + (r2.err || 'failed'));
      }
    }
    const why = errs.join(' | ');
    try {
      await api.scripting.executeScript({
        target, args: [ok, t('toastCopied'), t('toastCopyFailed') + (ok || !why ? '' : ' (' + why.slice(0, 220) + ')')],
        func: (ok, okText, failText) => {
          const d = document.createElement('div');
          d.textContent = ok ? okText : failText;
          d.style.cssText = 'position:fixed;z-index:2147483647;right:16px;bottom:16px;background:#222;color:#fff;padding:8px 14px;border-radius:8px;font:14px system-ui,sans-serif;box-shadow:0 2px 8px #0006';
          document.documentElement.appendChild(d); setTimeout(() => d.remove(), ok ? 1800 : 8000);
        }
      });
    } catch (e) {}
    return;
  }
  if (act === 'open') {
    const target = url.startsWith('data:') ? api.runtime.getURL('viewer.html') + '#' + url : url;
    api.tabs.create({ url: target, index: tab.index + 1, openerTabId: tab.id });
  } else {
    // Ayar: true ise tarayıcı "Farklı kaydet" penceresiyle konum sorar, false ise doğrudan indirir.
    let saveAs = false;
    try { saveAs = !!(await api.storage.local.get('askSaveLocation')).askSaveLocation; } catch (e) {}
    api.downloads.download({ url, filename: fname(url), saveAs });
  }
});

// Görseli indirir ve PNG data URL'ye çevirir (service worker içinde, OffscreenCanvas ile).
async function urlToPng(url) {
  // Arka plan isteği eklenti yetkisiyle (CORS'suz) çalıştığı için kullanıcının çerezleri GÖNDERİLMEZ.
  const r = await fetch(url, { credentials: 'omit' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const len = Number(r.headers.get('content-length') || 0);
  if (len > MAX_BYTES) throw new Error('too large');
  let blob = await r.blob();
  if (blob.size > MAX_BYTES) throw new Error('too large');
  if (blob.type !== 'image/png') {
    const bmp = await createImageBitmap(blob);
    const cv = new OffscreenCanvas(bmp.width, bmp.height);
    cv.getContext('2d').drawImage(bmp, 0, 0);
    blob = await cv.convertToBlob({ type: 'image/png' });
  }
  const u = new Uint8Array(await blob.arrayBuffer());
  let b = ''; for (let i = 0; i < u.length; i += 0x8000) b += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
  return 'data:image/png;base64,' + btoa(b);
}

// Sayfa içinde çalışan kopyalama (executeScript ile enjekte edilir, dış değişken kullanamaz).
async function pageCopy(d) {
  try { window.focus(); } catch (e) {}
  try {
    const bin = atob(d.slice(d.indexOf(',') + 1)), u = new Uint8Array(bin.length);
    for (let k = 0; k < bin.length; k++) u[k] = bin.charCodeAt(k);
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': new Blob([u], { type: 'image/png' }) })]);
    return { ok: true };
  } catch (e) { return { ok: false, err: String(e && e.message || e) }; }
}

// Yedek yol: eklenti sayfasını küçük bir pencerede açıp panoya orada yazar.
let pendingCopy = null, copyDone = null;
async function copyViaWindow(data) {
  if (!api.windows || !api.windows.create) return { ok: false, err: 'no windows api' };
  pendingCopy = data;
  const result = new Promise(res => { copyDone = res; setTimeout(() => res({ ok: false, err: 'timeout' }), 6000); });
  let win = null;
  try {
    win = await api.windows.create({ url: api.runtime.getURL('copy.html'), type: 'popup', width: 240, height: 120, focused: true });
  } catch (e) { pendingCopy = null; return { ok: false, err: String(e && e.message || e) }; }
  const r = await result;
  pendingCopy = null; copyDone = null;
  try { if (win && win.id != null) await api.windows.remove(win.id); } catch (e) {}
  return r;
}
api.runtime.onMessage.addListener((msg, sender, send) => {
  // Bu iki mesaj yalnızca eklentinin kendi copy.html sayfasından kabul edilir (içerik scriptlerinden değil).
  if (sender.id !== api.runtime.id || sender.url !== api.runtime.getURL('copy.html')) return;
  if (msg.action === 'getCopyData') { send(pendingCopy); return; }
  if (msg.action === 'copyResult' && copyDone) { copyDone({ ok: !!msg.ok, err: msg.err || '' }); }
});

// İçerik scripti doğrudan indiremezse (CORS) görseli buradan alır.
api.runtime.onMessage.addListener((msg, _s, send) => {
  // Yalnızca içerik scriptinden (sender.tab) gelen ve http(s) olan istekler
  if (msg.action !== 'fetchData' || _s.id !== api.runtime.id || !_s.tab || typeof msg.url !== 'string' || !/^https?:/i.test(msg.url)) return;
  (async () => {
    try {
      // Çerezsiz; yalnızca gerçekten görsel olan ve makul boyuttaki yanıtlar döndürülür
      // (iç ağdaki/başka sitelerdeki JSON/HTML içeriğinin sayfaya sızmasını önler).
      const r = await fetch(msg.url, { credentials: 'omit' });
      if (!r.ok || Number(r.headers.get('content-length') || 0) > MAX_BYTES) return send(null);
      const b = await r.blob();
      if (b.size > MAX_BYTES || !/^image\//i.test(b.type)) return send(null);
      const u = new Uint8Array(await b.arrayBuffer());
      let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
      send('data:' + b.type + ';base64,' + btoa(s));
    } catch (e) { send(null); }
  })();
  return true;
});
