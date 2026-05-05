/**
 * KFM v4 - 手势系统（通过 GestureRegistry 集中管理）
 *
 * 中央页面手势：
 *  - 左滑（全屏）-> 呼出堆叠卡片面板（侧栏关闭时）
 *  - 右滑 -> 打开侧栏（侧栏关闭时，非卡堆区域）
 *  - 左滑 -> 关闭侧栏（侧栏打开时）
 *  - 卡堆打开时：右滑关闭
 */
import { openSidebar, closeSidebar } from './ui.js';
import { openCardStack, closeCardStack, isCardStackOpen } from './card-stack.js';
import { gestures } from './gesture-registry.js';
import { DOM } from "./dom-refs.js";

export function initGestures(): void {
  gestures.register({
    id: 'gestures-page-swipe',
    targetFilter: (target) => {
      return !target.closest('.light-orb') && !target.closest('.stack-panel');
    },
    priority: 50,
    onMove: (e, dx, dy) => {
      const isHorizontal = Math.abs(dx) > Math.abs(dy) * 1.5;

      // 堆叠卡片打开时：右滑关闭
      if (isCardStackOpen()) {
        if (dx > 50) { closeCardStack(); return; }
        return;
      }

      // 侧栏打开时：左滑关闭
      if (DOM.sidebar?.classList.contains('open')) {
        if (dx < -60) { closeSidebar(); return; }
        return;
      }

      // 两侧都关闭时：全屏手势
      if (!isHorizontal) return;

      if (dx < -60) {
        openCardStack();
        return;
      }

      if (dx > 60) {
        openSidebar();
        return;
      }
    },
  });
}
