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
