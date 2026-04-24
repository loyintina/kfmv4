/**
 * KFM v3 — 手势识别器
 *
 * 决策：D-013（手势属性化）
 * 创建：2026-04-18
 * 维护：卡萝
 *
 * 独立的手势识别器，从 gesture.ts 的边缘检测扩展为完整的手势识别系统。
 * 与 Box.gesture 属性配合使用。
 */

import type { Box, GestureConfig, GestureType, GestureEventData, GestureEventHandler, GestureThresholds } from './types.js';
import { DEFAULT_GESTURE_THRESHOLDS } from './types.js';

// ============================================================
// 手势状态
// ============================================================

interface GestureState {
  isTracking: boolean;
  startX: number;
  startY: number;
  startTime: number;
  currentX: number;
  currentY: number;
  targetBox: Box | null;
  gestureConfig: GestureConfig | null;
  
  // 多点触控
  pointers: Map<number, { x: number; y: number; startTime: number }>;
  
  // 初始距离/角度（用于 pinch/rotate）
  initialDistance: number;
  initialAngle: number;
  
  // 双击检测（Phase 2 Demo）
  lastTapTime: number;
  lastTapX: number;
  lastTapY: number;
  lastTapBox: Box | null;
}

function createGestureState(): GestureState {
  return {
    isTracking: false,
    startX: 0,
    startY: 0,
    startTime: 0,
    currentX: 0,
    currentY: 0,
    targetBox: null,
    gestureConfig: null,
    pointers: new Map(),
    initialDistance: 0,
    initialAngle: 0,
    // 双击检测初始化
    lastTapTime: 0,
    lastTapX: 0,
    lastTapY: 0,
    lastTapBox: null,
  };
}

// ============================================================
// GestureRecognizer 类
// ============================================================

export class GestureRecognizer {
  private state: GestureState;
  private thresholds: GestureThresholds;
  private renderer: { hitTest: (x: number, y: number) => Box | null };
  
  constructor(
    renderer: { hitTest: (x: number, y: number) => Box | null },
    thresholds?: Partial<GestureThresholds>
  ) {
    this.state = createGestureState();
    this.thresholds = { ...DEFAULT_GESTURE_THRESHOLDS, ...thresholds };
    this.renderer = renderer;
  }
  
  // ============================================================
  // 触摸事件处理
  // ============================================================
  
  /** 触摸开始 */
  onTouchStart(x: number, y: number, pointerId: number = 0): void {
    const box = this.renderer.hitTest(x, y);
    
    if (!box || !box.gesture) {
      this.state.isTracking = false;
      return;
    }
    
    // 如果不支持多点触控且已有追踪，忽略
    if (this.state.isTracking && !box.gesture.multiTouch) {
      return;
    }
    
    // 初始化追踪
    if (!this.state.isTracking) {
      this.state.isTracking = true;
      this.state.startX = x;
      this.state.startY = y;
      this.state.startTime = performance.now();
      this.state.targetBox = box;
      this.state.gestureConfig = box.gesture;
    }
    
    // 记录指针
    this.state.pointers.set(pointerId, { x, y, startTime: performance.now() });
    
    // 多点触控初始化
    if (this.state.pointers.size === 2) {
      const positions = Array.from(this.state.pointers.values());
      this.state.initialDistance = this._getDistance(positions[0], positions[1]);
      this.state.initialAngle = this._getAngle(positions[0], positions[1]);
    }
  }
  
  /** 触摸移动 */
  onTouchMove(x: number, y: number, pointerId: number = 0): void {
    if (!this.state.isTracking) return;
    
    this.state.currentX = x;
    this.state.currentY = y;
    
    // 更新指针位置
    const pointer = this.state.pointers.get(pointerId);
    if (pointer) {
      pointer.x = x;
      pointer.y = y;
    }
    
    const config = this.state.gestureConfig;
    if (!config) return;
    
    const deltaX = x - this.state.startX;
    const deltaY = y - this.state.startY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    // 检测 pan（拖动）
    if (distance > this.thresholds.panThreshold && config.onPan) {
      const angle = Math.atan2(deltaY, deltaX) * 180 / Math.PI;
      
      // 判断是否在滑动方向（角度约束）
      if (!this._isSwipeDirection(angle)) {
        config.onPan({
          box: this.state.targetBox!,
          type: 'pan',
          x, y,
          deltaX, deltaY,
          originalEvent: undefined,
        });
      }
    }
    
    // 多点触控：pinch 和 rotate
    if (this.state.pointers.size === 2 && (config.onPinch || config.onRotate)) {
      const positions = Array.from(this.state.pointers.values());
      const currentDistance = this._getDistance(positions[0], positions[1]);
      const currentAngle = this._getAngle(positions[0], positions[1]);
      
      if (config.onPinch && currentDistance !== this.state.initialDistance) {
        const scale = currentDistance / this.state.initialDistance;
        config.onPinch({
          box: this.state.targetBox!,
          type: 'pinch',
          x: (positions[0].x + positions[1].x) / 2,
          y: (positions[0].y + positions[1].y) / 2,
          scale,
          originalEvent: undefined,
        });
      }
      
      if (config.onRotate && currentAngle !== this.state.initialAngle) {
        const rotation = currentAngle - this.state.initialAngle;
        config.onRotate({
          box: this.state.targetBox!,
          type: 'rotate',
          x: (positions[0].x + positions[1].x) / 2,
          y: (positions[0].y + positions[1].y) / 2,
          rotation,
          originalEvent: undefined,
        });
      }
    }
  }
  
  /** 触摸结束 */
  onTouchEnd(x: number, y: number, pointerId: number = 0): void {
    if (!this.state.isTracking) return;
    
    this.state.pointers.delete(pointerId);
    
    // 如果还有指针在追踪，不结束手势
    if (this.state.pointers.size > 0) return;
    
    const config = this.state.gestureConfig;
    if (!config || !this.state.targetBox) {
      this._resetState();
      return;
    }
    
    const deltaX = x - this.state.startX;
    const deltaY = y - this.state.startY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const duration = performance.now() - this.state.startTime;
    const angle = Math.atan2(deltaY, deltaX) * 180 / Math.PI;
    
    // 判断手势类型
    let gestureType: GestureType | null = null;
    let handler: GestureEventHandler | undefined;
    
    // ===== 双击检测（Phase 2 Demo）=====
    // 先检查是否满足双击条件
    const timeSinceLastTap = performance.now() - this.state.lastTapTime;
    const distanceFromLastTap = Math.sqrt(
      Math.pow(x - this.state.lastTapX, 2) +
      Math.pow(y - this.state.lastTapY, 2)
    );
    const isSameBox = this.state.lastTapBox === this.state.targetBox;
    
    // 双击条件：同一 Box、时间间隔 < doubleTapInterval、位置接近（< 50px）
    if (
      isSameBox &&
      timeSinceLastTap < this.thresholds.doubleTapInterval &&
      distanceFromLastTap < 50 &&
      config.onDoubleTap
    ) {
      gestureType = 'doubleTap';
      handler = config.onDoubleTap;
      // 清除上次 tap 记录，避免三击触发双击
      this.state.lastTapTime = 0;
      this.state.lastTapBox = null;
    } else if (distance < this.thresholds.tapTolerance && duration < this.thresholds.longPressDelay) {
      // tap
      gestureType = 'tap';
      handler = config.onTap;
      // 记录本次 tap，用于下次双击检测
      this.state.lastTapTime = performance.now();
      this.state.lastTapX = x;
      this.state.lastTapY = y;
      this.state.lastTapBox = this.state.targetBox;
    } else if (distance < this.thresholds.tapTolerance && duration >= this.thresholds.longPressDelay) {
      // longPress
      gestureType = 'longPress';
      handler = config.onLongPress;
    } else if (distance >= this.thresholds.swipeThreshold) {
      // swipe
      if (this._isSwipeDirection(angle)) {
        if (angle >= -this.thresholds.swipeAngleTolerance && angle <= this.thresholds.swipeAngleTolerance) {
          gestureType = 'swipeRight';
          handler = config.onSwipeRight;
        } else if (angle >= 180 - this.thresholds.swipeAngleTolerance || angle <= -180 + this.thresholds.swipeAngleTolerance) {
          gestureType = 'swipeLeft';
          handler = config.onSwipeLeft;
        } else if (angle >= 90 - this.thresholds.swipeAngleTolerance && angle <= 90 + this.thresholds.swipeAngleTolerance) {
          gestureType = 'swipeDown';
          handler = config.onSwipeDown;
        } else if (angle >= -90 - this.thresholds.swipeAngleTolerance && angle <= -90 + this.thresholds.swipeAngleTolerance) {
          gestureType = 'swipeUp';
          handler = config.onSwipeUp;
        }
      }
    }
    
    // 触发回调
    if (handler && gestureType) {
      handler({
        box: this.state.targetBox,
        type: gestureType,
        x, y,
        deltaX, deltaY,
        duration,
        originalEvent: undefined,
      });
    } else if (config.onPanEnd && distance > this.thresholds.panThreshold) {
      // pan 结束
      config.onPanEnd({
        box: this.state.targetBox,
        type: 'pan',
        x, y,
        deltaX, deltaY,
        originalEvent: undefined,
      });
    }
    
    this._resetState();
  }
  
  /** 触摸取消 */
  onTouchCancel(): void {
    if (!this.state.isTracking) return;
    
    const config = this.state.gestureConfig;
    if (config?.onCancel && this.state.targetBox) {
      config.onCancel({
        box: this.state.targetBox,
        type: 'tap', // 取消时类型不重要
        x: this.state.currentX,
        y: this.state.currentY,
        originalEvent: undefined,
      });
    }
    
    this._resetState();
  }
  
  // ============================================================
  // 辅助方法
  // ============================================================
  
  private _resetState(): void {
    this.state = createGestureState();
  }
  
  private _getDistance(p1: { x: number; y: number }, p2: { x: number; y: number }): number {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
  
  private _getAngle(p1: { x: number; y: number }, p2: { x: number; y: number }): number {
    return Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI;
  }
  
  /** 判断角度是否在滑动方向（±角度容差内为有效滑动） */
  private _isSwipeDirection(angle: number): boolean {
    const tolerance = this.thresholds.swipeAngleTolerance;
    // 检查四个方向：右(0°)、左(180°/-180°)、下(90°)、上(-90°)
    return (
      (angle >= -tolerance && angle <= tolerance) ||
      (angle >= 180 - tolerance || angle <= -180 + tolerance) ||
      (angle >= 90 - tolerance && angle <= 90 + tolerance) ||
      (angle >= -90 - tolerance && angle <= -90 + tolerance)
    );
  }
}

// ============================================================
// 自检函数
// ============================================================

export function runGestureRecognizerSelfChecks(): boolean {
  console.log('\n========== GestureRecognizer 自检 ==========\n');
  
  let allPass = true;
  
  // 检查阈值默认值
  const thresholds = DEFAULT_GESTURE_THRESHOLDS;
  
  const check = (label: string, actual: number, expected: number) => {
    const pass = actual === expected;
    console.log(`[手势识别器自检] ${label}: ${actual} (预期: ${expected}) ${pass ? '✅' : '❌'}`);
    return pass;
  };
  
  allPass = check('longPressDelay', thresholds.longPressDelay, 300) && allPass;
  allPass = check('doubleTapInterval', thresholds.doubleTapInterval, 300) && allPass;
  allPass = check('tapTolerance', thresholds.tapTolerance, 10) && allPass;
  allPass = check('swipeThreshold', thresholds.swipeThreshold, 50) && allPass;
  allPass = check('swipeAngleTolerance', thresholds.swipeAngleTolerance, 30) && allPass;
  allPass = check('panThreshold', thresholds.panThreshold, 5) && allPass;
  
  console.log(`\n========== 结果: ${allPass ? '✅ 全部通过' : '❌ 存在失败'} ==========\\n`);
  
  return allPass;
}