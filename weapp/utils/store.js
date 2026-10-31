/* 本地存储：草稿 + 历史记录
   只存在本机，清缓存会丢，这是预期行为 */

const KEY_DRAFT = 'mbti.draft.v1';
const KEY_HISTORY = 'mbti.history.v1';
const HISTORY_MAX = 20;

function pad2(n) { return (n < 10 ? '0' : '') + n; }

function stamp(d) {
  d = d || new Date();
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) +
    ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
}

function idOf(d) {
  d = d || new Date();
  return String(d.getFullYear()) + pad2(d.getMonth() + 1) + pad2(d.getDate()) +
    pad2(d.getHours()) + pad2(d.getMinutes()) + pad2(d.getSeconds());
}

/* ---------------- 草稿 ---------------- */
function getDraft() {
  try { return wx.getStorageSync(KEY_DRAFT) || null; } catch (e) { return null; }
}

function setDraft(d) {
  try { wx.setStorageSync(KEY_DRAFT, d); } catch (e) {}
}

function clearDraft() {
  try { wx.removeStorageSync(KEY_DRAFT); } catch (e) {}
}

/* ---------------- 历史 ---------------- */
function getHistory() {
  try {
    const v = wx.getStorageSync(KEY_HISTORY);
    return Array.isArray(v) ? v : [];
  } catch (e) { return []; }
}

function saveHistory(list) {
  try { wx.setStorageSync(KEY_HISTORY, list); } catch (e) {}
}

function addHistory(rec) {
  let list = getHistory();
  list = list.filter(function (x) { return x.id !== rec.id; });
  list.unshift(rec);
  if (list.length > HISTORY_MAX) list = list.slice(0, HISTORY_MAX);
  saveHistory(list);
  return list;
}

function getHistoryById(id) {
  return getHistory().filter(function (x) { return x.id === id; })[0] || null;
}

function removeHistory(id) {
  const list = getHistory().filter(function (x) { return x.id !== id; });
  saveHistory(list);
  return list;
}

function clearHistory() {
  try { wx.removeStorageSync(KEY_HISTORY); } catch (e) {}
}

module.exports = {
  pad2: pad2,
  stamp: stamp,
  idOf: idOf,
  getDraft: getDraft,
  setDraft: setDraft,
  clearDraft: clearDraft,
  getHistory: getHistory,
  addHistory: addHistory,
  getHistoryById: getHistoryById,
  removeHistory: removeHistory,
  clearHistory: clearHistory
};
