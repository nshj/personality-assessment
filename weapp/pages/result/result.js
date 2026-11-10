const app = getApp();

const W = 750;
const H = 1334;
const DPR = 2;          /* 输出 1500×2668，清晰又不撞 canvas 尺寸上限 */
const SANS = '-apple-system, "PingFang SC", "Hiragino Sans GB", sans-serif';
const SERIF = 'Georgia, "Times New Roman", serif';

function rrect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function fit(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  let s = text;
  while (s.length > 2 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
  return s + '…';
}

Page({
  data: {
    src: '',
    loading: true,
    err: ''
  },

  onLoad() {
    const g = app.globalData;
    if (!g.result || !g.resultAnswers) {
      wx.showToast({ title: '没有可用的结果', icon: 'none' });
      setTimeout(function () { wx.reLaunch({ url: '/pages/index/index' }); }, 700);
      return;
    }
    this._result = g.result;
    this._profile = g.resultProfile;
    this.draw();
  },

  draw() {
    const self = this;
    wx.createSelectorQuery()
      .select('#card')
      .fields({ node: true, size: true })
      .exec(function (res) {
        if (!res || !res[0] || !res[0].node) {
          self.setData({ err: '画布初始化失败，请退出重进这个页面。', loading: false });
          return;
        }
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        canvas.width = W * DPR;
        canvas.height = H * DPR;
        ctx.scale(DPR, DPR);

        self.loadQr(canvas).then(function (img) {
          try {
            self.paint(ctx, img);
          } catch (e) {
            self.setData({ err: '绘制出错：' + (e && e.message ? e.message : '未知原因'), loading: false });
            return;
          }
          wx.canvasToTempFilePath({
            canvas: canvas,
            destWidth: W * DPR,
            destHeight: H * DPR,
            success: function (r) {
              self.setData({ src: r.tempFilePath, loading: false });
            },
            fail: function (e) {
              self.setData({ err: '导出失败：' + (e.errMsg || '未知原因'), loading: false });
            }
          });
        });
      });
  },

  /* 小程序码还没放进来时，画一个虚线占位框，不影响出图 */
  loadQr(canvas) {
    return new Promise(function (resolve) {
      const img = canvas.createImage();
      let done = false;
      function finish(v) { if (!done) { done = true; resolve(v); } }
      img.onload = function () { finish(img); };
      img.onerror = function () { finish(null); };
      img.src = '/assets/wx-qrcode.png';
      setTimeout(function () { finish(null); }, 1500);
    });
  },

  paint(ctx, qr) {
    const R = this._result;

    /* 底色 */
    ctx.fillStyle = '#f5f3ef';
    ctx.fillRect(0, 0, W, H);

    const gr = ctx.createLinearGradient(0, 0, W, 0);
    gr.addColorStop(0, '#6650d2');
    gr.addColorStop(1, '#a25fd0');
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, W, 10);

    /* 顶标 */
    ctx.textAlign = 'center';
    ctx.fillStyle = '#918c9a';
    ctx.font = '500 24px ' + SANS;
    ctx.fillText('60 人格倾向评估', W / 2, 120);

    /* 类型码 */
    const code = R.code;
    const idPart = '-' + R.identity;

    ctx.font = '700 112px ' + SERIF;
    const wCode = ctx.measureText(code).width;
    ctx.font = '600 46px ' + SERIF;
    const wId = ctx.measureText(idPart).width;

    const totalW = wCode + wId + 8;
    const startX = (W - totalW) / 2;

    ctx.textAlign = 'left';
    ctx.fillStyle = '#6650d2';
    ctx.font = '700 112px ' + SERIF;
    ctx.fillText(code, startX, 250);

    ctx.font = '600 46px ' + SERIF;
    ctx.fillText(idPart, startX + wCode + 8, 208);

    /* 中文名 */
    ctx.textAlign = 'center';
    ctx.fillStyle = '#151419';
    ctx.font = '700 42px ' + SANS;
    ctx.fillText(R.type.name, W / 2, 330);

    /* 分组 + 一句描述 */
    ctx.fillStyle = '#6f6b78';
    ctx.font = '400 26px ' + SANS;
    const sub = (R.type.group ? '' : '') + R.type.tag;
    ctx.fillText(fit(ctx, sub, 600), W / 2, 376);

    /* 分隔 */
    ctx.fillStyle = '#e6e2db';
    ctx.fillRect(64, 418, 622, 1);

    /* 五维 */
    R.dims.forEach(function (d, i) {
      const y = 470 + i * 96;
      const leadLabel = d.plusLead ? d.plusLabel : d.minusLabel;

      ctx.textAlign = 'left';
      ctx.font = '500 28px ' + SANS;
      ctx.fillStyle = '#151419';
      ctx.fillText(leadLabel + '  ' + d.lead, 64, y);

      ctx.textAlign = 'right';
      ctx.font = '700 28px ' + SANS;
      ctx.fillStyle = '#6650d2';
      ctx.fillText(d.leadPct + '%', 686, y);

      const barY = y + 22;

      ctx.fillStyle = '#e8e4dc';
      rrect(ctx, 64, barY, 622, 14, 7);
      ctx.fill();

      const bw = Math.max(7, 622 * d.leadPct / 100);
      const bx = d.plusLead ? 64 : 64 + 622 - bw;

      const bg = ctx.createLinearGradient(bx, 0, bx + bw, 0);
      bg.addColorStop(0, '#6650d2');
      bg.addColorStop(1, '#a25fd0');
      ctx.fillStyle = bg;
      rrect(ctx, bx, barY, bw, 14, 7);
      ctx.fill();
    });

    /* 一致性 */
    ctx.fillStyle = '#e6e2db';
    ctx.fillRect(64, 968, 622, 1);

    const c = R.consistency;
    const gColor = c.grade === '高' ? '#2f8a6a' : (c.grade === '中' ? '#b8763a' : '#c8564a');
    ctx.textAlign = 'center';
    ctx.fillStyle = gColor;
    ctx.font = '600 28px ' + SANS;
    ctx.fillText('作答一致性 ' + c.overall + ' / 100 · ' + c.grade, W / 2, 1028);

    /* 小程序码 */
    const qs = 160;
    const qx = (W - qs) / 2;
    const qy = 1082;

    if (qr) {
      ctx.drawImage(qr, qx, qy, qs, qs);
    } else {
      ctx.strokeStyle = '#c9c4bb';
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 8]);
      ctx.strokeRect(qx, qy, qs, qs);
      ctx.setLineDash([]);
      ctx.fillStyle = '#a8a39c';
      ctx.font = '400 22px ' + SANS;
      ctx.textAlign = 'center';
      ctx.fillText('小程序码', W / 2, qy + qs / 2 + 8);
    }

    ctx.fillStyle = '#918c9a';
    ctx.font = '400 22px ' + SANS;
    ctx.textAlign = 'center';
    ctx.fillText('微信扫码，测一次', W / 2, qy + qs + 44);
  },

  onSave() {
    const src = this.data.src;
    if (!src) return;

    wx.saveImageToPhotosAlbum({
      filePath: src,
      success: function () {
        wx.showToast({ title: '已保存到相册', icon: 'success' });
      },
      fail: function (e) {
        const msg = String(e.errMsg || '');

        if (msg.indexOf('cancel') > -1) return;

        if (msg.indexOf('auth') > -1 || msg.indexOf('authorize') > -1 || msg.indexOf('deny') > -1) {
          wx.showModal({
            title: '需要相册权限',
            content: '保存图片要用到「保存到相册」权限。去设置里打开后，再点一次保存。',
            confirmText: '去设置',
            success: function (r) {
              if (r.confirm) wx.openSetting({});
            }
          });
          return;
        }

        wx.showToast({ title: '保存失败，可长按图片保存', icon: 'none' });
      }
    });
  }
});
