// hand-geometry.ts — 手引擎的纯几何函数（无浏览器依赖，可离线单测）
//
// 2026-08-13 抽离：handHitTest 原内联在 hand.ts，测试 import hand.ts 会触发
// ws-channel 浏览器依赖链（node/tsx 加载失败被吞，测试静默不执行）。
// 按回归纪律「逻辑与渲染分离」：纯函数独立成文件，hand.ts 与测试都从这里消费。

/** 命中测试：指针是否落在核附近（用户拖动接管半径）——纯函数可测 */
export function handHitTest(px: number, py: number, cx: number, cy: number, r = 48): boolean {
  return Math.hypot(px - cx, py - cy) <= r;
}
