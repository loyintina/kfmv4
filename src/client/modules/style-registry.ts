/**
 * style-registry.ts — 样式注册表
 *
 * 所有文件树样式的**唯一来源**。
 * 改这里 = 改所有盒子的效果，不用动 tree-model.ts。
 */

import { Box } from '../engine/v2/box.js';
import type { TextStyle, HighlightConfig } from '../engine/v2/types.js';

// ============================================================
// 尺寸常量
// ============================================================

export const DIMENSIONS = {
  BOX_HEIGHT: 26,
  SIDEBAR_WIDTH: 280,
  INDENT: 18,
  ROW_PAD: 8,
  TRIANGLE_SIZE: 9,
  TRIANGLE_GAP: 5,
} as Record<string, number>;

// ============================================================
// 缩进映射函数
// 接收层级深度，返回该层容器相对上一层的缩进偏移 px
// 默认：等距 18px，改这里即可全局切换为对数/斐波那契等
// ============================================================

/**
 * 根据深度返回该行的绝对布局 { x, width }
 * 不依赖容器递归传递偏移，每层独立计算
 */
export function getRowLayout(depth) {
  var x = depth * 18;
  return { x: x, width: DIMENSIONS.SIDEBAR_WIDTH - x };
}

// ============================================================
// 颜色
// ============================================================

export const COLORS = {
  DIR: '#7c3aed',
  FILE: '#e0e0e0',
  ACCENT: '#00d4ff',
  SELECTED_BG: 'rgba(124,58,237,0.15)',
  CANVAS_BG: 'rgba(10,10,15,0.85)',
} as Record<string, string>;

// ============================================================
// 文字样式常量
// ============================================================

const FONT = '11px system-ui, sans-serif';

export const TEXT_STYLES = {
  folderLabel: {
    font: FONT,
    lineHeight: DIMENSIONS.BOX_HEIGHT,
    align: 'left',
    verticalAlign: 'middle',
    overflow: 'ellipsis',
    maxLines: 1,
  } as TextStyle,

  fileLabel: {
    font: FONT,
    lineHeight: DIMENSIONS.BOX_HEIGHT,
    align: 'left',
    verticalAlign: 'middle',
    overflow: 'ellipsis',
    maxLines: 1,
  } as TextStyle,

  toggleIcon: {
    font: `${DIMENSIONS.TRIANGLE_SIZE}px system-ui, sans-serif`,
    lineHeight: DIMENSIONS.BOX_HEIGHT,
    align: 'center',
    verticalAlign: 'middle',
  } as TextStyle,
} as Record<string, TextStyle>;

// ============================================================
// 高亮常量（替代 border，因为引擎 _drawBorder 在 clip 之后被裁）
// 用 highlight 画出 3px 宽的紫色色块，clip 不影响它
// ============================================================

const HIGHLIGHT: HighlightConfig = { color: '#7c3aed', width: 2, side: 'all' };

// ============================================================
// 模板注册表
// ============================================================

const templates: Record<string, Record<string, any>> = {
  'folder-row': {
    width: DIMENSIONS.SIDEBAR_WIDTH,
    height: DIMENSIONS.BOX_HEIGHT,
    backgroundColor: 'rgba(124,58,237,0.3)',
    borderRadius: 0,
    interactive: true,
  },

  'file-row': {
    width: DIMENSIONS.SIDEBAR_WIDTH,
    height: DIMENSIONS.BOX_HEIGHT,
    backgroundColor: 'rgba(124,58,237,0.3)',
    borderRadius: 0,
    interactive: true,
  },

  'toggle-icon': {
    width: DIMENSIONS.TRIANGLE_SIZE,
    height: DIMENSIONS.BOX_HEIGHT,
    backgroundColor: 'transparent',
    borderRadius: 0,
    interactive: false,
  },

  'folder-label': {
    height: DIMENSIONS.BOX_HEIGHT,
    backgroundColor: 'transparent',
    borderRadius: 0,
    interactive: false,
  },

  'file-label': {
    height: DIMENSIONS.BOX_HEIGHT,
    backgroundColor: 'transparent',
    borderRadius: 0,
    interactive: false,
  },

  'folder-container': {
    backgroundColor: 'transparent',
    borderRadius: 4,
  },

  'sidebar-root': {
    width: DIMENSIONS.SIDEBAR_WIDTH,
    height: 0,
    backgroundColor: 'transparent',
    borderRadius: 0,
  },
};

// ============================================================
// 注册表管理
// ============================================================

type StyleListener = (name: string, oldVal: any, newVal: any) => void;
const listeners: StyleListener[] = [];

export const styleRegistry = {
  get(name: string): Record<string, any> | undefined {
    const t = templates[name];
    return t ? { ...t } : undefined;
  },

  set(name: string, updates: Record<string, any>): void {
    const old = templates[name];
    if (!old) {
      templates[name] = { ...updates };
    } else {
      Object.assign(templates[name], updates);
    }
    listeners.forEach(fn => fn(name, old, templates[name]));
  },

  patch(patches: Record<string, Record<string, any>>): void {
    for (const [name, updates] of Object.entries(patches)) {
      const old = templates[name];
      if (!old) {
        templates[name] = { ...updates };
      } else {
        Object.assign(templates[name], updates);
      }
      listeners.forEach(fn => fn(name, old, templates[name]));
    }
  },

  subscribe(fn: StyleListener): void {
    listeners.push(fn);
  },

  unsubscribe(fn: StyleListener): void {
    const idx = listeners.indexOf(fn);
    if (idx !== -1) listeners.splice(idx, 1);
  },

  notify(): void {
    listeners.forEach(fn => fn('', undefined, undefined));
  },
};

// ============================================================
// 文件扩展名 → 颜色映射
// ============================================================

const extColors: Record<string, string> = {
  ts: '#3178c6', js: '#f7df1e', json: '#292929',
  html: '#e34f26', css: '#1572b6', md: '#083fa1',
  py: '#3776ab', rs: '#dea584', go: '#00d800',
  rsync: '#7c3aed', zip: '#f39c12', gz: '#f39c12',
  tar: '#f39c12', bak: '#888', old: '#888',
};

export function getFileColor(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase();
  return (ext && extColors[ext]) || COLORS.FILE;
}

// ============================================================
// 从模板创建 Box 的快捷工具
// ============================================================

export function createBox(templateName: string, overrides: Record<string, any>): Box {
  if (!templates[templateName]) {
    console.warn(`[style-registry] unknown template: "${templateName}"`);
  }
  const base = styleRegistry.get(templateName) || {};
  return new Box({ ...base, ...overrides } as any);
}

if (typeof window !== 'undefined') {
  (window as any).styleRegistry = styleRegistry;
  (window as any).DIMENSIONS = DIMENSIONS;
  (window as any).COLORS = COLORS;
  (window as any).TEXT_STYLES = TEXT_STYLES;
}