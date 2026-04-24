/**
 * KFM v3 — 手势框架
 * 
 * 决策：D-013（手势属性化）、A-002（三层解耦）
 * 创建：2026-04-15
 * 维护：卡萝
 * 
 * 边缘检测 + 滑动识别 + 磁吸效果
 * 来源：VISION §3.1 + COMPONENT_PROTOCOL §3.4
 */

// ============================================================
// 常量定义
// ============================================================

/** 边缘检测阈值：从屏幕边缘多少像素内开始检测 */
export const EDGE_THRESHOLD = 20;

/** 滑动触发阈值：滑动超过多少像素触发展开/折叠 */
export const SLIDE_THRESHOLD = 60;

/** 磁吸阈值：滑动超过多少像素自动完成（不留中间态） */
export const SNAP_THRESHOLD = 150;

/** 按住触发阈值：按住多久开始伸出（叠叠乐预留） */
export const HOLD_THRESHOLD_MS = 300;

// ============================================================
// 边缘检测
// ============================================================

/**
 * 检测触摸点是否在边缘区域
 * 
 * 来源：VISION §3.1「手势召唤：边缘滑动召唤侧边栏」
 * 
 * @param x 触摸点 x 坐标
 * @param viewportWidth 视口宽度
 * @returns 边缘类型或 null
 */
export function detectEdgeTouch(x: number, viewportWidth: number): 'left' | 'right' | null {
  if (x < EDGE_THRESHOLD) return 'left';
  if (x > viewportWidth - EDGE_THRESHOLD) return 'right';
  return null;
}

// ============================================================
// 滑动识别
// ============================================================

/**
 * 滑动状态
 */
export interface SlideState {
  /** 是否正在滑动 */
  isSliding: boolean;
  /** 滑动起始位置 */
  startX: number;
  startY: number;
  /** 当前滑动距离 */
  distance: number;
  /** 滑动方向 */
  direction: 'left' | 'right' | 'up' | 'down' | null;
  /** 目标边缘（左/右栏） */
  targetEdge: 'left' | 'right' | null;
}

/**
 * 创建初始滑动状态
 */
export function createSlideState(): SlideState {
  return {
    isSliding: false,
    startX: 0,
    startY: 0,
    distance: 0,
    direction: null,
    targetEdge: null,
  };
}

/**
 * 开始滑动
 * 
 * @param state 滑动状态
 * @param x 触摸点 x
 * @param y 触摸点 y
 * @param viewportWidth 视口宽度
 * @returns 是否有效滑动开始
 */
export function startSlide(
  state: SlideState,
  x: number,
  y: number,
  viewportWidth: number
): boolean {
  // 先检测边缘
  const edge = detectEdgeTouch(x, viewportWidth);
  if (!edge) return false;
  
  state.isSliding = true;
  state.startX = x;
  state.startY = y;
  state.distance = 0;
  state.direction = null;
  state.targetEdge = edge;
  
  return true;
}

/**
 * 更新滑动
 * 
 * @param state 滑动状态
 * @param x 当前触摸点 x
 * @param y 当前触摸点 y
 */
export function updateSlide(state: SlideState, x: number, y: number): void {
  if (!state.isSliding) return;
  
  const dx = x - state.startX;
  const dy = y - state.startY;
  
  // 计算滑动距离（取绝对值较大的方向）
  if (Math.abs(dx) > Math.abs(dy)) {
    state.distance = Math.abs(dx);
    state.direction = dx > 0 ? 'right' : 'left';
  } else {
    state.distance = Math.abs(dy);
    state.direction = dy > 0 ? 'down' : 'up';
  }
}

/**
 * 结束滑动，判断是否触发动作
 * 
 * @param state 滑动状态
 * @returns 滑动结果
 */
export function endSlide(state: SlideState): SlideResult {
  if (!state.isSliding) {
    return { action: 'none', distance: 0 };
  }
  
  const distance = state.distance;
  
  // 磁吸判定：超过 SNAP_THRESHOLD 自动完成
  if (distance > SNAP_THRESHOLD) {
    return { action: 'snap', distance };
  }
  
  // 滑动触发：超过 SLIDE_THRESHOLD 开始展开/折叠
  if (distance > SLIDE_THRESHOLD) {
    return { action: 'trigger', distance };
  }
  
  // 未达到阈值，回弹
  return { action: 'cancel', distance };
}

/**
 * 滑动结果
 */
export interface SlideResult {
  /** 动作类型 */
  action: 'none' | 'cancel' | 'trigger' | 'snap';
  /** 滑动距离 */
  distance: number;
}

// ============================================================
// 面板折叠/展开
// ============================================================

/**
 * 面板状态（用于三段式布局）
 * 
 * 来源：TASK-003 手势框架预留
 */
export interface PanelState {
  /** 是否折叠 */
  collapsed: boolean;
  /** 当前宽度（折叠时 = 0，展开时 = 原始宽度） */
  width: number;
  /** 原始宽度（用于展开恢复） */
  collapsedWidth: number;
}

/**
 * 创建面板状态
 */
export function createPanelState(collapsedWidth: number, initiallyCollapsed: boolean = false): PanelState {
  return {
    collapsed: initiallyCollapsed,
    width: initiallyCollapsed ? 0 : collapsedWidth,
    collapsedWidth,
  };
}

/**
 * 处理面板滑动
 * 
 * @param panel 面板状态
 * @param distance 滑动距离
 * @param edge 边缘类型
 */
export function handlePanelSlide(
  panel: PanelState,
  distance: number,
  edge: 'left' | 'right'
): void {
  if (distance < SLIDE_THRESHOLD) return;
  
  // 计算临时宽度（跟随手指移动）
  if (panel.collapsed) {
    // 折叠状态：从边缘滑动 → 展开
    panel.width = Math.min(distance, panel.collapsedWidth);
  } else {
    // 展开状态：向边缘滑动 → 折叠
    panel.width = Math.max(panel.collapsedWidth - distance, 0);
  }
}

/**
 * 完成面板滑动（磁吸效果）
 * 
 * @param panel 面板状态
 * @param distance 滑动距离
 * @param snap 是否磁吸
 */
export function finishPanelSlide(panel: PanelState, distance: number, snap: boolean): void {
  if (snap) {
    // 磁吸：自动切换状态
    panel.collapsed = !panel.collapsed;
    panel.width = panel.collapsed ? 0 : panel.collapsedWidth;
  } else if (distance > SLIDE_THRESHOLD) {
    // 部分触发：保持中间态（后续可动画完成）
    // 这里简化为直接切换
    if (panel.collapsed && distance > panel.collapsedWidth / 2) {
      panel.collapsed = false;
      panel.width = panel.collapsedWidth;
    } else if (!panel.collapsed && distance > panel.collapsedWidth / 2) {
      panel.collapsed = true;
      panel.width = 0;
    }
  } else {
    // 回弹：恢复原状态
    panel.width = panel.collapsed ? 0 : panel.collapsedWidth;
  }
}

// ============================================================
// 自检函数
// ============================================================

/**
 * 手势框架自检
 */
export function selfCheckGesture(
  label: string,
  actual: number,
  expected: number,
  tolerance: number = 0.5
): boolean {
  const pass = Math.abs(actual - expected) <= tolerance;
  console.log(
    `[手势自检] ${label}: ${actual} (预期: ${expected}, 容差: ±${tolerance}) ${pass ? '✅' : '❌'}`
  );
  return pass;
}

/**
 * 运行手势框架自检
 */
export function runGestureSelfChecks(): boolean {
  console.log('\n========== 手势框架自检 ==========\n');
  
  let allPass = true;
  
  // 场景 A：边缘检测
  allPass = selfCheckGesture('A: 左边缘 x=10', detectEdgeTouch(10, 400) === 'left' ? 1 : 0, 1) && allPass;
  allPass = selfCheckGesture('A: 右边缘 x=395', detectEdgeTouch(395, 400) === 'right' ? 1 : 0, 1) && allPass;
  allPass = selfCheckGesture('A: 中央 x=200', detectEdgeTouch(200, 400) === null ? 1 : 0, 1) && allPass;
  
  // 场景 B：滑动阈值
  allPass = selfCheckGesture('B: SLIDE_THRESHOLD', SLIDE_THRESHOLD, 60) && allPass;
  allPass = selfCheckGesture('B: SNAP_THRESHOLD', SNAP_THRESHOLD, 150) && allPass;
  allPass = selfCheckGesture('B: EDGE_THRESHOLD', EDGE_THRESHOLD, 20) && allPass;
  
  // 场景 C：滑动结果判定
  const state = createSlideState();
  startSlide(state, 10, 100, 400);
  updateSlide(state, 100, 100); // 滑动 90px
  const result = endSlide(state);
  allPass = selfCheckGesture('C: 滑动 90px → trigger', result.action === 'trigger' ? 1 : 0, 1) && allPass;
  
  // 场景 D：磁吸判定
  const state2 = createSlideState();
  startSlide(state2, 10, 100, 400);
  updateSlide(state2, 200, 100); // 滑动 190px
  const result2 = endSlide(state2);
  allPass = selfCheckGesture('D: 滑动 190px → snap', result2.action === 'snap' ? 1 : 0, 1) && allPass;
  
  console.log(`\n========== 结果: ${allPass ? '✅ 全部通过' : '❌ 存在失败'} ==========\\n`);
  
  return allPass;
}