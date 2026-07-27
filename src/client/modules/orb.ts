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
 *
 * 面板生命周期（v8.1）：
 * - 面板 DOM 在 initOrb 时一次性创建（ensurePanel），expand/collapse 只切显隐，
 *   不再 innerHTML 重建——历史消息 DOM 与会话数据天然同步，「展开时补渲」整类
 *   竞态从根源消除（v8.0 每次展开重建面板导致 _contentArea 失效，靠订阅补渲兜底）。
 * - 历史消息窗口化挂载：首屏只挂末尾 MOUNT_WINDOW 条，滚动近顶部经 chat-dom 的
 *   setHistoryLoader 回调翻页 prepend。chatMessages 始终持有全量（发送上下文需要），
 *   窗口只控制 DOM 规模。为什么不做全量挂载：markdown/hljs 全量同步渲染是
 *   v8.0 展开卡顿 2-3s 的根因。
 * - 拖拽期间临时关面板 backdrop-filter（每帧 GPU 模糊合成是拖动卡顿主因），松手恢复。
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
import { sessionStore } from './session-client.js';
import { buildPanelContent } from './orb-panel.js';
import { doSend, resumeRun, readPersistedRun, clearPersistedRun, clearTodoPanel, startWaitingIndicator, setEventHook, updateTodoFromTool, type ChatMessage, type ToolBlock } from './orb-chat.js';
import { initChatDom, patchEvent, clearChatDom, mountUserMessage, mountAiMessage, mountFallbackAiMessage, scrollToBottom, suspendScroll, resumeScroll, withScrollAnchor, setHistoryLoader, getFollowBottom, setFollowBottom } from './chat-dom.js';
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
let _panelUpdateScheduled = false;

const PANEL_MIN_WIDTH = 120;
const PANEL_MIN_HEIGHT = 100;
const PANEL_DEFAULT_WIDTH = 300;
const PANEL_DEFAULT_HEIGHT = 350;
const PANEL_BLUR = 'blur(8px)';
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

// 模块级聊天渲染桥接（v8：增量 DOM，resize 时只需滚动）
// v8.1：仅 followBottom 时追底——拖拽/编辑松手不应把上滑浏览的用户拽回底部。
function _renderChat(): void {
  if (!panelEl) return;
  if (getFollowBottom()) scrollToBottom();
}

// ========== 历史消息窗口化挂载（v8.1） ==========
// chatMessages 持有全量历史（发送上下文需要），DOM 只挂载尾部一个窗口。
// 为什么窗口编排在 orb 而非 chat-dom：窗口语义 = 「chatMessages 索引 ↔ DOM」
// 映射策略，属于本模块的编排职责；chat-dom 只提供 prepend/锚定/翻页回调原语。
const MOUNT_WINDOW = 20; // 首屏挂载条数
const OLDER_BATCH = 20;  // 向上翻页批量
let _oldestMounted = 0;  // chatMessages 中已挂载的最老索引

function _mountOne(i: number, atTop = false): void {
  const m = chatMessages[i];
  if (m.role === 'user') {
    const tb = m.content.find(b => b?.type === 'text');
    mountUserMessage(i, tb && 'text' in tb ? tb.text : '', atTop);
  } else {
    mountAiMessage(i, m.content, atTop);
  }
}

// 重挂尾部窗口（会话加载/切换/历史补齐段到达后）。补齐段 unshift 会使已挂载
// 索引整体偏移，所以这里总是全清重挂——窗口只有 20 条且有渲染缓存，成本可忽略。
function _mountHistoryWindow(): void {
  clearChatDom();
  _oldestMounted = Math.max(0, chatMessages.length - MOUNT_WINDOW);
  suspendScroll();
  for (let i = _oldestMounted; i < chatMessages.length; i++) _mountOne(i);
  setHistoryLoader(_oldestMounted > 0 ? _loadOlderHistory : null);
  resumeScroll(true); // 批量挂载后只追底一次
  _restoreTodoPanel();
}

// v7 行为恢复：历史窗口（重）挂载后，从数据层找回最近一次 todo 工具结果重挂面板。
// v8 曾只有 live tool_result 触发 updateTodoFromTool——刷新/切会话后面板消失。
function _restoreTodoPanel(): void {
  for (let i = chatMessages.length - 1; i >= 0; i--) {
    const tb = chatMessages[i].content.find(
      (b): b is ToolBlock => b?.type === 'tool' && b.name === 'todo' && !!b.result
    );
    if (tb) { updateTodoFromTool(tb); return; }
  }
}

// 滚动近顶部时向前翻一页（由 chat-dom 滚动监听同步触发）
function _loadOlderHistory(): void {
  if (_oldestMounted === 0) { setHistoryLoader(null); return; }
  const from = Math.max(0, _oldestMounted - OLDER_BATCH);
  suspendScroll();
  withScrollAnchor(() => {
    for (let i = from; i < _oldestMounted; i++) _mountOne(i, true);
  });
  _oldestMounted = from;
  resumeScroll(false);
  if (_oldestMounted === 0) setHistoryLoader(null);
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
    backdrop-filter: ${PANEL_BLUR};
    -webkit-backdrop-filter: ${PANEL_BLUR};
    border: 1px solid transparent;
    border-left-width: 3px;
    border-radius: 12px;
    box-shadow: ${theme.aiChat.panelShadow};
    display: flex;
    flex-direction: column;
    overflow: hidden;
    opacity: 0;
    pointer-events: none;
    will-change: opacity;
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

// 面板 DOM 只创建一次（见文件头「面板生命周期」）。initOrb 与 expandPanel 双入口调用。
function ensurePanel(): void {
  if (panelEl) return;
  panelEl = createPanel();
  buildPanelContent({ panelEl, setOrbSessionSelect: (s) => { _orbSessionSelect = s; }, readActiveConfig, patchActiveConfig });
  initChatDom(panelEl, () => { /* TODO: loadFileTree */ });
}

function expandPanel(): void {
  if (orbState !== 'collapsed') return;
  ensurePanel();
  orbState = 'expanded';
  panelState = 'open';
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
  panelEl!.style.pointerEvents = 'auto';
  // DOM 持久化后消息早已挂载好，展开只需跳到最新；
  // 仅用户本就在底部时追底——上滑浏览历史时展开面板不应把视口拽回底部
  requestAnimationFrame(() => { if (getFollowBottom()) scrollToBottom(); });
  Registry.notifyStateChange('orb');
  Registry.notifyStateChange('orb-panel');
  anim.to(panelEl!, { opacity: 1, duration: 0.3, ease: 'power2.out' });
  updateStateLabel();
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

// ========== 拖拽期面板模糊挂起（v8.1） ==========
// backdrop-filter 让面板区域每帧重跑 GPU 模糊合成，是拖动卡顿的主因之一。
// 拖动第一帧挂起，onSavePosition（含 pointercancel）恢复。
let _blurSuspended = false;
function _suspendPanelBlur(): void {
  if (_blurSuspended || !panelEl || orbState === 'collapsed') return;
  _blurSuspended = true;
  panelEl.style.setProperty('backdrop-filter', 'none');
  panelEl.style.setProperty('-webkit-backdrop-filter', 'none');
}
function _restorePanelBlur(): void {
  if (!_blurSuspended || !panelEl) return;
  _blurSuspended = false;
  panelEl.style.setProperty('backdrop-filter', PANEL_BLUR);
  panelEl.style.setProperty('-webkit-backdrop-filter', PANEL_BLUR);
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
      _restorePanelBlur();
      if (!orbEl) return;
      const r = orbEl.getBoundingClientRect();
      freeOrbX = r.left;
      freeOrbY = r.top;
      // 拖拽结束：更新面板位置
      if (orbState === 'expanded' && panelEl) {
        updatePanelPosition();
        _renderChat();
      }
    },
    onMoveNormal({ dx, dy, startOrbX, startOrbY }) {
      _suspendPanelBlur();
      const rawX = startOrbX + dx;
      const rawY = startOrbY + dy;
      const clamped = clampOrbPosition(rawX, rawY);
      orbEl!.style.left = clamped.x + 'px';
      orbEl!.style.top = clamped.y + 'px';
      orbEl!.style.right = 'auto';
      orbEl!.style.bottom = 'auto';
      orbEl!.style.transition = 'none';
      // 面板跟随光球（rAF 合帧：每帧最多一次位置计算+写入）。
      // 226c2fb 曾整体跳过面板更新治卡顿——那是治标；content-visibility +
      // 模糊挂起根治成本后，恢复文件头设计的「面板随光球移动」。
      // 不调 _renderChat：scrollHeight 读取=强制 reflow，松手后 onSavePosition 统一滚。
      if (orbState !== 'collapsed' && !_panelUpdateScheduled) {
        _panelUpdateScheduled = true;
        requestAnimationFrame(() => {
          _panelUpdateScheduled = false;
          updatePanelPosition();
        });
      }
    },
    onMoveEditing({ dx, dy, startOrbX, startOrbY }) {
      if (!orbEl || !panelEl) return;
      _suspendPanelBlur();
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
      if (!_panelUpdateScheduled) {
        _panelUpdateScheduled = true;
        requestAnimationFrame(() => {
          _panelUpdateScheduled = false;
          updatePanelPosition();
          _renderChat();
        });
      }
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

  // 面板 DOM 一次性创建（见文件头「面板生命周期」）：之后会话加载/流式事件
  // 直接投影到这个常驻 DOM，expand 只切显隐。
  ensurePanel();

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
    // scrollMode 语义（v8.1 恢复 v7 契约）：
    //   follow  = 强制追底（发送/首轮渲染），并重新附着底部
    //   auto    = 仅用户本就在底部时追底（流式事件默认；上滑浏览时不拽回）
    //   preserve= 不动（DOM 持久化后视觉位置天然保持，无需补偿）
    const _renderChat = (scrollMode: 'follow' | 'preserve' | 'auto' = 'auto') => {
      if (scrollMode === 'follow') { setFollowBottom(true); scrollToBottom(); }
      else if (scrollMode === 'auto' && getFollowBottom()) scrollToBottom();
    };
    setEventHook(patchEvent);
    sessionStore.init(base);
    await sessionStore.load();

    let abortCtrl: AbortController | null = null;
    let _switchToken = 0; // 会话切换序号，防并发切换的过期加载覆盖
    let _renderedSessionId = ''; // 当前已渲染到聊天面板的会话 id（guard 用，不依赖 sessionStore.activeId）

    // 分段加载会话到聊天面板：先取末尾 TAIL_FIRST 条立即渲染（追底可见），
    // 其余更早的消息后台补拉进数据层（不直接进 DOM，由窗口翻页按需挂载）。
    // _switchToken 防并发切换的过期覆盖。
    const TAIL_FIRST = 12;
    async function loadSessionInto(sid: string): Promise<void> {
      const myToken = _switchToken;
      const first = await sessionStore.getMessagesRange(sid, 'tail', 0, TAIL_FIRST);
      if (myToken !== _switchToken) return;
      chatMessages.length = 0;
      chatMessages.push(...first.messages.map(m => ({ role: m.role as 'user' | 'ai', content: m.content || [] })));
      _renderedSessionId = sid;
      _mountHistoryWindow();

      if (first.total > first.messages.length) {
        const rest = await sessionStore.getMessagesRange(sid, 'head', 0, first.total - first.messages.length);
        if (myToken !== _switchToken || _renderedSessionId !== sid) return;
        chatMessages.unshift(...rest.messages.map(m => ({ role: m.role as 'user' | 'ai', content: m.content || [] })));
        _mountHistoryWindow(); // unshift 偏移了索引，重挂窗口校正（窗口小 + 缓存，成本可忽略）
      }
    }

    // 加载活跃会话的历史消息（分段：末尾优先）
    if (sessionStore.activeId) {
      await loadSessionInto(sessionStore.activeId);
    }

    // 页面恢复（刷新/切后台回来）：若上次有未完成的后台 run 且属于当前会话，
    // 自动重连续读——补齐刷新期间错过的输出并继续实时尾随。这是"挂机持久化"入口。
    (async () => {
      const persisted = readPersistedRun();
      if (!persisted || persisted.sessionId !== sessionStore.activeId) { if (persisted) clearPersistedRun(); return; }
      // 校验服务端该 run 是否还在（进程重启后运行态已丢）
      try {
        const chk = await fetch(base + 'ai/chat/active?sessionId=' + encodeURIComponent(persisted.sessionId)).then(r => r.json());
        if (!chk.runId || chk.runId !== persisted.runId) { clearPersistedRun(); return; }
        if (chk.done) { clearPersistedRun(); return; } // 已完成无需重连（终态由续读或历史呈现）
      } catch { clearPersistedRun(); return; }
      if (orbState === 'collapsed') expandPanel();
      // 复用 handleSend 的 abortCtrl + 按钮态：重连期间按钮显示"发送中"，点击=中断
      abortCtrl = new AbortController();
      sendBtn!.classList.add('sending');
      let stopHint2: (() => void) | null = null;
      const setWait2 = (w: boolean) => {
        if (w) { if (!stopHint2 && panelEl) stopHint2 = startWaitingIndicator(panelEl); }
        else if (stopHint2) { stopHint2(); stopHint2 = null; }
      };
      // 从头续读：服务端缓冲了本轮全部事件，from=0 全量重放重建 AI 回复
      await resumeRun(base, persisted.runId, 0, chatMessages, abortCtrl.signal,
        () => _renderChat('auto'), setWait2,
      );
      setWait2(false);
      abortCtrl = null;
      sendBtn!.classList.remove('sending');
      clearPersistedRun();
    })();

    // v8 冷恢复：检测"未完成的对话"（kfm-restart 后 AI 工具执行完了但没来得及回应）
    // 判据：末尾是 AI 消息且含 tool result → 工具执行完了但 AI 还没回应（回应会是新 message）
    // 防护：restartCount 计数器防止无限循环（连续自动 resume 超过 3 次则停止）
    async function tryAutoResume(): Promise<void> {
      if (!sessionStore.activeId || chatMessages.length === 0) return;
      const RESTART_COUNT_KEY = 'kfm-restart-count';
      const MAX_RESTART_COUNT = 3;
      let restartCount = 0;
      try { restartCount = parseInt(localStorage.getItem(RESTART_COUNT_KEY) || '0', 10); } catch {}
      if (restartCount >= MAX_RESTART_COUNT) {
        try { localStorage.removeItem(RESTART_COUNT_KEY); } catch {}
        return;
      }
      const last = chatMessages[chatMessages.length - 1];
      if (last.role !== 'ai') return;
      const hasToolResult = last.content.some(b => b?.type === 'tool' && b.result);
      if (!hasToolResult) return;
      const sid = sessionStore.activeId;
      const meta = sessionStore.list.find(s => s.id === sid);
      const model = meta?.modelId || '';
      const provider = meta?.providerId || '';
      if (!model || !provider) return;
      // 构建 apiMessages（复用 doSend 的格式转换逻辑）
      const apiMessages: Array<{ role: string; content: string | null; tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>; tool_call_id?: string }> = [];
      for (const m of chatMessages) {
        if (m.role === 'user') {
          const text = m.content.filter(b => b?.type === 'text').map(b => ('text' in b ? b.text : '')).join('');
          apiMessages.push({ role: 'user', content: text });
        } else {
          const textBlocks = m.content.filter(b => b?.type === 'text');
          const toolBlocks = m.content.filter(b => b?.type === 'tool');
          const mainText = textBlocks.map(b => ('text' in b ? b.text : '')).join('');
          if (toolBlocks.length > 0) {
            const toolCalls = toolBlocks.map(tc => ({
              id: ('id' in tc ? tc.id : '') as string,
              type: 'function' as const,
              function: { name: ('name' in tc ? tc.name : '') as string, arguments: JSON.stringify('input' in tc ? tc.input : {}) },
            }));
            apiMessages.push({ role: 'assistant', content: mainText || null, tool_calls: toolCalls });
            for (const tc of toolBlocks) {
              const resultText = ('result' in tc && tc.result?.content?.map(c => c.text || '').join('')) || '';
              apiMessages.push({ role: 'tool', content: resultText, tool_call_id: ('id' in tc ? tc.id : '') as string });
            }
          } else {
            apiMessages.push({ role: 'assistant', content: mainText });
          }
        }
      }
      try {
        const res = await fetch(base + 'ai/chat/start', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: sid, messages: apiMessages, model, provider }),
        });
        const data = await res.json();
        if (data.runId) {
          // 自动续读（复用 resumeRun 路径）
          if (orbState === 'collapsed') expandPanel();
          // 等面板展开动画完成（~300ms），确保 page-state snapshot 反映展开态
          const { promise: delayPromise, resolve: delayResolve } = Promise.withResolvers<void>();
          setTimeout(delayResolve, 400);
          await delayPromise;
          abortCtrl = new AbortController();
          sendBtn!.classList.add('sending');
          let stopHintR: (() => void) | null = null;
          const setWaitR = (w: boolean) => {
            if (w) { if (!stopHintR && panelEl) stopHintR = startWaitingIndicator(panelEl); }
            else if (stopHintR) { stopHintR(); stopHintR = null; }
          };
          setWaitR(true);
          await resumeRun(base, data.runId, 0, chatMessages, abortCtrl.signal,
            () => _renderChat('auto'), setWaitR,
          );
          sendBtn!.classList.remove('sending');
          _renderChat('auto');
          // 递增重启计数（防止无限循环）
          try { localStorage.setItem(RESTART_COUNT_KEY, String(restartCount + 1)); } catch {}
        }
      } catch { /* 网络失败静默，用户可手动重发 */ }
    }
    tryAutoResume();

    // 监听会话切换 → 中止进行中的 run + 分段重载消息
    // 竞态防护：切换前 abort 进行中流式 run，防止流继续写入已切走的会话。
    // guard 用 _renderedSessionId（本模块真相），不用 sessionStore.activeId——后者
    // 会被 sessionStore.init() 的监听器抢先改掉，导致 guard 误判、切换被跳过。
    window.addEventListener('kfm-session-change', async (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const sid: string = detail?.sessionId ?? '';
      // 目标已是当前渲染的会话且无进行中 run → 无需重载，避免打断流式
      if (sid && sid === _renderedSessionId && !abortCtrl) return;
      // 中止进行中的后台 run（流式尾随）
      if (abortCtrl) { abortCtrl.abort(); abortCtrl = null; sendBtn!.classList.remove('sending'); }
      // 清理旧会话的 todo 面板（防止残留）
      clearTodoPanel();
      const myToken = ++_switchToken;
      await sessionStore.load();
      if (myToken !== _switchToken) return; // 期间又切换，放弃
      sessionStore.activeId = sid;
      _orbSessionSelect?.updateItems(
        sessionStore.list.map(s => ({ label: s.title, value: s.id })),
        sid
      );
      if (!sid) {
        chatMessages.length = 0;
        _renderedSessionId = '';
        clearChatDom(); // 面板 DOM 持久化后必须显式清空（v8.0 靠重建面板顺带清掉）
        return;
      }
      await loadSessionInto(sid);
    });

    async function handleSend(): Promise<void> {
      if (abortCtrl) { abortCtrl.abort(); abortCtrl = null; sendBtn!.classList.remove('sending'); return; }
      const text = inputEl!.value.trim();
      if (!text) return;
      // 用户手动发送 → 重置重启计数（允许下次冷恢复自动 resume）
      try { localStorage.removeItem('kfm-restart-count'); } catch {}
      inputEl!.value = '';
      if (orbState === 'collapsed') expandPanel();
      inputEl!.style.height = 'auto';

      abortCtrl = new AbortController();
      sendBtn!.classList.add('sending');

      // 等待提示动画：由 doSend 的 onWait 显式控制——
      //   发送后 / 每轮 message_stop 后（工具调用后 AI 再次请求的空档）起提示，
      //   message_start 到达即停。覆盖工具轮次之间的等待，不再只在首次请求时显示。
      let stopHint: (() => void) | null = null;
      let firstRenderDone = false;
      const setWait = (waiting: boolean) => {
        if (waiting) {
          if (!stopHint && panelEl) stopHint = startWaitingIndicator(panelEl);
        } else {
          if (stopHint) { stopHint(); stopHint = null; }
        }
      };
      // 发送即起提示（用户消息入队前）
      setWait(true);

      await doSend(text, chatMessages, base, abortCtrl.signal,
        () => {
          // onBeforeSend: 用户消息已入队（doSend 内部 push 后调此回调）
          // live 发送传 animate=true：滑入动画（v7 orb-msg-new 行为恢复，历史挂载不动画）
          mountUserMessage(chatMessages.length - 1, text, false, true);
          scrollToBottom();
        },
        () => {
          if (!firstRenderDone) {
            // 第一次 onRender = 用户消息已入队，强制追底显示用户消息
            firstRenderDone = true;
            _renderChat('follow');
          } else {
            _renderChat('auto');
          }
        },
        (msg) => {
          setWait(false);
          chatMessages.push({ role: 'ai', content: [{ type: 'text', text: msg }] });
          // 兜底消息必须显式上屏——_renderChat 只滚动不挂载（v8 曾只 push 数据层，用户看不到）
          mountFallbackAiMessage(msg);
          _renderChat('auto');
        },
        setWait,
        sessionStore.activeId || '',
      );

      // 流结束兜底：确保提示已停
      setWait(false);
      abortCtrl = null;
      sendBtn!.classList.remove('sending');
      _renderChat('auto');
    }

    sendBtn.addEventListener('click', () => handleSend());
  }
 }

