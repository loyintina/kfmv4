/**
 * tree-render.ts — 渲染层
 *
 * 用 kfmv3 v2 引擎渲染 Box 树到 Canvas。
 * 滚动事件 → 写 rootBox.scrollY → 引擎自动处理裁剪/偏移/滚动条。
 * 点击事件 → 光标优先：第一次点击移动光标，第二次点击同一行执行 onTap。
 */

import { buildSidebarTree, getShift } from './tree-model.js';
import { KFMState } from './state.js';
import { anim, AnimTimeline } from './animation-registry.js';
import { animateCharRain } from "./char-rain.js";
import { closeSidebar } from './ui.js';
import { Renderer } from '../engine/v2/renderer.js';
import { L } from './renderer-lifecycle.js';
import { getRootScrollY, setRootScrollY, _rebuildRowIndex, findBoxById } from './canvas-utils.js';
import type { Box } from '../engine/v2/box.js';
import { getCursorRowIndex, getRowIndexLength, moveCursorTo, ensureCursorBox, _moveCursorBySteps, _isCursorMode, _getCenterRowIndex, _snapCursorToCenter, _scrollToCenterCursor } from './canvas-cursor.js';
import { bindScrollEvents } from './canvas-scroll.js';
import { DOM } from "./dom-refs.js";
import { treeAbort } from './abort.js';
const ts = anim.scope('tree-render');

// ========== 点击事件队列 ==========
// 只有 processClickQueue 可消费；外部只能 enqueueClick / clearClickQueue
interface ClickEvent { offsetX: number; offsetY: number; }
const _clickQueue: ClickEvent[] = [];
function enqueueClick(e: ClickEvent): void { _clickQueue.push(e); }
function dequeueClick(): ClickEvent | undefined { return _clickQueue.shift(); }
function clearClickQueue(): void { _clickQueue.length = 0; }
function hasClicks(): boolean { return _clickQueue.length > 0; }

/** 保存 KFMState 订阅引用，防止重复订阅 */
function _ensureSubscribed(): void {
  if (L._stateSub) KFMState.unsubscribe(L._stateSub);
  L._stateSub = () => {
    // state 变化（toggleHidden/expanded）是用户主动行为，跳过 L._animBusy 锁
    L._animBusy = false;
    L._animBusyAt = 0;
    rebuildTree();
  };
  KFMState.subscribe(L._stateSub);
}

/** 外部使用：标记某路径正在做展开动画 */
export function markAnimatingPath(path: string | null): void {
  L.animatingPath = path;
}

export function triggerExpandAnimation(path: string): void {
  const root = L.renderer?.getRoot();
  if (!root) return;
  const container = findBoxById(root, `expanded-${path}`);
  const titleRow = findBoxById(root, `title-${path}`);
  const toggle2 = titleRow?.children?.find(c => c.id?.startsWith('toggle-'));
  
  if (!container) return;
  
  const fullHeight = (container as any)._fullHeight || 0;
  if (!fullHeight) {
    // 空文件夹：播放 toggle 旋转动画（cornerRadius 已由 rebuildTree 归零，无需恢复）
    if (toggle2 && toggle2.transform) {
      toggle2.transform.rotate = 0;
      const startTime = performance.now();
      const endRot = Math.PI / 2;
      const durationMs = 300;
      const rend = L.renderer;
      function animFrame() {
        const elapsed = performance.now() - startTime;
        const t = Math.min(elapsed / durationMs, 1);
        const eased = 1 - (1 - t) * (1 - t);
        toggle2!.transform.rotate = endRot * eased;
        if (rend) rend.setRoot(rend.getRoot()!);
        if (elapsed < durationMs) {
          requestAnimationFrame(animFrame);
        } else {
        }
      }
      requestAnimationFrame(animFrame);
    }
    L.renderer?.setRoot(L.renderer!.getRoot()!);
    return;
  }
  
  L.animatingPath = null;
  
  // 恢复子行原始 y
  const _origYs = (container as any)._origYs as number[] | undefined;
  if (_origYs && container.children.length === _origYs.length) {
    container.children.forEach((c, j) => { c.y = _origYs[j]; });
  }
  container.children.forEach(c => { c.opacity = 1; });
  
  const ancestors = collectAncestors(container, root);
  
  L._animBusy = true; L._animBusyAt = Date.now();

  // 字符雨
  animateCharRain(container, root, L.renderer);

  // 容器展开动画（懒加载路径，需要 root 校验）
  const animRoot2 = L.renderer!.getRoot()!;
  // 容器展开动画
  ts.to(container, {
    height: fullHeight,
    duration: 0.05,
    ease: 'back.out(1.15)',
    onUpdate: function() {
      if (L.renderer?.getRoot() !== animRoot2) return;
      applyAnimOffsetSiblings(container, fullHeight, ancestors, root);
      L.renderer?.setRoot(L.renderer!.getRoot()!);
    },
    onComplete: () => {
      if (L.renderer?.getRoot() !== animRoot2) return;
      // 恢复 cornerRadius
      if (container.kfmStyle && (container as any)._savedCr !== undefined) {
        container.kfmStyle.cornerRadius = (container as any)._savedCr;
      }
      slideInRows(container, root, toggle2).then(() => {
        fixExpandedToggles(container);
        L.renderer?.setRoot(L.renderer!.getRoot()!);
      }).finally(() => {
        L._animBusy = false; L._animBusyAt = 0;
        const _root = L.renderer?.getRoot();
        if (_root) { _rebuildRowIndex(_root); }
        // ä¿®æ­£å¨ç»ååæ çä½ç½®
        if (L.cursorRowId && _root) { const _t = findBoxById(_root, L.cursorRowId); if (_t) moveCursorTo(_t, false); }
        processClickQueue();
      });
    },
  });
  applyAnimOffsetSiblings(container, fullHeight, ancestors, root);
  L.renderer?.setRoot(L.renderer!.getRoot()!);
}

/** 修复容器内所有����展开子容器的 toggle 旋转状态 */
function fixExpandedToggles(container: Box): void {
  const state = KFMState;
  if (!state) return;
  function walk(box: Box): void {
    if (!box.children) return;
    for (const child of box.children) {
      if (child.id?.startsWith('expanded-')) {
        const path = child.id.slice('expanded-'.length);
        if (state.expandedPaths[path]) {
          // 这个子容器是展开状态，找到它的 toggle 并设为 90°
          const titleRow = findBoxByIdLocal(child.parent, `title-${path}`);
          const tog = titleRow?.children?.find(c => c.id?.startsWith('toggle-'));
          if (tog) {
            anim.killTweensOf(tog.transform);
            tog.transform.rotate = Math.PI / 2;
          }
        }
      }
      walk(child);
    }
  }
  walk(container);
}

function findBoxByIdLocal(root: Box | null, id: string): Box | null {
  if (!root) return null;
  if (root.id === id) return root;
  if (root.children) {
    for (const c of root.children) {
      const found = findBoxByIdLocal(c, id);
      if (found) return found;
    }
  }
  return null;
}
export function isAnimLocked(): boolean {
  return L._animBusy;
}

// ============================================================
// 光标状态
// ============================================================

// 光标步进模式 —— 行索引（按绝对 Y 坐标排序的可交互行）

// ===== 事件堆栈 + 会话隔离 =====
// 会话隔离：每次开/关侧栏递增 L._sessionId，旧会话异步操作自动失效
// 事件堆栈：同一会话内快速点击串行执行

export function onSidebarOpen(): void {
  // ===== 销毁旧渲染器 + 通过生命周期重置所有状态 =====
  ts.clear();
  L.renderer?.stop();
  L.renderer = null;
  L.resetForOpen();

  // ===== 从零重建：销毁旧 canvas，创建新渲染器 =====
  const fileTree = DOM.fileTree;
  if (!fileTree) return;

  const canvas = document.createElement('canvas');
  canvas.id = 'tree-canvas';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';

  fileTree.innerHTML = '';          // 彻底销毁旧 DOM（包括旧 canvas）
  fileTree.appendChild(canvas);

  const dpr = window.devicePixelRatio || 1;
  L.renderer = new Renderer(canvas, {
    backgroundColor: 'rgba(10,10,15,0.85)',
    dpr,
  });

  // 等 CSS layout 完成后再 rebuildTree（canvas 刚创建时 clientWidth=0）
  requestAnimationFrame(() => {
    rebuildTree();
    // rebuildTree 后强制恢复 scrollY（在所有可能覆盖它的逻辑之后）
    if (L._savedScrollY > 0) {
      const root = L.renderer?.getRoot();
      if (root) {
        const maxY = root.getMaxScroll().maxY;
        root.scrollY = Math.min(L._savedScrollY, maxY);
        // 实验日志：写到页面上可见
        const savedVal = root.scrollY;
        L._savedScrollY = 0;
        L._restoreMode = true;
        setTimeout(() => {
          L._restoreMode = false;
          // 最终检查：如果 scrollY 被覆盖了，强制恢复
          const r2 = L.renderer?.getRoot();
          if (r2 && Math.abs(r2.scrollY - savedVal) > 10) {
            r2.scrollY = savedVal;
          }
          // 最终状态日志
        }, 500);
      }
    }
    L._restoringFromSave = false;
    L.renderer?.resize();
    window.__treeRenderer = L.renderer;

    _ensureSubscribed();
    window.addEventListener('resize', () => L.renderer?.resize());

    bindScrollEvents(canvas);
    bindClickEvents(canvas, dpr);

    // 创建左栏右侧触摸盒子
    _createSidebarTouchArea();
  });

  // 等侧栏 CSS 过渡结束后再 resize 一次
  const sidebar = DOM.sidebar;
  if (sidebar) {
    const onEnd = () => {
      sidebar.removeEventListener('transitionend', onEnd);
      L.renderer?.resize();
    };
    sidebar.addEventListener('transitionend', onEnd);
  }
}

export function onSidebarClose(): void {
  // 先停掉所有动画和独立rAF循环
  ts.clear();
  L._sidebarClosed = true;  // 让wheel/touch的rAF循环自己退出
  L._animBusy = false;
  L._animBusyAt = 0;
  L._restoringFromSave = true;
  // 直接保存当前 scrollY（动画停止后的稳定值）
  const rootScrollY = L.renderer?.getRoot()?.scrollY ?? 0;
  // 关键：只有 L.renderer 存在时才保存，避免用 0/null 覆盖正确的值
  if (L.renderer && L.renderer.getRoot()) {
    L._savedScrollY = rootScrollY;
    L._savedCursorRowId = L.cursorRowId;
  }
  clearClickQueue();
  L.cursorBox = null;
  L.cursorRowId = null;
  L._rowIndex = [];
  L.renderer?.stop();
  L.renderer = null;
  DOM.sidebarTouchArea?.remove();
  L.cancelAllRafs();
}

export function initTreeRenderer(): void {
  const fileTree = DOM.fileTree;
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
  L.renderer = new Renderer(canvas, {
    backgroundColor: 'rgba(10,10,15,0.85)',
    dpr,
  });

  rebuildTree();

  // 暴露到 window 供调试
  window.__treeRenderer = L.renderer;

  _ensureSubscribed();
  window.addEventListener('resize', () => L.renderer?.resize());

  bindScrollEvents(canvas);
  bindClickEvents(canvas, dpr);
}


/** 创建左栏右侧触摸盒子：填充剩余屏幕，同步滚动 + 点击执行光标动作 + 右往左滑关闭 */
function _createSidebarTouchArea(): void {
  const old = DOM.sidebarTouchArea;
  if (old) old.remove();

  const sidebar = DOM.sidebar;
  if (!sidebar) return;

  const box = document.createElement('div');
  box.id = 'sidebarTouchArea';
  const w = sidebar.getBoundingClientRect().width;
  box.style.cssText = `position:fixed;top:0;bottom:0;right:0;z-index:999;touch-action:none;left:${w}px;`;
  document.body.appendChild(box);

  // 绑定��样的滚动事件（wheel + touch）
  bindScrollEvents(box);

  // 点击任意位置 → 执行���前光标行的动作
  box.addEventListener('click', () => {
    if (!L.cursorRowId || L._rowIndex.length === 0) return;
    const idx = getCursorRowIndex();
    if (idx < 0 || !L._rowIndex[idx]) return;
    const hit = L._rowIndex[idx]!;
    const hitData = (hit as any).data || {};
    if (hitData.isDir) {
      if (hitData.isExpanded) { doCollapse(hit, hitData); }
      else { doExpand(hit, hitData); }
    } else {
      hit.gesture?.onTap?.();
    }
  });

  // 右往左滑 → 关闭左栏
  let sx = 0;
  box.addEventListener('touchstart', (e) => {
    sx = e.touches[0].clientX;
  }, { passive: true });
  box.addEventListener('touchend', (e) => {
    if (sx - e.changedTouches[0].clientX > 60) closeSidebar();
  });
}

function bindClickEvents(canvas: HTMLElement, _dpr: number): void {
  canvas.addEventListener('click', (e) => {
    if (!L.renderer) return;

    enqueueClick({ offsetX: e.offsetX, offsetY: e.offsetY });
    processClickQueue();
  });
}

/**
 * 事件堆栈核心：逐一处理点击队列。
 * 每次处理一个点击，如果是展开/折叠则启动动画，
 * 动画�������成后自动处理队列中下一个点击。
 */
function processClickQueue(): void {
  if (!hasClicks() || !L.renderer) return;

  // 动画进行中收到点击 → ����当前动画，立即响应
  if (L._animBusy) {
    if (L._animBusyAt && Date.now() - L._animBusyAt > 3000) {
      // 超��������底：强制释放
      L._animBusy = false;
      L._animBusyAt = 0;
      clearClickQueue();
      return;
    }
    // 中断 GSAP 动画，重建干净������即����理队列中的点击
    ts.clear();
    L._animBusy = false;
    L._animBusyAt = 0;
    L.animatingPath = null;
    rebuildTree();
  }

  const { offsetX, offsetY } = dequeueClick()!;
  const root = L.renderer.getRoot();
  if (!root) return;
  const scrollY = root.scrollY ?? 0;
  const px = offsetX;
  const py = offsetY + scrollY;

  for (const child of root.children) {
    if (!child.visible || child.disabled) continue;
    const hit = findTapTarget(child, px, py);
    if (hit?.gesture?.onTap) {
      // 光标逻辑：第一次点击移动光标，第二次同一行才执行
      if (L.cursorRowId !== null && L.cursorRowId === hit.id) {
        const hitData = (hit as any).data || {};
        const isDir = hitData.isDir;
        const isExpanded = hitData.isExpanded;
        if (isDir) {
          if (isExpanded) {
            console.log('[processClickQueue] doCollapse path=', hitData.path);
            doCollapse(hit, hitData);
          } else {
            console.log('[processClickQueue] doExpand path=', hitData.path);
            doExpand(hit, hitData);
          }
          return;  // 动画函数完成后会 processClickQueue()
        } else {
          hit.gesture.onTap();
        }
      } else {
        moveCursorTo(hit);
        _scrollToCenterCursor();
      }
      break;
    }
  }
  // �����������动画操作，继续处理队列
  processClickQueue();
}

/** 展开动画 */
function doExpand(hit: Box, hitData: any): void {
  L.animatingPath = hitData.path;
  hit.gesture!.onTap!();  // 切换状态 → rebuildTree（检查 L.animatingPath，预置 height=0）

  // rebuildTree 已完成，启动动画
  L._animBusy = true; L._animBusyAt = Date.now();
  const root = L.renderer!.getRoot()!;
  const containerId = `expanded-${hitData.path}`;
  const container = findBoxById(root, containerId);
  const titleRow = findBoxById(root, `title-${hitData.path}`);
  const toggle2 = titleRow?.children?.find(c => c.id?.startsWith('toggle-'));

  // 容器不存在：懒加载尚未完成，由 loadAndAnimate 异步处理
  if (!container) {
    L._animBusy = false; L._animBusyAt = 0;
    processClickQueue();
    return;
  }

  const fullHeight = (container as any)._fullHeight || 0;
  if (!fullHeight) {
    // 空文件夹：RAF 驱动 toggle 旋转动画
    const finish = () => {
      L._animBusy = false; L._animBusyAt = 0;
      processClickQueue();
    };
    if (toggle2 && toggle2.transform) {
      toggle2.transform.rotate = 0;
      const startTime = performance.now();
      const startRot = 0;
      const endRot = Math.PI / 2;
      const durationMs = 300;
      const rend = L.renderer;
      function animFrame() {
        const elapsed = performance.now() - startTime;
        const t = Math.min(elapsed / durationMs, 1);
        const eased = 1 - (1 - t) * (1 - t);
        toggle2!.transform.rotate = startRot + (endRot - startRot) * eased;
        if (rend) rend.setRoot(rend.getRoot()!);
        if (elapsed < durationMs) {
          requestAnimationFrame(animFrame);
        } else {
          finish();
        }
      }
      requestAnimationFrame(animFrame);
    } else {
      finish();
    }
    return;
  }

  L.animatingPath = null;

  // 恢复子行原始 y
  const _origYs = (container as any)._origYs as number[] | undefined;
  if (_origYs && container.children.length === _origYs.length) {
    container.children.forEach((c, j) => { c.y = _origYs[j]; });
  }
  container.children.forEach(c => { c.opacity = 1; });

  const ancestors = collectAncestors(container, root);

  // 字符雨（fire-and-forget，不阻塞队列）
  animateCharRain(container, root, L.renderer);

  // 容器展开 + 兄弟偏移
  const animRoot = L.renderer!.getRoot()!;
  ts.to(container, {
    height: fullHeight,
    duration: 0.05,
    ease: 'back.out(1.15)',
    onUpdate: function() {
      if (L.renderer?.getRoot() !== animRoot) return;
      applyAnimOffsetSiblings(container, fullHeight, ancestors, root);
      L.renderer?.setRoot(L.renderer!.getRoot()!);
    },
    onComplete: () => {
      if (L.renderer?.getRoot() !== animRoot) return;
      // 恢�� cornerRadius
      if (container.kfmStyle && (container as any)._savedCr !== undefined) {
        container.kfmStyle.cornerRadius = (container as any)._savedCr;
      }
      slideInRows(container, root, toggle2).then(() => {
        // 修复��有子容器 toggle 状态
        fixExpandedToggles(container);
        L.renderer?.setRoot(L.renderer!.getRoot()!);
      }).finally(() => {
        L._animBusy = false; L._animBusyAt = 0;
        const _root = L.renderer?.getRoot();
        if (_root) { _rebuildRowIndex(_root); }
        // ä¿®æ­£å¨ç»åå�� çä½ç½®
        if (L.cursorRowId && _root) { const _t = findBoxById(_root, L.cursorRowId); if (_t) moveCursorTo(_t, false); }
        processClickQueue();
      });
    },
  });
  // 首帧偏移
  applyAnimOffsetSiblings(container, fullHeight, ancestors, root);
  L.renderer?.setRoot(L.renderer!.getRoot()!);
}

/** 折叠动画 */
function doCollapse(hit: Box, hitData: any): void {
  L.animatingPath = hitData.path;
  const tog = hit.children.find(c => c.id?.startsWith('toggle-'));
  const containerId = `expanded-${hitData.path}`;
  const root = L.renderer!.getRoot()!;
  const container = findBoxById(root, containerId);

  L._animBusy = true; L._animBusyAt = Date.now();

  const animRoot = L.renderer!.getRoot()!;
  const tl = anim.timeline({
    onComplete: () => {
      if (L.renderer?.getRoot() !== animRoot) return;
      L._animBusy = false; L._animBusyAt = 0;
      hit.gesture!.onTap!();
      processClickQueue();
    },
  });

  if (tog) {
    tl.to(tog.transform, {
      rotate: 0,
      duration: 0.25,
      ease: 'power2.in',
      onUpdate: () => { if (L.renderer?.getRoot() === animRoot) L.renderer.setRoot(L.renderer.getRoot()!); },
    }, 0);
  }

  if (container) {
    const fullH = container.height;
    const root2 = L.renderer!.getRoot()!;
    const origYs = container.children.map(c => c.y);
    const ancestors = collectAncestors(container, root2);
    tl.to(container, {
      height: 0,
      duration: 0.3,
      ease: 'power2.in',
      onUpdate: function() {
        if (L.renderer?.getRoot() !== animRoot) return;
        applyAnimOffset(container, origYs, fullH, ancestors, root2);
        L.renderer?.setRoot(L.renderer!.getRoot()!);
      },
    }, 0);
  }

  ts.add(tl, 0);
}

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

/** 强制重建树（跳过 L._animBusy 锁，用于眼睛图标��用户主动行为） */
export function forceRebuildTree(): void {
  L._animBusy = false;
  L._animBusyAt = 0;
  clearClickQueue();
  rebuildTree();
}

function rebuildTree(): void {
  if (!L.renderer) return;
  if (L._animBusy) {
    // 超���兜底：超过 3000ms 自动释��
    if (L._animBusyAt && Date.now() - L._animBusyAt > 3000) {
      L._animBusy = false;
      L._animBusyAt = 0;
      clearClickQueue();  // ����队列防死循环
    } else {
      return;
    }
  }

  // 保存当前滚动位置和����标行
  const prevScrollY = L.renderer.getRoot()?.scrollY ?? 0;
  const prevCursorRowId = L.cursorRowId;
   // 动画重建时，保存旧光标位置以保持视觉稳定
  const prevCursorX = L.cursorBox?.x ?? -1;
  const prevCursorY = L.cursorBox?.y ?? -1;
  const prevCursorW = L.cursorBox?.width ?? -1;
  const prevCursorH = L.cursorBox?.height ?? -1;
  const prevCursorTopLine = (L.cursorBox as any)?.data?.topLineW ?? -1;
  const prevCursorBotLine = (L.cursorBox as any)?.data?.botLineW ?? -1;

  // 重置光标实例（旧 root 销毁后 L.cursorBox ��向的 Box 已无���）
  L.cursorBox = null;
  L.cursorRowId = null;

  const canvas = DOM.treeCanvas;
  const cw = (canvas?.clientWidth ?? 0) || 295;  // 动态宽度（|| 兜底 clientWidth=0 的��况）
  const rightMargin = cw - 8;              // 行右边界 = 画布宽��� - 8px ���白
  const rootBox = buildSidebarTree(cw, rightMargin);
  // 让 rootBox ��实际����=canvas 宽度（扩大裁剪区域），但内部盒��保��相应比例
  if (canvas) rootBox.width = cw;
  const canvasH = (canvas?.clientHeight ?? 0) || 618;
  if (canvas) {
    rootBox.height = canvasH;
  }

  // ��� setRoot 之前，把 L.animatingPath 的 toggle 强行归零并提交��
  // 盖掉 buildExpanded ������� 90°，避免第一帧闪烁
  if (L.animatingPath) {
    const titleRow = findBoxById(rootBox, `title-${L.animatingPath}`);
    const toggle = titleRow?.children?.find(c => c.id?.startsWith('toggle-'));
    if (toggle) {
      toggle.transform.rotate = 0;
      // 不提前调用 setRoot，等容器后处理完成后再统一提交
    }
  }

  // 在 setRoot 之前预设动画初始状态，避免满高一帧闪烁
  // 递归折���所有已展开子容器，���保展开动画期间内容不可见
  function collapseSubs(box: any): void {
    if (!box || !box.children) return;
    for (const child of box.children) {
      if (child.id?.startsWith('expanded-') && child.height > 0) {
        // 跳过当前正在做展开动画的容器——动画块自己会处理 toggle 旋转
        if (L.animatingPath && child.id === `expanded-${L.animatingPath}`) continue;
        const subFullH = child.height;
        (child as any)._fullHeight = subFullH;
        (child as any)._origYs = child.children.map((c: any) => c.y);
        child.height = 0;
        // Save and zero cornerRadius to prevent overlapping rounded corners
        if (child.kfmStyle) {
          (child as any)._savedCr = child.kfmStyle.cornerRadius;
          child.kfmStyle.cornerRadius = 0;
        }
        for (const c of child.children) { c.y = c.y - subFullH; }
        // save toggle reference for cascade expand later
        const subPath = child.id.slice("expanded-".length);
        const subTitle = findBoxById(rootBox, "title-" + subPath);
        const subTog = subTitle?.children?.find((c: any) => c.id?.startsWith("toggle-"));
        if (subTog) {
          (child as any)._toggleBox = subTog;
          (child as any)._toggleRotate = subTog.transform.rotate; // 保存原始旋转状态
        }
        collapseSubs(child);
      }
    }
  }
  if (L.animatingPath) {
    const preContainer = findBoxById(rootBox, `expanded-${L.animatingPath}`);
    if (preContainer) {
      const preFullH = preContainer.height;
      (preContainer as any)._fullHeight = preFullH;
      (preContainer as any)._origYs = preContainer.children.map((c: any) => c.y);
      preContainer.height = 0;
      if (preContainer.kfmStyle) {
        (preContainer as any)._savedCr = preContainer.kfmStyle.cornerRadius;
        preContainer.kfmStyle.cornerRadius = 0;
      }
      for (const child of preContainer.children) { child.y = child.y - preFullH; child.opacity = 0; }
      // 递归折叠内部已展开的子容器
      collapseSubs(preContainer);
    }
  }

  L.renderer.setRoot(rootBox);

  // 恢复滚动位置（从关闭���态恢复时，L._savedScrollY 在下游统一处理，此处跳过）
  const newRoot = L.renderer.getRoot();
  if (!L._restoringFromSave && newRoot && prevScrollY > 0) {
    const maxY = newRoot.getMaxScroll().maxY;
    newRoot.scrollY = Math.min(prevScrollY, maxY);
  }

  // 【关键】从关闭状态恢复时，先恢复 scrollY，再让光标逻辑基于恢复后的位置工作
  // 注意：第一次rebuildTree时_isCursorMode=true,maxY=0,恢复会失败
  // 不在这里消耗_savedScrollY，等rAF回调中的强制恢复
  if (L._restoringFromSave) {
    L._restoringFromSave = false;  // 只消耗标志，不消耗_savedScrollY
  }

  // ���新创建光标
  if (newRoot) {
    ensureCursorBox(newRoot, canvasH);

    if (prevCursorRowId) {
      // 尝试恢复光���到之前的行
      const target = findBoxById(newRoot, prevCursorRowId);
      if (target) {
        if (L.animatingPath && prevCursorY >= 0) {
          // ä¿æåæ çè§è§ä½ç½®ï¼ä¸è·éè¢« collapseSubs ä¸ç§»çè¡
          L.cursorBox!.x = prevCursorX;
          L.cursorBox!.y = prevCursorY;
          L.cursorBox!.width = prevCursorW;
          if (prevCursorH >= 0) { L.cursorBox!.height = prevCursorH; }
          if (prevCursorTopLine >= 0) { (L.cursorBox as any).data.topLineW = prevCursorTopLine; }
          if (prevCursorBotLine >= 0) { (L.cursorBox as any).data.botLineW = prevCursorBotLine; }
          L.cursorRowId = prevCursorRowId;
        } else {
          moveCursorTo(target);
        }
      } else {
        snapToCenterRow(newRoot, canvasH);
      }
    } else {
      // 初始状态：光标居中吸附
      snapToCenterRow(newRoot, canvasH);
    }
  }

  // 重建光标步进行索引
  if (newRoot) _rebuildRowIndex(newRoot);

  if (!L.renderer.isRunning) {
    L.renderer.start();
  }

  // 清空 L.animatingPath，防止后续 rebuildTree 读到脏值
  L.animatingPath = null;
  // 通知所有持有旧 token 的 async 动画中止
  treeAbort.cancel();

  // [DIAG] 展开/折叠后光标状态追踪
  const diagRoot = L.renderer?.getRoot();
  const diagCS = diagRoot?.getContentSize();
  console.log('[rebuildTree] _isCursorMode=', _isCursorMode(),
    ' scrollY=', diagRoot?.scrollY,
    ' contentH=', diagCS?.height,
    ' viewportH=', (diagRoot?.height || 0),
    ' maxY=', diagRoot?.getMaxScroll().maxY,
    ' _rowIndexLen=', L._rowIndex.length,
    ' L.cursorRowId=', L.cursorRowId,
    ' cursorIdx=', getCursorRowIndex(),
    ' prevCursorRowId=', prevCursorRowId,
    ' L.animatingPath=', L.animatingPath);
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
    if (p === root) break;  // 到 root 为e止��含 root 层）
    current = p;
  }
  return ancestors;
}

/** 在动画每帧调用：偏��目标容器内部子项 + 所有祖先层的后续兄弟 + 调整祖���高度 */
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
  // 2) 逐层祖先：偏移后续兄弟 + 调整父容器高度���root ���外）
  let heightDelta = offset;
  for (const anc of ancestors) {
    // 偏移后续兄弟
    for (let i = anc.sibIdx + 1; i < anc.parent.children.length; i++) {
      const sib = anc.parent.children[i];
      if (sib.id === 'cursor-highlight') continue;
      sib.y = anc.sibOrigYs[i - anc.sibIdx - 1] + heightDelta;
    }
    // ��整祖�����度（root ��调，它是画布高度）
    if (anc.parent !== root) {
      anc.parent.height = anc.origHeight + heightDelta;
    }
  }
}

/** 只���兄弟偏移+祖先高��调整，不碰子行 y（用于展开动画，让 slideInRows 统��处理子行登���） */
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
 * SlideInRows: 收集容器内直接子行，��部上移隐藏��再逐行用 translateY 滑下。
 * 盒子链串行展开子容器，每个子容器展开后递归调用自身。
 */
async function slideInRows(container: Box, root: Box, selfToggle?: any): Promise<void> {
  const token = treeAbort.start();
  // ========== current toggle rotation ==========
  if (selfToggle) {
    anim.fromTo(selfToggle.transform, { rotate: 0 }, {
      rotate: Math.PI / 2,
      duration: 0.15,
      ease: 'power2.out',
      onUpdate: () => { L.renderer?.setRoot(L.renderer!.getRoot()!); },
    });
  }

  // ========== sub-container serial expansion ==========
  const subContainers = container.children.filter(
    c => c.id?.startsWith('expanded-') && (c as any)._fullHeight > 0
  );
  async function expandNext(idx: number): Promise<void> {
    if (idx >= subContainers.length) return;
    const child = subContainers[idx];
    const subFullH = (child as any)._fullHeight;
    // restore y positions, launch char rain at t=0 parallel with sub-container expansion
    const subOrigYs = (child as any)._origYs as number[] | undefined;
    if (subOrigYs && child.children.length === subOrigYs.length) {
      child.children.forEach((c, j) => { c.y = subOrigYs[j]; });
    }
    child.children.forEach(c => { c.opacity = 1; });
    // 子���器的 toggle 直接设置为最终状态（已展开为 90��）
    const subTog = (child as any)._toggleBox;
    const subTogRotate = (child as any)._toggleRotate ?? Math.PI / 2;
    // ��当前 root 重新查找 toggle，确保引�����确
    const freshTitle = findBoxById(root, `title-${child.id.slice('expanded-'.length)}`);
    const freshTog = freshTitle?.children?.find((c: any) => c.id?.startsWith('toggle-'));
    if (freshTog) {
      anim.killTweensOf(freshTog.transform);
      freshTog.transform.rotate = subTogRotate;
    }
    animateCharRain(child, root, L.renderer);
    await new Promise<void>(resolve => {
      anim.to(child, {
        height: subFullH,
        duration: 0.05,
        ease: 'back.out(1.15)',
        onUpdate: () => { L.renderer?.setRoot(L.renderer!.getRoot()!); },
        onComplete: resolve,
      });
    });
    // root check: bail if tree was rebuilt mid-animation
    if (treeAbort.isCancelled(token)) return;
    if (child.kfmStyle && (child as any)._savedCr !== undefined) {
      child.kfmStyle.cornerRadius = (child as any)._savedCr;
    }
    await slideInRows(child, root);
    if (treeAbort.isCancelled(token)) return;
    await expandNext(idx + 1);
  }
  await expandNext(0);
  if (treeAbort.isCancelled(token)) return;
}

// ============================================================
// 调试面板已删除