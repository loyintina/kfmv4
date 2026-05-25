/**
 * orb-template.ts — 光球交互模板
 *
 * 可复用的交互内核：三态机、拖拽、长按编辑、边界自适应、尺寸记忆。
 *
 * 使用方式：
 *   const orb = createOrbTemplate(config);
 *   gestures.register({ onStart: orb.startDrag, onMove: orb.moveDrag, onEnd: orb.endDrag });
 *
 * 调用者只需配置回调，交互内核由模板管理。
 */

// ========== 类型定义 ==========

export interface OrbPosition {
  x: number;
  y: number;
}

/** 约束矩形，用于限制光球移动范围 */
export interface ConstraintRect {
  top: number;
  left: number;
  right: number;
  bottom: number;
}

export type OrbState = 'compact' | 'expanded' | 'editing';

export interface OrbTemplateAPI {
  state: OrbState;
  panelWidth: number;
  panelHeight: number;
  startDrag: (clientX: number, clientY: number) => void;
  moveDrag: (clientX: number, clientY: number) => void;
  endDrag: () => void;
}

export interface OrbConfig {
  /** 光球（锚点）元素 */
  anchor: HTMLElement;
  /** 光球尺寸（边长，正方形） */
  anchorSize: number;
  /** 面板/卡片最小尺寸 */
  minWidth: number;
  minHeight: number;
  /** 面板/卡片默认尺寸 */
  defaultWidth: number;
  defaultHeight: number;
  /** 点击时切换 compact↔expanded */
  clickToggle: () => void;
  /** 位置更新时调用（参数：状态、光球中心坐标、当前面板宽高） */
  onUpdatePosition: (state: OrbState, cx: number, cy: number, pw: number, ph: number) => void;
  /** 进入编辑模式 */
  onEnterEdit?: () => void;
  /** 退出编辑模式 */
  onExitEdit?: () => void;
  /** 可选的约束区域（默认全屏 + 输入栏上边界） */
  constraintRect?: () => ConstraintRect;
  /** 可选的设置面板起始位置（编辑模式下调用） */
  onUpdatePanelFromDrag?: (startPanelLeft: number, startPanelTop: number, cx: number, cy: number) => void;
  /** 是否鼠标/笔也触发（默认 true） */
  allowMouse?: boolean;
}

// ========== 默认约束区域 ==========

function defaultConstraintRect(): ConstraintRect {
  const inputBar = document.getElementById('aiInputBar');
  const bottom = inputBar ? inputBar.getBoundingClientRect().top : window.innerHeight;
  return {
    top: 8,
    left: 8,
    right: window.innerWidth - 8,
    bottom: bottom - 8,
  };
}

// ========== 创建模板实例 ==========

export function createOrbTemplate(cfg: OrbConfig): OrbTemplateAPI {
  const {
    anchor,
    anchorSize,
    minWidth,
    minHeight,
    defaultWidth,
    defaultHeight,
    clickToggle,
    onUpdatePosition,
    onEnterEdit,
    onExitEdit,
    constraintRect = defaultConstraintRect,
  } = cfg;

  const ORB_HALF = anchorSize / 2;
  const LONG_PRESS_MS = 600;
  const DRAG_THRESHOLD = 5;

  // ========== 状态 ==========
  let _state: OrbState = 'compact';
  let _panelWidth = defaultWidth;
  let _panelHeight = defaultHeight;

  // ========== 拖拽状态 ==========
  let _dragging = false;
  let _dragStartX = 0;
  let _dragStartY = 0;
  let _dragStartAnchorX = 0;
  let _dragStartAnchorY = 0;
  let _dragStartPanelLeft = 0;
  let _dragStartPanelTop = 0;
  let _longPressTimer: ReturnType<typeof setTimeout> | null = null;
  let _longPressFired = false;

  // ========== 自由位置（用于输入栏变化时归位） ==========
  let _freeX = -1;
  let _freeY = -1;

  // ========== 约束逻辑 ==========

  function clamp(x: number, y: number): OrbPosition {
    const rect = constraintRect();
    return {
      x: Math.max(rect.left, Math.min(rect.right - anchorSize, x)),
      y: Math.max(rect.top, Math.min(rect.bottom - anchorSize, y)),
    };
  }

  // ========== 内部回调 ==========

  function triggerPositionUpdate(): void {
    const r = anchor.getBoundingClientRect();
    const cx = r.left + ORB_HALF;
    const cy = r.top + ORB_HALF;
    onUpdatePosition(_state, cx, cy, _panelWidth, _panelHeight);
  }

  function enterEdit(): void {
    if (_state !== 'expanded') return;
    _state = 'editing';
    // 记录当前位置
    const rect = anchor.getBoundingClientRect();
    _dragStartAnchorX = rect.left;
    _dragStartAnchorY = rect.top;
    // 由调用者提供面板起始位置
    onEnterEdit?.();
    triggerPositionUpdate();
  }

  function exitEdit(): void {
    if (_state !== 'editing') return;
    _state = 'expanded';
    onExitEdit?.();
  }

  // ========== 公开 API ==========

  const api: OrbTemplateAPI = {
    get state() { return _state; },
    get panelWidth() { return _panelWidth; },
    get panelHeight() { return _panelHeight; },
    set panelWidth(v: number) { _panelWidth = v; },
    set panelHeight(v: number) { _panelHeight = v; },

    startDrag(clientX: number, clientY: number): void {
      _dragging = false;
      _longPressFired = false;
      _dragStartX = clientX;
      _dragStartY = clientY;

      const rect = anchor.getBoundingClientRect();
      _dragStartAnchorX = rect.left;
      _dragStartAnchorY = rect.top;
      _dragStartPanelLeft = parseFloat(anchor.style.left) || rect.left;
      _dragStartPanelTop = parseFloat(anchor.style.top) || rect.top;

      _longPressTimer = setTimeout(() => {
        _longPressFired = true;
        if (_state === 'expanded') enterEdit();
      }, LONG_PRESS_MS);
    },

    moveDrag(clientX: number, clientY: number): void {
      const dx = clientX - _dragStartX;
      const dy = clientY - _dragStartY;

      if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
        _dragging = true;
        if (_longPressTimer) { clearTimeout(_longPressTimer); _longPressTimer = null; }
      }
      if (!_dragging) return;

      if (_state === 'editing') {
        // 编辑模式：光球作为缩放手柄
        const rawX = _dragStartAnchorX + dx;
        const rawY = _dragStartAnchorY + dy;
        const screenClamped = clamp(rawX, rawY);

        const minOrbX = _dragStartPanelLeft + minWidth - ORB_HALF;
        const minOrbY = _dragStartPanelTop + minHeight - ORB_HALF;
        const orbX = Math.max(minOrbX, screenClamped.x);
        const orbY = Math.max(minOrbY, screenClamped.y);

        const orbCX = orbX + ORB_HALF;
        const orbCY = orbY + ORB_HALF;
        _panelWidth = Math.max(minWidth, orbCX - _dragStartPanelLeft);
        _panelHeight = Math.max(minHeight, orbCY - _dragStartPanelTop);

        anchor.style.left = orbX + 'px';
        anchor.style.top = orbY + 'px';
        anchor.style.right = 'auto';
        anchor.style.bottom = 'auto';

        triggerPositionUpdate();
      } else {
        // 普通拖动
        const rawX = _dragStartAnchorX + dx;
        const rawY = _dragStartAnchorY + dy;
        const clamped = clamp(rawX, rawY);

        anchor.style.left = clamped.x + 'px';
        anchor.style.top = clamped.y + 'px';
        anchor.style.right = 'auto';
        anchor.style.bottom = 'auto';
        anchor.style.transition = 'none';

        if (_state === 'expanded') {
          triggerPositionUpdate();
        }
      }
    },

    endDrag(): void {
      if (_longPressTimer) { clearTimeout(_longPressTimer); _longPressTimer = null; }
      anchor.style.transition = 'box-shadow .2s';

      // 更新自由位置
      const rect = anchor.getBoundingClientRect();
      _freeX = rect.left;
      _freeY = rect.top;

      // 编辑模式松手自动退出
      if (_state === 'editing') {
        exitEdit();
      }

      // 无拖拽且无长按 → 点击切换
      if (!_dragging && !_longPressFired) {
        clickToggle();
      }

      _dragging = false;
    },
  };

  // ========== 初始化自由位置 ==========
  const initRect = anchor.getBoundingClientRect();
  _freeX = initRect.left;
  _freeY = initRect.top;

  // ========== 边界自适应（压缩）逻辑 ==========
  // 由调用者通过 triggerPositionUpdate 触发，模板只负责提供计算约束

  return api;
}

// ========== 工具：边界自适应面板位置计算 ==========

/**
 * 计算面板的"理想位置"（光球左上方），超出边界时自动压缩尺寸。
 * 返回 { left, top, width, height }。
 */
export function calcPanelTarget(
  cx: number, cy: number,
  panelW: number, panelH: number,
  minW: number, minH: number,
  margin: number = 8,
): { left: number; top: number; width: number; height: number } {
  let w = panelW;
  let h = panelH;
  const availLeft = cx - margin;
  const availTop = cy - margin;
  if (availLeft < w) w = Math.max(minW, availLeft);
  if (availTop < h) h = Math.max(minH, availTop);
  return { left: cx - w, top: cy - h, width: w, height: h };
}
