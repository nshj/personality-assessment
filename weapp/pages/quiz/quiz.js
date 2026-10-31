const app = getApp();
const Q = require('../../core/questions.js');

const TOTAL = Q.QUESTIONS.length;
const TAP_MS = 260;     /* 点选后停留，翻页 */
const SLIDE_MS = 520;   /* 滑动确认后多留一点，让人看清落点 */
const MOVE_PX = 6;      /* 位移小于这个值算点击，反之算滑动 */

Page({
  data: {
    total: TOTAL,
    idx: 0,
    text: '',
    sel: 0,
    pv: 0,
    done: 0,
    pct: 0,
    nowLabel: '',
    nextLabel: '下一题',
    isLast: false,
    shaking: false,
    hintOn: false,
    fingerLeft: 0,
    levels: [{ v: 1 }, { v: 2 }, { v: 3 }, { v: 4 }, { v: 5 }, { v: 6 }, { v: 7 }]
  },

  onLoad() {
    const g = app.globalData;
    if (typeof g.idx !== 'number' || g.idx < 0) g.idx = 0;
    this.render();
    const self = this;
    setTimeout(function () { self.maybeHint(); }, 420);
  },

  onReady() {
    this.measure();
  },

  onShow() {
    if (!this._rect) this.measure();
  },

  onHide() {
    this.stopHint();
  },

  onUnload() {
    clearTimeout(this._t);
    this.stopHint();
  },

  /* ---------- 刻度几何 ---------- */

  measure() {
    const self = this;
    wx.createSelectorQuery()
      .in(this)
      .select('.opts')
      .boundingClientRect(function (rect) {
        if (rect && rect.width) self._rect = rect;
      })
      .exec();
  },

  /* 屏幕坐标 → 1..7 */
  hit(x) {
    const r = this._rect;
    if (!r || !r.width) return 0;
    let i = Math.floor((x - r.left) / (r.width / 7));
    if (i < 0) i = 0;
    if (i > 6) i = 6;
    return i + 1;
  },

  pos(v) {
    return (v - 0.5) / 7 * 100;
  },

  /* ---------- 渲染 ---------- */

  render() {
    const g = app.globalData;
    /* 兜底：题号越界会让 QUESTIONS[i] 直接取到 undefined，整页卡死 */
    if (typeof g.idx !== 'number' || isNaN(g.idx) || g.idx < 0) g.idx = 0;
    if (g.idx > TOTAL - 1) g.idx = TOTAL - 1;
    const i = g.idx;
    const done = g.answers.filter(function (a) { return a > 0; }).length;
    const cur = g.answers[i];

    this.setData({
      idx: i,
      text: Q.QUESTIONS[i].t,
      sel: cur || 0,
      pv: 0,
      done: done,
      pct: Math.round(done / TOTAL * 100),
      nowLabel: cur ? '当前选择：' + Q.SCALE.full[cur - 1] : '',
      nextLabel: i === TOTAL - 1 ? '生成报告' : '下一题',
      isLast: i === TOTAL - 1,
      shaking: false
    }, () => {
      if (!this._rect) this.measure();
    });

    this._pv = 0;
    wx.setNavigationBarTitle({ title: (i + 1) + ' / ' + TOTAL });
  },

  setPreview(v) {
    this._pv = v;
    this.setData({
      pv: v,
      nowLabel: '当前程度 · ' + Q.SCALE.full[v - 1]
    });
  },

  /* ---------- 触摸：点一下 或 按住滑动 ---------- */

  onTouchStart(e) {
    this.stopHint();
    const t = e.touches[0];
    if (!t) return;
    this._x0 = t.clientX;
    this._slid = false;
    const v = this.hit(t.clientX);
    if (v) this.setPreview(v);
  },

  onTouchMove(e) {
    const t = e.touches[0];
    if (!t) return;
    if (!this._slid) {
      if (Math.abs(t.clientX - this._x0) < MOVE_PX) return;
      this._slid = true;
    }
    const v = this.hit(t.clientX);
    if (v && v !== this._pv) this.setPreview(v);
  },

  onTouchEnd() {
    const v = this._pv;
    this._pv = 0;
    if (this.data.pv) this.setData({ pv: 0 });
    if (v) this.commit(v, this._slid === true);
  },

  onTouchCancel() {
    this._pv = 0;
    if (this.data.pv) this.setData({ pv: 0 });
  },

  commit(v, isSlide) {
    const g = app.globalData;
    g.answers[g.idx] = v;

    const done = g.answers.filter(function (a) { return a > 0; }).length;
    this.setData({
      sel: v,
      pv: 0,
      done: done,
      pct: Math.round(done / TOTAL * 100),
      nowLabel: '当前选择：' + Q.SCALE.full[v - 1]
    });

    app.saveDraft();

    if (g.idx < TOTAL - 1) {
      const at = g.idx;
      const wait = isSlide ? SLIDE_MS : TAP_MS;
      clearTimeout(this._t);
      this._t = setTimeout(() => {
        if (g.answers[at] === v && g.idx === at) {
          g.idx = at + 1;
          this.render();
        }
      }, wait);
    }
  },

  /* ---------- 首题提示动画 ---------- */

  maybeHint() {
    const g = app.globalData;
    if (this._hinted) return;
    if (g.idx !== 0) return;
    if (g.answers.some(function (a) { return a > 0; })) return;

    this._hinted = true;
    const self = this;
    this._ht = [];
    const at = function (ms, fn) { self._ht.push(setTimeout(fn, ms)); };
    const show = function (v, left) {
      self._pv = 0;
      self.setData({
        pv: v,
        fingerLeft: left === undefined ? self.pos(v) : left,
        nowLabel: '当前程度 · ' + Q.SCALE.full[v - 1]
      });
    };

    this.setData({
      hintOn: true,
      fingerLeft: this.pos(3),
      nowLabel: '按住圆点左右滑，也能改程度'
    });

    at(760, function () { show(3); });
    at(1440, function () { show(4); });
    at(1840, function () { show(5); });
    at(2240, function () { show(6); });
    at(2800, function () {
      self.setData({
        hintOn: false,
        pv: 0,
        nowLabel: g.answers[0] ? '当前选择：' + Q.SCALE.full[g.answers[0] - 1] : ''
      });
    });
  },

  stopHint() {
    if (this._ht) {
      this._ht.forEach(function (t) { clearTimeout(t); });
      this._ht = null;
    }
    if (this.data.hintOn || this.data.pv) {
      this.setData({ hintOn: false, pv: 0 });
    }
  },

  /* ---------- 导航 ---------- */

  onPrev() {
    const g = app.globalData;
    this.stopHint();
    if (g.idx > 0) { g.idx--; this.render(); }
  },

  onNext() {
    const g = app.globalData;
    this.stopHint();
    if (!g.answers[g.idx]) {
      this.setData({ shaking: true });
      setTimeout(() => this.setData({ shaking: false }), 450);
      wx.showToast({ title: '先选一个程度，再继续', icon: 'none' });
      return;
    }

    if (g.idx < TOTAL - 1) {
      g.idx++;
      this.render();
    } else {
      this.finish();
    }
  },

  finish() {
    const g = app.globalData;
    const blank = g.answers.indexOf(0);

    if (blank !== -1) {
      g.idx = blank;
      this.render();
      wx.showToast({ title: '第 ' + (blank + 1) + ' 题还没作答', icon: 'none' });
      return;
    }

    app.saveDraft();
    wx.redirectTo({ url: '/pages/report/report' });
  }
});
