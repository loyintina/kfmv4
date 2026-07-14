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
import { marked } from 'marked';
import { DOM } from "./dom-refs.js";
import { currentTheme as theme } from './theme.js';
import { Registry } from './ui-registry.js';
import { wsChannel } from './ws-channel.js';
import { MARGIN } from './interaction-constants.js';
import { createDragHandler, type DragConfig } from './drag-handler.js';
import { anim } from './animation-registry.js';
import { log } from './logger.js';
import { sessionStore } from './session-store.js';
import { createCustomSelect, type CustomSelect } from './custom-select.js';

const API_BASE = window.location.pathname.replace(/\/+$/, '') + '/api/';

async function readActiveConfig(): Promise<Record<string, string>> {
  try {
    const res = await fetch(API_BASE + 'files/read', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '.kfmv4/active.json' }),
    });
    const data = await res.json();
    return data.content ? JSON.parse(data.content) : {};
  } catch { return {}; }
}

async function patchActiveConfig(patch: Record<string, string>): Promise<void> {
  const current = await readActiveConfig();
  const merged = { ...current, ...patch };
  fetch(API_BASE + 'files/write', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: '.kfmv4/active.json', content: JSON.stringify(merged) }),
  }).catch(() => {});
}

interface Provider {
  id: string;
  name: string;
  baseUrl: string;
  models: string[];
}

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
let _orbSessionSelect: ReturnType<typeof import('./custom-select.js').createCustomSelect> | null = null;

const PANEL_MIN_WIDTH = 120;
const PANEL_MIN_HEIGHT = 100;
const PANEL_DEFAULT_WIDTH = 300;
const PANEL_DEFAULT_HEIGHT = 350;
let panelWidth = PANEL_DEFAULT_WIDTH;
let panelHeight = PANEL_DEFAULT_HEIGHT;

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

    const lineHeight = 20;
    bubbleHtml += `<div class="orb-msg-text" data-msg-idx="${idx}" style="font-family:sans-serif;font-size:var(--card-font-size,13px);line-height:${lineHeight}px;color:${theme.aiChat.bubbleText};white-space:pre-wrap;word-break:break-word">${renderMarkdown(msg.text)}</div>`;

    const maxWidth = isUser ? Math.min(innerWidth - 8, innerWidth * 0.85) : innerWidth - 8;
    html += `
      <div style="display:flex;justify-content:${align};margin-bottom:8px">
        <div style="max-width:${maxWidth}px;padding:6px 12px;background:${bgColor};${borderStyle}border-radius:8px;box-shadow:${boxShadow}">
          ${bubbleHtml}
        </div>
      </div>`;
    idx++;
  }
  contentArea.innerHTML = html;
  contentArea.scrollTop = contentArea.scrollHeight;
  // 异步渲染 markdown
  const msgEls = contentArea.querySelectorAll<HTMLElement>('.orb-msg-text');
  for (const el of msgEls) {
    const i = parseInt(el.dataset.msgIdx || '-1', 10);
    if (i >= 0 && i < chatMessages.length && chatMessages[i].role !== 'user') {
      const text = chatMessages[i].text;
      if (text && text.length > 0) {
        renderMarkdownAsync(text).then(mdHtml => {
          el.innerHTML = mdHtml;
          highlightAll(el);
        });
      }
    }
  }
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// highlight.js CDN 加载
let _hljsReady = false;
function _loadHljs(): void {
  if (_hljsReady || document.querySelector('link[href*="highlight.js"]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/github-dark.min.css';
  document.head.appendChild(link);
  const script = document.createElement('script');
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/highlight.min.js';
  script.onload = () => { _hljsReady = true; };
  document.head.appendChild(script);
}

async function renderMarkdownAsync(text: string): Promise<string> {
  return await marked.parse(text);
}

function renderMarkdown(text: string): string {
  return escapeHtml(text);
}

function highlightAll(el: HTMLElement): void {
  _loadHljs();
  el.querySelectorAll('pre code').forEach((block) => {
    try { (window as any).hljs?.highlightElement(block as HTMLElement); } catch {}
  });
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

  const c1 = 'rgba(0,212,255,0.8)';
  const c2 = 'rgba(124,58,237,0.7)';

  panelEl.innerHTML = `
<div class="orb-header-bar" style="
  display:flex;align-items:center;justify-content:space-between;
  padding:8px 14px;flex-shrink:0;
  border-bottom:1px solid rgba(255,255,255,0.06)
">
  <div id="orb-role-select-container"></div>
  <div id="orb-session-select-container"></div>
</div>
<div class="orb-panel-content" style="
  flex:1;overflow-y:auto;padding:12px 14px;min-height:0
"></div>
<div style="height:1px;flex-shrink:0;margin:0 10px;background:linear-gradient(90deg,${c1},${c2})"></div>
<div class="orb-model-bar" style="
  display:flex;gap:8px;padding:6px 10px;flex-shrink:0
">
  <div id="orb-prov-container" style="flex:1;min-width:0"></div>
  <div id="orb-model-container" style="flex:1;min-width:0"></div>
</div>
  `;

  const base = window.location.pathname.replace(/\/+$/, '') + '/api/';
  let providers: Provider[] = [];

  function saveConfig(): void {
    const provId = provSelect?.getValue() || '';
    const modelId = modelSelect?.getValue() || '';
    patchActiveConfig({ providerId: provId, modelId: modelId });
  }

  let provSelect: CustomSelect | null = null;
  let modelSelect: CustomSelect | null = null;

  async function updateProviderSelect(): Promise<void> {
    if (!provSelect || !modelSelect) return;
    const active = await readActiveConfig();
    const curProv = active.providerId
      ? providers.find((p: Provider) => p.id === active.providerId)
      : undefined;
    provSelect.updateItems(
      providers.map((p: Provider) => ({ label: p.name || p.id, value: p.id })),
      curProv?.id || ''
    );
    if (curProv) {
      modelSelect.updateItems(
        (curProv.models || []).map((m: string) => ({ label: m, value: m })),
        active.modelId || ''
      );
    }
  }

  const roleContainer = document.getElementById('orb-role-select-container');
  if (roleContainer) {
    const roleSelect = createCustomSelect({
      accent: c1, accent2: c2, placeholder: '角色', minWidth: 70, maxWidth: 110,
      onSelect: async (roleFile) => {
        await patchActiveConfig({ roleFile });
        window.dispatchEvent(new CustomEvent('kfm-role-change', { detail: { roleId: roleFile } }));
      },
    });
    roleContainer.appendChild(roleSelect.element);
    (async () => {
      let roleFiles: string[] = [];
      try {
        const res = await fetch(base + 'files/list', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: '.kfmv4/roles' }),
        });
        const data = await res.json();
        roleFiles = (data.items || []).map((f: { name: string }) => f.name.replace('.json', '')).filter((n: string) => n);
      } catch {}
      const active = await readActiveConfig();
      const currentRole = active.roleFile || (roleFiles[0] || '');
      roleSelect.updateItems(roleFiles.map((n: string) => ({ label: n, value: n })), currentRole);
    })();
    window.addEventListener('kfm-role-change', ((e: CustomEvent) => {
      if (e.detail?.roleId) roleSelect.setValue(e.detail.roleId);
    }) as EventListener);
  }

  const sessionContainer = document.getElementById('orb-session-select-container');
  if (sessionContainer) {
    const sessionSelect = createCustomSelect({
      accent: c1, accent2: c2, placeholder: '选择会话', minWidth: 80, maxWidth: 120,
      onSelect: (sessionId) => { sessionStore.switchTo(sessionId); },
    });
    sessionContainer.appendChild(sessionSelect.element);
    sessionSelect.updateItems(
      sessionStore.list.map(s => ({ label: s.title, value: s.id })),
      sessionStore.activeId || sessionStore.list[0]?.id || ''
    );
    _orbSessionSelect = sessionSelect;
  }

  const provSelectContainer = document.getElementById('orb-prov-container') as HTMLDivElement | null;
  const modelSelectContainer = document.getElementById('orb-model-container') as HTMLDivElement | null;
  if (provSelectContainer && modelSelectContainer) {
    provSelect = createCustomSelect({
      accent: c1, accent2: c2, placeholder: '—', minWidth: 80, direction: 'up',
      onSelect: (id) => {
        const p = providers.find((x: Provider) => x.id === id);
        if (!p) return;
        modelSelect?.updateItems((p.models || []).map((m: string) => ({ label: m, value: m })), p.models?.[0] || '');
        saveConfig();
        window.dispatchEvent(new CustomEvent('kfm-provider-change', { detail: { providerId: id, modelId: p.models?.[0] || '' } }));
      },
    });
    provSelectContainer.appendChild(provSelect.element);
    modelSelect = createCustomSelect({
      accent: c1, accent2: c2, placeholder: '—', minWidth: 80, direction: 'up',
      onSelect: (model) => {
        saveConfig();
        window.dispatchEvent(new CustomEvent('kfm-model-change', { detail: { modelId: model } }));
      },
    });
    modelSelectContainer.appendChild(modelSelect.element);
  }

  fetch(base + 'files/read', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: '.kfmv4/providers.json' }),
  }).then(r => r.json()).then(data => {
    const raw: Array<Record<string, unknown>> = data.content ? JSON.parse(data.content) : [];
    providers = raw.map(p => ({ id: p.id as string, name: p.name as string, baseUrl: p.baseUrl as string, models: p.models as string[] }));
    updateProviderSelect();
  }).catch(() => {});

  window.addEventListener('kfm-provider-change', ((e: CustomEvent) => {
    if (e.detail?.providerId) {
      const p = providers.find((x: Provider) => x.id === e.detail.providerId);
      if (p) {
        provSelect?.setValue(e.detail.providerId);
        modelSelect?.updateItems((p.models || []).map((m: string) => ({ label: m, value: m })), e.detail.modelId || p.models?.[0] || '');
      }
    }
  }) as EventListener);
  window.addEventListener('kfm-model-change', ((e: CustomEvent) => {
    if (e.detail?.modelId) modelSelect?.setValue(e.detail.modelId);
  }) as EventListener);
  window.addEventListener('kfm-config-change', ((e: CustomEvent) => {
    const d = e.detail;
    if (!d) return;
    if (d.providerId) {
      const p = providers.find((x: Provider) => x.id === d.providerId);
      if (p) {
        provSelect?.setValue(d.providerId);
        modelSelect?.updateItems((p.models || []).map((m: string) => ({ label: m, value: m })), d.modelId || p.models?.[0] || '');
      }
    }
    patchActiveConfig({ providerId: d.providerId || '', modelId: d.modelId || '', sessionId: d.sessionId || '' });
  }) as EventListener);
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

export async function initOrb(): Promise<void> {
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
    sessionStore.init(base);
    await sessionStore.load();

    // 加载活跃会话的历史消息
    if (sessionStore.activeId) {
      const msgs = await sessionStore.getMessages(sessionStore.activeId);
      chatMessages.length = 0;
      chatMessages.push(...msgs.map(m => ({ role: m.role as 'user' | 'ai', text: m.text, reasoning: m.reasoning })));
      renderChatContent();
    }

    let abortCtrl: AbortController | null = null;
    function setSending(on: boolean): void {
      if (on) { sendBtn!.classList.add('sending'); }
      else { sendBtn!.classList.remove('sending'); abortCtrl = null; }
    }

    // 监听会话切换 → 重载消息
    window.addEventListener('kfm-session-change', (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail?.sessionId) return;
      sessionStore.activeId = detail.sessionId;
      sessionStore.getMessages(detail.sessionId).then(msgs => {
        chatMessages.length = 0;
        chatMessages.push(...msgs.map(m => ({ role: m.role as 'user' | 'ai', text: m.text, reasoning: m.reasoning })));
        renderChatContent();
        _orbSessionSelect?.updateItems(
          sessionStore.list.map(s => ({ label: s.title, value: s.id })),
          detail.sessionId
        );
      });
    });

    async function doSend(): Promise<void> {
      if (abortCtrl) { abortCtrl.abort(); setSending(false); return; }
      const text = inputEl!.value.trim();
      if (!text) return;
      inputEl!.value = '';
      if (orbState === 'collapsed') expandPanel();
      inputEl!.style.height = 'auto';

      chatMessages.push({ role: 'user', text });
      renderChatContent();

      const config = await readActiveConfig();
      if (!config.providerId) {
        chatMessages.push({ role: 'ai', text: '未配置 Provider，请先在 API 卡中添加并选择一个 Provider。' });
        renderChatContent(); return;
      }
      if (!config.modelId) {
        chatMessages.push({ role: 'ai', text: '未选择 Model，请先在 API 卡或光球面板底部选择一个 Model。' });
        renderChatContent(); return;
      }
      try {
        const model = config.modelId;
        const provider = config.providerId;
        chatMessages.push({ role: 'ai', text: '', reasoning: '' });
        renderChatContent();
        const msgIdx = chatMessages.length - 1;
        let reasoningBuf = ''; let contentBuf = '';

        abortCtrl = new AbortController();
        setSending(true);

        const apiRes = await fetch(base + 'ai/chat', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: chatMessages.slice(0, -1).map(m => ({
              role: m.role === 'ai' ? 'assistant' : m.role,
              content: m.text,
            })),
            model, provider,
          }),
          signal: abortCtrl.signal,
        });

        const reader = apiRes.body?.getReader();
        if (!reader) throw new Error('无响应体');
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const jsonStr = line.slice(6).trim();
            if (jsonStr === '[DONE]') continue;
            try {
              const event = JSON.parse(jsonStr);
              switch (event.type) {
                case 'thinking': reasoningBuf += event.content || ''; chatMessages[msgIdx].reasoning = reasoningBuf; break;
                case 'text': contentBuf += event.content || ''; chatMessages[msgIdx].text = contentBuf; break;
                case 'tool_call': contentBuf += '\n\n[调用工具: ' + event.toolName + '...]'; chatMessages[msgIdx].text = contentBuf; break;
                case 'error': contentBuf += '\n\n[错误: ' + event.content + ']'; chatMessages[msgIdx].text = contentBuf; break;
              }
              renderChatContent();
            } catch {}
          }
        }
        chatMessages[msgIdx].text = contentBuf || '未获取到回复';
        chatMessages[msgIdx].reasoning = reasoningBuf || undefined;
        renderChatContent();
        await sessionStore.saveMessages(chatMessages, config.modelId, config.providerId);
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') {
          chatMessages[chatMessages.length - 1].text = '已取消';
        } else {
          chatMessages.push({ role: 'ai', text: '请求失败: ' + (e instanceof Error ? e.message : '未知错误') });
        }
      }
      setSending(false);
      renderChatContent();
    }

    sendBtn.addEventListener('click', () => doSend());
  }
 }

