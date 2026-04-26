/**
 * tree-render.ts — 渲染层
 *
 * 用 kfmv3 v2 引擎渲染 Box 树到 Canvas。
 * 滚动事件 → 写 rootBox.scrollY → 引擎自动处理裁剪/偏移/滚动条。
 * 点击事件 → 光标优先：第一次点击移动光标，第二次点击同一行执行 onTap。
 */

import { Renderer } from '../engine/v2/renderer.js';
import { Box } from '../engine/v2/box.js';
import { buildSidebarTree, getShift } from './tree-model.js';
import { KFMState } from './state.js';
import { styleRegistry, LINE_HEIGHT, MAX_LINES } from './style-registry.js';
import { prepareWithSegments, layoutWithLines } from '@chenglou/pretext';

let renderer: Renderer | null = null;

// ============================================================
// 光标状态
// ============================================================

let cursorBox: Box | null = null;   // 光标 Box 实例
let cursorRowId: string | null = null;  // 当前光标指向的行 id

/** 创建/获取光标 Box，保证它挂在 root 上 */
function ensureCursorBox(root: Box, canvasH: number): Box {
  if (cursorBox) {
    // 确保还在 root 的子节点中
    if (root.children.includes(cursorBox)) return cursorBox;
  }

  cursorBox = new Box({
    id: 'cursor-highlight',
    x: 0,
    y: canvasH / 2 - 14,
    width: document.getElementById('tree-canvas')?.clientWidth || 280,
    height: 24,
    backgroundColor: 'rgba(46,213,163,0.15)',
    borderRadius: 0,
    interactive: false,
    visible: true,
    data: { cursorDynamicLines: true, topLineW: 0, botLineW: 0, color: 'rgba(0,212,255,0.7)' },
  });

  root.addChild(cursorBox);
  return cursorBox;
}

/** 瞬移光标到指定行的位置 */
function moveCursorTo(hitBox: Box): void {
  if (!cursorBox) return;
  const abs = hitBox.getAbsolutePosition();
  const canvas = document.getElementById('tree-canvas');
  const visibleW = canvas ? canvas.clientWidth : 280;

  // 右移 shift/2，让光标左强调线居中在当前层和下一层的左强调线之间
  const depth = (hitBox as any).data?.depth ?? 0;
  const shift = getShift(depth);
  const offsetX = shift / 2;

  cursorBox.x = abs.x + offsetX;
  cursorBox.y = abs.y + 2;
  const rm = (canvas?.clientWidth ?? 295) - 8;
  cursorBox.width = rm - abs.x - offsetX;
  cursorBox.height = hitBox.height - 4;  // 动态高度，减去上下 padding
  cursorRowId = hitBox.id || null;

  // 测量文字宽度，计算上下线长度
  // 使用 @chenglou/pretext 精确排版，与渲染器 _drawText 流程 100% 一致
  const label = hitBox.children.find(c => c.id?.startsWith('label-'));
  let textW = 0;
  if (label?.textStyle?.content) {
    const ctx2d = (canvas as any)?.getContext?.('2d');
    if (ctx2d) {
      const font = label.textStyle.font || '11px system-ui, sans-serif';
      const labelX = label.x || 0;
      const maxWidth = label.width;
      const content = label.textStyle.content;

      try {
        // 用 Pretext 精确排版，和 renderer._drawText 一致
        const prepared = prepareWithSegments(content, font);
        const { lines } = layoutWithLines(prepared, maxWidth, LINE_HEIGHT);
        const firstLine = lines[0];
        let renderWidth = firstLine.width;

        // 如果被截断（多行），模拟省略号宽度
        if (lines.length > 1 && label.textStyle.overflow === 'ellipsis') {
          const truncated = firstLine.text.slice(0, -1) + '…';
          ctx2d.font = font;
          renderWidth = ctx2d.measureText(truncated).width;
        }
        textW = labelX + renderWidth;
      } catch {
        // Pretext 失败时 fallback 到原始 measureText 截断
        ctx2d.font = font;
        const measured = ctx2d.measureText(content);
        if (measured.width > maxWidth && label.textStyle.overflow === 'ellipsis') {
          let text = content;
          while (text.length > 0 && ctx2d.measureText(text + '…').width > maxWidth) {
            text = text.slice(0, -1);
          }
          textW = labelX + ctx2d.measureText(text + '…').width;
        } else {
          textW = labelX + measured.width;
        }
      }
    }
  }
  const totalLineW = cursorBox.width;
  const topLineW = Math.min(Math.max(textW, 20), totalLineW - 10);
  const botLineW = totalLineW - topLineW;
  (cursorBox as any).data = { cursorDynamicLines: true, topLineW, botLineW, color: 'rgba(0,212,255,0.7)' };
}

// ============================================================

export function onSidebarOpen(): void {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    rebuildTree();
    renderer?.resize();
    // 同步底部工具栏宽度
    const canvas = document.getElementById('tree-canvas');
    const tools = document.querySelector('.sidebar-tools') as HTMLElement;
    if (canvas && tools) tools.style.width = canvas.clientWidth + 'px';
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
  const maxScroll = root.getMaxScroll().maxY;
  root.scrollY = Math.max(0, Math.min(val, maxScroll));
}

function bindScrollEvents(canvas: HTMLCanvasElement): void {
  // === Wheel 平滑滚动 ===
  let wheelTarget = 0;
  let wheelRaf = 0;
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const cur = getRootScrollY() ?? 0;
    wheelTarget = cur + e.deltaY;
    if (!wheelRaf) {
      wheelRaf = requestAnimationFrame(function smoothWheel() {
        const cur2 = getRootScrollY() ?? 0;
        const diff = wheelTarget - cur2;
        if (Math.abs(diff) < 0.5) {
          setRootScrollY(wheelTarget);
          wheelRaf = 0;
          return;
        }
        setRootScrollY(cur2 + diff * 0.25);
        wheelRaf = requestAnimationFrame(smoothWheel);
      });
    }
  }, { passive: false });

  // === Touch 惯性滚动 ===
  let touchStartY = 0;
  let touchScrollY = 0;
  let lastTouchY = 0;
  let lastTouchTime = 0;
  let velocity = 0;
  let flingRaf = 0;

  canvas.addEventListener('touchstart', (e) => {
    touchStartY = e.touches[0].clientY;
    touchScrollY = getRootScrollY() ?? 0;
    lastTouchY = touchStartY;
    lastTouchTime = performance.now();
    velocity = 0;
    if (flingRaf) { cancelAnimationFrame(flingRaf); flingRaf = 0; }
  }, { passive: true });

  canvas.addEventListener('touchmove', (e) => {
    const y = e.touches[0].clientY;
    const dy = touchStartY - y;
    const now = performance.now();
    const dt = now - lastTouchTime;
    if (dt > 0) {
      velocity = (lastTouchY - y) / dt * 16 * 1.7;
    }
    lastTouchY = y;
    lastTouchTime = now;
    setRootScrollY(touchScrollY + dy);
  }, { passive: true });

  canvas.addEventListener('touchend', () => {
    if (Math.abs(velocity) < 0.5) return;
    function fling() {
      velocity *= 0.96;
      if (Math.abs(velocity) < 0.3) { flingRaf = 0; return; }
      const cur = getRootScrollY() ?? 0;
      setRootScrollY(cur + velocity);
      flingRaf = requestAnimationFrame(fling);
    }
    flingRaf = requestAnimationFrame(fling);
  }, { passive: true });
}

// ============================================================
// 点击事件（光标优先 → 二次点击执行 onTap��
// ============================================================

function bindClickEvents(canvas: HTMLCanvasElement, _dpr: number): void {
  canvas.addEventListener('click', (e) => {
    if (!renderer) return;

    const root = renderer.getRoot();
    if (!root) return;

    const scrollY = root.scrollY ?? 0;
    const px = e.offsetX;
    const py = e.offsetY + scrollY;

    for (const child of root.children) {
      if (!child.visible || child.disabled) continue;
      const hit = findTapTarget(child, px, py);
      if (hit?.gesture?.onTap) {
        // 光标逻辑：第一次点击移动光标，第二次同一行才执行
        if (cursorRowId !== null && cursorRowId === hit.id) {
          // 第二次点击同一行 → 执行 onTap
          hit.gesture.onTap();
        } else {
          // 第一次点击或切换行 → 移动光标
          moveCursorTo(hit);
        }
        return;
      }
    }
  });
}

/** 递归找有 onTap 回调的命中节点 */
function findTapTarget(box: Box, px: number, py: number): Box | null {
  for (let i = box.children.length - 1; i >= 0; i--) {
    const child = box.children[i];
    if (!child.visible || child.disabled) continue;
    const found = findTapTarget(child, px, py);
    if (found) return found;
  }
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

  // 保存当前滚动位置和光标行
  const prevScrollY = renderer.getRoot()?.scrollY ?? 0;
  const prevCursorRowId = cursorRowId;

  // 重置光标实例（旧 root 销毁后 cursorBox 指向的 Box 已无效）
  cursorBox = null;
  cursorRowId = null;

  const canvas = document.getElementById('tree-canvas');
  const cw = canvas?.clientWidth ?? 295;  // 动态宽度
  const rightMargin = cw - 8;              // 行右边界 = 画布宽度 - 8px 留白
  const rootBox = buildSidebarTree(cw, rightMargin);
  // 让 rootBox 的实际宽度=canvas 宽度（扩大裁剪区域），但内部盒子保持相应比例
  if (canvas) rootBox.width = canvas.clientWidth;
  const canvasH = canvas ? canvas.clientHeight : 618;
  if (canvas) {
    rootBox.height = canvasH;
  }
  renderer.setRoot(rootBox);

  // 恢复滚动位置
  const newRoot = renderer.getRoot();
  if (newRoot && prevScrollY > 0) {
    const maxY = newRoot.getMaxScroll().maxY;
    newRoot.scrollY = Math.min(prevScrollY, maxY);
  }

  // ���新创建光标
  if (newRoot) {
    ensureCursorBox(newRoot, canvasH);

    if (prevCursorRowId) {
      // 尝试恢复光���到之前的行
      const target = findBoxById(newRoot, prevCursorRowId);
      if (target) {
        moveCursorTo(target);
      } else {
        // 行已不存在，吸附到视口中央最近的行
        snapToCenterRow(newRoot, canvasH);
      }
    } else {
      // 初始状态：吸附到视口中央最近的行
      snapToCenterRow(newRoot, canvasH);
    }
  }

  if (!renderer.isRunning) {
    renderer.start();
  }
}

/** 在 root 子树中按 id 查找 Box */
function findBoxById(root: Box, id: string): Box | null {
  for (const child of root.children) {
    if (child.id === id) return child;
    const found = findBoxById(child, id);
    if (found) return found;
  }
  return null;
}

/** 光标吸附到视口中央最近的行 */
function snapToCenterRow(root: Box, canvasH: number): void {
  const scrollY = root.scrollY ?? 0;
  const centerY = scrollY + canvasH / 2;
  let closest: Box | null = null;
  let closestDist = Infinity;

  function walk(box: Box): void {
    for (const child of box.children) {
      if (!child.visible || child.disabled) continue;
      if (child.interactive && child.gesture?.onTap) {
        const abs = child.getAbsolutePosition();
        const rowCenter = abs.y + child.height / 2;
        const dist = Math.abs(rowCenter - centerY);
        if (dist < closestDist) {
          closestDist = dist;
          closest = child;
        }
      }
      walk(child);
    }
  }

  walk(root);
  if (closest) moveCursorTo(closest);
}