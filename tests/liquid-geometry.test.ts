// ==========================================================================
// tests/liquid-geometry.test.ts — 光标液体粒子几何 · 回归钉子（步骤 5）
//
// computeLiquidSegments 从 canvas-cursor._emitLiquidSegments 剥离出的纯几何。
// 剥离动机：BAR-201（液体粒子不跟随光标右滑回弹）根因是坐标系不含
// transform.translateX——现在 bx 作为显式入参，测试可直接验证「bx 平移 →
// 所有粒子整体平移相同量」这个不变量，无需 DOM/GSAP。
//
// 方法论见 docs/design/REGRESSION_TESTING_SYSTEM.md 步骤 5。
// ==========================================================================

import assert from 'assert';
import { group, test, regression } from './runner.js';
import { computeLiquidSegments, pathToPhysical, liquidPathLen, type LiquidGeomParams } from '../src/client/modules/liquid-geometry.js';

group('liquid-geometry — 粒子几何');

// 典型光标盒参数（对应 theme.canvas.cursorLiquid 默认值）
function baseParams(over: Partial<LiquidGeomParams> = {}): LiquidGeomParams {
  return {
    bx: 100, by: 200, h: 32, topW: 40, botW: 40, R: 4,
    pos: 0, count: 8, segLenH: 18, segLenV: 6, vm: 2.5,
    ...over,
  };
}

// ==========================================================================
// BAR-201 (d4f658a): 粒子原点跟随 bx（bx 含 transform.translateX）
// bounce 动画把 translateX 从 0 推到 8 再弹回；bx 相应平移，粒子必须整体同步。
// ==========================================================================

regression('BAR-201a', 'd4f658a', 'bx 平移 Δ → 所有粒子 x 整体平移 Δ（粒子跟随回弹）', () => {
  const at0 = computeLiquidSegments(baseParams({ bx: 100 }));
  const at8 = computeLiquidSegments(baseParams({ bx: 108 })); // translateX=8
  assert(at0.length === at8.length && at0.length > 0, '两次段数应相同且非空');
  for (let i = 0; i < at0.length; i++) {
    const dx = at8[i].x - at0[i].x;
    assert(Math.abs(dx - 8) < 1e-9, `第 ${i} 段 x 应平移 8，实际 ${dx}`);
  }
});

regression('BAR-201b', 'd4f658a', 'by 平移 Δ → 所有粒子 y 整体平移 Δ（含 translateY/scrollY）', () => {
  const at0 = computeLiquidSegments(baseParams({ by: 200 }));
  const at5 = computeLiquidSegments(baseParams({ by: 205 }));
  for (let i = 0; i < at0.length; i++) {
    assert(Math.abs((at5[i].y - at0[i].y) - 5) < 1e-9, `第 ${i} 段 y 应平移 5`);
  }
});

// ==========================================================================
// 几何不变量
// ==========================================================================

test('pathLen <= 0（盒子过小）→ 返回空数组', () => {
  // topW=botW=0 且 h=2R → realVert=0 → pathLen=0
  const segs = computeLiquidSegments(baseParams({ topW: 0, botW: 0, h: 8, R: 4 }));
  assert(segs.length === 0, `pathLen<=0 应返回空，得 ${segs.length}`);
}, { tag: 'integration' });

test('粒子数不超过 count', () => {
  const segs = computeLiquidSegments(baseParams({ count: 8 }));
  assert(segs.length <= 8, `段数不应超过 count，得 ${segs.length}`);
}, { tag: 'integration' });

test('所有粒子落在盒子物理范围内（含边界容差）', () => {
  const p = baseParams();
  const segs = computeLiquidSegments(p);
  for (const s of segs) {
    // x 在 [bx, bx+topW+2R] 内，y 在 [by, by+h] 内（三段管道边界）
    assert(s.x >= p.bx - 1 && s.x <= p.bx + p.topW + 2 * p.R + 1, `x 越界: ${s.x}`);
    assert(s.y >= p.by - 1 && s.y <= p.by + p.h + 1, `y 越界: ${s.y}`);
  }
}, { tag: 'integration' });

test('pos 取模周期性：pos 与 pos+pathLen 产出相同布局', () => {
  const p = baseParams();
  const pathLen = liquidPathLen(p.topW, p.botW, p.h, p.R, p.vm);
  const a = computeLiquidSegments({ ...p, pos: 3 });
  const b = computeLiquidSegments({ ...p, pos: 3 + pathLen });
  assert(a.length === b.length, '周期后段数应相同');
  for (let i = 0; i < a.length; i++) {
    assert(Math.abs(a[i].x - b[i].x) < 1e-6 && Math.abs(a[i].y - b[i].y) < 1e-6, `第 ${i} 段应周期一致`);
  }
}, { tag: 'integration' });

test('三段管道角度正确：上线 π / 竖线 π/2 / 下线 0', () => {
  const segs = computeLiquidSegments(baseParams({ count: 64 })); // 密集采样覆盖三段
  const angles = new Set(segs.map(s => s.angle));
  assert(angles.has(Math.PI), '应有上线段（angle=π）');
  assert(angles.has(Math.PI / 2), '应有竖线段（angle=π/2）');
  assert(angles.has(0), '应有下线段（angle=0）');
}, { tag: 'integration' });

// ---- pathToPhysical 纯映射 ----

group('liquid-geometry — pathToPhysical');

test('上线段（t<topW）恒等映射', () => {
  assert(pathToPhysical(10, 40, 24, 2.5) === 10, '上线段应恒等');
}, { tag: 'integration' });

test('竖线段用 vm 逆缩放', () => {
  // t = topW + vPath/2 → 物理 = topW + realVert/2
  const topW = 40, realVert = 24, vm = 2.5;
  const vPath = realVert * vm;
  const phys = pathToPhysical(topW + vPath / 2, topW, realVert, vm);
  assert(Math.abs(phys - (topW + realVert / 2)) < 1e-9, `竖线中点应映射到物理中点，得 ${phys}`);
}, { tag: 'integration' });

test('pathToPhysical 单调不减', () => {
  const topW = 40, realVert = 24, vm = 2.5;
  const total = topW + realVert * vm + 40;
  let prev = -Infinity;
  for (let t = 0; t <= total; t += 1) {
    const p = pathToPhysical(t, topW, realVert, vm);
    assert(p >= prev - 1e-9, `t=${t} 处非单调: ${p} < ${prev}`);
    prev = p;
  }
}, { tag: 'integration' });
