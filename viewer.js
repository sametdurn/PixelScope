const api = chrome;
document.documentElement.lang = api.i18n.getUILanguage();
document.title = api.i18n.getMessage('viewerTitle');
// Yalnızca data:image/ kabul edilir; başka bir şey hash'e yazılsa bile yüklenmez.
const src = location.hash.slice(1);
if (/^data:image\//i.test(src)) document.getElementById('i').src = src;
