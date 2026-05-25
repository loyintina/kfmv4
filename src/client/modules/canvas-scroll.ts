/**
 * canvas-scroll.ts — 通用 Canvas 盒子滚动系统
 *
 * 不绑定任何具体页面（非文件树专属）。
 * 任何用 Box + Canvas 渲染的页面，需要滚轮滚动、触摸拖拽、
 * 惯性滑行（fling）、边界穿透光标推送等交互，都可以导入这个模块。
 *
 * 依赖: canvas-utils.ts, canvas-cursor.ts → renderer-lifecycle (L) → engine/v2
 * 被依赖: tree-render.ts, 未来的 card-stream.ts ...
 *
 * 设计原则:
 * - wheel 事件: 平滑滚动 + 边界累积穿透 + 光标步进
 * - touch 事件: 跟手拖拽 + 松手 fling 惯性 + 边界锁状态机
 * - 边界锁: 滚动到头时锁定滚动，手指位移转为光标偏移
 * - rAF 循环: 通过 L._cursorWheelDecayRaf 等生命周期句柄管理
 * - 不导入任何 tree-* 文件（保持通用性）
 *
 * 使用方法:
 *   import { bindScrollEvents } from './canvas-scroll.js';
 *   bindScrollEvents(canvasElement);
 */

import { L } from './renderer-lifecycle.js';
import { getRootScrollY, setRootScrollY } from './canvas-utils.js';
import {
  getCursorRowIndex,
  getRowIndexLength,
  moveCursorTo,
  _moveCursorBySteps,
  _isCursorMode,
  _getCenterRowIndex,
  _snapCursorToCenter,
} from './canvas-cursor.js';
import { LINE_HEIGHT } from './style-registry.js';

export function bindScrollEvents(canvas: HTMLElement): void {
  // 记录当前触摸手势属于哪种模式（touchstart 时判定，touchend 时消费）
  let _touchIsCursor = false;

  // ===== Wheel =====
  let wheelTarget = 0;
  let cursorWheelAccum = 0;

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (_isCursorMode()) {
      // 光标模式：累������ deltaY 转为步进
      cursorWheelAccum += e.deltaY / LINE_HEIGHT;
      const steps = Math.trunc(cursorWheelAccum);
      if (steps !== 0) {
        _moveCursorBySteps(-steps);  // deltaY>0 向下 → 光标向��（索引增大）
        cursorWheelAccum -= steps;
      }
      // 衰减残余（模拟滚轮惯性）
      if (!L._cursorWheelDecayRaf) {
        L._cursorWheelDecayRaf = requestAnimationFrame(function decay() {
          if (L._sidebarClosed) { L._cursorWheelDecayRaf = 0; return; }
          cursorWheelAccum *= 0.85;
          const s = Math.trunc(cursorWheelAccum);
          if (s !== 0) {
            _moveCursorBySteps(-s);
            cursorWheelAccum -= s;
          }
          if (Math.abs(cursorWheelAccum) < 0.05) {
            cursorWheelAccum = 0;
            L._cursorWheelDecayRaf = 0;
            return;
          }
          L._cursorWheelDecayRaf = requestAnimationFrame(decay);
        });
      }
      return;
    }
    // 滚动模式（含边界穿透，累积跨帧）
    const cur = getRootScrollY() ?? 0;
    L._lastUserScrollY = cur;  // 记录 GSAP 之前的值
    wheelTarget = cur + e.deltaY;
    if (!L._wheelRaf) {
      let wheelAccum = 0;
      const wheelCenterIdx = _getCenterRowIndex();
      L._wheelRaf = requestAnimationFrame(function smoothWheel() {
        if (L._sidebarClosed) { L._wheelRaf = 0; return; }
        const cur2 = getRootScrollY() ?? 0;
        const diff = wheelTarget - cur2;
        if (Math.abs(diff) < 0.5) {
          setRootScrollY(wheelTarget);
          _snapCursorToCenter();
          L._wheelRaf = 0;
          return;
        }
        const maxY = L.renderer?.getRoot()?.getMaxScroll().maxY ?? 0;
        const desired = cur2 + diff * 0.25;
        if (desired < 0 && maxY > 0) {
          setRootScrollY(0);
          wheelAccum += -desired;
          const steps = Math.floor(wheelAccum / LINE_HEIGHT);
          if (steps > 0) {
            wheelAccum -= steps * LINE_HEIGHT;
            const targetIdx = Math.max(0, wheelCenterIdx - steps);
            if (L._rowIndex[targetIdx]) moveCursorTo(L._rowIndex[targetIdx]);
          }
        } else if (desired > maxY) {
          setRootScrollY(maxY);
          wheelAccum += desired - maxY;
          const steps = Math.floor(wheelAccum / LINE_HEIGHT);
          if (steps > 0) {
            wheelAccum -= steps * LINE_HEIGHT;
            const targetIdx = Math.min(L._rowIndex.length - 1, wheelCenterIdx + steps);
            if (L._rowIndex[targetIdx]) moveCursorTo(L._rowIndex[targetIdx]);
          }
        } else {
          setRootScrollY(desired);
          L._lastUserScrollY = desired;
          _snapCursorToCenter();
        }
        L._wheelRaf = requestAnimationFrame(smoothWheel);
      });
    }
  }, { passive: false });

  // ===== Touch =====
  // 滚动模式状态
  let touchStartY = 0;
  let touchScrollY = 0;
  let lastTouchY = 0;
  let lastTouchTime = 0;
  let velocity = 0;
  // 边界锁状态：光标偏离中心时锁定滚动，回到中心才解锁
  let _boundPen = 0;       // 穿透深度（像素），>0 表��锁住
  let _boundIsTop = false; // true=上边界锁���false=下边界锁
  // ��标模式状态
  let cursorTouchBase = 0;
  let cursorTouchStartY = 0;
  let cursorLastTouchY = 0;
  let cursorLastTouchTime = 0;
  let cursorVelocity = 0;

  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const y = e.clientY;
    lastTouchY = y;
    lastTouchTime = performance.now();
    // 取消所有进���中的 RAF
    if (L._flingRaf) { cancelAnimationFrame(L._flingRaf); L._flingRaf = 0; }
    if (L._cursorFlingRaf) { cancelAnimationFrame(L._cursorFlingRaf); L._cursorFlingRaf = 0; }

    _touchIsCursor = _isCursorMode();
    console.log('[touchstart] _touchIsCursor=', _touchIsCursor, ' _isCursorMode()=', _isCursorMode());

    if (_touchIsCursor) {
      cursorTouchBase = Math.max(0, getCursorRowIndex());
      cursorTouchStartY = y;
      cursorLastTouchY = y;
      cursorLastTouchTime = lastTouchTime;
      cursorVelocity = 0;
    } else {
      touchStartY = y;
      touchScrollY = getRootScrollY() ?? 0;
      L._lastUserScrollY = touchScrollY;  // 记录用户触摸开始时的 scrollY
      velocity = 0;
      // 检������界锁残留：光标因上次手势偏离��心
      _boundPen = 0;
      _boundIsTop = false;
      const root2 = L.renderer?.getRoot();
      if (root2 && !_isCursorMode()) {
        const maxY2 = root2.getMaxScroll().maxY ?? 0;
        const centerIdx = _getCenterRowIndex();
        const cursorIdx = getCursorRowIndex();
        if (touchScrollY <= 0 && centerIdx >= 0 && cursorIdx >= 0 && cursorIdx < centerIdx) {
          _boundPen = (centerIdx - cursorIdx) * LINE_HEIGHT;
          _boundIsTop = true;
        } else if (touchScrollY >= maxY2 && centerIdx >= 0 && cursorIdx >= 0 && cursorIdx > centerIdx) {
          _boundPen = (cursorIdx - centerIdx) * LINE_HEIGHT;
          _boundIsTop = false;
        }
      }
    }
  }, { passive: true });

  canvas.addEventListener('pointermove', (e) => {
    const y = e.clientY;
    const now = performance.now();

    if (_touchIsCursor) {
      const dy = cursorTouchStartY - y;
      const dt = now - cursorLastTouchTime;
      if (dt > 0) {
        cursorVelocity = (cursorLastTouchY - y) / dt * 16 * 1.7;
      }
      cursorLastTouchY = y;
      cursorLastTouchTime = now;
      const stepOffset = dy / LINE_HEIGHT;
      const raw = Math.round(cursorTouchBase + stepOffset);
      const idx = ((raw % L._rowIndex.length) + L._rowIndex.length) % L._rowIndex.length;
      if (L._rowIndex[idx]) moveCursorTo(L._rowIndex[idx]);
      return;
    }

    // 滚动模式（含边界锁状态机）
    const dy = touchStartY - y;
    const dt = now - lastTouchTime;
    if (dt > 0) {
      velocity = (lastTouchY - y) / dt * 16 * 1.7;
    }
    const dPen = lastTouchY - y;  // 逐帧增量：>0=手指上滑
    lastTouchY = y;
    lastTouchTime = now;
    const root3 = L.renderer?.getRoot();
    const maxY = root3?.getMaxScroll().maxY ?? 0;

    if (_boundPen > 0) {
      // === 边界锁：滚动��定，手指位移只改变穿透深度 ===
      _boundPen = Math.max(0, _boundPen + (_boundIsTop ? -dPen : dPen));
      if (_boundPen === 0) {
        // 光标��到中����解锁，重置滚动参考点
        touchScrollY = _boundIsTop ? 0 : maxY;
        touchStartY = y;
        setRootScrollY(touchScrollY);
        _snapCursorToCenter();
      } else {
        setRootScrollY(_boundIsTop ? 0 : maxY);
        const steps = Math.floor(_boundPen / LINE_HEIGHT);
        const centerIdx = _getCenterRowIndex();
        if (centerIdx >= 0 && steps > 0) {
          const targetIdx = _boundIsTop
            ? Math.max(0, centerIdx - steps)
            : Math.min(L._rowIndex.length - 1, centerIdx + steps);
          if (L._rowIndex[targetIdx]) moveCursorTo(L._rowIndex[targetIdx]);
        } else {
          _snapCursorToCenter();
        }
      }
    } else {
      // === 正常滚动 ===
      const desired = touchScrollY + dy;
      if (desired < 0 && maxY > 0) {
        _boundPen = -desired;
        _boundIsTop = true;
        setRootScrollY(0);
        const steps = Math.floor(_boundPen / LINE_HEIGHT);
        const centerIdx = _getCenterRowIndex();
        if (centerIdx >= 0 && steps > 0) {
          const targetIdx = Math.max(0, centerIdx - steps);
          if (L._rowIndex[targetIdx]) moveCursorTo(L._rowIndex[targetIdx]);
        }
      } else if (desired > maxY) {
        _boundPen = desired - maxY;
        _boundIsTop = false;
        setRootScrollY(maxY);
        const steps = Math.floor(_boundPen / LINE_HEIGHT);
        const centerIdx = _getCenterRowIndex();
        if (centerIdx >= 0 && steps > 0) {
          const targetIdx = Math.min(L._rowIndex.length - 1, centerIdx + steps);
          if (L._rowIndex[targetIdx]) moveCursorTo(L._rowIndex[targetIdx]);
        }
      } else {
        setRootScrollY(desired);
        L._lastUserScrollY = desired;  // 记录用户意图的滚动位置
        _snapCursorToCenter();
      }
    }
  }, { passive: true });

  canvas.addEventListener('pointerup', () => {
    if (_touchIsCursor) {
      if (Math.abs(cursorVelocity) >= 0.5 && L._rowIndex.length > 0) {
        // 将起点更新为当前光标位置，避免飞回 touchstart ����置
        cursorTouchBase = Math.max(0, getCursorRowIndex());
        function cursorFling() {
          cursorVelocity *= 0.96;
          if (Math.abs(cursorVelocity) < 0.3) { L._cursorFlingRaf = 0; return; }
          cursorTouchBase += cursorVelocity / LINE_HEIGHT;
          const raw = Math.round(cursorTouchBase);
          const idx = ((raw % L._rowIndex.length) + L._rowIndex.length) % L._rowIndex.length;
          if (L._rowIndex[idx]) moveCursorTo(L._rowIndex[idx]);
          L._cursorFlingRaf = requestAnimationFrame(cursorFling);
        }
        L._cursorFlingRaf = requestAnimationFrame(cursorFling);
      }
      return;
    }

    // 滚动模式 fling（边界锁：velocity 先消耗穿透�����������������度，归零后才允许滚动）
    if (Math.abs(velocity) < 0.5) return;
    let flingPen = _boundPen;
    let flingIsTop = _boundIsTop;
    const flingMaxY = L.renderer?.getRoot()?.getMaxScroll().maxY ?? 0;
    function fling() {
      if (L._sidebarClosed) { L._flingRaf = 0; return; }
      velocity *= 0.96;
      if (Math.abs(velocity) < 0.3) { L._flingRaf = 0; return; }

      if (flingPen > 0) {
        // 锁状态：velocity 先消耗穿透深度
        flingPen = Math.max(0, flingPen + (flingIsTop ? -velocity : velocity));
        if (flingPen === 0) {
          // 解锁，转为正常滚动
          setRootScrollY(flingIsTop ? 0 : flingMaxY);
          _snapCursorToCenter();
        } else {
          setRootScrollY(flingIsTop ? 0 : flingMaxY);
          const steps = Math.floor(flingPen / LINE_HEIGHT);
          const centerIdx = _getCenterRowIndex(); // 实时获取边界处中央行，不用 touchend 旧值
          if (centerIdx >= 0 && steps > 0) {
            const targetIdx = flingIsTop
              ? Math.max(0, centerIdx - steps)
              : Math.min(L._rowIndex.length - 1, centerIdx + steps);
            if (L._rowIndex[targetIdx]) moveCursorTo(L._rowIndex[targetIdx]);
          }
        }
      } else {
        // 正常滚动 fling
        const cur = getRootScrollY() ?? 0;
        const desired = cur + velocity;
        if (desired < 0 && flingMaxY > 0) {
          flingPen = -desired;
          flingIsTop = true;
          setRootScrollY(0);
          // ���次触碰边界：立刻基于当前中央行做初始光标偏移
          const centerIdx = _getCenterRowIndex();
          const steps = Math.floor(flingPen / LINE_HEIGHT);
          if (centerIdx >= 0 && steps > 0) {
            const targetIdx = Math.max(0, centerIdx - steps);
            if (L._rowIndex[targetIdx]) moveCursorTo(L._rowIndex[targetIdx]);
          }
        } else if (desired > flingMaxY) {
          flingPen = desired - flingMaxY;
          flingIsTop = false;
          setRootScrollY(flingMaxY);
          // 首次触碰边界����刻基于当前中央行做初始光标偏移
          const centerIdx = _getCenterRowIndex();
          const steps = Math.floor(flingPen / LINE_HEIGHT);
          if (centerIdx >= 0 && steps > 0) {
            const targetIdx = Math.min(L._rowIndex.length - 1, centerIdx + steps);
            if (L._rowIndex[targetIdx]) moveCursorTo(L._rowIndex[targetIdx]);
          }
        } else {
          setRootScrollY(desired);
          _snapCursorToCenter();
        }
      }
      L._flingRaf = requestAnimationFrame(fling);
    }
    L._flingRaf = requestAnimationFrame(fling);
  }, { passive: true });
}

// ============================================================
// 点击事件（光标优先 → 二次点击执行 onTap��
// ============================================================