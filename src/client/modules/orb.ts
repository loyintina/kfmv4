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

import { gestures } from './gesture-registry.js';
import { DOM } from "./dom-refs.js";
import { currentTheme as theme } from './theme.js';
import { Registry } from './ui-registry.js';
import { wsChannel } from './ws-channel.js';
import { MARGIN } from './interaction-constants.js';
import { createDragHandler, type DragConfig } from './drag-handler.js';
import { anim } from './animation-registry.js';
import { log } from './logger.js';
import { sessionStore } from './session-store.js';
import { buildPanelContent } from './orb-panel.js';
import { renderChatContent, doSend, startWaitingIndicator, type ChatMessage } from './orb-chat.js';
import type { OrbState } from './orb-state.js';
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

// 模块级聊天渲染桥接（renderChatContent 来自 orb-chat.ts）
function _renderChat(): void {
  if (!panelEl) return;
  // resize / 拖拽调整大小时保留用户滚动位置
  renderChatContent({ panelEl, messages: chatMessages, renderWidth, apiBase: API_BASE, scrollMode: 'preserve' });
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

// ========== 状态切换 ==========

export { nextOrbState, type OrbState } from './orb-state.js';
function expandPanel(): void {
  if (!panelEl) panelEl = createPanel();
  if (orbState === 'collapsed') {
    orbState = 'expanded';
    panelState = 'open';
    buildPanelContent({ panelEl: panelEl!, setOrbSessionSelect: (s) => { _orbSessionSelect = s; }, readActiveConfig, patchActiveConfig });
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
    _renderChat();
    // 面板打开时跳到最新消息
    requestAnimationFrame(() => {
      if (!panelEl) return;
      const ca = DOM.orbPanelContent(panelEl);
      if (ca) ca.scrollTop = ca.scrollHeight;
    });
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
  _renderChat();
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
          if (orbState === 'expanded') _renderChat();
        },
      });
    }
  };

  window.visualViewport?.addEventListener('resize', onResize);
}

export async function initOrb(): Promise<void> {
  orbEl = DOM.lightOrb;
  if (!orbEl) return;

  // 光球 z-index 由 z-index.css 的 .light-orb 统一管理（全局最高层，> 面板）

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
        _renderChat();
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
      _renderChat();
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
      ? `最后一条消息: ${chatMessages[chatMessages.length - 1].role === 'user' ? '我' : 'AI'}说「${(chatMessages[chatMessages.length - 1].content.find((b) => b.type === 'text') as { type: 'text'; text: string } | undefined)?.text?.slice(0, 40) || ''}${((chatMessages[chatMessages.length - 1].content.find((b) => b.type === 'text') as { type: 'text'; text: string } | undefined)?.text?.length ?? 0) > 40 ? '…' : ''}」`
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
    const _renderChat = (scrollMode: 'follow' | 'preserve' | 'auto' = 'auto') => { if (panelEl) renderChatContent({ panelEl, messages: chatMessages, renderWidth, apiBase: base, scrollMode }); };
    sessionStore.init(base);
    await sessionStore.load();

    // 加载活跃会话的历史消息
    if (sessionStore.activeId) {
      const msgs = await sessionStore.getMessages(sessionStore.activeId);
      chatMessages.length = 0;
      chatMessages.push(...msgs.map(m => ({ role: m.role as 'user' | 'ai', content: m.content || [] })));
      _renderChat();
    }

    let abortCtrl: AbortController | null = null;

    // 监听会话切换 → 重载消息
    window.addEventListener('kfm-session-change', async (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail?.sessionId) return;
      await sessionStore.load();
      sessionStore.activeId = detail.sessionId;
      _orbSessionSelect?.updateItems(
        sessionStore.list.map(s => ({ label: s.title, value: s.id })),
        detail.sessionId
      );
      sessionStore.getMessages(detail.sessionId).then(msgs => {
        chatMessages.length = 0;
        chatMessages.push(...msgs.map(m => ({ role: m.role as 'user' | 'ai', content: m.content || [] })));
        _renderChat();
      });
    });

    async function handleSend(): Promise<void> {
      if (abortCtrl) { abortCtrl.abort(); abortCtrl = null; sendBtn!.classList.remove('sending'); return; }
      const text = inputEl!.value.trim();
      if (!text) return;
      inputEl!.value = '';
      if (orbState === 'collapsed') expandPanel();
      inputEl!.style.height = 'auto';

      abortCtrl = new AbortController();
      sendBtn!.classList.add('sending');

      // 等待提示动画：doSend 内部第一个 onRender（用户消息入队后立刻触发）后启动
      let stopHint: ((() => void) | null) = null;
      let firstRenderDone = false;

      await doSend(text, chatMessages, base, abortCtrl.signal,
        () => {},
        () => {
          if (!firstRenderDone) {
            // 第一次 onRender = 用户消息已入队，强制追底显示用户消息 + 启动 hint
            firstRenderDone = true;
            stopHint = panelEl ? startWaitingIndicator(panelEl) : null;
            _renderChat('follow');
          } else {
            // 后续 onRender = message_start 或 delta 到达，停 hint
            if (stopHint) { stopHint(); stopHint = null; }
            // 用 auto：renderChatContent 内部的 wasAtBottom 启发式判断
            // 用户上滑离开底部 → preserve，滑回底部 → follow
            _renderChat('auto');
          }
        },
        (msg) => {
          if (stopHint) { stopHint(); stopHint = null; }
          chatMessages.push({ role: 'ai', content: [{ type: 'text', text: msg }] });
          _renderChat('auto');
        },
      );

      // 流结束时确保提示动画已停（静默断流兜底）
      if (stopHint != null) { (stopHint as () => void)(); stopHint = null; }
      abortCtrl = null;
      sendBtn!.classList.remove('sending');
      _renderChat('auto');
    }

    sendBtn.addEventListener('click', () => handleSend());
  }
 }

