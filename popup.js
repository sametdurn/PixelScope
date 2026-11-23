const api = chrome;
const $ = id => document.getElementById(id);
// Metinler _locales/ altından gelir: tarayıcı dili Türkçe ise Türkçe, aksi halde İngilizce.
const t = (key, ...subs) => api.i18n.getMessage(key, subs.map(String));
document.documentElement.lang = api.i18n.getUILanguage();
document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
document.querySelectorAll('[data-i18n-placeholder]').forEach(el => { el.placeholder = t(el.dataset.i18nPlaceholder); });
let items = [], cur = null;

async function tab() { return (await api.tabs.query({ active: true, currentWindow: true }))[0]; }

/* ---------- 1. Engel kaldırma (kalıcı, tüm sitelerde) ---------- */
const msgOf = v => t(v ? 'unlockOn' : 'unlockOff');
api.storage.local.get('unlockAll').then(r => { $('tgl').checked = !!r.unlockAll; $('tglMsg').textContent = msgOf(!!r.unlockAll); });
$('tgl').onchange = async e => {
  await api.storage.local.set({ unlockAll: e.target.checked });
  $('tglMsg').textContent = msgOf(e.target.checked);
};

/* ---------- 1b. Kaydetme konumu ayarı (sor / sorma) ---------- */
let askSave = false;
const askMsgOf = v => t(v ? 'askSaveOn' : 'askSaveOff');
api.storage.local.get('askSaveLocation').then(r => { askSave = !!r.askSaveLocation; $('askSave').checked = askSave; $('askSaveMsg').textContent = askMsgOf(askSave); });
$('askSave').onchange = async e => {
  askSave = e.target.checked;
  await api.storage.local.set({ askSaveLocation: askSave });
  $('askSaveMsg').textContent = askMsgOf(askSave);
};

/* ---------- 2. Görsel tarayıcı (sayfa içinde çalışır) ---------- */
function scanFn() {
  const out = new Map();
  const abs = u => { try { return new URL(u, document.baseURI).href; } catch (e) { return null; } };
  const add = (u, type, w, h, extra) => {
    if (!u) return; u = u.trim();
    if (!u || u === 'about:blank') return;
    if (!u.startsWith('data:')) u = abs(u);
    if (!u) return;
    const o = out.get(u);
    if (o) { if (!o.types.includes(type)) o.types.push(type); if (w && !o.w) { o.w = w; o.h = h; } return; }
    out.set(u, { url: u, types: [type], w: w || 0, h: h || 0, ...extra });
  };
  const parseSrcset = s => s.split(/,\s+(?=\S)|,$/).map(p => p.trim()).filter(Boolean).map(p => {
    const [u, d] = p.split(/\s+/); return { u, d: d || '' };
  });
  const urlRe = /(https?:)?\/\/[^\s"'<>()]+\.(?:jpe?g|png|gif|webp|avif|svg|bmp)(\?[^\s"'<>()]*)?|\/[^\s"'<>()]+\.(?:jpe?g|png|gif|webp|avif|svg|bmp)(\?[^\s"'<>()]*)?/i;

  document.querySelectorAll('img').forEach(img => {
    add(img.currentSrc || img.src, 'img', img.naturalWidth, img.naturalHeight);
    if (img.getAttribute('src')) add(img.getAttribute('src'), 'img', img.naturalWidth, img.naturalHeight);
    const ss = img.getAttribute('srcset') || img.getAttribute('data-srcset');
    if (ss) parseSrcset(ss).forEach(c => add(c.u, 'srcset ' + c.d));
    for (const a of img.attributes) {
      if (a.name === 'src' || a.name === 'srcset' || !/^data-|^lazy/.test(a.name)) continue;
      if (/srcset/.test(a.name)) parseSrcset(a.value).forEach(c => add(c.u, 'lazy'));
      else if (a.value.length < 2048) { const m = a.value.match(urlRe); if (m) add(m[0], 'lazy'); }
    }
    if (/\.svg(\?|$)/i.test(img.currentSrc || img.src)) add(img.currentSrc || img.src, 'svg');
  });
  document.querySelectorAll('source').forEach(s => {
    const ss = s.getAttribute('srcset') || s.getAttribute('data-srcset');
    if (ss) parseSrcset(ss).forEach(c => add(c.u, 'srcset ' + c.d));
  });
  document.querySelectorAll('video[poster]').forEach(v => add(v.poster, 'poster'));
  document.querySelectorAll('input[type=image]').forEach(i => add(i.src, 'img'));
  document.querySelectorAll('meta[property="og:image"],meta[name="twitter:image"],link[rel~=icon],link[rel=apple-touch-icon],link[rel=image_src]')
    .forEach(m => add(m.content || m.href, 'meta'));
  document.querySelectorAll('image').forEach(i => add(i.getAttribute('href') || i.getAttribute('xlink:href'), 'svg'));

  document.querySelectorAll('svg').forEach(svg => {
    if (svg.closest('defs') || svg.querySelector('use') && !svg.querySelector('path,rect,circle')) return;
    const r = svg.getBoundingClientRect(); if (r.width < 16 || r.height < 16) return;
    const c = svg.cloneNode(true); if (!c.getAttribute('xmlns')) c.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    if (!c.getAttribute('width')) c.setAttribute('width', Math.round(r.width));
    if (!c.getAttribute('height')) c.setAttribute('height', Math.round(r.height));
    add('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(c)), 'svg-inline', Math.round(r.width), Math.round(r.height));
  });

  const bgRe = /url\((['"]?)(.*?)\1\)/g;
  document.querySelectorAll('*').forEach(el => {
    for (const ps of [null, '::before', '::after']) {
      const bg = getComputedStyle(el, ps).backgroundImage;
      if (!bg || bg === 'none') continue;
      let m; bgRe.lastIndex = 0;
      while ((m = bgRe.exec(bg))) if (!m[2].startsWith('data:image/svg') || m[2].length < 20000) add(m[2], 'css-bg');
    }
    for (const a of el.attributes) {
      if (/^data-(bg|background|src|lazy)/.test(a.name) && el.tagName !== 'IMG' && a.value.length < 2048) { const m = a.value.match(urlRe); if (m) add(m[0], 'lazy'); }
    }
  });
  return [...out.values()];
}

// Yalnızca http(s) ve data:image/ adresleri işlenir (javascript:, file:, chrome: vb. elenir)
const okUrl = u => typeof u === 'string' && /^(https?:|data:image\/)/i.test(u);

$('scan').onclick = async () => {
  const tb = await tab(); // NOT: `t` i18n fonksiyonu, burada gölgelenmemeli
  $('count').textContent = t('scanning');
  try {
    const res = await api.scripting.executeScript({ target: { tabId: tb.id, allFrames: true }, func: scanFn });
    const map = new Map();
    res.forEach(r => (r.result || []).forEach(i => { if (okUrl(i.url) && !map.has(i.url)) map.set(i.url, i); }));
    items = [...map.values()];
    render();
  } catch (e) { $('count').textContent = t('scanError', e.message); }
};

const short = u => u.startsWith('data:') ? 'data:' + u.slice(5, 30) + '…' : u.split('/').pop().split('?')[0] || u;

function render() {
  const q = $('q').value.toLowerCase();
  const f = items.filter(i => !q || i.url.toLowerCase().includes(q) || i.types.join(' ').includes(q));
  $('count').textContent = t('countText', f.length, items.length);
  const l = $('list'); l.textContent = '';
  f.forEach(i => {
    const d = document.createElement('div'); d.className = 'it';
    const im = document.createElement('img'); im.src = i.url; im.loading = 'lazy'; im.referrerPolicy = 'no-referrer';
    im.onload = () => { if (!i.w) { i.w = im.naturalWidth; i.h = im.naturalHeight; } s.textContent = `${i.w}×${i.h} · ${i.types[0]}`; };
    const s = document.createElement('span'); s.textContent = `${i.w ? i.w + '×' + i.h + ' · ' : ''}${i.types[0]}`;
    s.title = i.url;
    d.append(im, s); d.onclick = () => show(i); l.appendChild(d);
  });
}
$('q').oninput = render;

/* ---------- 3. URL analizcisi ---------- */
function show(i) {
  cur = i; $('list').hidden = true; $('detail').hidden = false;
  $('prev').src = i.url; $('url').value = i.url; $('cands').textContent = '';
  $('meta').textContent = t('metaType', i.types.join(', ')) + (i.w ? ' · ' + i.w + '×' + i.h : '');
}
$('back').onclick = () => { $('detail').hidden = true; $('list').hidden = false; };
$('copy').onclick = async () => { await navigator.clipboard.writeText(cur.url); $('copy').textContent = t('copiedBtn'); setTimeout(() => $('copy').textContent = t('copyBtn'), 1200); };
$('open').onclick = () => {
  if (cur.url.startsWith('data:')) { api.tabs.create({ url: api.runtime.getURL('viewer.html') + '#' + cur.url }); return; }
  if (/^https?:/i.test(cur.url)) api.tabs.create({ url: cur.url });
};
// Dosya adı sayfadan geldiği için temizlenir: yol ayracı yok, uzantı yalnızca görsel uzantıları olabilir
// (aksi halde "x.exe" gibi bir adla çalıştırılabilir dosya indirilebilirdi).
const IMG_EXT = /^(jpe?g|png|gif|webp|avif|svg|bmp|ico|tiff?|heic|heif)$/i;
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
$('dl').onclick = () => { if (okUrl(cur.url)) api.downloads.download({ url: cur.url, filename: fname(cur.url), saveAs: askSave }); };

// Orijinal sürüm adayları (sezgisel)
function candidates(u) {
  if (u.startsWith('data:')) return [];
  const set = new Set(); let x;
  try { x = new URL(u); } catch (e) { return []; }
  const push = s => { if (s && s !== u) set.add(s); };
  // 1) boyut/kalite parametrelerini sil
  const sizeKeys = /^(w|h|width|height|resize|fit|size|s|q|quality|crop|dpr|maxwidth|maxheight|thumb|format|fm|auto)$/i;
  const p = new URL(u); let ch = false;
  [...p.searchParams.keys()].forEach(k => { if (sizeKeys.test(k)) { p.searchParams.delete(k); ch = true; } });
  if (ch) push(p.href);
  if (x.search) push(x.origin + x.pathname);
  // 2) WordPress: foto-300x200.jpg -> foto.jpg
  push(u.replace(/-\d{2,4}x\d{2,4}(?=\.\w{3,4}(\?|$))/, ''));
  push(u.replace(/-scaled(?=\.\w{3,4}(\?|$))/, ''));
  // 3) _thumb, _small, _300x200, _medium vb.
  push(u.replace(/[_-](thumb|thumbnail|small|medium|mini|sm|xs|preview|lowres|lq)(?=\.\w{3,4}(\?|$))/i, ''));
  push(u.replace(/_\d{2,4}x(\d{2,4})?(?=\.\w{3,4}(\?|$))/, ''));      // Shopify
  // 4) yol segmentleri
  push(u.replace(/\/(thumbs?|thumbnails?|small|medium|resized|preview|w_?\d+|\d{2,4}x\d{2,4})\//i, '/'));
  push(u.replace(/\/(thumbs?|small|medium)\//i, '/original/'));
  push(u.replace(/\/(thumbs?|small|medium)\//i, '/large/'));
  // 5) Cloudinary / Imgix benzeri dönüşüm segmenti
  push(u.replace(/\/upload\/[^/]*(?:w_|h_|c_|q_|f_)[^/]*\//, '/upload/'));
  // 6) Google (=s200, =w300-h200) ve Twitter (name=small)
  push(u.replace(/=[swh]\d+(-[a-z0-9-]+)?$/i, '=s0'));
  push(u.replace(/([?&]name=)(small|medium|large|thumb|\d+x\d+)/i, '$1orig'));
  // 7) @2x / -1x
  push(u.replace(/@\dx(?=\.\w{3,4})/i, ''));
  return [...set];
}
const probe = u => new Promise(res => {
  const im = new Image(); im.referrerPolicy = 'no-referrer';
  im.onload = () => res({ u, w: im.naturalWidth, h: im.naturalHeight });
  im.onerror = () => res(null); im.src = u;
});
$('orig').onclick = async () => {
  const box = $('cands'); box.textContent = t('tryingCandidates');
  const base = await probe(cur.url);
  const bw = base ? base.w * base.h : (cur.w * cur.h || 0);
  // sayfadaki srcset adayları da eklenir (aynı dosya adı tabanı)
  const stem = s => s.split('?')[0].split('/').pop().replace(/[-_]\d+x\d+|[-_](thumb|small|medium)|-scaled|\.\w+$/gi, '');
  const sameStem = items.filter(i => i.url !== cur.url && !i.url.startsWith('data:') && stem(i.url) === stem(cur.url)).map(i => i.url);
  const list = [...new Set([...candidates(cur.url), ...sameStem])];
  const res = (await Promise.all(list.map(probe))).filter(Boolean).filter(r => r.w * r.h > bw).sort((a, b) => b.w * b.h - a.w * a.h);
  box.textContent = '';
  if (!res.length) { box.textContent = t('noLarger'); return; }
  res.forEach(r => {
    const d = document.createElement('div');
    const bb = document.createElement('b'); bb.textContent = `${r.w}×${r.h}`; d.append(bb, ' ');
    const a = document.createElement('a'); a.textContent = r.u; a.onclick = () => show({ url: r.u, types: [t('typeOriginalCandidate')], w: r.w, h: r.h });
    d.appendChild(a); box.appendChild(d);
  });
};
