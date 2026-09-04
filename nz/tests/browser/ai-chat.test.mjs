/**
 * tests/browser/ai-chat.test.mjs — ai-chat A1 B 档考卷 v1（echo 脑驱动 UI 全链，
 * 设计 docs/ai-chat-a1-design.md §五 B 档 7 钉 + 页面切换补流钉）。
 * 状态机蓝本=设计 §3.3（三机七态十转换；词汇表唯一真源 P9）。
 *
 *   B1  A1/A2 orb 往返（TERMINAL↔AI_PAGE）
 *   B2  A3→A6 发送-流式-完成（echo 节目单回放，消息只增，done 收流）
 *   B3  A8 取消（流式中停止 → 已取消 入流 → IDLE）
 *   B4  A7 错误入流（echo 错误节目 → error 文案成消息，页面不崩）
 *   B5  P6 只增不重建（streaming 气泡 + 列表 DOM 节点身份稳定）
 *   B6  P9 词汇表（钩子 page/phase/menu + 观测环状态名 ⊆ 清单枚举）
 *   B7  P1 key 不出服务器（/ai/providers + start 载荷 + 钩子 + bundle + server 日志 grep）
 *   补流钉  A1 转换：run 进行中切出 AI 页再切回 → attach from=N 补流不丢帧
 *   P7  皮内零硬编码色值（源码 grep；变异抽检的靶子）
 *
 * 慢流杠杆（B3/B5/补流需要确定性时间窗）：page.evaluate 设
 * window.__kfmNzAiChatTestLever = { echoPaceMs } → client 在 echo start 载荷
 * 带 paceMs（server EchoBrain 仅此脑消费，0-500 夹取）。
 */
import { launchBrowser } from './launch.mjs';
import { readFileSync, readdirSync, existsSync } from 'node:fs';

const BASE = process.env.KFM_NZ_URL || 'http://127.0.0.1:8023/';
const PAGE_URL = `${BASE}?nosplash`;
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`); };

// echo 节目单（probe-kimi-k3-256k fixture）的标准答案：44 事件，正文 PONG
const ECHO_EVENTS = 44;
const ECHO_TEXT = 'PONG';

const PAGE_VOCAB = ['TERMINAL', 'AI_PAGE'];
const RUN_VOCAB = ['IDLE', 'WAITING', 'STREAMING'];
const MENU_VOCAB = ['CLOSED', 'MODEL_OPEN'];
// 大小写敏感：代字形必须是环境变量命名习惯（${WORD_WORD}，含下划线），
// 防误伤 minify 模板串 ${u}/${E}
const KEY_SHAPE = /apiKey|Bearer |\$\{[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\}|KFM_PROVIDER|\bsk-[a-z0-9]/;
// server 日志尺：人话错误文案合法含 "apiKey" 字样（§1.3 fuse 人话点名变量），
// 钉的是 key 材料本身（Bearer 头/未展开代字/sk- 值形态）
const LOG_SHAPE = /Bearer |\$\{|\bsk-[a-z0-9]{6,}/i;

const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 900, height: 620 } });
const pageErrors = [];
page.on('pageerror', (e) => { pageErrors.push(String(e).slice(0, 200)); console.log('[PAGEERROR]', String(e).slice(0, 250)); });
const startPayloads = [];
page.on('request', (r) => { if (r.url().includes('/ai/chat/start')) startPayloads.push(r.postData() ?? ''); });

await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded', timeout: 40000 }).catch(() => {});
const hookAlive = await page.waitForFunction(() => !!window.__kfmNzAiChat, null, { timeout: 15000, polling: 250 })
  .then(() => true).catch(() => false);

const vocabSamples = [];
const hook = async () => {
  const h = await page.evaluate(() => {
    const f = window.__kfmNzAiChat;
    if (!f) return null;
    const r = f();
    return {
      page: r.page, menu: r.menu,
      phase: r.run?.phase ?? null, runId: r.run?.runId ?? null,
      provider: r.run?.provider ?? null, model: r.run?.model ?? null,
      cursor: r.run?.cursor ?? null, deltas: r.run?.deltas ?? null, chars: r.run?.chars ?? null,
      messages: r.messages, lastEvents: r.lastEvents, lastError: r.lastError,
    };
  });
  if (h) {
    vocabSamples.push({ kind: 'page', v: h.page }, { kind: 'menu', v: h.menu });
    if (h.phase) vocabSamples.push({ kind: 'run', v: h.phase });
    for (const e of h.lastEvents ?? []) {
      if (e.phase) vocabSamples.push({ kind: 'run', v: e.phase });
      if (e.page) vocabSamples.push({ kind: 'page', v: e.page });
    }
  }
  return h;
};
const actUntil = async (act, pred, { tries = 2, settle = 6000, poll = 200 } = {}) => {
  for (let t = 0; t <= tries; t++) {
    await act();
    const end = Date.now() + settle;
    while (Date.now() < end) { if (await pred()) return { ok: true, tries: t }; await page.waitForTimeout(poll); }
  }
  return { ok: false };
};
const setLever = (echoPaceMs) => page.evaluate((v) => { window.__kfmNzAiChatTestLever = { echoPaceMs: v }; }, echoPaceMs);
const openAiPage = async () => page.click('[data-kfm-aichat-orb]', { timeout: 4000 }).catch(() => {});
const closeAiPage = async () => page.click('[data-aichat-collapse]', { timeout: 4000 }).catch(() => {});
const sendViaComposer = async (text) => {
  await page.fill('[data-aichat-input]', text, { timeout: 4000 }).catch(() => {});
  await page.press('[data-aichat-input]', 'Enter', { timeout: 4000 }).catch(() => {});
};
const selectModel = async (row) => {
  await page.click('[data-aichat-model-btn]', { timeout: 4000 }).catch(() => {});
  await page.click(`[data-aichat-model-row="${row}"]`, { timeout: 4000 }).catch(() => {});
};

// ========== B1：A1/A2 orb 往返 + 词汇 ==========
const h0 = await hook();
check('B1a 初始 page=TERMINAL（词汇表内）', !!h0 && h0.page === 'TERMINAL' && PAGE_VOCAB.includes(h0.page), `page=${h0?.page}`);
const r1 = await actUntil(openAiPage, async () => (await hook())?.page === 'AI_PAGE');
const dom1 = hookAlive ? await page.evaluate(() => !!document.querySelector('[data-kfm-aichat]')) : false;
check('B1b A1 点 orb → AI_PAGE（钩子+DOM 双证）', r1.ok && dom1, `page=${(await hook())?.page} dom=${dom1}`);
const r2 = await actUntil(closeAiPage, async () => (await hook())?.page === 'TERMINAL');
const dom2 = await page.evaluate(() => !document.querySelector('[data-kfm-aichat]')).catch(() => false);
check('B1c A2 收起 → TERMINAL（AI 页 DOM 摘除）', r2.ok && dom2, `page=${(await hook())?.page} domGone=${dom2}`);

// ========== B7：P1 key 不出服务器（providers/钩子/bundle/server 日志；start 载荷在 B2 捕） ==========
const provText = await page.evaluate(async () => await (await fetch('/ai/providers')).text()).catch(() => 'FETCH_FAIL');
const hookText = JSON.stringify((await hook()) ?? {});
let bundleClean = false;
let bundleDetail = 'bundle.js unreadable';
try {
  const js = readFileSync(new URL('../../public/bundle.js', import.meta.url), 'utf-8');
  bundleClean = !KEY_SHAPE.test(js);
  bundleDetail = `bundle ${(js.length / 1024).toFixed(0)}KB clean=${bundleClean}`;
} catch (e) { bundleDetail = String(e).slice(0, 80); }
let logClean = true;
let logDetail = 'server log 不存在（跳过）';
try {
  const p = process.env.NZ_AI_CHAT_LOG ?? '/tmp/nz-ai-chat.log';
  if (existsSync(p)) { const t = readFileSync(p, 'utf-8'); logClean = !LOG_SHAPE.test(t); logDetail = `log ${t.split('\n').length} 行 clean=${logClean}`; }
} catch (e) { logDetail = String(e).slice(0, 80); }
check('B7a /ai/providers 无 key 形态（apiKey/Bearer/sk-/${}/代字）', !KEY_SHAPE.test(provText), provText.slice(0, 60));
check('B7b 观测钩无 key 形态', !KEY_SHAPE.test(hookText), '');
check('B7c client bundle 无 key 形态', bundleClean, bundleDetail);
check('B7d server /tmp 日志无 key 形态', logClean, logDetail);

// ========== A10 菜单机 + picker 默认 Kimi/kimi-k2.7-code ==========
await actUntil(openAiPage, async () => (await hook())?.page === 'AI_PAGE');
const defBtn = await page.evaluate(() => document.querySelector('[data-aichat-model-btn]')?.textContent ?? '').catch(() => '');
check('A10a picker 默认 = Kimi 官方 + kimi-k2.7-code（§八③）', /kimi-k2\.7-code/.test(defBtn), `btn="${defBtn}"`);
await page.click('[data-aichat-model-btn]').catch(() => {});
const mOpen = (await hook())?.menu;
check('A10b 点模型钮 → MODEL_OPEN', mOpen === 'MODEL_OPEN', `menu=${mOpen}`);
await page.press('[data-aichat-input]', 'Escape').catch(() => {});
const mEsc = (await hook())?.menu;
check('A10c Escape → CLOSED', mEsc === 'CLOSED', `menu=${mEsc}`);
await selectModel('echo::echo').catch(() => {});
const mSel = (await hook())?.menu;
const echoBtn = await page.evaluate(() => document.querySelector('[data-aichat-model-btn]')?.textContent ?? '').catch(() => '');
check('A10d 选定 echo（picker 可达断网腿）→ CLOSED', mSel === 'CLOSED' && /echo/i.test(echoBtn), `menu=${mSel} btn="${echoBtn}"`);

// ========== B2：A3→A6 发送-流式-完成（消息只增） ==========
await setLever(2);
startPayloads.length = 0;
const lenBefore = (await hook())?.messages?.length ?? 0;
const lenSamples = [];
const r3 = await actUntil(
  () => sendViaComposer('说一句 PONG'),
  async () => { const h = await hook(); lenSamples.push(h?.messages?.length ?? 0); return h?.phase === 'IDLE' && (h?.messages?.length ?? 0) >= lenBefore + 2; },
  { tries: 1, settle: 15000, poll: 120 },
);
const h3 = (await hook()) ?? {};
const ring3 = h3.lastEvents ?? [];
const phaseSeq = [];
for (const e of ring3) if (phaseSeq[phaseSeq.length - 1] !== e.phase) phaseSeq.push(e.phase);
const aiMsg3 = (h3.messages ?? []).filter((m) => m.role === 'ai').at(-1);
const domAiText = await page.evaluate(() => [...document.querySelectorAll('[data-aichat-msg="ai"]')].at(-1)?.textContent ?? '').catch(() => '');
const mono = lenSamples.every((v, i) => i === 0 || v >= lenSamples[i - 1]);
check('B2a A3→A4→A6 相位序列 WAITING→STREAMING→IDLE（观测环直读）',
      phaseSeq.join('>').includes('WAITING>STREAMING') && h3.phase === 'IDLE', `seq=${phaseSeq.join('>')}`);
check('B2b 消息只增 + echo 正文完整上屏（PONG）+ done 收流',
      r3.ok && mono && aiMsg3?.chars > 0 && domAiText.includes(ECHO_TEXT) && ring3.some((e) => e.type === 'done'),
      `msgs=${h3.messages?.length} aiChars=${aiMsg3?.chars} dom="${domAiText.slice(-30)}" done=${ring3.some((e) => e.type === 'done')}`);
check('B2c R3 归位：text 非空 → reasoning 收折叠区（details 思考）',
      await page.evaluate(() => [...document.querySelectorAll('[data-aichat-msg="ai"]')].at(-1)?.querySelector('details[data-aichat-thinking]')?.textContent.includes('Need final exactly') ?? false).catch(() => false),
      '');
check('B7e start 载荷无 key 形态（全链路载荷 grep）', startPayloads.length > 0 && startPayloads.every((p) => !KEY_SHAPE.test(p)), `payloads=${startPayloads.length}`);

// ========== B5：P6 streaming 气泡 + 列表 DOM 节点身份稳定 ==========
await setLever(30);
await sendViaComposer('再来一次 PONG').catch(() => {});
const el1 = await page.waitForSelector('[data-aichat-streaming]', { timeout: 8000 }).catch(() => null);
const list1 = await page.$('[data-aichat-list]');
await page.waitForTimeout(500); // 30ms×44≈1.3s 流式窗口内
const el2 = await page.$('[data-aichat-streaming]');
const list2 = await page.$('[data-aichat-list]');
const sameBubble = el1 && el2 ? await page.evaluate(([a, b]) => a === b, [el1, el2]) : false;
const sameList = list1 && list2 ? await page.evaluate(([a, b]) => a === b, [list1, list2]) : false;
await actUntil(async () => {}, async () => (await hook())?.phase === 'IDLE', { tries: 0, settle: 10000 });
check('B5 P6：流式期间气泡/列表 DOM 节点身份稳定（只增不重建）', !!sameBubble && !!sameList, `bubble=${sameBubble} list=${sameList}`);

// ========== B3：A8 取消 → 已取消 入流 → IDLE ==========
await setLever(30);
await sendViaComposer('第三次 PONG').catch(() => {});
const r6 = await actUntil(async () => {}, async () => (await hook())?.phase === 'STREAMING', { tries: 0, settle: 6000, poll: 60 });
const stopMode = await page.evaluate(() => document.querySelector('[data-aichat-send]')?.getAttribute('data-aichat-send-mode')).catch(() => null);
await page.click('[data-aichat-send]').catch(() => {}); // 流式期间发送钮=停止钮（P2）
const r6b = await actUntil(async () => {}, async () => (await hook())?.phase === 'IDLE', { tries: 0, settle: 8000 });
const h6 = (await hook()) ?? {};
const lastAi6 = (h6.messages ?? []).filter((m) => m.role === 'ai').at(-1);
const domCancel = await page.evaluate(() => [...document.querySelectorAll('[data-aichat-msg="ai"]')].at(-1)?.textContent ?? '').catch(() => '');
const sendModeBack = await page.evaluate(() => document.querySelector('[data-aichat-send]')?.getAttribute('data-aichat-send-mode')).catch(() => null);
check('B3 A8：流式中点停止（send-mode=stop）→ 已取消 入流 → IDLE（P5/P2）',
      r6.ok && stopMode === 'stop' && r6b.ok && h6.lastError === '已取消' && domCancel.includes('已取消') && sendModeBack === 'send',
      `stop=${stopMode} lastError=${h6.lastError} dom="…${domCancel.slice(-20)}" mode=${sendModeBack} aiChars=${lastAi6?.chars}`);

// ========== B4：A7 错误入流（echo 错误节目） ==========
await setLever(2);
await selectModel('echo::echo-error').catch(() => {});
await sendViaComposer('触发错误').catch(() => {});
const r7 = await actUntil(async () => {}, async () => (await hook())?.phase === 'IDLE' && (await hook())?.lastError, { tries: 0, settle: 8000 });
const h7 = (await hook()) ?? {};
const domErr = await page.evaluate(() => [...document.querySelectorAll('[data-aichat-msg="ai"]')].at(-1)?.textContent ?? '').catch(() => '');
check('B4 A7：error 文案成消息入流（不是 toast），页面不崩',
      r7.ok && typeof h7.lastError === 'string' && h7.lastError.length > 0 && domErr.includes('错误') && pageErrors.length === 0,
      `lastError="${String(h7.lastError).slice(0, 40)}" dom="…${domErr.slice(-30)}" pageErr=${pageErrors.length}`);

// ========== 补流钉：A1 转换 run 进行中切出再切回 → attach from=N 不丢帧 ==========
await setLever(40);
await selectModel('echo::echo').catch(() => {});
await sendViaComposer('补流钉 PONG').catch(() => {});
const r8 = await actUntil(async () => {}, async () => { const h = await hook(); return h?.phase === 'STREAMING' && (h?.cursor ?? 0) >= 6; }, { tries: 0, settle: 8000, poll: 60 });
const h8a = (await hook()) ?? {};
await closeAiPage().catch(() => {});
const h8b = (await hook()) ?? {};
await page.waitForTimeout(600); // server 侧 run 继续缓冲（40ms×44≈1.8s 节目）
const r8b = await actUntil(openAiPage, async () => (await hook())?.phase === 'IDLE', { tries: 1, settle: 10000, poll: 150 });
const h8c = (await hook()) ?? {};
const runEvents = (h8c.lastEvents ?? []).filter((e) => e.runId === h8c.runId && e.idx >= 0);
const idxs = runEvents.map((e) => e.idx);
const noDup = idxs.every((v, i) => i === 0 || v > idxs[i - 1]);
const domFull = await page.evaluate(() => [...document.querySelectorAll('[data-aichat-msg="ai"]')].at(-1)?.textContent ?? '').catch(() => '');
check('补流钉 A1：切出（TERMINAL，run 不死 STREAMING）→ 切回 attach from cursor 补全（无重无丢，cursor=44，正文完整）',
      r8.ok && h8b.page === 'TERMINAL' && h8b.phase === 'STREAMING' && r8b.ok
      && h8c.cursor === ECHO_EVENTS && noDup && idxs.length === ECHO_EVENTS && domFull.includes(ECHO_TEXT),
      `leave@${h8a.cursor} mid=${h8b.page}/${h8b.phase} cursor=${h8c.cursor} frames=${idxs.length} strict=${noDup} tail="…${domFull.slice(-16)}"`);

// ========== B6：P9 词汇表（全程采样 ⊆ 清单枚举） ==========
const bad = vocabSamples.filter((s) =>
  (s.kind === 'page' && !PAGE_VOCAB.includes(s.v))
  || (s.kind === 'run' && !RUN_VOCAB.includes(s.v))
  || (s.kind === 'menu' && !MENU_VOCAB.includes(s.v)));
check('B6 P9 词汇表：钩子/观测环全部状态名 ⊆ 清单枚举', bad.length === 0 && vocabSamples.length > 10,
      `samples=${vocabSamples.length} bad=${JSON.stringify(bad.slice(0, 3))}`);

// ========== P7：皮内零硬编码样式字面量（颜色/阴影/圆角/时长走 --kfm-*） ==========
let p7ok = false;
let p7detail = 'plugin dir unreadable';
try {
  const base = new URL('../../src/client/plugins/ai-chat/', import.meta.url);
  const files = ['index.tsx', 'chat-link.ts', ...readdirSync(new URL('./ui/', base)).map((f) => `ui/${f}`)];
  const offenders = [];
  for (const f of files) {
    const src = readFileSync(new URL(f, base), 'utf-8');
    const hits = src.match(/#[0-9a-fA-F]{3,8}\b|\brgba?\(\s*\d|\b\d+(?:\.\d+)?m?s\s+cubic-bezier/g);
    if (hits) offenders.push(`${f}: ${hits.slice(0, 3).join(',')}`);
  }
  p7ok = offenders.length === 0;
  p7detail = offenders.join(' | ') || `${files.length} 件皮/脑零字面量`;
} catch (e) { p7detail = String(e).slice(0, 100); }
check('P7 皮内零硬编码色值/阴影/时长字面量（全走 --kfm-* token）', p7ok, p7detail);

// ========== 汇总 ==========
const pass = results.filter((r) => r.ok).length;
console.log(`\n=== ai-chat B 档：${pass}/${results.length} ===`);
await browser.close();
process.exit(pass === results.length ? 0 : 1);
