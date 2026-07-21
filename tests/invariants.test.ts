// ==========================================================================
// tests/invariants.test.ts — 不变量层（步骤 6）
//
// 用确定性种子随机（seeded PRNG）生成大量输入，验证一条不变量对整个输入空间
// 成立——一条不变量抵几十个手工用例，且覆盖手工想不到的组合。
//
// 确定性：种子固定 → 每次运行同一序列，失败可复现（不同于 Math.random）。
// 无墙钟：纯计算，不涉及计时器（rule ts-no-test-timers）。
//
// 方法论见 docs/design/REGRESSION_TESTING_SYSTEM.md 步骤 6。
// ==========================================================================

import assert from 'assert';
import { group, test, regression } from './runner.js';
import { Box } from '../src/client/engine/v2/box.js';
import { applyFlexLayout } from '../src/client/engine/v2/flex.js';
import { computeLiquidSegments, liquidPathLen } from '../src/client/modules/liquid-geometry.js';
import { createClientIdxMapper } from '../src/server/ai/chat.js';
import { Z } from '../src/client/modules/z-index-layers.js';

// ---- 确定性 PRNG（mulberry32）：种子化，可复现 ----
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const randInt = (r: () => number, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));

// ==========================================================================
// 不变量 1：flex row 布局——子元素主轴严格不重叠、按序排列（gap>=0，无 justify）
// ==========================================================================

group('invariant — flex 主轴不重叠');

test('随机 row 布局：任意子元素序列主轴不重叠且递增', () => {
  const r = prng(0xF1E7);
  for (let iter = 0; iter < 300; iter++) {
    const n = randInt(r, 1, 8);
    const gap = randInt(r, 0, 12);
    const parent = new Box({ id: 'p', width: 2000, height: 200, layout: { flexDirection: 'row', gap } });
    const widths: number[] = [];
    for (let i = 0; i < n; i++) {
      const w = randInt(r, 1, 120);
      widths.push(w);
      parent.addChild(new Box({ id: 'c' + i, width: w, height: 50, layoutItem: { flex: 0, minWidth: 0, minHeight: 0 } }));
    }
    applyFlexLayout(parent);
    // 不变量：child[i].x >= child[i-1].x + child[i-1].width（+gap），无重叠
    for (let i = 1; i < n; i++) {
      const prevEnd = parent.children[i - 1].x + parent.children[i - 1].width;
      assert(parent.children[i].x >= prevEnd - 1e-6,
        `iter${iter}: child${i}.x=${parent.children[i].x} < prevEnd=${prevEnd}（重叠）`);
    }
    // 首个子元素从 0 起（无 justify/padding）
    assert(Math.abs(parent.children[0].x) < 1e-6, `iter${iter}: 首元素应从 0 起`);
  }
});

test('随机 column 布局：主轴（y）不重叠且递增', () => {
  const r = prng(0xC0FFEE);
  for (let iter = 0; iter < 300; iter++) {
    const n = randInt(r, 1, 8);
    const gap = randInt(r, 0, 10);
    const parent = new Box({ id: 'p', width: 200, height: 4000, layout: { flexDirection: 'column', gap } });
    for (let i = 0; i < n; i++) {
      parent.addChild(new Box({ id: 'c' + i, width: 100, height: randInt(r, 1, 80), layoutItem: { flex: 0, minWidth: 0, minHeight: 0 } }));
    }
    applyFlexLayout(parent);
    for (let i = 1; i < n; i++) {
      const prevEnd = parent.children[i - 1].y + parent.children[i - 1].height;
      assert(parent.children[i].y >= prevEnd - 1e-6, `iter${iter}: child${i} y 重叠`);
    }
  }
});

// ==========================================================================
// 不变量 2：flex-grow 填满可用空间（remainingSpace 全部分配）
// ==========================================================================

group('invariant — flex-grow 填满');

test('所有子元素 flex>0 → 主轴尺寸和填满 content 宽度', () => {
  const r = prng(0x1234);
  for (let iter = 0; iter < 200; iter++) {
    const n = randInt(r, 1, 6);
    const width = randInt(r, 100, 1000);
    const parent = new Box({ id: 'p', width, height: 100, layout: { flexDirection: 'row' } });
    for (let i = 0; i < n; i++) {
      parent.addChild(new Box({ id: 'c' + i, width: 0, height: 50, layoutItem: { flex: randInt(r, 1, 5), minWidth: 0, minHeight: 0 } }));
    }
    applyFlexLayout(parent);
    const sum = parent.children.reduce((s, c) => s + c.width, 0);
    assert(Math.abs(sum - width) < 1e-3, `iter${iter}: 子元素宽度和 ${sum} ≠ 容器 ${width}（未填满）`);
  }
});

// ==========================================================================
// 不变量 3：liquid 粒子——任意输入下坐标有限、段数有界、平移协变
// ==========================================================================

group('invariant — liquid 粒子');

test('随机盒子/进度：粒子坐标恒有限、段数 <= count', () => {
  const r = prng(0xBEEF);
  for (let iter = 0; iter < 500; iter++) {
    const params = {
      bx: randInt(r, -500, 500), by: randInt(r, -500, 500),
      h: randInt(r, 8, 120), topW: randInt(r, 0, 200), botW: randInt(r, 0, 200),
      R: 4, pos: r() * 2000, count: randInt(r, 1, 16),
      segLenH: randInt(r, 2, 30), segLenV: randInt(r, 2, 30), vm: 1 + r() * 3,
    };
    const segs = computeLiquidSegments(params);
    assert(segs.length <= params.count, `iter${iter}: 段数超 count`);
    for (const s of segs) {
      assert(Number.isFinite(s.x) && Number.isFinite(s.y), `iter${iter}: 坐标非有限`);
      assert(s.len >= 0, `iter${iter}: 段长为负`);
    }
  }
});

test('平移协变：任意 Δ，bx+Δ 使所有粒子 x 恰好 +Δ', () => {
  const r = prng(0x5EED);
  for (let iter = 0; iter < 200; iter++) {
    const base = {
      bx: 0, by: randInt(r, 0, 300), h: randInt(r, 12, 100),
      topW: randInt(r, 4, 150), botW: randInt(r, 4, 150), R: 4,
      pos: r() * 1000, count: 8, segLenH: 16, segLenV: 6, vm: 2.5,
    };
    const delta = randInt(r, -50, 50);
    const a = computeLiquidSegments(base);
    const b = computeLiquidSegments({ ...base, bx: base.bx + delta });
    assert(a.length === b.length, `iter${iter}: 平移改变了段数`);
    for (let i = 0; i < a.length; i++) {
      assert(Math.abs((b[i].x - a[i].x) - delta) < 1e-6, `iter${iter} seg${i}: x 平移 ≠ Δ`);
    }
  }
});

test('pathLen<=0（盒子退化）→ 恒空数组', () => {
  const r = prng(0x9);
  for (let iter = 0; iter < 100; iter++) {
    const R = 4;
    const h = randInt(r, 0, 2 * R); // h<=2R → realVert<=0
    const params = { bx: 0, by: 0, h, topW: 0, botW: 0, R, pos: r() * 100, count: 8, segLenH: 10, segLenV: 6, vm: 2 };
    if (liquidPathLen(0, 0, h, R, 2) <= 0) {
      assert(computeLiquidSegments(params).length === 0, `iter${iter}: 退化盒子应无粒子`);
    }
  }
});

// ==========================================================================
// 不变量 4：clientIdx 映射——首见严格连续 1..N，回访幂等
// ==========================================================================

group('invariant — clientIdx 连续性');

test('任意乱序/重复 provider index 序列 → 首见严格连续、回访幂等', () => {
  const r = prng(0xABCD);
  for (let iter = 0; iter < 300; iter++) {
    const { clientIdx } = createClientIdxMapper();
    const seen = new Map<number, number>();
    let nextExpected = 1;
    const len = randInt(r, 1, 40);
    for (let k = 0; k < len; k++) {
      const providerIdx = randInt(r, 0, 12); // 小范围 → 制造重复
      const got = clientIdx(providerIdx);
      if (seen.has(providerIdx)) {
        assert(got === seen.get(providerIdx), `iter${iter}: 回访 ${providerIdx} 非幂等`);
      } else {
        assert(got === nextExpected, `iter${iter}: 首见 ${providerIdx} 应为 ${nextExpected}，得 ${got}`);
        seen.set(providerIdx, got);
        nextExpected++;
      }
    }
  }
});

// ==========================================================================
// 不变量 5：Box 树——addChild/removeChild 后 parent 指针一致、无环
// ==========================================================================

group('invariant — Box 树结构');

test('随机 addChild/removeChild → parent 指针与 children 数组始终一致', () => {
  const r = prng(0x77);
  for (let iter = 0; iter < 200; iter++) {
    const root = new Box({ id: 'root' });
    const pool: Box[] = [root];
    const ops = randInt(r, 1, 20);
    for (let k = 0; k < ops; k++) {
      if (r() < 0.6 || pool.length === 1) {
        const parent = pool[randInt(r, 0, pool.length - 1)];
        const child = new Box({ id: `n${iter}_${k}` });
        parent.addChild(child);
        pool.push(child);
      } else {
        const idx = randInt(r, 1, pool.length - 1);
        const node = pool[idx];
        if (node.parent) node.parent.removeChild(node);
        pool.splice(idx, 1);
      }
    }
    // 不变量：每个在树中的节点，其 parent.children 必包含它
    for (const node of pool) {
      if (node.parent) {
        assert(node.parent.children.includes(node), `iter${iter}: parent 指针与 children 不一致`);
      }
    }
  }
});

// ==========================================================================
// 不变量 6：右滑临时卡组 z-index 层级（BAR-202, 9cb6622）
//
// 根因：_repositionCards 曾用硬编码 String(1001+i) 覆写 z-index，把批量卡
// 降到文件树(SIDEBAR=4000)/侧栏遮罩(3900)之下 → 卡组视觉上埋在背景里。
// 修复：改用 Z.TREE_TEMP_CARD + i。这里钉住层级关系不变量——只要有人把
// 临时卡基数改回低于文件树、或工具栏跌到卡下，即失败。
// ==========================================================================

group('invariant — 临时卡组 z-index 层级（BAR-202）');

regression('BAR-202a', '9cb6622', '临时卡组基数高于文件树与侧栏遮罩', () => {
  assert(Z.TREE_TEMP_CARD > Z.SIDEBAR, `临时卡(${Z.TREE_TEMP_CARD})须高于文件树(${Z.SIDEBAR})`);
  assert(Z.TREE_TEMP_CARD > Z.SIDEBAR_OVERLAY, `临时卡(${Z.TREE_TEMP_CARD})须高于侧栏遮罩(${Z.SIDEBAR_OVERLAY})`);
  assert(Z.TREE_TEMP_CARD > Z.MODE_SYSTEM_BG, `临时卡(${Z.TREE_TEMP_CARD})须高于底衬面板(${Z.MODE_SYSTEM_BG})`);
});

regression('BAR-202b', '9cb6622', '模式工具栏(✓/✗)在临时卡之上，整个子带不越界 L6', () => {
  assert(Z.MODE_SYSTEM > Z.TREE_TEMP_CARD, `工具栏(${Z.MODE_SYSTEM})须在临时卡(${Z.TREE_TEMP_CARD})之上`);
  // 整个临时卡子带（含堆叠序号，实际上限约 TREE_TEMP_CARD+N）不得侵入 L6 终端带(6400)
  assert(Z.MODE_SYSTEM < Z.TERMINAL_STEM, `临时卡子带须留在 L5，不侵入 L6(${Z.TERMINAL_STEM})`);
});

regression('BAR-202c', '9cb6622', '堆叠 N 张卡（基数+序号）仍全高于文件树', () => {
  // _repositionCards 用 Z.TREE_TEMP_CARD + i；即使 i 很大也不能跌破文件树
  for (let i = 0; i < 50; i++) {
    assert(Z.TREE_TEMP_CARD + i > Z.SIDEBAR, `第${i}张卡 z=${Z.TREE_TEMP_CARD + i} 须高于文件树`);
  }
});
