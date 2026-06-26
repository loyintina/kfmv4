/**
 * drag-handler.ts — 共享拖动处理器
 *
 * 封装 pointerdown → pointermove → pointerup 三阶段状态机：
 *   拖动阈值判断、长按进入编辑模式、编辑/常态双模式切换、松手点击检测。
 *
 * 两个调用方（orb.ts / floating-card.ts）通过 DragConfig 注入特定行为。
 */

import { LONG_PRESS_MS, DRAG_THRESHOLD } from './interaction-constants.js';
import { log } from './logger.js';

export interface DragConfig {
  /** 从 PointerEvent 获取被拖拽的 DOM 元素。返回 null 则放弃。 */
  getElement: (e: PointerEvent) => HTMLElement | null;

  /** 状态守卫：是否允许开始拖动 */
  canStart: () => boolean;

  /** 获取要素在起点的屏幕位置 */
  getOrbStartRect: (e: PointerEvent) => { left: number; top: number };

  /** 编辑态最小尺寸（用于防止往左上拖过起点） */
  minEditW: number;
  minEditH: number;

  /** 屏幕边界钳制 */
  clamp: (x: number, y: number) => { x: number; y: number };

  /** 常态拖动：每帧调用，传入原始 dx/dy 和要素起点位置 */
  onMoveNormal: (params: {
    dx: number; dy: number;
    startOrbX: number; startOrbY: number;
  }) => void;

  /** 编辑模式拖动：每帧调用 */
  onMoveEditing: (params: {
    dx: number; dy: number;
    startOrbX: number; startOrbY: number;
  }) => void;

  /** 进入编辑模式（长按触发） */
  onEnterEdit: () => void;

  /** 退出编辑模式（松手触发） */
  onExitEdit: () => void;

  /** 判断是否处于编辑态 */
  isEditing: () => boolean;

  /** 松手点击（没拖动且没长按） */
  onTap: () => void;

  /** 松手时保存当前位置 */
  onSavePosition: () => void;
}

interface DragState {
  dragging: boolean;
  startClientX: number;
  startClientY: number;
  startOrbX: number;
  startOrbY: number;
  longPressTimer: ReturnType<typeof setTimeout> | null;
  longPressFired: boolean;
}

export function createDragHandler(cfg: DragConfig) {
  const s: DragState = {
    dragging: false,
    startClientX: 0, startClientY: 0,
    startOrbX: 0, startOrbY: 0,
    longPressTimer: null, longPressFired: false,
  };

  function reset(): void {
    if (s.longPressTimer) { clearTimeout(s.longPressTimer); s.longPressTimer = null; }
    s.dragging = false;
    s.longPressFired = false;
  }

  function onStart(e: PointerEvent): void {
    e.preventDefault();
    const el = cfg.getElement(e);
    if (!el) return;
    if (!cfg.canStart()) return;

    reset();
    s.startClientX = e.clientX;
    s.startClientY = e.clientY;

    const rect = cfg.getOrbStartRect(e);
    s.startOrbX = rect.left;
    s.startOrbY = rect.top;

    s.longPressTimer = setTimeout(() => {
      log('[DRAG] timer FIRED');
      s.longPressFired = true;
      cfg.onEnterEdit();
    }, LONG_PRESS_MS);
    log('[DRAG] timer set ' + LONG_PRESS_MS + 'ms');
  }

  function onMove(e: PointerEvent): void {
    const dx = e.clientX - s.startClientX;
    const dy = e.clientY - s.startClientY;
    if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
      log('[DRAG] drag start dx=' + dx.toFixed(1) + ' dy=' + dy.toFixed(1));
      s.dragging = true;
      if (s.longPressTimer) { clearTimeout(s.longPressTimer); s.longPressTimer = null; }
    }
    if (!s.dragging) return;

    if (cfg.isEditing()) {
      cfg.onMoveEditing({ dx, dy, startOrbX: s.startOrbX, startOrbY: s.startOrbY });
    } else {
      cfg.onMoveNormal({ dx, dy, startOrbX: s.startOrbX, startOrbY: s.startOrbY });
    }
  }

  function onEnd(e?: PointerEvent): void {
    if (e?.type === 'pointercancel') {
      if (s.longPressTimer) { clearTimeout(s.longPressTimer); s.longPressTimer = null; }
      reset();
      return;
    }
    log('[DRAG] onEnd drag=' + s.dragging + ' longFired=' + s.longPressFired + ' editing=' + cfg.isEditing());
    if (s.longPressTimer) { clearTimeout(s.longPressTimer); s.longPressTimer = null; }
    if (cfg.isEditing()) {
      cfg.onExitEdit();
    }
    if (!s.dragging && !s.longPressFired) {
      cfg.onTap();
    }
    cfg.onSavePosition();
    reset();
  }

  return { onStart, onMove, onEnd };
}
