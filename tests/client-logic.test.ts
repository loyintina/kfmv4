// ==========================================================================
// tests/client-logic.test.ts — 客户端纯逻辑回归钉子（步骤 4）
//
// 覆盖三块「有明确对错、可离线测」的客户端逻辑：
//   1. 会话消息计数（BAR-103）        session-client.countTextMessages
//   2. 临时卡组模式着色（427c960）     mode-system.recolorCards
//   3. 文件树构建边界                  tree-model.buildTree
//
// 方法论见 docs/design/REGRESSION_TESTING_SYSTEM.md 步骤 4。
// ==========================================================================

import assert from 'assert';
import { group, test, regression } from './runner.js';
import { extractMessageText, countTextMessages } from '../src/client/modules/session-client.js';
import type { SessionMessage } from '../src/client/modules/session-client.js';
import { recolorCards, getModeTheme, getTriColor } from '../src/client/modules/mode-system.js';
import { buildTree } from '../src/client/modules/tree-model.js';
import { KFMState, type FileNode } from '../src/client/modules/state.js';

// ==========================================================================
// BAR-103 (b8dec96 / 1d9fdbc): 消息计数只算「有正文」的消息
// 纯工具调用 / 纯思考气泡不计入；删空会话归零。
// ==========================================================================

group('session-client — 消息计数（BAR-103）');

const textMsg = (t: string): SessionMessage => ({ role: 'user', content: [{ type: 'text', text: t }] });
const toolMsg = (): SessionMessage => ({ role: 'ai', content: [{ type: 'tool', id: 't1', name: 'bash', input: {} }] });
const emptyTextMsg = (): SessionMessage => ({ role: 'ai', content: [{ type: 'text', text: '   ' }] });
const mixedMsg = (t: string): SessionMessage => ({
  role: 'ai',
  content: [{ type: 'tool', id: 't2', name: 'x', input: {} }, { type: 'text', text: t }],
});

// content 含 null block（AI 只调工具不说话时 text block index=0 为 null）
const nullBlockMsg = (): SessionMessage => ({
  role: 'ai',
  content: [null as unknown as { type: string }, { type: 'tool', id: 't3', name: 'bash', input: {} }] as SessionMessage['content'],
});

regression('BAR-103a', 'b8dec96', '纯工具调用消息不计入消息数', () => {
  assert(countTextMessages([toolMsg(), toolMsg()]) === 0, '两条纯工具消息应计为 0');
  assert(countTextMessages([textMsg('hi'), toolMsg()]) === 1, '一文本+一工具应计为 1');
});

regression('BAR-103b', 'b8dec96', '纯空白 text 消息不计入', () => {
  assert(countTextMessages([emptyTextMsg()]) === 0, '空白 text 应计为 0');
  assert(countTextMessages([textMsg('x'), emptyTextMsg()]) === 1, '有效+空白应计为 1');
});

regression('BAR-103c', '1d9fdbc', '空会话 → 计数为 0（删最后一个会话后统计行归零）', () => {
  assert(countTextMessages([]) === 0, '空 messages 应为 0');
});

regression('BAR-MSG-NULL', 'session-client', 'content 含 null block 不崩溃（AI 只调工具不说话）', () => {
  // extractMessageText 应安全跳过 null block，不抛 TypeError
  const text = extractMessageText(nullBlockMsg());
  assert(text === '', 'null block 消息应返回空字符串');
  // countTextMessages 也不应崩溃
  assert(countTextMessages([nullBlockMsg(), textMsg('ok')]) === 1, 'null block + 正常消息应计为 1');
});

test('混合块消息（工具+文本）计入 1（有正文）', () => {
  assert(countTextMessages([mixedMsg('answer')]) === 1);
}, { tag: 'integration' });

test('extractMessageText 拼接多个 TextBlock，跳过工具块', () => {
  const msg: SessionMessage = {
    role: 'ai',
    content: [
      { type: 'text', text: 'A' },
      { type: 'tool', id: 't', name: 'x', input: {} },
      { type: 'text', text: 'B' },
    ],
  };
  assert(extractMessageText(msg) === 'AB', `应拼接为 AB，得 ${extractMessageText(msg)}`);
}, { tag: 'integration' });

test('extractMessageText 对无 content 消息返回空串（不崩）', () => {
  assert(extractMessageText({ role: 'user', content: undefined as any }) === '');
}, { tag: 'integration' });

// ==========================================================================
// 427c960: 切换模式时临时卡按模式色系重着色（回归——曾传空数组导致失效）
// ==========================================================================

group('mode-system — 临时卡模式着色（427c960）');

/** 造一张带 recolorCards 依赖 dataset 的 mock 卡片元素 */
function makeCard(isDir: boolean, off1 = 0, off2 = 0): HTMLElement {
  const el = document.createElement('div');
  el.dataset._isDir = String(isDir);
  el.dataset._hueOff1 = String(off1);
  el.dataset._hueOff2 = String(off2);
  return el;
}

regression('BAR-103d', '427c960', 'recolorCards 写入卡片 background + _accent（非空数组真的着色）', () => {
  const cards = [makeCard(false), makeCard(true)];
  recolorCards('copy', cards);
  for (const c of cards) {
    assert(c.style.background.includes('linear-gradient'), '应写入渐变背景');
    assert(!!c.dataset._accent1 && !!c.dataset._accent2, '应写入 _accent1/_accent2');
  }
});

regression('BAR-103e', '427c960', 'copy/move/delete 各产出不同色系（模式切换真的换色）', () => {
  const mk = () => [makeCard(false)];
  const copy = mk(); recolorCards('copy', copy);
  const move = mk(); recolorCards('move', move);
  const del = mk(); recolorCards('delete', del);
  const cA = copy[0].dataset._accent1;
  const mA = move[0].dataset._accent1;
  const dA = del[0].dataset._accent1;
  assert(cA !== mA && mA !== dA && cA !== dA, `三模式 accent 应互不相同：${cA}/${mA}/${dA}`);
});

test('recolorCards(null) 回落默认蓝紫色系', () => {
  const cards = [makeCard(false)];
  recolorCards(null, cards);
  assert(cards[0].style.background.includes('linear-gradient'), 'null 模式也应着色（默认色）');
}, { tag: 'integration' });

test('recolorCards 空数组不抛错（无卡片时安全）', () => {
  recolorCards('copy', []); // 不应抛
}, { tag: 'integration' });

test('getModeTheme / getTriColor 返回各模式配置', () => {
  assert(getModeTheme('copy').hue1 === 160, 'copy hue1 应为 160');
  assert(typeof getTriColor('delete') === 'string', 'delete triColor 应为字符串');
}, { tag: 'integration' });

// ==========================================================================
// tree-model.buildTree 边界
// ==========================================================================

group('tree-model — buildTree 边界');

const fileNode = (name: string, isDir: boolean, children?: FileNode[]): FileNode =>
  ({ name, path: './' + name, isDir, isLink: false, children });

test('空文件列表 → 构建出根 Box，不崩', () => {
  const box = buildTree([]);
  assert(box, 'buildTree([]) 应返回 Box');
}, { tag: 'integration' });

test('单文件 → 根含该行', () => {
  const box = buildTree([fileNode('a.ts', false)]);
  assert(box.children.length > 0, '应有子行');
}, { tag: 'integration' });

test('折叠目录不展开子节点（expandedPaths 未含该路径）', () => {
  const tree = [fileNode('dir', true, [fileNode('inner.ts', false)])];
  const collapsed = buildTree(tree, { expandedPaths: {} });
  const expanded = buildTree(tree, { expandedPaths: { './dir': true } });
  // 展开态的可见盒子数应多于折叠态（子节点被纳入）
  const count = (b: any): number => 1 + (b.children || []).reduce((n: number, c: any) => n + count(c), 0);
  assert(count(expanded) > count(collapsed), '展开态盒子数应多于折叠态');
}, { tag: 'integration' });

// ==========================================================================
// 隐藏文件过滤（buildTree + buildExpanded）
//
// 契约：fetchDirRecursive 始终传 showHidden:true（服务端返回全部文件），
// tree-model.ts 的 buildExpanded 根据 KFMState.showHidden 决定是否过滤。
// toggle 时只翻转标志 + notify，瞬间 rebuild，无需网络请求。
// ==========================================================================

group('tree-model — 隐藏文件过滤');

const hiddenTree = [
  fileNode('.hidden-dir', true, [fileNode('secret.ts', false)]),
  fileNode('visible.ts', false),
  fileNode('.hidden-file', false),
];

regression('BAR-TREE-HIDDEN-01', 'tree-model', 'showHidden=false → 隐藏文件不出现在构建结果中', () => {
  const saved = KFMState.showHidden;
  try {
    const count = (b: any): number => 1 + (b.children || []).reduce((n: number, c: any) => n + count(c), 0);
    KFMState.showHidden = true;
    const visibleCount = count(buildTree(hiddenTree, { expandedPaths: { './.hidden-dir': true } }));
    KFMState.showHidden = false;
    const hiddenCount = count(buildTree(hiddenTree, { expandedPaths: { './.hidden-dir': true } }));
    // 过滤后节点数应严格少于未过滤
    assert(hiddenCount < visibleCount, `showHidden=false(${hiddenCount}) 应少于 true(${visibleCount})`);
  } finally { KFMState.showHidden = saved; }
});

regression('BAR-TREE-HIDDEN-02', 'tree-model', 'showHidden=true → 隐藏文件出现在构建结果中', () => {
  const saved = KFMState.showHidden;
  KFMState.showHidden = true;
  try {
    const box = buildTree(hiddenTree, { expandedPaths: { './.hidden-dir': true } });
    const count = (b: any): number => 1 + (b.children || []).reduce((n: number, c: any) => n + count(c), 0);
    // 应有：根 + .hidden-dir + secret.ts + visible.ts + .hidden-file = 5
    assert(count(box) >= 4, `showHidden=true 展开后应包含隐藏文件，实际 ${count(box)}`);
  } finally { KFMState.showHidden = saved; }
});

// fetchDirRecursive 源码级检查：始终传 showHidden:true
import { readFileSync } from 'fs';

regression('BAR-TREE-HIDDEN-03', 'tree-loader', 'fetchDirRecursive 始终传 showHidden:true（源码检查）', () => {
  const src = readFileSync('src/client/modules/tree-loader.ts', 'utf-8');
  assert(src.includes('showHidden: true'), 'fetchDirRecursive 应始终传 showHidden: true');
  assert(!src.includes('showHidden: KFMState.showHidden'), '不应传 KFMState.showHidden（会导致 toggle 需要网络请求）');
});


// ==========================================================================
// showHidden 持久化（BAR-TREE-HIDDEN-04）
//
// 契约：toggleHidden 写 localStorage，初始化从 localStorage 读。
// 刷新页面后 showHidden 状态不丢失。
// ==========================================================================

group('state — showHidden 持久化');


regression('BAR-TREE-HIDDEN-04', 'state', 'showHidden 状态持久化到 localStorage（源码检查）', () => {
  const src = readFileSync('src/client/modules/state.ts', 'utf-8');
  // 初始化时从 localStorage 读
  assert(src.includes("localStorage.getItem('kfmv4_showHidden')"), '初始化应从 localStorage 读 showHidden');
  // toggleHidden 时写入 localStorage（非注释行）
  const setLines = src.split('\n').filter(l => l.includes("localStorage.setItem('kfmv4_showHidden'") && !l.trimStart().startsWith('//'));
  assert(setLines.length > 0, 'toggleHidden 应写入 localStorage（非注释）');
});

// 背景：orb-chat 曾有一份本地 hslToHex 副本，缺 s/=100;l/=100 归一化与
// clamp，对 sat/lit=0-100 的输入产出损坏字符串（如 "#ab83d-a4aa..."）。
// 合并到 color-utils 规范版时修复。此钉子钉住不变量：任意合法 HSL →
// 恰好 "#" + 6 位十六进制，防止任何副本或改动再次违反。
// ==========================================================================

import { hslToHex } from '../src/client/modules/color-utils.js';

group('color-utils — hslToHex 合法 hex 不变量');

regression('BAR-COLOR-01', 'color-utils', 'sat/lit 用 0-100 范围 → 合法 #rrggbb', () => {
  const hexRe = /^#[0-9a-f]{6}$/;
  // orb-chat randomToolAccent 的实际取值范围：h=0-360, sat=45-70, lit=50-65
  for (const [h, s, l] of [[0, 45, 50], [120, 50, 55], [220, 60, 57], [300, 70, 65], [360, 62, 55]] as const) {
    const hex = hslToHex(h, s, l);
    assert(hexRe.test(hex), `hslToHex(${h},${s},${l})=${hex} 应为合法 #rrggbb`);
  }
});

regression('BAR-COLOR-02', 'color-utils', '边界 HSL（黑/白/全饱和）→ 合法 hex', () => {
  const hexRe = /^#[0-9a-f]{6}$/;
  for (const [h, s, l] of [[0, 0, 0], [0, 0, 100], [0, 100, 50], [359, 100, 50]] as const) {
    const hex = hslToHex(h, s, l);
    assert(hexRe.test(hex), `边界 hslToHex(${h},${s},${l})=${hex} 应合法`);
  }
});

// ==========================================================================
// orb 渲染层结构保护（v7.3.1 动画返工的教训）
//
// renderChatContent 每帧全量重建 innerHTML，CSS transition 对新元素不生效。
// 曾尝试给思考块套逐帧折叠动画（_activeFoldAnims），但历史消息加载时每条
// 都注册 → rAF 无限重渲染 + 每帧滚动到底 = 鬼畜滚动，且 collapsed 裁掉内容。
// 教训：思考块不做逐帧折叠；折叠靠 CSS class 静态切换。
// ==========================================================================

group('orb-chat — 渲染层结构保护');

regression('BAR-ORB-REASON-01', 'orb-chat', '思考块不注册逐帧折叠动画（防鬼畜滚动）', () => {
  const src = readFileSync('src/client/modules/orb-chat.ts', 'utf-8');
  // 思考块 rid 形如 'r'+idx，不能进 _activeFoldAnims（那是工具卡 tid 专用）
  assert(!src.includes('_activeFoldAnims.set(rid'), '思考块 rid 不应注册进 _activeFoldAnims（会导致历史消息无限重渲染）');
  // _scheduleReasonFold 已删除，不应复活
  assert(!src.includes('_scheduleReasonFold'), '_scheduleReasonFold 已废弃，不应复活');
});

regression('BAR-ORB-CSS-VER', 'build.mjs', 'CSS link 加版本号防缓存', () => {
  const src = readFileSync('build.mjs', 'utf-8');
  // build.mjs 必须给 css/*.css 加 ?v= 版本号（否则浏览器缓存旧样式，动画/布局改动不生效）
  assert(src.includes('.css') && src.includes('?v=${buildStamp}'), 'build.mjs 应给 CSS 加 ?v=buildStamp 版本号');
});

regression('BAR-ORB-FOLLOW-01', 'chat-dom', '追底用手势判定意图，不用 suppressScroll 时间窗口', () => {
  const src = readFileSync('src/client/modules/chat-dom.ts', 'utf-8');
  // v8: 滚动追底逻辑迁移到 chat-dom.ts 的 _attachScrollWatch
  const codeLines = src.split('\n').filter(l => !l.trimStart().startsWith('//'));
  assert(!codeLines.some(l => l.includes('suppressScroll')), 'suppressScroll 反模式已废弃，不应复活');
  assert(src.includes("addEventListener('touchmove'"), '应监听 touchmove 判定用户上滑意图');
  assert(src.includes("addEventListener('wheel'"), '应监听 wheel 判定桌面滚轮上滑');
  assert(src.includes('_followBottom'), '应保留 _followBottom 追底标志');
});

regression('BAR-ORB-FOLLOW-02', 'chat-dom', '滚动追底在 chat-dom.ts 管理，orb-chat.ts 不重复', () => {
  const orbChatSrc = readFileSync('src/client/modules/orb-chat.ts', 'utf-8');
  // v8: orb-chat.ts 不再有自己的 attachScrollWatch / followBottom 状态
  const codeLines = orbChatSrc.split('\n').filter(l => !l.trimStart().startsWith('//'));
  assert(!codeLines.some(l => l.includes('attachScrollWatch')), 'orb-chat.ts 不应有自己的 attachScrollWatch（已迁移到 chat-dom.ts）');
  assert(!codeLines.some(l => l.match(/^let followBottom/)), 'orb-chat.ts 不应有模块级 followBottom 变量');
});


// ==========================================================================
// BAR-ORB-SEG-02 / SEG-04: 会话分段加载的两条隐性契约（源码断言钉子）
//
// 这两条是集成时序 bug，逻辑耦合 DOM/rAF 无法离线跑真实场景，但根因都是
// 「一个反直觉的实现选择被后续改动静默推翻」——正是源码断言钉子的适用场景：
// 不验证运行结果，只锁定关键代码结构不被误删/改回反模式。
// ==========================================================================

group('orb — 会话分段加载契约（BAR-ORB-SEG）');

regression('BAR-ORB-SEG-02', 'orb.ts', '切换 guard 用 _renderedSessionId，不用 sessionStore.activeId', () => {
  const src = readFileSync('src/client/modules/orb.ts', 'utf-8');
  // 根因：sessionStore.init() 的监听器会抢先把 activeId 改成新 sid，
  // 若 orb 切换监听器的 guard 比较 sessionStore.activeId，则永远误成立 → return → 切不过去。
  // 必须存在模块内独立的 _renderedSessionId 作为「已渲染会话」真相。
  assert(src.includes('_renderedSessionId'), '应有 _renderedSessionId 追踪已渲染的会话（不依赖被抢改的 sessionStore.activeId）');
  // 提取 kfm-session-change 监听器里的 early-return guard 行，必须比较 _renderedSessionId。
  const guardLine = src.split('\n').find(l =>
    l.includes('=== _renderedSessionId') && l.includes('return'),
  );
  assert(guardLine, '切换监听器的 early-return guard 必须比较 sid === _renderedSessionId');
  // 反模式防复活：guard 不应改回比较 sessionStore.activeId（会被 init 监听器抢改导致误判）
  const badGuard = src.split('\n').some(l =>
    l.includes('sid === sessionStore.activeId') && l.includes('return'),
  );
  assert(!badGuard, 'guard 不应比较 sessionStore.activeId（会被 sessionStore.init 监听器抢先改掉 → 切换被跳过）');
});

// ==========================================================================
// BAR-ORB-TREE-01: sibling-switcher 依赖保护（防循环依赖崩树）
//
// 文件树崩溃历史（本 session 多次）：sibling-switcher 的某些 import 可能
// 触发循环依赖。v8 审计确认：允许安全的单向依赖（state/tree-loader/logger），
// 但禁止可能导致循环的 import（tree-render/orb/card-stack 等）。
// ==========================================================================

group('sibling-switcher — 依赖保护（BAR-ORB-TREE-01）');

const TREE_01_SRC = readFileSync('src/client/modules/sibling-switcher.ts', 'utf-8');

regression('BAR-ORB-TREE-01', 'sibling-switcher', '不 import 危险模块（防循环依赖）', () => {
  // 允许的安全依赖：state（基础状态）、tree-loader（单向加载）、logger（独立日志）
  const safeImports = ['./state.js', './tree-loader.js', './logger.js'];
  
  // 危险的 import：可能导致循环依赖
  const dangerousImports = ['./tree-render.js', './orb.js', './card-stack.js', './floating-card.js'];
  
  const importLines = TREE_01_SRC.split('\n').filter(l => l.includes("from './"));
  
  for (const line of importLines) {
    const isDangerous = dangerousImports.some(d => line.includes(d));
    assert(!isDangerous, `禁止 import 危险模块（可能导致循环依赖）：${line}`);
  }
  
  // 验证实际使用的 import 都是安全的
  for (const line of importLines) {
    const isSafe = safeImports.some(s => line.includes(s));
    assert(isSafe, `未预期的 import：${line}`);
  }
});


// ==========================================================================
// BAR-ORB-PANEL: v8.1 光球面板性能架构（源码断言钉子）
//
// 背景：v8.0 删除 v7 的视口裁剪 + 渲染缓存后，历史消息挂载变成「每次展开
// 全量同步渲染」（marked + hljs 全量跑 + 每消息一次强制 reflow），症状是
// 展开 2-3s 无响应、展开后拖拽光球卡顿。v8.1 修复 = 面板 DOM 持久化 +
// 窗口化挂载 + content-visibility + 渲染产物缓存 + 拖拽期挂起模糊。
// 这些机制跨 4 个文件且耦合 DOM/滚动时序，无法离线跑真实场景，
// 用源码断言锁定关键结构不被误删/改回反模式。
// ==========================================================================

group('orb — v8.1 面板性能架构（BAR-ORB-PANEL）');

regression('BAR-ORB-PANEL-01', 'orb.ts', 'expandPanel 不重建面板 DOM（持久化），不重新挂载历史', () => {
  const src = readFileSync('src/client/modules/orb.ts', 'utf-8');
  // 根因：v8.0 每次展开都 buildPanelContent(innerHTML 重建) + initChatDom + 全量重挂，
  // 既慢又制造 _contentArea 失效竞态。修复后创建逻辑收敛到 ensurePanel（幂等）。
  assert(src.includes('function ensurePanel'), '应有 ensurePanel 幂等创建入口');
  const expandBody = src.split('function expandPanel')[1]?.split('\nfunction ')[0] || '';
  assert(!expandBody.includes('buildPanelContent'), 'expandPanel 不应重建面板内容（应只在 ensurePanel 创建一次）');
  assert(!expandBody.includes('initChatDom'), 'expandPanel 不应重复 initChatDom');
  assert(!expandBody.includes('mountAiMessage'), 'expandPanel 不应重新挂载历史消息（DOM 持久化后天然同步）');
  // 反模式防复活：v8.0 的「展开时订阅 sessionStore 补渲」兜底机制不应回来（竞态已根除）
  assert(!expandBody.includes('sessionStore.subscribe'), 'expandPanel 不应再有订阅补渲兜底（竞态已由 DOM 持久化根除）');
});

regression('BAR-ORB-PANEL-02', 'orb.ts', '历史挂载窗口化：首屏只挂尾部窗口，滚动翻页 prepend', () => {
  const src = readFileSync('src/client/modules/orb.ts', 'utf-8');
  // v8.0 反模式：loadSessionInto 全量挂载 + 「面板已展开则 clearChatDom 再全量挂一遍」双重渲染
  assert(src.includes('MOUNT_WINDOW'), '应有首屏挂载窗口常量');
  assert(src.includes('_loadOlderHistory'), '应有向上翻页加载函数');
  assert(src.includes('setHistoryLoader'), '应通过 setHistoryLoader 向 chat-dom 注册翻页回调');
  const loadBody = src.split('async function loadSessionInto')[1]?.split('\n    }')[0] || '';
  assert(!loadBody.includes('mountAiMessage'), 'loadSessionInto 不应直接挂载（应走 _mountHistoryWindow）');
  assert(!loadBody.includes("orbState === 'expanded'"), 'loadSessionInto 不应有「展开态补渲」分支（双重挂载已根除）');
});

regression('BAR-ORB-PANEL-03', 'chat-dom', '渲染成本控制：content-visibility + 产物缓存 + 批量滚动抑制', () => {
  const src = readFileSync('src/client/modules/chat-dom.ts', 'utf-8');
  assert(src.includes('content-visibility'), '消息容器应有 content-visibility 原生视口裁剪');
  assert(src.includes('_mdCache'), '应有 markdown 渲染产物缓存');
  assert(src.includes('_hlCache'), '应有工具输入高亮产物缓存');
  // 每消息一次 scrollHeight 读取 = 每消息一次强制 reflow，批量挂载必须可抑制
  const scrollFn = src.split('export function scrollToBottom')[1]?.split('\n}')[0] || '';
  assert(scrollFn.includes('_scrollSuspend'), 'scrollToBottom 应受批量挂载抑制（_scrollSuspend）');
  assert(src.includes('withScrollAnchor'), 'prepend 翻页应有滚动锚定（withScrollAnchor）');
});

regression('BAR-ORB-PANEL-04', 'drag-handler', '拖拽期挂起面板 backdrop-filter，收尾恢复（含 pointercancel）', () => {
  const src = readFileSync('src/client/modules/orb.ts', 'utf-8');
  assert(src.includes('_suspendPanelBlur') && src.includes('_restorePanelBlur'), '应有拖拽期模糊挂起/恢复');
  const dh = readFileSync('src/client/modules/drag-handler.ts', 'utf-8');
  // pointercancel 提前 return 曾是收尾漏洞：模糊挂起后永不恢复
  const cancelBranch = dh.split("e?.type === 'pointercancel'")[1]?.split('return;')[0] || '';
  assert(cancelBranch.includes('onSavePosition'), 'pointercancel 分支必须调 onSavePosition（收尾钩子）');
});

regression('BAR-ORB-PANEL-05', 'orb.ts', '拖拽时面板跟随光球（rAF 合帧），不整帧跳过', () => {
  const src = readFileSync('src/client/modules/orb.ts', 'utf-8');
  // 226c2fb 曾整体跳过拖拽期面板更新治卡顿（治标），破坏「面板随光球移动」设计契约
  const moveBody = (src.split('onMoveNormal(')[1]?.split('onMoveEditing(')[0] || '')
    .split('\n').filter(l => !l.trimStart().startsWith('//')).join('\n');
  assert(moveBody.includes('updatePanelPosition'), 'onMoveNormal 应 rAF 合帧更新面板位置（面板随光球移动）');
  assert(!moveBody.includes('_renderChat'), '拖拽期间不调 _renderChat（scrollHeight=强制 reflow，松手后统一滚）');
});


// ==========================================================================
// 第八批前置：v8.1 交互回归修复（v7 契约恢复，源码断言钉子）
// ==========================================================================

regression('BAR-ORB-PANEL-06', 'orb.ts', '流式滚动 followBottom 门控：上滑浏览不被拽回底部', () => {
  const src = readFileSync('src/client/modules/orb.ts', 'utf-8');
  // v8.0 回归：_renderChat(scrollMode) 收参但忽略、无条件滚底——用户上滑看历史时
  // 每个流式事件都拽回底部。v7 契约：follow 强制 / auto 门控 / preserve 不动。
  assert(src.includes("scrollMode === 'auto' && getFollowBottom()"), 'auto 模式必须 followBottom 门控');
  assert(src.includes("scrollMode === 'follow'"), 'follow 模式必须显式强制追底');
  const hints = readFileSync('src/client/modules/orb-chat-hints.ts', 'utf-8');
  const waitBody = hints.split('export function startWaitingIndicator')[1]?.split('return function stop')[0] || '';
  assert(waitBody.includes('getFollowBottom()'), '等待提示滚底必须 followBottom 门控（v7 注释明示的契约）');
});

regression('BAR-ORB-PANEL-07', 'orb-chat-hints', 'Todo 面板：渲染接通 + 全部完成后才 5s 淡出', () => {
  const src = readFileSync('src/client/modules/orb-chat-hints.ts', 'utf-8');
  // v8 拆分搬运事故：updateTodoFromTool 只写 _lastTodos 不调 renderTodoPanel → 面板永不出现
  const updBody = src.split('export function updateTodoFromTool')[1] || '';
  assert(updBody.includes('renderTodoPanel('), 'updateTodoFromTool 必须接通 renderTodoPanel');
  // dismiss 分支曾写反（进行中 5s 消失、全完成常驻）。正确：allDone → 5s 淡出；进行中 → 常显
  const todoBody = src.split('function renderTodoPanel')[1] || '';
  const allDoneBranch = todoBody.split('if (allDone)')[1]?.split('} else')[0] || '';
  assert(allDoneBranch.includes('setTimeout'), 'allDone 分支必须安排 5s 淡出（而非常驻）');
});


// ==========================================================================
// 第八批：v8.1 第二批 — 交互恢复 + 运行时/构建优化（源码断言钉子）
// ==========================================================================

group('v8.1 第二批 — 交互恢复 + 运行时/构建优化');

regression('BAR-ORB-PANEL-08', 'chat-dom', '复制按钮委托 + 打字机 reveal + 摸鱼提示轮换（v7 行为恢复）', () => {
  const src = readFileSync('src/client/modules/chat-dom.ts', 'utf-8');
  // v8.0 复制按钮只创建未接处理（纯装饰）；打字机/摸鱼轮换是 v7 特性被砍
  assert(src.includes('.orb-copy-btn') && src.includes('clipboard'), '复制按钮必须有事件委托处理');
  assert(src.includes('_typewriterReveal'), '工具结果应有打字机 reveal（v7.2.0 特性）');
  const trBody = src.split("case 'tool_result'")[1]?.split("case 'rule_warning'")[0] || '';
  assert(trBody.includes('details, true'), '实时 tool_result 必须传 animate=true（历史挂载才直渲最终态）');
  assert(src.includes('_hintTimers'), '执行期摸鱼提示应轮换（_hintTimers）');
  const clearBody = src.split('export function clearChatDom')[1]?.split('\n}')[0] || '';
  assert(clearBody.includes('_hintTimers.clear()'), 'clearChatDom 必须清轮换计时器（防泄漏）');
});

regression('BAR-ORB-PANEL-09', 'chat-dom', '流式滚动 rAF 合批（每 delta 强制 reflow 根除）', () => {
  const src = readFileSync('src/client/modules/chat-dom.ts', 'utf-8');
  // 每个 text_delta 同步 scrollToBottom = 每个 delta 一次强制同步布局
  const ms = src.split('function _maybeScroll')[1]?.split('\n}')[0] || '';
  assert(ms.includes('_scrollRafScheduled') && ms.includes('requestAnimationFrame'), '_maybeScroll 必须 rAF 合批而非同步滚动');
  // scrollToBottom 本身必须保持同步（expandPanel/resumeScroll 依赖立即滚动）
  const st = src.split('export function scrollToBottom')[1]?.split('\n}')[0] || '';
  assert(!st.includes('requestAnimationFrame'), 'scrollToBottom 不得改异步（显式调用方依赖同步语义）');
});

regression('BAR-CARD-BLUR-01', 'floating-card', '浮卡拖拽期挂起 backdrop-filter（blur 16px 每帧重算是拖动卡顿主因）', () => {
  const src = readFileSync('src/client/modules/floating-card.ts', 'utf-8');
  assert(src.includes('_suspendCardBlur') && src.includes('_restoreCardBlur'), '应有拖拽期模糊挂起/恢复（orb 同款模式）');
  const saveBody = src.split('onSavePosition()')[1]?.split('}')[0] || '';
  assert(saveBody.includes('_restoreCardBlur'), 'onSavePosition 必须恢复模糊（pointercancel 由 drag-handler 保证到达）');
});

regression('BAR-LEAK-01', 'config.card', 'config.card 三个 window 监听必须在 deactivate 移除', () => {
  const src = readFileSync('src/client/cards/plugins/config.card.ts', 'utf-8');
  // 曾只挂不摘：每次激活泄漏 3 个闭包（持过期 editingConfig/select 引用）
  assert(src.includes('_onSessionChange') && src.includes('_onProviderChange') && src.includes('_onModelChange'), 'handler 必须存字段（匿名函数无法移除）');
  const deact = src.split('deactivate')[1] || '';
  assert(deact.includes('removeEventListener'), 'deactivate 必须 removeEventListener');
});

regression('BAR-LEAK-02', 'session.card', 'session.card 的 kfm-session-change 监听必须在 deactivate 移除', () => {
  const src = readFileSync('src/client/cards/plugins/session.card.ts', 'utf-8');
  assert(src.includes('_onExternalSessionChange'), 'handler 必须存字段（匿名函数无法移除）');
  const deact = src.split('deactivate')[1] || '';
  assert(deact.includes('removeEventListener'), 'deactivate 必须 removeEventListener');
});

regression('BAR-LEAK-03', 'tree-render', 'window resize 监听只注册一次（曾每次开侧栏叠加一个）', () => {
  const src = readFileSync('src/client/modules/tree-render.ts', 'utf-8');
  assert(src.includes('_ensureResizeListener'), '应有单次注册守卫');
  const anon = src.split('\n').filter(l => l.includes("addEventListener('resize'") && !l.includes('_onWindowResize'));
  assert(anon.length === 0, 'resize 监听必须用具名 handler（匿名注册无法移除、开 N 次挂 N 个）');
});

regression('BAR-ENGINE-01', 'renderer', '行高 measureText 按字体缓存（曾每个文本 Box 每帧测量）', () => {
  const src = readFileSync('src/client/engine/v2/renderer.ts', 'utf-8');
  assert(src.includes('_fontMetricsCache'), '应有字体度量缓存（60fps 全量重绘下每 Box 每帧测量是大头）');
});

regression('BAR-BUILD-01', 'build.mjs', 'esbuild 必须 minify + 版本号 query 不叠加', () => {
  const src = readFileSync('build.mjs', 'utf-8');
  assert((src.match(/minify: true/g) || []).length >= 2, 'client/server 两处 esbuild 都必须 minify（1.9MB→1.07MB）');
  const html = readFileSync('public/index.html', 'utf-8');
  assert(!/\?v=\d+\?v=/.test(html), 'index.html 不应有双重 ?v= 畸形 query（正则曾吞不掉旧 query）');
});

regression('BAR-BUILD-02', 'server/index', 'gzip 排除 SSE + 不挂载仓库根目录', () => {
  const src = readFileSync('src/server/index.ts', 'utf-8');
  assert(src.includes('compression('), '应有 gzip compression 中间件');
  assert(src.includes("'/ai/'"), 'compression filter 必须排除 /ai/（SSE 流式不能被缓冲）');
  assert(!src.includes("express.static(path.join(__dirname, '../..'))"), '禁止重新挂载仓库根目录（.git/src/node_modules 曾暴露 HTTP）');
});
