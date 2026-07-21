// ==========================================================================
// tests/smoke/smoke.mjs — 浏览器冒烟测试（步骤 7）
//
// 只验证「活着 + 大致对」，不验证逻辑（逻辑由 npm test 的 287 个测试覆盖）。
// 起真实服务端 + headless Chromium，跑 ~11 条最外层信号，跑完拆除。
//
// 独立于 npm test / npm run check 主管线：`npm run smoke`。慢（~15-30s）、
// 需 Chromium 环境，故不进日常快反馈回路。
//
// 设计见 docs/design/REGRESSION_TESTING_SYSTEM.md 步骤 7。
// ==========================================================================

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import puppeteer from 'puppeteer-core';
import * as browsers from '@puppeteer/browsers';
import { PUPPETEER_REVISIONS } from 'puppeteer-core/internal/revisions.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const PORT = 8029; // 独立端口，避开开发服务器 8021
const BASE = `http://127.0.0.1:${PORT}`;

let passed = 0, failed = 0;
const failures = [];
async function check(name, fn) {
  try { await fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e) { failed++; failures.push(`${name}: ${e.message}`); console.log(`  ✗ ${name}: ${e.message}`); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function resolveChrome() {
  const cacheDir = join(process.env.HOME || '.', '.cache', 'puppeteer');
  const platform = await browsers.detectBrowserPlatform();
  const buildId = await browsers.resolveBuildId(browsers.Browser.CHROMEHEADLESSSHELL, platform, PUPPETEER_REVISIONS['chrome-headless-shell']);
  const p = browsers.computeExecutablePath({ browser: browsers.Browser.CHROMEHEADLESSSHELL, buildId, cacheDir });
  return p;
}

async function waitForServer(timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { const r = await fetch(BASE + '/'); if (r.ok) return; } catch { /* not up yet */ }
    await sleep(300);
  }
  throw new Error('服务端未在超时内启动');
}

async function main() {
  // 1) 起服务端
  const srv = spawn('npx', ['tsx', 'src/server/index.ts'], {
    cwd: ROOT, env: { ...process.env, KFM_PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let srvLog = '';
  srv.stdout.on('data', d => { srvLog += d; });
  srv.stderr.on('data', d => { srvLog += d; });

  let browser;
  try {
    await waitForServer();

    const exe = await resolveChrome();
    browser = await puppeteer.launch({
      executablePath: exe, headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      defaultViewport: { width: 450, height: 895 },
    });
    const page = await browser.newPage();
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(e.message));

    await page.goto(BASE + '/', { waitUntil: 'load' });
    await sleep(1800); // 让 bundle 初始化 + 渲染

    // ===== 第一档：启动与骨架 =====
    console.log('\n[启动与骨架]');
    await check('1. 页面加载无 JS 运行时错误', () => {
      assert(pageErrors.length === 0, `捕获到 pageerror: ${pageErrors.join(' | ')}`);
    });
    await check('2. 光球可见', async () => {
      const ok = await page.$eval('.light-orb', el => {
        const s = getComputedStyle(el); return s.display !== 'none' && s.visibility !== 'hidden';
      }).catch(() => false);
      assert(ok, '.light-orb 不存在或不可见');
    });
    await check('3. 网格背景 canvas 渲染', async () => {
      const n = await page.evaluate(() => document.querySelectorAll('canvas').length);
      assert(n >= 1, `期望至少 1 个 canvas，得 ${n}`);
    });
    await check('4. 输入栏 + 发送按钮存在', async () => {
      const ok = await page.evaluate(() => !!document.querySelector('.ai-input-bar') && !!document.querySelector('.ai-send-btn'));
      assert(ok, '输入栏或发送按钮缺失');
    });

    // ===== 第二档：核心交互链路 =====
    console.log('\n[核心交互]');
    await check('5. 点光球 → AI 面板展开可见', async () => {
      const box = await page.$eval('.light-orb', el => { const r = el.getBoundingClientRect(); return { x: r.x + r.width/2, y: r.y + r.height/2 }; });
      await page.mouse.click(box.x, box.y);
      await sleep(600);
      const vis = await page.evaluate(() => {
        const p = document.querySelector('.orb-panel'); if (!p) return false;
        const s = getComputedStyle(p); return s.display !== 'none' && s.visibility !== 'hidden';
      });
      assert(vis, '点光球后 .orb-panel 未出现/不可见');
    });
    await check('6. 再点光球 → 面板收起', async () => {
      const box = await page.$eval('.light-orb', el => { const r = el.getBoundingClientRect(); return { x: r.x + r.width/2, y: r.y + r.height/2 }; });
      await page.mouse.click(box.x, box.y);
      await sleep(600);
      // 收起：panel 消失、不可见、零高、或 opacity:0（本项目用 opacity 淡出收起）
      const collapsed = await page.evaluate(() => {
        const p = document.querySelector('.orb-panel');
        if (!p) return true;
        const s = getComputedStyle(p);
        return s.display === 'none' || s.visibility === 'hidden'
          || parseFloat(s.opacity) < 0.05 || p.getBoundingClientRect().height < 5;
      });
      assert(collapsed, '再点光球后面板未收起');
    });
    await check('7. 三横线 → 文件树打开 (.sidebar.open)', async () => {
      const box = await page.$eval('.sidebar-toggle-btn', el => { const r = el.getBoundingClientRect(); return { x: r.x + r.width/2, y: r.y + r.height/2 }; });
      await page.mouse.click(box.x, box.y);
      await sleep(700);
      const open = await page.$eval('.sidebar', el => el.classList.contains('open')).catch(() => false);
      assert(open, '.sidebar 未获得 open 类');
    });
    await check('8. 文件树区域有内容（canvas 有尺寸）', async () => {
      const ok = await page.evaluate(() => {
        const c = document.querySelector('#fileTree canvas') || document.querySelector('.sidebar-content canvas') || document.querySelector('canvas');
        return c ? (c.width > 0 && c.height > 0) : false;
      });
      assert(ok, '文件树 canvas 无有效尺寸');
    });
    await check('9. AI 输入栏可聚焦输入', async () => {
      const sel = 'textarea, .ai-input-bar textarea, .ai-input-bar input';
      const has = await page.$(sel);
      assert(has, '未找到可输入元素');
      await page.focus(sel);
      await page.type(sel, 'smoke-test');
      const val = await page.$eval(sel, el => el.value);
      assert(val.includes('smoke-test'), `输入未生效，值=${val}`);
    });

    // ===== 第三档：z-index 层级盲区（数值断言，非截图）=====
    console.log('\n[层级盲区]');
    await check('10. z-index 权威层级表已加载且序关系正确', async () => {
      const z = await page.evaluate(() => {
        const r = getComputedStyle(document.documentElement);
        const num = (n) => parseInt(r.getPropertyValue(n).trim(), 10);
        return {
          tempCard: num('--z-tree-temp-card'), sidebar: num('--z-sidebar'),
          modal: num('--z-modal-dialog'), inputBar: num('--z-ai-input-bar'),
          orbPanel: num('--z-orb-panel'),
        };
      });
      assert(Number.isFinite(z.tempCard) && Number.isFinite(z.sidebar), 'z-index CSS 变量未加载');
      assert(z.tempCard > z.sidebar, `临时卡组(${z.tempCard})应高于文件树(${z.sidebar})（BAR-202）`);
      assert(z.modal > z.inputBar, `模态框(${z.modal})应高于输入栏(${z.inputBar})（L8 焦点层）`);
      assert(z.inputBar > z.orbPanel, `输入栏(${z.inputBar})应高于面板(${z.orbPanel})`);
    });
    await check('11. 输入栏 computed z-index 匹配层级表', async () => {
      const { computed, cssVar } = await page.evaluate(() => {
        const el = document.querySelector('.ai-input-bar');
        const r = getComputedStyle(document.documentElement);
        return { computed: getComputedStyle(el).zIndex, cssVar: r.getPropertyValue('--z-ai-input-bar').trim() };
      });
      assert(computed === cssVar, `输入栏 computed z(${computed}) ≠ 层级表(${cssVar})`);
    });

  } finally {
    if (browser) await browser.close().catch(() => {});
    srv.kill('SIGTERM');
    await sleep(300);
    try { srv.kill('SIGKILL'); } catch { /* already dead */ }
    if (failed > 0 && srvLog) {
      console.log('\n--- 服务端日志尾部 ---\n' + srvLog.split('\n').slice(-6).join('\n'));
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failures.length) { console.log('\n失败明细:'); for (const f of failures) console.log('  ✗ ' + f); }
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error('smoke runner 崩溃:', e); process.exit(1); });
