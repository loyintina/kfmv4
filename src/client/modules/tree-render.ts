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
import { animateCharRain } from "./char-rain.js";

let renderer: Renderer | null = null;

/** 保存 KFMState 订阅引用，防止重复订阅 */
let _stateSub: ((state: any) => void) | null = null;
function _ensureSubscribed(): void {
  if (_stateSub) KFMState.unsubscribe(_stateSub);
  _stateSub = () => rebuildTree();
  KFMState.subscribe(_stateSub);
}

/** 外部使用：标记某路径正在做展开动画 */
export function markAnimatingPath(path: string | null): void {
  animatingPath = path;
}

export function triggerExpandAnimation(path: string): void {
  const root = renderer?.getRoot();
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
      const rend = renderer;
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
    renderer?.setRoot(renderer!.getRoot()!);
    return;
  }
  
  animatingPath = null;
  
  // 恢复子行原始 y
  const _origYs = (container as any)._origYs as number[] | undefined;
  if (_origYs && container.children.length === _origYs.length) {
    container.children.forEach((c, j) => { c.y = _origYs[j]; });
  }
  container.children.forEach(c => { c.opacity = 1; });
  
  const ancestors = collectAncestors(container, root);
  
  _animBusy = true; _animBusyAt = Date.now();

  // 字符雨
  animateCharRain(container, root, renderer);
  
  // 容器展开动画
  gsap.to(container, {
    height: fullHeight,
    duration: 0.05,
    ease: 'back.out(1.15)',
    onUpdate: function() {
      applyAnimOffsetSiblings(container, fullHeight, ancestors, root);
      renderer?.setRoot(renderer!.getRoot()!);
    },
    onComplete: () => {
      // 恢复 cornerRadius
      if (container.kfmStyle && (container as any)._savedCr !== undefined) {
        container.kfmStyle.cornerRadius = (container as any)._savedCr;
      }
      slideInRows(container, root, toggle2).then(() => {
        fixExpandedToggles(container);
        renderer?.setRoot(renderer!.getRoot()!);
      }).finally(() => {
        _animBusy = false; _animBusyAt = 0;
        processClickQueue();
      });
    },
  });
  applyAnimOffsetSiblings(container, fullHeight, ancestors, root);
  renderer?.setRoot(renderer!.getRoot()!);
}

/** 修复容器内所有已展开子容器的 toggle 旋转状态 */
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
            gsap.killTweensOf(tog.transform);
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
  return _animBusy;
}

// ============================================================
// 光标状态
// ============================================================

let cursorBox: Box | null = null;   // 光标 Box 实例
let cursorRowId: string | null = null;  // 当前光标指向的行 id

// 光标步进模式 —— 行索引（按绝对 Y 坐标排序的可交互行）
let _rowIndex: Box[] = [];

// ===== 事件堆栈 + 会话隔离 =====
// 会话隔离：每次开/关侧栏递增 _sessionId，旧会话异步操作自动失效
// 事件堆栈：同一会话内快速点击串行执行
let _sessionId = 0;
export function getSession(): number { return _sessionId; }

let animatingPath: string | null = null;
let _animBusy = false;
let _animBusyAt = 0;
let pendingCollapse: { path: string, rowId: string } | null = null;
let _clickQueue: Array<{offsetX: number, offsetY: number}> = [];

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

/** 移动光标到指定行（GSAP 平滑过渡） */
function moveCursorTo(hitBox: Box, animate = true): void {
  if (!cursorBox) return;
  const abs = hitBox.getAbsolutePosition();
  const canvas = document.getElementById('tree-canvas');

  const depth = (hitBox as any).data?.depth ?? 0;
  const shift = getShift(depth);
  const offsetX = shift / 2;

  const rm = (canvas?.clientWidth ?? 295) - 8;
  const targetX = abs.x + offsetX;
  const targetY = abs.y + 2;
  const targetW = rm - abs.x - offsetX;
  const targetH = hitBox.height - 4;
  cursorRowId = hitBox.id || null;

  // 测量文字宽度，计算上下线长度
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
        const prepared = prepareWithSegments(content, font);
        const { lines } = layoutWithLines(prepared, maxWidth, LINE_HEIGHT);
        const firstLine = lines[0];
        let renderWidth = firstLine.width;
        if (lines.length > 1 && label.textStyle.overflow === 'ellipsis') {
          const truncated = firstLine.text.slice(0, -1) + '…';
          ctx2d.font = font;
          renderWidth = ctx2d.measureText(truncated).width;
        }
        textW = labelX + renderWidth;
      } catch {
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
  const totalLineW = targetW;
  const topLineW = Math.min(Math.max(textW, 20), totalLineW - 10);
  const botLineW = totalLineW - topLineW;

  // 确保 data 对象存在（不替换，直接在属性上做动画）
  const cdata = (cursorBox as any).data;
  if (cdata) {
    cdata.cursorDynamicLines = true;
    cdata.color = 'rgba(0,212,255,0.7)';
  }

  if (animate && cdata) {
    // GSAP 平滑过渡：位置/尺寸 + 上线长度
    // 不 kill 旧动画——让 GSAP 自动衔接连续的目标变更，避免视觉跳动
    gsap.to(cursorBox, {
      x: targetX, y: targetY, width: targetW, height: targetH,
      duration: 0.18, ease: 'power3.out',
      overwrite: 'auto',
    });
    gsap.to(cdata, {
      topLineW, botLineW,
      duration: 0.18, ease: 'power3.out',
      overwrite: 'auto',
    });
  } else {
    // 瞬移模式（初始放置等场景）
    cursorBox.x = targetX;
    cursorBox.y = targetY;
    cursorBox.width = targetW;
    cursorBox.height = targetH;
    if (cdata) {
      cdata.topLineW = topLineW;
      cdata.botLineW = botLineW;
    }
  }
}

// ============================================================

export function onSidebarOpen(): void {
  // ===== 销毁旧渲染器和所有残留状态 =====
  _sessionId++;
  _animBusy = false;
  _animBusyAt = 0;
  animatingPath = null;
  _clickQueue = [];
  cursorBox = null;
  cursorRowId = null;
  _rowIndex = [];
  pendingCollapse = null;
  gsap.globalTimeline.clear();
  renderer?.stop();
  renderer = null;

  // ===== 从零重建：销毁旧 canvas，创建新渲染器 =====
  const fileTree = document.getElementById('fileTree');
  if (!fileTree) return;

  const canvas = document.createElement('canvas');
  canvas.id = 'tree-canvas';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';

  fileTree.innerHTML = '';          // 彻底销毁旧 DOM（包括旧 canvas）
  fileTree.appendChild(canvas);

  const dpr = window.devicePixelRatio || 1;
  renderer = new Renderer(canvas, {
    backgroundColor: 'rgba(10,10,15,0.85)',
    dpr,
  });

  // 等 CSS layout 完成后再 rebuildTree（canvas 刚创建时 clientWidth=0）
  requestAnimationFrame(() => {
    rebuildTree();
    renderer?.resize();
    (window as any).__treeRenderer = renderer;

    _ensureSubscribed();
    styleRegistry.subscribe(() => rebuildTree());
    window.addEventListener('resize', () => renderer?.resize());

    bindScrollEvents(canvas, document.getElementById('main') ?? void 0);
    bindClickEvents(canvas, dpr, document.getElementById('main') ?? void 0);
  });

  // 等侧栏 CSS 过渡结束后再 resize 一次
  const sidebar = document.getElementById('sidebar');
  if (sidebar) {
    const onEnd = () => {
      sidebar.removeEventListener('transitionend', onEnd);
      renderer?.resize();
    };
    sidebar.addEventListener('transitionend', onEnd);
  }
}

export function onSidebarClose(): void {
  // 同样销毁一切——确保没有残留状态
  _sessionId++;
  gsap.globalTimeline.clear();
  _animBusy = false;
  _animBusyAt = 0;
  animatingPath = null;
  pendingCollapse = null;
  _clickQueue = [];
  cursorBox = null;
  cursorRowId = null;
  _rowIndex = [];
  renderer?.stop();
  renderer = null;
}

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

  _ensureSubscribed();
  styleRegistry.subscribe(() => rebuildTree());
  window.addEventListener('resize', () => renderer?.resize());

  bindScrollEvents(canvas, document.getElementById('main') ?? void 0);
  bindClickEvents(canvas, dpr, document.getElementById('main') ?? void 0);
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

// ============================================================
// 光标步进辅助函数
// ============================================================

/** 重建行索引：遍历树收集所有可交互行，按绝对 Y 排序 */
function _rebuildRowIndex(root: Box): void {
  _rowIndex = [];
  function walk(box: Box): void {
    for (const child of box.children) {
      if (!child.visible || child.disabled) continue;
      if (child.interactive && child.gesture?.onTap) {
        _rowIndex.push(child);
      }
      walk(child);
    }
  }
  walk(root);
  _rowIndex.sort((a, b) => {
    return a.getAbsolutePosition().y - b.getAbsolutePosition().y;
  });
}

/** 获取当前光标在行索引中的位置 */
function _getCursorRowIndex(): number {
  if (!cursorRowId || _rowIndex.length === 0) return -1;
  return _rowIndex.findIndex(box => box.id === cursorRowId);
}

/** 移动光标 N 步（正=向下，负=向上），自动 clamp */
function _moveCursorBySteps(steps: number): void {
  if (_rowIndex.length === 0) return;
  const oldIdx = _getCursorRowIndex();
  const newIdx = Math.max(0, Math.min(_rowIndex.length - 1, oldIdx + steps));
  if (newIdx !== oldIdx && _rowIndex[newIdx]) {
    moveCursorTo(_rowIndex[newIdx]);
  }
}

/** 判断当前是否光标模式（内容高度 <= 视口高度，无溢出） */
function _isCursorMode(): boolean {
  const root = renderer?.getRoot();
  if (!root) return false;
  return root.getMaxScroll().maxY <= 0;
}

/** 获取视口中央最近行的索引（在 _rowIndex 中的位置） */
function _getCenterRowIndex(): number {
  const root = renderer?.getRoot();
  if (!root || _rowIndex.length === 0) return -1;
  const canvasH = (document.getElementById('tree-canvas')?.clientHeight ?? 0) || 618;
  const scrollY = root.scrollY ?? 0;
  const centerY = scrollY + canvasH / 2;
  let closestIdx = -1;
  let closestDist = Infinity;
  for (let i = 0; i < _rowIndex.length; i++) {
    const abs = _rowIndex[i].getAbsolutePosition();
    const rowCenter = abs.y + _rowIndex[i].height / 2;
    const dist = Math.abs(rowCenter - centerY);
    if (dist < closestDist) {
      closestDist = dist;
      closestIdx = i;
    }
  }
  return closestIdx;
}

/** 滚动模式下，将光标吸附到视口中央最近的行 */
function _snapCursorToCenter(): void {
  if (_animBusy) return;
  const idx = _getCenterRowIndex();
  if (idx >= 0 && _rowIndex[idx].id !== cursorRowId) {
    moveCursorTo(_rowIndex[idx]);
  }
}

function bindScrollEvents(canvas: HTMLCanvasElement, rightArea?: HTMLElement): void {
  // 记录当前触摸手势属于哪种模式（touchstart 时判定，touchend 时消费）
  let _touchIsCursor = false;

  // ===== Wheel =====
  let wheelTarget = 0;
  let wheelRaf = 0;
  let cursorWheelAccum = 0;
  let cursorWheelDecayRaf = 0;

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (_isCursorMode()) {
      // 光标模式：累积 deltaY 转为步进
      cursorWheelAccum += e.deltaY / LINE_HEIGHT;
      const steps = Math.trunc(cursorWheelAccum);
      if (steps !== 0) {
        _moveCursorBySteps(-steps);  // deltaY>0 向下 → 光标向下（索引增大）
        cursorWheelAccum -= steps;
      }
      // 衰减残余（模拟滚轮惯性）
      if (!cursorWheelDecayRaf) {
        cursorWheelDecayRaf = requestAnimationFrame(function decay() {
          cursorWheelAccum *= 0.85;
          const s = Math.trunc(cursorWheelAccum);
          if (s !== 0) {
            _moveCursorBySteps(-s);
            cursorWheelAccum -= s;
          }
          if (Math.abs(cursorWheelAccum) < 0.05) {
            cursorWheelAccum = 0;
            cursorWheelDecayRaf = 0;
            return;
          }
          cursorWheelDecayRaf = requestAnimationFrame(decay);
        });
      }
      return;
    }
    // 滚动模式（含边界穿透，累积跨帧）
    const cur = getRootScrollY() ?? 0;
    wheelTarget = cur + e.deltaY;
    if (!wheelRaf) {
      let wheelAccum = 0;
      const wheelCenterIdx = _getCenterRowIndex();
      wheelRaf = requestAnimationFrame(function smoothWheel() {
        const cur2 = getRootScrollY() ?? 0;
        const diff = wheelTarget - cur2;
        if (Math.abs(diff) < 0.5) {
          setRootScrollY(wheelTarget);
          _snapCursorToCenter();
          wheelRaf = 0;
          return;
        }
        const maxY = renderer?.getRoot()?.getMaxScroll().maxY ?? 0;
        const desired = cur2 + diff * 0.25;
        if (desired < 0 && maxY > 0) {
          setRootScrollY(0);
          wheelAccum += -desired;
          const steps = Math.floor(wheelAccum / LINE_HEIGHT);
          if (steps > 0) {
            wheelAccum -= steps * LINE_HEIGHT;
            const targetIdx = Math.max(0, wheelCenterIdx - steps);
            if (_rowIndex[targetIdx]) moveCursorTo(_rowIndex[targetIdx]);
          }
        } else if (desired > maxY) {
          setRootScrollY(maxY);
          wheelAccum += desired - maxY;
          const steps = Math.floor(wheelAccum / LINE_HEIGHT);
          if (steps > 0) {
            wheelAccum -= steps * LINE_HEIGHT;
            const targetIdx = Math.min(_rowIndex.length - 1, wheelCenterIdx + steps);
            if (_rowIndex[targetIdx]) moveCursorTo(_rowIndex[targetIdx]);
          }
        } else {
          setRootScrollY(desired);
          _snapCursorToCenter();
        }
        wheelRaf = requestAnimationFrame(smoothWheel);
      });
    }
  }, { passive: false });

  // ===== Touch =====
  // 滚动模式状态
  let touchStartY = 0;
  let touchScrollY = 0;
  let lastTouchY = 0;
  let lastTouchTime = 0;
  let velocity = 0;
  let flingRaf = 0;
  // 边界锁状态：光标偏离中心时锁定滚动，回到中心才解锁
  let _boundPen = 0;       // 穿透深度（像素），>0 表示锁住
  let _boundIsTop = false; // true=上边界锁，false=下边界锁
  // 光标模式状态
  let cursorTouchBase = 0;
  let cursorTouchStartY = 0;
  let cursorLastTouchY = 0;
  let cursorLastTouchTime = 0;
  let cursorVelocity = 0;
  let cursorFlingRaf = 0;

  canvas.addEventListener('touchstart', (e) => {
    const y = e.touches[0].clientY;
    lastTouchY = y;
    lastTouchTime = performance.now();
    // 取消所有进行中的 RAF
    if (flingRaf) { cancelAnimationFrame(flingRaf); flingRaf = 0; }
    if (cursorFlingRaf) { cancelAnimationFrame(cursorFlingRaf); cursorFlingRaf = 0; }

    _touchIsCursor = _isCursorMode();

    if (_touchIsCursor) {
      cursorTouchBase = Math.max(0, _getCursorRowIndex());
      cursorTouchStartY = y;
      cursorLastTouchY = y;
      cursorLastTouchTime = lastTouchTime;
      cursorVelocity = 0;
    } else {
      touchStartY = y;
      touchScrollY = getRootScrollY() ?? 0;
      velocity = 0;
      // 检测边界锁残留：光标因上次手势偏离中心
      _boundPen = 0;
      _boundIsTop = false;
      const root2 = renderer?.getRoot();
      if (root2 && !_isCursorMode()) {
        const maxY2 = root2.getMaxScroll().maxY ?? 0;
        const centerIdx = _getCenterRowIndex();
        const cursorIdx = _getCursorRowIndex();
        if (touchScrollY <= 0 && centerIdx >= 0 && cursorIdx >= 0 && cursorIdx < centerIdx) {
          _boundPen = (centerIdx - cursorIdx) * LINE_HEIGHT;
          _boundIsTop = true;
        } else if (touchScrollY >= maxY2 && centerIdx >= 0 && cursorIdx >= 0 && cursorIdx > centerIdx) {
          _boundPen = (cursorIdx - centerIdx) * LINE_HEIGHT;
          _boundIsTop = false;
        }
      }
    }
  }, { passive: true });

  canvas.addEventListener('touchmove', (e) => {
    const y = e.touches[0].clientY;
    const now = performance.now();

    if (_touchIsCursor) {
      const dy = cursorTouchStartY - y;
      const dt = now - cursorLastTouchTime;
      if (dt > 0) {
        cursorVelocity = (cursorLastTouchY - y) / dt * 16 * 1.7;
      }
      cursorLastTouchY = y;
      cursorLastTouchTime = now;
      const stepOffset = dy / LINE_HEIGHT;
      const idx = Math.round(
        Math.max(0, Math.min(_rowIndex.length - 1, cursorTouchBase + stepOffset))
      );
      if (_rowIndex[idx]) moveCursorTo(_rowIndex[idx]);
      return;
    }

    // 滚动模式（含边界锁状态机）
    const dy = touchStartY - y;
    const dt = now - lastTouchTime;
    if (dt > 0) {
      velocity = (lastTouchY - y) / dt * 16 * 1.7;
    }
    const dPen = lastTouchY - y;  // 逐帧增量：>0=手指上滑
    lastTouchY = y;
    lastTouchTime = now;
    const root3 = renderer?.getRoot();
    const maxY = root3?.getMaxScroll().maxY ?? 0;

    if (_boundPen > 0) {
      // === 边界锁：滚动锁定，手指位移只改变穿透深度 ===
      _boundPen = Math.max(0, _boundPen + (_boundIsTop ? -dPen : dPen));
      if (_boundPen === 0) {
        // 光标回到中心，解锁，重置滚动参考点
        touchScrollY = _boundIsTop ? 0 : maxY;
        touchStartY = y;
        setRootScrollY(touchScrollY);
        _snapCursorToCenter();
      } else {
        setRootScrollY(_boundIsTop ? 0 : maxY);
        const steps = Math.floor(_boundPen / LINE_HEIGHT);
        const centerIdx = _getCenterRowIndex();
        if (centerIdx >= 0 && steps > 0) {
          const targetIdx = _boundIsTop
            ? Math.max(0, centerIdx - steps)
            : Math.min(_rowIndex.length - 1, centerIdx + steps);
          if (_rowIndex[targetIdx]) moveCursorTo(_rowIndex[targetIdx]);
        } else {
          _snapCursorToCenter();
        }
      }
    } else {
      // === 正常滚动 ===
      const desired = touchScrollY + dy;
      if (desired < 0 && maxY > 0) {
        _boundPen = -desired;
        _boundIsTop = true;
        setRootScrollY(0);
        const steps = Math.floor(_boundPen / LINE_HEIGHT);
        const centerIdx = _getCenterRowIndex();
        if (centerIdx >= 0 && steps > 0) {
          const targetIdx = Math.max(0, centerIdx - steps);
          if (_rowIndex[targetIdx]) moveCursorTo(_rowIndex[targetIdx]);
        }
      } else if (desired > maxY) {
        _boundPen = desired - maxY;
        _boundIsTop = false;
        setRootScrollY(maxY);
        const steps = Math.floor(_boundPen / LINE_HEIGHT);
        const centerIdx = _getCenterRowIndex();
        if (centerIdx >= 0 && steps > 0) {
          const targetIdx = Math.min(_rowIndex.length - 1, centerIdx + steps);
          if (_rowIndex[targetIdx]) moveCursorTo(_rowIndex[targetIdx]);
        }
      } else {
        setRootScrollY(desired);
        _snapCursorToCenter();
      }
    }
  }, { passive: true });

  canvas.addEventListener('touchend', () => {
    if (_touchIsCursor) {
      if (Math.abs(cursorVelocity) >= 0.5 && _rowIndex.length > 0) {
        // 将起点更新为当前光标位置，避免飞回 touchstart 位置
        cursorTouchBase = Math.max(0, _getCursorRowIndex());
        function cursorFling() {
          cursorVelocity *= 0.96;
          if (Math.abs(cursorVelocity) < 0.3) { cursorFlingRaf = 0; return; }
          cursorTouchBase += cursorVelocity / LINE_HEIGHT;
          const idx = Math.round(
            Math.max(0, Math.min(_rowIndex.length - 1, cursorTouchBase))
          );
          if (_rowIndex[idx]) moveCursorTo(_rowIndex[idx]);
          cursorFlingRaf = requestAnimationFrame(cursorFling);
        }
        cursorFlingRaf = requestAnimationFrame(cursorFling);
      }
      return;
    }

    // 滚动模式 fling（边界锁：velocity 先消耗穿透深度，归零后才允许滚动）
    if (Math.abs(velocity) < 0.5) return;
    let flingPen = _boundPen;
    let flingIsTop = _boundIsTop;
    const flingMaxY = renderer?.getRoot()?.getMaxScroll().maxY ?? 0;
    function fling() {
      velocity *= 0.96;
      if (Math.abs(velocity) < 0.3) { flingRaf = 0; return; }

      if (flingPen > 0) {
        // 锁状态：velocity 先消耗穿透深度
        flingPen = Math.max(0, flingPen + (flingIsTop ? -velocity : velocity));
        if (flingPen === 0) {
          // 解锁，转为正常滚动
          setRootScrollY(flingIsTop ? 0 : flingMaxY);
          _snapCursorToCenter();
        } else {
          setRootScrollY(flingIsTop ? 0 : flingMaxY);
          const steps = Math.floor(flingPen / LINE_HEIGHT);
          const centerIdx = _getCenterRowIndex(); // 实时获取边界处中央行，不用 touchend 旧值
          if (centerIdx >= 0 && steps > 0) {
            const targetIdx = flingIsTop
              ? Math.max(0, centerIdx - steps)
              : Math.min(_rowIndex.length - 1, centerIdx + steps);
            if (_rowIndex[targetIdx]) moveCursorTo(_rowIndex[targetIdx]);
          }
        }
      } else {
        // 正常滚动 fling
        const cur = getRootScrollY() ?? 0;
        const desired = cur + velocity;
        if (desired < 0 && flingMaxY > 0) {
          flingPen = -desired;
          flingIsTop = true;
          setRootScrollY(0);
          // 首次触碰边界：立刻基于当前中央行做初始光标偏移
          const centerIdx = _getCenterRowIndex();
          const steps = Math.floor(flingPen / LINE_HEIGHT);
          if (centerIdx >= 0 && steps > 0) {
            const targetIdx = Math.max(0, centerIdx - steps);
            if (_rowIndex[targetIdx]) moveCursorTo(_rowIndex[targetIdx]);
          }
        } else if (desired > flingMaxY) {
          flingPen = desired - flingMaxY;
          flingIsTop = false;
          setRootScrollY(flingMaxY);
          // 首次触碰边界：立刻基于当前中央行做初始光标偏移
          const centerIdx = _getCenterRowIndex();
          const steps = Math.floor(flingPen / LINE_HEIGHT);
          if (centerIdx >= 0 && steps > 0) {
            const targetIdx = Math.min(_rowIndex.length - 1, centerIdx + steps);
            if (_rowIndex[targetIdx]) moveCursorTo(_rowIndex[targetIdx]);
          }
        } else {
          setRootScrollY(desired);
          _snapCursorToCenter();
        }
      }
      flingRaf = requestAnimationFrame(fling);
    }
    flingRaf = requestAnimationFrame(fling);
  }, { passive: true });

  // ===== 右侧空白区域事件转发 =====
  // 让左栏右侧空白区域的触摸/滚轮也能控制左栏滚动
  if (rightArea) {
    const touchArray = (tl: TouchList): Touch[] => {
      const a: Touch[] = [];
      for (let i = 0; i < tl.length; i++) a.push(tl[i]!);
      return a;
    };
    rightArea.addEventListener('wheel', (e) => {
      e.preventDefault();
      canvas.dispatchEvent(new WheelEvent('wheel', {
        deltaX: e.deltaX, deltaY: e.deltaY, deltaZ: e.deltaZ,
        deltaMode: e.deltaMode,
        bubbles: false, cancelable: true,
      }));
    }, { passive: false });
    for (const t of ['touchstart', 'touchmove', 'touchend'] as const) {
      rightArea.addEventListener(t, (e: Event) => {
        const te = e as TouchEvent;
        canvas.dispatchEvent(new TouchEvent(t, {
          touches: touchArray(te.touches),
          targetTouches: touchArray(te.targetTouches),
          changedTouches: touchArray(te.changedTouches),
          bubbles: false, cancelable: true,
        }));
      }, { passive: true });
    }
  }
}

// ============================================================
// 点击事件（光标优先 → 二次点击执行 onTap��
// ============================================================

function bindClickEvents(canvas: HTMLCanvasElement, _dpr: number, rightArea?: HTMLElement): void {
  canvas.addEventListener('click', (e) => {
    if (!renderer) return;

    _clickQueue.push({ offsetX: e.offsetX, offsetY: e.offsetY });
    processClickQueue();
  });

  // 右侧空白区域点击 → 转换为 canvas 本地坐标
  if (rightArea) {
    rightArea.addEventListener('click', (e) => {
      if (!renderer) return;
      const rect = canvas.getBoundingClientRect();
      _clickQueue.push({
        offsetX: e.clientX - rect.left,
        offsetY: e.clientY - rect.top,
      });
      processClickQueue();
    });
  }
}

/**
 * 事件堆栈核心：逐一处理点击队列。
 * 每次处理一个点击，如果是展开/折叠则启动动画，
 * 动画完成后自动处理队列中下一个点击。
 */
function processClickQueue(): void {
  if (_clickQueue.length === 0 || !renderer) return;

  // 动画进行中收到点击 → 中断当前动画，立即响应
  if (_animBusy) {
    if (_animBusyAt && Date.now() - _animBusyAt > 3000) {
      // 超时兜底：强制释放
      _animBusy = false;
      _animBusyAt = 0;
      _clickQueue = [];
      return;
    }
    // 中断 GSAP 动画，重建干净树，立即处理队列中的点击
    gsap.globalTimeline.clear();
    _animBusy = false;
    _animBusyAt = 0;
    animatingPath = null;
    rebuildTree();
  }

  const { offsetX, offsetY } = _clickQueue.shift()!;
  const root = renderer.getRoot();
  if (!root) return;
  const scrollY = root.scrollY ?? 0;
  const px = offsetX;
  const py = offsetY + scrollY;

  for (const child of root.children) {
    if (!child.visible || child.disabled) continue;
    const hit = findTapTarget(child, px, py);
    if (hit?.gesture?.onTap) {
      // 光标逻辑：第一次点击移动光标，第二次同一行才执行
      if (cursorRowId !== null && cursorRowId === hit.id) {
        const hitData = (hit as any).data || {};
        const isDir = hitData.isDir;
        const isExpanded = hitData.isExpanded;
        if (isDir) {
          if (isExpanded) {
            doCollapse(hit, hitData);
          } else {
            doExpand(hit, hitData);
          }
          return;  // 动画函数完成后会 processClickQueue()
        } else {
          hit.gesture.onTap();
        }
      } else {
        moveCursorTo(hit);
      }
      break;
    }
  }
  // �����������动画操作，继续处理队列
  processClickQueue();
}

/** 展开动画 */
function doExpand(hit: Box, hitData: any): void {
  animatingPath = hitData.path;
  hit.gesture!.onTap!();  // 切换状态 → rebuildTree（检��� animatingPath，预置 height=0）

  // rebuildTree 已完成，启动动画
  _animBusy = true; _animBusyAt = Date.now();
  const root = renderer!.getRoot()!;
  const containerId = `expanded-${hitData.path}`;
  const container = findBoxById(root, containerId);
  const titleRow = findBoxById(root, `title-${hitData.path}`);
  const toggle2 = titleRow?.children?.find(c => c.id?.startsWith('toggle-'));

  if (!container) {
    _animBusy = false; _animBusyAt = 0;
    processClickQueue();
    return;
  }

  const fullHeight = (container as any)._fullHeight || 0;
  if (!fullHeight) {
    // 空文件夹：RAF 驱动 toggle 旋转动画
    const finish = () => {
      _animBusy = false; _animBusyAt = 0;
      processClickQueue();
    };
    if (toggle2 && toggle2.transform) {
      toggle2.transform.rotate = 0;
      const startTime = performance.now();
      const startRot = 0;
      const endRot = Math.PI / 2;
      const durationMs = 300;
      const rend = renderer;
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

  animatingPath = null;

  // 恢复子行原始 y
  const _origYs = (container as any)._origYs as number[] | undefined;
  if (_origYs && container.children.length === _origYs.length) {
    container.children.forEach((c, j) => { c.y = _origYs[j]; });
  }
  container.children.forEach(c => { c.opacity = 1; });

  const ancestors = collectAncestors(container, root);

  // 字符雨（fire-and-forget，不阻塞队列）
  animateCharRain(container, root, renderer);

  // 容器展开 + 兄弟偏移
  gsap.to(container, {
    height: fullHeight,
    duration: 0.05,
    ease: 'back.out(1.15)',
    onUpdate: function() {
      applyAnimOffsetSiblings(container, fullHeight, ancestors, root);
      renderer?.setRoot(renderer!.getRoot()!);
    },
    onComplete: () => {
      // 恢复 cornerRadius
      if (container.kfmStyle && (container as any)._savedCr !== undefined) {
        container.kfmStyle.cornerRadius = (container as any)._savedCr;
      }
      slideInRows(container, root, toggle2).then(() => {
        // 修复所有子容器 toggle 状态
        fixExpandedToggles(container);
        renderer?.setRoot(renderer!.getRoot()!);
      }).finally(() => {
        _animBusy = false; _animBusyAt = 0;
        processClickQueue();
      });
    },
  });
  // 首帧偏移
  applyAnimOffsetSiblings(container, fullHeight, ancestors, root);
  renderer?.setRoot(renderer!.getRoot()!);
}

/** 折叠动画 */
function doCollapse(hit: Box, hitData: any): void {
  const tog = hit.children.find(c => c.id?.startsWith('toggle-'));
  const containerId = `expanded-${hitData.path}`;
  const root = renderer!.getRoot()!;
  const container = findBoxById(root, containerId);

  _animBusy = true; _animBusyAt = Date.now();

  const tl = gsap.timeline({
    onComplete: () => {
      _animBusy = false; _animBusyAt = 0;
      hit.gesture!.onTap!();  // 切换状态 → rebuildTree（无锁，正常执行）
      processClickQueue();    // 处理队列中下一个点击
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
    const root2 = renderer!.getRoot()!;
    const origYs = container.children.map(c => c.y);
    const ancestors = collectAncestors(container, root2);
    tl.to(container, {
      height: 0,
      duration: 0.3,
      ease: 'power2.in',
      onUpdate: function() {
        applyAnimOffset(container, origYs, fullH, ancestors, root2);
        renderer?.setRoot(renderer!.getRoot()!);
      },
    }, 0);
  }

  tl.play();
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

function rebuildTree(): void {
  if (!renderer) return;
  if (_animBusy) {
    // 超���兜底：超过 3000ms 自动释放
    if (_animBusyAt && Date.now() - _animBusyAt > 3000) {
      _animBusy = false;
      _animBusyAt = 0;
      _clickQueue = [];  // 清��队列防死循环
    } else {
      return;
    }
  }

  // 保存当前滚动位置和光标行
  const prevScrollY = renderer.getRoot()?.scrollY ?? 0;
  const prevCursorRowId = cursorRowId;

  // 重置光标实例（旧 root 销毁后 cursorBox ��向的 Box 已无效）
  cursorBox = null;
  cursorRowId = null;

  const canvas = document.getElementById('tree-canvas');
  const cw = (canvas?.clientWidth ?? 0) || 295;  // 动态宽度（|| 兜底 clientWidth=0 的情况）
  const rightMargin = cw - 8;              // 行右边界 = 画布宽度 - 8px 留白
  const rootBox = buildSidebarTree(cw, rightMargin);
  // 让 rootBox 的实际宽度=canvas 宽度（扩大裁剪区域），但内部盒子保持相应比例
  if (canvas) rootBox.width = cw;
  const canvasH = (canvas?.clientHeight ?? 0) || 618;
  if (canvas) {
    rootBox.height = canvasH;
  }

  // 在 setRoot 之前，把 animatingPath 的 toggle 强行归零并提交，
  // 盖掉 buildExpanded 设��� 90°，避免第一帧闪烁
  if (animatingPath) {
    const titleRow = findBoxById(rootBox, `title-${animatingPath}`);
    const toggle = titleRow?.children?.find(c => c.id?.startsWith('toggle-'));
    if (toggle) {
      toggle.transform.rotate = 0;
      // 不提前调用 setRoot，等容器后处理完成后再统一提交
    }
  }

  // 在 setRoot 之前预设动画初始状态，避免满高一帧闪烁
  // 递归折叠所有已展开子容器，���保展开动画期间内容不可见
  function collapseSubs(box: any): void {
    if (!box || !box.children) return;
    for (const child of box.children) {
      if (child.id?.startsWith('expanded-') && child.height > 0) {
        // 跳过当前正在做展开动画的容器——动画块自己会处理 toggle 旋转
        if (animatingPath && child.id === `expanded-${animatingPath}`) continue;
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
  if (animatingPath) {
    const preContainer = findBoxById(rootBox, `expanded-${animatingPath}`);
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
      // 初始状态：不吸附光标，让用户第一次点击直接生效
    // snapToCenterRow(newRoot, canvasH);
    }
  }

  // 重建光标步进行索引
  _rebuildRowIndex(newRoot);

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

/** 在动画每帧调用：偏移目标容器内部子项 + 所有祖先层的后续兄弟 + 调整祖���高度 */
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
  // 2) 逐层祖先：偏移后续兄弟 + 调整父容器高度���root 除外）
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
 * SlideInRows: 收集容器内直接子行，��部上移隐藏��再逐行用 translateY 滑下。
 * 盒子链串行展开子容器，每个子容器展开后递归调用自身。
 */
async function slideInRows(container: Box, root: Box, selfToggle?: any): Promise<void> {
  // ========== current toggle rotation ==========
  if (selfToggle) {
    gsap.fromTo(selfToggle.transform, { rotate: 0 }, {
      rotate: Math.PI / 2,
      duration: 0.15,
      ease: 'power2.out',
      onUpdate: () => { renderer?.setRoot(renderer!.getRoot()!); },
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
    // 子容器的 toggle 直接设置为最终状态（已展开为 90°）
    const subTog = (child as any)._toggleBox;
    const subTogRotate = (child as any)._toggleRotate ?? Math.PI / 2;
    // 从当前 root 重新查找 toggle，确保引用正确
    const freshTitle = findBoxById(root, `title-${child.id.slice('expanded-'.length)}`);
    const freshTog = freshTitle?.children?.find((c: any) => c.id?.startsWith('toggle-'));
    if (freshTog) {
      gsap.killTweensOf(freshTog.transform);
      freshTog.transform.rotate = subTogRotate;
    }
    const subRainPromise = animateCharRain(child, root, renderer);
    await new Promise<void>(resolve => {
      gsap.to(child, {
        height: subFullH,
        duration: 0.05,
        ease: 'back.out(1.15)',
        onUpdate: () => { renderer?.setRoot(renderer!.getRoot()!); },
        onComplete: resolve,
      });
    });
    // 子容器展开后递归 slideInRows
    // restore sub-container cornerRadius
    if (child.kfmStyle && (child as any)._savedCr !== undefined) {
      child.kfmStyle.cornerRadius = (child as any)._savedCr;
    }
    await slideInRows(child, root);
    await expandNext(idx + 1);
  }
  await expandNext(0);
}