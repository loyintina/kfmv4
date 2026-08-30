/**
 * scripts/splash-boot-verify.mjs — 开机自播开屏自验收（2026-08-30 用户拍板
 * 「开机动画进开机链，三线速度按预测就绪时长定，动画结束正好扫完」）。
 *
 * 验收契约：
 *   A 开屏先于终端首帧盖屏（.on 出现在 first-frame 之前）
 *   B first-frame 到达后开屏收口退场（.out 在 2s 内出现；snap 路径
 *     SETTLE=500 + late 路径 300，留余量）
 *   C localStorage 'nz-splash-intro-ms' 写账（400–20000 clamp）
 *   D 淡出结束后覆层摘除（.on 消失），终端露出
 *   E 第二轮导航用回写预测值（scaled 路径）同样收口
 *
 * 链路：playwright connectOverCDP 127.0.0.1:8026 → 手机 WebView（NZ-Agent）。
 * 证据截图落 docs/active/nine-zero/assets/splash-boot-*.png。
 *
 * 跑法：node scripts/splash-boot-verify.mjs   （nz 目录下；手机 NZ-Agent 开着）
 */
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';

const CDP = process.env.NZ_CDP_URL || 'http://127.0.0.1:8026';
const BOOT = 'http://127.0.0.1:8023/';
const SHOTS = new URL('../../docs/active/nine-zero/assets/', import.meta.url).pathname;

const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

mkdirSync(SHOTS, { recursive: true });
let exitCode = 1;

const browser = await chromium.connectOverCDP(CDP);
const pages = browser.contexts().flatMap((c) => c.pages());
const page = pages.find((p) => p.url().includes('8023'));
if (!page) {
  console.log('❌ 枚举不到 8023 页（手机 NZ-Agent 没开？）');
  process.exit(1);
}
console.log(`attach 成功：${page.url()}`);

const probe = () => page.evaluate(() => {
  const el = document.getElementById('nz-splash');
  return {
    t: Math.round(performance.now()),
    on: el ? el.classList.contains('on') : null,
    out: el ? el.classList.contains('out') : null,
    marks: window.__kfmNzTermBootMarks || null,
    ls: (() => { try { return localStorage.getItem('nz-splash-intro-ms'); } catch { return null; } })(),
  };
// 热更腿/导航途中 eval 会撞「Execution context destroyed」——本轮探针
// 作废即可，下一轮 100ms 后重探（已踩过：build 后旧页 10s 轮询发现新
// build-info 自动 reload，正好压在轮询上）
}).catch(() => null);

async function round(tag, shotMid) {
  const lsBefore = (await probe())?.ls ?? null;
  const t0 = Date.now();
  await page.goto(BOOT, { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {});
  const tl = [];
  let firstFrameAt = null, outAt = null, offAt = null, midShot = false;
  for (let i = 0; i < 200; i++) { // 100ms × 200 = 20s 上限
    const s = await probe();
    if (s) {
      if (s.marks && s.marks['first-frame'] && firstFrameAt === null) firstFrameAt = Date.now() - t0;
      if (s.out === true && outAt === null) outAt = Date.now() - t0;
      if (s.on === false && offAt === null) offAt = Date.now() - t0;
      tl.push(s);
      if (shotMid && !midShot && s.on === true && s.t > 1200) {
        midShot = true;
        await page.screenshot({ path: `${SHOTS}splash-boot-${tag}-mid.png` }).catch(() => {});
      }
      if (offAt !== null) break;
    }
    await sleep(100);
  }
  await page.screenshot({ path: `${SHOTS}splash-boot-${tag}-after.png` }).catch(() => {});
  const last = tl[tl.length - 1] || {};
  const seenOn = tl.some((s) => s.on === true);
  return { lsBefore, firstFrameAt, outAt, offAt, seenOn, lsAfter: last.ls ?? null, marks: last.marks ?? null };
}

// ── 第一轮（可能无 localStorage 记录=默认预测 11000=snap 路径）────────
const r1 = await round('r1', true);
console.log('r1:', JSON.stringify(r1));
check('A 开屏先盖屏', r1.seenOn, `on 出现过=${r1.seenOn}`);
check('A2 首帧就绪', r1.firstFrameAt !== null, `first-frame @${r1.firstFrameAt}ms`);
check('B 首帧后收口', r1.outAt !== null && r1.firstFrameAt !== null && r1.outAt - r1.firstFrameAt < 2000,
  r1.outAt !== null && r1.firstFrameAt !== null ? `首帧→.out=${r1.outAt - r1.firstFrameAt}ms` : `outAt=${r1.outAt} ff=${r1.firstFrameAt}`);
check('C 预测写账', r1.lsAfter !== null && +r1.lsAfter >= 400 && +r1.lsAfter <= 20000, `ls=${r1.lsAfter}`);
check('D 覆层摘除', r1.offAt !== null, `off @${r1.offAt}ms`);

// ── 第二轮（localStorage 已有实测记录=scaled 路径）─────────────────────
const r2 = await round('r2', false);
console.log('r2:', JSON.stringify(r2));
check('E scaled 路径同样收口', r2.outAt !== null && r2.firstFrameAt !== null && r2.outAt - r2.firstFrameAt < 2000,
  r2.outAt !== null && r2.firstFrameAt !== null ? `首帧→.out=${r2.outAt - r2.firstFrameAt}ms（预测=${r2.lsBefore}）` : `outAt=${r2.outAt} ff=${r2.firstFrameAt}`);

// 收尾：页面留正常 boot 态（NZ-Agent 常态）
await page.goto(BOOT, { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {});
await browser.close();

const fails = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - fails}/${results.length} 通过`);
writeFileSync('/tmp/nz-splash-boot-verify.json', JSON.stringify({ r1, r2, results }, null, 2));
exitCode = fails ? 1 : 0;
process.exit(exitCode);
