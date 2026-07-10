/**
 * KFM v4 - 悬浮光球 + 召唤面板
 *
 * 交互模式：
 * - 点击光球 → 展开/收起面板
 * - 拖动光球 → 移动位置（光球始终在面板右下角）
 * - 长按进入编辑模式，拖动光球调整面板大小，松手自动退出
 *
 * 约束：
 * - 光球始终在输入栏上方
 * - 光球 z-index > 面板 z-index（光球压住面板）
 * - 面板随光球移动，超出屏幕时自动压缩，回来时恢复
 */

import { measureText, layoutLines } from '../engine/text-layout/index.js';
import { gestures } from './gesture-registry.js';
import { DOM } from "./dom-refs.js";
import { currentTheme as theme } from './theme.js';
import { Registry } from './ui-registry.js';
import { wsChannel } from './ws-channel.js';
import { MARGIN } from './interaction-constants.js';
import { createDragHandler, type DragConfig } from './drag-handler.js';
import { anim } from './animation-registry.js';
import { log } from './logger.js';

interface ChatMessage {
  role: 'user' | 'ai';
  text: string;
  reasoning?: string;
}

type OrbState = 'collapsed' | 'expanded' | 'editing';

type PanelState = 'closed' | 'open' | 'editing';

let orbState: OrbState = 'collapsed';
let panelState: PanelState = 'closed';
let orbEl: HTMLDivElement | null = null;
let panelEl: HTMLDivElement | null = null;

const PANEL_MIN_WIDTH = 120;
const PANEL_MIN_HEIGHT = 100;
const PANEL_DEFAULT_WIDTH = 300;
const PANEL_DEFAULT_HEIGHT = 350;
let panelWidth = PANEL_DEFAULT_WIDTH;
let panelHeight = PANEL_DEFAULT_HEIGHT;

// 实际渲染尺寸（可能被压缩）
let renderWidth = PANEL_DEFAULT_WIDTH;
let renderHeight = PANEL_DEFAULT_HEIGHT;

// 编辑模式：面板左上角位置快照（进入编辑时锁定，松手后恢复）
let savedPanelLeft = 0;
let savedPanelTop = 0;

const ORB_SIZE = 36;
const ORB_HALF = ORB_SIZE / 2;

const chatMessages: ChatMessage[] = [];

// ========== 获取输入栏上边界 ==========
function getInputBarTop(): number {
  const bar = DOM.aiInputBar;
  if (!bar) return window.innerHeight;
  return bar.getBoundingClientRect().top;
}


// ========== 面板目标位置计算 ==========
function getPanelTargetPosition(orbCX: number, orbCY: number): { left: number; top: number; width: number; height: number } {
  let w = panelWidth;
  let h = panelHeight;
  const availLeft = orbCX - MARGIN;
  const availTop = orbCY - MARGIN;
  if (availLeft < w) w = Math.max(PANEL_MIN_WIDTH, availLeft);
  if (availTop < h) h = Math.max(PANEL_MIN_HEIGHT, availTop);
  return { left: orbCX - w, top: orbCY - h, width: w, height: h };
}
// ========== 光球位置约束 ==========
function clampOrbPosition(x: number, y: number): { x: number; y: number } {
  const maxX = window.innerWidth - ORB_SIZE - MARGIN;
  const minX = MARGIN;
  // 终端全屏辅助栏高度补偿（42px aux bar + 4px gap）
  const auxBarEl = document.getElementById('terminal-aux-bar');
  const auxBarH = (auxBarEl && auxBarEl.style.display === 'flex') ? 46 : 0;
  const maxY = getInputBarTop() - ORB_SIZE - MARGIN - auxBarH;
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
    pointer-events: none;
  `;
  panel.dataset.registryId = 'orb-panel';
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
  let idx = 0;
  for (const msg of chatMessages) {
    const isUser = msg.role === 'user';
    const bgColor = isUser
      ? `linear-gradient(${theme.surface.bgLight},${theme.surface.bgLight}) padding-box,${theme.aiChat.bubbleSelfGradient} border-box`
      : `linear-gradient(rgba(10,15,30,0.88),rgba(10,15,30,0.88)) padding-box,${theme.aiChat.panelBorderGradient} border-box`;
    const borderStyle = 'border:1px solid transparent;border-left-width:3px;';
    const align = isUser ? 'flex-end' : 'flex-start';
    const label = isUser ? '你' : '蔚然';
    const labelColor = isUser ? theme.aiChat.bubbleLabelSelf : theme.aiChat.bubbleLabelAI;
    const boxShadow = isUser ? theme.aiChat.bubbleSelfShadow : theme.aiChat.bubbleAIShadow;
    let bubbleHtml = `<div style="font-size:10px;color:${labelColor};margin-bottom:2px;font-weight:600">${label}</div>`;

    // 思考内容（可折叠）
    if (!isUser && msg.reasoning) {
      const rid = 'r' + idx;
      bubbleHtml += `<div onclick="var p=document.getElementById('${rid}');p.style.display=p.style.display==='none'?'':'none'" style="font-size:9px;color:rgba(0,212,255,0.5);cursor:pointer;margin-bottom:2px;user-select:none">💭 已思考 <span style="font-size:7px">▼</span></div>`;
      bubbleHtml += `<div id="${rid}" style="display:none;font-size:var(--card-font-size,10px);line-height:16px;color:rgba(255,255,255,0.45);margin-bottom:4px;padding:4px 6px;border-radius:4px;background:rgba(0,0,0,0.2);white-space:pre-wrap">${escapeHtml(msg.reasoning)}</div>`;
    }

    const font = '13px sans-serif';
    const lineHeight = 20;
    try {
      const lines = layoutLines(msg.text, font, innerWidth - 24, lineHeight);
      const textHtml = lines.map(l => `<span style="display:block">${escapeHtml(l.text)}</span>`).join('');
      bubbleHtml += `<div style="font-family:sans-serif;font-size:var(--card-font-size,13px);line-height:${lineHeight}px;color:${theme.aiChat.bubbleText}">${textHtml}</div>`;
    } catch {
      bubbleHtml += `<div style="font-size:var(--card-font-size,13px);color:${theme.aiChat.bubbleText}">${escapeHtml(msg.text)}</div>`;
    }

    html += `
      <div style="display:flex;justify-content:${align};margin-bottom:8px">
        <div style="max-width:${innerWidth - 8}px;padding:6px 12px;background:${bgColor};${borderStyle}border-radius:8px;box-shadow:${boxShadow}">
          ${bubbleHtml}
        </div>
      </div>`;
    idx++;
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

  // 面板定位：默认右下角对齐光球圆心
  let panelLeft = orbCX - renderWidth;
  let panelTop = orbCY - renderHeight;

  // 编辑模式：左上角固定，只改变大小不改变位置
  if (orbState === 'editing') {
    panelLeft = savedPanelLeft;
    panelTop = savedPanelTop;
  }

  panelEl.style.left = Math.max(screenLeft, panelLeft) + 'px';
  panelEl.style.top = Math.max(screenTop, panelTop) + 'px';
  panelEl.style.width = renderWidth + 'px';
  panelEl.style.height = renderHeight + 'px';
}

// ========== 面板内容 ==========
function buildPanelContent(): void {
  if (!panelEl) return;

  // 渐变配色（跟浮卡内卡反转规则一致：内卡 c2→c1 而非 c1→c2）
  const c1 = 'rgba(0,212,255,0.8)';
  const c2 = 'rgba(124,58,237,0.7)';

  panelEl.innerHTML = `
<div class="orb-panel-content" style="
  flex:1;overflow-y:auto;padding:12px 14px;min-height:0
"></div>
<div style="height:1px;flex-shrink:0;margin:0 10px;background:linear-gradient(90deg,${c1},${c2})"></div>
<div class="orb-model-bar" style="
  display:flex;gap:8px;padding:6px 10px;flex-shrink:0
">
  <div class="orb-opt-trigger" id="orb-prov-trigger" style="
    flex:1;font-size:10px;padding:4px 6px;border-radius:6px;
    background:linear-gradient(rgba(10,10,15,0.92),rgba(10,10,15,0.92)) padding-box,
      linear-gradient(135deg,${c2} 30%,${c1} 70%) border-box;
    border:1px solid transparent;border-left-width:2px;
    color:rgba(255,255,255,0.8);cursor:pointer;user-select:none;
    display:flex;align-items:center;justify-content:space-between
  "><span class="orb-opt-text" id="orb-prov-text">—</span><span style="font-size:10px;opacity:0.6;margin-left:4px">▼</span></div>
  <div class="orb-opt-trigger" id="orb-model-trigger" style="
    flex:1;font-size:10px;padding:4px 6px;border-radius:6px;
    background:linear-gradient(rgba(10,10,15,0.92),rgba(10,10,15,0.92)) padding-box,
      linear-gradient(135deg,${c2} 30%,${c1} 70%) border-box;
    border:1px solid transparent;border-left-width:2px;
    color:rgba(255,255,255,0.8);cursor:pointer;user-select:none;
    display:flex;align-items:center;justify-content:space-between
  "><span class="orb-opt-text" id="orb-model-text">—</span><span style="font-size:10px;opacity:0.6;margin-left:4px">▼</span></div>
</div>
  `;

  // 加载数据 + 绑定
  const base = window.location.pathname.replace(/\/+$/, '') + '/api/';
  const provTrig = document.getElementById('orb-prov-trigger') as HTMLDivElement | null;
  const modelTrig = document.getElementById('orb-model-trigger') as HTMLDivElement | null;
  const provText = document.getElementById('orb-prov-text') as HTMLSpanElement | null;
  const modelText = document.getElementById('orb-model-text') as HTMLSpanElement | null;
  if (!provTrig || !modelTrig || !provText || !modelText) return;

  let providers: any[] = [];
  const saved = (() => { try { return JSON.parse(localStorage.getItem('kfm-chat-config') || '{}'); } catch { return {}; } })();

  function saveConfig(): void {
    localStorage.setItem('kfm-chat-config', JSON.stringify({
      providerId: provText!.textContent === '—' ? '' : providers.find((p: any) => (p.name || p.id) === provText!.textContent)?.id || '',
      modelId: modelText!.textContent === '—' ? '' : modelText!.textContent,
    }));
  }
  let _openTrig: HTMLDivElement | null = null;
  let _closeHandler: ((e: PointerEvent) => void) | null = null;

  function closeDropdown(): void {
    const existing = document.querySelector('.orb-dropdown-panel');
    if (existing) existing.remove();
    if (_closeHandler) { document.removeEventListener('pointerdown', _closeHandler); _closeHandler = null; }
    _openTrig = null;
  }

  function showDropdown(trigger: HTMLDivElement, items: { label: string; value: string }[], onPick: (value: string) => void): void {
    if (_openTrig === trigger) { closeDropdown(); return; }
    closeDropdown();
    _openTrig = trigger;
    const panel = document.createElement('div');
    panel.className = 'orb-dropdown-panel';
    panel.style.cssText = 'position:fixed;z-index:9999;border-radius:6px;padding:3px;background:rgba(20,16,32,0.96);backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,0.1);overflow:hidden;min-width:100px';
    items.forEach(item => {
      const row = document.createElement('div');
      row.style.cssText = 'padding:4px 8px;border-radius:4px;font-size:10px;cursor:pointer;color:rgba(255,255,255,0.8)';
      row.textContent = item.label;
      row.onmouseenter = () => { row.style.background = 'rgba(255,255,255,0.06)'; };
      row.onmouseleave = () => { row.style.background = ''; };
      row.onclick = (ev: PointerEvent) => { ev.stopPropagation(); onPick(item.value); closeDropdown(); };
      panel.appendChild(row);
    });
    const r = trigger.getBoundingClientRect();
    panel.style.left = r.left + 'px';
    panel.style.top = (r.top - 4) + 'px';
    panel.style.minWidth = Math.max(r.width, 100) + 'px';
    document.body.appendChild(panel);
    const panelH = panel.getBoundingClientRect().height;
    panel.style.top = Math.max(4, r.top - panelH) + 'px';
    _closeHandler = (e: PointerEvent) => {
      if (!panel.contains(e.target as Node) && !trigger.contains(e.target as Node)) {
        closeDropdown();
      }
    };
    document.addEventListener('pointerdown', _closeHandler);
  }

  fetch(base + 'files/read', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: 'kfmv4/.kfmv4/providers.json' }),
  }).then(r => r.json()).then(data => {
    providers = data.content ? JSON.parse(data.content) : [];
    const curProv = providers.find((p: any) => p.id === saved.providerId) || providers[0];
    if (curProv) {
      provText.textContent = curProv.name || curProv.id;
      modelText.textContent = saved.modelId || curProv.models?.[0] || '—';
    }
  }).catch(() => {});

  provTrig.onclick = (e: MouseEvent) => {
    e.stopPropagation();
    showDropdown(provTrig, providers.map((p: any) => ({ label: p.name || p.id, value: p.id })), (id) => {
      const p = providers.find((x: any) => x.id === id);
      if (!p) return;
      provText.textContent = p.name || p.id;
      modelText.textContent = p.models?.[0] || '—';
      saveConfig();
    });
  };

  modelTrig.onclick = (e: MouseEvent) => {
    e.stopPropagation();
    const curProv = providers.find((p: any) => (p.name || p.id) === provText.textContent);
    if (!curProv) return;
    showDropdown(modelTrig, (curProv.models || []).map((m: string) => ({ label: m, value: m })), (model) => {
      modelText.textContent = model;
      saveConfig();
    });
  };
}

// ========== 状态切换 ==========
function expandPanel(): void {
  if (!panelEl) panelEl = createPanel();
  if (orbState === 'collapsed') {
    orbState = 'expanded';
    panelState = 'open';
    buildPanelContent();
    updatePanelPosition();
    // 加载存储的字号偏好
    const stored = localStorage.getItem('kfm-fontsize-orb');
    if (stored) {
      try {
        const p = JSON.parse(stored);
        if (typeof p.fontSize === 'number' && panelEl) {
          panelEl.style.setProperty('--card-font-size', p.fontSize + 'px');
        }
      } catch {}
    }
    renderChatContent();
    Registry.notifyStateChange('orb');
    Registry.notifyStateChange('orb-panel');
    panelEl.style.pointerEvents = 'auto';
    anim.to(panelEl, { opacity: 1, duration: 0.3, ease: 'power2.out' });
    updateStateLabel();
  }
}

function collapsePanel(): void {
  if (orbState === 'expanded') {
    orbState = 'collapsed';
    panelState = 'closed';
    if (panelEl) {
      anim.to(panelEl, {
        opacity: 0, duration: 0.3, ease: 'power2.out',
        onComplete: () => { panelEl!.style.pointerEvents = 'none'; },
      });
    }
    updateStateLabel();
    Registry.notifyStateChange('orb');
    Registry.notifyStateChange('orb-panel');
  }
}

function enterEditMode(): void {
  if (orbState !== 'expanded') return;
  orbState = 'editing';
  panelState = 'editing';
  Registry.notifyStateChange('orb');
  Registry.notifyStateChange('orb-panel');

  // 快照面板位置（编辑模式下面板左上角固定）
  if (panelEl) {
    savedPanelLeft = parseFloat(panelEl.style.left) || 0;
    savedPanelTop = parseFloat(panelEl.style.top) || 0;
    panelEl.style.boxShadow = theme.aiChat.panelShadowEdit;
  }
  updateStateLabel();
}

function exitEditMode(): void {
  if (orbState !== 'editing') return;
  panelState = 'open';
  orbState = 'expanded';
  if (panelEl) {
    panelEl.style.boxShadow = theme.aiChat.panelShadow;
  }
  Registry.notifyStateChange('orb');
  Registry.notifyStateChange('orb-panel');
  renderChatContent();
  updateStateLabel();
}

function togglePanel(): void {
  if (orbState === 'collapsed') expandPanel();
  else if (orbState === 'expanded') collapsePanel();
}

function updateStateLabel(): void {
  if (!panelEl) return;
  const label = DOM.orbPanelState(panelEl);
  if (!label) return;
  const labels: Record<OrbState, string> = { collapsed: '', expanded: '长按编辑大小', editing: '拖动调整大小 · 松手完成' };
  label.textContent = labels[orbState];
}

// ========== 监听输入栏位置变化（输入法弹出时光球跟随） ==========
// 记录光球的"自由位置"（不受输入栏约束时的位置）
let freeOrbX = -1;
let freeOrbY = -1;
let lastBarTop = -1;
let isOrbPushed = false; // 光球是否因输入栏被挤压

function initInputBarWatcher(): void {
  if (!orbEl) return;
  const rect = orbEl.getBoundingClientRect();
  freeOrbX = rect.left;
  freeOrbY = rect.top;
  lastBarTop = getInputBarTop();

  const onResize = () => {
    const barTop = getInputBarTop();
    if (barTop === lastBarTop) return;
    lastBarTop = barTop;

    const clamped = clampOrbPosition(freeOrbX, freeOrbY);
    const needsPush = (freeOrbY !== clamped.y);

    const orbRect = orbEl!.getBoundingClientRect();
    const orbCurrentX = orbRect.left;
    const orbCurrentY = orbRect.top;

    let orbTargetX = orbCurrentX;
    let orbTargetY = orbCurrentY;

    if (needsPush) {
      isOrbPushed = true;
      orbTargetX = clamped.x;
      orbTargetY = clamped.y;
    } else if (isOrbPushed) {
      isOrbPushed = false;
      orbTargetX = freeOrbX;
      orbTargetY = freeOrbY;
    } else {
      return;
    }

    orbEl!.style.right = 'auto';
    orbEl!.style.bottom = 'auto';

    // 光球平滑动画
    anim.to(orbEl!, {
      left: orbTargetX, top: orbTargetY,
      duration: 0.1, ease: 'power2.out',
    });

    // 面板同步平滑动画
    if (panelEl && orbState !== 'collapsed') {
      const panelTarget = getPanelTargetPosition(orbTargetX + ORB_HALF, orbTargetY + ORB_HALF);
      anim.to(panelEl, {
        left: panelTarget.left, top: panelTarget.top,
        width: panelTarget.width, height: panelTarget.height,
        duration: 0.1, ease: 'power2.out',
        onComplete: () => {
          renderWidth = panelTarget.width;
          renderHeight = panelTarget.height;
          if (orbState === 'expanded') renderChatContent();
        },
      });
    }
  };

  window.visualViewport?.addEventListener('resize', onResize);
}

// ========== 初始化 ==========
export function initOrb(): void {
  orbEl = DOM.lightOrb;
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
  freeOrbX = clamped.x;
  freeOrbY = clamped.y;

  // 统一输入事件 → GestureRegistry（由共享 drag-handler 封装状态机）
  const dragCfg: DragConfig = {
    getElement: () => orbEl,
    canStart: () => true,
    getOrbStartRect: () => orbEl!.getBoundingClientRect(),
    minEditW: PANEL_MIN_WIDTH,
    minEditH: PANEL_MIN_HEIGHT,
    clamp: clampOrbPosition,
    isEditing: () => orbState === 'editing',
    onEnterEdit: enterEditMode,
    onExitEdit: exitEditMode,
    onTap: togglePanel,
    onSavePosition: () => {
      if (!orbEl) return;
      const r = orbEl.getBoundingClientRect();
      freeOrbX = r.left;
      freeOrbY = r.top;
    },
    onMoveNormal({ dx, dy, startOrbX, startOrbY }) {
      const rawX = startOrbX + dx;
      const rawY = startOrbY + dy;
      const clamped = clampOrbPosition(rawX, rawY);
      orbEl!.style.left = clamped.x + 'px';
      orbEl!.style.top = clamped.y + 'px';
      orbEl!.style.right = 'auto';
      orbEl!.style.bottom = 'auto';
      orbEl!.style.transition = 'none';
      if (orbState === 'expanded' && panelEl) {
        updatePanelPosition();
        renderChatContent();
      }
    },
    onMoveEditing({ dx, dy, startOrbX, startOrbY }) {
      if (!orbEl || !panelEl) return;
      const rawX = startOrbX + dx;
      const rawY = startOrbY + dy;
      const screenClamped = clampOrbPosition(rawX, rawY);
      const minOrbX = savedPanelLeft + PANEL_MIN_WIDTH - ORB_HALF;
      const minOrbY = savedPanelTop + PANEL_MIN_HEIGHT - ORB_HALF;
      const orbX = Math.max(minOrbX, screenClamped.x);
      const orbY = Math.max(minOrbY, screenClamped.y);
      const orbCX = orbX + ORB_HALF;
      const orbCY = orbY + ORB_HALF;
      panelWidth = Math.max(PANEL_MIN_WIDTH, orbCX - savedPanelLeft);
      panelHeight = Math.max(PANEL_MIN_HEIGHT, orbCY - savedPanelTop);
      orbEl.style.left = orbX + 'px';
      orbEl.style.top = orbY + 'px';
      orbEl.style.right = 'auto';
      orbEl.style.bottom = 'auto';
      updatePanelPosition();
      renderChatContent();
    },
  };

  const drag = createDragHandler(dragCfg);
  gestures.register({
    id: "orb",
    targetFilter: ".light-orb",
    priority: 100,
    stopPropagation: true,
    onStart: drag.onStart,
    onMove: drag.onMove,
    onEnd: drag.onEnd,
  });

  // 监听输入栏位置
  initInputBarWatcher();

  // 注册 UI 元素
  Registry.registerElement({
    id: 'orb',
    type: 'floating-button',
    label: '光球',
    description: 'AI 对话主入口',
    state: 'collapsed',
    enabled: true,
    effect: '点击后展开光球，显示 AI 输入框和聊天记录',
    source: 'orb.ts',
  }, () => orbState);
  Registry.registerElement({
    id: 'orb-panel',
    type: 'panel',
    label: 'AI 对话面板',
    description: 'AI 聊天对话面板',
    state: 'closed',
    enabled: true,
    effect: '展开后显示聊天消息，可输入文字与 AI 对话',
    source: 'orb.ts',
  }, () => panelState);

  // 注册内容层：AI 对话摘要（使用生成器，每次 snapshot 返回最新消息）
  Registry.registerContentGenerator('orb-chat', () => ({
    id: 'orb-chat',
    type: 'text-output',
    summary: chatMessages.length > 0
      ? `最后一条消息: ${chatMessages[chatMessages.length - 1].role === 'user' ? '我' : 'AI'}说「${chatMessages[chatMessages.length - 1].text.slice(0, 40)}${chatMessages[chatMessages.length - 1].text.length > 40 ? '…' : ''}」`
      : '暂无对话历史',
  }));

  // 注册 AI 指令处理器
  wsChannel.onCommand('expand-orb', () => { if (orbState === 'collapsed') { expandPanel(); } });
  wsChannel.onCommand('collapse-orb', () => { if (orbState === 'expanded') { collapsePanel(); } });
  wsChannel.onCommand('toggle-orb', () => { togglePanel(); });

  // ========== 聊发送绑定 ==========
  const inputEl = DOM.aiInput;
  const sendBtn = DOM.aiSendBtn;
  if (inputEl && sendBtn) {
    const base = window.location.pathname.replace(/\/+$/, '') + '/api/';

    async function doSend(): Promise<void> {
      const text = inputEl!.value.trim();
      if (!text) return;
      inputEl!.value = '';
      // 如果光球折叠，自动展开
      if (orbState === 'collapsed') expandPanel();
      inputEl!.style.height = 'auto';

      chatMessages.push({ role: 'user', text });
      renderChatContent();

      try {
        // 读当前 Provider 和模型选择
        const config = (() => { try { return JSON.parse(localStorage.getItem('kfm-chat-config') || '{}'); } catch { return {}; } })();
        const res = await fetch(base + 'files/read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: 'kfmv4/.kfmv4/providers.json' }),
        });
        const data = await res.json();
        const providers = data.content ? JSON.parse(data.content) : [];
        const p = providers.find((prov: any) => prov.id === config.providerId) || providers[0];
        if (!p) {
          chatMessages.push({ role: 'ai', text: '⚠ 未配置 API Provider，请先在 API 卡中添加。' });
          renderChatContent();
          return;
        }
        const model = config.modelId || p.models[0] || 'deepseek-v4-flash';

        // 发消息到 API
        const apiRes = await fetch(base + 'proxy/fetch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: p.baseUrl + '/chat/completions',
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + p.apiKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model,
              messages: [{ role: 'user', content: text }],
              max_tokens: 8192,
              reasoning_effort: 'max',
            }),
          }),
        });
        const result = await apiRes.json();
        const msg = result?.data?.choices?.[0]?.message || {};
        const reply = msg.content || '⚠ 未获取到回复';
        const reasoning = msg.reasoning_content || '';
        chatMessages.push({ role: 'ai', text: reply, reasoning });
      } catch (e) {
        chatMessages.push({ role: 'ai', text: '⚠ 请求失败: ' + (e instanceof Error ? e.message : '未知错误') });
      }
      renderChatContent();
    }

    inputEl.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend(); }
    });
    sendBtn.addEventListener('click', () => doSend());
  }
 }

