/**
 * config-pool-c-device.mjs — 配置池 A2a 阶段三 C 档真机验收（L3，8026 CDP attach）
 *
 * 验收面（设计 docs/config-pool-a2a-design.md §五 C 档 + §九 阶段三增补）：
 *   C1 左滑进池（真触点手势）+ basic 只读槽位
 *   C2 fuse 抽查：scratch provider 存明文假 key → providers.json 只留代字 +
 *      .env 600（真 key 不碰：假 key，收尾 .env 逐字节复原）
 *   C3 激活闭环：池页设为激活 智谱 → picker ✓ 同步 → 不经 picker 选择发一条
 *      → /tmp/nz-ai-chat.log start 记录 provider=智谱（L2 互证）
 *   C4 标题栏入口定位：点「会话」→ session 池（role 组 2026-09-07 退役）
 *   C5 orb 三态（仲裁⑩）：池页盖 AI 点球=AI 页提上来（池页不关）→再点球=
 *      关 AI（池页复现）→右滑关池页
 *   三池 CRUD 一轮（provider 表单+409 relied 守卫 UI / session 壳；prompt 池退役）
 *
 * 纪律（AGENTS.md L3 + cdp-device.mjs 先例）：
 *   · localhost:8026 直连（8026 只听 ::1），按 attached:true 精确选 live 目标，
 *     禁 /json/new，勿导航（reload 仅在 bundle 落后时触发一次=热更链同款）；
 *   · 触点全走 Input.dispatchTouchEvent（真触摸→pointer 事件链），表单文本
 *     经原生 setter 注入（输入机制程序化，写路径仍全走真机 UI 保存钮）；
 *   · 状态复原铁证：active.json / .env 考前逐字节存档 md5，考后复原复验
 *     md5 相等；scratch 条目全数删除，/pool/* 计数对账。
 *
 * 跑法：node tests/browser/config-pool-c-device.mjs（8023 dev 起新码+真机前台）。
 * 截图存证：tests/assets/config-pool-c-*.png。
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const SHOT_DIR = join(process.cwd(), 'tests', 'assets');
const KFM_DIR = process.env.NZ_AI_CONFIG_DIR || join(homedir(), '.kfmv4');
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok }); console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`); };

// ---------- CDP 连live目标（cdp-device.mjs 同款纪律：localhost 连 relay） ----------
const listJson = async () => {
  for (let i = 0; i < 5; i++) {
    try {
      return await Promise.race([
        fetch('http://localhost:8026/json/list').then((r) => r.json()),
        sleep(8000).then(() => { throw new Error('list timeout'); }),
      ]);
    } catch (e) { console.log(`[cdp] list 重试 ${i + 1}/5: ${String(e).slice(0, 60)}`); await sleep(2000); }
  }
  throw new Error('8026 json/list 不可达');
};
const list = await listJson();
const live = list.find((t) => t.description.includes('"attached":true'));
if (!live) { console.error('❌ 无 attached live 目标（真机没开页？）'); process.exit(2); }
const ws = new WebSocket(live.webSocketDebuggerUrl);
let idc = 0;
const pending = new Map();
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const { resolve, reject } = pending.get(m.id);
    pending.delete(m.id);
    m.error ? reject(new Error(m.error.message)) : resolve(m.result);
  }
});
await new Promise((r) => ws.addEventListener('open', r));
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++idc;
  pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params }));
});
const evalRaw = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error('eval ex: ' + (r.exceptionDetails.exception?.description ?? r.exceptionDetails.text ?? '?').split('\n')[0]);
  return r.result?.value;
};
const shot = async (name) => {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  const p = join(SHOT_DIR, `config-pool-c-${name}.png`);
  writeFileSync(p, Buffer.from(r.data, 'base64'));
  console.log('shot:', p);
  return p;
};

// ---------- 真触点（touch → pointer 链） ----------
const touch = async (type, points) => { await send('Input.dispatchTouchEvent', { type, touchPoints: points }); };
const tap = async (x, y) => {
  await touch('touchStart', [{ x, y }]);
  await touch('touchEnd', []);
};
const swipe = async (x1, y1, x2, y2, steps = 12) => {
  await touch('touchStart', [{ x: x1, y: y1 }]);
  for (let i = 1; i <= steps; i++) {
    await touch('touchMove', [{ x: x1 + ((x2 - x1) * i) / steps, y: y1 + ((y2 - y1) * i) / steps }]);
  }
  await touch('touchEnd', []);
};

// ---------- 钩子/元素助手 ----------
const poolHook = () => evalRaw(`(() => { const f = window.__kfmNzPool; if (!f) return null; const r = f(); return { page: r.page, pool: r.pool, pageState: r.pageState, active: r.active, editing: r.editing }; })()`);
const aiHook = () => evalRaw(`(() => { const f = window.__kfmNzAiChat; if (!f) return null; const r = f(); return { page: r.page, menu: r.menu, phase: r.run?.phase ?? null, selection: undefined }; })()`);
const attrRaised = () => evalRaw(`document.documentElement.hasAttribute('data-kfm-aichat-raised')`);
/** 元素中心坐标（可见才返回） */
const center = async (sel) => evalRaw(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return null; const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return hit && hit.closest(${JSON.stringify(sel)}) !== null ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : { x: r.x + r.width / 2, y: r.y + r.height / 2, blocked: true }; })()`);
const tapSel = async (sel, label = sel) => {
  // 窄屏适配：目标可能在滚动容器视口外（如池页标签行 overflowX）——先滚到眼前再量坐标
  await evalRaw(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return false; const r = e.getBoundingClientRect(); if (r.x < 0 || r.y < 0 || r.x + r.width > window.innerWidth || r.y + r.height > window.innerHeight) e.scrollIntoView({ block: 'nearest', inline: 'center' }); return true; })()`);
  await sleep(200);
  const c = await center(sel);
  if (!c) { console.log(`[tap] ${label}: 元素不可见/缺位`); return false; }
  if (c.blocked) console.log(`[tap] ${label}: 命中点被其他层接住（仍尝试触点）`);
  await tap(c.x, c.y);
  await sleep(350);
  return true;
};
/** 表单文本：原生 setter + input 事件（React 受控输入） */
const fillField = async (dataX, text) => evalRaw(`(() => {
  const e = document.querySelector('[data-pool-field="${dataX}"]');
  if (!e) return false;
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(e, ${JSON.stringify(text)});
  e.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
})()`);

const api = async (path, body) => {
  const r = await fetch(`http://127.0.0.1:8023${path}`, body === undefined ? {} : {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  return { status: r.status, json: await r.json().catch(() => null) };
};

// ---------- 考前存档（复原铁证） ----------
const activePath = join(KFM_DIR, 'active.json');
const envPath = join(KFM_DIR, '.env');
const md5 = (b) => createHash('md5').update(b).digest('hex');
let activeBefore = null, envBefore = null, envModeBefore = null;
try { activeBefore = readFileSync(activePath); } catch { /* 无账文件 */ }
try { envBefore = readFileSync(envPath); envModeBefore = statSync(envPath).mode & 0o777; } catch { /* 无 .env */ }
console.log(`[exam] active.json md5=${activeBefore ? md5(activeBefore) : '∅'} env md5=${envBefore ? md5(envBefore) : '∅'} envMode=${envModeBefore?.toString(8)}`);
const pools0 = (await api('/pool/list')).json;
console.log('[exam] 考前池计数:', JSON.stringify(pools0));

const SCRATCH = 'c3exam临考';
const FAKE_KEY = 'sk-c3-fake-key-000111';
let zhipu = null;

try {
  // ========== ⓪ 环境：钩子在场 + 新 bundle + 前台可截屏 ==========
  const env0 = await evalRaw(`({ pool: !!window.__kfmNzPool, ai: !!window.__kfmNzAiChat, build: window.KFM_NZ_BUILD_TIME ?? null, vw: window.innerWidth, vh: window.innerHeight })`);
  const buildInfo = JSON.parse(readFileSync(join(process.cwd(), 'public', 'build-info.json'), 'utf-8'));
  if (!env0.pool || env0.build !== buildInfo.builtAt) {
    console.log(`[exam] bundle 落后（页=${env0.build} 盘=${buildInfo.builtAt}）→ 热更链同款 reload 一次`);
    await evalRaw('location.reload()');
    for (let i = 0; i < 30; i++) {
      await sleep(1000);
      const ok = await evalRaw(`!!window.__kfmNzPool && (window.KFM_NZ_BUILD_TIME === ${JSON.stringify(buildInfo.builtAt)})`).catch(() => false);
      if (ok) break;
    }
  }
  const hooked = await evalRaw(`!!window.__kfmNzPool && !!window.__kfmNzAiChat`);
  check('⓪ 真机钩子在场（__kfmNzPool + __kfmNzAiChat）+ 新 bundle', hooked, JSON.stringify(env0));
  await shot('0-device-boot');
  const probe = await Promise.race([shot('0-probe-foreground'), sleep(6000).then(() => null)]);
  check('⓪ 真机前台可截屏（App 需前台，后台不产帧）', probe !== null, probe ?? 'captureScreenshot 超时=后台（声明降级）');

  // ========== C1：左滑进池（真触点）+ basic 槽位 ==========
  {
    const vw = env0.vw, vh = env0.vh;
    await swipe(vw * 0.6, vh * 0.45, vw * 0.6 - Math.min(260, vw * 0.5), vh * 0.45);
    await sleep(700);
    const h1 = await poolHook();
    check('C1 真机终端正文左滑 → POOL_OPEN（默认基本池）', h1?.page === 'POOL_OPEN' && h1?.pool === 'basic', JSON.stringify(h1));
    await shot('1-swipe-open-basic');
    const slots = await evalRaw(`[...document.querySelectorAll('[data-pool-slot]')].map((e) => e.getAttribute('data-pool-slot'))`);
    check('C1b basic 只读聚合两槽位在场（role 槽退役）', JSON.stringify(slots) === JSON.stringify(['provider', 'session']), JSON.stringify(slots));
  }

  // ========== 四池 CRUD 一轮 ==========
  // provider：新建（明文假 key= fuse 抽查 C2）→ 编辑改名 → 409 relied UI → 删
  {
    await tapSel('[data-pool-tab="provider"]', 'provider 标签');
    await tapSel('[data-pool-new]', '新建');
    await fillField('id', SCRATCH);
    await fillField('name', 'C3 临考 Provider');
    await fillField('baseUrl', 'https://exam.invalid/v1');
    await fillField('apiKey', FAKE_KEY);
    await shot('2-provider-form');
    await tapSel('[data-pool-save]', '保存');
    await sleep(900);
    const provJson = (await api('/pool/provider')).json;
    const made = provJson?.find((e) => e.id === SCRATCH);
    check('C2a provider 新建上池（UI 保存链）', !!made, made ? `apiKey=${JSON.stringify(made.apiKey)}` : '缺席');
    // fuse 抽查：池文件只留代字 + .env 600 落明文
    const provFile = readFileSync(join(KFM_DIR, 'providers.json'), 'utf-8');
    const envNow = readFileSync(envPath);
    const envMode = statSync(envPath).mode & 0o777;
    const fusedShape = made?.apiKey && /\$\{KFM_PROVIDER_[A-Z0-9_]+\}/.test(String(made.apiKey));
    check('C2b fuse-on-save：API 响应+池文件只留 ${VAR} 代字（无明文）', fusedShape && !provFile.includes(FAKE_KEY), `apiKey=${JSON.stringify(made?.apiKey)}`);
    check('C2c fuse-on-save：.env 600 落明文（假 key）', envMode === 0o600 && envNow.includes(FAKE_KEY) && !envBefore?.includes(FAKE_KEY), `mode=${envMode.toString(8)}`);
    // 编辑改名
    await tapSel(`[data-pool-row="provider:${SCRATCH}"]`, 'scratch 行');
    await fillField('name', 'C3 临考 Provider·改名');
    await tapSel('[data-pool-save]', '保存');
    await sleep(900);
    const renamed = ((await api('/pool/provider')).json ?? []).find((e) => e.id === SCRATCH);
    check('C2d provider 编辑改名上池', renamed?.name === 'C3 临考 Provider·改名', `name=${JSON.stringify(renamed?.name)}`);
    // 409 relied UI：建一个引用它的 scratch session（server 侧合法建）→ 删 provider 被守卫拦
    await api('/pool/session/create', { entry: { id: `${SCRATCH}-引用会话`, title: `${SCRATCH}-引用会话`, providerId: SCRATCH, modelId: 'exam-model' } });
    await tapSel(`[data-pool-delete="${SCRATCH}"]`, '删除');
    await sleep(400);
    await tapSel('[data-pool-overlay-confirm]', '确认删除');
    await sleep(900);
    const reliedText = await evalRaw(`document.querySelector('[data-pool-relied]')?.textContent ?? ''`);
    const stillListed = ((await api('/pool/provider')).json ?? []).some((e) => e.id === SCRATCH);
    check('C2e relied 守卫 409：删被引用 provider → 真机确认页展「被谁用着」+ 不删', /引用/.test(reliedText) && stillListed, `relied="${reliedText.slice(0, 60)}"`);
    await shot('2-relied-409');
    await tapSel('[data-pool-overlay-cancel]', '取消');
    await sleep(400);
    // 清理：先删引用会话再删 scratch provider
    const del1 = await api(`/pool/session/${encodeURIComponent(`${SCRATCH}-引用会话`)}/delete`);
    await tapSel(`[data-pool-delete="${SCRATCH}"]`, '删除');
    await sleep(400);
    await tapSel('[data-pool-overlay-confirm]', '确认删除');
    await sleep(900);
    const goneAfter = !((await api('/pool/provider')).json ?? []).some((e) => e.id === SCRATCH);
    check('C2f 清理：引用解除后 provider 删除成功（守卫解除即删）', del1.status === 200 && goneAfter, `del=${del1.status} gone=${goneAfter}`);
  }
  // session 池：新建 scratch 壳 → 激活 → 复原激活 → 删
  {
    await tapSel('[data-pool-tab="session"]', 'session 标签');
    await tapSel('[data-pool-new]', '新建');
    await fillField('title', SCRATCH);
    await tapSel('[data-pool-save]', '保存');
    await sleep(900);
    const made = ((await api('/pool/session')).json ?? []).some((e) => e.id === SCRATCH);
    await tapSel(`[data-pool-activate="${SCRATCH}"]`, '设为激活');
    await sleep(900);
    const led1 = (await api('/pool/active')).json;
    await tapSel('[data-pool-activate="茉莉的测试"]', '复原激活 茉莉的测试');
    await sleep(900);
    const led2 = (await api('/pool/active')).json;
    await tapSel(`[data-pool-delete="${SCRATCH}"]`, '删除');
    await sleep(400);
    await tapSel('[data-pool-overlay-confirm]', '确认删除');
    await sleep(900);
    const gone = !((await api('/pool/session')).json ?? []).some((e) => e.id === SCRATCH);
    check('C-session 池一轮：新建壳→激活→复原激活→删（messages 恒空壳管理）', made && led1?.sessionId === SCRATCH && led2?.sessionId === '茉莉的测试' && gone,
      `made=${made} act=${led1?.sessionId} restore=${led2?.sessionId} gone=${gone}`);
    await shot('2-pool-session-done');
  }

  // ========== C3：激活闭环（池页切激活 → picker ✓ → 不经 picker 发一条） ==========
  {
    await tapSel('[data-pool-tab="provider"]', 'provider 标签');
    const provs = (await api('/pool/provider')).json ?? [];
    zhipu = provs.find((e) => e.id === '智谱' || e.name === '智谱') ?? null;
    if (!zhipu) {
      check('C3 激活闭环', false, 'providers.json 无「智谱」条目——闭环腿换路需人工裁决');
    } else {
      const zmodel = Array.isArray(zhipu.models) && zhipu.models.length ? String(zhipu.models[0]) : '';
      await tapSel(`[data-pool-activate="${zhipu.id}"]`, '设为激活 智谱');
      await sleep(1000);
      const led = (await api('/pool/active')).json;
      check('C3a 池页切激活（不经 picker）→ 总账随动', led?.providerId === zhipu.id, JSON.stringify({ providerId: led?.providerId, modelId: led?.modelId }));
      // orb 提 AI 页（此刻池页开着：点球=AI 页提上来=orb 三态之一，顺路取证）
      await tapSel('[data-kfm-aichat-orb]', 'orb');
      await sleep(700);
      const raised = await attrRaised();
      const poolStill = (await poolHook())?.page;
      check('C5a orb 三态·池页开着点球 → AI 页提到池页上（raised 档，池页不关）', (await aiHook())?.page === 'AI_PAGE' && raised === true && poolStill === 'POOL_OPEN', `raised=${raised} pool=${poolStill}`);
      await shot('3-orb-raise-over-pool');
      // picker 开 = ✓ 随账同步（开菜单重拉总账）；不开选择，点外关
      await tapSel('[data-aichat-model-btn]', '模型钮');
      await sleep(700);
      const checkOnZhipu = await evalRaw(`(() => { const r = document.querySelector('[data-aichat-provider-row="${zhipu.id}"]'); return r ? !!r.querySelector('[data-aichat-check]') : null; })()`);
      await shot('3-picker-check-sync');
      await evalRaw(`document.querySelector('[data-aichat-model-btn]')?.click()`);
      await sleep(400);
      check('C3b picker ✓ 同步（智谱带 ✓，未做任何选择）', checkOnZhipu === true, `check=${checkOnZhipu}`);
      // 不经 picker 选择直接发一条
      const logBefore = (() => { try { return readFileSync('/tmp/nz-ai-chat.log', 'utf-8'); } catch { return ''; } })();
      await fillAi('配置池激活闭环真机 c3');
      await tapSel('[data-aichat-send]', '发送');
      for (let i = 0; i < 60; i++) { await sleep(1000); if ((await aiHook())?.phase === 'IDLE') break; }
      await sleep(800);
      const logAfter = (() => { try { return readFileSync('/tmp/nz-ai-chat.log', 'utf-8'); } catch { return ''; } })();
      const newStarts = logAfter.slice(logAfter.length).length >= 0 ? logAfter.replace(logBefore, '').split('\n') : [];
      const startLine = newStarts.map((l) => { try { return JSON.parse(l); } catch { return null; } }).find((o) => o?.kind === 'start');
      const doneLine = newStarts.map((l) => { try { return JSON.parse(l); } catch { return null; } }).find((o) => o?.kind === 'done');
      const aiH = await aiHook();
      check('C3c 激活闭环收口：发出的 run 走新激活 provider/model（L2 /tmp 日志互证）',
        startLine?.provider === zhipu.id && startLine?.model === zmodel && !!doneLine && aiH?.phase === 'IDLE',
        `start=${JSON.stringify({ provider: startLine?.provider, model: startLine?.model })} done=${!!doneLine} phase=${aiH?.phase}`);
      await shot('3-activation-loop-done');
    }
  }

  // ========== C4：标题栏入口定位（AI 页开着，池页在底下开着） ==========
  {
    // 现态：AI_PAGE + POOL_OPEN（raised）。点球=关 AI → 池页复现（C5b）
    await tapSel('[data-kfm-aichat-orb]', 'orb');
    await sleep(800);
    const hC5b = await poolHook();
    const raisedGone = await attrRaised();
    check('C5b orb 三态·再点球 → AI 页关（池页复现仍 POOL_OPEN）', (await aiHook())?.page === 'TERMINAL' && hC5b?.page === 'POOL_OPEN' && raisedGone === false, `pool=${hC5b?.page}/${hC5b?.pool} raised=${raisedGone}`);
    await shot('4-pool-restored');
    // orb 再开 AI（提顶）→ 标题栏「管理 session 池…」→ 池页定位 session（已开转 C3 形状；role 组 09-07 退役）
    await tapSel('[data-kfm-aichat-orb]', 'orb');
    await sleep(700);
    await tapSel('[data-aichat-config-btn]', '标题下拉');
    await sleep(400);
    await tapSel('[data-aichat-config-entry="session:manage"]', '「管理 session 池…」入口');
    await sleep(900);
    const hRole = await poolHook();
    check('C4a 标题栏点「管理 session 池…」→ 池页定位 session 池（AI 页不收起）', hRole?.page === 'POOL_OPEN' && hRole?.pool === 'session' && (await aiHook())?.page === 'AI_PAGE', JSON.stringify(hRole));
    await shot('4-entry-session-pool');
    // 「会话」：池页盖 AI → orb 提顶 → 标题栏可点 → 点「会话」
    await tapSel('[data-kfm-aichat-orb]', 'orb 提顶');
    await sleep(700);
    await tapSel('[data-aichat-config-btn]', '标题下拉');
    await sleep(400);
    await tapSel('[data-aichat-config-entry="session:manage"]', '「会话」入口');
    await sleep(900);
    const hSess = await poolHook();
    check('C4b 标题栏点「会话」→ 池页切 session 池', hSess?.page === 'POOL_OPEN' && hSess?.pool === 'session', JSON.stringify(hSess));
    await shot('4-entry-session');
    // 收尾链：orb 关 AI（先提顶再关：现态池页盖 AI → 两次点球）→ 右滑关池页
    await tapSel('[data-kfm-aichat-orb]', 'orb');
    await sleep(600);
    await tapSel('[data-kfm-aichat-orb]', 'orb');
    await sleep(900);
    const vw = env0.vw, vh = env0.vh;
    await swipe(vw * 0.4, vh * 0.45, vw * 0.4 + Math.min(280, vw * 0.6), vh * 0.45);
    await sleep(700);
    const hEnd = await poolHook();
    const aiEnd = await aiHook();
    check('C5c 收尾：orb 关 AI → 右滑关池页 → 全关态', hEnd?.page === 'POOL_CLOSED' && aiEnd?.page === 'TERMINAL', `pool=${hEnd?.page} ai=${aiEnd?.page}`);
  }
} catch (e) {
  check('C 档执行中断', false, String(e).slice(0, 300));
} finally {
  // ---------- 考后复原 + 对账 ----------
  console.log('[restore] 复原真账……');
  // 1) 总账：经唯一门写回原值，再逐字节覆盖复原（防格式漂移）
  const before = activeBefore ? JSON.parse(activeBefore.toString('utf-8')) : { providerId: '', modelId: '', roleFile: '', sessionId: '' };
  await api('/pool/active', before);
  if (activeBefore) writeFileSync(activePath, activeBefore);
  const activeAfter = readFileSync(activePath);
  check('复原① active.json 逐字节复原（md5 相等）', md5(activeAfter) === md5(activeBefore ?? Buffer.alloc(0)),
    `before=${md5(activeBefore ?? Buffer.alloc(0))} after=${md5(activeAfter)}`);
  // 2) .env：fuse 抽查落进去的假 key 行随字节复原抹除
  if (envBefore) writeFileSync(envPath, envBefore);
  if (envBefore) {
    const envAfter = readFileSync(envPath);
    check('复原② .env 逐字节复原（md5 相等，假 key 行零残留）', md5(envAfter) === md5(envBefore), `mode=${(statSync(envPath).mode & 0o777).toString(8)}`);
  }
  // 3) scratch 残余对账（session 引用会话/scratch 三池条目）
  const left = [];
  for (const p of ['provider', 'session']) {
    const arr = (await api(`/pool/${p}`)).json ?? [];
    if (arr.some((e) => String(e.id ?? '').includes(SCRATCH) || String(e.title ?? '').includes(SCRATCH))) left.push(p);
  }
  check('复原③ scratch 条目零残留', left.length === 0, left.length ? `残余池=${left.join(',')}` : `池计数考前=${JSON.stringify(pools0.map((p) => p.pool + ':' + p.count))} 考后=${JSON.stringify((await api('/pool/list')).json?.map((p) => p.pool + ':' + p.count))}`);
}

const pass = results.filter((r) => r.ok).length;
console.log(`\n=== config-pool C 档真机：${pass}/${results.length} ===`);
await sleep(300);
ws.close();
process.exit(pass === results.length ? 0 : 1);

/** AI composer 填词（原生 setter + input） */
async function fillAi(text) {
  return evalRaw(`(() => {
    const e = document.querySelector('[data-aichat-input]');
    if (!e) return false;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set
      ?? Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(e, ${JSON.stringify(text)});
    e.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
}
