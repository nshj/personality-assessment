const Store = require('../../utils/store.js');

const CLS = { '高': 'g-ok', '中': 'g-mid', '低': 'g-low' };

Page({
  data: { list: [] },

  onShow() {
    const list = Store.getHistory().map(function (x) {
      return {
        id: x.id,
        fullCode: x.fullCode,
        typeName: x.typeName,
        date: x.date,
        consistency: x.consistency,
        grade: x.grade,
        cls: CLS[x.grade] || 'g-low'
      };
    });
    this.setData({ list: list });
  },

  onOpen(e) {
    wx.navigateTo({ url: '/pages/report/report?id=' + e.currentTarget.dataset.id });
  },

  onClear() {
    wx.showModal({
      title: '清空记录',
      content: '会删掉本机保存的全部历史，删了找不回来。',
      confirmText: '清空',
      confirmColor: '#c8564a',
      success: function (res) {
        if (!res.confirm) return;
        Store.clearHistory();
        /* onShow 会重新读，这里直接重载一下页面 */
        wx.reLaunch({ url: '/pages/history/history' });
      }
    });
  },

  onGo() {
    wx.reLaunch({ url: '/pages/index/index' });
  }
});
