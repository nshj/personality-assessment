const app = getApp();
const Analyzer = require('../../core/analyzer.js');

function pad2(n) { return (n < 10 ? '0' : '') + n; }

Page({
  data: {
    name: '',
    birth: '',
    gender: '',
    derived: '',
    today: '',
    genders: [
      { v: 'male', label: '男' },
      { v: 'female', label: '女' },
      { v: 'other', label: '其他' },
      { v: '', label: '不透露' }
    ]
  },

  onLoad(options) {
    /* new = 从首页「开始」进来，要开新一轮；resume = 其他入口，接着上次 */
    this._mode = (options && options.mode) === 'new' ? 'new' : 'resume';
    const d = new Date();
    const p = app.globalData.profile || {};
    this.setData({
      name: p.name || '',
      birth: p.birth || '',
      gender: p.gender || '',
      today: d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate())
    });
    if (p.birth) this.refreshDerived(p.birth);
  },

  onName(e) {
    this.setData({ name: e.detail.value });
  },

  onBirth(e) {
    const v = e.detail.value;
    this.setData({ birth: v });
    this.refreshDerived(v);
  },

  onGender(e) {
    this.setData({ gender: e.currentTarget.dataset.v });
  },

  refreshDerived(birth) {
    if (!birth) { this.setData({ derived: '' }); return; }
    const age = Analyzer.ageFrom(birth);
    const z = Analyzer.zodiac(birth);
    const band = age !== null ? Analyzer.ageBand(age) : null;

    const parts = [];
    if (age !== null) parts.push(age + ' 岁' + (band ? '（' + band.label + '）' : ''));
    if (z) parts.push(z.name);

    this.setData({
      derived: parts.length ? parts.join(' · ') + ' — 将用于报告的解读校准' : ''
    });
  },

  finish() {
    const self = this;

    app.globalData.profile = {
      name: (this.data.name || '').trim().slice(0, 16),
      birth: this.data.birth,
      gender: this.data.gender
    };
    app.saveDraft();

    const done = app.answeredCount();

    /* 清空不可逆：只有已有作答时才拦一次，且拦在「开始答题」这一下，
       而不是点「开始」那一下——否则在档案页按返回会白白丢掉 60 题进度 */
    if (this._mode === 'new' && done > 0) {
      wx.showModal({
        title: '开始新一轮',
        content: '上次已经答了 ' + done + ' 题。重新开始会清空这些作答，确定吗？',
        confirmText: '重新开始',
        cancelText: '取消',
        success(res) {
          if (!res.confirm) return;
          app.resetAnswers();
          self.enterQuiz();
        }
      });
      return;
    }

    if (this._mode === 'new') app.resetAnswers();
    this.enterQuiz();
  },

  /* 进入答题：mode 已在此前决出，这里只负责定位并落盘 */
  enterQuiz() {
    const idx = app.globalData.answers.indexOf(0);
    app.globalData.idx = idx === -1 ? 0 : idx;
    app.saveDraft();
    wx.redirectTo({ url: '/pages/quiz/quiz' });
  },

  onGo() { this.finish(); },

  /* 与网页版一致：跳过 = 用已填的内容直接进，不做强制校验 */
  onSkip() { this.finish(); }
});
