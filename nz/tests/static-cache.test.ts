/**
 * tests/static-cache.test.ts — 缓存键吃 query 案回归钉（2026-09-11）。
 *
 * 病根：bundle.js/tokens.css 靠 ?v=hash 破缓存 + immutable 一年强缓存，
 * 但本机 WebView 缓存键吞 query——`?v=0d222d75`（从未见过的 URL）命中
 * 上一轮 4250b7a1 旧字节真机实锤，新包永远进不来，SPA 热更整条腿堵死。
 * 修法=入口双件入 NO_CACHE_BASE 改协商 304（Last-Modified，变更才全量）。
 *
 * 变异抽检靶子（本文件指定）：
 *   ①NO_CACHE_BASE 删 'bundle.js' → 钉①红；
 *   ②删 'tokens.css' → 钉②红；
 *   ③整段缓存策略回退 immutable → 钉③红（字体必须保住冷启动优化）。
 */
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test, group, assert } from './runner.ts';
import { createNzServer } from '../src/server/index.ts';
import type { AddressInfo } from 'node:net';

group('static-cache（缓存键吃 query 案回归钉）');

const withServer = async (fn: (base: string) => Promise<void>): Promise<void> => {
  const server = createNzServer();
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address() as AddressInfo;
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
};

test('①bundle.js：带 ?v= 的请求必须 no-cache（变异靶①）', async () => {
  await withServer(async (base) => {
    const r = await fetch(`${base}/bundle.js?v=deadbeef`);
    const cc = r.headers.get('cache-control');
    assert(cc === 'no-cache', `bundle.js cache-control=${cc}（immutable 会喂旧字节）`);
  });
});

test('②tokens.css 与 index.html 同案 no-cache（变异靶②）', async () => {
  await withServer(async (base) => {
    const css = await fetch(`${base}/tokens.css?v=deadbeef`);
    assert(css.headers.get('cache-control') === 'no-cache', `tokens.css cache-control=${css.headers.get('cache-control')}`);
    const html = await fetch(`${base}/?nosplash`);
    assert(html.headers.get('cache-control') === 'no-cache', `index cache-control=${html.headers.get('cache-control')}`);
  });
});

test('③字体仍 immutable（冷启动优化不回退，变异靶③）', async () => {
  await withServer(async (base) => {
    const dir = join(process.cwd(), 'public', 'fonts');
    const fonts = readdirSync(dir).filter((f) => f.endsWith('.ttf') || f.endsWith('.woff2'));
    assert(fonts.length > 0, 'public/fonts 至少一枚字体（夹具前提）');
    const r = await fetch(`${base}/fonts/${fonts[0]}`);
    const cc = r.headers.get('cache-control');
    assert(cc?.includes('immutable') === true, `字体 cache-control=${cc}（3.3MB 冷启动账，见 2026-08-28 探针）`);
  });
});
