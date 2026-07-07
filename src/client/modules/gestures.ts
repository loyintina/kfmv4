/**
 * KFM v4 - 手势系统（通过 GestureRegistry 集中管理）
 *
 * 中央页面手势：
 *  - 左滑（全屏）-> 呼出堆叠卡片面板（侧栏关闭时）
 *  - 右滑 -> 打开侧栏（侧栏关闭时，非卡堆区域）
 *  - 左滑 -> 关闭侧栏（侧栏打开时）
 *  - 卡堆打开时：右滑关闭
 *
 * 卡片内容手势：
 *  - 双指缩放 -> 调整卡片内容字号
 *
 * 设计要点：
 *  - touchstart 时拍状态快照，整个手势过程只读快照，不查实时 DOM
 *  - 一次手势只触发一个动作（_actionTaken 锁），防止竞态冒泡
 */
import { openSidebar, closeSidebar } from './ui.js';
import { openCardStack, isCardStackOpen } from './card-stack.js';
import { gestures } from './gesture-registry.js';
import { cardRegistry } from './card-registry.js';
import { DOM } from "./dom-refs.js";
import { log } from './logger.js';

// ========== 字号配置 ==========

interface FontSizeConfig {
  min: number;
  max: number;
  default: number;
}

const FONT_SIZE_CONFIGS: Record<string, FontSizeConfig> = {
  file: { min: 8, max: 20, default: 13 },
  card03: { min: 7, max: 14, default: 9 },
  card04: { min: 7, max: 14, default: 9 },
  debug: { min: 8, max: 16, default: 10 },
};

function _getFontSizeConfig(typeId: string): FontSizeConfig {
  return FONT_SIZE_CONFIGS[typeId] || FONT_SIZE_CONFIGS.file;
}

function _loadFontSize(typeId: string): number {
  const config = _getFontSizeConfig(typeId);
  const stored = localStorage.getItem('kfm-fontsize-' + typeId);
  if (stored) {
    const parsed = JSON.parse(stored);
    if (typeof parsed.fontSize === 'number') {
      return Math.max(config.min, Math.min(config.max, parsed.fontSize));
    }
  }
  return config.default;
}

function _saveFontSize(typeId: string, fontSize: number): void {
  localStorage.setItem('kfm-fontsize-' + typeId, JSON.stringify({ fontSize }));
}

/** 应用字号 + 布局重排 */
function _applyFontSize(contentEl: HTMLElement, typeId: string, fontSize: number): void {
  contentEl.style.setProperty('--card-font-size', fontSize + 'px');

  if (typeId === 'card03' || typeId === 'card04') {
    const instance = cardRegistry.getInstanceByContentEl(contentEl);
    if (instance?.meta._term) {
      const term = instance.meta._term as { options: { fontSize: number }; cols: number; rows: number; resize: (cols: number, rows: number) => void };
      const newFontSize = Math.round(fontSize);

      if (term.options.fontSize !== newFontSize) {
        term.options.fontSize = newFontSize;
      }
      if (instance.meta._fit) {
        try { (instance.meta._fit as { fit: () => void }).fit(); } catch {}
      }
      try { term.resize(term.cols, term.rows); } catch {}
    }
  }
}

/** 触摸期间：CSS transform 缩放（不触发布局回流） */
function _setVisualScale(contentEl: HTMLElement, typeId: string, scale: number): void {
  if (typeId === 'card03' || typeId === 'card04') {
    const instance = cardRegistry.getInstanceByContentEl(contentEl);
    if (instance?.meta._termEl) {
      const termEl = instance.meta._termEl as HTMLElement;
      termEl.style.transform = `scale(${scale})`;
      termEl.style.transformOrigin = 'top left';
    }
  }
}

/** 触摸结束后：移除 CSS transform */
function _clearVisualScale(contentEl: HTMLElement, typeId: string): void {
  if (typeId === 'card03' || typeId === 'card04') {
    const instance = cardRegistry.getInstanceByContentEl(contentEl);
    if (instance?.meta._termEl) {
      const termEl = instance.meta._termEl as HTMLElement;
      termEl.style.transform = '';
    }
  }
}

export function initGestures(): void {
  // 手势闭包状态：一次触摸只做一次决策
  type GestureSnapshot = 'cardstack-open' | 'sidebar-open' | 'both-closed';
  type AxisLock = 'none' | 'horizontal' | 'vertical';
  let _snapshot: GestureSnapshot = 'both-closed';
  let _actionTaken = false;
  let _axisLock: AxisLock = 'none';

  // ========== 双指缩放处理器 ==========
  let _pinchTypeId: string | null = null;
  let _pinchStartFontSize: number = 13;

  gestures.register({
    id: 'pinch-zoom',
    targetFilter: '.floating-card .card-content',
    priority: 90,
    requireFailure: ['xterm-scroll'],
    recognizeTimeout: 150,
    onPinchStart: (e, _scale) => {
      const target = e.target as HTMLElement;
      const contentEl = target.closest('.card-content') as HTMLElement;
      if (!contentEl) return;

      const instance = cardRegistry.getInstanceByContentEl(contentEl);
      if (!instance) return;

      _pinchTypeId = instance.typeId;
      _pinchStartFontSize = _loadFontSize(_pinchTypeId);
    },
    onPinchMove: (_e, scale) => {
      if (!_pinchTypeId) return;

      const config = _getFontSizeConfig(_pinchTypeId);
      const newFontSize = Math.max(config.min, Math.min(config.max, _pinchStartFontSize * scale));

      // CSS transform 缩放（不触发布局回流）
      const visualScale = newFontSize / _pinchStartFontSize;
      const instances = cardRegistry.getByType(_pinchTypeId);
      for (const inst of instances) {
        _setVisualScale(inst.contentEl, _pinchTypeId, visualScale);
      }
    },
    onPinchEnd: (_e, scale) => {
      if (!_pinchTypeId) return;

      const config = _getFontSizeConfig(_pinchTypeId);
      const finalFontSize = Math.max(config.min, Math.min(config.max, _pinchStartFontSize * scale));

      _saveFontSize(_pinchTypeId, finalFontSize);

      // 先更新字号 + 重排（在 transform 遮罩下完成）
      const instances = cardRegistry.getByType(_pinchTypeId);
      for (const inst of instances) {
        _applyFontSize(inst.contentEl, _pinchTypeId, finalFontSize);
      }
      // 再移除 transform（内容已在正确位置）
      for (const inst of instances) {
        _clearVisualScale(inst.contentEl, _pinchTypeId);
      }

      _pinchTypeId = null;
    },
  });

  // ========== 页面滑动处理器 ==========
  gestures.register({
    id: 'gestures-page-swipe',
    targetFilter: (target) => {
      return !target.closest('.light-orb') && !target.closest('.stack-card');
    },
    condition: () => {
      // 卡片堆打开时，让 card-stack-global 全权接管所有触摸区域
      if (isCardStackOpen()) return false;
      return true;
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