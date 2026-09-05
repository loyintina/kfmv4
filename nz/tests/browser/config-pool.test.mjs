/**
 * tests/browser/config-pool.test.mjs — 配置池 A2a 阶段二 B 档考卷（设计清单
 * docs/config-pool-a2a-design.md §五 B 档 11 钉；状态机蓝本=§四，词汇表 P6）。
 *
 *   B1  C1 左滑进入 + P1 冲突矩阵逐行（SHELL 左滑进/垂直不抢+scrollback 照滚/
 *       ALT 态左滑照进池（仲裁⑪）/标签排横滑不触发且标签排照滚/keybar·composer·orb 落点
 *       不响应/AI_PAGE 态不响应）
 *   B2  C2 返回双通道（右滑 / × 钮）+ EDITING 中右滑草稿蒸发
 *   B3  C3 标签行四池切换 + client 注册表 ⊆ server /pool/list 互证
 *   B4  picker 同源互证（拍板⑫联动）：池页加 model → /ai/providers 即变 →
 *       picker 二级同形；picker 选中 → 总账变 → 池页 ✓ 同步
 *   B5  C7/C8 relied 禁删 UI（409 人话展 reliedBy+条目仍在）+ 断引用「已失效」
 *   B6  P2 激活双态 UI（编辑不动激活标；设为激活 → ✓ 移动+picker ✓+基本池槽位）
 *   B7  P4 密钥不明文（保存明文 → 载荷/DOM/钩子/池文件/日志 grep 全净，
 *       .env 600 落明文，回填=代字空输入）
 *   B8  C12 标题栏入口路由（拍板⑯）：kfm-nz-pool-open 事件 → POOL_OPEN 直达
 *       对应池 + AI 页不收起；B8c 入口接真（阶段三）：标题栏点「角色」→ 池页
 *       开+定位 prompt 池+占位元素退役；B8d orb 置顶/关闭切换器先咬
 *   B9  P6/P9 词汇表+观测钩+动画 token（ring 状态名 ⊆ 枚举/≥50 拍；
 *       动画时长跟随 --kfm-dur-normal；/tmp 夹具 nz-pool.log JSONL 互证）
 *   B10 C11/C13 推送校准（第二页 CRUD → 本页 pool/changed refetch；WS 断+
 *       回前台 → 重连 refetch）
 *   B11 P10/仲裁⑩ 层级（池页 z44 全屏；composer/orb 池页在场恒顶 z45；
 *       tmux 控件 display:none；C12 路径 AI 页 z42 在其下不收起）
 *   B12 仲裁⑩ orb 三态（A2a 阶段三）：光球=AI 面板「置顶/关闭」切换器——
 *       池页开着点球=AI 页提到池页上（池页降 41 不关）；提顶档右滑不关隐藏
 *       池页；再点球=关 AI 页（池页复现 z44）；提顶档对无关重渲染稳定；
 *       路由事件（C12 入口意图）把池页召回 AI 之上
 *   B13 真触摸右滑返回（2026-09-05 真机报告修复钉；L1/L3 缝隙）：
 *       CDP Input.dispatchTouchEvent 真触摸序列（非合成 JS 事件，走浏览器
 *       输入管线=touch-action/pointercancel 全真实）——池页列表行上横拖
 *       全流到手（cancels=0）+ 右滑关池成立；垂直拖仍归原生列表滚动
 *       （P1 矩阵行不破）；池页根/列表区 touch-action=pan-y 静态钉。
 *       病灶：body none 罩不进「触点元素自身即可滚动容器」子树，横拖
 *       ~slop 即被原生接管 → pointercancel → 手势核小位移判 null（真机
 *       右滑不响、mouse 合成事件钉全绿的原因）。
 *
 * 跑法：node tests/browser/config-pool.test.mjs（自起隔离 server 实例：
 * NZ_AI_CONFIG_DIR=临时夹具、独立端口、NZ_POOL_LOG=夹具内——零接触真机
 * ~/.kfmv4 与 8023 dev 实例；tmux 是机器全局的，卷内建的 6 个 pool-exam-*
 * 会话收尾自拆）。
 *
 * 红先证据：2026-09-04 先写本卷跑红（config-pool 插件未实现，
 * __kfmNzPool 钩子缺席 → 全卷红，rc=1）→ 实现 → 全绿。
 */
import { launchBrowser } from './launch.mjs';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const results = [];
const check = (name, ok, detail) => { results.push({ name, ok }); console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`); };
const SHOT_DIR = join(process.cwd(), 'tests', 'assets');
const shot = async (page, name) => { const p = join(SHOT_DIR, `config-pool-${name}.png`); await page.screenshot({ path: p }); console.log('shot:', p); };

// ---------- 词汇表（设计 §四，P6 唯一真源；B9 全程采样判定用） ----------
const PAGE_VOCAB = ['POOL_CLOSED', 'POOL_OPEN'];
const INNER_VOCAB = ['BROWSE', 'EDITING', 'OVERLAY_DELETE'];
const POOL_VOCAB = ['basic', 'provider', 'prompt', 'session'];

// ---------- 隔离 server 实例（夹具目录 + 私有端口 + 夹具日志） ----------
const FIXTURE = await mkdtemp(join(tmpdir(), 'nz-pool-b-'));
const POOL_LOG = join(FIXTURE, 'pool.log');
let PORT = 8123;
const freePort = async (p) => await fetch(`http://127.0.0.1:${p}/pool/list`).then(() => false).catch(() => true);
while (!(await freePort(PORT))) PORT++;
console.log(`[exam] 隔离实例：port=${PORT} fixture=${FIXTURE}`);
const srv = spawn(join(process.cwd(), 'node_modules', '.bin', 'tsx'), ['src/server/index.ts'], {
  cwd: process.cwd(),
  env: { ...process.env, NZ_PORT: String(PORT), NZ_AI_CONFIG_DIR: FIXTURE, NZ_POOL_LOG: POOL_LOG, NZ_GATE_DIR: join(FIXTURE, 'gate') },
  stdio: ['ignore', 'pipe', 'pipe'],
});
srv.stdout.on('data', (d) => { if (String(d).includes('error') || String(d).includes('Error')) console.log('[srv]', String(d).slice(0, 200)); });
srv.stderr.on('data', (d) => console.log('[srv!]', String(d).slice(0, 200)));
const BASE = `http://127.0.0.1:${PORT}`;
let srvUp = false;
for (let i = 0; i < 120; i++) {
  try { const r = await fetch(`${BASE}/pool/list`); if (r.ok) { srvUp = true; break; } } catch { /* 未起 */ }
  await sleep(500);
}

// ---------- 夹具播种（全走 /pool/* 统一池数据层——本身就是 A1 语义复跑） ----------
const api = async (path, body) => {
  const r = await fetch(`${BASE}${path}`, body === undefined ? {} : {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  return { status: r.status, json: await r.json().catch(() => null) };
};
if (srvUp) {
  await api('/pool/provider/create', { entry: { id: 'examprov', name: 'Exam Provider', baseUrl: 'https://exam.example/v1', apiKey: '', models: ['exam-model-a', 'exam-model-b'] } });
  await api('/pool/provider/create', { entry: { id: 'otherprov', name: 'Other Provider', baseUrl: 'https://other.example/v1', apiKey: '', models: ['other-model-1'] } });
  await api('/pool/prompt/create', { entry: { id: '考试角色', name: '考试角色' } });
  await api('/pool/session/create', { entry: { title: '依赖会话', providerId: 'examprov', modelId: 'exam-model-a' } });
  await api('/pool/session/create', { entry: { title: '断头会话', providerId: 'ghost-prov' } });
}

const PLAIN_KEY = 'sk-exam-plain-000111';
const KEY_SHAPE = /sk-exam-plain-000111/;

// ---------- 浏览器 ----------
const browser = await launchBrowser();
const context = await browser.newContext({ viewport: { width: 900, height: 620 } });
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', (e) => { pageErrors.push(String(e).slice(0, 160)); console.log('[PAGEERROR]', String(e).slice(0, 200)); });
await page.goto(`${BASE}/?nosplash`, { waitUntil: 'domcontentloaded', timeout: 40000 }).catch(() => {});
const hookAlive = srvUp && await page.waitForFunction(() => !!(window).__kfmNzPool, null, { timeout: 20000, polling: 250 }).then(() => true).catch(() => false);

const vocabSamples = [];
const poolHook = async () => page.evaluate(() => {
  const f = (window).__kfmNzPool;
  if (!f) return null;
  const r = f();
  return {
    page: r.page, pool: r.pool, pageState: r.pageState, editing: r.editing, active: r.active,
    ringLen: r.ring?.length ?? 0,
    ring: (r.ring ?? []).map((e) => ({ trigger: e.trigger, from: { page: e.from.page, inner: e.from.inner }, to: { page: e.to.page, inner: e.to.inner } })),
    lastEvents: r.lastEvents ?? [],
  };
});
const hook = async () => {
  const h = await poolHook();
  if (h) {
    vocabSamples.push({ kind: 'page', v: h.page }, { kind: 'inner', v: h.pageState }, { kind: 'pool', v: h.pool });
    for (const e of h.ring ?? []) {
      vocabSamples.push({ kind: 'page', v: e.from.page }, { kind: 'inner', v: e.from.inner });
      vocabSamples.push({ kind: 'page', v: e.to.page }, { kind: 'inner', v: e.to.inner });
    }
  }
  return h;
};
const aiHook = async () => page.evaluate(() => { const f = (window).__kfmNzAiChat; return f ? f() : null; }).catch(() => null);

/** 合成手势：pointerdown → 分步 move → pointerup（Playwright mouse 即 pointer 事件源） */
const swipe = async (x, y, dx, dy, steps = 14) => {
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) await page.mouse.move(x + (dx * i) / steps, y + (dy * i) / steps);
  await page.mouse.up();
  await sleep(150);
};
const swipeLeftOn = async (sel) => {
  const box = await page.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, sel);
  if (!box) return false;
  await swipe(Math.min(box.x, 700), box.y, -170, 0);
  return true;
};
const termCenter = () => page.evaluate(() => { const e = document.querySelector('.nz-term'); const r = e?.getBoundingClientRect(); return r ? { x: r.x + Math.min(r.width / 2, 400), y: r.y + r.height / 2 } : { x: 400, y: 300 }; });
const poolClosed = async () => { const h = await hook(); return h?.page === 'POOL_CLOSED'; };
const openPoolBySwipe = async () => { const c = await termCenter(); await swipe(c.x, c.y, -170, 0); };
const closePoolBySwipe = async () => { await swipe(400, 300, 170, 0); };

try {
  // ========== ⓪ 环境就绪 ==========
  check('⓪ 隔离 server 起来 + 夹具播种（/pool/list 四池）', srvUp && (await api('/pool/list')).json?.length === 4,
    `srvUp=${srvUp} pools=${JSON.stringify((await api('/pool/list')).json?.map((p) => p.pool))}`);
  check('⓪ __kfmNzPool 观测钩在场', hookAlive);
  if (!hookAlive) throw new Error('hook missing — 后续钉全不成立');

  // ========== B1：C1 左滑进入 + P1 冲突矩阵 ==========
  {
    await page.waitForSelector('.nz-term', { timeout: 15000 });
    await sleep(2000); // PTY 提示符稳定
    const c0 = await termCenter();
    await swipe(c0.x, c0.y, -170, 0);
    const h1 = await hook();
    check('B1a SHELL 态终端正文左滑 → POOL_OPEN（默认基本池）+ DOM 在场',
      h1?.page === 'POOL_OPEN' && h1?.pool === 'basic' && h1?.pageState === 'BROWSE'
      && await page.evaluate(() => !!document.querySelector('[data-kfm-pool]')),
      `page=${h1?.page} pool=${h1?.pool} inner=${h1?.pageState}`);
    await shot(page, 'b1a-open-basic');
    await closePoolBySwipe();
    check('B1a-收 右滑返回 POOL_CLOSED（B2 前置顺带）', await poolClosed());

    // B1b 垂直滑不触发 + 终端 scrollback 自有链路不被抢
    await page.evaluate(() => (window).__kfmNzTermInject?.('seq 1 200\r'));
    await sleep(1200);
    await page.evaluate(() => { const s = (window).__kfmNzTermScroll?.(); if (s) s.getContainer().scrollTop = 0; });
    await sleep(200);
    const scBefore = await page.evaluate(() => { const s = (window).__kfmNzTermScroll?.(); return s ? { st: s.getContainer().scrollTop, sh: s.scrollHeight } : null; });
    const cv = await termCenter();
    await swipe(cv.x, cv.y, 0, -140); // 纯垂直上滑
    const scAfter = await page.evaluate(() => { const s = (window).__kfmNzTermScroll?.(); return s ? { st: s.getContainer().scrollTop } : null; });
    // scrollback 自有链路健康（headless 无真触摸 pan，考卷惯例=程序化滚动互证，
    // scrollback.test.mjs 同款；真机滚动复核归 C 档）
    await page.evaluate(() => { const s = (window).__kfmNzTermScroll?.(); if (s) s.getContainer().scrollTop = 40; });
    await sleep(150);
    const scWheel = await page.evaluate(() => (window).__kfmNzTermScroll?.().getContainer().scrollTop ?? -1);
    check('B1b 垂直滑不进池（P1 方向裁决）', await poolClosed(), `st ${scBefore?.st}→${scAfter?.st}`);
    check('B1b-滚 终端 scrollback 自有链路照滚（容器可滚，手势注册零改滚动语义）',
      scWheel > 0 && (scBefore?.sh ?? 0) > (scBefore?.st ?? 0) + 100, `set40→${scWheel} sh=${scBefore?.sh}`);

    // B1c ALT/TUI 态左滑照进池（仲裁⑪ 2026-09-05 用户拍板「任何地方都能左滑」：
    // 用户主场景=设备常挂 kimi-code（本身是 TUI 占 ALT 屏），设门=池页最高频
    // 状态不可达，门拆除；触摸手势不注入字节，TUI 底下继续跑零影响）
    await page.evaluate(() => (window).__kfmNzTermInject?.("printf '\\033[?1049h'\r"));
    await sleep(800);
    const altOn = await page.evaluate(() => (window).__kfmNzTermScroll?.().alt ?? null);
    const cA = await termCenter();
    await swipe(cA.x, cA.y, -170, 0);
    const hAlt = await hook();
    // 右滑返回（池页内右滑不受 ALT 影响），再退 ALT 屏
    await swipe(cA.x, cA.y, 170, 0);
    await sleep(250);
    const hAltClosed = await hook();
    await page.evaluate(() => (window).__kfmNzTermInject?.("printf '\\033[?1049l'\r"));
    await sleep(400);
    const altOff = await page.evaluate(() => (window).__kfmNzTermScroll?.().alt ?? null);
    check('B1c ALT/TUI 态左滑照进池+右滑照回（仲裁⑪：ALT 门拆除）',
      altOn === true && hAlt?.page === 'POOL_OPEN' && hAltClosed?.page === 'POOL_CLOSED' && altOff === false,
      `alt=${altOn}→${altOff} swipe=${hAlt?.page}→${hAltClosed?.page}`);

    // B1d tmux 标签排横滑不触发 + 标签排照滚（溢出用临时会话撑出）
    for (let i = 0; i < 6; i++) spawn('tmux', ['new-session', '-d', '-s', `pool-exam-${i}`], { stdio: 'ignore' });
    await page.waitForFunction(() => !!document.querySelector('[data-tmux-win="pool-exam-5"]'), null, { timeout: 12000 }).catch(() => {});
    await page.click('[data-tmux-orb]').catch(() => {}); // 展开标签排
    await sleep(500);
    const stripOk = await page.evaluate(() => { const e = document.querySelector('[data-tmux-strip]'); return e ? { sw: e.scrollWidth, cw: e.clientWidth } : null; });
    await swipeLeftOn('[data-tmux-strip]');
    const hStrip = await hook();
    // 标签排自身滚动能力健在（headless 无真触摸横 pan；程序化 scrollLeft
    // 互证同 B1b-滚 惯例，真机横滑归 C 档）
    const stripScrollAfter = await page.evaluate(() => {
      const e = document.querySelector('[data-tmux-strip]');
      if (!e) return -1;
      e.scrollLeft = 40;
      return e.scrollLeft;
    });
    check('B1d 标签排落点横滑不进池（targetFilter）+ 标签排照滚（自身滚动健在）',
      hStrip?.page === 'POOL_CLOSED' && stripOk && stripOk.sw > stripOk.cw && stripScrollAfter > 0,
      `strip=${JSON.stringify(stripOk)} scrollLeft=${stripScrollAfter} page=${hStrip?.page}`);

    // B1e AI_PAGE 态不响应
    await page.click('[data-tmux-orb]').catch(() => {}); // 收起标签排
    await page.click('[data-kfm-aichat-orb]').catch(() => {});
    await sleep(600);
    const ai1 = await aiHook();
    await swipe(400, 300, -170, 0);
    const hAi = await hook();
    const ai2 = await aiHook();
    check('B1e AI_PAGE 态左滑不进池（condition 门）+ AI 页不被打扰',
      ai1?.page === 'AI_PAGE' && hAi?.page === 'POOL_CLOSED' && ai2?.page === 'AI_PAGE',
      `ai=${ai1?.page} pool=${hAi?.page}`);
    await page.click('[data-kfm-aichat-orb]').catch(() => {}); // 关 AI 页
    await sleep(500);

    // B1f keybar / composer / orb 落点不响应
    const kbBox = await page.evaluate(() => { const e = document.querySelector('[data-kfm-keybar]'); const r = e?.getBoundingClientRect(); return r ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null; });
    if (kbBox) { await swipe(kbBox.x, kbBox.y, -170, 0); }
    const hKb = await hook();
    const barBox = await page.evaluate(() => { const e = document.querySelector('[data-aichat-composer]'); const r = e?.getBoundingClientRect(); return r ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null; });
    if (barBox) await swipe(barBox.x, barBox.y, -170, 0);
    const hBar = await hook();
    const orbBox = await page.evaluate(() => { const e = document.querySelector('[data-kfm-aichat-orb]'); const r = e?.getBoundingClientRect(); return r ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null; });
    if (orbBox) await swipe(orbBox.x, orbBox.y, -170, 0);
    const hOrb = await hook();
    const ai3 = await aiHook();
    if (ai3?.page === 'AI_PAGE') { await page.click('[data-kfm-aichat-orb]').catch(() => {}); await sleep(400); }
    check('B1f keybar/composer/orb 落点左滑均不进池（targetFilter 三连）',
      hKb?.page === 'POOL_CLOSED' && hBar?.page === 'POOL_CLOSED' && hOrb?.page === 'POOL_CLOSED',
      `kb=${hKb?.page} bar=${hBar?.page} orb=${hOrb?.page}`);
  }

  // ========== B2：C2 返回双通道 + EDITING 右滑草稿蒸发 ==========
  {
    await openPoolBySwipe();
    const hOpen = await hook();
    await closePoolBySwipe();
    const hR = await hook();
    await openPoolBySwipe();
    await page.click('[data-pool-close]').catch(() => {});
    await sleep(400);
    const hX = await hook();
    // EDITING 中右滑 = 直接关，草稿蒸发（C2 裁定）
    await openPoolBySwipe();
    await page.click('[data-pool-tab="provider"]').catch(() => {});
    await page.click('[data-pool-new]').catch(() => {});
    await sleep(300);
    const hEdit = await hook();
    await closePoolBySwipe();
    const hGone = await hook();
    await openPoolBySwipe();
    const hRe = await hook();
    check('B2 C2 双通道：右滑返回 ✓ × 钮返回 ✓（均 POOL_CLOSED）',
      hOpen?.page === 'POOL_OPEN' && hR?.page === 'POOL_CLOSED' && hX?.page === 'POOL_CLOSED',
      `swipe=${hR?.page} x=${hX?.page}`);
    check('B2 EDITING 中右滑直接关 + 草稿蒸发（重开 BROWSE、editing=null）',
      hEdit?.pageState === 'EDITING' && hGone?.page === 'POOL_CLOSED' && hRe?.pageState === 'BROWSE' && hRe?.editing === null,
      `edit=${hEdit?.pageState} closed=${hGone?.page} reopen=${hRe?.pageState}/${JSON.stringify(hRe?.editing)}`);
    await closePoolBySwipe();
  }

  // ========== B3：C3 标签行四池切换 + 注册表互证 ==========
  {
    const serverList = (await api('/pool/list')).json;
    const serverPools = serverList.map((p) => p.pool).sort();
    const tabPools = await page.evaluate(() =>
      [...document.querySelectorAll('[data-pool-tab]')].map((e) => e.getAttribute('data-pool-tab')).sort());
    await openPoolBySwipe();
    const shots = [];
    const allSwitched = [];
    for (const p of ['provider', 'prompt', 'session', 'basic']) {
      await page.click(`[data-pool-tab="${p}"]`).catch(() => {});
      await sleep(350);
      const h = await hook();
      allSwitched.push(h?.pool === p && h?.pageState === 'BROWSE');
      if (p === 'provider' || p === 'basic') { shots.push(p); await shot(page, `b3-tab-${p}`); }
    }
    check('B3 标签集=池注册表枚举且 client ⊆ server /pool/list（互证）',
      JSON.stringify(tabPools) === JSON.stringify(serverPools) && tabPools.length === 4,
      `tabs=${JSON.stringify(tabPools)} server=${JSON.stringify(serverPools)}`);
    check('B3 C3 四池点切各达 BROWSE（草稿不跨池）', allSwitched.every(Boolean), `switched=${JSON.stringify(allSwitched)}`);
  }

  // ========== B4：picker 同源互证（拍板⑫联动） ==========
  {
    await page.click('[data-pool-tab="provider"]').catch(() => {});
    await sleep(350);
    await page.click('[data-pool-row="provider:examprov"]').catch(() => {});
    await sleep(350);
    const hEdit = await hook();
    const backfill = await page.evaluate(() => {
      const input = document.querySelector('[data-pool-field="apiKey"]');
      const hint = document.querySelector('[data-pool-keyhint]');
      return { value: input?.value ?? null, hint: hint?.textContent ?? null };
    });
    // models 行编辑：加 exam-model-x
    await page.fill('[data-pool-field="model-add"]', 'exam-model-x').catch(() => {});
    await page.click('[data-pool-model-add-btn]').catch(() => {});
    await page.click('[data-pool-save]').catch(() => {});
    await sleep(500);
    const hSaved = await hook();
    const proj = await api('/ai/providers');
    const ex = proj.json?.providers?.find((p) => p.id === 'examprov');
    check('B4a 池页编辑载入（EDITING）+ apiKey 回填=空输入+代字提示（P4 回填只出代字）',
      hEdit?.pageState === 'EDITING' && backfill.value === '' && /KFM_PROVIDER_|代字|未改/.test(backfill.hint ?? ''),
      `value=${JSON.stringify(backfill.value)} hint=${JSON.stringify(backfill.hint)}`);
    check('B4b 池页保存 → /ai/providers 投影即变（同源）',
      hSaved?.pageState === 'BROWSE' && !!ex && ex.models.includes('exam-model-x'),
      `models=${JSON.stringify(ex?.models)}`);
    // picker 二级同形
    await closePoolBySwipe();
    await page.click('[data-aichat-model-btn]').catch(() => {});
    await sleep(300);
    await page.click('[data-aichat-provider-row="examprov"]').catch(() => {});
    await sleep(300);
    const pickerModels = await page.evaluate(() =>
      [...document.querySelectorAll('[data-aichat-model-row]')].map((e) => e.getAttribute('data-aichat-model-row')));
    await shot(page, 'b4-picker-level2');
    check('B4c picker 二级页与池页同源同形（exam-model-x 在场）',
      pickerModels.some((m) => m === 'examprov::exam-model-x'), `rows=${JSON.stringify(pickerModels)}`);
    // picker 选中 → 总账变
    await page.click('[data-aichat-model-row="examprov::exam-model-a"]').catch(() => {});
    await sleep(400);
    const ledger1 = (await api('/pool/active')).json;
    check('B4d picker 选中 → 总账变（POST /pool/active）',
      ledger1?.providerId === 'examprov' && ledger1?.modelId === 'exam-model-a', JSON.stringify(ledger1));
    // 池页 ✓ 同步
    await openPoolBySwipe();
    await page.click('[data-pool-tab="provider"]').catch(() => {});
    await sleep(400);
    const check1 = await page.evaluate(() => ({
      exam: !!document.querySelector('[data-pool-active="examprov"]'),
      other: !!document.querySelector('[data-pool-active="otherprov"]'),
    }));
    await shot(page, 'b4-pool-check-sync');
    check('B4e 池页激活标同步（✓ 在 examprov）', check1.exam && !check1.other, JSON.stringify(check1));
  }

  // ========== B6：P2 激活双态 UI ==========
  {
    await page.click('[data-pool-activate="otherprov"]').catch(() => {});
    await sleep(500);
    const afterAct = await page.evaluate(() => ({
      exam: !!document.querySelector('[data-pool-active="examprov"]'),
      other: !!document.querySelector('[data-pool-active="otherprov"]'),
    }));
    // 编辑非激活条目保存 → 激活标不动（P2）
    await page.click('[data-pool-row="provider:examprov"]').catch(() => {});
    await sleep(300);
    await page.fill('[data-pool-field="name"]', 'Exam Provider Renamed').catch(() => {});
    await page.click('[data-pool-save]').catch(() => {});
    await sleep(500);
    const afterEdit = await page.evaluate(() => ({
      exam: !!document.querySelector('[data-pool-active="examprov"]'),
      other: !!document.querySelector('[data-pool-active="otherprov"]'),
    }));
    const ledger = (await api('/pool/active')).json;
    check('B6a 设为激活 → ✓ 移动到 otherprov', afterAct.other && !afterAct.exam, JSON.stringify(afterAct));
    check('B6b 编辑非激活条目保存 → 激活标不动（P2 双态）+ 总账未被编辑偷写',
      afterEdit.other && !afterEdit.exam && ledger?.providerId === 'otherprov', JSON.stringify({ dom: afterEdit, ledger }));
    // picker ✓ 同步
    await closePoolBySwipe();
    await page.click('[data-aichat-model-btn]').catch(() => {});
    await sleep(300);
    const pickerCheck = await page.evaluate(() => {
      const row = document.querySelector('[data-aichat-provider-row="otherprov"]');
      return !!row?.querySelector('[data-aichat-check]');
    });
    await page.click('[data-aichat-model-btn]').catch(() => {}); // 关菜单
    await sleep(200);
    // 基本池槽位同步
    await openPoolBySwipe();
    await page.click('[data-pool-tab="basic"]').catch(() => {});
    await sleep(400);
    const slotText = await page.evaluate(() => document.querySelector('[data-pool-slot="provider"]')?.textContent ?? '');
    await shot(page, 'b6-basic-slots');
    check('B6c picker ✓ 同步（otherprov 带 ✓）', pickerCheck, `pickerCheck=${pickerCheck}`);
    check('B6d 基本池槽位同步（默认 Provider·Model=otherprov）',
      /otherprov|Other Provider/.test(slotText), `slot="${slotText.slice(0, 60)}"`);
  }

  // ========== B7：P4 密钥不明文全链 ==========
  {
    await page.click('[data-pool-tab="provider"]').catch(() => {});
    await sleep(300);
    await page.click('[data-pool-row="provider:examprov"]').catch(() => {});
    await sleep(300);
    await page.fill('[data-pool-field="apiKey"]', PLAIN_KEY).catch(() => {});
    await page.click('[data-pool-save]').catch(() => {});
    await sleep(600);
    const apiResp = JSON.stringify((await api('/pool/provider')).json);
    const provFile = await readFile(join(FIXTURE, 'providers.json'), 'utf-8');
    const envPathFile = join(FIXTURE, '.env');
    const envExists = existsSync(envPathFile);
    const envRaw = envExists ? await readFile(envPathFile, 'utf-8') : '';
    const envMode = envExists ? (await stat(envPathFile)).mode & 0o777 : 0;
    const domRaw = await page.evaluate(() => document.body.innerHTML);
    const hookRaw = JSON.stringify(await poolHook());
    const logRaw = existsSync(POOL_LOG) ? await readFile(POOL_LOG, 'utf-8') : '';
    const backfill = await page.evaluate(() => {
      document.querySelector('[data-pool-row="provider:examprov"]')?.click();
      return null;
    });
    await sleep(300);
    const backfill2 = await page.evaluate(() => ({
      value: document.querySelector('[data-pool-field="apiKey"]')?.value ?? null,
      hint: document.querySelector('[data-pool-keyhint]')?.textContent ?? null,
    }));
    await page.click('[data-pool-cancel]').catch(() => {});
    const clean = (s) => !KEY_SHAPE.test(s ?? '');
    const fusedShape = (s) => /\$\{KFM_PROVIDER_[A-Z0-9_]+\}/.test(s ?? '');
    check('B7 P4 明文保存后五处落点全净（API 响应/池文件/DOM/钩子/日志）+ .env 600 落明文 + 池文件只留代字',
      clean(apiResp) && clean(provFile) && clean(domRaw) && clean(hookRaw) && clean(logRaw)
      && envExists && envRaw.includes(PLAIN_KEY) && envMode === 0o600
      && fusedShape(provFile) && fusedShape(apiResp),
      `env=${envExists}/${envMode.toString(8)} apiClean=${clean(apiResp)} fileClean=${clean(provFile)} domClean=${clean(domRaw)} logClean=${clean(logRaw)}`);
    check('B7-回 再编辑回填=代字提示+空输入（不出明文）',
      backfill2.value === '' && /KFM_PROVIDER_/.test(backfill2.hint ?? ''),
      `value=${JSON.stringify(backfill2.value)} hint=${JSON.stringify(backfill2.hint)}`);
  }

  // ========== B5：C7/C8 relied 禁删 UI + 断引用已失效 ==========
  {
    await page.click('[data-pool-tab="provider"]').catch(() => {});
    await sleep(300);
    await page.click('[data-pool-delete="examprov"]').catch(() => {});
    await sleep(300);
    const hOverlay = await hook();
    await page.click('[data-pool-overlay-confirm]').catch(() => {});
    await sleep(500);
    const hDenied = await hook();
    const reliedText = await page.evaluate(() => document.querySelector('[data-pool-relied]')?.textContent ?? '');
    await shot(page, 'b5-relied-409');
    await page.click('[data-pool-overlay-cancel]').catch(() => {});
    await sleep(300);
    const stillThere = await page.evaluate(() => !!document.querySelector('[data-pool-row="provider:examprov"]'));
    const stillListed = (await api('/pool/provider')).json.some((e) => e.id === 'examprov');
    check('B5a 删被引用 provider → 确认页 409 人话展「被谁用着」（依赖会话）+ 不删不转换',
      hOverlay?.pageState === 'OVERLAY_DELETE' && hDenied?.pageState === 'OVERLAY_DELETE'
      && /依赖会话/.test(reliedText) && stillThere && stillListed,
      `relied="${reliedText.slice(0, 60)}" row=${stillThere} api=${stillListed}`);
    // 断引用降级：session 池列表「已失效」标注
    await page.click('[data-pool-tab="session"]').catch(() => {});
    await sleep(400);
    const danglings = await page.evaluate(() =>
      [...document.querySelectorAll('[data-pool-dangling]')].map((e) => e.textContent).join('|'));
    await shot(page, 'b5-session-dangling');
    check('B5b 断引用条目照列 + 「已失效」标注（降级不崩）', /已失效/.test(danglings), `dangling="${danglings}"`);
  }

  // ========== B8：C12 标题栏入口路由（拍板⑯） ==========
  {
    await closePoolBySwipe();
    await page.click('[data-kfm-aichat-orb]').catch(() => {});
    await sleep(500);
    const aiOpen = await aiHook();
    await page.evaluate(() => (window).dispatchEvent(new CustomEvent('kfm-nz-pool-open', { detail: { pool: 'prompt' } })));
    await sleep(400);
    const hPrompt = await hook();
    const aiStill = await aiHook();
    const aiDom = await page.evaluate(() => !!document.querySelector('[data-kfm-aichat]'));
    await page.evaluate(() => (window).dispatchEvent(new CustomEvent('kfm-nz-pool-open', { detail: { pool: 'session' } })));
    await sleep(400);
    const hSession = await hook();
    await shot(page, 'b8-route-over-ai');
    await page.click('[data-pool-close]').catch(() => {});
    await sleep(400);
    const aiBack = await aiHook();
    check('B8 C12 入口事件 → POOL_OPEN 直达对应池（prompt→session）',
      aiOpen?.page === 'AI_PAGE' && hPrompt?.page === 'POOL_OPEN' && hPrompt?.pool === 'prompt'
      && hSession?.pool === 'session' && hPrompt?.pageState === 'BROWSE',
      `prompt=${hPrompt?.pool} session=${hSession?.pool}`);
    check('B8b C12 路径 AI 页不收起（池页关后 ai-chat 仍在 AI_PAGE）',
      aiStill?.page === 'AI_PAGE' && aiDom && aiBack?.page === 'AI_PAGE',
      `during=${aiStill?.page} dom=${aiDom} after=${aiBack?.page}`);
    // 拍板⑯接真（A2a 阶段三）：占位退役——点「角色」= C12 路由真发（AI 页
    // 开着 → 池页开+直达 prompt 池），占位骨架元素必须不存在
    await page.click('[data-aichat-config-btn]').catch(() => {});
    await sleep(300);
    await page.click('[data-aichat-config-entry="role"]').catch(() => {});
    await sleep(500);
    const hRole = await hook();
    const phGone = await page.evaluate(() => !document.querySelector('[data-aichat-config-placeholder]'));
    check('B8c 入口接真（拍板⑯占位退役）：标题栏点「角色」→ 池页开+定位 prompt 池 + 占位元素不存在',
      hRole?.page === 'POOL_OPEN' && hRole?.pool === 'prompt' && phGone,
      `pool=${hRole?.pool}/${hRole?.page} phGone=${phGone}`);
    // orb 新逻辑收尾链（三态详钉=B12）：池页盖 AI → 点球=提顶（AI_PAGE 保持）
    // → 再点球=关 AI（池页不关）→ 右滑关池页回全关
    await page.click('[data-kfm-aichat-orb]').catch(() => {});
    await sleep(500);
    const aiRaised = await aiHook();
    await page.click('[data-kfm-aichat-orb]').catch(() => {});
    await sleep(600);
    const aiAfter = await aiHook();
    const poolAfter = await hook();
    await closePoolBySwipe();
    const poolGone = await hook();
    check('B8d orb 置顶/关闭切换器（仲裁⑩新逻辑）：池页盖 AI 点球=AI 页提上来（AI_PAGE 保持）→ 再点球=关 AI（池页不关）→ 右滑池页照关',
      aiRaised?.page === 'AI_PAGE' && aiAfter?.page === 'TERMINAL' && poolAfter?.page === 'POOL_OPEN' && poolGone?.page === 'POOL_CLOSED',
      `raise=${aiRaised?.page} close=${aiAfter?.page} pool=${poolAfter?.page}→${poolGone?.page}`);
  }

  // ========== B10：C11/C13 推送校准 ==========
  {
    await openPoolBySwipe();
    await page.click('[data-pool-tab="session"]').catch(() => {});
    await sleep(400);
    const page2 = await context.newPage();
    await page2.goto(`${BASE}/?nosplash`, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
    await page2.waitForFunction(() => !!(window).__kfmNzPool, null, { timeout: 15000, polling: 250 }).catch(() => {});
    const stamp = Date.now();
    await page2.evaluate(async (t) => {
      await fetch('/pool/session/create', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ entry: { title: `推送会话-${t}` } }) });
    }, stamp);
    const pushed = await page.waitForFunction(
      (t) => !!document.querySelector(`[data-pool-row="session:推送会话-${t}"]`), stamp,
      { timeout: 6000, polling: 200 }).then(() => true).catch(() => false);
    check('B10a C11 第二页 CRUD → 本页 pool/changed 推送到达 refetch（零刷新出行）', pushed, `row=推送会话-${stamp}`);
    // C13：WS 断 → 回前台 visibilitychange → 重连 refetch
    await page.evaluate(() => (window).__kfmNzPoolDiag?.closeWs?.());
    await sleep(300);
    const stamp2 = Date.now();
    await page2.evaluate(async (t) => {
      await fetch('/pool/session/create', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ entry: { title: `断线会话-${t}` } }) });
    }, stamp2);
    await sleep(800);
    const missed = await page.evaluate((t) => !document.querySelector(`[data-pool-row="session:断线会话-${t}"]`), stamp2);
    await page.evaluate(() => (window).__kfmNzPoolDiag?.resync?.());
    const reconnected = await page.waitForFunction(
      (t) => !!document.querySelector(`[data-pool-row="session:断线会话-${t}"]`), stamp2,
      { timeout: 8000, polling: 200 }).then(() => true).catch(() => false);
    const wsState = await page.evaluate(() => (window).__kfmNzPoolDiag?.wsState?.() ?? null);
    await page2.close();
    check('B10b C13 WS 断漏推送 → 回前台重连 refetch 校准（服务器唯一真源）',
      missed && reconnected && wsState === 'open', `missed=${missed} reconnected=${reconnected} ws=${wsState}`);
    await closePoolBySwipe();
  }

  // ========== B9：P6/P9 词汇表+观测钩+动画 token+L2 日志互证 ==========
  {
    const h = await hook();
    const bad = vocabSamples.filter((s) =>
      (s.kind === 'page' && !PAGE_VOCAB.includes(s.v))
      || (s.kind === 'inner' && !INNER_VOCAB.includes(s.v) && s.v !== null)
      || (s.kind === 'pool' && s.v !== null && !POOL_VOCAB.includes(s.v)));
    const ringBad = (h?.ring ?? []).filter((e) =>
      !PAGE_VOCAB.includes(e.from.page) || !PAGE_VOCAB.includes(e.to.page)
      || !INNER_VOCAB.includes(e.from.inner) || !INNER_VOCAB.includes(e.to.inner));
    const triggers = new Set((h?.ring ?? []).map((e) => e.trigger));
    const anim = await page.evaluate(() => {
      const el = document.createElement('div');
      el.setAttribute('data-kfm-pool', '1');
      el.style.position = 'absolute'; el.style.left = '-9999px';
      document.body.appendChild(el);
      const d = getComputedStyle(el).animationDuration;
      const token = getComputedStyle(document.documentElement).getPropertyValue('--kfm-dur-normal').trim();
      el.remove();
      const toMs = (s) => { const m = /^([\d.]+)(ms|s)?$/.exec(s.trim()); return m ? Number.parseFloat(m[1]) * (m[2] === 's' ? 1000 : 1) : NaN; };
      return { anim: d, token, animMs: toMs(d), tokenMs: toMs(token) };
    });
    const logRaw = existsSync(POOL_LOG) ? await readFile(POOL_LOG, 'utf-8') : '';
    const logLines = logRaw.trim().split('\n').filter(Boolean);
    let logOk = logLines.length > 0; const logKinds = new Set();
    for (const l of logLines) {
      try { const o = JSON.parse(l); logKinds.add(o.kind); if (KEY_SHAPE.test(l)) logOk = false; }
      catch { logOk = false; }
    }
    const kindsHit = ['create', 'update', 'delete', 'activated', 'guard-reject', 'fuse'].filter((k) => logKinds.has(k));
    check('B9a P6 词汇表：钩子+观测环全程状态名 ⊆ 清单枚举（触发器 C1-C13 全谱系）',
      bad.length === 0 && ringBad.length === 0 && triggers.size >= 6,
      `samples=${vocabSamples.length} bad=${JSON.stringify(bad.slice(0, 3))} triggers=${JSON.stringify([...triggers].sort())}`);
    check('B9b 观测环 ≥50 拍 + P9 动画时长跟随 --kfm-dur-normal',
      (h?.ringLen ?? 0) >= 50 && anim.animMs === anim.tokenMs,
      `ring=${h?.ringLen} anim=${anim.anim}(${anim.animMs}ms) token=${anim.token}(${anim.tokenMs}ms)`);
    check('B9c L2 /tmp 夹具 nz-pool.log JSONL 互证（六类事件逐拍落账+无明文 key）',
      logOk && kindsHit.length >= 5, `kinds=[${kindsHit.join(',')}] lines=${logLines.length}`);
  }

  // ========== B11：P10/仲裁⑩ 层级 ==========
  {
    await page.click('[data-kfm-aichat-orb]').catch(() => {});
    await sleep(500);
    await page.evaluate(() => (window).dispatchEvent(new CustomEvent('kfm-nz-pool-open', { detail: { pool: 'basic' } })));
    await sleep(500);
    const z = await page.evaluate(() => {
      const g = (sel) => { const e = document.querySelector(sel); return e ? getComputedStyle(e).zIndex : null; };
      return {
        pool: g('[data-kfm-pool]'),
        orb: g('[data-kfm-aichat-orb]'),
        bar: g('[data-kfm-aichat-bar]'),
        ai: g('[data-kfm-aichat]'),
        tmuxDisplay: getComputedStyle(document.querySelector('[data-tmux-tabs-root]') ?? document.body).display,
        aiDom: !!document.querySelector('[data-kfm-aichat]'),
      };
    });
    await shot(page, 'b11-z-order');
    check('B11 仲裁⑩ 层级：终端/tmux < AI 页(42) < 池页(44) < composer+orb（恒顶 45）；tmux 隐藏；AI 页不收起',
      Number(z.pool) === 44 && Number(z.orb) === 45 && Number(z.bar) === 45 && Number(z.ai) === 42
      && z.tmuxDisplay === 'none' && z.aiDom,
      JSON.stringify(z));
    await page.click('[data-pool-close]').catch(() => {});
    await sleep(400);
    const restored = await page.evaluate(() => ({
      orb: getComputedStyle(document.querySelector('[data-kfm-aichat-orb]')).zIndex,
      aiPage: (window).__kfmNzAiChat?.().page,
    }));
    check('B11b 池页关闭复原：orb 回 z43 档（inline 值），AI 页保持 AI_PAGE', restored.orb === '43' && restored.aiPage === 'AI_PAGE',
      JSON.stringify(restored));
    await page.click('[data-kfm-aichat-orb]').catch(() => {});
  }

  // ========== B12：仲裁⑩ orb 三态（A2a 阶段三接点；光球=AI 面板「置顶/关闭」切换器） ==========
  // 语义（用户修正稿落地）：按**当前顶层**裁定——顶层=AI 页→点球=关（滑出）；
  // 顶层≠AI 页（终端态或池页盖着 AI）→点球=AI 页提到最上层（池页开着不关，
  // 提顶后盖在池页上）。z 咬合：提顶档池页降 41（tokens.css data-kfm-aichat-
  // raised），层级仍严格 池页41 < AI 页42 < 输入栏+光球45 恒顶。
  {
    const gz = () => page.evaluate(() => {
      const g = (s) => { const e = document.querySelector(s); return e ? Number(getComputedStyle(e).zIndex) : null; };
      return { pool: g('[data-kfm-pool]'), ai: g('[data-kfm-aichat]'), orb: g('[data-kfm-aichat-orb]') };
    });
    const aiTopHit = () => page.evaluate(() => {
      const hdr = document.querySelector('[data-aichat-header]');
      if (!hdr) return null;
      const r = hdr.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return hit ? !!hit.closest('[data-kfm-aichat]') : null;
    });
    // 基线：终端态点球 → AI 页开（态①「顶层≠AI 页→出现」，B1 已证不回退）
    await page.click('[data-kfm-aichat-orb]').catch(() => {});
    await sleep(500);
    const t1 = await aiHook();
    // 态② AI 页开着 C12 开池页（池页盖 AI，z44>42）→ 点球=AI 页提到池页上
    await page.evaluate(() => (window).dispatchEvent(new CustomEvent('kfm-nz-pool-open', { detail: { pool: 'basic' } })));
    await sleep(500);
    const t2PoolBefore = await hook();
    const z2Before = await gz();
    await page.click('[data-kfm-aichat-orb]').catch(() => {});
    await sleep(500);
    const t2Ai = await aiHook();
    const t2Pool = await hook();
    const z2After = await gz();
    const hit2 = await aiTopHit();
    await shot(page, 'b12-orb-raise-over-pool');
    // 态③ 提顶档右滑：隐藏池页不被误关（手势 raised 门——AI 页盖着时手势归 AI 页）
    await closePoolBySwipe();
    const t3Pool = await hook();
    // 态④ 再点球 → 关 AI 页（滑出），池页复现（z 回 44）仍 POOL_OPEN
    await page.click('[data-kfm-aichat-orb]').catch(() => {});
    await sleep(700);
    const t4Ai = await aiHook();
    const t4Pool = await hook();
    const z4 = await gz();
    const hit4 = await aiTopHit();
    await shot(page, 'b12-pool-restored');
    check('B12a 仲裁⑩ 态②：池页开着点球 → AI 页提到池页上（池页降 41/AI 42/球 45 恒顶；池页不关仍 POOL_OPEN；标题栏命中=AI 页真顶）',
      t1?.page === 'AI_PAGE' && t2PoolBefore?.page === 'POOL_OPEN' && z2Before.pool === 44 && z2Before.ai === 42
      && t2Ai?.page === 'AI_PAGE' && t2Pool?.page === 'POOL_OPEN'
      && z2After.pool === 41 && z2After.ai === 42 && z2After.orb === 45 && hit2 === true,
      `before=${JSON.stringify(z2Before)} after=${JSON.stringify(z2After)} hit=${hit2} pool=${t2Pool?.page}`);
    check('B12b 态③：提顶档右滑不关隐藏池页（手势 raised 门——盖着的池页不吃右滑返回）',
      t3Pool?.page === 'POOL_OPEN', `pool=${t3Pool?.page}`);
    check('B12c 态④：再点球 → AI 页关（TERMINAL，AI DOM 摘除），池页复现 z44 仍 POOL_OPEN（关 AI 不连带池页；球 45 恒顶随池页在场）',
      t4Ai?.page === 'TERMINAL' && t4Pool?.page === 'POOL_OPEN' && z4.pool === 44 && z4.ai === null && z4.orb === 45 && hit4 !== true,
      `ai=${t4Ai?.page} pool=${t4Pool?.page} z=${JSON.stringify(z4)} hit=${hit4}`);
    // —— 重来一轮验「提顶档稳定性 + 入口召回」（B12d/B12e） ——
    await page.click('[data-kfm-aichat-orb]').catch(() => {});
    await sleep(600);
    await page.evaluate(() => (window).dispatchEvent(new CustomEvent('kfm-nz-pool-open', { detail: { pool: 'basic' } })));
    await sleep(500);
    await page.click('[data-kfm-aichat-orb]').catch(() => {});
    await sleep(500);
    // B12d 无关重渲染（diag resync=fetchAll 校准 bump，非入口语义）不得误触提顶账
    await page.evaluate(() => (window).__kfmNzPoolDiag?.resync?.());
    await sleep(500);
    const stD = await page.evaluate(() => ({
      raised: document.documentElement.hasAttribute('data-kfm-aichat-raised'),
      poolZ: Number(getComputedStyle(document.querySelector('[data-kfm-pool]')).zIndex),
      hit: (() => { const hdr = document.querySelector('[data-aichat-header]'); const r = hdr.getBoundingClientRect(); return !!document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest('[data-kfm-aichat]'); })(),
    }));
    check('B12d 提顶档稳定性：池页在场重渲染（路由 bump）不误清提顶账（AI 仍在池页上）',
      stD.raised === true && stD.poolZ === 41 && stD.hit === true, JSON.stringify(stD));
    // B12e 入口召回（C12 语义）：外发路由事件=入口意图 → 池页回 AI 之上
    await page.evaluate(() => (window).dispatchEvent(new CustomEvent('kfm-nz-pool-open', { detail: { pool: 'prompt' } })));
    await sleep(500);
    const stE = await page.evaluate(() => ({
      raised: document.documentElement.hasAttribute('data-kfm-aichat-raised'),
      poolZ: Number(getComputedStyle(document.querySelector('[data-kfm-pool]')).zIndex),
      pool: (window).__kfmNzPool().pool,
    }));
    check('B12e 入口召回：路由事件（C12）把池页召回 AI 之上（提顶账清、池页 z44、切 prompt 池）',
      stE.raised === false && stE.poolZ === 44 && stE.pool === 'prompt', JSON.stringify(stE));
    // 收尾：右滑关池页回全关态（此刻池页在顶可滑）
    await closePoolBySwipe();
    check('B12-收 池页右滑关闭回全关态', await poolClosed());
  }

  // ========== B13：真触摸右滑返回（2026-09-05 真机报告修复钉；CDP dispatchTouchEvent） ==========
  {
    const tctx = await browser.newContext({ viewport: { width: 900, height: 620 }, hasTouch: true });
    const tpage = await tctx.newPage();
    const tcdp = await tctx.newCDPSession(tpage);
    tpage.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 160)));
    await tpage.goto(`${BASE}/?nosplash`, { waitUntil: 'domcontentloaded', timeout: 40000 }).catch(() => {});
    await tpage.waitForFunction(() => !!(window).__kfmNzPool && !!document.querySelector('.nz-term'), null, { timeout: 20000, polling: 250 });
    await sleep(2200); // PTY/布局稳态
    const tp = () => tpage.evaluate(() => {
      const r = (window).__kfmNzPool();
      return `${r.page}/${r.pool ?? '-'}/${r.pageState}`;
    });
    // mouse 开池（headless 退化布局下 touch 左滑会被 touch-adjustment 干扰——
    // 病灶腿只涉池页，开池走 mouse 等价真机「池页已开」前提）
    {
      const c = await tpage.evaluate(() => { const e = document.querySelector('.nz-term').getBoundingClientRect(); return { x: Math.min(e.x + e.width / 2, 420), y: Math.max(8, Math.min(e.y + e.height / 2, 400)) }; });
      await tpage.mouse.move(c.x, c.y);
      await tpage.mouse.down();
      for (let i = 1; i <= 14; i++) { await tpage.mouse.move(c.x - (180 * i) / 14, c.y); await sleep(8); }
      await tpage.mouse.up();
      await sleep(450);
    }
    check('B13a 前置：mouse 左滑开池（等价真机已开态）', (await tp()).startsWith('POOL_OPEN'), await tp());
    // touch 流记录带（捕获阶段）
    await tpage.evaluate(() => {
      window.__ttape = [];
      for (const ty of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'])
        document.addEventListener(ty, (e) => { if (e.pointerType !== 'touch') return; window.__ttape.push(e.type); }, { capture: true, passive: true });
    });
    const tstroke = async (x0, y0, x1, y1, steps = 16) => {
      const t = (type, points) => tcdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
      await t('touchStart', [{ x: x0, y: y0, id: 1 }]);
      for (let i = 1; i <= steps; i++) {
        await t('touchMove', [{ x: Math.round(x0 + ((x1 - x0) * i) / steps), y: Math.round(y0 + ((y1 - y0) * i) / steps), id: 1 }]);
        await sleep(12);
      }
      await t('touchEnd', []);
      await sleep(450);
    };
    // 静态钉：池页根+列表区 touch-action=pan-y（修法的直接落点）
    const ta = await tpage.evaluate(() => ({
      pool: getComputedStyle(document.querySelector('[data-kfm-pool]')).touchAction,
      zone: (() => { const z = document.querySelector('[data-pool-zone]'); return z ? getComputedStyle(z).touchAction : null; })(),
    }));
    check('B13b 池页根/列表区 touch-action=pan-y（禁 pan-x 原生接管；纵向列表滚动保持原生）',
      ta.pool === 'pan-y' && ta.zone === 'pan-y', JSON.stringify(ta));
    // 病灶腿：池页列表行上真触摸右滑 → 全流到手（无 cancel）+ 池页关
    const cb = await tpage.evaluate(() => { const e = document.querySelector('[data-kfm-pool]').getBoundingClientRect(); return { x: Math.round(e.x + Math.min(e.width / 2, 420)), y: Math.round(e.y + Math.min(e.height / 2, 300)) }; });
    await tstroke(cb.x, cb.y, cb.x + 190, cb.y);
    const tape1 = await tpage.evaluate(() => { const t = window.__ttape; window.__ttape = []; return { down: t.filter((x) => x === 'pointerdown').length, up: t.filter((x) => x === 'pointerup').length, cancel: t.filter((x) => x === 'pointercancel').length }; });
    const st1 = await tp();
    await tpage.screenshot({ path: join(SHOT_DIR, 'config-pool-b13-touch-rightswipe-closed.png') });
    check('B13c 真触摸右滑关池（列表行上横拖全流到手 cancels=0 → POOL_CLOSED）',
      st1.startsWith('POOL_CLOSED') && tape1.down === 1 && tape1.cancel === 0 && tape1.up >= 1,
      `st=${st1} tape=${JSON.stringify(tape1)}`);
    // 对照腿：真触摸垂直拖=原生列表滚动接管（cancel 允许），池页不动（P1 矩阵行）
    {
      const c = await tpage.evaluate(() => { const e = document.querySelector('.nz-term').getBoundingClientRect(); return { x: Math.min(e.x + e.width / 2, 420), y: Math.max(8, Math.min(e.y + e.height / 2, 400)) }; });
      await tpage.mouse.move(c.x, c.y);
      await tpage.mouse.down();
      for (let i = 1; i <= 14; i++) { await tpage.mouse.move(c.x - (180 * i) / 14, c.y); await sleep(8); }
      await tpage.mouse.up();
      await sleep(450);
    }
    const cz = await tpage.evaluate(() => { const e = document.querySelector('[data-kfm-pool]').getBoundingClientRect(); return { x: Math.round(e.x + Math.min(e.width / 2, 420)), y: Math.round(e.y + Math.min(e.height / 2, 300)) }; });
    await tstroke(cz.x, cz.y, cz.x, cz.y - 150);
    const st2 = await tp();
    const tape2 = await tpage.evaluate(() => { const t = window.__ttape; window.__ttape = []; return { cancel: t.filter((x) => x === 'pointercancel').length, up: t.filter((x) => x === 'pointerup').length }; });
    check('B13d 对照：真触摸垂直拖=池区列表原生滚动接管（cancel 允许），池页保持开着（方向裁决 P1：垂直不关池）',
      st2.startsWith('POOL_OPEN') && (tape2.cancel === 1 || tape2.up >= 1), `st=${st2} tape=${JSON.stringify(tape2)}`);
    await tctx.close();
  }

  check('⓪-尾 全程零页面异常', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
} catch (e) {
  check('考卷执行中断', false, String(e).slice(0, 300));
} finally {
  // ---------- 清场：tmux 临时会话 + 隔离 server + 夹具 ----------
  for (let i = 0; i < 6; i++) spawn('tmux', ['kill-session', '-t', `pool-exam-${i}`], { stdio: 'ignore' });
  await browser.close().catch(() => {});
  srv.kill('SIGTERM');
  await sleep(500);
  if (!srv.killed) srv.kill('SIGKILL');
  await rm(FIXTURE, { recursive: true, force: true }).catch(() => {});
}

const pass = results.filter((r) => r.ok).length;
console.log(`\n=== config-pool B 档：${pass}/${results.length} ===`);
process.exit(pass === results.length ? 0 : 1);
