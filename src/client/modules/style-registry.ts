/**
 * style-registry.ts — 样式注册表
 *
 * 所有文件树样式的**唯一来源**。
 * 改这里 = 改所有盒子的效果，不用动 tree-model.ts。
 */

import { Box } from '../engine/v2/box.js';
import type { BoxOptions } from '../engine/v2/box.js';
import type { TextStyle } from '../engine/v2/types.js';
import { currentTheme as theme } from './theme.js';
import { log } from './logger.js';

// ============================================================
// 尺寸常量
// ============================================================

export const DIMENSIONS = {
  BOX_HEIGHT: 26,
  SIDEBAR_WIDTH: 295,
  DISPLAY_WIDTH: 280,
  RIGHT_MARGIN: 287,
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
export function getRowLayout(depth: number): { x: number; width: number } {
  var x = depth * 18;
  return { x: x, width: DIMENSIONS.SIDEBAR_WIDTH - x };
}

// ============================================================
// 文字样式常量
// ============================================================

export const FONT = '11px system-ui, sans-serif';

// 多行换行参数：行高 16px，最多 2 行
export const LINE_HEIGHT = 20;
export const MAX_LINES = 2;

export const TEXT_STYLES = {
  folderLabel: {
    font: FONT,
    lineHeight: LINE_HEIGHT,
    align: 'left',
    verticalAlign: 'middle',
    overflow: 'ellipsis',
    maxLines: MAX_LINES,
  } as TextStyle,

  fileLabel: {
    font: FONT,
    lineHeight: LINE_HEIGHT,
    align: 'left',
    verticalAlign: 'middle',
    overflow: 'ellipsis',
    maxLines: MAX_LINES,
  } as TextStyle,

  toggleIcon: {
    font: `${DIMENSIONS.TRIANGLE_SIZE}px system-ui, sans-serif`,
    lineHeight: LINE_HEIGHT,
    align: 'center',
    verticalAlign: 'middle',
  } as TextStyle,
} as Record<string, TextStyle>;

// ============================================================
// 高亮常量（替代 border，因为引擎 _drawBorder 在 clip 之后被裁）
// 用 highlight 画出 3px 宽的紫色色块，clip 不影响它
// ============================================================

// ============================================================
// 模板注册表
// ============================================================

const templates: Record<string, Record<string, any>> = {
  'folder-row': {
    width: DIMENSIONS.SIDEBAR_WIDTH,
    height: DIMENSIONS.BOX_HEIGHT,
    backgroundColor: theme.tree.folderBg,
    borderRadius: 0,
    interactive: true,
    overflow: 'hidden',
  },

  'file-row': {
    width: DIMENSIONS.SIDEBAR_WIDTH,
    height: DIMENSIONS.BOX_HEIGHT,
    backgroundColor: theme.tree.folderBg,
    borderRadius: 0,
    interactive: true,
    overflow: 'hidden',
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


export const styleRegistry = {
  get(name: string): Partial<BoxOptions> | undefined {
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
  },

  patch(patches: Record<string, Record<string, any>>): void {
    for (const [name, updates] of Object.entries(patches)) {
      const old = templates[name];
      if (!old) {
        templates[name] = { ...updates };
      } else {
        Object.assign(templates[name], updates);
      }
    }
  },
};

// ============================================================
// 文件扩展名 → 颜色映射

// ============================================================
// 文件扩展名 → 颜色映射
// ============================================================

export function getFileColor(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase();
  return (ext && theme.extColors[ext]) || theme.tree.file;
}

// ============================================================
// 深度缩进映射
// ============================================================

/** 每层缩进偏移量表（随深度递减，避免深层文件缩进过度） */
const SHIFT_TABLE = [18, 16, 14, 12, 10, 9, 8, 7, 6, 5, 4, 3, 3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2];
export function getShift(depth: number): number { return SHIFT_TABLE[depth] ?? 2; }

// ============================================================
// 从模板创建 Box 的快捷工具
// ============================================================

export function createBox(templateName: string, overrides: Partial<BoxOptions>): Box {
  if (!templates[templateName]) {
    log(`[warn] [style-registry] unknown template: "${templateName}"`);
  }
  const base: Partial<BoxOptions> = styleRegistry.get(templateName) || {};
  return new Box({ ...base, ...overrides });
}