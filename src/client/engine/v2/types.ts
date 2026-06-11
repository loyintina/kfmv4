/**
 * KFM v3 — Box 系统类型定义
 * 
 * 决策：A-002（三层解耦）、D-001（万物皆盒）
 * 创建：2026-04-12
 * 维护：卡萝
 * 
 * 所有类型集中在这个文件，其他模块只引用不定义。
 * 这保证类型是「单一事实来源」。
 */

// ============================================================
// 盒模型
// ============================================================

/** 四方向间距 */
export interface Spacing {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

// ============================================================
// 边框
// ============================================================

/** 边框方向控制 */
export interface BorderSides {
  top: boolean;
  right: boolean;
  bottom: boolean;
  left: boolean;
}

/** 所有方向都有边框 */
export const ALL_SIDES: BorderSides = { top: true, right: true, bottom: true, left: true };

/** 只有左边 */
export const LEFT_ONLY: BorderSides = { top: false, right: false, bottom: false, left: true };

/** 边框配置 */
/** 简化边框配置（用于基础视觉样式） */
export interface VisualBorderConfig {
  color: string;
  width: number;
  sides: BorderSides;
}

// ============================================================
// 高亮边框（KFM 核心视觉特征）
// ============================================================

/** 左侧高亮边框 */
export interface HighlightConfig {
  color: string;
  width: number;
  side?: string;
}

// ============================================================
// 阴影
// ============================================================

/** 阴影配置 */
export interface ShadowConfig {
  color: string;
  blur: number;
  offsetX: number;
  offsetY: number;
}

// ============================================================
// 背景渐变
// ============================================================

export type GradientType = 'linear' | 'radial';

export interface GradientStop {
  offset: number;
  color: string;
}

export interface GradientConfig {
  type: GradientType;
  angle: number;
  stops: GradientStop[];
}

// ============================================================
// 背景图案（网格等）— Phase 2 Demo
// ============================================================

export type BackgroundPatternType = 'grid' | 'dots' | 'none';

export interface BackgroundPatternConfig {
  type: BackgroundPatternType;
  cellSize?: number;      // 网格单元格大小（默认 20）
  lineColor?: string;     // 网格线颜色（默认暗色）
  lineWidth?: number;     // 网格线宽度（默认 1）
}

// ============================================================
// 文本
// ============================================================

export type TextAlign = 'left' | 'center' | 'right';
export type TextVerticalAlign = 'top' | 'middle' | 'bottom';
export type TextOverflow = 'ellipsis' | 'wrap' | 'clip' | 'visible';

/** 文本样式配置 */
export interface TextStyle {
  content: string;
  color: string;
  font: string;
  lineHeight: number;
  align: TextAlign;
  verticalAlign: TextVerticalAlign;
  overflow: TextOverflow;
  maxLines: number;
}

// ============================================================
// 图标
// ============================================================

export type IconPosition = 'left' | 'right';

export interface IconConfig {
  char: string;
  size: number;
  position: IconPosition;
}

// ============================================================
// 交互状态
// ============================================================

export type BoxState = 'normal' | 'hover' | 'pressed' | 'disabled' | 'focused';

/** 状态相关的视觉覆盖 */
export interface StateStyles {
  normal?: Partial<Pick<BoxVisualStyle, 'backgroundColor' | 'border' | 'opacity' | 'shadow'>>;
  hover?: Partial<Pick<BoxVisualStyle, 'backgroundColor' | 'border' | 'opacity' | 'shadow'>>;
  pressed?: Partial<Pick<BoxVisualStyle, 'backgroundColor' | 'border' | 'opacity' | 'shadow'>>;
  disabled?: Partial<Pick<BoxVisualStyle, 'backgroundColor' | 'border' | 'opacity' | 'shadow'>>;
  focused?: Partial<Pick<BoxVisualStyle, 'backgroundColor' | 'border' | 'opacity' | 'shadow'>>;
}

// ============================================================
// 变换
// ============================================================

export interface Transform {
  scale: number;
  rotate: number;
  translateX: number;
  translateY: number;
}

// ============================================================
// 溢出
// ============================================================

export type Overflow = 'visible' | 'hidden';

// ============================================================
// 语义类型
// ============================================================

export type BoxType = 
  | 'container'
  | 'button'
  | 'input'
  | 'label'
  | 'list-item'
  | 'panel'
  | 'divider';

// ============================================================
// 动画
// ============================================================

export type AnimProp = 'opacity' | 'scale' | 'rotate' | 'translateX' | 'translateY' | 'x' | 'y' | 'width' | 'height';

export interface Animation {
  prop: AnimProp;
  from: number;
  to: number;
  duration: number;
  startTime: number;
  easing: EasingName;
  onComplete?: () => void;
}

export type EasingName =
  | 'linear'
  | 'easeInQuad' | 'easeOutQuad' | 'easeInOutQuad'
  | 'easeInCubic' | 'easeOutCubic' | 'easeInOutCubic'
  | 'easeOutElastic' | 'easeOutBounce';

// ============================================================
// 滚动容器
// ============================================================

export type ScrollDirection = 'vertical' | 'horizontal' | 'both';

export interface ScrollConfig {
  scrollable?: boolean;        // 是否启用滚动（默认 false）
  scrollX?: number;            // 水平滚动偏移（默认 0）
  scrollY?: number;            // 垂直滚动偏移（默认 0）
  scrollDirection?: ScrollDirection;  // 滚动方向（默认 vertical）
  scrollbarVisible?: boolean;  // 是否显示滚动条指示（默认 true）
}

// ============================================================
// Flex 布局
// ============================================================

export type FlexDirection = 'row' | 'column' | 'row-reverse' | 'column-reverse';
export type JustifyContent = 'flex-start' | 'flex-end' | 'center' | 'space-between' | 'space-around' | 'space-evenly';
export type AlignItems = 'flex-start' | 'flex-end' | 'center' | 'stretch';
export type FlexWrap = 'nowrap' | 'wrap';
export type FlexItemAlign = 'auto' | 'flex-start' | 'flex-end' | 'center' | 'stretch';

export interface FlexStyle {
  flexDirection?: FlexDirection;
  justifyContent?: JustifyContent;
  alignItems?: AlignItems;
  flexWrap?: FlexWrap;
  gap?: number;
  rowGap?: number;
  columnGap?: number;
}

export interface FlexItemStyle {
  flex?: number;
  flexShrink?: number;
  flexBasis?: number | 'auto';
  alignSelf?: FlexItemAlign;
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
}

// ============================================================
// 样式层（所有视觉属性的集合）
// ============================================================

/** 基础视觉样式（用于 Box.getStateStyle() 等场景） */
export interface BoxVisualStyle {
  backgroundColor: string;
  gradient: GradientConfig | null;
  border: VisualBorderConfig | null;
  highlight: HighlightConfig | null;
  shadow: ShadowConfig | null;
  borderRadius: number;
  opacity: number;
}

// ============================================================
// 碰撞检测
// ============================================================

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ============================================================
// 手势类型（D-013 决策：手势属性化）
// ============================================================

/** 手势类型 */
export type GestureType = 
  | 'tap'        // 点击
  | 'doubleTap'  // 双击（Phase 2 Demo）
  | 'longPress'  // 长按
  | 'swipeLeft'  // 左滑
  | 'swipeRight' // 右滑
  | 'swipeUp'    // 上滑
  | 'swipeDown'  // 下滑
  | 'pan'        // 拖动
  | 'pinch'      // 双指缩放
  | 'rotate';    // 双指旋转

/** 手势事件数据 */
export interface GestureEventData {
  box: Box;
  type: GestureType;
  x: number;
  y: number;
  deltaX?: number;   // 滑动/拖动的 X 偏移
  deltaY?: number;   // 滑动/拖动的 Y 偏移
  duration?: number; // 长按时长
  scale?: number;    // 缩放比例
  rotation?: number; // 旋转角度
  originalEvent?: Event;
}

/** 手势事件处理器 */
export type GestureEventHandler = (data?: GestureEventData) => void;

/** 手势阈值配置 */
export interface GestureThresholds {
  longPressDelay: number;     // 长按触发延迟（默认 300ms）
  doubleTapInterval: number;  // 双击间隔（默认 300ms）
  tapTolerance: number;       // 点击容差（默认 10px）
  swipeThreshold: number;     // 滑动触发距离（默认 50px）
  swipeAngleTolerance: number;// 滑动角度容差（默认 30°）
  panThreshold: number;       // 拖动触发距离（默认 5px）
}

/** 默认手势阈值 */
export const DEFAULT_GESTURE_THRESHOLDS: GestureThresholds = {
  longPressDelay: 300,
  doubleTapInterval: 300,
  tapTolerance: 10,
  swipeThreshold: 50,
  swipeAngleTolerance: 30,
  panThreshold: 5,
};

/** 手势配置（Box.gesture 属性类型） */
export interface GestureConfig {
  /** 是否穿透下层（默认 true，D-013 决策） */
  passive?: boolean;
  /** 阈值覆盖 */
  thresholds?: Partial<GestureThresholds>;
  /** 是否支持多点触控（默认 false） */
  multiTouch?: boolean;
  
  // 手势回调
  onTap?: GestureEventHandler;
  onDoubleTap?: GestureEventHandler;  // Phase 2 Demo：双击打开编辑器
  onLongPress?: GestureEventHandler;
  onSwipeLeft?: GestureEventHandler;
  onSwipeRight?: GestureEventHandler;
  onSwipeUp?: GestureEventHandler;
  onSwipeDown?: GestureEventHandler;
  onPan?: GestureEventHandler;
  onPanEnd?: GestureEventHandler;
  onPinch?: GestureEventHandler;
  onRotate?: GestureEventHandler;
  onCancel?: GestureEventHandler;
}

// ============================================================
// 事件（hover 保持 BoxEventHandler，不是手势）
// ============================================================

export type BoxEventType = 'click' | 'hoverIn' | 'hoverOut' | 'press' | 'release' | 'longPress';

export interface BoxEventData {
  box: Box;
  x: number;
  y: number;
  originalEvent?: Event;
}

export type BoxEventHandler = (data: BoxEventData) => void;

// ============================================================
// 前置声明接口（Box 类在 box.ts 中定义）
// ============================================================

/** Box 前置声明（供其他模块引用核心属性） */
export interface Box {
  id: string;
  zIndex?: number;
  gesture?: GestureConfig | null;  // D-013 手势属性化
  
  // 几何属性（flex.ts 等模块需要）
  x: number;
  y: number;
  width: number;
  height: number;
  padding: Spacing;
  margin: Spacing;
  visible: boolean;
  interactive: boolean;
  disabled: boolean;
  children: Box[];
  parent: Box | null;
  layout: FlexStyle | null;
  layoutItem: FlexItemStyle | null;
  scrollable: boolean;
  scrollY: number;
  scrollX: number;
  backgroundColor: string;
}
// ============================================================
// 矢量形状（Box 挖空/图标）— Phase 2 Demo
// ============================================================

export interface ShapePoint {
  x: number;  // 归一化坐标 0~1，相对于 Box 宽度
  y: number;  // 归一化坐标 0~1，相对于 Box 高度
}

export interface ShapeConfig {
  points: ShapePoint[];
  closed?: boolean;        // 是否闭合路径，默认 true
  composite?: 'destination-out' | 'source-over';  // 混合模式，默认 destination-out（挖空）
}

// ============================================================
// 可输入配置（Box.inputable）— Phase 2 Demo
// ============================================================

export type InputType = 'text' | 'textarea';

export interface InputConfig {
  enabled: boolean;           // 是否可输入
  type?: InputType;           // 输入类型，默认 text
  placeholder?: string;       // 占位文字
  value?: string;             // 当前值
  maxRows?: number;           // 最大行数（textarea 用）
  lineHeight?: number;        // 行高（textarea 用）
}

// ============================================================
// 渲染器颜色注入（引擎不依赖应用层主题）
// ============================================================

/** 渲染器需要的颜色值。由应用层在创建 Renderer 时注入。 */
export interface RenderTheme {
  bg: string;         // 画布背景色，如 '#0a0a0f'
  gridLine: string;   // 网格线颜色，如 '#2a2a3a'
  text: string;       // 文字颜色，如 '#e0e0e0'
  cursor: string;     // 光标颜色，如 'rgba(0,212,255,0.7)'
  accent: string;     // 强调色，如 '#00d4ff'（不含 alpha，使用时自行拼接）
}
