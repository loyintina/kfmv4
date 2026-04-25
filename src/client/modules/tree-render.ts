/**
 * tree-render.ts — 渲染层
 *
 * 用 kfmv3 v2 引擎渲染 Box 树到 Canvas。
 * 滚动事件 → 写 rootBox.scrollY → 引擎自动处理裁剪/偏移/滚动条。
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

  renderer = new Renderer(canvas, {
    backgroundColor: 'rgba(10,10,15,0.85)',
    dpr: window.devicePixelRatio || 1,
  });

  rebuildTree();

  KFMState.subscribe(() => rebuildTree());
  styleRegistry.subscribe(() => rebuildTree());
  window.addEventListener('resize', () => renderer?.resize());

  // 引擎只负责画 scrollable 的裁剪/偏移/滚动条
  // 这里绑滚动事件 → 写 root.scrollY
  bindScrollEvents(canvas);
}

// ============================================================
// 滚动事件绑定（引擎不绑，由渲染粘合层做）
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
  // 滚轮
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const cur = getRootScrollY();
    if (cur !== null) setRootScrollY(cur + e.deltaY);
  }, { passive: false });

  // 触摸拖动
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
