// Yedek kopyalama sayfası: arka plandan görseli alır, panoya yazar, sonucu bildirir.
const api = chrome;
(async () => {
  let ok = false, err = '';
  try {
    window.focus();
    const d = await api.runtime.sendMessage({ action: 'getCopyData' });
    if (!d) throw new Error('no data');
    const bin = atob(d.slice(d.indexOf(',') + 1)), u = new Uint8Array(bin.length);
    for (let k = 0; k < bin.length; k++) u[k] = bin.charCodeAt(k);
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': new Blob([u], { type: 'image/png' }) })]);
      ok = true;
    } catch (e) {
      err = String(e && e.message || e);
      const img = new Image(); img.src = d; await img.decode();
      const box = document.createElement('div'); box.contentEditable = 'true'; box.appendChild(img);
      document.body.appendChild(box); box.focus();
      const sel = getSelection(), rg = document.createRange();
      rg.selectNodeContents(box); sel.removeAllRanges(); sel.addRange(rg);
      ok = document.execCommand('copy');
    }
  } catch (e) { err = err || String(e && e.message || e); }
  api.runtime.sendMessage({ action: 'copyResult', ok, err });
})();
