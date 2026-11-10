/* =========================================================
   流程控制：档案 → 答题 → 本地生成报告
   ========================================================= */
(function () {
  var TOTAL = window.QUESTIONS.length;
  var KEY = 'mbti-local.v1';

  var scrIntro = document.getElementById('scrIntro');
  var scrProfile = document.getElementById('scrProfile');
  var scrQuiz = document.getElementById('scrQuiz');
  var scrReport = document.getElementById('scrReport');

  var state = {
    answers: new Array(TOTAL).fill(0),
    idx: 0,
    profile: { name: '', birth: '', gender: '' },
    done: false
  };

  /* ---------------- 存储 ---------------- */
  var storeOK = true;
  function save() {
    if (!storeOK) return;
    try {
      localStorage.setItem(KEY, JSON.stringify({
        answers: state.answers, idx: state.idx,
        profile: state.profile, done: state.done, ts: Date.now()
      }));
    } catch (e) { storeOK = false; }
  }
  function load() {
    try {
      var s = localStorage.getItem(KEY);
      return s ? JSON.parse(s) : null;
    } catch (e) { storeOK = false; return null; }
  }

  /* ---------------- 工具 ---------------- */
  function toast(msg) {
    var t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.classList.remove('on'); }, 2400);
  }
  function show(el) {
    [scrIntro, scrProfile, scrQuiz, scrReport].forEach(function (s) { s.classList.remove('on'); });
    el.classList.add('on');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ---------------- 主题 ---------------- */
  (function () {
    var t = 'light';
    try {
      t = localStorage.getItem('mbti-local.theme') ||
        (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    } catch (e) {}
    document.documentElement.setAttribute('data-theme', t);
  })();
  document.getElementById('btnTheme').onclick = function () {
    var cur = document.documentElement.getAttribute('data-theme');
    var nxt = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', nxt);
    try { localStorage.setItem('mbti-local.theme', nxt); } catch (e) {}
  };
  document.getElementById('btnAbout').onclick = function () {
    window.open('guide.html', '_blank');
  };

  /* ---------------- 档案页 ---------------- */
  var fName = document.getElementById('fName');
  var fBirth = document.getElementById('fBirth');
  var fGender = document.getElementById('fGender');
  var derived = document.getElementById('derived');

  (function initBirthMax() {
    var d = new Date();
    fBirth.max = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  })();

  function refreshDerived() {
    var birth = fBirth.value;
    var age = window.Analyzer.ageFrom(birth);
    var z = window.Analyzer.zodiac(birth);
    if (age === null && !z) { derived.style.display = 'none'; return; }
    var parts = [];
    if (age !== null) {
      var band = window.Analyzer.ageBand(age);
      parts.push('<b>' + age + '</b> 岁' + (band ? '（' + band.label + '）' : ''));
    }
    if (z) parts.push('<b>' + z.name + '</b>');
    derived.innerHTML = parts.join(' · ') + ' — 将用于报告的解读校准';
    derived.style.display = 'flex';
  }

  fBirth.onchange = refreshDerived;
  fBirth.oninput = refreshDerived;

  fGender.addEventListener('click', function (e) {
    var b = e.target.closest('.chip');
    if (!b) return;
    Array.prototype.forEach.call(fGender.children, function (c) { c.classList.remove('on'); });
    b.classList.add('on');
  });

  function readProfile() {
    var g = fGender.querySelector('.chip.on');
    return {
      name: (fName.value || '').trim().slice(0, 16),
      birth: fBirth.value || '',
      gender: g ? g.dataset.v : ''
    };
  }

  /* 「开始」只切到档案页，不清任何东西——真正的清空发生在「进入答题」那一下，
     否则用户在档案页按返回，60 题进度就白丢了 */
  document.getElementById('btnStart').onclick = function () {
    scrReport.innerHTML = '';
    show(scrProfile);
  };
  document.getElementById('btnBackIntro').onclick = function () { goHome(); };
  document.getElementById('btnSkipProfile').onclick = function () { goNewQuiz(); };
  document.getElementById('btnGoQuiz').onclick = function () { goNewQuiz(); };
  document.getElementById('btnResume').onclick = function () { enterQuiz('resume'); };
  document.getElementById('btnLastResult').onclick = function () { showReport(); };

  /* 顶栏站名 = 回首页。每次选择都 save() 过，所以离开答题页不会丢进度 */
  (function bindBrand() {
    var brand = document.getElementById('brand');
    if (!brand) return;
    brand.onclick = goHome;
    brand.onkeydown = function (e) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        goHome();
      }
    };
  })();

  function goHome() {
    stopHint();
    refreshIntro();
    show(scrIntro);
  }

  /* 首页按钮的显隐，全部由「已答几题」推出来。
     主按钮文案固定为「开始」——重来是有代价的操作，交给清空前的确认弹窗告知，
     按钮上不再叠一层「重新测试」的措辞 */
  function refreshIntro() {
    var done = state.answers.filter(function (a) { return a > 0; }).length;
    var start = document.getElementById('btnStart');
    var resume = document.getElementById('btnResume');
    var last = document.getElementById('btnLastResult');
    if (!start || !resume || !last) return;

    start.textContent = '开始';
    resume.style.display = (done > 0 && done < TOTAL) ? '' : 'none';
    last.style.display = (done === TOTAL) ? '' : 'none';
    if (done > 0 && done < TOTAL) {
      document.getElementById('resumeN').textContent = done;
    }
  }

  /* 显式意图：new 清空重来，resume 接着答。
     以前靠「第一个未答题」猜，导致「开始」和「继续上次」做的是同一件事 */
  function enterQuiz(mode) {
    if (mode === 'new') {
      state.answers = new Array(TOTAL).fill(0);
      state.idx = 0;
      state.done = false;
    } else {
      var first = state.answers.indexOf(0);
      state.idx = first === -1 ? 0 : first;
    }
    refreshIntro();
    save();
    render();
    show(scrQuiz);
    startHint();
  }

  /* 档案页的「进入答题 / 跳过」：先确认要不要扔掉已有作答 */
  function goNewQuiz() {
    state.profile = readProfile();
    var done = state.answers.filter(function (a) { return a > 0; }).length;
    if (done > 0) {
      var ok = window.confirm(
        '上次已经答了 ' + done + ' 题。\n\n重新开始会清空这些作答，确定吗？\n' +
        '点「取消」可以退回去，改选「继续上次」。'
      );
      if (!ok) return;
    }
    enterQuiz('new');
  }

  /* ---------------- 答题 ---------------- */
  var optsEl = document.getElementById('opts');
  var qCursor = document.createElement('div');
  qCursor.className = 'cursor';
  var TAP_MS = 260, SLIDE_MS = 520, MOVE_PX = 6;
  var touchAt = 0, touchX = 0, sliding = false, pvVal = 0;
  var hintTimers = [], hintDone = false, nextTimer = 0;

  for (var v = 1; v <= 7; v++) {
    (function (val) {
      var b = document.createElement('button');
      b.className = 'opt';
      b.type = 'button';
      b.dataset.v = val;
      b.setAttribute('aria-label', window.SCALE.full[val - 1]);
      b.innerHTML = '<i></i>';
      b.onmouseenter = function () {
        if (optsEl.classList.contains('hinting')) return;
        document.getElementById('scaleNow').textContent = window.SCALE.full[val - 1];
      };
      b.onmouseleave = function () {
        if (!optsEl.classList.contains('hinting')) updateNow();
      };
      b.onclick = function () {
        /* 触屏上 touchend 之后浏览器还会补一次 click，会覆盖刚滑动确认的值 */
        if (Date.now() - touchAt < 500) return;
        choose(val, false);
      };
      optsEl.appendChild(b);
    })(v);
  }
  optsEl.appendChild(qCursor);

  function optList() { return optsEl.querySelectorAll('.opt'); }

  function hitAt(x) {
    /* 取最近的那个圆点中心，不靠容器宽度均分——PC 上宽屏时圆点被拉开，均分会算错 */
    var list = optList();
    var best = 1, bestD = Infinity;
    for (var i = 0; i < list.length; i++) {
      var r = list[i].getBoundingClientRect();
      var d = Math.abs(x - (r.left + r.width / 2));
      if (d < bestD) { bestD = d; best = i + 1; }
    }
    return best;
  }

  function showPv(v) {
    Array.prototype.forEach.call(optList(), function (b, i) {
      b.classList.toggle('pv', i + 1 === v);
    });
    document.getElementById('scaleNow').textContent = '当前程度 · ' + window.SCALE.full[v - 1];
  }

  function clearPv() {
    Array.prototype.forEach.call(optList(), function (b) { b.classList.remove('pv'); });
    pvVal = 0;
  }

  optsEl.addEventListener('touchstart', function (e) {
    stopHint();
    var t = e.touches[0];
    if (!t) return;
    touchX = t.clientX;
    sliding = false;
    pvVal = hitAt(t.clientX);
    if (pvVal) showPv(pvVal);
  }, { passive: true });

  optsEl.addEventListener('touchmove', function (e) {
    var t = e.touches[0];
    if (!t) return;
    if (!sliding) {
      if (Math.abs(t.clientX - touchX) < MOVE_PX) return;
      sliding = true;
    }
    var v = hitAt(t.clientX);
    if (v !== pvVal) { pvVal = v; showPv(v); }
  }, { passive: true });

  optsEl.addEventListener('touchend', function () {
    var v = pvVal;
    touchAt = Date.now();
    clearPv();
    if (v) choose(v, sliding);
    sliding = false;
  });

  optsEl.addEventListener('touchcancel', function () {
    clearPv();
    sliding = false;
  });

  function choose(val, isSlide) {
    stopHint();
    clearTimeout(nextTimer);
    state.answers[state.idx] = val;
    paintOpts();
    save();
    updateProgress();
    updateNow();
    if (state.idx < TOTAL - 1) {
      /* 必须同时锁定题号：用户可能在 260ms 内自己点了「下一题」，
         下一题若选了同一个值，旧定时器会把 idx 再推一格，顶到 60 就越界 */
      var at = state.idx;
      nextTimer = setTimeout(function () {
        if (state.idx === at && state.answers[at] === val) { state.idx++; render(); }
      }, isSlide ? SLIDE_MS : TAP_MS);
    }
  }

  function paintOpts() {
    Array.prototype.forEach.call(optList(), function (b, i) {
      b.classList.toggle('sel', state.answers[state.idx] === i + 1);
    });
  }
  function updateNow() {
    var a = state.answers[state.idx];
    document.getElementById('scaleNow').textContent = a ? '当前选择：' + window.SCALE.full[a - 1] : '\u00a0';
  }
  function updateProgress() {
    var done = state.answers.filter(function (a) { return a > 0; }).length;
    document.getElementById('qDone').textContent = '已答 ' + done;
    document.getElementById('pFill').style.width = (done / TOTAL * 100) + '%';
    document.getElementById('qNum').textContent = state.idx + 1;
  }

  /* ---------------- 首题提示动画 ---------------- */
  function hintPos(v) { return ((v - 0.5) / 7 * 100) + '%'; }

  function stopHint() {
    if (hintTimers.length) {
      hintTimers.forEach(function (t) { clearTimeout(t); });
      hintTimers = [];
    }
    if (optsEl.classList.contains('hinting')) {
      optsEl.classList.remove('hinting');
      clearPv();
      updateNow();
    }
  }

  function startHint() {
    if (hintDone || state.idx !== 0) return;
    if (!state.answers.every(function (a) { return a === 0; })) return;
    hintDone = true;

    var touchOnly = window.matchMedia('(hover: none)').matches;
    var sn = document.getElementById('scaleNow');
    var at = function (ms, fn) { hintTimers.push(setTimeout(fn, ms)); };

    qCursor.style.left = hintPos(3);
    optsEl.classList.add('hinting');
    sn.textContent = touchOnly ? '按住圆点左右滑，也能改程度' : '点一下，或按 1–7 键';

    at(760, function () { showPv(3); });
    at(1440, function () { qCursor.style.left = hintPos(4); showPv(4); });
    at(1840, function () { qCursor.style.left = hintPos(5); showPv(5); });
    at(2240, function () { qCursor.style.left = hintPos(6); showPv(6); });
    at(2800, function () {
      optsEl.classList.remove('hinting');
      clearPv();
      updateNow();
    });
  }

  function render() {
    /* 兜底：任何路径把 idx 推出去都先拉回来，否则这里会抛异常，页面就卡死不动了 */
    if (typeof state.idx !== 'number' || isNaN(state.idx)) state.idx = 0;
    if (state.idx < 0) state.idx = 0;
    if (state.idx > TOTAL - 1) state.idx = TOTAL - 1;

    document.getElementById('qText').textContent = window.QUESTIONS[state.idx].t;
    paintOpts();
    updateProgress();
    updateNow();
    document.getElementById('btnPrev').disabled = state.idx === 0;
    var bn = document.getElementById('btnNext');
    var isLast = state.idx === TOTAL - 1;
    bn.textContent = isLast ? '生成报告' : '下一题 →';
    /* 前 59 题选完会自动翻页，这颗按钮正常路径点不到，降级为幽灵按钮；
       只有最后一题是必经操作，才给主按钮的强调色 */
    bn.className = isLast ? 'btn sm' : 'btn ghost sm';
    scrQuiz.style.animation = 'none';
    void scrQuiz.offsetWidth;
    scrQuiz.style.animation = 'fade .32s cubic-bezier(.2,.7,.3,1)';
  }

  document.getElementById('btnPrev').onclick = function () {
    stopHint();
    if (state.idx > 0) { state.idx--; render(); }
  };
  document.getElementById('btnNext').onclick = function () {
    stopHint();
    if (state.idx > TOTAL - 1) state.idx = TOTAL - 1;
    if (!state.answers[state.idx]) {
      optsEl.classList.add('shake');
      setTimeout(function () { optsEl.classList.remove('shake'); }, 450);
      var sn = document.getElementById('scaleNow');
      sn.textContent = '先选一个程度，再继续';
      sn.style.color = '#c8564a';
      setTimeout(function () { sn.style.color = ''; updateNow(); }, 1500);
      /* 光把那一行小字染红，视线在底部按钮上时基本看不见，再加一条浮层提示 */
      toast('第 ' + (state.idx + 1) + ' 题还没选程度');
      return;
    }
    if (state.idx < TOTAL - 1) { state.idx++; render(); }
    else { finish(); }
  };

  document.addEventListener('keydown', function (e) {
    if (!scrQuiz.classList.contains('on')) return;
    if (e.key >= '1' && e.key <= '7') { choose(parseInt(e.key, 10)); }
    else if (e.key === 'ArrowLeft') { document.getElementById('btnPrev').click(); }
    else if (e.key === 'ArrowRight' || e.key === 'Enter') { document.getElementById('btnNext').click(); }
  });

  /* ---------------- 生成报告 ---------------- */
  function buildProfile() {
    var p = state.profile;
    var age = window.Analyzer.ageFrom(p.birth);
    var labelMap = { male: '男', female: '女', other: '其他' };
    return {
      name: p.name,
      birth: p.birth,
      gender: p.gender,
      genderLabel: labelMap[p.gender] || '',
      age: age,
      ageBand: window.Analyzer.ageBand(age),
      genderNote: window.GENDER_NOTES[p.gender] || '',
      zodiac: window.Analyzer.zodiac(p.birth)
    };
  }

  function finish() { showReport(); }

  /* 从手机端接力进来时的横幅。打印时隐藏（no-print），
     否则这一块会出现在 PDF 第一页顶上 */
  function relayBanner() {
    return '<div class="relay no-print">' +
      '<div class="relay-main">' +
      '<div class="relay-h"><span class="relay-tag">接力</span>这 60 题是在手机里答的，答案已还原</div>' +
      '<p class="relay-p">不用重答。这份报告和你手机上看到的完全一致，现在是可打印的完整版——' +
      '在打印对话框里选「另存为 PDF」即可。</p>' +
      '</div>' +
      '<div class="relay-act">' +
      '<button class="btn sm" id="btnRelayPrint">打印 / 存为 PDF</button>' +
      '<span class="relay-kbd">或 Ctrl / ⌘ + P</span>' +
      '</div>' +
      '</div>';
  }

  /* 生成并展示报告。首页的「查看上次结果」也走这里，不再靠刷新自动跳转 */
  function showReport(fromShare) {
    var blank = state.answers.indexOf(0);
    if (blank !== -1) {
      state.idx = blank;
      render();
      show(scrQuiz);
      toast('还有题目没作答，已跳到第 ' + (blank + 1) + ' 题');
      return;
    }

    var result = window.Analyzer.score(state.answers);
    var profile = buildProfile();

    scrReport.innerHTML = (fromShare ? relayBanner() : '') +
      window.Report.render(result, profile, state.answers);
    bindReport(result, profile);

    if (fromShare) {
      var rp = document.getElementById('btnRelayPrint');
      if (rp) rp.onclick = function () { window.print(); };
    }

    state.done = true;
    save();
    refreshIntro();
    show(scrReport);
  }

  function bindReport(result, profile) {
    /* ---- AI 解读包 ---- */
    var packBtn = document.getElementById('btnAIPack');
    if (packBtn) packBtn.onclick = function () {
      if (!window.AIExport) { toast('导出模块未加载'); return; }
      var md = window.AIExport.buildFull(result, profile, state.answers);
      downloadText('MBTI-AI解读包-' + result.fullCode + '-' + fileStamp() + '.md', md, 'text/markdown;charset=utf-8');
      toast('已下载 AI 解读包，拖进任意 AI 对话框即可');
    };

    var packCopy = document.getElementById('btnAICopy');
    if (packCopy) packCopy.onclick = function () {
      if (!window.AIExport) { toast('导出模块未加载'); return; }
      copyText(window.AIExport.buildFull(result, profile, state.answers), '完整解读包已复制，直接粘贴发送');
    };

    var packLite = document.getElementById('btnAICopyLite');
    if (packLite) packLite.onclick = function () {
      if (!window.AIExport) { toast('导出模块未加载'); return; }
      copyText(window.AIExport.buildLite(result, profile, state.answers), '精简版已复制');
    };

    var dl = document.getElementById('btnDownload');
    if (dl) dl.onclick = function () { download(result, profile); };

    var pr = document.getElementById('btnPrint');
    if (pr) pr.onclick = function () { window.print(); };

    var rv = document.getElementById('btnReview');
    if (rv) rv.onclick = function () {
      state.idx = 0;
      render();
      show(scrQuiz);
    };

    var rs = document.getElementById('btnRestart');
    if (rs) rs.onclick = function () {
      if (!confirm('重新测试会清空当前的答案和档案，确定吗？')) return;
      state.answers = new Array(TOTAL).fill(0);
      state.idx = 0;
      state.done = false;
      state.profile = { name: '', birth: '', gender: '' };
      try { localStorage.removeItem(KEY); } catch (e) {}
      fName.value = ''; fBirth.value = ''; derived.style.display = 'none';
      Array.prototype.forEach.call(fGender.children, function (c) {
        c.classList.toggle('on', c.dataset.v === '');
      });
      scrReport.innerHTML = '';
      refreshIntro();
      show(scrIntro);
    };
  }

  function legacyCopy(text, okMsg) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    toast(ok ? okMsg : '复制失败，请改用「下载 AI 解读包」');
  }

  function copyText(text, okMsg) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        toast(okMsg);
      }).catch(function () { legacyCopy(text, okMsg); });
    } else {
      legacyCopy(text, okMsg);
    }
  }

  function fileStamp() {
    var d = new Date();
    return d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') +
      '-' + String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0');
  }

  /* BOM 让 Windows 记事本 / Word 也能正确识别中文 */
  function saveText(filename, text, mime, bom) {
    var blob = new Blob([(bom ? '\ufeff' : '') + text], { type: mime || 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  function downloadText(filename, text, mime) { saveText(filename, text, mime, true); }

  function download(result, profile) {
    var payload = {
      instrument: '60 人格倾向评估（自编中文题，结构参考 16Personalities / MBTI Step I）',
      version: '2.0-local',
      engine: '浏览器本地计算，无网络请求',
      completedAt: new Date().toISOString(),
      profile: {
        name: profile.name, birth: profile.birth, gender: profile.gender,
        age: profile.age, ageBand: profile.ageBand ? profile.ageBand.label : null
      },
      result: {
        code: result.code,
        identity: result.identity,
        fullCode: result.fullCode,
        typeName: result.type.name,
        group: result.type.group,
        consistency: result.consistency.overall,
        consistencyGrade: result.consistency.grade,
        neutralRate: result.neutralRate,
        extremeRate: result.extremeRate,
        dimensions: result.dims.map(function (d) {
          return {
            key: d.k, title: d.title,
            plus: d.plus, minus: d.minus,
            plusPercent: d.pctPlus, minusPercent: d.pctMinus,
            dominant: d.lead, leadPercent: d.leadPct,
            strength: d.tier.key, consistency: d.consist
          };
        }),
        insights: window.Analyzer.matchRules(result, 7).map(function (r) {
          return { tag: r.tag, title: r.title, body: r.body };
        })
      },
      answers: window.QUESTIONS.map(function (q, i) {
        return { no: i + 1, dimension: q.d, pole: q.p, statement: q.t, value: state.answers[i] };
      })
    };

    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'MBTI-' + result.fullCode + '-' + fileStamp() + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    toast('已下载完整数据');
  }

  /* ---------------- 从链接接力 ---------------- */
  /* 链接形如 60.2x.work/#r=<70 位>。# 之后的内容浏览器不发给
     服务器，所以计算仍然全部在本机，隐私承诺不用改口。 */
  function takeShareLink() {
    var h = '';
    try { h = (location.hash || '').replace(/^#/, ''); } catch (e) { return false; }

    var m = /(?:^|&)r=([0-9a-z]+)/i.exec(h);
    if (!m || !window.ShareCode) return false;

    var got = window.ShareCode.decode(m[1]);
    if (!got.ok) {
      /* 版本不符 = 旧题库的链接。必须说清楚，不能装作没事按新题重算 */
      toast(got.reason === 'version'
        ? '这个链接来自旧版题目，请在小程序里重新导出'
        : '链接不完整，已按普通模式打开');
      return false;
    }

    state.answers = got.answers;
    state.idx = 0;
    state.done = true;
    state.profile = got.profile;

    fName.value = '';
    fBirth.value = got.profile.birth;
    Array.prototype.forEach.call(fGender.children, function (c) {
      c.classList.toggle('on', c.dataset.v === (got.profile.gender || ''));
    });
    refreshDerived();

    showReport(true);
    return true;
  }

  /* ---------------- 恢复草稿 ---------------- */
  /* 刷新后一律停在首页，不再自动跳报告：顶栏能回首页之后，
     自动跳转会让用户觉得「回不去」。报告改为按需渲染 */
  function restore() {
    var s = load();
    if (!s) { refreshIntro(); return; }

    if (s.profile) {
      state.profile = { name: s.profile.name || '', birth: s.profile.birth || '', gender: s.profile.gender || '' };
      fName.value = state.profile.name;
      fBirth.value = state.profile.birth;
      Array.prototype.forEach.call(fGender.children, function (c) {
        c.classList.toggle('on', c.dataset.v === state.profile.gender);
      });
      refreshDerived();
    }

    if (Array.isArray(s.answers) && s.answers.length === TOTAL) {
      state.answers = s.answers;
      state.idx = s.idx || 0;
    }

    var done = state.answers.filter(function (a) { return a > 0; }).length;
    if (done === TOTAL) {
      state.idx = 0;
      state.done = true;
    }

    refreshIntro();
  }

  /* 链接优先于本地草稿：用户是主动点进来的，以链接里的作答为准 */
  if (!takeShareLink()) restore();
})();
