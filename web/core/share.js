/* =========================================================
   答案串：把 60 题作答 + 档案压成一行字符，放进链接
   ---------------------------------------------------------
   用途：在小程序里答完题的人，不用重答，就能在浏览器
   打开同一份报告并打印成 PDF。

   为什么放在 # 后面：
   浏览器不会把 # 之后的内容发给服务器。所以把这个串
   写进 location.hash，计算依然全部在本机完成，「不上传
   任何数据」这句话不用改一个字。

   长度固定 70 位：
     1  位  版本（题库一改就升版本，旧链接必须能被认出来）
     60 位  每题的答案，0–6 代表 1–7
     6  位  出生日期 YYMMDD，没填就是 000000
     1  位  性别 m / f / o，没填是 0
     2  位  校验（base36），防止手抄或截断出错
   ========================================================= */

var ShareCode = (function () {
  var VERSION = '1';
  var TOTAL = 60;
  var LEN = 1 + TOTAL + 6 + 1 + 2;

  var G2C = { male: 'm', female: 'f', other: 'o' };
  var C2G = { m: 'male', f: 'female', o: 'other' };

  /* 两位年份 → 四位：30 是分界，60 后生人不会被算成 2060 */
  function fullYear(yy) {
    return yy > 30 ? 1900 + yy : 2000 + yy;
  }

  function birthTo6(birth) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birth || '');
    if (!m) return '000000';
    return m[1].slice(2) + m[2] + m[3];
  }

  function sixToBirth(s) {
    if (!/^\d{6}$/.test(s) || s === '000000') return '';
    return fullYear(parseInt(s.slice(0, 2), 10)) + '-' + s.slice(2, 4) + '-' + s.slice(4, 6);
  }

  /* 1296 = 36^2，正好压成两位 base36 */
  function sum(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 1296;
    return ('0' + h.toString(36)).slice(-2);
  }

  function encode(answers, profile) {
    if (!answers || answers.length !== TOTAL) return '';
    var body = VERSION;
    for (var i = 0; i < TOTAL; i++) {
      var v = answers[i];
      if (!(v >= 1 && v <= 7)) return '';
      body += String(v - 1);
    }
    var p = profile || {};
    body += birthTo6(p.birth);
    body += G2C[p.gender] || '0';
    return body + sum(body);
  }

  /* 只认完整且校验通过的串。任何一位不对就整条作废，
     绝不「尽力恢复」——半份答案算出来的报告比没有更糟。 */
  function decode(code) {
    if (!code || typeof code !== 'string') return { ok: false, reason: 'empty' };
    code = code.trim().toLowerCase();
    if (code.length !== LEN) return { ok: false, reason: 'length' };
    if (code.charAt(0) !== VERSION) return { ok: false, reason: 'version' };

    var body = code.slice(0, LEN - 2);
    if (sum(body) !== code.slice(LEN - 2)) return { ok: false, reason: 'checksum' };

    var answers = [];
    for (var i = 1; i <= TOTAL; i++) {
      var d = code.charCodeAt(i) - 48;
      if (d < 0 || d > 6) return { ok: false, reason: 'digit' };
      answers.push(d + 1);
    }

    var b6 = code.slice(1 + TOTAL, 1 + TOTAL + 6);
    var g = code.charAt(1 + TOTAL + 6);

    return {
      ok: true,
      answers: answers,
      profile: { name: '', birth: sixToBirth(b6), gender: C2G[g] || '' }
    };
  }

  return { VERSION: VERSION, LEN: LEN, encode: encode, decode: decode };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = { ShareCode: ShareCode };
