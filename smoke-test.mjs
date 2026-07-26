#!/usr/bin/env node
/**
 * smoke-test.mjs — 构建产物冒烟测试
 *
 * 启动服务 → 验证 HTML 引用的 bundle 存在且可访问 → 退出。
 * 挂到 build.mjs 末尾，构建完自动跑。
 */

import http from 'http';

const PORT = process.env.KFM_PORT || 8021;
const HOST = '127.0.0.1';
const TIMEOUT_MS = 5000;

// 动态 import 启动脚本避免污染全局
const indexMod = await import('../dist/server/index.js');

// 等服务器 ready（简单 sleep）
await new Promise(r => setTimeout(r, 500));

const req = http.get(`http://${HOST}:${PORT}/`, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    if (!body.includes('bundle.js')) {
      console.error('[smoke] ❌ 响应中未找到 bundle.js 引用');
      process.exit(1);
    }
    console.log('[smoke] ✅ bundle.js 引用确认');
    
    // 验证 bundle.js 文件可达
    http.get(`http://${HOST}:${PORT}/bundle.js`, (res2) => {
      if (res2.statusCode !== 200) {
        console.error(`[smoke] ❌ bundle.js 返回 HTTP ${res2.statusCode}`);
        process.exit(1);
      }
      console.log('[smoke] ✅ bundle.js HTTP 200');
      process.exit(0);
    }).on('error', (e) => {
      console.error(`[smoke] ❌ bundle.js 请求失败: ${e.message}`);
      process.exit(1);
    });
  });
});

req.on('error', (e) => {
  console.error(`[smoke] ❌ 无法连接 http://${HOST}:${PORT}: ${e.message}`);
  process.exit(1);
});

req.setTimeout(TIMEOUT_MS, () => {
  console.error(`[smoke] ❌ 连接超时 (${TIMEOUT_MS}ms)`);
  process.exit(1);
});

// 超时兜底
setTimeout(() => { console.error('[smoke] ❌ 整体超时'); process.exit(1); }, TIMEOUT_MS + 2000);
