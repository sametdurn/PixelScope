// Sayfanın kendi dünyasında, site scriptlerinden önce çalışır.
(() => {
  const EV = ['contextmenu', 'selectstart', 'dragstart', 'drag', 'copy', 'cut', 'select'];
  const origPD = Event.prototype.preventDefault;
  let on = false, st = null, iv = null;

  Event.prototype.preventDefault = function () {
    if (on && EV.includes(this.type)) return;
    return origPD.apply(this, arguments);
  };

  const stopper = e => {
    if (!on) return;
    if ((e.type === 'mousedown' || e.type === 'mouseup') && e.button !== 2) return;
    e.stopImmediatePropagation();
  };
  EV.filter(t => t !== 'contextmenu').concat(['mousedown', 'mouseup']).forEach(t => window.addEventListener(t, stopper, true));

  // Görsel üstünde sağ tık: her zaman engeli kır. Genel ayar açıksa her yerde kır.
  window.addEventListener('contextmenu', e => {
    const d = document.documentElement;
    d.setAttribute('data-gk-xy', e.clientX + ',' + e.clientY);
    d.removeAttribute('data-gk-img');
    document.dispatchEvent(new Event('gk-ctx'));
    const hit = d.getAttribute('data-gk-img') === '1';
    d.removeAttribute('data-gk-xy');
    if (hit || on) e.stopImmediatePropagation();
  }, true);

  const clean = () => {
    const els = [document, document.documentElement, document.body, ...document.querySelectorAll('img,a,div')];
    els.forEach(el => {
      if (!el) return;
      EV.forEach(t => { try { el['on' + t] = null; } catch (e) {} });
      if (el.hasAttribute) ['oncontextmenu', 'onselectstart', 'ondragstart', 'oncopy', 'oncut', 'onmousedown', 'onmouseup'].forEach(a => {
        if (el.hasAttribute(a)) el.removeAttribute(a);
      });
    });
  };

  const apply = v => {
    if (v === on) return;
    on = v;
    if (v) {
      st = document.createElement('style');
      st.textContent = '*,*::before,*::after{-webkit-user-select:auto!important;-moz-user-select:auto!important;user-select:auto!important;-webkit-user-drag:auto!important}';
      document.documentElement.appendChild(st);
      clean(); iv = setInterval(clean, 1500);
    } else {
      if (st) st.remove(); if (iv) clearInterval(iv); st = iv = null;
    }
  };
  document.addEventListener('gk-sync', () => apply(document.documentElement.hasAttribute('data-gk-on')));
})();
