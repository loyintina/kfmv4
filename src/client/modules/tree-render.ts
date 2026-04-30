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
import gsap from 'gsap';
import { styleRegistry, LINE_HEIGHT, MAX_LINES } from './style-registry.js';
import { prepareWithSegments, layoutWithLines } from '@chenglou/pretext';

let renderer: Renderer | null = null;

/** 外部使用：标记某路径正在做展开动画 */
/** 外部使用：标记某路径正在做展开动画 */
export function markAnimatingPath(path: string | null): void {
  animatingPath = path;
}

/** 外部使用：检查动画是否锁定中 */
export function isAnimLocked(): boolean {
  return animLocked;
}

// ============================================================
// 光标状态
// ============================================================

let cursorBox: Box | null = null;   // 光标 Box 实例
let cursorRowId: string | null = null;  // 当前光标指向的行 id

// 动画状态
let animatingPath: string | null = null;  // 正在展开动画的路径
let pendingCollapse: { path: string, rowId: string } | null = null;  // 正在折叠动画
let animLocked = false;  // 动画期间锁定，阻止 rebuildTree 重复执行
let animLockedAt = 0;    // animLocked 设置的毫秒时间戳，用于超时兜底
let growTarget: string | null = null;  // 需要做膨胀动画的容器 id

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
          // 第二次点击同一行 → 目录展开/折叠动画
          const hitData = (hit as any).data || {};
          const isDir = hitData.isDir;
          const isExpanded = hitData.isExpanded;
          if (isDir) {
            // 找到 toggle-icon
            const tog = hit.children.find(c => c.id?.startsWith('toggle-'));
            const targetRotate = isExpanded ? 0 : Math.PI / 2;
            if (isExpanded) {
              // ========== 折叠：先动画再 rebuild ==========
              // 找到展开容器
              const containerId = `expanded-${hitData.path}`;
              const root = renderer!.getRoot()!;
              const container = findBoxById(root, containerId);
              // 三角旋转 + 容器收缩并行
              animLocked = true; animLockedAt = Date.now();  // 锁定 rebuild
              const tl = gsap.timeline({
                onComplete: () => {
                  pendingCollapse = null;
                  animLocked = false; animLockedAt = 0;  // 解锁，允许接下来的 rebuild
                  hit.gesture!.onTap!();
                },
              });
              if (tog) {
                tl.to(tog.transform, {
                  rotate: 0,
                  duration: 0.25,
                  ease: 'power2.in',
                  onUpdate: () => { if (renderer) renderer.setRoot(renderer.getRoot()!); },
                }, 0);
              }
              if (container) {
                const fullH = container.height;
                const root = renderer!.getRoot()!;
                const origYs = container.children.map(c => c.y);
                const ancestors = collectAncestors(container, root);
                tl.to(container, {
                  height: 0,
                  duration: 0.3,
                  ease: 'power2.in',
                  onUpdate: function() {
                    applyAnimOffset(container, origYs, fullH, ancestors, root);
                    renderer?.setRoot(renderer!.getRoot()!);
                  },
                }, 0);
              }
              pendingCollapse = { path: hitData.path, rowId: hit.id };
              tl.play();
            } else {
              // ========== 展开：先 toggle → rebuild → 三角旋转+容器展开并行 ==========
              animatingPath = hitData.path;
              hit.gesture!.onTap!();  // rebuildTree 会检测 animatingPath 做三角旋转+容器动画
            }
          } else {
            hit.gesture.onTap();
          }
        } else {
          // 第一次点击或切换�� → 移动光标
          moveCursorTo(hit);
        }
        return;
      }
    }
  });
}

/** 递归找有 onTap 回调的命�����节点 */
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
  if (animLocked) {
    // 超时兜底：锁超过 3000ms 自动释放，防止异常导致永久卡死
    if (animLockedAt && Date.now() - animLockedAt > 3000) {
      animLocked = false;
      animLockedAt = 0;
    } else {
      return;  // 动画期间跳过 rebuild
    }
  }

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

  // 在 setRoot 之前预设动画初始状态，避免满高一帧闪烁
  // 递归折叠所有已展开子容器，确保展开动画期间内容不可见
  function collapseSubs(box: any): void {
    if (!box || !box.children) return;
    for (const child of box.children) {
      if (child.id?.startsWith('expanded-') && child.height > 0) {
        const subFullH = child.height;
        (child as any)._fullHeight = subFullH;
        (child as any)._origYs = child.children.map((c: any) => c.y);
        child.height = 0;
        for (const c of child.children) { c.y = c.y - subFullH; }
        // save toggle reference for cascade expand later
        const subPath = child.id.slice("expanded-".length);
        const subTitle = findBoxById(rootBox, "title-" + subPath);
        const subTog = subTitle?.children?.find((c: any) => c.id?.startsWith("toggle-"));
        if (subTog) {
          (child as any)._toggleBox = subTog;
          subTog.transform.rotate = 0; // 折叠时三角归零
        }
        collapseSubs(child);
      }
    }
  }
  if (animatingPath) {
    const preContainer = findBoxById(rootBox, `expanded-${animatingPath}`);
    if (preContainer) {
      const preFullH = preContainer.height;
      (preContainer as any)._fullHeight = preFullH;
      (preContainer as any)._origYs = preContainer.children.map((c: any) => c.y);
      preContainer.height = 0;
      for (const child of preContainer.children) { child.y = child.y - preFullH; }
      // 递归折叠内部已展开的子容器
      collapseSubs(preContainer);
    }
  }
  if (growTarget) {
    const gc = findBoxById(rootBox, growTarget);
    if (gc && gc.height > 50) {
      const gfh = gc.height;
      (gc as any)._growFullH = gfh;
      (gc as any)._growOrigYs = gc.children.map((c: any) => c.y);
      gc.height = 36;
      const gd = gfh - 36;
      for (const child of gc.children) { child.y = child.y - gd; }
      // 子项透明
      gc.children.forEach((c: any) => { c.opacity = 0; });
    }
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
        // ���已不存在，吸附到视口中���最近的行
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

  // 展开动画：容器从 height=0 平滑拉出到最终高度，子项跟�������������下滑，三角形旋转
  if (animatingPath && newRoot) {
    const path = animatingPath;
    animLocked = true; animLockedAt = Date.now();  // 锁定 rebuild
    const containerId = `expanded-${path}`;
    const container = findBoxById(newRoot, containerId);
    const titleId = `title-${path}`;
    const titleRow = findBoxById(newRoot, titleId);
    const tog = titleRow?.children?.find(c => c.id?.startsWith('toggle-'));
    if (container) {
      const fullHeight = (container as any)._fullHeight || 0;
      const origYs: number[] = (container as any)._origYs || container.children.map(c => c.y);
      if (!fullHeight) {
        // animatingPath kept — 数据未就绪，等下一次 rebuild 重试
        animLocked = false; animLockedAt = 0;
        return;
      }
      animatingPath = null;
      const root = renderer!.getRoot()!;
      const ancestors = collectAncestors(container, root);
      // 展开前隐藏直接子行，避免在展开过程中暴露
      container.children.forEach(c => { c.opacity = 0; });
      // 三角形从 0 旋转到 90°
      if (tog) {
        tog.transform.rotate = 0;
        gsap.to(tog.transform, {
          rotate: Math.PI / 2,
          duration: 0.25,
          ease: 'power2.out',
          onUpdate: () => { renderer?.setRoot(renderer!.getRoot()!); },
        });
      }
      gsap.to(container, {
        height: fullHeight,
        duration: 0.05,
        ease: 'power2.out',
        onUpdate: function() {
          applyAnimOffsetSiblings(container, fullHeight, ancestors, root);
          renderer?.setRoot(renderer!.getRoot()!);
        },
        onComplete: () => {
          animLocked = false; animLockedAt = 0;
          const hasLoading = container.children.some(c => c.id?.startsWith('loading-'));
          if (hasLoading) {
            growTarget = `expanded-${path}`;
            rebuildTree();
          } else {
            // Step 1: 逐行滑入直接子行
            slideInRows(container, root);
          }
        },
      });
      // 立即应用一帧偏移，避免 GSAP 首帧延迟导致闪烁
      applyAnimOffsetSiblings(container, fullHeight, ancestors, root);
      renderer?.setRoot(renderer!.getRoot()!);
    } else {
      // container not found — 解锁，让后续点击可以重新触发
      animLocked = false;
    }
  }


  // grow animation
  if (newRoot && growTarget) {
    const container = findBoxById(newRoot, growTarget);
    growTarget = null;
    if (container) {
      const fullH = (container as any)._growFullH || container.height;
      const origYs: number[] = (container as any)._growOrigYs || container.children.map((c: any) => c.y);
      const startH = 36;
      if (fullH > 50) {
        const root = renderer!.getRoot()!;
        const diff = fullH - startH;
        const growChildren = container.children.slice();
        const ancestors = collectAncestors(container, root);
        gsap.to(container, {
          height: fullH,
          duration: 0.5,
          ease: 'power2.out',
          onUpdate: function() {
            applyAnimOffset(container, origYs, fullH, ancestors, root);
            const progress = Math.min(1, (container.height - startH) / diff);
            growChildren.forEach(c => { c.opacity = progress; });
            renderer?.setRoot(renderer!.getRoot()!);
          },
        });
        // 立即应用一帧，避免 GSAP 首帧延迟
        applyAnimOffset(container, origYs, fullH, ancestors, root);
        renderer?.setRoot(renderer!.getRoot()!);
      }
    }
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

/** 收集从 box 向上到 root 路径上的所有祖先（不含 root 自身），返回 [{parent, sibIdx, sibOrigYs, origHeight}] */
interface AncestorInfo {
  parent: Box;
  sibIdx: number;
  sibOrigYs: number[];
  origHeight: number;
}
function collectAncestors(box: Box, root: Box): AncestorInfo[] {
  const ancestors: AncestorInfo[] = [];
  let current = box;
  while (current.parent) {
    const p = current.parent;
    const idx = p.children.indexOf(current);
    if (idx < 0) break;
    const sibOrigYs: number[] = [];
    for (let i = idx + 1; i < p.children.length; i++) {
      sibOrigYs.push(p.children[i].y);
    }
    ancestors.push({ parent: p, sibIdx: idx, sibOrigYs, origHeight: p.height });
    if (p === root) break;  // 到 root 为e止（含 root 层）
    current = p;
  }
  return ancestors;
}

/** 在动画每帧调用：偏移目标容器内部子项 + 所有祖先层的后续兄弟 + 调整祖先高度 */
function applyAnimOffset(
  container: Box,
  containerOrigYs: number[],
  fullHeight: number,
  ancestors: AncestorInfo[],
  root: Box,
): void {
  const offset = container.height - fullHeight;  // -fullHeight → 0
  // 1) 容器内部子项偏移
  for (let i = 0; i < container.children.length; i++) {
    container.children[i].y = containerOrigYs[i] + offset;
  }
  // 2) 逐层祖先：偏移后续兄弟 + 调整父容器高度（root 除外）
  let heightDelta = offset;
  for (const anc of ancestors) {
    // 偏移后续兄弟
    for (let i = anc.sibIdx + 1; i < anc.parent.children.length; i++) {
      const sib = anc.parent.children[i];
      if (sib.id === 'cursor-highlight') continue;
      sib.y = anc.sibOrigYs[i - anc.sibIdx - 1] + heightDelta;
    }
    // ��整祖先���度（root 不调，它是画布高度）
    if (anc.parent !== root) {
      anc.parent.height = anc.origHeight + heightDelta;
    }
  }
}


/** 只做兄弟偏移+祖先高度调整，不碰子行 y（用于展开动画，让 slideInRows 统一处理子行登场） */
function applyAnimOffsetSiblings(
  container: Box,
  fullHeight: number,
  ancestors: AncestorInfo[],
  root: Box,
): void {
  const offset = container.height - fullHeight;
  let heightDelta = offset;
  for (const anc of ancestors) {
    for (let i = anc.sibIdx + 1; i < anc.parent.children.length; i++) {
      const sib = anc.parent.children[i];
      if (sib.id === 'cursor-highlight') continue;
      sib.y = anc.sibOrigYs[i - anc.sibIdx - 1] + heightDelta;
    }
    if (anc.parent !== root) {
      anc.parent.height = anc.origHeight + heightDelta;
    }
  }
}
/** 光����附到视口中央最近的行 */
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

/**
 * 展开动画完成后：容器内部子行依次做 y 偏移弹跳，产生 Q 弹感。
 * 每行先向下偏移 bounceDist，再 back.out 弹回。
 * 同层 title-* + 紧跟的 expanded-* 作为一组整体弹跳。
 */

/**
 * SlideInRows: 收集容器内直接子行，全部上移隐藏��再逐行用 translateY 滑下。
 * 暂不递归。
 */
function slideInRows(container: Box, root: Box): void {
  const rows = container.children.filter(c =>
    (c.id?.startsWith('title-') || c.id?.startsWith('file-') || c.id?.startsWith('expanded-'))
  );
  if (rows.length === 0) return;

  const totalH = container.height;
  const containerOrigYs = (container as any)._origYs as number[] | undefined;
  if (containerOrigYs && container.children.length === containerOrigYs.length) {
    container.children.forEach((c, j) => { c.y = containerOrigYs[j]; });
  }
  container.children.forEach(c => { c.opacity = 1; });
  rows.forEach(r => { r.transform.translateY = -totalH; });
  renderer?.setRoot(renderer!.getRoot()!);

  // ====== 盒子链：立即展开所有子容器，不等文字 ======
  for (const child of container.children) {
    if (child.id?.startsWith('expanded-') && (child as any)._fullHeight > 0) {
      const subFullH = (child as any)._fullHeight;
      child.children.forEach(c => { c.opacity = 0; });
      const tog = (child as any)._toggleBox;
      if (tog) {
        tog.transform.rotate = 0;
        gsap.to(tog.transform, {
          rotate: Math.PI / 2,
          duration: 0.25,
          ease: 'power2.out',
          onUpdate: () => { renderer?.setRoot(renderer!.getRoot()!); },
        });
      }
      gsap.to(child, {
        height: subFullH,
        duration: 0.05,
        ease: 'power2.out',
        onUpdate: () => { renderer?.setRoot(renderer!.getRoot()!); },
        onComplete: () => { slideInRows(child, root); },
      });
    }
  }

  // ====== 文字链：逐行滑入（不阻塞盒子链） ======
  rows.forEach((row, i) => {
    gsap.to(row.transform, {
      translateY: 0,
      duration: 0.2,
      ease: 'power2.out',
      delay: (i * 25) / 1000,
      onUpdate: () => { renderer?.setRoot(renderer!.getRoot()!); },
      onComplete: () => {
        if (!row.id?.startsWith('title-')) return;
        const subId = 'expanded-' + row.id.slice(6);
        const sub = container.children.find(c => c.id === subId);
        if (!sub || !(sub as any)._fullHeight) return;
        const tog = (sub as any)._toggleBox;
        if (tog && Math.abs(tog.transform.rotate) < 0.01) {
          gsap.to(tog.transform, {
            rotate: Math.PI / 2,
            duration: 0.25,
            ease: 'power2.out',
            onUpdate: () => { renderer?.setRoot(renderer!.getRoot()!); },
          });
        }
      },
    });
  });
}