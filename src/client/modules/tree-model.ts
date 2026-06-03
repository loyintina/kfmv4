/**
 * tree-model.ts — 绝对深度布局
 */

import { Box } from '../engine/v2/box.js';
import { KFMState, type FileNode } from './state.js';
import { DIMENSIONS, TEXT_STYLES, getFileColor, createBox, LINE_HEIGHT, MAX_LINES, FONT, getShift } from './style-registry.js';
import { currentTheme as theme } from './theme.js';
import { DIMENSIONS as D } from './style-registry.js';
import { resolveStyle } from '../engine/v2/StyleConfig.js';
import { prepareWithSegments, layoutWithLines } from '@chenglou/pretext';

export interface TreeOptions {
  expandedPaths?: Record<string, boolean>;
  selectedFile?: string | null;
  onDirToggle?: (path: string, expand: boolean) => void;
  onFileClick?: (path: string) => void;
  baseDepth?: number;
  containerWidth?: number;
  scrollable?: boolean;
  rightMargin?: number;
}

interface BuildCtx {
  expandedPaths: Record<string, boolean>;
  selectedFile: string | null;
  onDirToggle: (path: string, expand: boolean) => void;
  onFileClick: (path: string) => void;
  containerWidth: number;
  rightMargin: number;
}

const T_OFF = 12;
const TXT_L = 26;

function absX(d: number): number { let x = 0; for (let i = 0; i < d; i++) x += getShift(i); return x; }

function hexToRgb(hex: string): string {
  const v = parseInt(hex.slice(1), 16);
  return `${(v >> 16) & 255},${(v >> 8) & 255},${v & 255}`;
}

function depthGradient(depth: number) {
  const shift = getShift(depth);
  const density = 1 - shift / 18;
  const topA = (0.02 + density * 0.18).toFixed(3);
  const botA = (0.08 + density * 0.35).toFixed(3);
  const rgb = hexToRgb(theme.tree.dir);
  return {
    type: 'linear' as const, angle: 180,
    stops: [
      { offset: 0, color: `rgba(${rgb},${topA})` },
      { offset: 1, color: `rgba(${rgb},${botA})` },
    ],
  };
}

function calcTextLayout(name: string, maxWidth: number): { lines: number, height: number } {
  const prepared = prepareWithSegments(name, FONT);
  const { lines } = layoutWithLines(prepared, maxWidth, LINE_HEIGHT);
  const actualLines = Math.min(lines.length, MAX_LINES);
  return { lines: actualLines, height: actualLines * LINE_HEIGHT + 6 };
}

/** 创建 toggle-icon 并设置初始旋转状态 */
function createToggle(item: FileNode, rowHeight: number, ex: boolean): Box {
  const tog = createBox('toggle-icon', { id: `toggle-${item.path}`, x: T_OFF, y: 0, height: rowHeight });
  tog.textStyle = { ...TEXT_STYLES.toggleIcon, content: '\u25b6', color: theme.canvas.accent };
  if (ex) tog.transform.rotate = Math.PI / 2;  // 已展开时初始旋转 90°
  return tog;
}

function innerFolderRow(item: FileNode, y: number, cw: number, ctx: BuildCtx, depth: number): Box {
  const ex = !!ctx.expandedPaths[item.path];
  const sel = ctx.selectedFile === item.path;
  const maxWidth = cw - TXT_L - 16;
  const { lines: actualLines, height: rowHeight } = calcTextLayout(item.name, maxWidth);
  
  const row = createBox('folder-row', {
    id: `title-${item.path}`, x: 0, y, width: cw, height: rowHeight,
    backgroundColor: sel ? theme.tree.selectedBg : 'transparent',
    data: { path: item.path, isDir: true, isExpanded: ex, depth, lineCount: actualLines },
    gesture: { passive: true, onTap: () => ctx.onDirToggle(item.path, !ex) },
  });
  row.addChild(createToggle(item, rowHeight, ex));
  const label = createBox('folder-label', { id: `label-${item.path}`, x: TXT_L, width: maxWidth, height: rowHeight });
  label.textStyle = { ...TEXT_STYLES.folderLabel, content: item.name, color: theme.tree.label };
  row.addChild(label);
  return row;
}

function innerFileRow(item: FileNode, y: number, cw: number, ctx: BuildCtx, depth: number): Box {
  const sel = ctx.selectedFile === item.path;
  const maxWidth = cw - TXT_L - 16;
  const { lines: actualLines, height: rowHeight } = calcTextLayout(item.name, maxWidth);
  
  const row = createBox('file-row', {
    id: `file-${item.path}`, x: 0, y, width: cw, height: rowHeight,
    backgroundColor: sel ? theme.tree.selectedBg : 'transparent',
    data: { path: item.path, isDir: false, depth, lineCount: actualLines },
    gesture: { passive: true, onTap: () => ctx.onFileClick(item.path) },
  });
  const label = createBox('file-label', { id: `label-${item.path}`, x: TXT_L, width: maxWidth, height: rowHeight });
  label.textStyle = { ...TEXT_STYLES.fileLabel, content: item.name, color: theme.tree.label };
  row.addChild(label);
  return row;
}

function buildExpanded(path: string, children: FileNode[], ctx: BuildCtx, depth: number, relX: number, parentWidth?: number): Box {
  const w = (parentWidth ?? ctx.rightMargin) - relX;
  const density = 1 - getShift(depth) / 18;
  const borderOp = (0.3 + density * 0.5).toFixed(3);
  const container = createBox('folder-container', {
    id: `expanded-${path}`, width: w, height: 0, x: relX, y: 0,
    backgroundColor: 'transparent',
    overflow: 'hidden',
    gradient: depth > 0 ? depthGradient(depth) : undefined,
    shadow: { color: theme.tree.shadow, blur: 12, offsetX: -4, offsetY: 0 },
  });
  if (depth > 0) {
    container.kfmStyle = resolveStyle('left-emphasis-rest-hidden', {
      borderColor: `rgba(180,130,255,${borderOp})`, emphasisScale: 2, cornerRadius: 4,
    });
  }

  let cy = 0;
  // children.length === 0 时直接返回空容器（高度 0）
  if (children.length === 0) {
    container.height = 0;
    // 空文件夹高度为0，圆角会重叠，必须归零
    if (container.kfmStyle) {
      container.kfmStyle.cornerRadius = 0;
    }
    return container;
  }

  for (const item of children) {
    if (!KFMState.showHidden && item.name.startsWith('.')) continue;
    if (item.isDir) {
      const folderRow = innerFolderRow(item, cy, w, ctx, depth);
      container.addChild(folderRow);
      cy += folderRow.height;

      if (ctx.expandedPaths[item.path]) {
        const ch = KFMState.files[item.path]?.children ?? item.children ?? [];
        const sub = buildExpanded(item.path, ch, ctx, depth + 1, getShift(depth), w);
        sub.y = cy; container.addChild(sub); cy += sub.height;
      }
    } else {
      const fileRow = innerFileRow(item, cy, w, ctx, depth);
      container.addChild(fileRow);
      cy += fileRow.height;
    }
  }
  container.height = cy;
  return container;
}

export function buildTree(items: FileNode[], options: TreeOptions = {}): Box {
  const {
    expandedPaths = {}, selectedFile = null, onDirToggle = () => {}, onFileClick = () => {},
    baseDepth = 0, containerWidth = 295, scrollable = true, rightMargin = containerWidth - 8,
  } = options;
  const ctx: BuildCtx = { expandedPaths, selectedFile, onDirToggle, onFileClick, containerWidth, rightMargin };
  const rootBox = createBox('sidebar-root', {
    id: 'file-tree-root', width: containerWidth, scrollable, scrollY: 0, height: 0, scrollbarVisible: false, overflow: 'hidden',
  });

  // 把根目录所有内容包进 expanded-容器，方便动画
  const rootRelX = absX(baseDepth) + getShift(baseDepth);
  const rootContainer = buildExpanded('.', items, ctx, baseDepth, rootRelX);
  rootContainer.y = 0;
  rootBox.addChild(rootContainer);
  rootBox.height = rootContainer.height;
  rootBox.scrollY = 0;
  return rootBox;
}

function container_AddRootFolderRow(parent: Box, item: FileNode, y: number, depth: number, cw: number, ctx: BuildCtx): Box {
  const x = absX(depth);
  const w = ctx.rightMargin - x;
  const ex = !!ctx.expandedPaths[item.path];
  const sel = ctx.selectedFile === item.path;
  const maxWidth = w - TXT_L - 16;
  const { lines: actualLines, height: rowHeight } = calcTextLayout(item.name, maxWidth);
  
  const row = createBox('folder-row', {
    id: `title-${item.path}`, x, y, width: w, height: rowHeight,
    backgroundColor: sel ? theme.tree.selectedBg : 'transparent',
    data: { path: item.path, isDir: true, isExpanded: ex, depth, lineCount: actualLines },
    gesture: { passive: true, onTap: () => ctx.onDirToggle(item.path, !ex) },
  });
  row.addChild(createToggle(item, rowHeight, ex));
  const label = createBox('folder-label', { id: `label-${item.path}`, x: TXT_L, width: maxWidth, height: rowHeight });
  label.textStyle = { ...TEXT_STYLES.folderLabel, content: item.name, color: theme.tree.label };
  row.addChild(label);
  parent.addChild(row);
  return row;
}

function container_AddRootFileRow(parent: Box, item: FileNode, y: number, depth: number, cw: number, ctx: BuildCtx): Box {
  const x = absX(depth);
  const w = ctx.rightMargin - x;
  const sel = ctx.selectedFile === item.path;
  const maxWidth = w - TXT_L - 16;
  const { lines: actualLines, height: rowHeight } = calcTextLayout(item.name, maxWidth);
  
  const row = createBox('file-row', {
    id: `file-${item.path}`, x, y, width: w, height: rowHeight,
    backgroundColor: sel ? theme.tree.selectedBg : 'transparent',
    data: { path: item.path, isDir: false, depth, lineCount: actualLines },
    gesture: { passive: true, onTap: () => ctx.onFileClick(item.path) },
  });
  const label = createBox('file-label', { id: `label-${item.path}`, x: TXT_L, width: maxWidth, height: rowHeight });
  label.textStyle = { ...TEXT_STYLES.fileLabel, content: item.name, color: theme.tree.label };
  row.addChild(label);
  parent.addChild(row);
  return row;
}

export function buildSidebarTree(containerWidth?: number, rightMargin?: number): Box {
  const state = KFMState;
  const rm = rightMargin ?? (containerWidth ?? 295) - 8;
  return buildTree(state.files[state.currentRoot]?.children ?? [], {
    expandedPaths: state.expandedPaths, selectedFile: state.selectedFile,
    onDirToggle: (p, e) => state.setExpanded(p, e), onFileClick: (p) => state.setSelectedFile(p),
    baseDepth: 0, containerWidth: containerWidth ?? 280, scrollable: true, rightMargin: rm,
  });
}