/* =========================================================
   报告数据化：把 Analyzer 的结果整理成 WXML 能直接渲染的结构
   ---------------------------------------------------------
   网页版是把结果拼成 HTML；小程序没有 innerHTML，所以这里
   输出纯数据 + 预拼好的文案，逻辑与 web/assets/report.js 对齐。
   ========================================================= */
const Analyzer = require('../core/analyzer.js');
const Q = require('../core/questions.js');
const Types = require('../core/types.js');

function pad2(n) { return (n < 10 ? '0' : '') + n; }

function dateStr() {
  const d = new Date();
  return d.getFullYear() + ' 年 ' + (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日';
}

function tierText(d) {
  return d.tier.text
    .replace('{pole}', d.poleData.label)
    .replace('{other}', d.otherLabel)
    .replace('{pct}', d.leadPct)
    .replace('{opct}', d.otherPct)
    .replace('{title}', d.title);
}

/* ---------------- 开头 ---------------- */
function buildHero(result, profile) {
  const t = result.type;
  const gi = Types.GROUP_INFO[t.group] || { name: '' };

  const meta = [dateStr()];
  if (profile.name) meta.push(profile.name);
  if (profile.age !== null && profile.age !== undefined) meta.push(profile.age + ' 岁');
  if (profile.genderLabel) meta.push(profile.genderLabel);

  return {
    code: result.code,
    identity: result.identity,
    fullCode: result.fullCode,
    name: t.name,
    groupName: gi.name,
    group: t.group,
    tag: t.tag,
    meta: meta
  };
}

/* ---------------- 五维条 ---------------- */
function buildDims(result) {
  return result.dims.map(function (d) {
    return {
      k: d.k,
      title: d.title,
      plus: d.plus,
      plusLabel: d.plusLabel,
      pctPlus: d.pctPlus,
      minus: d.minus,
      minusLabel: d.minusLabel,
      pctMinus: d.pctMinus,
      plusLead: d.plusLead,
      lead: d.lead,
      leadPct: d.leadPct,
      otherPct: d.otherPct,
      tierKey: d.tier.key,
      barRight: !d.plusLead
    };
  });
}

/* ---------------- 可信度 ---------------- */
function buildConf(result) {
  const c = result.consistency;
  const gradeClass = c.grade === '高' ? 'g-ok' : (c.grade === '中' ? 'g-mid' : 'g-low');
  const notes = [];

  if (c.grade === '低') {
    const bad = c.perDim.filter(function (p) { return p.val < 60; })
      .map(function (p) { return p.title; });
    notes.push({
      h: '这份作答的一致性偏低（' + c.overall + '）。',
      b: (bad.length ? '主要出现在「' + bad.join('、') + '」——同一维度里正问和反问的题目，你的选择方向不太吻合。' : '') +
        '常见原因有两个：答得比较快、或者在这几维上你确实两种状态都有。建议隔一天重测一次，只对比这几维。'
    });
  } else if (c.grade === '中') {
    notes.push({
      h: '一致性中等（' + c.overall + '）。',
      b: '整体可信，但个别维度可能受当时状态影响。若某个维度正好落在 45%–55%，可以只把它当作参考。'
    });
  } else {
    notes.push({
      h: '一致性高（' + c.overall + '）。',
      b: '正问与反问的题目指向一致，说明你作答时标准稳定，这份结果值得按字面读。'
    });
  }

  if (result.neutralRate >= 28) {
    notes.push({
      h: '中间选项占了 ' + result.neutralRate + '%。',
      b: '选「中立」太多会让维度分数被拉平，类型特征的辨识度下降。如果重测，试着在每道题上都往一侧偏一点。'
    });
  }

  if (c.critical.length) {
    const names = c.critical.map(function (d) { return d.title + '（' + d.leadPct + '%）'; }).join('、');
    notes.push({
      h: names + ' 处在临界区间。',
      b: '这些维度的字母换一天可能就变，别把它们当成固定标签——这正是 MBTI 最常被误用的地方。'
    });
  }

  if (result.extremeRate >= 60) {
    notes.push({
      h: '你有 ' + result.extremeRate + '% 的题目选了最两端的选项。',
      b: '作答风格偏极端，这会让雷达图拉得很满；如果重测，可以留意自己是否把「稍微」也选成了「非常」。'
    });
  }

  return {
    overall: c.overall,
    grade: c.grade,
    gradeClass: gradeClass,
    neutralRate: result.neutralRate,
    extremeRate: result.extremeRate,
    notes: notes
  };
}

/* ---------------- 功能栈 ---------------- */
function buildStack(result) {
  const t = result.type;
  const Roles = ['主导功能', '辅助功能', '第三功能', '劣势功能'];
  const codes = t.stack.split('·').map(function (s) { return s.trim(); });
  const FUNCS = require('../core/dims.js').FUNCS;

  return {
    core: t.core,
    fns: codes.map(function (code, i) {
      return {
        code: code,
        label: FUNCS[code] || '',
        role: Roles[i] || '',
        dom: i === 0
      };
    }),
    hint: '功能栈读法：' + codes[0] + ' 是你的默认发动机，' + codes[1] + ' 是它的副手，' +
      codes[3] + ' 是最不熟练、压力大时最容易失守的那一环。'
  };
}

/* ---------------- 逐维细读 ---------------- */
function buildDimDetail(result) {
  return result.dims.map(function (d) {
    const p = d.poleData;
    return {
      title: d.title,
      lead: d.lead,
      leadPct: d.leadPct,
      tierKey: d.tier.key,
      para: tierText(d),
      def: p.def,
      hi: p.hi,
      misread: p.misread
    };
  });
}

/* ---------------- 洞察 ---------------- */
function buildInsights(result) {
  const rules = Analyzer.matchRules(result, 7);
  const cards = [];

  if (result.clarity < 12) {
    cards.push({
      tag: '读法',
      title: '你几乎在每一维的中间',
      body: '五个维度的主导侧都在 56% 以内，这是一份典型的「中间型」答卷。它不代表你没有特点，而是说明单靠字母来概括你，会丢掉大部分信息。' +
        '对你来说，逐个看维度百分比、以及具体场景下的行为，比认领一个类型有用得多。如果别的测试给过你更明确的四个字母，也不必觉得矛盾——那是题目和切分点不同造成的。'
    });
  }

  rules.forEach(function (r) { cards.push({ tag: r.tag, title: r.title, body: r.body }); });

  if (!cards.length) {
    cards.push({
      tag: '读法',
      title: '没有命中强组合',
      body: '你的倾向分散在几种不同的组合上，没有形成典型的叠加模式。这通常意味着你在不同场景里会切换策略，而不是固定用一套。' +
        '可以重点看「逐维细读」那一节：那里是按你的实际比例写的，比类型标签更贴近你自己。'
    });
  }

  return {
    count: rules.length,
    items: cards.map(function (c, i) {
      return { n: String(i + 1).padStart(2, '0'), tag: c.tag, title: c.title, body: c.body };
    })
  };
}

/* ---------------- 明细 ---------------- */
function buildQuestions(answers) {
  return Q.QUESTIONS.map(function (q, i) {
    const v = answers[i];
    return {
      no: pad2(i + 1),
      text: q.t,
      answer: v ? Q.SCALE.short[v - 1] : '未答'
    };
  });
}

/* ---------------- 主入口 ---------------- */
function build(result, profile, answers) {
  const t = result.type;
  const li = result.info || { lowInfo: false };
  const low = !!li.lowInfo;

  const zodiac = profile.zodiac
    ? { has: true, name: profile.zodiac.name, tags: profile.zodiac.tags, line: profile.zodiac.line }
    : { has: false };

  /* 信息量不足时，不给类型，改给一段解释 */
  let lowView = null;
  if (low) {
    const why = li.reason === 'neutral'
      ? '60 道题里有 ' + li.neutralRate + '% 选了正中间的「中立」。中立本身不是错，但选得太多，' +
        '五个维度都会被拉回 50% 附近——这时字母是计算时的默认值，不是你的倾向。'
      : '五个维度全部落在 46%–54% 之间，平均只偏离中线 ' + Math.round(li.clarity / 2) + ' 个百分点。' +
        '这种分布下，字母取哪一边取决于平局规则，换一份同样认真的作答结果就可能翻面。';

    lowView = {
      title: '无法定位类型',
      tag: '这次作答没有形成足够的区分度',
      why: why,
      explain: '按二分法，四个字母是在 50% 处切开的。切点附近本来就没有稳定答案——' +
        '与其给你一个看起来很确定、实际上随手就会变的标签，不如直接说：这一轮的信息不够。',
      tip: '想让下一次有区分度，注意两点：每道题都往稍偏的一侧选，哪怕只有一点；' +
        '别把「中立」当安全选项——它确实表示两种状态都成立，但量表会把它算作零信息。' +
        '60 道题里留个七八道中立是合理的，超过一半就说明这套题问不出你的倾向。',
      forced: '按现有数据强行归类的结果是 ' + li.forcedCode +
        '。它只说明「如果必须在两两之间做选择，算术会怎么选」，不说明你是这一型。'
    };
  }

  /* 动态节号：低信息量时会隐藏 03–08，编号必须跟着重排，否则出现 02 直接跳 09 */
  let seq = 0;
  const no = {};
  const nx = function () { seq++; return pad2(seq); };
  no.dims = nx();
  no.conf = nx();
  if (!low) { no.stack = nx(); no.sc = nx(); no.dd = nx(); no.ins = nx(); no.scenes = nx(); no.growth = nx(); }
  else { no.explain = nx(); }
  no.zod = nx();
  no.qs = nx();

  return {
    lowInfo: low,
    lowView: lowView,
    no: no,
    hero: buildHero(result, profile),
    dims: buildDims(result),
    conf: buildConf(result),
    stack: buildStack(result),
    strengths: t.strengths,
    costs: t.costs,
    dimDetail: buildDimDetail(result),
    insights: buildInsights(result),
    scenes: { work: t.work, relation: t.relation, stress: t.stress },
    growth: {
      items: t.growth,
      ageBand: profile.ageBand ? { label: profile.ageBand.label, text: profile.ageBand.text } : null,
      genderNote: profile.genderNote || ''
    },
    zodiac: zodiac,
    questions: buildQuestions(answers)
  };
}

module.exports = { build: build, tierText: tierText };
