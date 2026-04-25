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
import { DIMENSIONS, COLORS, TEXT_STYLES, getFileColor, createBox } from './style-registry.js';

export interface TreeOptions {
  expandedPaths: Record<string, boolean>;
  selectedFile?: string | null;
  onDirToggle?: (path: string, expand: boolean) => void;
  onFileClick?: (path: string) => void;
  baseDepth?: number;
  containerWidth?: number;
  scrollable?: boolean;
}

interface BuildCtx {
  expandedPaths: Record<string, boolean>;
  selectedFile: string | null;
  onDirToggle: (path: string, expand: boolean) => void;
  onFileClick: (path: string) => void;
  containerWidth: number;
}

const SHIFT_TABLE = [18, 16, 14, 12, 10, 9, 8, 7, 6, 5, 4, 3, 3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2];
function getShift(depth: number): number { return SHIFT_TABLE[depth] ?? 2; }
const T_OFF = 12;
const TXT_L = 26;

function absX(d: number): number { let x = 0; for (let i = 0; i < d; i++) x += getShift(i); return x; }

// ============================================================
// 容器内部行构建（x=0 相对容器）
// ============================================================

function innerFolderRow(item: FileNode, y: number, cw: number, ctx: BuildCtx): Box {
  const ex = !!ctx.expandedPaths[item.path];
  const sel = ctx.selectedFile === item.path;
  const row = createBox('folder-row', {
    id: `title-${item.path}`, x: 0, y, width: cw, height: 28,
    backgroundColor: sel ? 'rgba(124,58,237,0.15)' : 'transparent',
    data: { path: item.path, isDir: true, isExpanded: ex },
    gesture: { passive: true, onTap: () => ctx.onDirToggle(item.path, !ex) },
  });
  const tog = createBox('toggle-icon', { id: `toggle-${item.path}`, x: T_OFF });
  tog.textStyle = { ...TEXT_STYLES.toggleIcon, content: ex ? '▼' : '▶', color: '#00d4ff' };
  row.addChild(tog);
  const label = createBox('folder-label', { id: `label-${item.path}`, x: TXT_L, width: cw - TXT_L - 8 });
  label.textStyle = { ...TEXT_STYLES.folderLabel, content: item.name, color: '#e8e0f0' };
  row.addChild(label);
  return row;
}

function innerFileRow(item: FileNode, y: number, cw: number, ctx: BuildCtx): Box {
  const sel = ctx.selectedFile === item.path;
  const row = createBox('file-row', {
    id: `file-${item.path}`, x: TXT_L, y, width: cw - TXT_L, height: 28,
    backgroundColor: sel ? 'rgba(124,58,237,0.15)' : 'transparent',
    data: { path: item.path, isDir: false },
    gesture: { passive: true, onTap: () => ctx.onFileClick(item.path) },
  });
  const label = createBox('file-label', { id: `label-${item.path}`, x: 0, width: row.width - 8 });
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

function buildExpanded(path: string, children: FileNode[], ctx: BuildCtx, depth: number, relX: number): Box {
  const w = ctx.containerWidth - absX(depth);
  const container = createBox('folder-container', {
    id: `expanded-${path}`, width: w, height: 0, x: relX, y: 0,
  });
  container.border = { color: '#7c3aed', width: 1, sides: ['top', 'bottom', 'left', 'right'] };

  let cy = 0;

  // 无数据 → 占位行
  if (children.length === 0) {
    const lr = createBox('file-row', { id: `loading-${path}`, x: TXT_L, y: 0, width: w - TXT_L, height: 28 });
    const lb = createBox('file-label', { id: `loading-label-${path}`, x: 0, width: lr.width - 8 });
    lb.textStyle = { ...TEXT_STYLES.fileLabel, content: '…', color: '#e8e0f0' };
    lr.addChild(lb); container.addChild(lr); container.height = 32;
    return container;
  }

  for (const item of children) {
    if (item.isDir) {
      container.addChild(innerFolderRow(item, cy, w, ctx));
      cy += 32;
      if (ctx.expandedPaths[item.path]) {
        const ch = KFMState.files[item.path]?.children ?? item.children ?? [];
        const sub = buildExpanded(item.path, ch, ctx, depth + 1, getShift(depth));
        sub.y = cy; container.addChild(sub); cy += sub.height;
      }
    } else {
      container.addChild(innerFileRow(item, cy, w, ctx));
      cy += 32;
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
    baseDepth = 0, containerWidth = 280, scrollable = true,
  } = options;
  const ctx: BuildCtx = { expandedPaths, selectedFile, onDirToggle, onFileClick, containerWidth };
  const rootBox = createBox('sidebar-root', {
    id: 'file-tree-root', width: containerWidth, scrollable, scrollY: 0, height: 0,
  });

  let cy = 0;
  for (const item of items) {
    if (item.isDir) {
      // 根层行用绝对坐标
      container_AddRootFolderRow(rootBox, item, cy, baseDepth, containerWidth, ctx);
      cy += 32;
      if (ctx.expandedPaths[item.path]) {
        const ch = KFMState.files[item.path]?.children ?? item.children ?? [];
        const c = buildExpanded(item.path, ch, ctx, baseDepth, absX(baseDepth) + getShift(baseDepth));
        c.y = cy; rootBox.addChild(c); cy += c.height;
      }
    } else {
      container_AddRootFileRow(rootBox, item, cy, baseDepth, containerWidth, ctx);
      cy += 32;
    }
  }
  rootBox.height = cy; rootBox.scrollY = 0;
  return rootBox;
}

function container_AddRootFolderRow(parent: Box, item: FileNode, y: number, depth: number, cw: number, ctx: BuildCtx): void {
  const x = absX(depth);
  const w = cw - x;
  const ex = !!ctx.expandedPaths[item.path];
  const sel = ctx.selectedFile === item.path;
  const row = createBox('folder-row', {
    id: `title-${item.path}`, x, y, width: w, height: 28,
    backgroundColor: sel ? 'rgba(124,58,237,0.15)' : 'transparent',
    data: { path: item.path, isDir: true, isExpanded: ex },
    gesture: { passive: true, onTap: () => ctx.onDirToggle(item.path, !ex) },
  });
  const tog = createBox('toggle-icon', { id: `toggle-${item.path}`, x: T_OFF });
  tog.textStyle = { ...TEXT_STYLES.toggleIcon, content: ex ? '▼' : '▶', color: '#00d4ff' };
  row.addChild(tog);
  const label = createBox('folder-label', { id: `label-${item.path}`, x: TXT_L, width: w - TXT_L - 8 });
  label.textStyle = { ...TEXT_STYLES.folderLabel, content: item.name, color: '#e8e0f0' };
  row.addChild(label);
  parent.addChild(row);
}

function container_AddRootFileRow(parent: Box, item: FileNode, y: number, depth: number, cw: number, ctx: BuildCtx): void {
  const x = absX(depth);
  const w = cw - x;
  const sel = ctx.selectedFile === item.path;
  const row = createBox('file-row', {
    id: `file-${item.path}`, x: x + TXT_L, y, width: w - TXT_L, height: 28,
    backgroundColor: sel ? 'rgba(124,58,237,0.15)' : 'transparent',
    data: { path: item.path, isDir: false },
    gesture: { passive: true, onTap: () => ctx.onFileClick(item.path) },
  });
  const label = createBox('file-label', { id: `label-${item.path}`, x: 0, width: row.width - 8 });
  label.textStyle = { ...TEXT_STYLES.fileLabel, content: item.name, color: "#e8e0f0" };
  row.addChild(label);
  parent.addChild(row);
}

export function buildSidebarTree(): Box {
  const state = KFMState;
  return buildTree(state.files['/root']?.children ?? [], {
    expandedPaths: state.expandedPaths, selectedFile: state.selectedFile,
    onDirToggle: (p, e) => state.setExpanded(p, e), onFileClick: p => state.selectFile(p),
    baseDepth: 0, containerWidth: 280, scrollable: true,
  });
}