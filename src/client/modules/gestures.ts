/**
 * KFM v4 - 手势系统（通过 GestureRegistry 集中管理）
 *
 * 中央页面手势：
 *  - 左滑（全屏）-> 呼出堆叠卡片面板（侧栏关闭时）
 *  - 右滑 -> 打开侧栏（侧栏关闭时，非卡堆区域）
 *  - 左滑 -> 关闭侧栏（侧栏打开时）
 *  - 卡堆打开时：右滑关闭
 *
 * 设计要点：
 *  - touchstart 时拍状态快照，整个手势过程只读快照，不查实时 DOM
 *  - 一次手势只触发一个动作（_actionTaken 锁），防止竞态冒泡
 */
import { openSidebar, closeSidebar } from './ui.js';
import { openCardStack, closeCardStack, isCardStackOpen } from './card-stack.js';
import { gestures } from './gesture-registry.js';
import { DOM } from "./dom-refs.js";

export function initGestures(): void {
  // 手势闭包状态：一次触摸只做一次决策
  type GestureSnapshot = 'cardstack-open' | 'sidebar-open' | 'both-closed';
  type AxisLock = 'none' | 'horizontal' | 'vertical';
  let _snapshot: GestureSnapshot = 'both-closed';
  let _actionTaken = false;
  let _axisLock: AxisLock = 'none';

  gestures.register({
    id: 'gestures-page-swipe',
    targetFilter: (target) => {
      return !target.closest('.light-orb') && !target.closest('.stack-card');
    },
    priority: 50,
    onStart: () => {
      // 在触摸开始时拍下状态快照，后续只读快照
      if (isCardStackOpen()) {
        _snapshot = 'cardstack-open';
      } else if (DOM.sidebar?.classList.contains('open')) {
        _snapshot = 'sidebar-open';
      } else {
        _snapshot = 'both-closed';
      }
      _actionTaken = false;
      _axisLock = 'none';
    },
    onMove: (_e, dx, dy) => {
      if (_actionTaken) return;

      // 轴向锁定：首次移动判定主导方向，锁定后只处理水平手势
      if (_axisLock === 'none' && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
        _axisLock = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical';
      }
      if (_axisLock !== 'horizontal') return;

      switch (_snapshot) {
        case 'cardstack-open':
          if (dx > 50) { closeCardStack(); _actionTaken = true; }
          break;
        case 'sidebar-open':
          if (dx < -60) { closeSidebar(); _actionTaken = true; }
          break;
        case 'both-closed':
          if (dx < -60) { openCardStack(); _actionTaken = true; }
          else if (dx > 60) { openSidebar(); _actionTaken = true; }
          break;
      }
    },
  });
}
