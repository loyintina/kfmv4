/**
 * tree-render.ts — 渲染层
 *
 * 用 kfmv3 v2 引擎渲染 Box 树到 Canvas。
 * 数据层（建模）+ 渲染层（引擎）分离。
 */

import { Renderer } from '../engine/v2/renderer.js';
import { styleRegistry } from './style-registry.js';
import { buildSidebarTree } from './tree-model.js';
import { KFMState } from './state.js';

let renderer: Renderer | null = null;
let sidebarCanvas: HTMLCanvasElement | null = null;

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

  sidebarCanvas = document.createElement('canvas');
  sidebarCanvas.id = 'tree-canvas';
  sidebarCanvas.style.width = '100%';
  sidebarCanvas.style.height = '100%';
  sidebarCanvas.style.display = 'block';

  fileTree.innerHTML = '';
  fileTree.appendChild(sidebarCanvas);

  renderer = new Renderer(sidebarCanvas, {
    backgroundColor: 'rgba(10,10,15,0.85)',
    dpr: window.devicePixelRatio || 1,
  });

  rebuildTree();

  KFMState.subscribe(() => {
    rebuildTree();
  });

  // 注册表热更新 → 自动重建
  styleRegistry.subscribe(() => {
    rebuildTree();
  });

  window.addEventListener('resize', () => {
    renderer?.resize();
  });

  // 滚轮滚动
  sidebarCanvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const root = renderer?.getRoot();
    if (!root) return;
    root.scrollY += e.deltaY;
    if (root.scrollY < 0) root.scrollY = 0;
    if (root.scrollY > root.height) root.scrollY = root.height;
  }, { passive: false });

  // 触摸滚动
  let touchStartY = 0;
  let touchScrollY = 0;
  sidebarCanvas.addEventListener('touchstart', (e) => {
    touchStartY = e.touches[0].clientY;
    const root = renderer?.getRoot();
    touchScrollY = root?.scrollY || 0;
  }, { passive: true });

  sidebarCanvas.addEventListener('touchmove', (e) => {
    const dy = touchStartY - e.touches[0].clientY;
    const root = renderer?.getRoot();
    if (!root) return;
    root.scrollY = touchScrollY + dy;
    if (root.scrollY < 0) root.scrollY = 0;
    if (root.scrollY > root.height) root.scrollY = root.height;
  }, { passive: true });
}

function rebuildTree(): void {
  if (!renderer) return;

  const rootBox = buildSidebarTree();
  renderer.setRoot(rootBox);

  if (!renderer.isRunning) {
    renderer.start();
  }
}