const app = getApp();
const Q = require('../../core/questions.js');
const Store = require('../../utils/store.js');

Page({
  data: {
    total: Q.QUESTIONS.length,
    resumeN: 0,
    historyN: 0,
    startLabel: '开始'
  },

  onShow() {
    const done = app.answeredCount();
    this.setData({
      resumeN: done,
      historyN: Store.getHistory().length
    });
  },

  onStart() {
    wx.navigateTo({ url: '/pages/profile/profile?mode=new' });
  },

  onResume() {
    const idx = app.globalData.answers.indexOf(0);
    app.globalData.idx = idx === -1 ? 0 : idx;
    wx.navigateTo({ url: '/pages/quiz/quiz' });
  },

  onLastResult() {
    wx.navigateTo({ url: '/pages/report/report' });
  },

  onHistory() {
    wx.navigateTo({ url: '/pages/history/history' });
  }
});
