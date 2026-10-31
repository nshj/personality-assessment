# 小程序头像

上传规格：**1024×1024 PNG**，不透明底，直接传 `avatar-*.png`。微信列表里实际显示约 144px，
所以每版都另存了一份 `preview-144-*.png` 用来看真实尺寸下的效果。

| 文件 | 概念 | 说明 |
|---|---|---|
| `avatar-e.svg/.png` | **偏心珠**（推荐） | 外环＝评估框架，珠偏离圆心＝倾向。外环在 56px 下依然是完整的圆，是八版里轮廓最稳的 |
| `avatar-h.svg/.png` | 滑杆 | 一段轨道 + 偏右的紫色旋钮，直接对应答题页的七档滑杆 |
| `avatar-f.svg/.png` | 刻度盘 | 七根刻度，其中一根加粗高亮＝选中一档。但小尺寸下只剩一撇紫色，偏散 |
| `avatar-d.svg/.png` | 指针量表 | 七档 + 指针 + 轴心。语义最"评估"，但容易被看成时钟 |
| `avatar-c.svg/.png` | 两极 | 深紫底、圆被切成米白／紫两半。对比最强，但深色模式边缘会糊 |
| `avatar-b.svg/.png` | 坐标点 | 四维坐标轴 + 右上象限一个点。轴太细，56px 下几乎消失 |
| `avatar-a.svg/.png` | 十六格 | 4×4 网格点亮一格，呼应"16 型里你是哪一格" |

配色取自 `web/assets/style.css`：底 `#f8f5ff → #ebe2fa`，主色 `#6650d2 → #a25fd0`，
浅紫 `#cfc1f3`。改色直接改 SVG 里的色值，再重新渲染即可。

渲染脚本：`D:/MBTI/.e2e/render-avatars.js`（Edge + playwright-core，SVG 必须内联进 HTML 再截图，
用 `<img src="file://...">` 会被 about:blank 的安全策略挡住，截出空白图）。

## 网页 favicon

`favicon.svg` / `favicon-touch.svg` 是网页标签页与手机主屏用的图标，和上面那七个头像不是一回事：

- 概念沿用「环 + 点」，但改成**品牌紫底 + 白色环形与白点**。原因：浅色环配浅底的版本缩到 16px 时，
  环几乎看不见，只剩一个发灰的小方块
- 点放在**圆心**而不是偏心位置。偏心珠在 32px 以下会和环粘成一个"缺口的圆"，反而更像坏图
- `favicon.svg` 四角圆角、四周透明；`favicon-touch.svg` 满幅铺满（iOS 会自己套圆角遮罩）

产物在 `web/assets/`：`favicon-32.png`（标签页）、`favicon-192.png`（高分屏 / PWA）、
`apple-touch-icon.png`（180×180，iOS 加主屏）。渲染脚本 `D:/MBTI/.e2e/render-favicon.js`。

`404.html` 刻意不引用这三个图：它会被任意层级的不存在路径调用，相对路径会失效。
