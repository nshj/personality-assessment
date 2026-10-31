/* =========================================================
   报告渲染：把 Analyzer 的结果拼成一份完整的本地报告
   全部在本机完成，无任何网络请求
   ========================================================= */
window.Report = (function () {

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function tierText(dim) {
    return dim.tier.text
      .replace('{pole}', dim.poleData.label)
      .replace('{other}', dim.otherLabel)
      .replace('{pct}', dim.leadPct)
      .replace('{opct}', dim.otherPct)
      .replace('{title}', dim.title);
  }

  function secHead(num, title, sub) {
    return '<div class="sec-h"><span class="num">' + num + '</span><h2>' + title + '</h2>' +
      (sub ? '<span class="sub">' + sub + '</span>' : '') + '</div>';
  }

  function kvList(items, bullet) {
    return '<div class="kv">' + items.map(function (t, i) {
      return '<div class="kv-item"><span class="dot">' + (bullet || (i + 1)) + '</span><span>' + t + '</span></div>';
    }).join('') + '</div>';
  }

  /* ---------------- 各区块 ---------------- */
  function hero(result, profile) {
    var t = result.type;
    var gi = window.GROUP_INFO[t.group];
    var meta = [];
    var d = new Date();
    meta.push(d.getFullYear() + ' 年 ' + (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日');
    if (profile.name) meta.push(esc(profile.name));
    if (profile.age !== null && profile.age !== undefined) meta.push(profile.age + ' 岁');
    if (profile.genderLabel) meta.push(profile.genderLabel);

    return '<div class="rhero">' +
      '<div class="rlabel">你的倾向类型</div>' +
      '<div class="rcode">' + result.code + '<small>-' + result.identity + '</small></div>' +
      '<div class="rname">' + esc(t.name) + '</div>' +
      '<div class="rtag">' + esc(gi.name) + ' ' + t.group + ' · ' + esc(t.tag) + '</div>' +
      '<div class="rmeta">' + meta.map(function (m) { return '<span>' + m + '</span>'; }).join('') + '</div>' +
      '</div>';
  }

  function dimBars(result) {
    var rows = result.dims.map(function (d) {
      var plusOn = d.plusLead;
      var style = plusOn ? 'width:' + d.pctPlus + '%' : 'width:' + d.pctMinus + '%;margin-left:auto';
      return '<div class="dim">' +
        '<div class="dim-head">' +
          '<span class="pole ' + (plusOn ? 'on' : '') + '">' + d.plusLabel + '<b>' + d.plus + '</b><em>' + d.pctPlus + '%</em></span>' +
          '<span class="pole ' + (plusOn ? '' : 'on') + '">' + d.minusLabel + '<b>' + d.minus + '</b><em>' + d.pctMinus + '%</em></span>' +
        '</div>' +
        '<div class="track"><div class="fill" style="' + style + '"></div></div>' +
        '<div class="dim-foot"><span class="tier">' + d.tier.key + '</span>' + d.title + '</div>' +
        '</div>';
    }).join('');

    return '<div class="sec">' + secHead('01', '五个维度', '条长 = 主导侧比例') +
      '<div class="dims">' + rows + '</div></div>';
  }

  function confidence(result, profile) {
    var c = result.consistency;
    var cls = c.grade === '高' ? 'g-ok' : (c.grade === '中' ? 'g-mid' : 'g-low');
    var notes = [];

    if (c.grade === '低') {
      var bad = c.perDim.filter(function (p) { return p.val < 60; })
        .map(function (p) { return p.title; });
      notes.push('<b>这份作答的一致性偏低（' + c.overall + '）。</b>' +
        (bad.length ? '主要出现在「' + bad.join('、') + '」——同一维度里正问和反问的题目，你的选择方向不太吻合。' : '') +
        '常见原因有两个：答得比较快、或者在这几维上你确实两种状态都有。建议隔一天重测一次，只对比这几维。');
    } else if (c.grade === '中') {
      notes.push('<b>一致性中等（' + c.overall + '）。</b>整体可信，但个别维度可能受当时状态影响。若某个维度正好落在 45%–55%，可以只把它当作参考。');
    } else {
      notes.push('<b>一致性高（' + c.overall + '）。</b>正问与反问的题目指向一致，说明你作答时标准稳定，这份结果值得按字面读。');
    }

    if (result.neutralRate >= 28) {
      notes.push('<b>中间选项占了 ' + result.neutralRate + '%。</b>选「中立」太多会让维度分数被拉平，类型特征的辨识度下降。如果重测，试着在每道题上都往一侧偏一点。');
    }

    if (c.critical.length) {
      var names = c.critical.map(function (d) { return d.title + '（' + d.leadPct + '%）'; }).join('、');
      notes.push('<b>' + names + ' 处在临界区间。</b>这些维度的字母换一天可能就变，别把它们当成固定标签——这正是 MBTI 最常被误用的地方。');
    }

    if (result.extremeRate >= 60) {
      notes.push('<b>你有 ' + result.extremeRate + '% 的题目选了最两端的选项。</b>作答风格偏极端，这会让雷达图拉得很满；如果重测，可以留意自己是否把「稍微」也选成了「非常」。');
    }

    return '<div class="sec">' + secHead('02', '这份结果可信吗', '正问与反问的一致性检验') +
      '<div class="conf">' +
        '<div class="conf-cell"><div class="k">作答一致性</div><div class="v ' + cls + '">' + c.overall + '<small>/100 · ' + c.grade + '</small></div></div>' +
        '<div class="conf-cell"><div class="k">中间选项比例</div><div class="v">' + result.neutralRate + '<small>%</small></div></div>' +
        '<div class="conf-cell"><div class="k">两端极端作答</div><div class="v">' + result.extremeRate + '<small>%</small></div></div>' +
      '</div>' +
      '<div class="block">' +
        notes.map(function (n) { return '<p style="margin-bottom:10px">' + n + '</p>'; }).join('') +
        '<p style="font-size:12px;color:var(--muted);margin-top:6px;line-height:1.8">检验方法：每个维度有 6 道正问题与 6 道反问题。若两组指向同一侧，说明作答自洽；若两组相互矛盾，说明该维度的分数不可靠。</p>' +
      '</div></div>';
  }

  function typeCore(result) {
    var t = result.type;
    var stack = t.stack.split('·').map(function (s) { return s.trim(); });
    var fnHtml = stack.map(function (code, i) {
      var label = window.FUNCS[code] || '';
      var role = ['主导功能', '辅助功能', '第三功能', '劣势功能'][i] || '';
      return '<div class="fn ' + (i === 0 ? 'dom' : '') + '">' +
        '<div class="f1">' + code + '</div>' +
        '<div class="f2">' + label + '</div>' +
        '<div class="f3">' + role + '</div></div>';
    }).join('');

    return '<div class="sec">' + secHead('03', '这一型是怎么运作的', t.group + ' · 功能栈') +
      '<div class="block"><p>' + esc(t.core) + '</p>' +
      '<div class="stack">' + fnHtml + '</div>' +
      '<p style="margin-top:14px;font-size:12.5px;color:var(--muted);line-height:1.8">功能栈读法：' +
      '<b>' + stack[0] + '</b> 是你的默认发动机，' +
      '<b>' + stack[1] + '</b> 是它的副手，' +
      '<b>' + stack[3] + '</b> 是最不熟练、压力大时最容易失守的那一环。</p>' +
      '</div></div>';
  }

  function strengthsCosts(result) {
    var t = result.type;
    return '<div class="sec">' + secHead('04', '优势与代价', '同一枚硬币的两面') +
      '<div class="two">' +
        '<div class="block" style="margin:0"><h3>你天然擅长的</h3>' + kvList(t.strengths.map(esc)) + '</div>' +
        '<div class="block" style="margin:0"><h3>这枚硬币的背面</h3>' + kvList(t.costs.map(esc)) + '</div>' +
      '</div>' +
      '<p style="margin-top:12px;font-size:12.5px;color:var(--muted)">上面两栏不是优缺点，是同一种倾向在不同场景下的收益与成本。</p>' +
      '</div>';
  }

  function dimDetail(result) {
    var blocks = result.dims.map(function (d) {
      var p = d.poleData;
      return '<div class="block">' +
        '<h3>' + d.title + ' · 你偏' + p.label + ' <span style="font-family:var(--serif);color:var(--a1)">' + d.lead + '</span>' +
        ' <span style="font-weight:400;font-size:12.5px;color:var(--muted)">' + d.leadPct + '% · ' + d.tier.key + '</span></h3>' +
        '<p style="margin-bottom:4px">' + esc(tierText(d)) + '</p>' +
        '<p style="margin:12px 0 0">' + esc(p.def) + '</p>' +
        kvList(p.hi.map(esc)) +
        '<p style="margin-top:13px;font-size:12.5px;color:var(--muted);border-left:2px solid var(--line);padding-left:11px;line-height:1.8">常见的误读：' + esc(p.misread) + '</p>' +
        '</div>';
    }).join('');

    return '<div class="sec">' + secHead('05', '逐维细读', '五段，按你的实际比例写') + blocks + '</div>';
  }

  function insights(result) {
    var rules = window.Analyzer.matchRules(result, 7);
    var cards = [];

    if (result.clarity < 12) {
      cards.push({ tag: '读法', title: '你几乎在每一维的中间',
        body: '五个维度的主导侧都在 56% 以内，这是一份典型的「中间型」答卷。它不代表你没有特点，而是说明单靠字母来概括你，会丢掉大部分信息。' +
              '对你来说，逐个看维度百分比、以及具体场景下的行为，比认领一个类型有用得多。如果别的测试给过你更明确的四个字母，也不必觉得矛盾——那是题目和切分点不同造成的。' });
    }

    rules.forEach(function (r) { cards.push(r); });

    if (!cards.length) {
      cards.push({ tag: '读法', title: '没有命中强组合',
        body: '你的倾向分散在几种不同的组合上，没有形成典型的叠加模式。这通常意味着你在不同场景里会切换策略，而不是固定用一套。' +
              '可以重点看第 05 节：那里是按你的实际比例写的，比类型标签更贴近你自己。' });
    }

    var html = cards.map(function (r, i) {
      return '<div class="ins">' +
        '<div class="ins-h"><span class="n">' + String(i + 1).padStart(2, '0') + '</span>' +
        '<h3>' + esc(r.title) + '</h3><span class="tag">' + esc(r.tag) + '</span></div>' +
        '<p>' + esc(r.body) + '</p></div>';
    }).join('');

    return '<div class="sec">' + secHead('06', '针对你的判断', '组合命中 ' + rules.length + ' 条') +
      '<div class="insights">' + html + '</div></div>';
  }

  function scenes(result) {
    var t = result.type;
    return '<div class="sec">' + secHead('07', '工作 · 关系 · 压力', '') +
      '<div class="block"><h3>在工作里</h3><p>' + esc(t.work) + '</p></div>' +
      '<div class="block"><h3>在关系里</h3><p>' + esc(t.relation) + '</p></div>' +
      '<div class="block"><h3>压力下的你</h3><p>' + esc(t.stress) + '</p></div>' +
      '</div>';
  }

  function growth(result, profile) {
    var t = result.type;
    var extra = '';
    if (profile.ageBand) {
      extra += '<div class="block" style="margin-top:12px"><h3>按你的年龄看（' + esc(profile.ageBand.label) + '）</h3><p>' + esc(profile.ageBand.text) + '</p></div>';
    }
    if (profile.genderNote) {
      extra += '<div class="block" style="margin-top:12px"><h3>一条自评校准</h3><p>' + esc(profile.genderNote) + '</p></div>';
    }
    return '<div class="sec">' + secHead('08', '可以试试的三件事', '具体到行为，不写空话') +
      '<div class="block">' + kvList(t.growth.map(esc)) + '</div>' + extra + '</div>';
  }

  function zodiacSection(profile) {
    if (!profile.zodiac) {
      return '<div class="sec">' + secHead('09', '星座对照', '非分析结论') +
        '<p style="font-size:13px">你这次没有填生日，所以这里空着。</p>' +
        '<p class="warn">这一段本来就不参与任何字母的计算——占星与人格类型之间没有可靠的统计关联，' +
        '之所以留着，只是因为很多人喜欢拿它对照着玩。想让这里出现，下次测试时在档案页填上生日即可；' +
        '不填也完全不影响上面任何结论。</p>' +
        '</div>';
    }
    var z = profile.zodiac;
    return '<div class="sec">' + secHead('09', '星座对照', '非分析结论') +
      '<div class="zod">' +
      '<div class="zod-h"><span class="zn">' + esc(z.name) + '</span>' +
      '<span class="pill-list" style="margin:0">' + z.tags.map(function (x) { return '<span class="pill">' + esc(x) + '</span>'; }).join('') + '</span></div>' +
      '<p style="font-size:13px">' + esc(z.line) + '</p>' +
      '<p class="warn">这一段不属于分析结果。占星与人格类型之间没有可靠的统计关联，它也没有参与任何一个字母的计算。' +
      '之所以保留，只是因为你在档案里填了生日，以及很多人喜欢拿它对照着玩——请当成文化符号，不要当成结论。</p>' +
      '</div></div>';
  }

  function aiPack() {
    return '<div class="aipack no-print">' +
      '<div class="aipack-top"><span class="aipack-badge">推荐</span>' +
      '<span class="aipack-kicker">不需要再回来问我，让 AI 自己读数据</span></div>' +
      '<h3>AI 解读包</h3>' +
      '<p>下载那份 <b>.md</b>，拖进任意 AI 助手的对话框——ChatGPT、Claude、豆包、Kimi、元宝、DeepSeek 都行。' +
      '文件里已经写好了角色指令、计分公式、60 题原始作答、逐题贡献值和矛盾诊断，' +
      '对方<b>不需要任何额外背景</b>：它会先拿你的原始答案复算一遍，再开始分析。</p>' +
      '<div class="aipack-spec">' +
        '<span><b>约 16 KB</b> 完整版</span>' +
        '<span><b>6 步</b> 固定执行顺序</span>' +
        '<span><b>可复算</b> 每题贡献值</span>' +
        '<span><b>已标注</b> 矛盾与临界维度</span>' +
      '</div>' +
      '<div class="actions" style="margin-top:16px">' +
        '<button class="btn sm" id="btnAIPack">下载 AI 解读包（.md）</button>' +
        '<button class="btn ghost sm" id="btnAICopy">复制全文</button>' +
        '<button class="btn ghost sm" id="btnAICopyLite">复制精简版</button>' +
      '</div>' +
      '<p class="aipack-foot">精简版约 900 字，用于只能粘贴文本、或对话框有长度限制的场合：保留了五维数据、逐题贡献、满格题和矛盾点，只省掉 60 条题干。</p>' +
      '</div>';
  }

  function exportSection(result, answers, profile, opts) {
    opts = opts || {};
    var rows = window.QUESTIONS.map(function (q, i) {
      return '<div class="srow"><span class="si">' + String(i + 1).padStart(2, '0') + '</span>' +
        '<span>' + esc(q.t) + '</span>' +
        '<span class="sv">' + (answers[i] ? window.SCALE.short[answers[i] - 1] : '未答') + '</span></div>';
    }).join('');

    return '<div class="sec">' + secHead(opts.num || '10', opts.title || '导出 · 交给 AI 深度解读', opts.sub || '文件自带指令与数据') +
      (opts.withAI === false ? '' : aiPack()) +
      '<div class="export no-print" style="margin-top:14px">' +
      '<div class="exp-h">其他保存方式</div>' +
      '<p style="font-size:12.5px;margin-top:4px">JSON：给程序读的全量数据，含 60 题原始作答与五维百分比。PDF：给人读的完整报告，适合存档或转发。</p>' +
      '<div class="actions" style="margin-top:12px">' +
      '<button class="btn ghost sm" id="btnDownload">下载完整数据（JSON）</button>' +
      '<button class="btn ghost sm" id="btnPrint">打印 / 存为 PDF</button>' +
      '</div></div>' +
      '<details class="sheet no-print" style="margin-top:12px"><summary>查看 60 道题的作答明细</summary>' +
      '<div class="sheetbody">' + rows + '</div></details>' +
      '<div class="actions no-print" style="margin-top:18px;justify-content:center">' +
      '<button class="btn ghost sm" id="btnReview">回看并修改答案</button>' +
      '<button class="btn ghost sm" id="btnRestart">重新测试</button>' +
      '</div>' +
      '</div>';
  }

  /* ---------------- 信息量不足时的报告 ---------------- */
  function lowInfoHero(result, profile) {
    var meta = [];
    var d = new Date();
    meta.push(d.getFullYear() + ' 年 ' + (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日');
    if (profile.name) meta.push(esc(profile.name));
    if (profile.age !== null && profile.age !== undefined) meta.push(profile.age + ' 岁');
    if (profile.genderLabel) meta.push(profile.genderLabel);

    return '<div class="rhero">' +
      '<div class="rlabel">这一轮的结论</div>' +
      '<div class="rcode rcode-none">—</div>' +
      '<div class="rname">无法定位类型</div>' +
      '<div class="rtag">这次作答没有形成足够的区分度</div>' +
      '<div class="rmeta">' + meta.map(function (m) { return '<span>' + m + '</span>'; }).join('') + '</div>' +
      '</div>';
  }

  function lowInfoExplain(result) {
    var i = result.info;
    var why;

    if (i.reason === 'neutral') {
      why = '60 道题里有 <b>' + i.neutralRate + '%</b> 选了正中间的「中立」。' +
        '中立本身不是错，但选得太多，五个维度都会被拉回 50% 附近——' +
        '这时字母是计算时的默认值，不是你的倾向。';
    } else {
      why = '五个维度全部落在 46%–54% 之间，平均只偏离中线 ' +
        Math.round(i.clarity / 2) + ' 个百分点。' +
        '这种分布下，字母取哪一边取决于平局规则：换一份同样认真的作答，结果就可能翻面。';
    }

    return '<div class="sec">' + secHead('02', '为什么这次不给类型', '宁可说没有，也不猜一个') +
      '<div class="block"><p style="font-size:13.5px">' + why + '</p>' +
      '<p style="font-size:13px;margin-top:10px">' +
      '按二分法，四个字母是在 50% 处切开的。切点附近本来就没有稳定答案——' +
      '与其给你一个看起来很确定、实际上随手就会变的标签，不如直接说：这一轮的信息不够。' +
      '</p>' +
      '<p class="warn" style="margin-top:12px">想让下一次有区分度，注意两点：' +
      '<b>每道题都往稍偏的一侧选</b>，哪怕只有一点；' +
      '<b>别把「中立」当安全选项</b>——它确实表示两种状态都成立，但量表会把它算作零信息。' +
      '60 道题里留个七八道中立是合理的，超过一半就说明这套题问不出你的倾向。</p>' +
      '</div>' +
      '<details class="sheet no-print" style="margin-top:12px"><summary>仍要看看当前作答会归到哪一型（仅供参考）</summary>' +
      '<div class="sheetbody"><p style="font-size:12.5px">按现有数据强行归类的结果是 <b>' +
      i.forcedCode + '</b>。它只说明「如果必须在两两之间做选择，算术会怎么选」，' +
      '不说明你是这一型——上面那两段解释才是重点。</p></div></details>' +
      '</div>';
  }

  /** 隐藏某些节后，把 01、02、03… 按实际出现顺序重排，避免编号断裂 */
  function renumber(html) {
    var n = 0;
    return html.replace(/(<span class="num">)\d{2}(<\/span>)/g, function (m, a, b) {
      n++;
      return a + (n < 10 ? '0' + n : String(n)) + b;
    });
  }

  function footer() {
    return '<div class="foot">' +
      '本问卷为自编中文题目，维度结构参考公开的 16Personalities（NERIS Type Explorer®，60 题 / 7 级量表）与 MBTI® Step I（93 题）框架。<br>' +
      '与 The Myers-Briggs Company 无关联，不构成心理诊断，也不可用于招聘、筛选或任何对他人不利的决策。<br>' +
      '全部计算在你的浏览器内完成，没有任何数据被发送到网络。' +
      '</div>';
  }

  /* ---------------- 主入口 ---------------- */
  function render(result, profile, answers) {
    var p = profile || {};
    var low = result.info && result.info.lowInfo;

    var html = low
      ? lowInfoHero(result, p) +
        dimBars(result) +
        lowInfoExplain(result) +
        zodiacSection(p) +
        exportSection(result, answers, p, { withAI: false, title: '保存 · 作答明细', sub: '这一轮没有类型可导出' }) +
        footer()
      : hero(result, p) +
        dimBars(result) +
        confidence(result, p) +
        typeCore(result) +
        strengthsCosts(result) +
        dimDetail(result) +
        insights(result) +
        scenes(result) +
        growth(result, p) +
        zodiacSection(p) +
        exportSection(result, answers, p) +
        footer();

    return renumber(html);
  }

  return { render: render };
})();
