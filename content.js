(() => {
  const api = chrome;
  let last = null;
  const abs = u => { try { return new URL(u, document.baseURI).href; } catch (e) { return null; } };
  const urlRe = /(https?:)?\/\/[^\s"'<>()]+\.(?:jpe?g|png|gif|webp|avif|svg|bmp)(\?[^\s"'<>()]*)?|\/[^\s"'<>()]+\.(?:jpe?g|png|gif|webp|avif|svg|bmp)(\?[^\s"'<>()]*)?/i;
  const parseSrcset = s => (s || '').split(/,\s+(?=\S)|,$/).map(p => p.trim().split(/\s+/)[0]).filter(Boolean);

  function fromEl(el) {
    const tag = el.tagName;
    if (tag === 'IMG') {
      let u = el.currentSrc || el.src;
      let set = parseSrcset(el.getAttribute('srcset') || el.getAttribute('data-srcset'));
      if (!u || (u.startsWith('data:') && u.length < 300)) {
        for (const a of el.attributes) {
          if (!/^data-|^lazy/.test(a.name)) continue;
          if (a.value.length >= 2048) continue;
          const m = a.value.match(urlRe); if (m) { u = m[0]; break; }
        }
      }
      if (u) return { url: u.startsWith('data:') ? u : abs(u), srcset: set.map(abs).filter(Boolean) };
    }
    if (tag === 'CANVAS') { try { return { url: el.toDataURL('image/png'), srcset: [] }; } catch (e) {} }
    if (tag === 'VIDEO' && el.poster) return { url: abs(el.poster), srcset: [] };
    if (el instanceof SVGSVGElement || (el.closest && el.closest('svg') && tag !== 'IMG')) {
      const svg = el instanceof SVGSVGElement ? el : el.closest('svg');
      const r = svg.getBoundingClientRect();
      const c = svg.cloneNode(true);
      if (!c.getAttribute('xmlns')) c.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      if (!c.getAttribute('width')) c.setAttribute('width', Math.round(r.width));
      if (!c.getAttribute('height')) c.setAttribute('height', Math.round(r.height));
      return { url: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(c)), srcset: [] };
    }
    for (const ps of [null, '::before', '::after']) {
      const bg = getComputedStyle(el, ps).backgroundImage;
      const m = bg && bg !== 'none' && bg.match(/url\((['"]?)(.*?)\1\)/);
      if (m) return { url: m[2].startsWith('data:') ? m[2] : abs(m[2]), srcset: [] };
    }
    return null;
  }

  function urlAt(x, y) {
    const els = document.elementsFromPoint(x, y);
    for (const el of els) { const r = fromEl(el); if (r) return r; }
    // üstteki katmanların içindeki görseller
    for (const el of els.slice(0, 3)) {
      const k = el.querySelector && el.querySelector('img,canvas,svg');
      if (k) { const r = fromEl(k); if (r) return r; }
    }
    return null;
  }

  const capture = (x, y) => { try { last = urlAt(x, y); } catch (e) { last = null; } return !!last; };
  document.addEventListener('gk-ctx', () => {
    const d = document.documentElement;
    const [x, y] = (d.getAttribute('data-gk-xy') || '0,0').split(',').map(Number);
    if (capture(x, y)) d.setAttribute('data-gk-img', '1');
  });
  window.addEventListener('contextmenu', e => capture(e.clientX, e.clientY), true); // yedek

  /* ---- orijinal sürüm ---- */
  function candidates(u) {
    if (u.startsWith('data:')) return [];
    const set = new Set(); let x;
    try { x = new URL(u); } catch (e) { return []; }
    const push = s => { if (s && s !== u) set.add(s); };
    const sizeKeys = /^(w|h|width|height|resize|fit|size|s|q|quality|crop|dpr|maxwidth|maxheight|thumb|format|fm|auto)$/i;
    const p = new URL(u); let ch = false;
    [...p.searchParams.keys()].forEach(k => { if (sizeKeys.test(k)) { p.searchParams.delete(k); ch = true; } });
    if (ch) push(p.href);
    if (x.search) push(x.origin + x.pathname);
    push(u.replace(/-\d{2,4}x\d{2,4}(?=\.\w{3,4}(\?|$))/, ''));
    push(u.replace(/-scaled(?=\.\w{3,4}(\?|$))/, ''));
    push(u.replace(/[_-](thumb|thumbnail|small|medium|mini|sm|xs|preview|lowres|lq)(?=\.\w{3,4}(\?|$))/i, ''));
    push(u.replace(/_\d{2,4}x(\d{2,4})?(?=\.\w{3,4}(\?|$))/, ''));
    push(u.replace(/\/(thumbs?|thumbnails?|small|medium|resized|preview|w_?\d+|\d{2,4}x\d{2,4})\//i, '/'));
    push(u.replace(/\/(thumbs?|small|medium)\//i, '/original/'));
    push(u.replace(/\/(thumbs?|small|medium)\//i, '/large/'));
    push(u.replace(/\/upload\/[^/]*(?:w_|h_|c_|q_|f_)[^/]*\//, '/upload/'));
    push(u.replace(/=[swh]\d+(-[a-z0-9-]+)?$/i, '=s0'));
    push(u.replace(/([?&]name=)(small|medium|large|thumb|\d+x\d+)/i, '$1orig'));
    push(u.replace(/@\dx(?=\.\w{3,4})/i, ''));
    return [...set];
  }
  const probe = u => new Promise(res => {
    const im = new Image(); im.referrerPolicy = 'no-referrer';
    im.onload = () => res({ u, a: im.naturalWidth * im.naturalHeight });
    im.onerror = () => res(null); im.src = u;
  });
  async function best(l) {
    const base = await probe(l.url);
    const ba = base ? base.a : 0;
    const list = [...new Set([...candidates(l.url), ...l.srcset])].filter(u => u !== l.url);
    const res = (await Promise.all(list.map(probe))).filter(r => r && r.a > ba).sort((a, b) => b.a - a.a);
    return res.length ? res[0].u : l.url;
  }

  /* ---- genel engel kaldırma ayarı ---- */
  const setOn = v => {
    const d = document.documentElement;
    v ? d.setAttribute('data-gk-on', '1') : d.removeAttribute('data-gk-on');
    document.dispatchEvent(new Event('gk-sync'));
  };
  api.storage.local.get('unlockAll').then(r => setOn(!!r.unlockAll));
  api.storage.onChanged.addListener((c, area) => { if (area === 'local' && c.unlockAll) setOn(!!c.unlockAll.newValue); });

  /* ---- kopyalama ---- */
  const toast = t => {
    const d = document.createElement('div');
    d.textContent = t;
    d.style.cssText = 'position:fixed;z-index:2147483647;right:16px;bottom:16px;background:#222;color:#fff;padding:8px 14px;border-radius:8px;font:14px system-ui,sans-serif;box-shadow:0 2px 8px #0006';
    document.documentElement.appendChild(d); setTimeout(() => d.remove(), 1800);
  };
  async function getBlob(url) {
    const errs = [], msgOf = e => String(e && e.message || e);
    // Önce çerezsiz dene (CDN'ler çoğunlukla 'Access-Control-Allow-Origin: *' döner; çerezli istekte bu reddedilir)
    for (const opt of [{}, { credentials: 'include' }]) {
      try { const r = await fetch(url, opt); if (r.ok) return await r.blob(); errs.push('HTTP ' + r.status); }
      catch (e) { errs.push(msgOf(e)); }
    }
    let data = null;
    try { data = await api.runtime.sendMessage({ action: 'fetchData', url }); } catch (e) { errs.push('msg: ' + msgOf(e)); }
    if (!data) throw new Error(errs.join(', ') || 'download failed');
    return dataToBlob(data);
  }
  function dataToBlob(d) {
    const i = d.indexOf(','), m = (d.slice(5, i).split(';')[0]) || 'image/png';
    const bin = atob(d.slice(i + 1)), u = new Uint8Array(bin.length);
    for (let k = 0; k < bin.length; k++) u[k] = bin.charCodeAt(k);
    return new Blob([u], { type: m });
  }
  const blobToData = b => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(b); });
  async function toPng(blob) {
    if (blob.type === 'image/png') return blob;
    let src, w, h;
    try { src = await createImageBitmap(blob); w = src.width; h = src.height; }
    catch (e) {
      const u = URL.createObjectURL(blob);
      src = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = u; });
      w = src.naturalWidth || 512; h = src.naturalHeight || 512;
    }
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    cv.getContext('2d').drawImage(src, 0, 0, w, h);
    return await new Promise((res, rej) => cv.toBlob(b => b ? res(b) : rej(new Error('png')), 'image/png'));
  }
  api.runtime.onMessage.addListener((msg, _s, send) => {
    if (msg.action !== 'get' && msg.action !== 'copy') return;
    if (!last) { send({ url: null }); return; }
    (async () => {
      const url = msg.orig ? await best(last).catch(() => last.url) : last.url;
      if (msg.action === 'get') return send({ url });
      try { send({ url, data: await blobToData(await toPng(await getBlob(url))) }); }
      catch (e) { send({ url, data: null, err: String(e && e.message || e) }); }
    })();
    return true;
  });
})();
