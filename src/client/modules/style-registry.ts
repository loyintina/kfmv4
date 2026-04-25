/**
 * style-registry.ts — 样式注册表
 *
 * 所有文件树样式的**唯一来源**。
 * 改这里 = 改所有盒子的效果，不用动 tree-model.ts。
 *
 * 用法：styleRegistry.get('folder-title') → 拿到模板对象
 *       styleRegistry.set('folder-title', { highlight: { width: 5 } })
 *       styleRegistry.notify() → 触发全树重建
 *
 * 设计原则：
 * - 全是纯数据，没有逻辑
 * - 模板 = BoxOptions 的完整子集（不含 id/x/y 等个性字段）
 * - 改数据 → notify() → 所有盒子按新数据重建
 */

import { Box } from '../engine/v2/box.js';
import type { HighlightConfig, TextStyle } from '../engine/v2/types.js';

// ============================================================
// 尺寸常量
// ============================================================

export const DIMENSIONS = {
  BOX_HEIGHT: 32,           // 每行高度
  SIDEBAR_WIDTH: 280,       // 侧栏宽度
  INDENT: 18,               // 每层缩进
  ROW_PAD: 8,               // 行内边距
  TRIANGLE_SIZE: 10,        // ▶/▼ 字号
  TRIANGLE_GAP: 6,           // 三角和文字间距
} as Record<string, number>;

// ============================================================
// 颜色
// ============================================================

export const COLORS = {
  DIR: '#7c3aed',            // 文件夹文字色 (var(--primary))
  FILE: '#e0e0e0',          // 文件文字色 (var(--text))
  ACCENT: '#00d4ff',        // 三角/引导线色 (var(--accent))
  SELECTED_BG: 'rgba(124,58,237,0.15)',  // 选中底色
  CANVAS_BG: 'rgba(10,10,15,0.85)',      // Canvas 背景
} as Record<string, string>;

// ============================================================
// 文字样式常量
// ============================================================

const FONT_FAMILY = '13px system-ui, sans-serif';

export const TEXT_STYLES = {
  folderLabel: {
    font: FONT_FAMILY,
    lineHeight: DIMENSIONS.BOX_HEIGHT,
    align: 'left',
    verticalAlign: 'middle',
    overflow: 'ellipsis',
    maxLines: 1,
  } as TextStyle,

  fileLabel: {
    font: FONT_FAMILY,
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
// 模板注册表
// ============================================================

export interface BoxTemplate {
  // 基础属性（从 BoxOptions 中提取公共部分）
  width: number;
  height: number;
  backgroundColor: string;
  borderRadius: number;
  interactive: boolean;
  overflow: string;
  // 可选覆盖
  highlight?: HighlightConfig | null;
  // 其他按需扩展
  [key: string]: any;
}

const templates: Record<string, Record<string, any>> = {
  // 文件夹标题行：可点击、带左边框
  'folder-row': {
    width: DIMENSIONS.SIDEBAR_WIDTH,
    height: DIMENSIONS.BOX_HEIGHT,
    backgroundColor: 'transparent',
    borderRadius: 0,
    interactive: true,
    overflow: 'hidden',
  },

  // 文件行：可点击、无边框
  'file-row': {
    width: DIMENSIONS.SIDEBAR_WIDTH,
    height: DIMENSIONS.BOX_HEIGHT,
    backgroundColor: 'transparent',
    borderRadius: 0,
    interactive: true,
    overflow: 'hidden',
  },

  // 三角图标容器：纯文字
  'toggle-icon': {
    width: DIMENSIONS.TRIANGLE_SIZE,
    height: DIMENSIONS.BOX_HEIGHT,
    backgroundColor: 'transparent',
    borderRadius: 0,
    interactive: false,
  },

  // 文件夹文字标签
  'folder-label': {
    height: DIMENSIONS.BOX_HEIGHT,
    backgroundColor: 'transparent',
    borderRadius: 0,
    interactive: false,
  },

  // 文件文字标签
  'file-label': {
    height: DIMENSIONS.BOX_HEIGHT,
    backgroundColor: 'transparent',
    borderRadius: 0,
    interactive: false,
  },

  // 根容器
  'sidebar-root': {
    width: DIMENSIONS.SIDEBAR_WIDTH,
    height: 0,
    backgroundColor: 'transparent',
    borderRadius: 0,
    overflow: 'hidden',
  },
};

// ============================================================
// 注册表管理
// ============================================================

type StyleListener = (name: string, oldVal: any, newVal: any) => void;
const listeners: StyleListener[] = [];

export const styleRegistry = {
  /** 拿一个模板的副本（避免外部修改污染模板） */
  get(name: string): Record<string, any> | undefined {
    const t = templates[name];
    return t ? { ...t } : undefined;
  },

  /** 改模板，自动通知 */
  set(name: string, updates: Record<string, any>): void {
    const old = templates[name];
    if (!old) {
      templates[name] = { ...updates };
    } else {
      Object.assign(templates[name], updates);
    }
    listeners.forEach(fn => fn(name, old, templates[name]));
  },

  /** 批量修改多个模板 */
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

  /** 重置所有模板为初始值（调试用） */
  reset(): void {
    // 重置通过 set 修改过的值并不容易，
    // 这个能力后续可以加
  },

  subscribe(fn: StyleListener): void {
    listeners.push(fn);
  },

  unsubscribe(fn: StyleListener): void {
    const idx = listeners.indexOf(fn);
    if (idx !== -1) listeners.splice(idx, 1);
  },
};

// ============================================================
// 文件扩展名 → 颜色映射（逻辑部分放这里）
// ============================================================

const extColors: Record<string, string> = {
  ts: '#3178c6', js: '#f7df1e', json: '#292929',
  html: '#e34f26', css: '#1572b6', md: '#083fa1',
  py: '#3776ab', rs: '#dea584', go: '#00add8',
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

/**
 * 根据注册表模板 + 个性化字段，创建一个新的 Box。
 * 用法：
 *   createBox('folder-row', {
 *     id: `title-${path}`,
 *     y: currentY,
 *     data: { path, isDir: true },
 *     gesture: { ... },
 *   })
 */
export function createBox(templateName: string, overrides: Record<string, any>): Box {
  if (!templates[templateName]) {
    console.warn(`[style-registry] unknown template: "${templateName}"`);
  }
  const base = styleRegistry.get(templateName) || {};
  return new Box({ ...base, ...overrides } as any);
}

// 挂到 window 供浏览器控制台调试/热更新
if (typeof window !== 'undefined') {
  (window as any).styleRegistry = styleRegistry;
  (window as any).DIMENSIONS = DIMENSIONS;
  (window as any).COLORS = COLORS;
}