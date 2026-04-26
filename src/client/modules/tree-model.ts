/**
 * tree-model.ts — 绝对深度布局
 * 
 * 核心规则（利用引擎 getBounds() 自动累加父节点偏移）：
 * 1. rootBox.x = 0
 * 2. 根层行（挂在 rootBox 下）: x = absX(depth)
 * 3. 展开容器（挂在 rootBox 下）: x = absX(depth)
 * 4. 展开容器内部子行: x = 0, width = container.width
 * 5. 子展开容器（挂在父容器内）: x = SHIFT (18px)
 * 这样每层容器只需偏移 18px，引擎自动累加出正确的绝对位置。
 */

import { Box } from '../engine/v2/box.js';
import { KFMState, type FileNode } from './state.js';
import { DIMENSIONS, COLORS, TEXT_STYLES, getFileColor, createBox, LINE_HEIGHT, MAX_LINES, FONT } from './style-registry.js';
import { DIMENSIONS as D } from './style-registry.js';
import { resolveStyle } from '../engine/v2/StyleConfig.js';
import { prepareWithSegments, layoutWithLines } from '@chenglou/pretext';

export interface TreeOptions {
  expandedPaths: Record<string, boolean>;
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

const SHIFT_TABLE = [18, 16, 14, 12, 10, 9, 8, 7, 6, 5, 4, 3, 3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2];
export function getShift(depth: number): number { return SHIFT_TABLE[depth] ?? 2; }
const T_OFF = 12;
const TXT_L = 26;

function absX(d: number): number { let x = 0; for (let i = 0; i < d; i++) x += getShift(i); return x; }

/** 深度渐变：缩进越密集（SHIFT越小）→ density越高 → 颜色越深 */
function depthGradient(depth: number) {
  const shift = getShift(depth);
  const density = 1 - shift / 18;  // 0=最宽层，1=最密层
  const topA = (0.02 + density * 0.18).toFixed(3);
  const botA = (0.08 + density * 0.35).toFixed(3);
  return {
    type: 'linear' as const,
    angle: 180,
    stops: [
      { offset: 0, color: `rgba(124,58,237,${topA})` },
      { offset: 1, color: `rgba(124,58,237,${botA})` },
    ],
  };
}

// ============================================================
// 容器内部行构建（x=0 相对容器）
// ============================================================

/** 计算文本需要的行数和高度 */
function calcTextLayout(name: string, maxWidth: number): { lines: number, height: number } {
  const prepared = prepareWithSegments(name, FONT);
  const { lines } = layoutWithLines(prepared, maxWidth, LINE_HEIGHT);
  const actualLines = Math.min(lines.length, MAX_LINES);
  return { lines: actualLines, height: actualLines * LINE_HEIGHT + 6 };  // +6 是上下 padding
}

function innerFolderRow(item: FileNode, y: number, cw: number, ctx: BuildCtx, depth: number): Box {
  const ex = !!ctx.expandedPaths[item.path];
  const sel = ctx.selectedFile === item.path;
  const maxWidth = cw - TXT_L - 16;
  const { lines: actualLines, height: rowHeight } = calcTextLayout(item.name, maxWidth);
  
  const row = createBox('folder-row', {
    id: `title-${item.path}`, x: 0, y, width: cw, height: rowHeight,
    backgroundColor: sel ? 'rgba(124,58,237,0.15)' : 'transparent',
    data: { path: item.path, isDir: true, isExpanded: ex, depth, lineCount: actualLines },
    gesture: { passive: true, onTap: () => ctx.onDirToggle(item.path, !ex) },
  });
  const tog = createBox('toggle-icon', { id: `toggle-${item.path}`, x: T_OFF, y: 3 });
  tog.textStyle = { ...TEXT_STYLES.toggleIcon, content: ex ? '▼' : '▶', color: '#00d4ff' };  row.addChild(tog);
  const label = createBox('folder-label', { id: `label-${item.path}`, x: TXT_L, width: maxWidth, height: rowHeight });
  label.textStyle = { ...TEXT_STYLES.folderLabel, content: item.name, color: '#e8e0f0' };
  row.addChild(label);
  return row;
}

function innerFileRow(item: FileNode, y: number, cw: number, ctx: BuildCtx, depth: number): Box {
  const sel = ctx.selectedFile === item.path;
  const maxWidth = cw - TXT_L - 16;
  const { lines: actualLines, height: rowHeight } = calcTextLayout(item.name, maxWidth);
  
  const row = createBox('file-row', {
    id: `file-${item.path}`, x: 0, y, width: cw, height: rowHeight,
    backgroundColor: sel ? 'rgba(124,58,237,0.15)' : 'transparent',
    data: { path: item.path, isDir: false, depth, lineCount: actualLines },
    gesture: { passive: true, onTap: () => ctx.onFileClick(item.path) },
  });
  const label = createBox('file-label', { id: `label-${item.path}`, x: TXT_L, width: maxWidth, height: rowHeight });
  label.textStyle = { ...TEXT_STYLES.fileLabel, content: item.name, color: "#e8e0f0" };
  row.addChild(label);
  return row;
}

// ============================================================
// 展开容器
// relX: 相对于父节点的偏移
//   - 挂在 rootBox: absX(depth)
//   - 挂在父容器: SHIFT
// ============================================================

function buildExpanded(path: string, children: FileNode[], ctx: BuildCtx, depth: number, relX: number, parentWidth?: number): Box {
  const w = (parentWidth ?? ctx.rightMargin) - relX;
  const density = 1 - getShift(depth) / 18;
  const borderOp = (0.3 + density * 0.5).toFixed(3);
  const container = createBox('folder-container', {
    id: `expanded-${path}`, width: w, height: 0, x: relX, y: 0,
    backgroundColor: 'transparent',
    gradient: depthGradient(depth),
    shadow: { color: 'rgba(0,0,0,0.5)', blur: 12, offsetX: -4, offsetY: 0 },
  });
  container.kfmStyle = resolveStyle('left-emphasis-rest-hidden', {
    borderColor: `rgba(180,130,255,${borderOp})`,
    emphasisScale: 2,
    cornerRadius: 4,
  });

  let cy = 0;

  // 无数据 → 占位行
  if (children.length === 0) {
    const lr = createBox('file-row', { id: `loading-${path}`, x: TXT_L, y: 0, width: w - TXT_L, height: LINE_HEIGHT + 6 });
    const lb = createBox('file-label', { id: `loading-label-${path}`, x: 0, width: lr.width - 8, height: lr.height });
    lb.textStyle = { ...TEXT_STYLES.fileLabel, content: '…', color: '#e8e0f0' };
    lr.addChild(lb); container.addChild(lr); container.height = LINE_HEIGHT + 10;
    return container;
  }

  for (const item of children) {
    if (item.isDir) {
      const folderRow = innerFolderRow(item, cy, w, ctx, depth);
      container.addChild(folderRow);
      cy += folderRow.height;  // 动态高度
      if (ctx.expandedPaths[item.path]) {
        const ch = KFMState.files[item.path]?.children ?? item.children ?? [];
        const sub = buildExpanded(item.path, ch, ctx, depth + 1, getShift(depth), w);
        sub.y = cy; container.addChild(sub); cy += sub.height;
      }
    } else {
      const fileRow = innerFileRow(item, cy, w, ctx, depth);
      container.addChild(fileRow);
      cy += fileRow.height;  // 动态高度
    }
  }

  container.height = cy;
  return container;
}

// ============================================================
// buildTree
// ============================================================

export function buildTree(items: FileNode[], options: TreeOptions = {}): Box {
  const {
    expandedPaths = {}, selectedFile = null, onDirToggle = () => {}, onFileClick = () => {},
    baseDepth = 0, containerWidth = 295, scrollable = true, rightMargin = containerWidth - 8,
  } = options;
  const ctx: BuildCtx = { expandedPaths, selectedFile, onDirToggle, onFileClick, containerWidth, rightMargin };
  const rootBox = createBox('sidebar-root', {
    id: 'file-tree-root', width: containerWidth, scrollable, scrollY: 0, height: 0, scrollbarVisible: false,
  });

  let cy = 0;
  for (const item of items) {
    if (item.isDir) {
      const folderRow = container_AddRootFolderRow(rootBox, item, cy, baseDepth, containerWidth, ctx);
      cy += folderRow.height;  // 动态高度
      if (ctx.expandedPaths[item.path]) {
        const ch = KFMState.files[item.path]?.children ?? item.children ?? [];
        const c = buildExpanded(item.path, ch, ctx, baseDepth, absX(baseDepth) + getShift(baseDepth));
        c.y = cy; rootBox.addChild(c); cy += c.height;
      }
    } else {
      const fileRow = container_AddRootFileRow(rootBox, item, cy, baseDepth, containerWidth, ctx);
      cy += fileRow.height;  // 动态高度
    }
  }
  rootBox.height = cy; rootBox.scrollY = 0;
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
    backgroundColor: sel ? 'rgba(124,58,237,0.15)' : 'transparent',
    data: { path: item.path, isDir: true, isExpanded: ex, depth, lineCount: actualLines },
    gesture: { passive: true, onTap: () => ctx.onDirToggle(item.path, !ex) },
  });
  const tog = createBox('toggle-icon', { id: `toggle-${item.path}`, x: T_OFF, y: 3 });
  tog.textStyle = { ...TEXT_STYLES.toggleIcon, content: ex ? '▼' : '▶', color: '#00d4ff' };
  row.addChild(tog);
  const label = createBox('folder-label', { id: `label-${item.path}`, x: TXT_L, width: maxWidth, height: rowHeight });
  label.textStyle = { ...TEXT_STYLES.folderLabel, content: item.name, color: '#e8e0f0' };
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
    backgroundColor: sel ? 'rgba(124,58,237,0.15)' : 'transparent',
    data: { path: item.path, isDir: false, depth, lineCount: actualLines },
    gesture: { passive: true, onTap: () => ctx.onFileClick(item.path) },
  });
  const label = createBox('file-label', { id: `label-${item.path}`, x: TXT_L, width: maxWidth, height: rowHeight });
  label.textStyle = { ...TEXT_STYLES.fileLabel, content: item.name, color: "#e8e0f0" };
  row.addChild(label);
  parent.addChild(row);
  return row;
}

export function buildSidebarTree(containerWidth?: number, rightMargin?: number): Box {
  const state = KFMState;
  const rm = rightMargin ?? (containerWidth ?? 295) - 8;
  return buildTree(state.files['/root']?.children ?? [], {
    expandedPaths: state.expandedPaths, selectedFile: state.selectedFile,
    onDirToggle: (p, e) => state.setExpanded(p, e), onFileClick: p => state.selectFile(p),
    baseDepth: 0, containerWidth: containerWidth ?? 280, scrollable: true, rightMargin: rm,
  });
}