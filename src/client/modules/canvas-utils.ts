/**
 * canvas-utils.ts — 通用 Canvas 盒子工具函数
 *
 * 不绑定任何具体页面（非文件树专属）。
 * 任何用 Box + Canvas 渲染的页面都可以使用这些底层工具。
 *
 * 依赖: renderer-lifecycle (L) → engine/v2
 * 被依赖: canvas-cursor.ts, canvas-scroll.ts, tree-render.ts, 未来的 card-stream.ts ...
 *
 * 设计原则:
 * - 纯工具函数，不包含任何业务逻辑
 * - 只依赖 L（渲染器生命周期）和引擎类型
 * - 不导入任何 tree-* 或 canvas-* 文件（避免循环依赖）
 */

import { Box } from '../engine/v2/box.js';
import { L } from './renderer-lifecycle.js';

export function getRootScrollY(): number | null {
  return L.renderer?.getRoot()?.scrollY ?? null;
}

export function setRootScrollY(val: number): void {
  const root = L.renderer?.getRoot();
  if (!root) return;
  const maxScroll = root.getMaxScroll().maxY;
  root.scrollY = Math.max(0, Math.min(val, maxScroll));
}

// ============================================================
// 光标步进辅助函数
// ============================================================

/** 重建行索引：遍历树收集所有可交互行，按绝对 Y 排序 */
export function _rebuildRowIndex(root: Box): void {
  L._rowIndex = [];
  function walk(box: Box): void {
    for (const child of box.children) {
      if (!child.visible || child.disabled) continue;
      if (child.interactive && child.gesture?.onTap) {
        L._rowIndex.push(child);
      }
      walk(child);
    }
  }
  walk(root);
  L._rowIndex.sort((a, b) => {
    return a.getAbsolutePosition().y - b.getAbsolutePosition().y;
  });
}

/** 在 root 子树中按 id 查找 Box */
export function findBoxById(root: Box, id: string): Box | null {
  for (const child of root.children) {
    if (child.id === id) return child;
    const found = findBoxById(child, id);
    if (found) return found;
  }
  return null;
}
