// ==========================================================================
// tests/obs-track-time.test.ts — 星轨 t0/t1 归一化钉子（BAR-OBS-TRACKTIME-01）
//
// 2026-08-12 事故：kimi state.json 的 createdAt 是裸 epoch 毫秒数字
// （1786496781877），collectKimiTracks 直接 String() 赋值 → 客户端
// new Date("1786496781877").getTime() = NaN → tMin NaN → 整条 SVG 坐标
// NaN → 星轨空白。修复：normalizeIso 归一化，纯数字按 epoch ms、其余按
// 日期串，统一输出 ISO；垃圾输入返回 null（落回 wire 文件时间戳兜底）。
// ==========================================================================

import assert from 'assert';
import { group, regression } from './runner.js';
import { normalizeIso } from '../src/server/routes/obs.js';

group('obs-track-time — 星轨 t0/t1 归一化（BAR-OBS-TRACKTIME-01）');

regression('BAR-OBS-TRACKTIME-01a', 'obs', 'epoch 毫秒数字 → ISO', () => {
  assert.strictEqual(normalizeIso(1786496781877), new Date(1786496781877).toISOString());
});

regression('BAR-OBS-TRACKTIME-01b', 'obs', 'epoch 毫秒数字串 → ISO（kimi state.json 实案形态）', () => {
  assert.strictEqual(normalizeIso('1786496781877'), new Date(1786496781877).toISOString());
});

regression('BAR-OBS-TRACKTIME-01c', 'obs', 'ISO 串原样通过', () => {
  assert.strictEqual(normalizeIso('2026-08-12T01:00:00.000Z'), '2026-08-12T01:00:00.000Z');
});

regression('BAR-OBS-TRACKTIME-01d', 'obs', '垃圾输入 → null（调用方落回 wire 时间戳兜底）', () => {
  assert.strictEqual(normalizeIso('not a date'), null);
  assert.strictEqual(normalizeIso(''), null);
  assert.strictEqual(normalizeIso(undefined), null);
  assert.strictEqual(normalizeIso(null), null);
});

regression('BAR-OBS-TRACKTIME-01e', 'obs', '归一化产物客户端可解析（new Date().getTime() 不 NaN）', () => {
  for (const v of [1786496781877, '1786496781877', '2026-08-12T01:00:00.000Z']) {
    const iso = normalizeIso(v);
    assert(iso !== null && Number.isFinite(new Date(iso).getTime()), `${v} 归一化后必须可解析`);
  }
});
