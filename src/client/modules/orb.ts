/**
 * KFM v4 - 悬浮光球 + 召唤面板
 *
 * 交互模式：
 * - 点击光球 → 展开/收起面板
 * - 拖动光球 → 移动位置（光球始终在面板右下角）
 * - 长按1s → 进入编辑模式（左上角固定，拖动光球调整面板大小）
 * - 编辑模式中再次长按1s → 退出编辑模式
 *
 * 约束：
 * - 光球始终在输入栏上方
 * - 光球 z-index > 面板 z-index（光球压住面板）
 * - 面板随光球移动，超出屏幕时自动压缩，回来时恢复
 */

import { measureText, layoutLines } from '../engine/text-layout/index.js';

interface ChatMessage {
  role: 'user' | 'ai';
  text: string;
}

type OrbState = 'collapsed' | 'expanded' | 'editing';

let orbState: OrbState = 'collapsed';
let orbEl: HTMLDivElement | null = null;
let panelEl: HTMLDivElement | null = null;

const PANEL_MIN_WIDTH = 200;
const PANEL_MIN_HEIGHT = 150;
const PANEL_DEFAULT_WIDTH = 300;
const PANEL_DEFAULT_HEIGHT = 350;
let panelWidth = PANEL_DEFAULT_WIDTH;
let panelHeight = PANEL_DEFAULT_HEIGHT;

// 实际渲染尺寸（可能被压缩）
let renderWidth = PANEL_DEFAULT_WIDTH;
let renderHeight = PANEL_DEFAULT_HEIGHT;

let dragging = false;
let dragStartX = 0;
let dragStartY = 0;
let dragStartOrbX = 0;
let dragStartOrbY = 0;
let dragStartPanelX = 0;
let dragStartPanelY = 0;

let longPressTimer: ReturnType<typeof setTimeout> | null = null;
let longPressFired = false;
const LONG_PRESS_MS = 1000;

const ORB_SIZE = 36;
const ORB_HALF = ORB_SIZE / 2;
const MARGIN = 8;

const chatMessages: ChatMessage[] = [
  { role: 'ai', text: '你好，我是蔚然。有什么可以帮你的吗？' },
  { role: 'user', text: '帮我分析一下当前的目录结构' },
  { role: 'ai', text: '好的，正在分析目录结构。当前目录下共有 12 个文件夹和 8 个文件。' },
];

// ========== 获取输入栏上边界 ==========
function getInputBarTop(): number {
  const bar = document.getElementById('aiInputBar');
  if (!bar) return window.innerHeight;
  return bar.getBoundingClientRect().top;
}

// ========== 光球位置约束 ==========
function clampOrbPosition(x: number, y: number): { x: number; y: number } {
  const maxX = window.innerWidth - ORB_SIZE - MARGIN;
  const minX = MARGIN;
  const maxY = getInputBarTop() - ORB_SIZE - MARGIN;
  const minY = MARGIN;
  return {
    x: Math.max(minX, Math.min(maxX, x)),
    y: Math.max(minY, Math.min(maxY, y)),
  };
}

// ========== 面板创建 ==========
function createPanel(): HTMLDivElement {
  const panel = document.createElement('div');
  panel.className = 'orb-panel';
  panel.style.cssText = `
    position: fixed;
    background: rgba(20, 16, 32, 0.92);
    backdrop-filter: blur(16px);
    border: 1px solid rgba(124, 58, 237, 0.3);
    border-radius: 12px;
    box-shadow: 0 0 20px 4px rgba(124, 58, 237, 0.15), 0 8px 32px rgba(0, 0, 0, 0.5);
    z-index: 205;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    opacity: 0;
    transition: opacity 0.3s ease;
    pointer-events: none;
  `;
  panel.id = 'orbPanel';
  document.body.appendChild(panel);
  return panel;
}

// ========== Pretext 文本排版 ==========
function renderChatContent(): void {
  if (!panelEl) return;
  const contentArea = panelEl.querySelector('.orb-panel-content') as HTMLElement;
  if (!contentArea) return;

  const innerWidth = renderWidth - 24;
  if (innerWidth < 50) return;

  let html = '';
  for (const msg of chatMessages) {
    const isUser = msg.role === 'user';
    const bgColor = isUser ? 'rgba(124,58,237,0.15)' : 'rgba(46,213,163,0.1)';
    const borderColor = isUser ? 'rgba(124,58,237,0.4)' : 'rgba(46,213,163,0.3)';
    const align = isUser ? 'flex-end' : 'flex-start';
    const label = isUser ? '你' : '蔚然';
    const labelColor = isUser ? '#7c3aed' : '#2ed5a3';

    const font = '13px sans-serif';
    const lineHeight = 20;
    try {
      const lines = layoutLines(msg.text, font, innerWidth - 24, lineHeight);
      const textHtml = lines.map(l => `<span style="display:block">${escapeHtml(l.text)}</span>`).join('');
      html += `
        <div style="display:flex;justify-content:${align};margin-bottom:8px">
          <div style="max-width:${innerWidth - 8}px;padding:6px 12px;background:${bgColor};border:1px solid ${borderColor};border-radius:8px">
            <div style="font-size:10px;color:${labelColor};margin-bottom:2px;font-weight:600">${label}</div>
            <div style="font-family:sans-serif;font-size:13px;line-height:${lineHeight}px;color:#e0e0e0">${textHtml}</div>
          </div>
        </div>`;
    } catch {
      html += `
        <div style="display:flex;justify-content:${align};margin-bottom:8px">
          <div style="max-width:85%;padding:6px 12px;background:${bgColor};border:1px solid ${borderColor};border-radius:8px">
            <div style="font-size:10px;color:${labelColor};margin-bottom:2px;font-weight:600">${label}</div>
            <div style="font-size:13px;color:#e0e0e0">${escapeHtml(msg.text)}</div>
          </div>
        </div>`;
    }
  }
  contentArea.innerHTML = html;
  contentArea.scrollTop = contentArea.scrollHeight;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ========== 面板布局（核心：光球在面板右下角，超出时压缩） ==========
function updatePanelPosition(): void {
  if (!orbEl || !panelEl) return;
  const orbRect = orbEl.getBoundingClientRect();
  const orbCX = orbRect.left + ORB_HALF;
  const orbCY = orbRect.top + ORB_HALF;

  // 面板理想位置：右下角 = 光球圆心
  const idealLeft = orbCX - panelWidth;
  const idealTop = orbCY - panelHeight;

  // 边界约束：面板不能超出屏幕
  const screenLeft = MARGIN;
  const screenTop = MARGIN;
  const screenRight = window.innerWidth - MARGIN;
  const screenBottom = getInputBarTop() - MARGIN;

  // 计算可用空间（从光球圆心往左和往上的最大距离）
  const availLeft = orbCX - screenLeft;
  const availTop = orbCY - screenTop;
  const availRight = screenRight - orbCX;
  const availBottom = screenBottom - orbCY;

  // 面板实际渲染尺寸：尽可能接近设定值，但不能超出可用空间
  renderWidth = Math.max(PANEL_MIN_WIDTH, Math.min(panelWidth, availLeft));
  renderHeight = Math.max(PANEL_MIN_HEIGHT, Math.min(panelHeight, availTop));

  // 面板定位：右下角对齐光球圆心
  const panelLeft = orbCX - renderWidth;
  const panelTop = orbCY - renderHeight;

  panelEl.style.left = Math.max(screenLeft, panelLeft) + 'px';
  panelEl.style.top = Math.max(screenTop, panelTop) + 'px';
  panelEl.style.width = renderWidth + 'px';
  panelEl.style.height = renderHeight + 'px';
}

// ========== 面板内容 ==========
function buildPanelContent(): void {
  if (!panelEl) return;
  panelEl.innerHTML = `
    <div class="orb-panel-header" style="
      padding: 10px 14px;
      border-bottom: 1px solid rgba(124,58,237,0.2);
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-shrink: 0;
    ">
      <span style="font-size:13px;color:#7c3aed;font-weight:600">AI 对话上下文</span>
      <span class="orb-panel-state" style="font-size:10px;color:rgba(255,255,255,0.3)"></span>
    </div>
    <div class="orb-panel-content" style="
      flex: 1;
      overflow-y: auto;
      padding: 10px 12px;
      min-height: 0;
    "></div>
  `;
}

// ========== 状态切换 ==========
function expandPanel(): void {
  if (!panelEl) panelEl = createPanel();
  if (orbState === 'collapsed') {
    orbState = 'expanded';
    buildPanelContent();
    updatePanelPosition();
    renderChatContent();
    panelEl.style.opacity = '1';
    panelEl.style.pointerEvents = 'auto';
    updateStateLabel();
  }
}

function collapsePanel(): void {
  if (orbState === 'expanded') {
    orbState = 'collapsed';
    if (panelEl) {
      panelEl.style.opacity = '0';
      panelEl.style.pointerEvents = 'none';
    }
    updateStateLabel();
  }
}

function enterEditMode(): void {
  if (orbState !== 'expanded') return;
  orbState = 'editing';
  if (panelEl) {
    panelEl.style.borderColor = 'rgba(124, 58, 237, 0.8)';
    panelEl.style.boxShadow = '0 0 30px 8px rgba(124, 58, 237, 0.3), 0 8px 32px rgba(0, 0, 0, 0.5)';
  }
  updateStateLabel();
}

function exitEditMode(): void {
  if (orbState !== 'editing') return;
  orbState = 'expanded';
  if (panelEl) {
    panelEl.style.borderColor = 'rgba(124, 58, 237, 0.3)';
    panelEl.style.boxShadow = '0 0 20px 4px rgba(124, 58, 237, 0.15), 0 8px 32px rgba(0, 0, 0, 0.5)';
  }
  renderChatContent();
  updateStateLabel();
}

function togglePanel(): void {
  if (orbState === 'collapsed') expandPanel();
  else if (orbState === 'expanded') collapsePanel();
}

function updateStateLabel(): void {
  if (!panelEl) return;
  const label = panelEl.querySelector('.orb-panel-state');
  if (!label) return;
  const labels: Record<OrbState, string> = { collapsed: '', expanded: '长按编辑大小', editing: '拖动调整大小 · 长按退出' };
  label.textContent = labels[orbState];
}

// ========== 拖动通用逻辑 ==========
function handleDragMove(dx: number, dy: number): void {
  if (!orbEl) return;

  if (orbState === 'editing') {
    // 编辑模式：左上角固定，拖动光球改变面板大小
    const rawX = dragStartOrbX + dx;
    const rawY = dragStartOrbY + dy;
    const clamped = clampOrbPosition(rawX, rawY);

    const orbCX = clamped.x + ORB_HALF;
    const orbCY = clamped.y + ORB_HALF;
    panelWidth = Math.max(PANEL_MIN_WIDTH, orbCX - dragStartPanelX);
    panelHeight = Math.max(PANEL_MIN_HEIGHT, orbCY - dragStartPanelY);

    orbEl.style.left = clamped.x + 'px';
    orbEl.style.top = clamped.y + 'px';
    orbEl.style.right = 'auto';
    orbEl.style.bottom = 'auto';

    updatePanelPosition();
    renderChatContent();
  } else {
    // 普通拖动
    const rawX = dragStartOrbX + dx;
    const rawY = dragStartOrbY + dy;
    const clamped = clampOrbPosition(rawX, rawY);

    orbEl.style.left = clamped.x + 'px';
    orbEl.style.top = clamped.y + 'px';
    orbEl.style.right = 'auto';
    orbEl.style.bottom = 'auto';
    orbEl.style.transition = 'none';

    if (orbState === 'expanded' && panelEl) {
      updatePanelPosition();
      renderChatContent();
    }
  }
}

function startDrag(x: number, y: number): void {
  dragging = false;
  longPressFired = false;
  dragStartX = x;
  dragStartY = y;

  const rect = orbEl!.getBoundingClientRect();
  dragStartOrbX = rect.left;
  dragStartOrbY = rect.top;

  if (panelEl) {
    dragStartPanelX = parseFloat(panelEl.style.left) || 0;
    dragStartPanelY = parseFloat(panelEl.style.top) || 0;
  }

  longPressTimer = setTimeout(() => {
    longPressFired = true;
    if (orbState === 'expanded') enterEditMode();
    else if (orbState === 'editing') exitEditMode();
  }, LONG_PRESS_MS);
}

function moveDrag(x: number, y: number): void {
  const dx = x - dragStartX;
  const dy = y - dragStartY;
  if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
    dragging = true;
    if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
  }
  if (!dragging) return;
  handleDragMove(dx, dy);
}

function endDrag(): void {
  if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
  if (orbEl) orbEl.style.transition = 'box-shadow .2s';
  if (!dragging && !longPressFired) togglePanel();
  dragging = false;
}

// ========== 监听输入栏位置变化（输入法弹出时光球跟随） ==========
function initInputBarWatcher(): void {
  let lastBarTop = 0;
  const check = () => {
    if (!orbEl) return;
    const barTop = getInputBarTop();
    if (barTop !== lastBarTop) {
      lastBarTop = barTop;
      const rect = orbEl.getBoundingClientRect();
      const clamped = clampOrbPosition(rect.left, rect.top);
      if (rect.top !== clamped.y || rect.left !== clamped.x) {
        orbEl.style.left = clamped.x + 'px';
        orbEl.style.top = clamped.y + 'px';
        orbEl.style.right = 'auto';
        orbEl.style.bottom = 'auto';
        if (panelEl && orbState !== 'collapsed') updatePanelPosition();
      }
    }
    requestAnimationFrame(check);
  };
  requestAnimationFrame(check);
}

// ========== 初始化 ==========
export function initOrb(): void {
  orbEl = document.getElementById('lightOrb') as HTMLDivElement | null;
  if (!orbEl) return;

  // 确保光球 z-index > 面板
  orbEl.style.zIndex = '210';

  // 初始位置约束
  const initRect = orbEl.getBoundingClientRect();
  const clamped = clampOrbPosition(initRect.left, initRect.top);
  orbEl.style.left = clamped.x + 'px';
  orbEl.style.top = clamped.y + 'px';
  orbEl.style.right = 'auto';
  orbEl.style.bottom = 'auto';

  // Touch 事件
  orbEl.addEventListener('touchstart', (e) => {
    e.stopPropagation();
    e.preventDefault();
    startDrag(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: false });

  orbEl.addEventListener('touchmove', (e) => {
    e.stopPropagation();
    moveDrag(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: false });

  orbEl.addEventListener('touchend', (e) => {
    e.stopPropagation();
    endDrag();
  });

  // Mouse 事件（调试）
  orbEl.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    startDrag(e.clientX, e.clientY);
  });

  document.addEventListener('mousemove', (e) => {
    moveDrag(e.clientX, e.clientY);
  });

  document.addEventListener('mouseup', () => {
    endDrag();
  });

  // 监听输入栏位置
  initInputBarWatcher();
}