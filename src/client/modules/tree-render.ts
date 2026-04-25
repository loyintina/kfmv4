/**
 * tree-render.ts — 渲染层
 *
 * 用 kfmv3 v2 引擎渲染 Box 树到 Canvas。
 * 滚动事件 → 写 rootBox.scrollY → 引擎自动处理裁剪/偏移/滚动条。
 * 点击事件 → hitTest → 执行 gesture.onTap。
 */

import { Renderer } from '../engine/v2/renderer.js';
import { buildSidebarTree } from './tree-model.js';
import { KFMState } from './state.js';
import { styleRegistry } from './style-registry.js';

let renderer: Renderer | null = null;

export function onSidebarOpen(): void {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    renderer?.resize();
  }));
}

export function onSidebarClose(): void {}

export function initTreeRenderer(): void {
  const fileTree = document.getElementById('fileTree');
  if (!fileTree) {
    console.warn('[tree-render] #fileTree not found');
    return;
  }

  const canvas = document.createElement('canvas');
  canvas.id = 'tree-canvas';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';

  fileTree.innerHTML = '';
  fileTree.appendChild(canvas);

  const dpr = window.devicePixelRatio || 1;
  renderer = new Renderer(canvas, {
    backgroundColor: 'rgba(10,10,15,0.85)',
    dpr,
  });

  rebuildTree();

  // 暴露到 window 供调试
  (window as any).__treeRenderer = renderer;

  KFMState.subscribe(() => rebuildTree());
  styleRegistry.subscribe(() => rebuildTree());
  window.addEventListener('resize', () => renderer?.resize());

  bindScrollEvents(canvas);
  bindClickEvents(canvas, dpr);
}

// ============================================================
// 滚动事件
// ============================================================

function getRootScrollY(): number | null {
  return renderer?.getRoot()?.scrollY ?? null;
}

function setRootScrollY(val: number): void {
  const root = renderer?.getRoot();
  if (!root) return;
  const maxScroll = Math.max(0, root.height - root.getBounds().height);
  root.scrollY = Math.max(0, Math.min(val, maxScroll));
}

function bindScrollEvents(canvas: HTMLCanvasElement): void {
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const cur = getRootScrollY();
    if (cur !== null) setRootScrollY(cur + e.deltaY);
  }, { passive: false });

  let touchStartY = 0;
  let touchScrollY = 0;
  canvas.addEventListener('touchstart', (e) => {
    touchStartY = e.touches[0].clientY;
    touchScrollY = getRootScrollY() ?? 0;
  }, { passive: true });

  canvas.addEventListener('touchmove', (e) => {
    const dy = touchStartY - e.touches[0].clientY;
    setRootScrollY(touchScrollY + dy);
  }, { passive: true });
}

// ============================================================
// 点击事件（hitTest → onTap）
// ============================================================

function bindClickEvents(canvas: HTMLCanvasElement, _dpr: number): void {
  canvas.addEventListener('click', (e) => {
    if (!renderer) return;

    // 不通过 renderer.hitTest（它会先检查 root 的 interactive，而 root 是 false）
    // 直接从 root 的子节点开始手动测
    const root = renderer.getRoot();
    if (!root) return;

    const scrollY = root.scrollY ?? 0;
    const px = e.offsetX;
    const py = e.offsetY + scrollY;

    for (const child of root.children) {
      if (!child.visible || child.disabled) continue;
      // 无论子容器是否有高度、是否 interactive，都穿透递归
      const hit = findTapTarget(child, px, py);
      if (hit?.gesture?.onTap) {
        hit.gesture.onTap();
        return;
      }
    }
  });
}

/** 递归找有 onTap 回调的命中节点 */
function findTapTarget(box: Box, px: number, py: number): Box | null {
  // 先检查子节点（后添加的在上层）
  // 注意：展开容器(expanded-)可能高度为0，但内部子节点可能有内容
  // 所以无条件递归子节点，不依赖 containsPoint
  for (let i = box.children.length - 1; i >= 0; i--) {
    const child = box.children[i];
    if (!child.visible || child.disabled) continue;
    const found = findTapTarget(child, px, py);
    if (found) return found;
  }
  // 检查自己是否命中且有 onTap
  if (box.containsPoint(px, py) && box.interactive && box.gesture?.onTap) {
    return box;
  }
  return null;
}

// ============================================================
// 树重建
// ============================================================

function rebuildTree(): void {
  if (!renderer) return;

  const rootBox = buildSidebarTree();
  renderer.setRoot(rootBox);

  if (!renderer.isRunning) {
    renderer.start();
  }
}