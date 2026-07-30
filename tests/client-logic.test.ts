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
import { promoteReasoningBlocks } from '../src/shared/message-normalize.js';
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

regression('BAR-ORB-SEG-02', 'orb-chat-host.ts', '切换 guard 用 _renderedSessionId，不用 sessionStore.activeId', () => {
  const src = readFileSync('src/client/modules/orb-chat-host.ts', 'utf-8');
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

regression('BAR-ORB-PANEL-02', 'orb-chat-host.ts', '历史挂载窗口化：首屏只挂尾部窗口，滚动翻页 prepend', () => {
  const src = readFileSync('src/client/modules/orb-chat-host.ts', 'utf-8');
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

regression('BAR-ORB-PANEL-06', 'orb-chat-host.ts', '流式滚动 followBottom 门控：上滑浏览不被拽回底部', () => {
  const src = readFileSync('src/client/modules/orb-chat-host.ts', 'utf-8');
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

group('v8.1 第三批 — 线上事故修复');

regression('BAR-ORB-PANEL-10', 'chat-dom', '消息必须插到等待提示之前（hint 恒在尾部）', () => {
  const src = readFileSync('src/client/modules/chat-dom.ts', 'utf-8');
  // orb.ts 在 doSend 前即 setWait(true)，hint 先于用户消息挂载；
  // appendChild 会把消息插到 hint 之后 → hint 跑到用户消息上方（线上事故）
  const body = src.split('function _createMsgContainer')[1]?.split('\n}')[0] || '';
  assert(body.includes("#orb-waiting-hint") && body.includes('insertBefore(msgEl, hint)'),
    '非 prepend 分支必须 insertBefore(msgEl, hint) 而非 appendChild');
});

regression('BAR-BUILD-03', 'build.mjs', 'CJS 依赖必须 external（ESM 产物 Dynamic require 崩溃）', () => {
  const src = readFileSync('build.mjs', 'utf-8');
  // compression 被打进 ESM bundle → 其 CJS 依赖 require("buffer") → 启动即崩，
  // systemd 重启风暴 76 次、全站 502（kfm-restart 后服务再也起不来）
  const extLine = src.split('external: [')[1]?.split(']')[0] || '';
  assert(extLine.includes("'compression'"), "server 构建 external 必须含 'compression'");
});

group('v8.1 第四批 — 思考框折叠 + 流式实时 MD');

regression('BAR-ORB-PANEL-11', 'chat-dom', '思考框自动折叠：正文开始/工具结果/消息结束三路径', () => {
  const src = readFileSync('src/client/modules/chat-dom.ts', 'utf-8');
  // 曾只有 tool_result 路径折叠——纯文本回复的思考框永远摊着（用户须手动点）
  assert(src.includes('function _autoCollapseThinking'), '应有统一的思考框自动折叠 helper');
  const tdBody = src.split("event.deltaType === 'text_delta'")[1]?.split("input_json_delta")[0] || '';
  assert(tdBody.includes('_autoCollapseThinking'), '首个 text_delta（思考结束）必须触发折叠');
  const msBody = src.split("case 'message_stop'")[1]?.split("case 'error'")[0] || '';
  assert(msBody.includes('_autoCollapseThinking'), 'message_stop 必须有折叠兜底');
  assert(src.includes("_foldState.get('r' + mi)"), '折叠必须尊重用户手动展开状态');
});

regression('BAR-ORB-PANEL-12', 'chat-dom', '流式实时 MD：节流轻管线 + final 全管线不被覆盖', () => {
  const src = readFileSync('src/client/modules/chat-dom.ts', 'utf-8');
  // 曾是 textContent 裸奔 md 源码、content_block_stop 时突变成渲染态
  assert(src.includes('_scheduleStreamingMd'), '应有流式 MD 节流渲染');
  const fnBody = src.split('function _scheduleStreamingMd')[1]?.split('\n}')[0] || '';
  assert(fnBody.includes('marked.parse') && !fnBody.includes('preprocessMd') && !fnBody.includes('renderMermaid'),
    '流式必须走轻管线（marked+高亮，跳过 KaTeX/mermaid 后处理）');
  assert(fnBody.includes('_mdCache') === false, '流式部分渲染不得进 _mdCache（防缓存污染）');
  const stopBody = src.split("case 'content_block_stop'")[1]?.split("case 'tool_result'")[0] || '';
  assert(stopBody.includes('_cancelStreamingMd'), 'final 全管线渲染前必须取消流式计时器（防轻管线覆盖）');
  const clearBody = src.split('export function clearChatDom')[1]?.split('\n}')[0] || '';
  assert(clearBody.includes('_streamMdTimers.clear()'), 'clearChatDom 必须清流式计时器（防泄漏）');
});

group('v8.1 第五批 — v7 丢失细节三连（真机发现）');

regression('BAR-ORB-PANEL-13', 'chat-dom', '思考框折叠必须挂在 orb-fold-content 类上（collapsed 才有 CSS 效果）', () => {
  const src = readFileSync('src/client/modules/chat-dom.ts', 'utf-8');
  // 曾用 orb-fold-open 类 + collapsed——但 .collapsed 的 CSS 只定义在
  // .orb-fold-content.collapsed 上，orb-fold-open.collapsed 无任何规则：
  // 历史思考框显示 ▶ 标记却摊开着，点击也无法折叠（toggle 了一个无效果的类）
  const fnBody = src.split('function _createThinkingBlock')[1]?.split('\n}')[0] || '';
  assert(fnBody.includes("'orb-fold-content'") && !fnBody.includes("'orb-fold-open'"),
    '思考框折叠容器必须用 orb-fold-content 类');
  const mountBody = src.split('export function mountAiMessage')[1] || '';
  assert(!mountBody.includes("remove('orb-fold-open')"), '历史挂载不得再移除 orb-fold-open（死机制残留）');
  // orb-fold-open 已无任何 JS 引用 → SCSS 中应已清除（死 CSS 是丢失细节的藏身处）
  const scss = readFileSync('public/css/base.scss', 'utf-8');
  assert(!scss.includes('.orb-fold-open'), 'base.scss 不应残留死类 .orb-fold-open');
});

regression('BAR-ORB-PANEL-14', 'chat-dom', '摸鱼提示只在工具执行期：_createToolCard 不得启动轮换', () => {
  const src = readFileSync('src/client/modules/chat-dom.ts', 'utf-8');
  // 曾在 _createToolCard 无条件 setInterval——历史挂载的已完成工具没有清计时器
  // 路径，提示每 1.5s 覆盖真实输出；卡片折叠再展开提示还在滚
  const cardBody = src.split('function _createToolCard')[1]?.split('\n}')[0] || '';
  assert(!cardBody.includes('setInterval') && !cardBody.includes('_startToolHint'),
    '_createToolCard 不得启动提示轮换（历史挂载路径无人清）');
  assert(src.includes('function _startToolHint') && src.includes('function _stopToolHint'), '应有统一的提示启停 helper');
  const mountBody = src.split('export function mountAiMessage')[1] || '';
  assert(mountBody.includes('_startToolHint'), '历史挂载的执行中工具（无 result）才允许起提示');
});

regression('BAR-ORB-PANEL-15', 'base.scss', 'orb-hint-pulse keyframes 必须在静态 CSS（非 JS 运行时注入）', () => {
  const scss = readFileSync('public/css/base.scss', 'utf-8');
  assert(scss.includes('@keyframes orb-hint-pulse'), 'keyframes 必须在 base.scss 静态定义');
  const hints = readFileSync('src/client/modules/orb-chat-hints.ts', 'utf-8');
  assert(!hints.includes('orb-hint-css'), '禁止恢复 JS 注入 <style> 的老机制（未触发等待提示的页面 keyframes 缺失，脉冲不播）');
});

group('v8.1 第六批 — v7 丢失细节全量恢复（v7.3.3 审计驱动，18 项）');

regression('BAR-ORB-PANEL-16', 'orb-chat-run', '兜底消息必须上屏 + 取消时工具卡 DOM 收尾', () => {
  const run = readFileSync('src/client/modules/orb-chat-run.ts', 'utf-8');
  // v8 曾只 push 数据层：「请求失败/已取消/未收到回复」用户看不到，刷新才冒出来
  assert(run.includes('mountFallbackAiMessage'), '兜底消息必须调 mountFallbackAiMessage 上屏');
  const aborts = run.split('AbortError');
  assert(aborts.length >= 3, 'doSend/resumeRun 两处 AbortError 分支都应在');
  assert((run.match(/settleToolCardsDom\('\(已取消\)'\)/g) || []).length >= 2,
    '两处取消分支都必须 settleToolCardsDom（曾工具卡永远"忙碌中"+提示无限轮转）');
  const orb = readFileSync('src/client/modules/orb-chat-host.ts', 'utf-8');
  assert(orb.includes('mountFallbackAiMessage'), 'onConfigMissing 兜底必须上屏');
});

regression('BAR-ORB-PANEL-17', 'chat-dom', '思考块懒创建（非思考模型不留幽灵"已思考"空条）', () => {
  const src = readFileSync('src/client/modules/chat-dom.ts', 'utf-8');
  const startBody = src.split("case 'content_block_start'")[1]?.split("case 'content_block_delta'")[0] || '';
  assert(!startBody.includes('_createThinkingBlock'), 'block start 不得建思考块（v7：reasoning 非空才渲染）');
  const tdBody = src.split("event.deltaType === 'thinking_delta'")[1]?.split("event.deltaType === 'text_delta'")[0] || '';
  assert(tdBody.includes('_createThinkingBlock'), '首个 thinking_delta 必须懒创建思考块');
});

regression('BAR-ORB-PANEL-18', 'chat-dom', '并行工具 input_json 按 event.index 路由（不灌最后一张卡）', () => {
  const src = readFileSync('src/client/modules/chat-dom.ts', 'utf-8');
  assert(src.includes('_blockToolIds'), '应有 block index → blockId 路由表');
  const deltaBody = src.split("input_json_delta'")[1]?.split("case 'content_block_stop'")[0] || '';
  assert(deltaBody.includes('_blockToolIds.get'), 'input_json_delta 必须按 event.index 路由');
  const stopBody = src.split('blockIdx > 0')[1]?.split("case 'tool_result'")[0] || '';
  assert(stopBody.includes('_blockToolIds.get') && stopBody.includes('null, 2'),
    'block stop 必须按 index 找卡 + pretty-print 后再高亮（v7 行为）');
});

regression('BAR-ORB-PANEL-19', 'chat-dom', 'read 读 .md 富渲染 + mermaid 不进缓存', () => {
  const src = readFileSync('src/client/modules/chat-dom.ts', 'utf-8');
  assert(src.includes('orb-tool-md'), 'read .md 必须走 orb-tool-md 富渲染（CSS 曾成死代码）');
  const rmBody = src.split('function _renderMarkdown')[1]?.split('\n}')[0] || '';
  assert(rmBody.includes('hasMermaid'), '含 mermaid 的文本不得读写 _mdCache（SVG 未就绪存半成品）');
});

regression('BAR-ORB-PANEL-20', 'orb', 'Todo 面板历史恢复 + 面板展开追底门控', () => {
  const host = readFileSync('src/client/modules/orb-chat-host.ts', 'utf-8');
  const mhwBody = host.split('function _mountHistoryWindow')[1]?.split('\n}')[0] || '';
  assert(mhwBody.includes('_restoreTodoPanel()'), '历史窗口重挂末尾必须调 _restoreTodoPanel（刷新/切会话面板曾消失）');
  const rtpBody = host.split('function _restoreTodoPanel')[1]?.split('\n}')[0] || '';
  assert(rtpBody.includes('updateTodoFromTool'), '_restoreTodoPanel 必须从数据层找回 todo 结果重挂');
  const src = readFileSync('src/client/modules/orb.ts', 'utf-8');
  const epBody = src.split('function expandPanel')[1]?.split('\n}')[0] || '';
  assert(epBody.includes('getFollowBottom()'), 'expandPanel 不得无条件追底（上滑浏览位置曾丢失）');
});

regression('BAR-ORB-PANEL-21', 'chat-dom', '细节组：滑入动画/打字机滚底/放完才折/空输入隐藏', () => {
  const src = readFileSync('src/client/modules/chat-dom.ts', 'utf-8');
  assert(src.includes('orb-msg-new'), 'live 新消息必须有滑入动画类（CSS 曾无使用者）');
  const twBody = src.split('function _typewriterReveal')[1]?.split('\n}')[0] || '';
  assert(twBody.includes('scrollTop = el.scrollHeight'), '打字机 reveal 期间必须滚底（长输出停在开头）');
  const trBody = src.split("case 'tool_result'")[1]?.split("case 'rule_warning'")[0] || '';
  assert(trBody.includes('onDone') || trBody.includes('_foldState.get(blockId'), '折叠必须在输出放完后（曾 340ms 折进 500ms 打字机）');
  assert(!trBody.includes('setTimeout('), '禁止恢复定时折叠（必须由渲染完成回调触发）');
  assert(src.includes('_hideEmptyToolInput'), '无参数工具必须隐藏输入区+分隔线');
});

regression('BAR-BUILD-04', 'build/check', 'check-css-wiring 永久接线检查必须挂在构建链', () => {
  // v8.3 链单源化后：唯一出处是 chain.mjs STEPS，build.mjs/package.json 均委托 chain
  const chain = readFileSync('scripts/check/chain.mjs', 'utf-8');
  assert(chain.includes('check-css-wiring'), 'chain.mjs STEPS 必须跑 check-css-wiring');
  assert(chain.indexOf('sass') < chain.indexOf('check-css-wiring'), 'check-css-wiring 必须排在 sass 之后');
  const script = readFileSync('scripts/check/check-css-wiring.mjs', 'utf-8');
  assert(script.includes('@keyframes') && script.includes('scss'), '脚本必须双向检查类与 keyframes');
});

regression('BAR-ORB-PANEL-22', 'orb-chat-hints', 'Todo 面板手动 ✕ 关闭必须持久化（刷新不再自动弹出）', () => {
  const src = readFileSync('src/client/modules/orb-chat-hints.ts', 'utf-8');
  // 曾 ✕ 只清内存：_restoreTodoPanel 刷新后从数据层找回结果重挂，关不掉
  assert(src.includes('function dismissTodoPanel') && src.includes('TODO_DISMISS_KEY'), '应有 dismissTodoPanel + localStorage 关闭记录');
  assert(src.includes('__dismissTodoPanel'), '✕ onclick 必须走 dismiss（非会话切换的 clearTodoPanel）');
  const utBody = src.split('export function updateTodoFromTool')[1] || '';
  assert(utBody.includes('dismissed === fp'), '同指纹列表（刷新恢复）必须跳过渲染');
  assert(utBody.includes('removeItem(TODO_DISMISS_KEY)'), '新列表（指纹不同）必须清除关闭记录并恢复显示');
});

// ========== 第十三批：工具 I/O 上下文压缩（v8.1.0）==========
// 契约 docs/design/TOOL_IO_COMPACTION.md。压缩器本体行为由 tests/tool-compaction.test.ts
// 覆盖（34 例）；此处钉的是「接线」——doSend 压缩管线 + check 脚本挂构建链。

regression('BAR-COMPACT-01', 'to-openai-messages', '工具 I/O 压缩接线（G1/G4/逃生门/观测日志）——载荷唯一构造函数', () => {
  // BAR-ORB-RESUME-01 后：压缩/G1/G4 全收编 shared 唯一构造函数，调用层只剩逃生门与观测
  const shared = readFileSync('src/shared/chat-protocol/to-openai-messages.ts', 'utf-8');
  assert(shared.includes("from '../tool-compaction/index.js'"), '载荷构造必须引用压缩器注册表');
  assert(shared.includes('compactExemptFrom'), 'G1：最近 2 条 AI 消息豁免压缩');
  assert(shared.includes('lastTodoResultId'), 'G4：最新 todo 工具结果豁免（当前任务状态）');
  assert(shared.includes('compactToolInput') && shared.includes('compactToolResult'), '入参与结果双路压缩');
  const src = readFileSync('src/client/modules/orb-chat-run.ts', 'utf-8');
  assert(src.includes("localStorage.getItem('kfm-no-compact')"), '应有 kfm-no-compact 灰度逃生门');
  assert(src.includes('[compact]'), '应有压缩观测日志（前后 KB 对比）');
  // saveMessages 优化：仅新会话全量上传（老会话服务端 /ai/chat/start 自己 appendUserMessage）
  const saveBody = src.split('sessionStore.saveMessages')[0] || '';
  assert(saveBody.includes('if (!sessionStore.activeId)'), 'saveMessages 必须仅新会话才调用（每轮全量上传曾 90% 冗余）');
});

regression('BAR-COMPACT-02', 'build/check', 'check-tool-compaction 双向核对必须挂在构建链', () => {
  // v8.3 链单源化后：唯一出处是 chain.mjs STEPS，build.mjs/package.json 均委托 chain
  const chain = readFileSync('scripts/check/chain.mjs', 'utf-8');
  assert(chain.includes('check-tool-compaction'), 'chain.mjs STEPS 必须跑 check-tool-compaction');
  const script = readFileSync('scripts/check/check-tool-compaction.mjs', 'utf-8');
  assert(script.includes('COMPACTOR_REGISTRY') && script.includes('tools/index.ts'),
    '脚本必须双向核对：注册工具 ↔ 压缩器登记（新增工具不登记 = 构建中断）');
});

regression('BAR-PROVIDER-01', 'ai/chat', 'tool 消息 content 必须字符串化 + 上游错误体透传（kimi 严格端点 400 根因）', () => {
  const src = readFileSync('src/server/ai/chat.ts', 'utf-8');
  // 根因：tool 结果 content 以结构化对象透传，宽松 provider 容忍、严格 provider（kimi）400。
  assert(src.includes('JSON.stringify(m.content)'), '非字符串 content 必须 JSON.stringify（OpenAI 规范 tool.content 是 string）');
  assert(src.includes("out.content == null"), 'tool 消息 null content 必须兜底为空串');
  assert(src.includes('errBody'), '上游错误体必须透传（只报状态码 = 扔掉诊断）');
});

regression('BAR-PROVIDER-02', 'ai/chat', '空壳 assistant 消息（纯思考/取消残留）不进 API 载荷（kimi 400 must not be empty）', () => {
  const client = readFileSync('src/shared/chat-protocol/to-openai-messages.ts', 'utf-8');
  assert(client.includes('if (mainText && !isClientArtifact(mainText))'), '客户端必须跳过零正文/产物占位 assistant');
  const server = readFileSync('src/server/ai/chat.ts', 'utf-8');
  assert(server.includes("m.content == null || m.content === ''"), '服务端边界必须过滤空 assistant（fail-closed）');
});

regression('BAR-BUILD-05', 'build/deploy', '版本握手：build 写 dist/build-info.json + /api/system/info 暴露 buildInfo（防旧包白诊断）', () => {
  const build = readFileSync('build.mjs', 'utf-8');
  assert(build.includes('build-info.json') && build.includes('buildTime'), 'build.mjs 必须写构建信息（版本握手真相源）');
  const routes = readFileSync('src/server/routes/files.ts', 'utf-8');
  assert(routes.includes('buildInfo'), '/api/system/info 必须暴露 buildInfo（运行进程包版本可查证）');
  const deploy = readFileSync('scripts/deploy.sh', 'utf-8');
  assert(deploy.includes('kfm-restart.sh') && deploy.includes('system/info'), 'deploy.sh 必须 构建→重启→握手 三步闭环');
});

regression('BAR-ORB-EMPTY-01', 'message-normalize', '回复错放 reasoning（text 空）正常结束必须归位为正文', () => {
  // 纯函数行为：空 text + 有 reasoning → 归位；有正文 → 不动；无 reasoning → 不动
  const b1 = [{ type: 'text', text: '', reasoning: '真正的回复' }];
  promoteReasoningBlocks(b1);
  assert(b1[0].text === '真正的回复' && b1[0].reasoning === '', '空 text 有 reasoning 必须归位');
  const b2 = [{ type: 'text', text: '已有正文', reasoning: '思考' }];
  promoteReasoningBlocks(b2);
  assert(b2[0].text === '已有正文' && b2[0].reasoning === '思考', '有正文不得改动（G5）');
  const b3 = [{ type: 'text', text: '', reasoning: '' }];
  promoteReasoningBlocks(b3);
  assert(b3[0].text === '', '取消残留的空壳不归位（留作真实历史）');
  // 接线：正常结束点 + 历史加载点都必须调用
  const run = readFileSync('src/client/modules/orb-chat-run.ts', 'utf-8');
  assert(run.includes('promoteReasoningBlocks(messages[msgIdx]'), 'message_stop（正常结束）必须归位');
  const sc = readFileSync('src/client/modules/session-client.ts', 'utf-8');
  assert(sc.includes('promoteReasoningBlocks(m.content'), '历史加载必须读时归一化');
});

// ==========================================================================
// 2026-07-29 bug 堆批次（测绘漂移结案：canvas-tree#7/#8、server#12、client-shell#15）
// ==========================================================================

regression('BAR-RENAME-01', 'eed2baf', 'rename 成功必须刷新文件树 + 检查响应（成因C 权宜，出生即无刷新）', () => {
  const src = readFileSync('src/client/modules/file-action-bar.ts', 'utf-8');
  const submit = src.slice(src.indexOf('async function submit()'));
  assert(submit.includes('data.success'), 'rename 必须检查响应 success');
  assert(submit.includes('loadFileTree(KFMState.currentRoot)'), 'rename 成功后必须刷新文件树');
});

regression('BAR-DELETE-01', 'cafcb58', 'tree-swipe delete 必须检查响应（成因C 权宜，copy/move 都查唯独 delete 不查）', () => {
  const src = readFileSync('src/client/modules/tree-swipe.ts', 'utf-8');
  const del = src.slice(src.indexOf("mode === 'delete'"));
  assert(del.includes('data.success'), 'delete 分支必须解析响应并检查 success');
});

regression('BAR-PROXY-01', '678c6d2', 'proxy 非流式分支 method 未传/GET/HEAD 不得带 body（fetch TypeError）', () => {
  const src = readFileSync('src/server/routes/proxy.ts', 'utf-8');
  assert(src.includes("!method || method === 'GET' || method === 'HEAD'"), 'method 缺省必须归入无 body 分支');
});

regression('BAR-DEBUG-01', '4e59339', 'debugger 语句不得随生产包发布（devtools 打开即冻结页面）', () => {
  const src = readFileSync('src/client/modules/debug-assert.ts', 'utf-8');
  assert(!src.includes('debugger;'), 'debug-assert 不得含 debugger 语句');
});

regression('BAR-RESTART-GUARD-01', '8b1dc57', '/api/system/restart 挂 verifyLocalOrigin（成因E，机制出生未接入）', () => {
  const src = readFileSync('src/server/index.ts', 'utf-8');
  assert(src.includes("app.post('/api/system/restart', verifyLocalOrigin,"), 'restart 端点必须挂跨源防护');
});

// ==========================================================================
// 2026-07-29 bug 堆批次二（floating-card 域：#17/#18/#20 结案）
// ==========================================================================

regression('BAR-SAVE-01', '0b12122', '失焦静默保存不得吞错——失败必须 toast + 不切预览保住文本（成因C 权宜）', () => {
  const src = readFileSync('src/client/modules/renderers/handler-factory.ts', 'utf-8');
  assert(src.includes('data.success'), '_doSave 必须检查响应 success');
  assert(src.includes('showCardToast'), '_doSave 失败必须 toast 让用户感知');
  assert(!src.includes('catch { /* swallow */ }'), '不得吞 catch（静默丢写根源）');
  assert(src.includes('if (!await _doSave(newContent)) return;'), '保存失败不得切预览（保住用户文本）');
});

regression('BAR-RECONNECT-01', 'b2f74bc', 'tmux 卡 WS 重连不得走通用 terminal-open（一次重连双 PTY 孤儿）', () => {
  const src = readFileSync('src/client/modules/terminal-card-04.ts', 'utf-8');
  const cb = src.slice(src.indexOf('const onReconnect = () =>'));
  assert(cb.includes("terminalName === 'tmux'"), '通用重连回调必须对 tmux 卡早退（tmux 由 tmux-card 另行重开）');
});

regression('BAR-FLOAT-Z-01', '1a9a3ec', '浮卡 z-index 不变量：item.zIndex 与 DOM 全程一致（发射不得覆写发散）', () => {
  const src = readFileSync('src/client/modules/floating-card.ts', 'utf-8');
  assert(!src.includes('LAUNCH_Z_ABOVE_STACK'), '不得另算发射 z 覆写 DOM（_allocZ 单调递增天然在上）');
});
