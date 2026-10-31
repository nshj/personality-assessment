/* =========================================================
   分析引擎（纯本地计算，无网络请求）
   Analyzer.score()      计分 + 一致性检验 + 可信度评估
   Analyzer.matchRules() 规则匹配
   Analyzer.zodiac()     星座（仅对照用）
   ========================================================= */
var Analyzer = (function () {
  /* 两端加载：浏览器读全局，小程序走 require（小程序无 window） */
  var CJS  = (typeof module !== 'undefined' && module.exports);
  var DIMS      = CJS ? require('./dims.js').DIM_DATA      : window.DIM_DATA;
  var Q         = CJS ? require('./questions.js').QUESTIONS : window.QUESTIONS;
  var TIERS     = CJS ? require('./dims.js').TIERS         : window.TIERS;
  var TYPE_DATA = CJS ? require('./types.js').TYPE_DATA    : window.TYPE_DATA;
  var RULES     = CJS ? require('./rules.js').RULES        : window.RULES;
  var AGE_BANDS = CJS ? require('./profile.js').AGE_BANDS  : window.AGE_BANDS;
  var ZODIAC    = CJS ? require('./profile.js').ZODIAC     : window.ZODIAC;

  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function avg(arr) { return arr.length ? arr.reduce(function (a, b) { return a + b; }, 0) / arr.length : 0; }

  /* ---------------- 计分 ---------------- */
  function score(answers) {
    var dims = DIMS.map(function (dim) {
      var sum = 0, n = 0, plusLeans = [], minusLeans = [];

      Q.forEach(function (q, i) {
        if (q.d !== dim.k) return;
        n++;
        var raw  = answers[i] - 4;                                  // -3 .. 3
        var lean = (q.p === dim.plus) ? raw : -raw;                  // 正向：指向 plus
        sum += lean;
        if (q.p === dim.plus) plusLeans.push(lean); else minusLeans.push(lean);
      });

      var max      = 3 * n;
      var pctPlus  = clamp(Math.round(50 + 50 * sum / max), 0, 100);
      var plusLead = sum >= 0;
      var lead     = plusLead ? dim.plus : dim.minus;
      var leadPct  = plusLead ? pctPlus : 100 - pctPlus;
      var dist     = Math.abs(leadPct - 50);
      var tier     = TIERS.filter(function (t) { return dist <= t.max; })[0] || TIERS[3];

      /* 一致性：正向题组与反向题组的倾向是否吻合
         完全一致时两组均值应相等；差距越大说明作答越自相矛盾 */
      var gap     = Math.abs(avg(plusLeans) - avg(minusLeans));
      var consist = Math.round(clamp(100 * (1 - gap / 4), 0, 100));

      var poleData = dim.poles[lead];
      var otherPole = plusLead ? dim.minus : dim.plus;

      return {
        k: dim.k, title: dim.title, intro: dim.intro,
        plus: dim.plus, minus: dim.minus,
        plusLabel: dim.poles[dim.plus].label,
        minusLabel: dim.poles[dim.minus].label,
        pctPlus: pctPlus, pctMinus: 100 - pctPlus,
        plusLead: plusLead,
        lead: lead, leadPct: leadPct, otherPct: 100 - leadPct,
        otherPole: otherPole,
        otherLabel: dim.poles[otherPole].label,
        dist: dist, tier: tier,
        poleData: poleData,
        consist: consist,
        gap: Math.round(gap * 100) / 100
      };
    });

    var code     = dims.slice(0, 4).map(function (d) { return d.lead; }).join('');
    var identity = dims[4].lead;

    var overall = Math.round(avg(dims.map(function (d) { return d.consist; })));
    var grade   = overall >= 80 ? '高' : (overall >= 60 ? '中' : '低');

    var neutral = answers.filter(function (a) { return a === 4; }).length;
    var extreme = answers.filter(function (a) { return a === 1 || a === 7; }).length;

    var crit = dims.filter(function (d) { return d.dist < 6; });

    var neutralRate = Math.round(neutral / Q.length * 100);
    var clarity = Math.round(avg(dims.map(function (d) { return d.dist; })) * 2);

    /* ---------- 信息量闸门 ----------
       平局一律取 plus 极，所以「无差别作答」必然得到一个看似确定的类型。
       这里识别两种零信息作答，让上层不给结论：
         neutral 中立题过多 —— 大量回避表态
         flat    五维全部贴着 50% —— 作答没有形成任何方向性
       （clarity 是五维与 50% 的平均距离 ×2，满格 100，全中线为 0） */
    var lowInfoReason = '';
    if (neutralRate >= 45 && clarity < 25) lowInfoReason = 'neutral';
    else if (clarity < 8) lowInfoReason = 'flat';

    return {
      dims: dims,
      pctMap: {
        EI: dims[0].pctPlus, SN: dims[1].pctPlus,
        TF: dims[2].pctPlus, JP: dims[3].pctPlus, AT: dims[4].pctPlus
      },
      code: code,
      identity: identity,
      fullCode: code + '-' + identity,
      type: TYPE_DATA[code],
      group: TYPE_DATA[code] ? TYPE_DATA[code].group : '',
      consistency: {
        overall: overall, grade: grade, critical: crit,
        perDim: dims.map(function (d) { return { k: d.k, title: d.title, val: d.consist }; })
      },
      neutralRate: neutralRate,
      extremeRate: Math.round(extreme / Q.length * 100),
      clarity: clarity,
      /* 作答是否足以支撑一个类型结论 */
      info: {
        lowInfo: !!lowInfoReason,
        reason: lowInfoReason,
        neutralRate: neutralRate,
        midDims: crit.length,
        clarity: clarity,
        /* 「强行推算」出来但不应展示的类型，仅供折叠区或导出用 */
        forcedCode: code + '-' + identity
      }
    };
  }

  /* ---------------- 规则匹配 ---------------- */
  function matchRules(result, limit) {
    limit = limit || 7;
    var pct = result.pctMap;

    var hits = RULES.filter(function (r) {
      return Object.keys(r.when).every(function (k) {
        var range = r.when[k];
        return pct[k] >= range[0] && pct[k] <= range[1];
      });
    }).map(function (r) {
      var keys = Object.keys(r.when);
      var strength = keys.reduce(function (s, k) {
        return s + Math.abs(pct[k] - 50);
      }, 0);
      return { rule: r, score: keys.length * 100 + strength, conds: keys.length, strength: strength };
    });

    hits.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return b.conds - a.conds;
    });

    /* 每个标签最多取 2 条，保证覆盖面 */
    var picked = [], tagCount = {};
    hits.forEach(function (h) {
      var tag = h.rule.tag;
      tagCount[tag] = tagCount[tag] || 0;
      if (tagCount[tag] >= 2) return;
      if (picked.length >= limit) return;
      tagCount[tag]++;
      picked.push(h.rule);
    });

    return picked;
  }

  /* ---------------- 档案 ---------------- */
  function ageFrom(birth) {
    if (!birth) return null;
    var b = new Date(birth + 'T00:00:00');
    if (isNaN(b.getTime())) return null;
    var now = new Date();
    var age = now.getFullYear() - b.getFullYear();
    var m = now.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
    return (age >= 0 && age < 130) ? age : null;
  }

  function ageBand(age) {
    if (age === null || age === undefined) return null;
    return AGE_BANDS.filter(function (b) { return age <= b.max; })[0] || null;
  }

  function zodiac(birth) {
    if (!birth) return null;
    var parts = String(birth).split('-');
    if (parts.length !== 3) return null;
    var m = parseInt(parts[1], 10), d = parseInt(parts[2], 10);
    if (!m || !d) return null;

    var md = m * 100 + d;
    var starts = [
      [120, '水瓶座'], [219, '双鱼座'], [321, '白羊座'], [420, '金牛座'],
      [521, '双子座'], [622, '巨蟹座'], [723, '狮子座'], [823, '处女座'],
      [923, '天秤座'], [1024, '天蝎座'], [1123, '射手座'], [1222, '摩羯座']
    ];
    var name = '摩羯座';                       // 1/1 – 1/19 属摩羯
    for (var i = 0; i < starts.length; i++) {
      if (md >= starts[i][0]) name = starts[i][1];
    }
    return ZODIAC.filter(function (z) { return z.name === name; })[0] || null;
  }

  return { score: score, matchRules: matchRules, ageFrom: ageFrom, ageBand: ageBand, zodiac: zodiac };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Analyzer;
