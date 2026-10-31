const Store = require('./utils/store.js');
const Q = require('./core/questions.js');

App({
  globalData: {
    answers: new Array(Q.QUESTIONS.length).fill(0),
    idx: 0,
    profile: { name: '', birth: '', gender: '' },
    result: null,
    viewFrom: 'live'
  },

  onLaunch() {
    const d = Store.getDraft();
    if (d && Array.isArray(d.answers) && d.answers.length === Q.QUESTIONS.length) {
      this.globalData.answers = d.answers;
      this.globalData.idx = d.idx || 0;
      this.globalData.profile = d.profile || { name: '', birth: '', gender: '' };
    }
  },

  saveDraft() {
    const g = this.globalData;
    Store.setDraft({
      answers: g.answers,
      idx: g.idx,
      profile: g.profile,
      ts: Date.now()
    });
  },

  resetAll() {
    const g = this.globalData;
    g.answers = new Array(Q.QUESTIONS.length).fill(0);
    g.idx = 0;
    g.profile = { name: '', birth: '', gender: '' };
    g.result = null;
    Store.clearDraft();
  },

  /* 只清作答、保留档案：档案页点「开始答题」开新一轮时用这个 */
  resetAnswers() {
    const g = this.globalData;
    g.answers = new Array(Q.QUESTIONS.length).fill(0);
    g.idx = 0;
    g.result = null;
    Store.clearDraft();
  },

  answeredCount() {
    return this.globalData.answers.filter(function (a) { return a > 0; }).length;
  }
});
