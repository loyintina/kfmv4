/**
 * KFM v3 — Box 数据结构
 * 
 * 决策：D-001/A-002
 * 创建：2026-04-12
 * 维护：卡萝
 * 
 * 万物皆盒。这是整个引擎的唯一节点类型。
 *
 * 设计原则：
 * - 数据和渲染分离：Box 只描述「是什么」，不描述「怎么画」
 * - 不可变的 id，可变的一切
 * - 树形结构：children + parent
 * - 每个属性都有合理的默认值
 */

import type {
  Spacing, BoxType, BoxState, TextStyle, IconConfig,
  Transform, Overflow, Animation, AnimProp, EasingName,
  BoxVisualStyle, VisualBorderConfig, HighlightConfig, ShadowConfig,
  GradientConfig, StateStyles, Rect, BoxEventType, BoxEventHandler,
  FlexStyle, FlexItemStyle, ScrollDirection,
  GestureConfig, BackgroundPatternConfig,  // Phase 2 Demo：网格背景
  ShapeConfig,  // Phase 2 Demo：矢量形状
  InputConfig,  // Phase 2 Demo：可输入配置
} from './types.js';
import { ALL_SIDES, LEFT_ONLY } from './types.js';
import { ZERO_SPACING } from './utils.js';
import { ease } from './animation.js';
import type { BoxStyle as KFMBoxStyle } from './StyleConfig.js';

// ============================================================
// 构造参数
// ============================================================

export interface BoxOptions {
  // 身份
  id?: string;
  type?: BoxType;

  // 几何
  x?: number;
  y?: number;
  width?: number;
  height?: number;

  // 盒模型
  padding?: Partial<Spacing>;
  margin?: Partial<Spacing>;

  // 视觉
  backgroundColor?: string;
  gradient?: GradientConfig | null;
  backgroundPattern?: BackgroundPatternConfig | null;  // Phase 2 Demo：网格背景
  borderRadius?: number;
  opacity?: number;
  visible?: boolean;

  // 边框
  border?: VisualBorderConfig | null;
  highlight?: HighlightConfig | null;

  // 阴影
  shadow?: ShadowConfig | null;

  // 文本
  text?: string;
  textColor?: string;
  font?: string;
  lineHeight?: number;
  textAlign?: TextStyle['align'];
  textVerticalAlign?: TextStyle['verticalAlign'];
  textOverflow?: TextStyle['overflow'];
  maxLines?: number;

  // 图标
  icon?: string | null;
  iconSize?: number;
  iconPosition?: IconConfig['position'];

  // 交互
  interactive?: boolean;
  disabled?: boolean;
  selected?: boolean;

  // 状态样式
  stateStyles?: StateStyles;

  // 层级
  zIndex?: number;
  overflow?: Overflow;

  // 变换
  transform?: Partial<Transform>;

  // 树形
  children?: Box[];
  data?: Record<string, unknown>;

  // Flex 布局
  layout?: FlexStyle;
  layoutItem?: FlexItemStyle;

  // 滚动容器
  scrollable?: boolean;
  scrollX?: number;
  scrollY?: number;
  scrollDirection?: ScrollDirection;
  scrollbarVisible?: boolean;

  // KFM 边框样式（高级）
  kfmStyle?: KFMBoxStyle | null;

  // 手势配置（D-013 决策）
  gesture?: GestureConfig | null;

  // 矢量形状（Phase 2 Demo）
  shape?: ShapeConfig | null;

  // 可输入配置（Phase 2 Demo）
  inputable?: InputConfig | boolean;
}

// ============================================================
// Box 类
// ============================================================

export class Box {
  // --- 身份 ---
  readonly id: string;
  type: BoxType;

  // --- 几何 ---
  x: number;
  y: number;
  width: number;
  height: number;

  // --- 盒模型 ---
  padding: Spacing;
  margin: Spacing;

  // --- 视觉 ---
  backgroundColor: string;
  gradient: GradientConfig | null;
  backgroundPattern: BackgroundPatternConfig | null;  // Phase 2 Demo：网格背景
  borderRadius: number;
  opacity: number;
  visible: boolean;

  // --- 边框 ---
  border: VisualBorderConfig | null;
  highlight: HighlightConfig | null;

  // --- 阴影 ---
  shadow: ShadowConfig | null;

  // --- 文本 ---
  textStyle: TextStyle;

  // --- 图标 ---
  icon: IconConfig | null;

  // --- 交互 ---
  interactive: boolean;
  disabled: boolean;
  selected: boolean;
  state: BoxState;
  stateStyles: StateStyles;

  // --- 层级 ---
  zIndex: number;
  overflow: Overflow;

  // --- 变换 ---
  transform: Transform;

  // --- 动画 ---
  animations: Animation[];

  // --- 树形 ---
  children: Box[];
  parent: Box | null;
  data: Record<string, unknown>;

  // --- Flex 布局 ---
  layout: FlexStyle | null;
  layoutItem: FlexItemStyle | null;

  // --- 滚动容器 ---
  scrollable: boolean;
  scrollX: number;
  scrollY: number;
  scrollDirection: ScrollDirection;
  scrollbarVisible: boolean;

  // --- KFM 边���样式（高级）---
  kfmStyle: KFMBoxStyle | null;

  // --- 手势配置（D-013 决策）---
  gesture: GestureConfig | null;

  // 矢量形状（Phase 2 Demo）
  shape: ShapeConfig | null;

  // 可输入配置
  inputable: InputConfig | null;

  // --- 事件 ---
  private eventHandlers: Map<BoxEventType, BoxEventHandler>;

  // --- 缓存 ---
  private _contentWidth: number | null;
  private _contentHeight: number | null;

  constructor(options: BoxOptions = {}) {
    // 身份
    this.id = options.id || `box_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.type = options.type ?? 'container';

    // 几何
    this.x = options.x ?? 0;
    this.y = options.y ?? 0;
    this.width = options.width ?? 100;
    this.height = options.height ?? 40;

    // �����模型
    this.padding = { ...ZERO_SPACING, ...options.padding };
    this.margin = { ...ZERO_SPACING, ...options.margin };

    // 视觉
    this.backgroundColor = options.backgroundColor ?? '#12121a';
    this.gradient = options.gradient ?? null;
    this.backgroundPattern = options.backgroundPattern ?? null;  // Phase 2 Demo
    this.borderRadius = options.borderRadius ?? 8;
    this.opacity = options.opacity ?? 1;
    this.visible = options.visible ?? true;

    // 边框
    this.border = options.border ?? null;
    this.highlight = options.highlight ?? null;

    // 阴影
    this.shadow = options.shadow ?? null;

    // 文本
    this.textStyle = {
      content: options.text ?? '',
      color: options.textColor ?? '#e0e0e0',
      font: options.font ?? '14px system-ui, sans-serif',
      lineHeight: options.lineHeight ?? 20,
      align: options.textAlign ?? 'left',
      verticalAlign: options.textVerticalAlign ?? 'middle',
      overflow: options.textOverflow ?? 'ellipsis',
      maxLines: options.maxLines ?? 1,
    };

    // 图标
    this.icon = options.icon
      ? { char: options.icon, size: options.iconSize ?? 16, position: options.iconPosition ?? 'left' }
      : null;

    // 交互
    this.interactive = options.interactive ?? (this.type === 'button' || this.type === 'list-item');
    this.disabled = options.disabled ?? false;
    this.selected = options.selected ?? false;
    this.state = 'normal';
    this.stateStyles = options.stateStyles ?? {};

    // 层级
    this.zIndex = options.zIndex ?? 0;
    this.overflow = options.overflow ?? 'visible';

    // 变换
    this.transform = {
      scale: options.transform?.scale ?? 1,
      rotate: options.transform?.rotate ?? 0,
      translateX: options.transform?.translateX ?? 0,
      translateY: options.transform?.translateY ?? 0,
    };

    // 动画
    this.animations = [];

    // 树形
    this.children = options.children ?? [];
    this.parent = null;
    this.data = options.data ?? {};
    this.children.forEach(child => { child.parent = this; });

    // Flex 布局
    this.layout = options.layout ?? null;
    this.layoutItem = options.layoutItem ?? null;

    // 滚动容器
    this.scrollable = options.scrollable ?? false;
    this.scrollX = options.scrollX ?? 0;
    this.scrollY = options.scrollY ?? 0;
    this.scrollDirection = options.scrollDirection ?? 'vertical';
    this.scrollbarVisible = options.scrollbarVisible ?? true;

    // KFM 边框样式
    this.kfmStyle = options.kfmStyle ?? null;

    // 手势配置（D-013 决策）
    this.gesture = options.gesture ?? null;

    // 矢量形状
    this.shape = options.shape ?? null;

    // 可输入配置
    if (options.inputable) {
      this.inputable = typeof options.inputable === 'boolean'
        ? { enabled: options.inputable }
        : options.inputable;
    } else {
      this.inputable = null;
    }

    // 事件
    this.eventHandlers = new Map();

    // 缓存
    this._contentWidth = null;
    this._contentHeight = null;
  }

  // ============================================================
  // 几何计算
  // ============================================================

  /** 内容区域（去掉 padding 后的矩形） */
  get contentRect(): Rect {
    return {
      x: this.padding.left,
      y: this.padding.top,
      width: this.width - this.padding.left - this.padding.right,
      height: this.height - this.padding.top - this.padding.bottom,
    };
  }

  /** 绝对位置（含所有父级偏移） */
  getAbsolutePosition(): { x: number; y: number } {
    let x = this.x;
    let y = this.y;
    let p = this.parent;
    while (p) {
      x += p.x + p.padding.left;
      y += p.y + p.padding.top;
      p = p.parent;
    }
    return { x, y };
  }

  /** 考虑 transform 后的包围盒 */
  getBounds(): Rect {
    const pos = this.getAbsolutePosition();
    const s = this.transform.scale;
    return {
      x: pos.x + this.transform.translateX,
      y: pos.y + this.transform.translateY,
      width: this.width * s,
      height: this.height * s,
    };
  }

  /** 点是否在 Box 内 */
  containsPoint(px: number, py: number): boolean {
    const b = this.getBounds();
    return px >= b.x && px <= b.x + b.width &&
           py >= b.y && py <= b.y + b.height;
  }

  // ============================================================
  // 滚动相关
  // ============================================================

  /** 计算内容实际尺寸（Flex 布局后的子元素边界） */
  getContentSize(): { width: number; height: number } {
    if (this.children.length === 0) {
      return { width: 0, height: 0 };
    }

    let maxRight = 0;
    let maxBottom = 0;

    for (const child of this.children) {
      // 子元素位置已由 Flex 布局计算
      const childRight = child.x + child.width;
      const childBottom = child.y + child.height;
      maxRight = Math.max(maxRight, childRight);
      maxBottom = Math.max(maxBottom, childBottom);
    }

    return { width: maxRight, height: maxBottom };
  }

  /** 获取最大滚动偏移 */
  getMaxScroll(): { maxX: number; maxY: number } {
    const content = this.getContentSize();
    const viewportW = this.width - this.padding.left - this.padding.right;
    const viewportH = this.height - this.padding.top - this.padding.bottom;
    return {
      maxX: Math.max(0, content.width - viewportW),
      maxY: Math.max(0, content.height - viewportH),
    };
  }

  /** 将滚动偏移限制在合法范围内 */
  clampScroll(): void {
    const max = this.getMaxScroll();
    if (this.scrollDirection === 'vertical' || this.scrollDirection === 'both') {
      this.scrollY = Math.max(0, Math.min(this.scrollY, max.maxY));
    }
    if (this.scrollDirection === 'horizontal' || this.scrollDirection === 'both') {
      this.scrollX = Math.max(0, Math.min(this.scrollX, max.maxX));
    }
  }

  // ============================================================
  // 树操作
  // ============================================================

  addChild(child: Box): this {
    child.parent = this;
    this.children.push(child);
    return this;
  }

  removeChild(child: Box): this {
    const i = this.children.indexOf(child);
    if (i > -1) {
      this.children.splice(i, 1);
      child.parent = null;
    }
    return this;
  }

  /** 深度优先查找 */
  find(predicate: (box: Box) => boolean): Box | null {
    if (predicate(this)) return this;
    for (const child of this.children) {
      const found = child.find(predicate);
      if (found) return found;
    }
    return null;
  }

  /** 扁平化所有后代 */
  flatten(result: Box[] = []): Box[] {
    result.push(this);
    for (const child of this.children) {
      child.flatten(result);
    }
    return result;
  }

  // ============================================================
  // 交互
  // ============================================================

  on(event: BoxEventType, handler: BoxEventHandler): this {
    this.eventHandlers.set(event, handler);
    return this;
  }

  off(event: BoxEventType): this {
    this.eventHandlers.delete(event);
    return this;
  }

  emit(event: BoxEventType, x: number, y: number, originalEvent?: Event): void {
    const handler = this.eventHandlers.get(event);
    if (handler) {
      handler({ box: this, x, y, originalEvent });
    }
  }

  setState(state: BoxState): void {
    if (this.state === state) return;
    this.state = state;
  }

  /** 获取当前状态对应的样式覆盖 */
  getStateStyle(): Partial<BoxVisualStyle> {
    return this.stateStyles[this.state] ?? this.stateStyles.normal ?? {};
  }

  // ============================================================
  // 动画
  // ============================================================

  animate(prop: AnimProp, to: number, duration: number, easing: EasingName = 'easeOutCubic', onComplete?: () => void): this {
    const from = this.getAnimProp(prop);
    this.animations.push({
      prop, from, to, duration,
      startTime: performance.now(),
      easing,
      onComplete,
    });
    return this;
  }

  private getAnimProp(prop: AnimProp): number {
    switch (prop) {
      case 'opacity': return this.opacity;
      case 'scale': return this.transform.scale;
      case 'rotate': return this.transform.rotate;
      case 'translateX': return this.transform.translateX;
      case 'translateY': return this.transform.translateY;
      case 'x': return this.x;
      case 'y': return this.y;
      case 'width': return this.width;
      case 'height': return this.height;
    }
  }

  private setAnimProp(prop: AnimProp, value: number): void {
    switch (prop) {
      case 'opacity': this.opacity = value; break;
      case 'scale': this.transform.scale = value; break;
      case 'rotate': this.transform.rotate = value; break;
      case 'translateX': this.transform.translateX = value; break;
      case 'translateY': this.transform.translateY = value; break;
      case 'x': this.x = value; break;
      case 'y': this.y = value; break;
      case 'width': this.width = value; break;
      case 'height': this.height = value; break;
    }
  }

  /** 更新所有活跃动画，返回是否有动画在播放 */
  tickAnimations(now: number): boolean {
    let active = false;
    this.animations = this.animations.filter(anim => {
      const elapsed = now - anim.startTime;
      const progress = Math.min(elapsed / anim.duration, 1);
      const eased = ease(anim.easing, progress);
      const value = anim.from + (anim.to - anim.from) * eased;
      this.setAnimProp(anim.prop, value);

      if (progress >= 1) {
        anim.onComplete?.();
        return false;
      }
      active = true;
      return true;
    });

    for (const child of this.children) {
      if (child.tickAnimations(now)) active = true;
    }
    return active;
  }

  // ============================================================
  // 工具
  // ============================================================

  clone(): Box {
    return new Box({
      ...this.serialize(),
      id: undefined,
      children: this.children.map(c => c.clone()),
    });
  }

  serialize(): BoxOptions {
    return {
      id: this.id,
      type: this.type,
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height,
      padding: { ...this.padding },
      margin: { ...this.margin },
      backgroundColor: this.backgroundColor,
      gradient: this.gradient ? { ...this.gradient } : null,
      borderRadius: this.borderRadius,
      opacity: this.opacity,
      visible: this.visible,
      border: this.border ? { ...this.border } : null,
      highlight: this.highlight ? { ...this.highlight } : null,
      shadow: this.shadow ? { ...this.shadow } : null,
      text: this.textStyle.content,
      textColor: this.textStyle.color,
      font: this.textStyle.font,
      lineHeight: this.textStyle.lineHeight,
      textAlign: this.textStyle.align,
      textVerticalAlign: this.textStyle.verticalAlign,
      textOverflow: this.textStyle.overflow,
      maxLines: this.textStyle.maxLines,
      icon: this.icon?.char ?? null,
      iconSize: this.icon?.size,
      iconPosition: this.icon?.position,
      interactive: this.interactive,
      disabled: this.disabled,
      selected: this.selected,
      stateStyles: { ...this.stateStyles },
      zIndex: this.zIndex,
      overflow: this.overflow,
      transform: { ...this.transform },
      layout: this.layout ?? undefined,
      layoutItem: this.layoutItem ?? undefined,
      scrollable: this.scrollable,
      scrollX: this.scrollX,
      scrollY: this.scrollY,
      scrollDirection: this.scrollDirection,
      scrollbarVisible: this.scrollbarVisible,
      kfmStyle: this.kfmStyle ? { ...this.kfmStyle } : null,
      gesture: this.gesture ? { ...this.gesture } : null,
      shape: this.shape ? { ...this.shape, points: [...this.shape.points] } : null,
      inputable: this.inputable ? { ...this.inputable } : undefined,
      data: { ...this.data },
    };
  }
}

// ease() 函��已移至 animation.ts