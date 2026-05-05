/**
 * KFM v4 - 手势系统
 *
 * 中央页面手势：
 *  - 左滑（全屏）-> 呼出堆叠卡片面板（侧栏关闭时）
 *  - 右滑 -> 打开侧栏（侧栏关闭时，非卡堆区域）
 *  - 左滑 -> 关闭侧栏（侧栏打开时）
 *  - 卡堆打开时：右滑关闭
 * 日志面板已彻底移除。
 */
import { openSidebar, closeSidebar } from './ui.js';
import { openCardStack, closeCardStack, isCardStackOpen } from './card-stack.js';

let touchStartX = 0;
let touchStartY = 0;
let touchStarted = false;

export function initGestures(): void {
  document.addEventListener('touchstart', (e) => {
    if ((e.target as HTMLElement).closest('.light-orb')) return;
    // 卡片面板内部由 card-stack.ts 自行处理
    if ((e.target as HTMLElement).closest('.stack-panel')) {
      touchStarted = false;
      return;
    }
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchStarted = true;
  }, { passive: true });

  document.addEventListener('touchmove', (e) => {
    if ((e.target as HTMLElement).closest('.light-orb')) return;
    if (!touchStarted) return;
    const dx = e.touches[0].clientX - touchStartX;
    const dy = e.touches[0].clientY - touchStartY;
    const isHorizontal = Math.abs(dx) > Math.abs(dy) * 1.5;

    // 堆叠卡片打开时：右滑关闭
    if (isCardStackOpen()) {
      if (dx > 50) { closeCardStack(); touchStarted = false; return; }
      return;
    }

    // 侧栏打开时：左滑关闭
    if (document.getElementById('sidebar')?.classList.contains('open')) {
      if (dx < -60) { closeSidebar(); touchStarted = false; return; }
      return;
    }

    // 两侧都关闭时：全屏手势
    if (!isHorizontal) return;

    if (dx < -60) {
      // 左滑 -> 堆叠卡片
      openCardStack();
      touchStarted = false;
      return;
    }

    if (dx > 60) {
      // 右滑 -> 侧栏
      openSidebar();
      touchStarted = false;
      return;
    }
  }, { passive: true });

  document.addEventListener('touchend', () => {
    touchStarted = false;
  }, { passive: true });
}
