/**
 * KFM v4 - 手势系统
 * 
 * 中央页面手势：只有边缘滑动打开/关闭侧栏，日志面板左滑关闭。
 * 侧栏内的光标、joystick 等手势将在 Canvas 版侧栏重建时重新实现。
 */
import { closeLogPanel } from './app.js';
import { openSidebar, closeSidebar } from './ui.js';

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
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const dx = currentX - touchStartX;
    const dxAbs = Math.abs(dx);

    // 侧栏打开时：左滑关闭
    if (document.getElementById('sidebar')?.classList.contains('open')) {
      if (dx < -60) { closeSidebar(); touchStarted = false; return; }
      return;
    }

    // 日志面板打开时：左滑关闭
    const logOpen = document.getElementById('logPanel')?.classList.contains('open');
    if (logOpen) {
      if (dx > 60) { closeLogPanel(); touchStarted = false; return; }
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
