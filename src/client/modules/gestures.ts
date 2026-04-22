/**
 * KFM v4 - 手势系统（摇杆光标）
 */
import { setSelectedFile, closeLogPanel } from './app.js';
import { updateCursorHighlight, updateSidebarPath, isNodeExpanded, centerCursorToView, openSidebar, closeSidebar, } from './ui.js';

let touchStartX = 0;
let touchStartY = 0;
let touchStarted = false;
let pullDownTriggered = false;
let hasMoved = false;
let cursorMode = false;
let scrollMode = false;
let lastCursorIndex = 0;

// 摇杆状态
let joystickActive = false;
let joystickOffset = 0;
let joystickRafId: number | null = null;
let joystickAccum = 0;
const JOYSTICK_DEADZONE = 15;
const JOYSTICK_SENSITIVITY = 320;
const SCROLL_FOLLOW_SPEED = 0.25;

function followScrollToCursor(): void {
  const container = document.querySelector('.sidebar-content');
  if (!container) return;
  const selected = document.querySelector('.tree-item.selected') as HTMLElement | null;
  if (!selected) return;
  const cr = container.getBoundingClientRect();
  const row = selected.querySelector('.tree-row') || selected;
  const rr = row.getBoundingClientRect();
  const diff = (rr.top + rr.height / 2) - (cr.top + cr.height / 2);
  container.scrollTop += diff * SCROLL_FOLLOW_SPEED;
}

function moveCursorBySteps(steps: number): void {
  if (steps === 0) return;
  const items = Array.from(document.querySelectorAll('#fileTree .tree-item')).filter(item => isNodeExpanded(item as HTMLElement)) as HTMLElement[];
  if (!items.length) return;
  const currentSelected = document.querySelector('.tree-item.selected');
  let currentIndex = 0;
  items.forEach((item, i) => { if (item === currentSelected) currentIndex = i; });
  const targetIndex = Math.min(Math.max(currentIndex + steps, 0), items.length - 1);
  if (targetIndex === currentIndex) return;
  if (currentSelected) currentSelected.classList.remove('selected');
  items[targetIndex].classList.add('selected');
  setSelectedFile(items[targetIndex].dataset.path || '');
  (window as any).selectedFile = items[targetIndex].dataset.path || '';
  updateCursorHighlight();
  updateSidebarPath(items[targetIndex]);
}

function joystickTick(): void {
  if (!joystickActive) return;
  if (Math.abs(joystickOffset) <= JOYSTICK_DEADZONE) {
    followScrollToCursor();
    joystickRafId = requestAnimationFrame(joystickTick);
    return;
  }
  const sign = joystickOffset > 0 ? 1 : -1;
  const absOffset = Math.abs(joystickOffset) - JOYSTICK_DEADZONE;
  const speed = sign * (absOffset / JOYSTICK_SENSITIVITY);
  joystickAccum += speed;
  if (Math.abs(joystickAccum) >= 1) {
    const steps = Math.trunc(joystickAccum);
    joystickAccum -= steps;
    moveCursorBySteps(-steps);
  }
  followScrollToCursor();
  joystickRafId = requestAnimationFrame(joystickTick);
}

function startJoystick(): void {
  joystickActive = true;
  joystickAccum = 0;
  (window as any).joystickActive = true;
  joystickTick();
}

function stopJoystick(): void {
  joystickActive = false;
  joystickAccum = 0;
  (window as any).joystickActive = false;
  if (joystickRafId) { cancelAnimationFrame(joystickRafId); joystickRafId = null; }
}

// 光标动作
async function executeCursorAction(): Promise<void> {
  const selectedItem = document.querySelector('.tree-item.selected') as HTMLElement | null;
  if (!selectedItem) return;
  const path = selectedItem.dataset.path || '';
  const toggle = selectedItem.querySelector('.tree-toggle');
  const isDir = toggle && !toggle.classList.contains('hidden');

  if (isDir) {
    const wrap = selectedItem.querySelector('.tree-children-wrap');
    if (wrap && toggle) {
      const isOpen = wrap.classList.contains('open');
      const childrenWrap = wrap.querySelector('div')?.querySelector('div') || wrap.querySelector('div');
      if (!isOpen && childrenWrap && !childrenWrap.querySelector('.tree-item')) {
        await (window as any).renderTree?.(childrenWrap, path, 1);
      }
      wrap.classList.toggle('open');
      toggle.classList.toggle('expanded');
      const ep = JSON.parse(localStorage.getItem('expandedPaths') || '{}');
      ep[path] = !isOpen;
      localStorage.setItem('expandedPaths', JSON.stringify(ep));
    }
  }
}

function initCursorToFirst(): void {
  setTimeout(() => { (window as any).restoreCursorPosition?.(); }, 100);
}

export function initGestures(): void {
  (window as any).executeCursorAction = executeCursorAction;
  (window as any).joystickActive = false;

  document.addEventListener('touchstart', (e) => {
    if ((e.target as HTMLElement).closest('.light-orb')) return;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchStarted = true;
    pullDownTriggered = false;
    hasMoved = false;
    const sidebarOpen = document.getElementById('sidebar')?.classList.contains('open');
    if (sidebarOpen) {
      const sidebarRect = document.getElementById('sidebar')!.getBoundingClientRect();
      cursorMode = touchStartX > sidebarRect.right;
    } else {
      cursorMode = false;
    }
  }, { passive: true });

  document.addEventListener('touchmove', (e) => {
    if ((e.target as HTMLElement).closest('.light-orb')) return;
    if (!touchStarted) return;
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const dx = currentX - touchStartX;
    const dy = currentY - touchStartY;

    if (cursorMode) {
      if (dx < -60) { hasMoved = true; stopJoystick(); closeSidebar(); touchStarted = false; return; }
      if (Math.abs(dy) > JOYSTICK_DEADZONE) {
        if (!hasMoved) { hasMoved = true; startJoystick(); }
        joystickOffset = dy;
      } else if (hasMoved) { joystickOffset = 0; }
      return;
    }

    const logOpen = document.getElementById('logPanel')?.classList.contains('open');
    if (document.getElementById('sidebar')?.classList.contains('open')) {
      if (dx < -60) { closeSidebar(); touchStarted = false; return; }
    }
    if (logOpen) {
      if (dx > 60) { closeLogPanel();; touchStarted = false; return; }
      return;
    }
    if (!document.getElementById('sidebar')?.classList.contains('open') && dx > 60) {
      openSidebar();
      initCursorToFirst();
      touchStarted = false;
      return;
    }
  }, { passive: true });

  document.addEventListener('touchend', () => {
    if (cursorMode && !hasMoved) executeCursorAction();
    if (joystickActive) stopJoystick();
    touchStarted = false;
    cursorMode = false;
    hasMoved = false;
    scrollMode = false;
  }, { passive: true });
}
