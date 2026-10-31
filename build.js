/* =========================================================
   同步脚本：把 core/ 分发到网页版和小程序版
   ---------------------------------------------------------
   用法：在本文件夹下执行  node build.js
   什么时候要跑：改过 core/ 里任何文件之后（题目、类型文案、
   规则、计分逻辑）。跑完两边就是一致的。
   不做任何代码转换，只复制文件。
   ========================================================= */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const CORE = path.join(ROOT, 'core');

/* 7 个文件必须放在同一个目录里，因为互相之间有 require('./xxx.js') */
const FILES = [
  'questions.js',
  'dims.js',
  'types.js',
  'rules.js',
  'profile.js',
  'analyzer.js',
  'exportAI.js'
];

function copyTo(dir) {
  fs.mkdirSync(dir, { recursive: true });
  FILES.forEach(function (f) {
    const src = path.join(CORE, f);
    if (!fs.existsSync(src)) throw new Error('缺少源文件：' + f);
    fs.copyFileSync(src, path.join(dir, f));
  });
  console.log('  -> ' + path.relative(ROOT, dir) + '  (' + FILES.length + ' 个文件)');
}

console.log('从 core/ 分发：');
copyTo(path.join(ROOT, 'web', 'core'));
copyTo(path.join(ROOT, 'weapp', 'core'));
console.log('完成。');
