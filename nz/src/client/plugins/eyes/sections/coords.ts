/**
 * src/client/plugins/eyes/sections/coords.ts — 标定坐标系段（№5 硬契约点：
 * 手眼共享契约——手按的坐标和眼报的坐标同一个系）。
 *
 * 静态段：标定本身不随运行态变化（原点左上、绝对像素）。它在最小包里
 * 就必须存在——哪怕其他段都还没有，坐标系契约先钉死，手（8.8.6）落地
 * 时才有对齐的锚。
 */
import { Context } from 'cordis';

export function coordsSection(ctx: Context): void {
  ctx.inject(['eyes'], (ctx) => {
    const dispose = ctx.eyes.registerSection({
      id: 'coords',
      title: '标定坐标系（coords）',
      source: '№5 契约静态标定（手眼共享契约）',
      collect: () => ({
        origin: 'top-left',
        unit: 'px',
        space: 'absolute-viewport',
        note: '手按坐标与眼报坐标同系；任何段报告的几何都以本段为准',
      }),
    });
    ctx.effect(() => dispose);
  });
}
