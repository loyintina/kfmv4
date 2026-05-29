/**
 * debug-panel.ts — 调试面板（青色光球 + 日志面板）
 *
 * 交互：
 * - 点击光球 → 展开/收起面板
 * - 拖动光球 → 移动位置
 * - 长按进入编辑模式，拖动调整面板大小
 * - 面板内：清空按钮 + 复制按钮 + 日志区
 *
 * 日志 API:
 *   debugPanel.log(msg) → 追加一行带时间戳的日志
 *   debugPanel.clear()  → 清空日志区
 */

import { gestures } from './gesture-registry.js';
import { currentTheme as theme } from './theme.js';

type DebugState = 'collapsed' | 'expanded' | 'editing';

let state: DebugState = 'collapsed';
let orbEl: HTMLDivElement | null = null;
let panelEl: HTMLDivElement | null = null;

const ORB_SIZE = 36;
const ORB_HALF = ORB_SIZE / 2;
const MARGIN = 8;
const PANEL_MIN_W = 200;
const PANEL_MIN_H = 120;
const LONG_PRESS_MS = 600;
let panelW = 300, panelH = 250;

// 拖动状态
let dragging = false;
let dragSX = 0, dragSY = 0;
let dragOrbX = 0, dragOrbY = 0;
let longPressTimer: any = null;
let longPressFired = false;

// ========== 日志系统 ==========
const MAX_LOG_LINES = 200;
const logLines: string[] = [];

function formatTime(): string {
  const d = new Date();
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${h}:${m}:${s}.${ms}`;
}

/** 公开：追加日志 */
function debugLog(msg: string): void {
  logLines.push(`[${formatTime()}] ${msg}`);
  if (logLines.length > MAX_LOG_LINES) logLines.shift();
  flushLogUI();
}

/** 公开：清空日志 */
function debugClear(): void {
  logLines.length = 0;
  flushLogUI();
}

/** 公开：复制日志到剪贴板（单行模式：换行符替换为 →，防误提交） */
function debugCopy(): void {
  const text = logLines.join('\n');
  // 替换换行为 → 防止复制到聊天框时自动提交
  const singleLine = text.replace(/\n/g, ' → ');
  navigator.clipboard.writeText(singleLine).then(() => {
    debugLog('📋 日志已复制（单行模式）');
  }).catch(() => {
    debugLog('❌ 复制失败');
  });
}

function flushLogUI(): void {
  if (!panelEl) return;
  const area = panelEl.querySelector('.debug-log-area');
  if (area) {
    area.textContent = logLines.length > 0 ? logLines.join('\n') : '(空)';
    area.scrollTop = area.scrollHeight;
  }
}

// ========== 定位辅助 ==========
function clampOrb(x: number, y: number): { x: number; y: number } {
  return {
    x: Math.max(MARGIN, Math.min(window.innerWidth - ORB_SIZE - MARGIN, x)),
    y: Math.max(MARGIN, Math.min(window.innerHeight - ORB_SIZE - MARGIN, y)),
  };
}

// ========== DOM 创建 ==========
function createOrb(): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'debug-orb';
  el.style.cssText = `
    position: fixed;
    width: ${ORB_SIZE}px;
    height: ${ORB_SIZE}px;
    border-radius: 50%;
    background: ${theme.debug.orbGradient};
    box-shadow: ${theme.debug.orbShadow};
    z-index: 300;
    cursor: pointer;
    transition: box-shadow 0.2s;
    right: 80px;
    bottom: 80px;
  `;
  el.id = 'debugOrb';
  document.body.appendChild(el);
  return el;
}

function createPanel(): HTMLDivElement {
  const panel = document.createElement('div');
  panel.style.cssText = `
    position: fixed;
    background: ${theme.debug.panelBgGradient} padding-box,
                ${theme.debug.panelBorderGradient} border-box;
    backdrop-filter: blur(16px);
    border: 1px solid transparent;
    border-radius: 10px;
    box-shadow: ${theme.debug.panelShadow};
    z-index: 295;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    opacity: 0;
    pointer-events: none;
    font-family: monospace;
  `;
  panel.id = 'debugPanel';
  document.body.appendChild(panel);
  return panel;
}

function buildPanelContent(): void {
  if (!panelEl) return;
  panelEl.innerHTML = `
    <div style="
      padding:6px 10px;
      border-bottom:1px solid ${theme.debug.headerBorder};
      display:flex;justify-content:space-between;align-items:center;
      flex-shrink:0;
    ">
      <span style="font-size:12px;color:rgba(0,255,200,0.9);font-weight:600">🔧 调试面板</span>
      <span style="display:flex;gap:6px">
        <button class="debug-btn-clear" style="
          font-size:11px;padding:3px 10px;
          background:${theme.debug.buttonBg};color:${theme.debug.headerText};
          border:1px solid ${theme.debug.buttonBorder};border-radius:5px;
          cursor:pointer;
        ">清空</button>
        <button class="debug-btn-copy" style="
          font-size:11px;padding:3px 10px;
          background:${theme.debug.buttonBg};color:${theme.debug.headerText};
          border:1px solid ${theme.debug.buttonBorder};border-radius:5px;
          cursor:pointer;
        ">复制</button>
      </span>
    </div>
    <pre class="debug-log-area" style="
      flex:1;
      overflow-y:auto;
      padding:8px 10px;
      margin:0;
      font-size:11px;
      line-height:1.5;
      color:${theme.debug.logText};
      white-space:pre-wrap;
      word-break:break-all;
      min-height:0;
    ">${logLines.length > 0 ? logLines.join('\n') : '(空)'}</pre>
  `;

  // 绑定按钮事件
  panelEl.querySelector('.debug-btn-clear')?.addEventListener('click', () => debugClear());
  panelEl.querySelector('.debug-btn-copy')?.addEventListener('click', () => debugCopy());
}

function updatePanelPosition(): void {
  if (!orbEl || !panelEl) return;
  const r = orbEl.getBoundingClientRect();
  const cx = r.left + ORB_HALF;
  const cy = r.top + ORB_HALF;

  const w = Math.max(PANEL_MIN_W, Math.min(panelW, cx - MARGIN));
  const h = Math.max(PANEL_MIN_H, Math.min(panelH, cy - MARGIN));

  panelEl.style.left = Math.max(MARGIN, cx - w) + 'px';
  panelEl.style.top = Math.max(MARGIN, cy - h) + 'px';
  panelEl.style.width = w + 'px';
  panelEl.style.height = h + 'px';
}

function expandPanel(): void {
  if (!panelEl) panelEl = createPanel();
  if (state === 'collapsed') {
    state = 'expanded';
    buildPanelContent();
    updatePanelPosition();
    panelEl.style.opacity = '1';
    panelEl.style.pointerEvents = 'auto';
  }
}

function collapsePanel(): void {
  if (state === 'expanded') {
    state = 'collapsed';
    if (panelEl) {
      panelEl.style.opacity = '0';
      panelEl.style.pointerEvents = 'none';
    }
  }
}

function enterEdit(): void {
  if (state !== 'expanded') return;
  state = 'editing';
  if (panelEl) panelEl.style.boxShadow = theme.debug.panelShadowEdit;
}

function exitEdit(): void {
  if (state !== 'editing') return;
  state = 'expanded';
  if (panelEl) panelEl.style.boxShadow = theme.debug.panelShadow;
}

function toggle(): void {
  if (state === 'collapsed') expandPanel();
  else if (state === 'expanded') collapsePanel();
}

// ========== 拖动 ==========
function startDrag(x: number, y: number): void {
  dragging = false;
  longPressFired = false;
  dragSX = x;
  dragSY = y;
  const r = orbEl!.getBoundingClientRect();
  dragOrbX = r.left;
  dragOrbY = r.top;

  longPressTimer = setTimeout(() => {
    longPressFired = true;
    if (state === 'expanded') enterEdit();
    else if (state === 'editing') exitEdit();
  }, LONG_PRESS_MS);
}

function moveDrag(x: number, y: number): void {
  const dx = x - dragSX;
  const dy = y - dragSY;
  if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
    dragging = true;
    if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
  }
  if (!dragging || !orbEl) return;

  if (state === 'editing') {
    const raw = clampOrb(dragOrbX + dx, dragOrbY + dy);
    orbEl.style.left = raw.x + 'px';
    orbEl.style.top = raw.y + 'px';
    orbEl.style.right = 'auto';
    orbEl.style.bottom = 'auto';
    const cx = raw.x + ORB_HALF;
    const cy = raw.y + ORB_HALF;
    panelW = Math.max(PANEL_MIN_W, cx - MARGIN);
    panelH = Math.max(PANEL_MIN_H, cy - MARGIN);
    updatePanelPosition();
  } else {
    const raw = clampOrb(dragOrbX + dx, dragOrbY + dy);
    orbEl.style.left = raw.x + 'px';
    orbEl.style.top = raw.y + 'px';
    orbEl.style.right = 'auto';
    orbEl.style.bottom = 'auto';
    orbEl.style.transition = 'none';
    if (state === 'expanded') updatePanelPosition();
  }
}

function endDrag(): void {
  if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
  if (orbEl) orbEl.style.transition = 'box-shadow 0.2s';
  if (state === 'editing') exitEdit();
  if (!dragging && !longPressFired) toggle();
  dragging = false;
}

// ========== 初始化 ==========
export function initDebugPanel(): void {
  orbEl = createOrb();

  // 统一输入事件 → GestureRegistry（PointerEvent 覆盖 touch + mouse）
  gestures.register({
    id: 'debug-orb',
    targetFilter: '#debugOrb',
    priority: 99,
    stopPropagation: true,
    onStart: (e: PointerEvent) => {
      e.preventDefault();
      startDrag(e.clientX, e.clientY);
    },
    onMove: (e: PointerEvent) => {
      moveDrag(e.clientX, e.clientY);
    },
    onEnd: () => endDrag(),
  });

  debugLog('🔧 调试面板已启动');
}
