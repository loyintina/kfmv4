/**
 * KFM v4 - UI控制（侧栏、光标高亮）
 */
import { selectedFile, setSelectedFile } from './app.js';
import { measureNaturalWidthSync } from './tree-text.js';
import gsap from 'gsap';

const CURSOR_POS_KEY = 'kfm_cursor_position';
let cursorHighlight: HTMLDivElement | null = null;

// 约束区域高度
const CONSTRAINT_HEIGHT = 32;
const SCROLL_THROTTLE = 16;
const BOUNDARY_STEP_THRESHOLD = 30;

let lastScrollCheck = 0;
let boundaryAccum = 0;
let isClickScrolling = false;

export function resetCursorHighlight(): void { cursorHighlight = null; }

function initCursorHighlight(): void {
  if (cursorHighlight && !document.body.contains(cursorHighlight)) cursorHighlight = null;
  if (cursorHighlight) return;
  const container = document.querySelector('.sidebar-content');
  if (!container) return;
  cursorHighlight = document.createElement('div');
  cursorHighlight.className = 'cursor-highlight';
  cursorHighlight.style.top = '0px';
  container.appendChild(cursorHighlight);
}

// GSAP 缓动曲线 — 与原 CSS transition 等价
const CURSOR_EASE = 'cubic-bezier(.25,.46,.45,.94)';
const CURSOR_DURATION = 0.3;

export function updateCursorHighlight(immediate = false): void {
  if (!cursorHighlight) initCursorHighlight();
  if (!cursorHighlight) return;

  const selected = document.querySelector('.tree-item.selected') as HTMLElement | null;
  if (!selected) {
    gsap.set(cursorHighlight, { opacity: 0 });
    updateSidebarPath(null);
    return;
  }

  const row = selected.querySelector('.tree-row') || selected;
  const container = document.querySelector('.sidebar-content')!;
  const containerRect = container.getBoundingClientRect();
  const rowRect = row.getBoundingClientRect();

  const target = {
    top: rowRect.top - containerRect.top + container.scrollTop,
    left: rowRect.left - containerRect.left,
    width: rowRect.width,
    height: rowRect.height,
    opacity: 1,
  };

  if (immediate) {
    gsap.set(cursorHighlight, target);
  } else {
    gsap.to(cursorHighlight, {
      ...target,
      duration: CURSOR_DURATION,
      ease: CURSOR_EASE,
    });
  }

  updateSidebarPath(selected);
}

// sidebarPath 字体：与 CSS .sidebar-path 一致（12px + body font-family）
const PATH_FONT = '12px -apple-system, sans-serif';

export function updateSidebarPath(item: HTMLElement | null): void {
  const pathEl = document.getElementById('sidebarPath');
  if (!pathEl) return;

  // 取消旧动画
  gsap.killTweensOf(pathEl);

  // 读取当前渲染宽度
  const currentW = parseFloat(getComputedStyle(pathEl).width) || 20;

  if (!item) {
    const targetW = measureNaturalWidthSync('-', PATH_FONT) + 24;
    pathEl.textContent = '-';
    pathEl.title = '';
    if (Math.abs(currentW - targetW) < 2) return;
    gsap.fromTo(pathEl, { width: currentW + 'px' }, {
      width: targetW + 'px',
      duration: 0.2,
      ease: 'cubic-bezier(.4,0,.2,1)',
      onComplete: () => { pathEl.style.width = 'auto'; },
    });
    return;
  }

  const nameEl = item.querySelector('.tree-name');
  const name = nameEl ? nameEl.textContent : '-';

  // Pretext 离屏测量文本宽度，零 reflow
  const targetW = measureNaturalWidthSync(name || '-', PATH_FONT) + 24;

  // 如果宽度几乎不变，跳过动画
  if (Math.abs(currentW - targetW) < 2) {
    pathEl.textContent = name;
    pathEl.title = name || '';
    return;
  }

  // 锁回当前宽度，触发动画
  pathEl.textContent = name;
  pathEl.style.width = currentW + 'px';

  gsap.fromTo(pathEl, { width: currentW + 'px' }, {
    width: targetW + 'px',
    duration: 0.2,
    ease: 'cubic-bezier(.4,0,.2,1)',
    onComplete: () => { pathEl.style.width = 'auto'; },
  });
  pathEl.title = name || '';
}

export function syncCursorDuringBounce(siblingCount = 0): void {
  if (!cursorHighlight) initCursorHighlight();
  if (!cursorHighlight) return;

  const totalMs = Math.max(500, (siblingCount > 0 ? (siblingCount - 1) * 20 : 0) + 550);

  // GSAP ticker 替代手动 rAF 轮询，每帧自动同步光标位置
  const syncHandler = () => {
    const sel = document.querySelector('.tree-item.selected') as HTMLElement | null;
    if (!sel || !cursorHighlight) return;
    const row = sel.querySelector('.tree-row') || sel;
    const container = document.querySelector('.sidebar-content')!;
    const cr = container.getBoundingClientRect();
    const rr = row.getBoundingClientRect();
    gsap.set(cursorHighlight, {
      top: rr.top - cr.top + container.scrollTop,
      left: rr.left - cr.left,
      width: rr.width,
      height: rr.height,
      opacity: 1,
    });
  };

  gsap.ticker.add(syncHandler);

  // 动画结束后：最终同步 + 清理 + 恢复缓动
  gsap.delayedCall(totalMs / 1000, () => {
    gsap.ticker.remove(syncHandler);
    const sel = document.querySelector('.tree-item.selected') as HTMLElement | null;
    if (sel && cursorHighlight) {
      sel.style.transform = ''; sel.style.transition = '';
      const row = sel.querySelector('.tree-row') || sel;
      const container = document.querySelector('.sidebar-content')!;
      const cr = container.getBoundingClientRect();
      const rr = row.getBoundingClientRect();
      gsap.set(cursorHighlight, {
        top: rr.top - cr.top + container.scrollTop,
        left: rr.left - cr.left,
        width: rr.width,
        height: rr.height,
        opacity: 1,
      });
    }
  });
}

export function openSidebar(): void {
  document.getElementById('sidebar')?.classList.add('open');
  document.getElementById('overlay')?.classList.add('show');
  setTimeout(() => { initCursorHighlight(); restoreCursorPosition(); }, 100);
}

export function closeSidebar(): void {
  saveCursorPosition();
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('overlay')?.classList.remove('show');
}

function saveCursorPosition(): void {
  const selected = document.querySelector('.tree-item.selected');
  if (selected) {
    const items = document.querySelectorAll('#fileTree .tree-item');
    let index = -1;
    items.forEach((item, i) => { if (item === selected) index = i; });
    if (index !== -1) localStorage.setItem(CURSOR_POS_KEY, JSON.stringify({ index, timestamp: Date.now() }));
  }
}

function restoreCursorPosition(): void {
  const items = document.querySelectorAll('#fileTree .tree-item');
  if (items.length === 0) return;
  document.querySelectorAll('.tree-item.selected').forEach(el => el.classList.remove('selected'));
  let targetIndex = -1;
  try {
    const saved = JSON.parse(localStorage.getItem(CURSOR_POS_KEY) || 'null');
    if (saved && saved.index >= 0 && saved.index < items.length) targetIndex = saved.index;
  } catch {}
  if (targetIndex === -1) targetIndex = Math.floor(items.length / 2);
  selectFileItem(items[targetIndex] as HTMLElement);
  centerCursorToView(items[targetIndex] as HTMLElement);
}

export function centerCursorToView(item: HTMLElement, smooth = true): void {
  const sidebarContent = document.querySelector('.sidebar-content');
  if (!sidebarContent) return;
  const containerRect = sidebarContent.getBoundingClientRect();
  const treeRow = item.querySelector('.tree-row') || item;
  const rowRect = treeRow.getBoundingClientRect();
  const rowCenter = rowRect.top + rowRect.height / 2;
  const containerCenter = containerRect.top + containerRect.height / 2;
  const scrollOffset = rowCenter - containerCenter;
  const targetScroll = sidebarContent.scrollTop + scrollOffset;
  sidebarContent.scrollTo({ top: targetScroll, behavior: smooth ? 'smooth' : 'instant' });
}

export function isInConstraintZone(el: HTMLElement): boolean {
  if (!el) return false;
  const container = document.querySelector('.sidebar-content');
  if (!container) return false;
  const cr = container.getBoundingClientRect();
  const centerY = cr.top + cr.height / 2;
  const row = el.querySelector('.tree-row') || el;
  const rect = row.getBoundingClientRect();
  const itemCenter = rect.top + rect.height / 2;
  return itemCenter >= centerY - CONSTRAINT_HEIGHT / 2 && itemCenter <= centerY + CONSTRAINT_HEIGHT / 2;
}

export function scrollIntoConstraintZone(target: HTMLElement): void {
  if (!target) return;
  const container = document.querySelector('.sidebar-content');
  if (!container) return;
  const cr = container.getBoundingClientRect();
  const centerY = cr.top + cr.height / 2;
  const row = target.querySelector('.tree-row') || target;
  const rect = row.getBoundingClientRect();
  const offset = (rect.top + rect.height / 2) - centerY;
  const maxScroll = container.scrollHeight - container.clientHeight;
  const targetScroll = Math.max(0, Math.min(maxScroll, container.scrollTop + offset));
  container.scrollTo({ top: targetScroll, behavior: 'smooth' });
}

export function scrollAndCenterCursor(item: HTMLElement): void {
  isClickScrolling = true;
  (window as any).isClickScrolling = true;
  const container = document.querySelector(".sidebar-content");
  if (container) {
    const onEnd = () => {
      isClickScrolling = false;
      (window as any).isClickScrolling = false;
      container.removeEventListener("scrollend", onEnd);
    };
    container.addEventListener("scrollend", onEnd);
    setTimeout(() => { if (isClickScrolling) onEnd(); }, 600);
  }
  scrollIntoConstraintZone(item);
}

export function isNodeExpanded(item: HTMLElement): boolean {
  let wrap: HTMLElement | null = item.parentElement as HTMLElement;
  while (wrap && wrap.id !== 'fileTree') {
    if (wrap.classList.contains('tree-children-wrap') && !wrap.classList.contains('open')) return false;
    wrap = wrap.parentElement as HTMLElement;
  }
  return true;
}

function getVisibleItems(): HTMLElement[] {
  const container = document.querySelector('.sidebar-content');
  if (!container) return [];
  const cr = container.getBoundingClientRect();
  const items = document.querySelectorAll('#fileTree .tree-item');
  const visible: HTMLElement[] = [];
  for (const item of items) {
    if (!isNodeExpanded(item as HTMLElement)) continue;
    const row = item.querySelector('.tree-row') || item;
    const rect = row.getBoundingClientRect();
    if (rect.bottom > cr.top && rect.top < cr.bottom) visible.push(item as HTMLElement);
  }
  return visible;
}

function findClosestToCenter(items: HTMLElement[]): HTMLElement | null {
  if (!items.length) return null;
  const container = document.querySelector('.sidebar-content')!;
  const cr = container.getBoundingClientRect();
  const centerY = cr.top + cr.height / 2;
  let closest = items[0];
  let minDist = Infinity;
  for (const item of items) {
    const row = item.querySelector('.tree-row') || item;
    const rect = row.getBoundingClientRect();
    const dist = Math.abs(rect.top + rect.height / 2 - centerY);
    if (dist < minDist) { minDist = dist; closest = item; }
  }
  return closest;
}

/** 统一选中逻辑 — 只做选中+光标+sidebarPath，不含滚动 */
export function selectFileItem(item: HTMLElement): void {
  const current = document.querySelector('.tree-item.selected');
  if (current === item) return;
  if (current) current.classList.remove('selected');
  item.classList.add('selected');
  const path = item.dataset.path || '';
  setSelectedFile(path);
  window.selectedFile = path;
  updateCursorHighlight(false);
  updateSidebarPath(item);
}

function moveCursorTo(target: HTMLElement): void {
  if (!target) return;
  selectFileItem(target);
}

function initScrollCursorConstraint(): void {
  const container = document.querySelector('.sidebar-content');
  if (!container) return;
  let boundaryTouchActive = false;
  let boundaryLastY = 0;

  container.addEventListener('touchstart', (e) => {
    boundaryTouchActive = true; boundaryAccum = 0; boundaryLastY = e.touches[0].clientY;
  }, { passive: true });

  container.addEventListener('touchmove', (e) => {
    if (!boundaryTouchActive) return;
    const currentY = e.touches[0].clientY;
    const dy = currentY - boundaryLastY;
    boundaryLastY = currentY;
    if ((window as any).joystickActive || (window as any).isClickScrolling) return;
    const maxScroll = container.scrollHeight - container.clientHeight;
    const atTop = container.scrollTop <= 0 && dy > 0;
    const atBottom = container.scrollTop >= maxScroll - 1 && dy < 0;
    if (atTop || atBottom) {
      boundaryAccum += Math.abs(dy);
      if (boundaryAccum >= BOUNDARY_STEP_THRESHOLD) {
        const steps = Math.floor(boundaryAccum / BOUNDARY_STEP_THRESHOLD);
        boundaryAccum -= steps * BOUNDARY_STEP_THRESHOLD;
        const allVisible = Array.from(document.querySelectorAll('#fileTree .tree-item')).filter(item => isNodeExpanded(item as HTMLElement)) as HTMLElement[];
        const sel = document.querySelector('.tree-item.selected');
        let idx = 0;
        allVisible.forEach((item, i) => { if (item === sel) idx = i; });
        const newIdx = atTop ? Math.max(0, idx - steps) : Math.min(allVisible.length - 1, idx + steps);
        if (newIdx !== idx) {
          selectFileItem(allVisible[newIdx]);
        }
      }
    } else {
      boundaryAccum = 0;
    }
  }, { passive: true });

  container.addEventListener('touchend', () => { boundaryTouchActive = false; boundaryAccum = 0; }, { passive: true });

  // rAF 轮询：不依赖 scroll 事件频率，每帧检测
  let scrollRafId = 0;
  let lastScrollPos = 0;
  const pollScroll = () => {
    scrollRafId = requestAnimationFrame(pollScroll);
    const sp = container.scrollTop;
    if (sp === lastScrollPos) return; // 没滚动就跳过
    lastScrollPos = sp;
    if ((window as any).joystickActive || (window as any).isClickScrolling) return;
    const sel = document.querySelector('.tree-item.selected') as HTMLElement | null;
    if (!sel || isInConstraintZone(sel)) return;
    const allVisible = Array.from(document.querySelectorAll('#fileTree .tree-item')).filter(item => isNodeExpanded(item as HTMLElement)) as HTMLElement[];
    let idx = 0;
    allVisible.forEach((item, i) => { if (item === sel) idx = i; });
    const cr = container.getBoundingClientRect();
    const centerY = cr.top + cr.height / 2;
    const selRow = sel.querySelector('.tree-row') || sel;
    const selRect = selRow.getBoundingClientRect();
    const selCenter = selRect.top + selRect.height / 2;
    const offset = selCenter - centerY;
    const itemH = selRect.height || 32;
    // 每帧最多追的步数 = 偏移量 / 项高度，上限10
    const steps = Math.abs(offset) < itemH * 2 ? 1 : Math.min(10, Math.round(Math.abs(offset) / itemH));
    const nextIdx = offset > 0
      ? Math.max(0, idx - steps)
      : Math.min(allVisible.length - 1, idx + steps);
    if (nextIdx !== idx) {
      moveCursorTo(allVisible[nextIdx]);
    }
  };
  scrollRafId = requestAnimationFrame(pollScroll);
}

// overlay click
function initOverlay(): void {
  document.getElementById('overlay')?.addEventListener('click', () => {
    // 光标动作由 gestures.ts 处理
  });
}

export function initUI(): void {
  window.updateCursorHighlight = updateCursorHighlight;
  window.updateSidebarPath = updateSidebarPath;
  window.centerCursorToView = centerCursorToView;
  window.isNodeExpanded = isNodeExpanded;
  (window as any).selectFileItem = selectFileItem;
  (window as any).resetCursorHighlight = resetCursorHighlight;
  (window as any).syncCursorDuringBounce = syncCursorDuringBounce;
  (window as any).scrollIntoConstraintZone = scrollIntoConstraintZone;
  (window as any).scrollAndCenterCursor = scrollAndCenterCursor;
  (window as any).isInConstraintZone = isInConstraintZone;

  window.openSidebar = openSidebar;
  window.closeSidebar = closeSidebar;
  (window as any).executeCursorAction = async function() {};

  initScrollCursorConstraint();
  initOverlay();
}