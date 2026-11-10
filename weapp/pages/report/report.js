const app = getApp();
const Analyzer = require('../../core/analyzer.js');
const ProfileData = require('../../core/profile.js');
const AIExport = require('../../core/exportAI.js');
const ShareCode = require('../../core/share.js');
const ReportData = require('../../utils/reportData.js');
const Store = require('../../utils/store.js');

const GENDER_LABEL = { male: '男', female: '女', other: '其他' };

/* 导出链接固定指向网页端。写成常量而不是读配置：
   这里一旦拼错，用户拿到的是打不开的死链，而且没有兜底 */
const SITE_URL = 'https://60.2x.work/';

function buildProfile(raw) {
  const p = raw || {};
  const age = Analyzer.ageFrom(p.birth);
  return {
    name: p.name || '',
    birth: p.birth || '',
    gender: p.gender || '',
    genderLabel: GENDER_LABEL[p.gender] || '',
    age: age,
    ageBand: Analyzer.ageBand(age),
    genderNote: ProfileData.GENDER_NOTES[p.gender] || '',
    zodiac: Analyzer.zodiac(p.birth)
  };
}

Page({
  data: {
    r: null,
    answersOpen: false
  },

  onLoad(options) {
    const id = options && options.id;
    let answers;
    let rawProfile;
    let fromHistory = false;

    if (id) {
      const rec = Store.getHistoryById(id);
      if (!rec) {
        wx.showToast({ title: '这条记录不在了', icon: 'none' });
        setTimeout(function () { wx.navigateBack(); }, 800);
        return;
      }
      answers = rec.answers;
      rawProfile = rec.profile;
      fromHistory = true;
      this._id = id;
    } else {
      answers = app.globalData.answers;
      rawProfile = app.globalData.profile;
    }

    if (!answers || answers.indexOf(0) !== -1) {
      wx.showToast({ title: '还有题目没作答', icon: 'none' });
      setTimeout(function () { wx.redirectTo({ url: '/pages/quiz/quiz' }); }, 600);
      return;
    }

    const result = Analyzer.score(answers);
    const profile = buildProfile(rawProfile);
    const view = ReportData.build(result, profile, answers);

    this._result = result;
    this._profile = profile;
    this._answers = answers;

    this.setData({ r: view });

    const lowInfo = result.info && result.info.lowInfo;
    wx.setNavigationBarTitle({
      title: lowInfo ? '无法定位类型' : result.fullCode + ' · ' + result.type.name
    });

    /* 没有结论就不进历史，否则列表里会出现一个自己都不认的类型 */
    if (!fromHistory && !lowInfo) this.remember(result, answers, rawProfile);
  },

  /* 同一份答案不重复存 */
  remember(result, answers, rawProfile) {
    const list = Store.getHistory();
    const last = list[0];
    const same = last &&
      Array.isArray(last.answers) &&
      last.answers.length === answers.length &&
      last.answers.every(function (v, i) { return v === answers[i]; });

    if (same) { this._id = last.id; return; }

    const id = Store.idOf();
    this._id = id;
    Store.addHistory({
      id: id,
      ts: Date.now(),
      date: Store.stamp(),
      fullCode: result.fullCode,
      code: result.code,
      identity: result.identity,
      typeName: result.type.name,
      consistency: result.consistency.overall,
      grade: result.consistency.grade,
      pctMap: result.pctMap,
      answers: answers.slice(),
      profile: {
        name: (rawProfile && rawProfile.name) || '',
        birth: (rawProfile && rawProfile.birth) || '',
        gender: (rawProfile && rawProfile.gender) || ''
      }
    });
  },

  toggleAnswers() {
    this.setData({ answersOpen: !this.data.answersOpen });
  },

  onResultCard() {
    const g = app.globalData;
    g.result = this._result;
    g.resultProfile = this._profile;
    g.resultAnswers = this._answers;
    wx.navigateTo({ url: '/pages/result/result' });
  },

  onCopyAI() {
    const text = AIExport.buildLite(this._result, this._profile, this._answers);
    wx.setClipboardData({
      data: text,
      success: function () {
        /* 系统已自带「内容已复制」提示，这里不再叠加 */
      },
      fail: function () {
        wx.showToast({ title: '复制失败，请重试', icon: 'none' });
      }
    });
  },

  /* 把 60 题答案压进链接，复制到剪贴板。
     不能给可点的链接：微信内置浏览器里没有打印入口，
     点进去只会白跑一趟，所以这里只复制，配一句去浏览器。 */
  onExportLink() {
    const code = ShareCode.ShareCode.encode(this._answers, this._profile);
    if (!code) {
      wx.showToast({ title: '作答不完整，无法生成链接', icon: 'none' });
      return;
    }
    wx.setClipboardData({
      data: SITE_URL + '#r=' + code,
      success: function () {
        /* 覆盖系统的「内容已复制」，把下一步动作带上 */
        wx.showToast({ title: '已复制 · 打开浏览器粘贴', icon: 'none', duration: 3000 });
      },
      fail: function () {
        wx.showToast({ title: '复制失败，请重试', icon: 'none' });
      }
    });
  },

  onHistory() {
    wx.navigateTo({ url: '/pages/history/history' });
  },

  onRetest() {
    wx.showModal({
      title: '重新测试',
      content: '会清空当前的答案和档案，确定吗？',
      confirmText: '重测',
      success: function (res) {
        if (!res.confirm) return;
        app.resetAll();
        wx.reLaunch({ url: '/pages/index/index' });
      }
    });
  }
});
