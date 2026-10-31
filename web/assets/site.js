/* =========================================================
   站点配置 —— 换域名只改这个文件，或者什么都不用改
   ---------------------------------------------------------
   domain 留空时，标题会自动用当前访问的域名（部署到哪个
   域名就显示哪个）。用 file:// 双击打开时没有域名，标题
   就只显示名称。只有你想强制固定一个域名时，才填 domain。
   ========================================================= */
var SITE = {
  name: 'MBTI 人格倾向评估',
  domain: '',
  showQr: true
};

(function () {
  /* ---------- 1. 标题 ---------- */
  var host = '';
  try {
    var proto = location.protocol;
    if (proto === 'http:' || proto === 'https:') host = location.hostname.replace(/^www\./, '');
  } catch (e) {}

  var shown = SITE.domain || host;
  document.title = SITE.name + (shown ? ' · ' + shown : '');

  /* ---------- 2. 页面上的名称 ---------- */
  function putName() {
    var els = document.querySelectorAll('[data-site-name]');
    for (var i = 0; i < els.length; i++) els[i].textContent = SITE.name;
  }

  /* ---------- 3. 小程序码区块 ----------
     码没放进来时整块不出现。把 png 丢进 assets/ 就自动显示，
     不需要改这里，也不用管 showQr。 */
  function initQr() {
    var card = document.getElementById('wxCard');
    if (!card) return;

    if (!SITE.showQr) { card.parentNode.removeChild(card); return; }

    var img = document.getElementById('wxQr');
    if (!img) return;

    function good() { img.classList.add('ok'); card.classList.add('on'); }
    function fail() { /* 缺图：什么都不做，卡片保持隐藏 */ }

    img.addEventListener('load', good);
    img.addEventListener('error', fail);
    if (img.complete) { img.naturalWidth ? good() : fail(); }
  }

  function boot() { putName(); initQr(); }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
