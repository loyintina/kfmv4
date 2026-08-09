/**
 * app-lifecycle.ts — 应用初始化就绪标志（2026-08-10 竞态修复）
 *
 * 病灶：main.ts 同步初始化顺序中，initGestures() 早于 initCardStack()——
 * 全局手势的「召唤卡片堆」分支在卡片堆未初始化时就可能触发（刷新中 JS
 * 执行到一半触摸），openCardStack() 操作未就绪状态 → 状态错乱 + 与
 * auto-resume 展开面板并发打架（2026-08-10 实测：刷新中召唤卡片堆 → 卡顿）。
 *
 * 解法：同步 init 全部完成后 markAppReady()；手势等消费方在未就绪时忽略输入。
 * 不依赖 window 全局（可测）；模块级布尔，无事件开销。
 */
let _appReady = false;

export function markAppReady(): void {
  _appReady = true;
}

export function isAppReady(): boolean {
  return _appReady;
}
