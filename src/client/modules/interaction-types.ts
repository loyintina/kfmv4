/**
 * KFM v4 — 交互类型共享层
 * 
 * 所有交互模块共享的类型定义，让模块之间用同一种语言描述自己的状态。
 * 仅约束变量结构，不约束实现逻辑。
 */

/** 拖拽状态 — 记录一次拖拽手势的起始信息 */
export interface DragState {
  /** 是否正在拖拽（超过阈值后激活） */
  active: boolean;
  /** 手势起始坐标 (clientX) */
  gestureStartX: number;
  /** 手势起始坐标 (clientY) */
  gestureStartY: number;
  /** 被拖拽元素的初始位置 left */
  elementStartX: number;
  /** 被拖拽元素的初始位置 top */
  elementStartY: number;
  /** 关联元素的初始位置 left（面板/卡片） */
  contextStartX?: number;
  /** 关联元素的初始位置 top */
  contextStartY?: number;
  /** 被拖拽元素初始宽度（编辑模式用） */
  contextStartW?: number;
  /** 被拖拽元素初始高度（编辑模式用） */
  contextStartH?: number;
}

/** 长按检测状态 */
export interface LongPressState {
  /** 计时器引用 */
  timer: ReturnType<typeof setTimeout> | null;
  /** 本次按键是否已触发长按 */
  fired: boolean;
}

/** 边界约束函数签名 — 将原始坐标钳制到安全区域内 */
export type ClampFn = (x: number, y: number) => { x: number; y: number };

/** 拖拽手势处理器签名 */
export interface DragHandlers {
  onStart: (x: number, y: number, pointerId?: number) => void;
  onMove: (x: number, y: number, pointerId?: number) => void;
  onEnd: () => void;
}

/** 交互能力声明 — 模块对外暴露的交互能力元数据 */
export interface InteractionCapability {
  /** 模块标识 */
  id: string;
  /** 拖拽能力 */
  drag: {
    enabled: boolean;
    /** 拖拽触发区域（返回该区域的 DOMRect） */
    area: () => DOMRect;
    /** 拖拽语义：'anchor-br' = 右下角锚点，'offset' = 左上角偏移 */
    mode: 'anchor-br' | 'offset';
    /** 编辑模式下最小尺寸 */
    minWidth?: number;
    minHeight?: number;
  } | null;
  /** 长按能力 */
  longPress: {
    enabled: boolean;
    /** 长按触发时长 (ms) */
    duration: number;
    /** 进入编辑模式时调用 */
    onEnterEdit: () => void;
    /** 退出编辑模式时调用 */
    onExitEdit: () => void;
  } | null;
  /** 边界约束 */
  boundary: {
    /** 输入栏引用（用于计算底部边界） */
    inputBarId: string;
    /** 装饰尺寸（光球/角标的额外边距） */
    decorSize: number;
  };
}