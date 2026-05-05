/**
 * KFM v4 - 手势系统
 *
 * 中央页面手势：
 *  - 右边缘 30px 内左滑 -> 呼出堆叠卡片面板
 *  - 右滑 -> 打开侧栏（侧栏关闭时）
 *  - 左滑 -> 关闭侧栏（侧栏打开时）
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
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchStarted = true;
  }, { passive: true });

  document.addEventListener('touchmove', (e) => {
    if ((e.target as HTMLElement).closest('.light-orb')) return;
    if (!touchStarted) return;
    const dx = e.touches[0].clientX - touchStartX;
    const startX = touchStartX;
    const vw = window.innerWidth;

    // 堆叠卡片打开时：右滑关闭
    if (isCardStackOpen()) {
      if (dx > 50) { closeCardStack(); touchStarted = false; return; }
      return;
    }

    // 右边缘 30px 内左滑 -> 呼出堆叠卡片
    if (startX > vw - 30 && dx < -40) {
      openCardStack();
      touchStarted = false;
      return;
    }

    // 侧栏打开时：左滑关闭
    if (document.getElementById('sidebar')?.classList.contains('open')) {
      if (dx < -60) { closeSidebar(); touchStarted = false; return; }
      return;
    }

    // 侧栏关闭时：右滑打开
    if (!document.getElementById('sidebar')?.classList.contains('open') && dx > 60) {
      openSidebar();
      touchStarted = false;
      return;
    }
  }, { passive: true });

  document.addEventListener('touchend', () => {
    touchStarted = false;
  }, { passive: true });
}
