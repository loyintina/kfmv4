// ==========================================================================
// tests/client-logic.test.ts — 客户端纯逻辑回归钉子（步骤 4）
//
// 覆盖三块「有明确对错、可离线测」的客户端逻辑：
//   1. 会话消息计数（BAR-103）        session-store.countTextMessages
//   2. 临时卡组模式着色（427c960）     mode-system.recolorCards
//   3. 文件树构建边界                  tree-model.buildTree
//
// 方法论见 docs/design/REGRESSION_TESTING_SYSTEM.md 步骤 4。
// ==========================================================================

import assert from 'assert';
import { group, test, regression } from './runner.js';
import { extractMessageText, countTextMessages } from '../src/client/modules/session-store.js';
import type { SessionMessage } from '../src/client/modules/session-store.js';
import { recolorCards, getModeTheme, getTriColor } from '../src/client/modules/mode-system.js';
import { buildTree } from '../src/client/modules/tree-model.js';
import { KFMState, type FileNode } from '../src/client/modules/state.js';
import { _cullWeight, type ChatMessage } from '../src/client/modules/orb-chat.js';

// ==========================================================================
// BAR-103 (b8dec96 / 1d9fdbc): 消息计数只算「有正文」的消息
// 纯工具调用 / 纯思考气泡不计入；删空会话归零。
// ==========================================================================

group('session-store — 消息计数（BAR-103）');

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

regression('BAR-MSG-NULL', 'session-store', 'content 含 null block 不崩溃（AI 只调工具不说话）', () => {
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

regression('BAR-ORB-FOLLOW-01', 'orb-chat', '追底用手势判定意图，不用 suppressScroll 时间窗口', () => {
  const src = readFileSync('src/client/modules/orb-chat.ts', 'utf-8');
  // 反复回归4次的根因：suppressScroll 时间窗口吞掉流式期间用户上滑的 scroll 事件。
  // 已删除，不应复活。必须用 touchmove/wheel 手势直接判定意图。（排除注释行——历史说明可保留）
  const codeLines = src.split('\n').filter(l => !l.trimStart().startsWith('//'));
  assert(!codeLines.some(l => l.includes('suppressScroll')), 'suppressScroll 反模式已废弃，不应复活（会吞掉流式期间的上滑事件）');
  assert(src.includes("addEventListener('touchmove'"), '应监听 touchmove 判定用户上滑意图');
  assert(src.includes("addEventListener('wheel'"), '应监听 wheel 判定桌面滚轮上滑');
  // followBottom 标志仍是追底判定核心
  assert(src.includes('followBottom'), '应保留 followBottom 追底标志');
});

regression('BAR-ORB-FOLLOW-02', 'orb-chat', '等待提示尊重 followBottom，不无条件抢追底', () => {
  const src = readFileSync('src/client/modules/orb-chat.ts', 'utf-8');
  // 遗漏的绕过口：startWaitingIndicator 曾无条件 followBottom=true + scrollToBottom，
  // 工具轮次每轮 onWait(true) 都强制追底，破坏用户上滑浏览。
  // 提取 startWaitingIndicator 函数体，其内的 scrollToBottom 必须有 followBottom 守卫。
  const fnStart = src.indexOf('export function startWaitingIndicator');
  assert(fnStart >= 0, '应有 startWaitingIndicator');
  // 函数体到行首单独 } 为止（函数结束），不跨到后续函数
  const bodyEnd = src.indexOf('\n}\n', fnStart);
  const body = src.slice(fnStart, bodyEnd > 0 ? bodyEnd : src.length);
  // body 内不应有无条件 followBottom=true（那是强制抢追底的根源）
  const bodyCode = body.split('\n').filter(l => !l.trimStart().startsWith('//')).join('\n');
  assert(!bodyCode.includes('followBottom = true'), 'startWaitingIndicator 不应无条件设 followBottom=true（会抢用户上滑取消的追底）');
  // 若调 scrollToBottom，必须在 if (followBottom) 守卫下
  if (bodyCode.includes('scrollToBottom')) {
    assert(bodyCode.includes('if (followBottom)'), 'startWaitingIndicator 的 scrollToBottom 必须有 if (followBottom) 守卫');
  }
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

regression('BAR-ORB-SEG-04', 'orb-chat', 'preserve 模式用锚点保持，免疫高度估算失配', () => {
  const src = readFileSync('src/client/modules/orb-chat.ts', 'utf-8');
  // 根因：视口裁剪用 DEFAULT_MSG_H 估算未测量消息高度，上滑跨裁剪边界时真实高度≠估算，
  // 旧的 padding 差值补偿突变 → scrollTop 突跳。改为锚点法：重建前记视口顶部消息 + 偏移，
  // 重建后锚回同一真实元素位置。三步缺一就静默退化，故逐一断言。
  // 1. 重建前捕捉锚点（消息绝对索引 + 相对偏移）
  assert(src.includes('anchorMi') && src.includes('anchorOffset'), '应捕捉锚点消息索引 anchorMi + 偏移 anchorOffset');
  // 2. 重建后按 anchorMi 查找同一真实元素
  assert(/anchorEl\s*=\s*contentArea\.querySelector/.test(src), '重建后应按 anchorMi 查找同一 .orb-msg 元素 anchorEl');
  // 3. 锚点仅在 preserve 模式生效（follow/auto 各有自己的滚动策略）
  assert(src.includes("scrollMode === 'preserve'"), '锚点保持应在 preserve 分支内');
  // 锚点查找失败时回退到 padding 差值补偿（scrollAdjust），不能直接丢失位置
  assert(src.includes('scrollAdjust'), '锚点失败应回退到 scrollAdjust padding 补偿');
});

// ==========================================================================
// BAR-ORB-CULL-01: 视口裁剪触发权重 = 消息数 + 工具框数（不是只按消息条数）
//
// 根因：一条 AI 消息可含几十个工具框，每个是重 DOM 单元。裁剪若只按 messages.length
// 判断（旧 CULL_THRESHOLD=40 条），第一轮 20 工具框只算 1-2 条消息 → 不触发裁剪 →
// 第二轮流式每帧全量重建全部工具框 → 一帧一帧卡死。改为按 block 权重触发。
// ==========================================================================

group('orb-chat — 裁剪触发权重（BAR-ORB-CULL-01）');

const _uMsg = (t: string): ChatMessage => ({ role: 'user', content: [{ type: 'text', text: t }] });
const _aMsgTools = (n: number): ChatMessage => ({
  role: 'ai',
  content: Array.from({ length: n }, (_, i) => ({ type: 'tool' as const, id: 't' + i, name: 'bash', input: {} })),
});

regression('BAR-ORB-CULL-01a', 'orb-chat', '纯文本消息：权重 = 消息条数', () => {
  assert(_cullWeight([_uMsg('a'), _uMsg('b'), _uMsg('c')]) === 3, '3 条纯文本消息权重应为 3');
  assert(_cullWeight([]) === 0, '空列表权重为 0');
});

regression('BAR-ORB-CULL-01b', 'orb-chat', '工具框计入权重：一条含 N 工具的消息权重 = 1 + N', () => {
  // 1 条 AI 消息含 20 个工具框 → 权重 = 1(消息) + 20(工具) = 21
  assert(_cullWeight([_aMsgTools(20)]) === 21, '含 20 工具框的单条消息权重应为 21，而非 1');
});

regression('BAR-ORB-CULL-01c', 'orb-chat', '卡顿场景权重超阈值 → 会触发裁剪', () => {
  // 用户实际卡顿场景：用户消息 + 一条含 20 工具框的 AI 回复
  const w = _cullWeight([_uMsg('做点事'), _aMsgTools(20)]);
  assert(w === 22, `场景权重应为 22（1+1+20），实际 ${w}`);
  // 关键：这个权重必须 > 15（当前 CULL_THRESHOLD），否则回到"只按消息条数=2 不裁剪"的卡顿
  assert(w > 15, '20 工具框场景权重必须超过裁剪阈值 15，否则第二轮流式卡死');
});

regression('BAR-ORB-CULL-01d', 'orb-chat', '混合 block：只有 tool 计入额外权重，text 不重复计', () => {
  // AI 消息含 text + 3 tool → 权重 = 1(消息) + 3(工具) = 4；text block 不额外加权
  const mixed: ChatMessage = { role: 'ai', content: [
    { type: 'text', text: 'hi' },
    { type: 'tool', id: 't1', name: 'read', input: {} },
    { type: 'tool', id: 't2', name: 'bash', input: {} },
    { type: 'tool', id: 't3', name: 'edit', input: {} },
  ] };
  assert(_cullWeight([mixed]) === 4, 'text+3tool 消息权重应为 4（1 消息 + 3 工具）');
});

// ==========================================================================
// BAR-ORB-TREE-01: sibling-switcher 零依赖保护（防循环依赖崩树）
//
// 文件树崩溃历史（本 session 多次）：sibling-switcher 的任何 import 都可能
// 触发 tree-render → tree-loader → sibling-switcher 的循环依赖，或主模块
// 初始化时序错乱。此钉子锁定：sibling-switcher 只能 import 浏览器原生 API，
// 不得 import 项目其他模块（state/theme/dom-refs/tree-loader 等）。
// ==========================================================================

group('sibling-switcher — 零依赖保护（BAR-ORB-TREE-01）');

const TREE_01_SRC = readFileSync('src/client/modules/sibling-switcher.ts', 'utf-8');
const _TREE_PROTECTED = !TREE_01_SRC.includes("from './");

regression('BAR-ORB-TREE-01', 'sibling-switcher', '不 import 项目任何模块（防循环依赖）', () => {
  // 检查是否有 import 语句引用了其他模块：正常的代码不会有 "from './"
  // 例外：test runner 的 window 兼容代码可以保留，但不能 import 项目模块
  const importLines = TREE_01_SRC.split('\n').filter(l => l.includes("from './"));
  assert(importLines.length === 0, `不应 import 项目模块，发现 ${importLines.length} 处：\n${importLines.join('\n')}`);
});
