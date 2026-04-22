/**
 * KFM v4 - 悬浮光球 + 召唤面板
 * 
 * 交互模式：
 * - 点击光球 → 展开/收起面板
 * - 拖动光球 → 移动位置（收起时移动光球，展开时移动光球+面板）
 * - 长按1.5s → 进入编辑模式（左上角固定，拖动光球调整面板大小）
 * - 编辑模式中再次长按1.5s → 退出编辑模式
 */

// Pretext 文本布局引擎
import { measureText, layoutLines } from '../engine/text-layout/index.js';

interface ChatMessage {
  role: 'user' | 'ai';
  text: string;
}

// 面板状态
type OrbState = 'collapsed' | 'expanded' | 'editing';

let orbState: OrbState = 'collapsed';
let orbEl: HTMLDivElement | null = null;
let panelEl: HTMLDivElement | null = null;

// 面板尺寸
const PANEL_MIN_WIDTH = 200;
const PANEL_MIN_HEIGHT = 150;
const PANEL_DEFAULT_WIDTH = 300;
const PANEL_DEFAULT_HEIGHT = 350;
let panelWidth = PANEL_DEFAULT_WIDTH;
let panelHeight = PANEL_DEFAULT_HEIGHT;

// 拖动状态
let dragging = false;
let dragStartX = 0;
let dragStartY = 0;
let dragStartOrbX = 0;
let dragStartOrbY = 0;
let dragStartPanelX = 0;
let dragStartPanelY = 0;

// 长按计时
let longPressTimer: ReturnType<typeof setTimeout> | null = null;
let longPressFired = false;
const LONG_PRESS_MS = 1500;

// 示例对话数据
const chatMessages: ChatMessage[] = [
  { role: 'ai', text: '你好，我是蔚然。有什么可以帮你的吗？' },
  { role: 'user', text: '帮我分析一下当前的目录结构' },
  { role: 'ai', text: '好的，正在分析目录结构。当前目录下共有 12 个文件夹和 8 个文件。' },
];

// ========== 面板创建 ==========
function createPanel(): HTMLDivElement {
  const panel = document.createElement('div');
  panel.className = 'orb-panel';
  panel.style.cssText = `
    position: fixed;
    width: ${panelWidth}px;
    height: ${panelHeight}px;
    background: rgba(20, 16, 32, 0.92);
    backdrop-filter: blur(16px);
    border: 1px solid rgba(124, 58, 237, 0.3);
    border-radius: 12px;
    box-shadow: 0 0 20px 4px rgba(124, 58, 237, 0.15), 0 8px 32px rgba(0, 0, 0, 0.5);
    z-index: 220;
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

  const innerWidth = panelWidth - 24; // padding
  if (innerWidth < 50) return;

  let html = '';
  for (const msg of chatMessages) {
    const isUser = msg.role === 'user';
    const bgColor = isUser ? 'rgba(124,58,237,0.15)' : 'rgba(46,213,163,0.1)';
    const borderColor = isUser ? 'rgba(124,58,237,0.4)' : 'rgba(46,213,163,0.3)';
    const align = isUser ? 'flex-end' : 'flex-start';
    const label = isUser ? '你' : '蔚然';
    const labelColor = isUser ? '#7c3aed' : '#2ed5a3';

    // 用 Pretext 计算文本高度
    const font = '13px sans-serif';
    const lineHeight = 20;
    try {
      const measured = measureText(msg.text, font, innerWidth - 24, lineHeight);
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
      // Pretext fallback
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

// ========== 面板布局 ==========
function updatePanelPosition(): void {
  if (!orbEl || !panelEl) return;
  const orbRect = orbEl.getBoundingClientRect();
  const orbCX = orbRect.left + orbRect.width / 2;
  const orbCY = orbRect.top + orbRect.height / 2;

  // 面板右下角 = 光球圆心
  const panelLeft = orbCX - panelWidth;
  const panelTop = orbCY - panelHeight;

  // 边界约束
  const clampedLeft = Math.max(8, Math.min(panelLeft, window.innerWidth - panelWidth - 8));
  const clampedTop = Math.max(8, Math.min(panelTop, window.innerHeight - panelHeight - 8));

  panelEl.style.left = clampedLeft + 'px';
  panelEl.style.top = clampedTop + 'px';
  panelEl.style.width = panelWidth + 'px';
  panelEl.style.height = panelHeight + 'px';
}

// ========== 面板内容构建 ==========
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
    <div class="orb-panel-footer" style="
      padding: 8px 12px;
      border-top: 1px solid rgba(124,58,237,0.15);
      display: flex;
      gap: 8px;
      flex-shrink: 0;
    ">
      <button class="orb-btn-clear" style="
        flex: 1;
        padding: 6px 0;
        background: rgba(255,71,117,0.1);
        border: 1px solid rgba(255,71,117,0.3);
        border-radius: 6px;
        color: #ff4775;
        font-size: 12px;
        cursor: pointer;
      ">清空</button>
      <button class="orb-btn-resize" style="
        flex: 1;
        padding: 6px 0;
        background: rgba(124,58,237,0.1);
        border: 1px solid rgba(124,58,237,0.3);
        border-radius: 6px;
        color: #7c3aed;
        font-size: 12px;
        cursor: pointer;
      ">编辑大小</button>
    </div>
  `;

  // 绑定按钮事件
  panelEl.querySelector('.orb-btn-clear')?.addEventListener('click', () => {
    chatMessages.length = 0;
    renderChatContent();
  });
  panelEl.querySelector('.orb-btn-resize')?.addEventListener('click', () => {
    enterEditMode();
  });
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
  renderChatContent(); // 重新排版
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
  const labels: Record<OrbState, string> = { collapsed: '', expanded: '点击长按编辑大小', editing: '拖动光球调整大小 · 长按退出' };
  label.textContent = labels[orbState];
}

// ========== 初始化 ==========
export function initOrb(): void {
  orbEl = document.getElementById('lightOrb') as HTMLDivElement | null;
  if (!orbEl) return;

  // --- Touchstart ---
  orbEl.addEventListener('touchstart', (e) => {
    e.stopPropagation();
    e.preventDefault();

    const touch = e.touches[0];
    dragging = false;
    longPressFired = false;
    dragStartX = touch.clientX;
    dragStartY = touch.clientY;

    const rect = orbEl!.getBoundingClientRect();
    dragStartOrbX = rect.left;
    dragStartOrbY = rect.top;

    if (panelEl) {
      dragStartPanelX = parseFloat(panelEl.style.left) || 0;
      dragStartPanelY = parseFloat(panelEl.style.top) || 0;
    }

    // 长按计时
    longPressTimer = setTimeout(() => {
      longPressFired = true;
      if (orbState === 'expanded') enterEditMode();
      else if (orbState === 'editing') exitEditMode();
    }, LONG_PRESS_MS);
  }, { passive: false });

  // --- Touchmove ---
  orbEl.addEventListener('touchmove', (e) => {
    e.stopPropagation();

    const touch = e.touches[0];
    const dx = touch.clientX - dragStartX;
    const dy = touch.clientY - dragStartY;

    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      dragging = true;
      if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
    }

    if (!dragging) return;

    if (orbState === 'editing') {
      // 编辑模式：左上角固定，拖动光球改变面板大小
      const newOrbX = dragStartOrbX + dx;
      const newOrbY = dragStartOrbY + dy;

      // 面板宽高 = 光球圆心到面板左上角的距离
      const orbCX = newOrbX + 18; // 半径
      const orbCY = newOrbY + 18;
      panelWidth = Math.max(PANEL_MIN_WIDTH, orbCX - dragStartPanelX);
      panelHeight = Math.max(PANEL_MIN_HEIGHT, orbCY - dragStartPanelY);

      // 更新光球位置
      orbEl!.style.left = newOrbX + 'px';
      orbEl!.style.top = newOrbY + 'px';
      orbEl!.style.right = 'auto';
      orbEl!.style.bottom = 'auto';

      updatePanelPosition();
      renderChatContent();
    } else {
      // 普通拖动：移动光球（展开时带着面板）
      const newOrbX = dragStartOrbX + dx;
      const newOrbY = dragStartOrbY + dy;

      orbEl!.style.left = newOrbX + 'px';
      orbEl!.style.top = newOrbY + 'px';
      orbEl!.style.right = 'auto';
      orbEl!.style.bottom = 'auto';
      orbEl!.style.transition = 'none';

      if (orbState === 'expanded' && panelEl) {
        updatePanelPosition();
      }
    }
  }, { passive: false });

  // --- Touchend ---
  orbEl.addEventListener('touchend', (e) => {
    e.stopPropagation();
    if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }

    orbEl!.style.transition = 'box-shadow .2s';

    if (!dragging && !longPressFired) {
      togglePanel();
    }

    dragging = false;
  });

  // --- 鼠标支持（调试用） ---
  let mouseDragging = false;
  orbEl.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    mouseDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
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
  });

  document.addEventListener('mousemove', (e) => {
    if (!mouseDragging) return;
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      dragging = true;
      if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
    }
    if (!dragging) return;

    if (orbState === 'editing') {
      const newOrbX = dragStartOrbX + dx;
      const newOrbY = dragStartOrbY + dy;
      const orbCX = newOrbX + 18;
      const orbCY = newOrbY + 18;
      panelWidth = Math.max(PANEL_MIN_WIDTH, orbCX - dragStartPanelX);
      panelHeight = Math.max(PANEL_MIN_HEIGHT, orbCY - dragStartPanelY);
      orbEl!.style.left = newOrbX + 'px';
      orbEl!.style.top = newOrbY + 'px';
      orbEl!.style.right = 'auto';
      orbEl!.style.bottom = 'auto';
      updatePanelPosition();
      renderChatContent();
    } else {
      orbEl!.style.left = (dragStartOrbX + dx) + 'px';
      orbEl!.style.top = (dragStartOrbY + dy) + 'px';
      orbEl!.style.right = 'auto';
      orbEl!.style.bottom = 'auto';
      if (orbState === 'expanded' && panelEl) updatePanelPosition();
    }
  });

  document.addEventListener('mouseup', () => {
    if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
    if (mouseDragging && !dragging && !longPressFired) togglePanel();
    mouseDragging = false;
    dragging = false;
  });
}
