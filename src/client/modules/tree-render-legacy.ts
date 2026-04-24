/**
 * tree-render.ts — 渲染层
 *
 * 把 Box 树画到 Canvas 上。
 * Phase 11 第一步：先用纯 Canvas 2D 直接画，跟通整个流程。
 * 等跟通后再接入引擎 Renderer。
 */

import { buildSidebarTree } from './tree-model.js';
import { KFMState } from './state.js';
import type { Box } from '../engine/v2/box.js';

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let dpr = 1;

/** 给 UI 层调用：侧栏打开时重绘 */
export function onSidebarOpen(): void {
  requestAnimationFrame(() => {
    resizeCanvas();
    draw();
  });
}

/** 给 UI 层调用：侧栏关闭 */
export function onSidebarClose(): void {}

/** 初始化 */
export function initTreeRenderer(): void {
  const fileTree = document.getElementById('fileTree');
  if (!fileTree) {
    console.warn('[tree-render] #fileTree not found');
    return;
  }

  canvas = document.createElement('canvas');
  canvas.id = 'tree-canvas';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';

  fileTree.innerHTML = '';
  fileTree.appendChild(canvas);

  ctx = canvas.getContext('2d')!;
  dpr = window.devicePixelRatio || 1;

  resizeCanvas();
  draw();

  console.log('[tree-render] Canvas mounted, w:', canvas.clientWidth, 'h:', canvas.clientHeight);

  // 状态变化时重绘
  KFMState.subscribe(() => {
    draw();
  });

  window.addEventListener('resize', () => {
    resizeCanvas();
    draw();
  });
}

// ============================================================
// Canvas 尺寸
// ============================================================

function resizeCanvas(): void {
  if (!canvas || !ctx) return;
  const w = canvas.clientWidth || 264;
  const h = canvas.clientHeight || 618;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

// ============================================================
// 纯 Canvas 2D 绘制（不用引擎，跟通整个流程）
// ============================================================

function draw(): void {
  if (!canvas || !ctx) return;

  const w = canvas.clientWidth;
  const h = canvas.clientHeight;

  // 清屏
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(10,10,15,0.95)';
  ctx.fillRect(0, 0, w, h);

  // 获取数据
  const root = KFMState.files['/root'];
  if (!root || !root.children || root.children.length === 0) {
    ctx.fillStyle = '#666';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText('加载中...', 20, 30);
    return;
  }

  // 遍历文件树，直接画
  let y = 4;
  drawChildren(root.children, 0, y);
}

function drawChildren(children: any[], depth: number, startY: number): number {
  if (!ctx) return startY;
  let y = startY;
  const indent = depth * 16 + 12;

  for (const item of children) {
    if (!KFMState.showHidden && item.name.startsWith('.')) continue;

    const isDir = item.isDir;
    const isExpanded = !!KFMState.expandedPaths[item.path];
    const isSelected = KFMState.selectedFile === item.path;

    // 选中背景
    if (isSelected) {
      ctx.fillStyle = 'rgba(124,58,237,0.15)';
      ctx.fillRect(0, y, canvas!.clientWidth, 32);
    }

    // 引导线（左边框）
    if (isDir && isExpanded) {
      ctx.fillStyle = 'rgba(124,58,237,0.3)';
      ctx.fillRect(indent - 8, y, 2, 32);
    }

    // 图标 + 文字
    ctx.font = '13px system-ui, sans-serif';
    const icon = isDir ? (isExpanded ? '📂' : '📁') : getFileIcon(item.name);
    ctx.fillStyle = isDir ? '#7c3aed' : '#e0e0e0';
    ctx.fillText(icon + ' ' + item.name, indent, y + 21);

    y += 32;

    // 展开的文件夹：递归画子项
    if (isDir && isExpanded && item.children) {
      // 引导线延伸
      const childStartY = y;
      y = drawChildren(item.children, depth + 1, y);
      // 画延伸的引导线
      if (y > childStartY) {
        ctx.fillStyle = 'rgba(124,58,237,0.3)';
        ctx.fillRect(indent - 8, childStartY, 2, y - childStartY);
      }
    }
  }

  return y;
}

function getFileIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    ts: '📄', tsx: '⚛️', js: '📜', json: '📋', css: '🎨',
    html: '🌐', md: '📝', yml: '⚙️', yaml: '⚙️', svg: '🖼️',
    ico: '🔷', lock: '🔒', sh: '💻', go: '🔵', rs: '🦀',
    py: '🐍', vue: '💚', svelte: '🧡', mjs: '📜', log: '📝',
  };
  if (!ext || ext === name) return '📄';
  return map[ext] || '📄';
}