/**
 * canvas-scroll.ts — 通用 Canvas 盒子滚动系统
 *
 * 所有 pointer 事件通过 gesture-registry 统一分发（不直接 addEventListener）。
 * wheel 事件在 canvas 元素上直接绑定（非 pointer 事件，不经过 gesture-registry）。
 */
import { Box } from '../engine/v2/box.js';
import { L } from './renderer-lifecycle.js';
import { getRootScrollY, setRootScrollY, _rebuildRowIndex, findBoxById } from './canvas-utils.js';
import { getCursorRowIndex, moveCursorTo, _snapCursorToCenter, _moveCursorBySteps, _isCursorMode, _getCenterRowIndex } from './canvas-cursor.js';
import { getShift, LINE_HEIGHT, MAX_LINES } from './style-registry.js';
import { gestures } from './gesture-registry.js';
import { closeSidebar } from './ui.js';
import { isPickerOpen, pickerHandleClick } from './root-picker.js';

// ========== 状态（模块级，不在 bind 函数闭包内） ==========
let _touchIsCursor = false;
let touchStartY = 0;
let touchScrollY = 0;
let lastTouchY = 0;
let lastTouchTime = 0;
let velocity = 0;
let _boundPen = 0;
let _boundIsTop = false;
let cursorTouchBase = 0;
let cursorTouchStartY = 0;
let cursorLastTouchY = 0;
let cursorLastTouchTime = 0;
let cursorVelocity = 0;

// ========== wheel 事件（直接绑定，不走 gesture-registry） ==========

export function bindWheelEvents(canvas: HTMLElement): void {
  let wheelAccum = 0;
  let wheelTarget = 0;
  let _wheelVel = 0;
  let _lastWheelTime = 0;

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const now = performance.now();
    const dt = now - _lastWheelTime;
    _lastWheelTime = now;
    const cur = getRootScrollY() ?? 0;
    if (_isCursorMode()) {
      if (dt > 0 && dt < 500) _wheelVel += e.deltaY / dt * 16;
      const steps = Math.round(_wheelVel / LINE_HEIGHT);
      if (steps !== 0) {
        _moveCursorBySteps(steps);
        _wheelVel -= steps * LINE_HEIGHT;
        if (Math.abs(_wheelVel) < 1) _wheelVel = 0;
      }
      if (L._cursorWheelDecayRaf) cancelAnimationFrame(L._cursorWheelDecayRaf);
      L._cursorWheelDecayRaf = requestAnimationFrame(function decay() {
        _wheelVel *= 0.85;
        if (Math.abs(_wheelVel) < 1) { L._cursorWheelDecayRaf = 0; return; }
        L._cursorWheelDecayRaf = requestAnimationFrame(decay);
      });
      return;
    }
    L._lastUserScrollY = cur;
    wheelTarget = cur + e.deltaY;
    if (!L._wheelRaf) {
      let wAcc = 0;
      const wCenter = _getCenterRowIndex();
      L._wheelRaf = requestAnimationFrame(function smooth() {
        const r = L.renderer?.getRoot();
        const cur2 = getRootScrollY() ?? 0;
        const diff = wheelTarget - cur2;
        const eased = diff * 0.2;
        const desired = cur2 + eased;
        const maxY = r?.getMaxScroll().maxY ?? 0;
        if (Math.abs(diff) < 0.5 && L._wheelRaf) { cancelAnimationFrame(L._wheelRaf); L._wheelRaf = 0; return; }
        if (desired < 0 && maxY > 0) {
          setRootScrollY(0);
          wAcc += -desired;
          const steps = Math.floor(wAcc / LINE_HEIGHT);
          if (steps > 0) { wAcc -= steps * LINE_HEIGHT; const t = Math.max(0, wCenter - steps); if (t >= 0 && L._rowIndex[t]) moveCursorTo(L._rowIndex[t]); }
        } else if (desired > maxY) {
          setRootScrollY(maxY);
          wAcc += desired - maxY;
          const steps = Math.floor(wAcc / LINE_HEIGHT);
          if (steps > 0) { wAcc -= steps * LINE_HEIGHT; const t = Math.min(L._rowIndex.length - 1, wCenter + steps); if (t >= 0 && L._rowIndex[t]) moveCursorTo(L._rowIndex[t]); }
        } else {
          setRootScrollY(desired);
          L._lastUserScrollY = desired;
          _snapCursorToCenter();
        }
        L._wheelRaf = requestAnimationFrame(smooth);
      });
    }
  }, { passive: false });
}

// ========== gesture-registry 指针事件处理 ==========

let _gestureId = 0;
let _gestureStartX = 0;
let _gestureStartY = 0;

export function initScrollGesture(): void {
  if (_gestureId) return; // 只注册一次

  const unreg = gestures.register({
    id: 'sidebar-scroll',
    targetFilter: () => true,
    condition: () => !L._sidebarClosed && !!L.renderer,
    priority: 60,
    onStart(e) {
      if (e.button !== 0) return;
      _gestureStartX = e.clientX;
      _gestureStartY = e.clientY;
      const y = e.clientY;
      lastTouchY = y;
      lastTouchTime = performance.now();
      if (L._flingRaf) { cancelAnimationFrame(L._flingRaf); L._flingRaf = 0; }
      if (L._cursorFlingRaf) { cancelAnimationFrame(L._cursorFlingRaf); L._cursorFlingRaf = 0; }
      _touchIsCursor = _isCursorMode();
      if (_touchIsCursor) {
        cursorTouchBase = Math.max(0, getCursorRowIndex());
        cursorTouchStartY = y;
        cursorLastTouchY = y;
        cursorLastTouchTime = lastTouchTime;
        cursorVelocity = 0;
      } else {
        touchStartY = y;
        touchScrollY = getRootScrollY() ?? 0;
        L._lastUserScrollY = touchScrollY;
        velocity = 0;
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
    },
    onMove(e) {
      const y = e.clientY;
      const now = performance.now();
      if (_touchIsCursor) {
        const dy = cursorTouchStartY - y;
        const dt = now - cursorLastTouchTime;
        if (dt > 0) cursorVelocity = (cursorLastTouchY - y) / dt * 16 * 1.7;
        cursorLastTouchY = y;
        cursorLastTouchTime = now;
        const stepOffset = dy / LINE_HEIGHT;
        const raw = Math.round(cursorTouchBase + stepOffset);
        const idx = ((raw % L._rowIndex.length) + L._rowIndex.length) % L._rowIndex.length;
        if (L._rowIndex[idx]) moveCursorTo(L._rowIndex[idx]);
        return;
      }
      const dy = touchStartY - y;
      const dt = now - lastTouchTime;
      if (dt > 0) velocity = (lastTouchY - y) / dt * 16 * 1.7;
      const dPen = lastTouchY - y;
      lastTouchY = y;
      lastTouchTime = now;
      const root3 = L.renderer?.getRoot();
      const maxY = root3?.getMaxScroll().maxY ?? 0;
      if (_boundPen > 0) {
        _boundPen = Math.max(0, _boundPen + (_boundIsTop ? -dPen : dPen));
        if (_boundPen === 0) {
          touchScrollY = _boundIsTop ? 0 : maxY;
          touchStartY = y;
          setRootScrollY(touchScrollY);
          _snapCursorToCenter();
        } else {
          setRootScrollY(_boundIsTop ? 0 : maxY);
          const steps = Math.floor(_boundPen / LINE_HEIGHT);
          const centerIdx = _getCenterRowIndex();
          if (centerIdx >= 0 && steps > 0) {
            const targetIdx = _boundIsTop ? Math.max(0, centerIdx - steps) : Math.min(L._rowIndex.length - 1, centerIdx + steps);
            if (L._rowIndex[targetIdx]) moveCursorTo(L._rowIndex[targetIdx]);
          } else { _snapCursorToCenter(); }
        }
      } else {
        const desired = touchScrollY + dy;
        if (desired < 0 && maxY > 0) {
          _boundPen = -desired; _boundIsTop = true; setRootScrollY(0);
          const steps2 = Math.floor(_boundPen / LINE_HEIGHT);
          const centerIdx2 = _getCenterRowIndex();
          if (centerIdx2 >= 0 && steps2 > 0) { const t2 = Math.max(0, centerIdx2 - steps2); if (L._rowIndex[t2]) moveCursorTo(L._rowIndex[t2]); }
        } else if (desired > maxY) {
          _boundPen = desired - maxY; _boundIsTop = false; setRootScrollY(maxY);
          const steps = Math.floor(_boundPen / LINE_HEIGHT);
          const centerIdx = _getCenterRowIndex();
          if (centerIdx >= 0 && steps > 0) { const t = Math.min(L._rowIndex.length - 1, centerIdx + steps); if (L._rowIndex[t]) moveCursorTo(L._rowIndex[t]); }
        } else {
          setRootScrollY(desired);
          L._lastUserScrollY = desired;
          _snapCursorToCenter();
        }
      }
    },
    onEnd(e, dx, dy) {
      // picker 打开时：检测点击 → 切换目录，否则忽略手势（不关闭侧栏）
      if (isPickerOpen()) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) pickerHandleClick();
        return;
      }
      // 水平滑动检测 → 关闭侧栏
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);
      if (absDx > 60 && absDx > absDy * 1.5 && dx < -60) {
        closeSidebar();
        return;
      }
      if (_touchIsCursor) {
        if (Math.abs(cursorVelocity) >= 0.5 && L._rowIndex.length > 0) {
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
      if (Math.abs(velocity) < 0.5) return;
      let flingPen = _boundPen;
      let flingIsTop = _boundIsTop;
      const flingMaxY = L.renderer?.getRoot()?.getMaxScroll().maxY ?? 0;
      function fling() {
        if (L._sidebarClosed) { L._flingRaf = 0; return; }
        velocity *= 0.96;
        if (Math.abs(velocity) < 0.3) { L._flingRaf = 0; return; }
        if (flingPen > 0) {
          flingPen = Math.max(0, flingPen + (flingIsTop ? -velocity : velocity));
          if (flingPen === 0) {
            setRootScrollY(flingIsTop ? 0 : flingMaxY);
            _snapCursorToCenter();
          } else {
            setRootScrollY(flingIsTop ? 0 : flingMaxY);
            const steps = Math.floor(flingPen / LINE_HEIGHT);
            const centerIdx = _getCenterRowIndex();
            if (centerIdx >= 0 && steps > 0) {
              const targetIdx = flingIsTop ? Math.max(0, centerIdx - steps) : Math.min(L._rowIndex.length - 1, centerIdx + steps);
              if (L._rowIndex[targetIdx]) moveCursorTo(L._rowIndex[targetIdx]);
            }
          }
        } else {
          const cur = getRootScrollY() ?? 0;
          const desired = cur + velocity;
          if (desired < 0 && flingMaxY > 0) {
            flingPen = -desired; flingIsTop = true; setRootScrollY(0);
            const centerIdx = _getCenterRowIndex();
            const steps = Math.floor(flingPen / LINE_HEIGHT);
            if (centerIdx >= 0 && steps > 0) {
              const targetIdx = Math.max(0, centerIdx - steps);
              if (L._rowIndex[targetIdx]) moveCursorTo(L._rowIndex[targetIdx]);
            }
          } else if (desired > flingMaxY) {
            flingPen = desired - flingMaxY; flingIsTop = false; setRootScrollY(flingMaxY);
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
    },
  });

  _gestureId = 1;
}