// ==========================================================================
// tests/viewport-visibility.test.ts — 当前视口可见性（矩形减法）回归钉子
//
// 2026-08-12 立项：全屏 tmux 卡盖住中央页面，眼睛照列待办坐标 → AI 手按错位。
// 覆盖：遮挡序 rank / 全覆盖→hidden / 部分覆盖→partial 带百分比 /
// 多遮挡者并集不重复计 / present 开合状态过滤 / null、0 面积矩形过滤 /
// assembleRegions 从 snapshot 状态层取 present。
// ==========================================================================

import assert from 'assert';
import { group, test } from './runner.js';
import { computeVisibility, assembleRegions, rankOf, type RegionInput } from '../src/client/modules/viewport-visibility.js';

group('viewport-visibility — 矩形减法遮挡');

const R = (x: number, y: number, w: number, h: number) => ({ x, y, w, h });
const region = (id: string, rect: ReturnType<typeof R> | null, rank: number, present = true): RegionInput => ({ id, rect, rank, present });

test('无遮挡 → 全部 full，visiblePct=100', () => {
  const out = computeVisibility([region('hud.stack', R(178, 520, 200, 218), 0)]);
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0].cover, 'full');
  assert.strictEqual(out[0].visiblePct, 100);
  assert.deepStrictEqual(out[0].coveredBy, []);
});

test('全屏卡盖住整个中央页面 → hud 全 hidden，全屏卡自身 full（用户实拍场景）', () => {
  const fs = R(0, 0, 384, 853);
  const out = computeVisibility([
    region('hud.top', R(6, 14, 372, 62), 0),
    region('hud.stack', R(178, 520, 200, 218), 0),
    region('card.fullscreen', fs, 1),
    region('orb', R(324, 677, 36, 36), 5),
  ]);
  const byId = Object.fromEntries(out.map(o => [o.id, o]));
  assert.strictEqual(byId['hud.top'].cover, 'hidden', '顶框被全屏卡完全遮挡');
  assert.strictEqual(byId['hud.stack'].cover, 'hidden', '待办被全屏卡完全遮挡');
  assert.strictEqual(byId['hud.stack'].visiblePct, 0);
  assert.deepStrictEqual(byId['hud.stack'].coveredBy, ['card.fullscreen']);
  assert.strictEqual(byId['card.fullscreen'].cover, 'full', '遮挡者自身可见');
  assert.strictEqual(byId['orb'].cover, 'full', '光球在最顶层，不被全屏卡遮');
});

test('部分覆盖 → partial + 百分比 + 遮挡者（面板盖住待办左半 ≈50%）', () => {
  const out = computeVisibility([
    region('hud.stack', R(178, 520, 200, 200), 0),
    region('orb.panel', R(178, 520, 100, 200), 4),
  ]);
  const stack = out.find(o => o.id === 'hud.stack')!;
  assert.strictEqual(stack.cover, 'partial');
  assert.strictEqual(stack.visiblePct, 50);
  assert.deepStrictEqual(stack.coveredBy, ['orb.panel']);
});

test('多遮挡者重叠部分不重复计（两个各盖 60% 重叠一半 → 可见 ≈25% 而非 -20%）', () => {
  // 区域 100×100；遮挡者 A 盖左 60%，B 盖 x∈[30,90]——并集覆盖 90%，可见 10%
  const out = computeVisibility([
    region('hud.pulse', R(0, 0, 100, 100), 0),
    region('cards', R(0, 0, 60, 100), 2),
    region('orb.panel', R(30, 0, 60, 100), 4),
  ]);
  const pulse = out.find(o => o.id === 'hud.pulse')!;
  assert.strictEqual(pulse.visiblePct, 10, `并集覆盖 90% → 可见 10%，实得 ${pulse.visiblePct}%`);
  assert.strictEqual(pulse.cover, 'partial');
  assert.deepStrictEqual(pulse.coveredBy.sort(), ['cards', 'orb.panel']);
});

test('遮挡序：rank 低的不遮 rank 高的；同 rank 互不遮挡', () => {
  const out = computeVisibility([
    region('orb.panel', R(0, 0, 100, 100), 4),
    region('tree', R(0, 0, 100, 100), 3),       // 完全重合但 rank 低 → 不遮面板
    region('hud.roles', R(0, 0, 100, 100), 0),  // 被两者盖
  ]);
  const byId = Object.fromEntries(out.map(o => [o.id, o]));
  assert.strictEqual(byId['orb.panel'].cover, 'full', '面板 rank 最高');
  assert.strictEqual(byId['tree'].cover, 'hidden', '文件树被面板盖');
  assert.deepStrictEqual(byId['hud.roles'].coveredBy.sort(), ['orb.panel', 'tree']);
});

test('present=false / null 矩形 / 0 面积 → 直接出局', () => {
  const out = computeVisibility([
    region('tree', R(0, 0, 288, 769), 3, false),     // 文件树未展开
    region('card.fullscreen', null, 1),              // 无全屏卡
    region('cards', R(0, 0, 0, 0), 2),               // 选择器落空
    region('hud.top', R(6, 14, 372, 62), 0),
  ]);
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0].id, 'hud.top');
  assert.strictEqual(out[0].cover, 'full', '关闭的树/堆不得遮挡任何区域');
});

test('rankOf：hud 前缀 = 0，未知 id = -1（不参与）', () => {
  assert.strictEqual(rankOf('hud.stack'), 0);
  assert.strictEqual(rankOf('card.fullscreen'), 1);
  assert.strictEqual(rankOf('orb'), 5);
  assert.strictEqual(rankOf('unknown'), -1);
});

group('viewport-visibility — assembleRegions 装配');

test('present 从 snapshot 状态层提取（树/堆 content detail + 面板 elements state）', () => {
  const regions = assembleRegions({
    elements: [{ id: 'orb-panel', state: 'open' }],
    content: [
      { type: 'file-tree', detail: { visible: true } },
      { type: 'card-content', detail: { visible: false } },
    ],
    coords: {
      'hud.top': R(6, 14, 372, 62),
      'tree': R(0, 0, 288, 769),
      'cards': R(229, 102, 155, 68),
      'orb.panel': R(42, 345, 300, 350),
      'orb': R(324, 677, 36, 36),
      'card.fullscreen': R(0, 0, 0, 0),
    },
  });
  const byId = Object.fromEntries(regions.map(r => [r.id, r]));
  assert.strictEqual(byId['tree'].present, true);
  assert.strictEqual(byId['cards'].present, false, '卡片堆 detail.visible=false → 不参与');
  assert.strictEqual(byId['orb.panel'].present, true);
  assert.strictEqual(byId['orb'].present, true, '光球常驻');
  assert.strictEqual(byId['hud.top'].present, true, 'hud 无开合态恒 true');
});

test('面板 closed / 缺 elements → orb.panel present=false', () => {
  const closed = assembleRegions({ elements: [{ id: 'orb-panel', state: 'closed' }], coords: { 'orb.panel': R(42, 345, 300, 350) } });
  assert.strictEqual(closed[0].present, false);
  const missing = assembleRegions({ coords: { 'orb.panel': R(42, 345, 300, 350) } });
  assert.strictEqual(missing[0].present, false, '快照无面板元素 → 视为关闭');
});

test('未知 coords id 被过滤（rank=-1）', () => {
  const regions = assembleRegions({ coords: { 'mystery': R(0, 0, 10, 10), 'orb': R(1, 1, 5, 5) } });
  assert.strictEqual(regions.length, 1);
  assert.strictEqual(regions[0].id, 'orb');
});
