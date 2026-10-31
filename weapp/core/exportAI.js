/* =========================================================
   AI 解读包导出
   ---------------------------------------------------------
   生成一份自包含的 Markdown 文件，可以直接拖进任意 AI 助手
   做深度解读。文件本身包含：
     · 解读指令（角色、约束、六步执行顺序、输出格式）
     · 计分公式（AI 可据此从原始作答独立复算）
     · 结果（五维百分比 + 一致性）
     · 60 题原始作答（含逐题贡献值）
     · 矛盾诊断（正反向打架的维度、满格题、证据索引）
   不依赖本项目的其它文件，也不依赖任何对话上下文。
   ========================================================= */
var AIExport = (function () {
  var CJS  = (typeof module !== 'undefined' && module.exports);
  var Q          = CJS ? require('./questions.js').QUESTIONS : window.QUESTIONS;
  var DIMS       = CJS ? require('./dims.js').DIM_DATA       : window.DIM_DATA;
  var GROUP_INFO = CJS ? require('./types.js').GROUP_INFO    : window.GROUP_INFO;
  var AnalyzerR  = CJS ? require('./analyzer.js')            : window.Analyzer;
  var LABEL = ['非常不同意', '不同意', '有点不同意', '中立', '有点同意', '同意', '非常同意'];

  function avg(a) {
    return a.length ? a.reduce(function (x, y) { return x + y; }, 0) / a.length : 0;
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function sgn(n) {
    var r = Math.round(n * 100) / 100;
    return (r > 0 ? '+' : '') + r;
  }
  function dimOf(k) {
    for (var i = 0; i < DIMS.length; i++) if (DIMS[i].k === k) return DIMS[i];
    return null;
  }
  /* ---------- 逐题归一化 ---------- */
  function buildRows(answers) {
    return Q.map(function (q, i) {
      var dim = dimOf(q.d);
      var v = answers[i] || 0;
      var raw = v ? v - 4 : 0;
      return {
        no: i + 1, k: q.d, pole: q.p, v: v, text: q.t,
        /* lean > 0 表示指向该维度的「正极」 */
        lean: v ? ((q.p === dim.plus) ? raw : -raw) : 0
      };
    });
  }

  /* ---------- 逐维诊断 ---------- */
  function buildDiag(result, rows) {
    return result.dims.map(function (d) {
      var dim = dimOf(d.k);
      var plusRows = rows.filter(function (r) { return r.k === d.k && r.pole === dim.plus; });
      var minusRows = rows.filter(function (r) { return r.k === d.k && r.pole === dim.minus; });

      var mp = avg(plusRows.map(function (r) { return r.lean; }));
      var mm = avg(minusRows.map(function (r) { return r.lean; }));
      var gap = Math.abs(mp - mm);
      /* 两组方向相反且都有一定强度 → 该维内部打架 */
      var conflict = (mp > 0.4 && mm < -0.4) || (mp < -0.4 && mm > 0.4);

      var mine = rows.filter(function (r) { return r.k === d.k; });
      var sorted = mine.slice().sort(function (a, b) { return Math.abs(b.lean) - Math.abs(a.lean); });

      var toPlus = mine.filter(function (r) { return r.lean > 0; })
        .sort(function (a, b) { return b.lean - a.lean; })[0];
      var toMinus = mine.filter(function (r) { return r.lean < 0; })
        .sort(function (a, b) { return a.lean - b.lean; })[0];

      return {
        k: d.k, title: d.title, plus: dim.plus, minus: dim.minus,
        plusLabel: dim.poles[dim.plus].label, minusLabel: dim.poles[dim.minus].label,
        mp: mp, mm: mm, gap: gap, conflict: conflict,
        consist: d.consist, top: sorted.slice(0, 3),
        toPlus: toPlus, toMinus: toMinus, rows: mine
      };
    });
  }

  /* ---------- 档案行 ---------- */
  function profileLines(profile) {
    var out = [];
    var who = [];
    if (profile.name) who.push(profile.name);
    if (profile.genderLabel) who.push(profile.genderLabel);
    if (profile.age !== null && profile.age !== undefined) {
      who.push(profile.age + ' 岁' + (profile.ageBand ? '（' + profile.ageBand.label + '）' : ''));
    }
    out.push('- **作答者**：' + (who.length ? who.join(' · ') : '（未填写，视作匿名）'));
    if (profile.birth) out.push('- **出生日期**：' + profile.birth + '（只用于算年龄；如需匿名，删掉这一行即可，不影响任何计算）');
    return out;
  }

  function stamp() {
    var d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) +
      ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  /* =========================================================
     完整版
     ========================================================= */
  function buildFull(result, profile, answers) {
    var rows = buildRows(answers);
    var diag = buildDiag(result, rows);
    var t = result.type;
    var c = result.consistency;
    var avgDist = Math.round(avg(result.dims.map(function (d) { return d.dist; })));
    var L = [];

    /* ---- 抬头 ---- */
    L.push('# MBTI 深度解读请求包 · 自包含数据');
    L.push('');
    L.push('> **这份文件是写给 AI 的，不是给人读的。**');
    L.push('> 直接把它拖进对话窗口，或全选复制后粘贴发送（ChatGPT / Claude / 豆包 / Kimi / 元宝 / DeepSeek 都可以），');
    L.push('> 不需要再补充任何说明。文件里已经包含解读指令、计分公式、60 题原始作答、结果和矛盾诊断，');
    L.push('> AI 可以先独立复算一遍，再开始分析。');
    L.push('');
    L.push('- **生成时间**：' + stamp());
    L.push('- **工具**：MBTI 人格倾向评估 · 本地分析版（自编中文题，结构参考 16Personalities 60 题 / 7 级量表，与 MBTI® Step I 的四维二分框架）');
    L.push('- **题目结构**：60 题 · 5 维度 · 每维 12 题（正反向各 6 题）');
    profileLines(profile).forEach(function (s) { L.push(s); });
    L.push('- **结果**：`' + result.fullCode + '`（' + t.name + ' · ' + (GROUP_INFO[t.group] ? GROUP_INFO[t.group].name : '') + ' ' + t.group + '）');
    L.push('- **作答一致性**：' + c.overall + ' / 100（' + c.grade + '）');
    L.push('');
    L.push('---');
    L.push('');

    /* ---- 一、指令 ---- */
    L.push('# 一、给 AI 的指令');
    L.push('');
    L.push('你现在扮演一位人格测评解读顾问。下面是一个真实的人完成 60 题自评问卷后的全部数据。');
    L.push('');
    L.push('请做一份**证据驱动的深度解读**。判断依据只能来自这份文件里的数据；不要用「某某类型通常……」来代替对数据的阅读。');
    L.push('');
    L.push('## 你必须遵守的 6 条');
    L.push('');
    L.push('1. **百分比优先于字母。** 四个字母只是把连续得分在 50% 处切开的结果，真正的信息在百分比和强度等级里。52% 的 J 和 88% 的 J 不是同一件事。');
    L.push('2. **每条判断都要挂题号。** 形式如 `（#14 #23）`。找不到题号支撑的判断，就不要写。这一条最重要——它是把「解读」和「套模板」区分开的唯一标准。');
    L.push('3. **不要复述类型百科。**「' + t.name + '富有理想主义、擅长洞察他人」这类通用描述，全篇最多出现一句，并且必须紧接着转入这个人的具体数据。');
    L.push('4. **区分三种语气。** 数据直接支持的写「数据显示」；从数据外推的写「我推测」；数据不足的写「这份问卷看不出」。不要把三者混成同一种确定口吻。');
    L.push('5. **必须处理矛盾。** 附录 B 标出了同一维度内正问题与反问题方向打架的地方。这些位置的信息量通常比一致的地方更大，不能跳过。');
    L.push('6. **守住边界。** 不做任何临床诊断，不评价这个人好不好，不替他做职业、感情、医疗方面的决定。建议可以给，但写成「可以试试」，不要写成「你应该」。');
    L.push('');
    L.push('## 执行顺序');
    L.push('');
    L.push('**第 0 步 · 复算校验（不要跳过）**');
    L.push('');
    L.push('按第二节的公式，用附录 A 的 60 条原始作答重算五个维度，再和第三节给出的结果对照。');
    L.push('');
    L.push('- 一致：写一句「复算一致」，进入下一步。');
    L.push('- 不一致：**先指出差异**（哪个维度、差几个百分点），说明你以哪一份为准，再继续。');
    L.push('');
    L.push('这一步不是练算术，而是证明你确实读了这 60 条数据。跳过它直接开始分析，后面的内容基本可以当作编的。');
    L.push('');
    L.push('**第 1 步 · 题目级证据**');
    L.push('');
    L.push('看附录 A 里贡献值为 +3 / −3 的题（选得最满格的那些），以及附录 B 列出的各维最偏离中立的题。逐条说明：这道题在问什么、这个选择意味着什么、它和同维度的其他题是否一致。');
    L.push('');
    L.push('这是整篇解读的地基。**不要用维度分数替代它。**');
    L.push('');
    L.push('**第 2 步 · 维度级判断**');
    L.push('');
    L.push('五个维度各写一段，结构固定：');
    L.push('');
    L.push('- 一句话结论：偏哪一侧、偏多少、这个强度意味着什么；');
    L.push('- 两个以上支撑题号，说明它们共同指向的**行为**——不要写「你比较内向」，要写「连续社交后你需要独处回血，所以连开三天会时你更可能在第二天沉默」；');
    L.push('- **可翻转警告**：主导侧低于 56% 的维度，必须明确写出「这个字母不稳，换一段时间可能翻转」；');
    L.push('- 这一维在你整体里起什么作用：独立成立，还是被别的维度带出来的。');
    L.push('');
    L.push('**第 3 步 · 组合读法（2–4 条）**');
    L.push('');
    L.push('每条必须是**至少两个维度叠加**才成立的判断。单维度就能推出的结论不算，放回第 2 步。');
    L.push('');
    L.push('要写清楚叠加逻辑：为什么 A 和 B 同时成立时，会产生一个「A 单独成立 + B 单独成立」推不出的结果。');
    L.push('');
    L.push('**第 4 步 · 场景落地（工作 / 关系 / 压力）**');
    L.push('');
    L.push('每个 100–150 字。要求出现**具体的、能认出来的处境**，例如「会上有人临时改方案」「伴侣连续三天情绪低落」。');
    L.push('');
    L.push('反例：「你适合需要独立思考的工作」——这是类型描述，不是分析。');
    L.push('');
    L.push('**第 5 步 · 反例与盲区（最重要的一节）**');
    L.push('');
    L.push('列出 2–3 种**这份结果会不成立的情境**：');
    L.push('');
    L.push('- 在什么环境压力下，你会表现出相反的一极；');
    L.push('- 哪几个维度的得分更可能是当前处境造成的，而不是天性；');
    L.push('- 如果重测，哪几个维度最可能变化。');
    L.push('');
    L.push('这一节写不出来，说明前面的分析过于自信。');
    L.push('');
    L.push('**第 6 步 · 三条建议**');
    L.push('');
    L.push('具体到行为，每条一句话就能开始做。');
    L.push('');
    L.push('反例：「多和人交流」「学会放松」「发挥你的优势」。');
    L.push('正例：「把每周的会议集中到两天，其余三天不排任何需要即时反应的日程」。');
    L.push('');
    L.push('## 输出格式');
    L.push('');
    L.push('- 中文，Markdown，二级标题与上面六步一一对应。');
    L.push('- 总长 1200–1800 字。宁可短而实，不要长而空。');
    L.push('- 不使用表情符号，不使用「亲爱的」「朋友」这类称呼。');
    L.push('- 最后一行固定为：`本解读基于自评问卷数据，不构成心理诊断。`');
    L.push('');
    L.push('---');
    L.push('');

    /* ---- 二、计分规则 ---- */
    L.push('# 二、计分规则（可独立复算）');
    L.push('');
    L.push('**量表**：1 非常不同意 · 2 不同意 · 3 有点不同意 · 4 中立 · 5 有点同意 · 6 同意 · 7 非常同意');
    L.push('');
    L.push('**五个维度与两个极**：');
    L.push('');
    L.push('| 维度 | 代码 | 正极 + | 负极 − |');
    L.push('|---|---|---|---|');
    DIMS.forEach(function (d) {
      L.push('| ' + d.title + ' | ' + d.k + ' | ' + d.plus + ' ' + d.poles[d.plus].label + ' | ' + d.minus + ' ' + d.poles[d.minus].label + ' |');
    });
    L.push('');
    L.push('> 第五维 AT 的说明：' + DIMS[4].intro);
    L.push('');
    L.push('**逐题计算**：');
    L.push('');
    L.push('```');
    L.push('raw  = 作答值 − 4                       // 范围 −3 … +3');
    L.push('lean = (题干指向的是正极) ? raw : −raw     // 正值 = 偏向正极');
    L.push('```');
    L.push('');
    L.push('举例：第 06 题属于 SN，题干指向 S（负极）。作答 2 → raw = −2 → lean = +2。');
    L.push('意思是：**不同意一句「实感」的陈述，等于偏向直觉。** 60 题里有 30 题是这种反向计分。');
    L.push('');
    L.push('**逐维汇总**：');
    L.push('');
    L.push('```');
    L.push('sum        = 该维度 12 题的 lean 之和         // 范围 −36 … +36');
    L.push('pctPlus    = round(50 + 50 × sum / 36)');
    L.push('主导极      = sum ≥ 0 ? 正极 : 负极');
    L.push('主导百分比   = 主导极为正极 ? pctPlus : 100 − pctPlus');
    L.push('```');
    L.push('');
    L.push('**一致性（可信度）**：每维 12 题中 6 题指向正极、6 题指向负极。分别求两组 lean 的均值 `mean+`、`mean−`：');
    L.push('');
    L.push('```');
    L.push('gap      = |mean+ − mean−|');
    L.push('该维一致性 = round(clamp(100 × (1 − gap / 4), 0, 100))');
    L.push('总体一致性 = 五个维度一致性的平均值');
    L.push('```');
    L.push('');
    L.push('gap 越小，说明答正问题和答反问题时用的是同一套标准；gap 越大，说明自相矛盾。');
    L.push('');
    L.push('> 做第 0 步校验时，只需把附录 A 每题最后一列的「贡献」按维度求和，代入上面的公式即可。');
    L.push('');
    L.push('---');
    L.push('');

    /* ---- 三、结果 ---- */
    L.push('# 三、结果');
    L.push('');
    L.push('**类型**：`' + result.fullCode + '`　' + t.name +
      (GROUP_INFO[t.group] ? '（' + GROUP_INFO[t.group].name + ' ' + t.group + '）' : ''));
    L.push('');
    L.push('**功能栈**：' + t.stack + '　（供参考。如果功能栈和下面的维度强度矛盾，以数据为准，并明确指出矛盾在哪。）');
    L.push('');
    L.push('| 维度 | 正极 | 负极 | 主导 | 主导占比 | 强度 | 该维一致性 |');
    L.push('|---|---|---|---|---|---|---|');
    result.dims.forEach(function (d) {
      L.push('| ' + d.title + ' ' + d.k + ' | ' + d.pctPlus + '% ' + d.plus + ' | ' + d.pctMinus + '% ' + d.minus +
        ' | **' + d.lead + '** ' + d.poleData.label + ' | ' + d.leadPct + '% | ' + d.tier.key + ' | ' + d.consist + ' |');
    });
    L.push('');
    L.push('**其他指标**');
    L.push('');
    L.push('- 作答一致性：**' + c.overall + ' / 100**（' + c.grade + '）　逐维：' +
      c.perDim.map(function (p) { return p.title + ' ' + p.val; }).join(' · '));
    L.push('- 中间选项（选「中立」）比例：' + result.neutralRate + '%');
    L.push('- 两端极端作答（选 1 或 7）比例：' + result.extremeRate + '%');
    L.push('- 五维平均偏离中立：' + avgDist + ' 个百分点（数值越大，倾向越明确）');
    L.push('');

    if (c.critical.length) {
      L.push('**临界维度（主导侧不足 56%，字母可能翻转）**：' +
        c.critical.map(function (d) { return d.title + ' ' + d.k + '（' + d.leadPct + '%，' + d.lead + '）'; }).join('、'));
    } else {
      L.push('**临界维度**：无。五个维度都离开了 50% 的中间带。');
    }
    L.push('');
    L.push('---');
    L.push('');

    /* ---- 四、附录 A ---- */
    L.push('# 附录 A · 60 题原始作答');
    L.push('');
    L.push('「贡献」= 该题对你正极倾向的推动量，正值偏向正极、负值偏向负极、0 表示中立或刚好抵消。');
    L.push('');
    L.push('| 题号 | 维 | 指向 | 作答 | 贡献 | 陈述 |');
    L.push('|---|---|---|---|---|---|');
    rows.forEach(function (r) {
      var label = r.v ? r.v + ' ' + LABEL[r.v - 1] : '未答';
      L.push('| ' + pad2(r.no) + ' | ' + r.k + ' | ' + r.pole + ' | ' + label + ' | ' + sgn(r.lean) + ' | ' + r.text + ' |');
    });
    L.push('');
    L.push('---');
    L.push('');

    /* ---- 五、附录 B ---- */
    L.push('# 附录 B · 矛盾诊断');
    L.push('');
    L.push('## B1 · 每个维度的内部方向一致性');
    L.push('');
    L.push('同一维度里，指向正极的 6 题与指向负极的 6 题，如果都被「同意」，方向必然相反——那就是自相矛盾。');
    L.push('');
    diag.forEach(function (g) {
      var oppSign = (g.mp * g.mm) < 0;
      var verdict;
      if (g.conflict) verdict = '**方向矛盾** — 两组指向相反且都够强，这一维的分数不可全信';
      else if (oppSign) verdict = '两组方向轻微相反，但幅度很小 — 这一维你两边都成立';
      else if (g.gap >= 1.5) verdict = '方向一致，但强度落差较大';
      else verdict = '方向一致';
      L.push('- **' + g.title + ' ' + g.k + '**：指向 ' + g.plus + ' 的 6 题均值 ' + sgn(g.mp) +
        '，指向 ' + g.minus + ' 的 6 题均值 ' + sgn(g.mm) +
        '，差值 ' + (Math.round(g.gap * 100) / 100) + ' → ' + verdict + '（一致性 ' + g.consist + '）');
      if (g.conflict && g.toPlus && g.toMinus) {
        L.push('  - 打架的一对：# ' + pad2(g.toPlus.no) + ' 你答 ' + g.toPlus.v + '（' + g.toPlus.pole + ' 向，' + sgn(g.toPlus.lean) + '），' +
          '# ' + pad2(g.toMinus.no) + ' 你答 ' + g.toMinus.v + '（' + g.toMinus.pole + ' 向，' + sgn(g.toMinus.lean) + '）');
      }
    });

    var anyConflict = diag.some(function (g) { return g.conflict; });
    if (!anyConflict) {
      L.push('');
      L.push('> 五个维度全部方向一致，没有任何一组正反向打架。这本身就是一条信息：作答标准稳定，' +
        '第三节的百分比可以按字面读，不必额外打折。不要在解读里凭空虚构出「你可能在自相矛盾」。');
    }
    L.push('');

    var extremes = rows.filter(function (r) { return Math.abs(r.lean) === 3; });
    L.push('## B2 · 满格作答（|贡献| = 3）');
    L.push('');
    if (extremes.length) {
      L.push('共 ' + extremes.length + ' 题。这些是最不该被忽略的数据点，优先用它们立论。');
      L.push('');
      extremes.forEach(function (r) {
        L.push('- #' + pad2(r.no) + ' ' + r.k + ' 指向 ' + r.pole + '，答 ' + r.v + '（' + LABEL[r.v - 1] + '，' + sgn(r.lean) + '）：' + r.text);
      });
    } else {
      L.push('没有满格作答。没有任何一题选到最两端——维度分数会被压缩，判断时要相应下调把握度。');
    }
    L.push('');

    L.push('## B3 · 各维最偏离中立的 3 题（证据索引）');
    L.push('');
    diag.forEach(function (g) {
      L.push('- **' + g.title + ' ' + g.k + '**：' + g.top.map(function (r) {
        return '#' + pad2(r.no) + '（' + sgn(r.lean) + '）';
      }).join(' · '));
    });
    L.push('');
    L.push('---');
    L.push('');

    /* ---- 六、附录 C ---- */
    var rules = AnalyzerR.matchRules(result, 7);
    L.push('# 附录 C · 本地规则引擎已给出的方向');
    L.push('');
    L.push('下面这些是这个人的本地报告里已经出现过的判断标题。你可以延伸、反驳或补充证据，但**不要换个说法重复**——重复的内容对他没有价值。');
    L.push('');
    if (rules.length) {
      rules.forEach(function (r) { L.push('- ［' + r.tag + '］' + r.title); });
    } else {
      L.push('- （无规则命中）');
    }
    L.push('');
    L.push('---');
    L.push('');

    /* ---- 七、边界 ---- */
    L.push('# 附：边界与免责');
    L.push('');
    L.push('- 这是一份**自评问卷**，测的是你此刻如何描述自己，不是临床量表，不能用于诊断任何心理疾病。');
    L.push('- 也不能用于招聘、筛选、绩效评估或任何影响他人权益的决策。');
    L.push('- MBTI 类量表的重测稳定性有限，接近 50% 的维度在不同时间会翻转。请把结果当成一张**当前状态的照片**，而不是身份证。');
    L.push('- 全部计算在这一份文件里可以复现，不存在任何隐藏数据；本文件不含网络回传，也不含除上表之外的个人信息。');
    L.push('');

    return L.join('\n');
  }

  /* =========================================================
     精简版（适合只能粘贴文本、或有长度限制的场景）
     ========================================================= */
  function buildLite(result, profile, answers) {
    var rows = buildRows(answers);
    var diag = buildDiag(result, rows);
    var t = result.type;
    var c = result.consistency;
    var L = [];

    L.push('MBTI 60 题自测的完整作答数据，请据此做深度人格解读。');
    L.push('');

    var who = [];
    if (profile.genderLabel) who.push(profile.genderLabel);
    if (profile.age !== null && profile.age !== undefined) who.push(profile.age + ' 岁');
    if (who.length) L.push('【身份】' + who.join(' · '));
    L.push('【结果】' + result.fullCode + '　' + t.name +
      '　一致性 ' + c.overall + '/100（' + c.grade + '）　中立率 ' + result.neutralRate + '%　极端作答 ' + result.extremeRate + '%');
    L.push('');

    L.push('【五维】格式：维度 正极% / 负极% → 主导侧（强度，该维一致性）');
    result.dims.forEach(function (d) {
      var flag = d.dist < 6 ? ' ⚠临界，可能翻转' : '';
      L.push('- ' + d.title + ' ' + d.k + '：' + d.plus + ' ' + d.pctPlus + ' / ' + d.minus + ' ' + d.pctMinus +
        ' → ' + d.lead + ' ' + d.poleData.label + '（' + d.tier.key + '，一致性 ' + d.consist + '）' + flag);
    });
    L.push('');

    L.push('【逐题贡献】按题号顺序；值 = 作答值−4，题干指向负极的已取反，正值＝偏向正极。每维 12 个数。');
    diag.forEach(function (g) {
      L.push(g.k + ': ' + g.rows.map(function (r) { return sgn(r.lean); }).join(' '));
    });
    L.push('');

    var extremes = rows.filter(function (r) { return Math.abs(r.lean) === 3; });
    L.push('【满格作答】' + (extremes.length ? '共 ' + extremes.length + ' 题' : '无'));
    extremes.forEach(function (r) {
      L.push('- #' + pad2(r.no) + ' ' + r.k + ' 指向 ' + r.pole + ' 答 ' + r.v + '（' + sgn(r.lean) + '）：' + r.text);
    });
    L.push('');

    var bad = diag.filter(function (g) { return g.conflict; });
    L.push('【方向矛盾】' + (bad.length ? '' : '无，五维内部方向一致'));
    bad.forEach(function (g) {
      L.push('- ' + g.title + ' ' + g.k + '：指向 ' + g.plus + ' 的题均值 ' + sgn(g.mp) + '，指向 ' + g.minus +
        ' 的题均值 ' + sgn(g.mm) + ' → 两组打架，这一维分数不可全信');
    });
    L.push('');

    L.push('【要求】');
    L.push('1. 先复算：按上面的逐题贡献求和，pctPlus = round(50 + 50×sum/36)，核对【五维】里的百分比，若有差异先指出来。');
    L.push('2. 每条判断后面挂题号，如（#14 #23）；没有题号支撑的判断不要写。');
    L.push('3. 不要复述 MBTI 类型百科，多说这个人的具体行为模式。');
    var crit = result.dims.filter(function (d) { return d.dist < 6; });
    L.push('4. ' + ((bad.length || crit.length)
      ? '必须处理上面标注的矛盾维度与临界维度，不能装作没看见。'
      : '本次没有矛盾维度，也没有临界维度（五维都在 56% 以外且方向一致）——请在结论里明确说明这份作答很自洽，不要凭空制造矛盾。'));
    L.push('5. 结构：3 句结论 → 五维逐一判断（带证据）→ 维度组合读法 → 工作/关系/压力 → 这份结果在什么情况下不成立 → 三条可执行建议。');
    L.push('6. 中文，1200 字以内，不用表情符号。最后一行：本解读基于自评问卷数据，不构成心理诊断。');

    return L.join('\n');
  }

  return { buildFull: buildFull, buildLite: buildLite };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = AIExport;
