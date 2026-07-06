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

function _applyFontSizeToContent(contentEl: HTMLElement, typeId: string, fontSize: number, _isPinching: boolean): void {
  // 所有卡片类型都设置 CSS 变量（统一行为）
  contentEl.style.setProperty('--card-font-size', fontSize + 'px');

  if (typeId === 'card03' || typeId === 'card04') {
    // 终端卡：直接更新字号（不使用 CSS transform，避免视觉变形）
    const instance = cardRegistry.getInstanceByContentEl(contentEl);
    if (instance?.meta._term) {
      const term = instance.meta._term as { options: { fontSize: number } };
      const newFontSize = Math.round(fontSize);

      // 只在字号真正变化时才更新
      if (term.options.fontSize !== newFontSize) {
        term.options.fontSize = newFontSize;

        // 使用 requestAnimationFrame 批处理 fit.fit()
        if (instance.meta._fit) {
          requestAnimationFrame(() => {
            try { (instance.meta._fit as { fit: () => void }).fit(); } catch {}
          });
        }
      }
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
    requireFailure: ['xterm-scroll'],  // 等待 xterm-scroll 失败后才能识别
    recognizeTimeout: 150,  // 150ms 超时
    onPinchStart: (e, _scale) => {
      const target = e.target as HTMLElement;
      const contentEl = target.closest('.card-content') as HTMLElement;
      if (!contentEl) return;

      const instance = cardRegistry.getInstanceByContentEl(contentEl);
      if (!instance) return;

      _pinchTypeId = instance.typeId;
      _pinchStartFontSize = _loadFontSize(_pinchTypeId);
      log('[pinch-zoom] start, typeId:', _pinchTypeId, 'fontSize:', _pinchStartFontSize);
    },
    onPinchMove: (_e, scale) => {
      if (!_pinchTypeId) return;

      const config = _getFontSizeConfig(_pinchTypeId);
      const newFontSize = Math.max(config.min, Math.min(config.max, _pinchStartFontSize * scale));

      // 找到所有同类型卡片的内容元素，应用字号
      const instances = cardRegistry.getByType(_pinchTypeId);
      for (const inst of instances) {
        _applyFontSizeToContent(inst.contentEl, _pinchTypeId, newFontSize, true);
      }

      log('[pinch-zoom] move, scale:', scale.toFixed(2), 'fontSize:', newFontSize.toFixed(1));
    },
    onPinchEnd: (_e, scale) => {
      if (!_pinchTypeId) return;

      const config = _getFontSizeConfig(_pinchTypeId);
      const finalFontSize = Math.max(config.min, Math.min(config.max, _pinchStartFontSize * scale));

      // 保存字号偏好
      _saveFontSize(_pinchTypeId, finalFontSize);

      // 应用最终字号（非 pinch 模式）
      const instances = cardRegistry.getByType(_pinchTypeId);
      for (const inst of instances) {
        _applyFontSizeToContent(inst.contentEl, _pinchTypeId, finalFontSize, false);
      }

      log('[pinch-zoom] end, typeId:', _pinchTypeId, 'fontSize:', finalFontSize.toFixed(1));
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
      
      // 调试日志
      log('[page-swipe] onStart, snapshot:', _snapshot);
    },
    onMove: (_e, dx, dy) => {
      if (_actionTaken) return;

      // 轴向锁定：首次移动判定主导方向，锁定后只处理水平手势
      if (_axisLock === 'none' && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
        _axisLock = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical';
      }
      
      // 调试日志
      log('[page-swipe] onMove, dx:', dx, 'dy:', dy, 'axis:', _axisLock);
      
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