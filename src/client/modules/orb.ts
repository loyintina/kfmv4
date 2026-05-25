/**
 * KFM v4 - 悬浮光球 + 召唤面板
 *
 * 基于 orb-template.ts 的用例：中央光球 = 通用模板的特例。
 *
 * 与模板的映射：
 * - compact（无卡片，只有光球）→ orbState='collapsed'
 * - expanded（有面板，隐藏 TL/TR/BL）→ orbState='expanded'
 * - editing（编辑面板大小）→ orbState='editing'
 */

import { measureText, layoutLines } from '../engine/text-layout/index.js';
import { gestures } from './gesture-registry.js';
import { DOM } from "./dom-refs.js";
import { currentTheme as theme } from './theme.js';
import { createOrbTemplate, calcPanelTarget } from '../templates/orb-template.js';

interface ChatMessage {
  role: 'user' | 'ai';
  text: string;
}

let orbEl: HTMLDivElement | null = null;
let panelEl: HTMLDivElement | null = null;

const PANEL_MIN_WIDTH = 120;
const PANEL_MIN_HEIGHT = 100;
const PANEL_DEFAULT_WIDTH = 300;
const PANEL_DEFAULT_HEIGHT = 350;
const ORB_SIZE = 36;
const MARGIN = 8;

// 实际渲染尺寸（可能被压缩）
let renderWidth = PANEL_DEFAULT_WIDTH;
let renderHeight = PANEL_DEFAULT_HEIGHT;

const chatMessages: ChatMessage[] = [
  { role: 'ai', text: '你好，我是蔚然。有什么可以帮你的吗？' },
  { role: 'user', text: '帮我分析一下当前的目录结构' },
  { role: 'ai', text: '好的，正在分析目录结构。当前目录下共有 12 个文件夹和 8 个文件。' },
];

// ========== 获取输入栏上边界 ==========
function getInputBarTop(): number {
  const bar = DOM.aiInputBar;
  if (!bar) return window.innerHeight;
  return bar.getBoundingClientRect().top;
}


// ========== 面板目标位置计算（基于模板的 calcPanelTarget） ==========
function getPanelTargetPosition(orbCX: number, orbCY: number): { left: number; top: number; width: number; height: number } {
  const pw = _orbAPI ? _orbAPI.panelWidth : PANEL_DEFAULT_WIDTH;
  const ph = _orbAPI ? _orbAPI.panelHeight : PANEL_DEFAULT_HEIGHT;
  const target = calcPanelTarget(orbCX, orbCY, pw, ph, PANEL_MIN_WIDTH, PANEL_MIN_HEIGHT, MARGIN);
  renderWidth = target.width;
  renderHeight = target.height;
  return target;
}

// ========== 面板创建 ==========
function createPanel(): HTMLDivElement {
  const panel = document.createElement('div');
  panel.className = 'orb-panel';
  panel.style.cssText = `
    position: fixed;
    background: linear-gradient(${theme.surface.bg},${theme.surface.bg}) padding-box, ${theme.aiChat.panelBorderGradient} border-box;
    backdrop-filter: blur(16px);
    border: 1px solid transparent;
    border-left-width: 3px;
    border-radius: 12px;
    box-shadow: ${theme.aiChat.panelShadow};
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
  const contentArea = DOM.orbPanelContent(panelEl);
  if (!contentArea) return;

  const innerWidth = renderWidth - 24;
  if (innerWidth < 50) return;

  let html = '';
  for (const msg of chatMessages) {
    const isUser = msg.role === 'user';
    const bgColor = isUser
      ? `linear-gradient(${theme.surface.bgLight},${theme.surface.bgLight}) padding-box,${theme.aiChat.bubbleSelfGradient} border-box`
      : `linear-gradient(rgba(10,15,30,0.88),rgba(10,15,30,0.88)) padding-box,${theme.aiChat.panelBorderGradient} border-box`;
    const borderStyle = isUser
      ? 'border:1px solid transparent;border-left-width:3px;'
      : 'border:1px solid transparent;border-left-width:3px;';
    const align = isUser ? 'flex-end' : 'flex-start';
    const label = isUser ? '你' : '蔚然';
    const labelColor = isUser ? theme.aiChat.bubbleLabelSelf : theme.aiChat.bubbleLabelAI;
    const boxShadow = isUser ? theme.aiChat.bubbleSelfShadow : theme.aiChat.bubbleAIShadow;

    const font = '13px sans-serif';
    const lineHeight = 20;
    try {
      const lines = layoutLines(msg.text, font, innerWidth - 24, lineHeight);
      const textHtml = lines.map(l => `<span style="display:block">${escapeHtml(l.text)}</span>`).join('');
      html += `
        <div style="display:flex;justify-content:${align};margin-bottom:8px">
          <div style="max-width:${innerWidth - 8}px;padding:6px 12px;background:${bgColor};${borderStyle}border-radius:8px;box-shadow:${boxShadow}">
            <div style="font-size:10px;color:${labelColor};margin-bottom:2px;font-weight:600">${label}</div>
            <div style="font-family:sans-serif;font-size:13px;line-height:${lineHeight}px;color:${theme.aiChat.bubbleText}">${textHtml}</div>
          </div>
        </div>`;
    } catch {
      html += `
        <div style="display:flex;justify-content:${align};margin-bottom:8px">
          <div style="max-width:85%;padding:6px 12px;background:${bgColor};${borderStyle}border-radius:8px;box-shadow:${boxShadow}">
            <div style="font-size:10px;color:${labelColor};margin-bottom:2px;font-weight:600">${label}</div>
            <div style="font-size:13px;color:${theme.aiChat.bubbleText}">${escapeHtml(msg.text)}</div>
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
// ========== 面板内容 ==========
function buildPanelContent(): void {
  if (!panelEl) return;
  panelEl.innerHTML = `
<div class="orb-panel-content" style="
  flex:1;overflow-y:auto;padding:12px 14px;min-height:0
"></div>
  `;
}

// ========== 状态标签 ==========
function updateStateLabel(state: string): void {
  if (!panelEl) return;
  const label = DOM.orbPanelState(panelEl);
  if (!label) return;
  const labels: Record<string, string> = { compact: '', expanded: '长按编辑大小', editing: '拖动调整大小 · 松手完成' };
  label.textContent = labels[state] || '';
}

// ========== 基于模板的交互内核 ==========
let _orbAPI: ReturnType<typeof createOrbTemplate> | null = null;

// ========== 监听输入栏位置变化（输入法弹出时光球跟随） ==========
let _lastBarTop = -1;
let _isOrbPushed = false;

function initInputBarWatcher(): void {
  const check = () => {
    if (!orbEl || !_orbAPI) { requestAnimationFrame(check); return; }
    const barTop = getInputBarTop();
    if (barTop !== _lastBarTop) {
      _lastBarTop = barTop;
      // 光球和面板会由模板的 constraintRect 自动适配
    }
    requestAnimationFrame(check);
  };
  requestAnimationFrame(check);
}

// ========== 初始化 ==========
export function initOrb(): void {
  orbEl = DOM.lightOrb;
  if (!orbEl) return;
  orbEl.style.zIndex = '210';

  // 创建模板实例
  _orbAPI = createOrbTemplate({
    anchor: orbEl,
    anchorSize: ORB_SIZE,
    minWidth: PANEL_MIN_WIDTH,
    minHeight: PANEL_MIN_HEIGHT,
    defaultWidth: PANEL_DEFAULT_WIDTH,
    defaultHeight: PANEL_DEFAULT_HEIGHT,
    constraintRect: () => ({
      top: 8,
      left: 8,
      right: window.innerWidth - 8,
      bottom: getInputBarTop() - 8,
    }),
    clickToggle: () => {
      if (_orbAPI!.state === 'compact') {
        if (!panelEl) panelEl = createPanel();
        panelEl.style.opacity = '1';
        panelEl.style.pointerEvents = 'auto';
        buildPanelContent();
        _orbAPI!.panelWidth = PANEL_DEFAULT_WIDTH;
        _orbAPI!.panelHeight = PANEL_DEFAULT_HEIGHT;
        renderChatContent();
        updateStateLabel('expanded');
      } else {
        if (panelEl) {
          panelEl.style.opacity = '0';
          panelEl.style.pointerEvents = 'none';
        }
        updateStateLabel('compact');
      }
    },
    onUpdatePosition: (_s, cx, cy, _pw, _ph) => {
      if (!panelEl) return;
      const target = getPanelTargetPosition(cx, cy);
      panelEl.style.left = target.left + 'px';
      panelEl.style.top = target.top + 'px';
      panelEl.style.width = target.width + 'px';
      panelEl.style.height = target.height + 'px';
    },
    onEnterEdit: () => {
      if (panelEl) panelEl.style.boxShadow = theme.aiChat.panelShadowEdit;
      updateStateLabel('editing');
    },
    onExitEdit: () => {
      if (panelEl) panelEl.style.boxShadow = theme.aiChat.panelShadow;
      renderChatContent();
      updateStateLabel('expanded');
    },
  });

  // 获取模板的 startDrag/moveDrag/endDrag
  const { startDrag: s, moveDrag: m, endDrag: e } = _orbAPI;

  gestures.register({
    id: "orb",
    targetFilter: ".light-orb",
    priority: 100,
    stopPropagation: true,
    onStart: (ev: PointerEvent) => {
      ev.preventDefault();
      s(ev.clientX, ev.clientY);
    },
    onMove: (ev: PointerEvent) => {
      m(ev.clientX, ev.clientY);
    },
    onEnd: () => {
      e();
    },
  });

  initInputBarWatcher();
}