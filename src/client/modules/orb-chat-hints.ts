/**
 * orb-chat-hints.ts — 等待提示 + 工具提示 + Todo 面板
 *
 * 从 orb-chat.ts 拆分（v8 审计：706 行 → 3 文件）。
 * 职责：
 *   - startWaitingIndicator: AI 生成期间的随机提示动画
 *   - getToolHint/clearToolHint: 工具执行期间的随机提示（每工具独立打乱）
 *   - Todo 面板：浮动任务列表（sticky 在面板顶部）
 *
 * 依赖：
 *   - DOM.orbPanelContent（面板内容区引用）
 *   - Z.TODO_PANEL（z-index 层级）
 *   - WAITING_HINTS（100 条随机提示数据）
 */

import { DOM } from './dom-refs.js';
import { Z } from './z-index-layers.js';
import { WAITING_HINTS } from '../data/waiting-hints.js';
import type { ToolBlock } from './session-client.js';

// ========== 等待提示动画 ==========
// 设计：attach 到 orb-panel-content 尾部的独立 DOM 节点，由 chat-dom.ts patchEvent 增量更新。
// start() 返回 stop 函数；message_start 到达后 orb.ts 调 stop() 移除节点。

const HINT_ID = 'orb-waiting-hint';

export function startWaitingIndicator(panelEl: HTMLDivElement): () => void {
  const contentArea = DOM.orbPanelContent(panelEl);
  if (!contentArea) return () => {};

  // 移除可能残留的旧节点
  contentArea.querySelector('#' + HINT_ID)?.remove();

  const el = document.createElement('div');
  el.id = HINT_ID;
  el.style.cssText = [
    'display:flex;align-items:center;gap:6px',
    'padding:5px 10px;margin-bottom:6px',
    'border-radius:8px',
    'background:linear-gradient(rgba(10,15,30,0.6),rgba(10,15,30,0.6)) padding-box,' +
      'linear-gradient(135deg,rgba(0,212,255,0.18),rgba(124,58,237,0.18)) border-box',
    'border:1px solid transparent;border-left-width:3px',
    'font-size:var(--card-font-size,10px)',
  ].join(';');

  const dot = document.createElement('span');
  dot.style.cssText = [
    'width:5px;height:5px;border-radius:50%;flex-shrink:0',
    'background:rgba(0,212,255,0.6)',
    'animation:orb-hint-pulse 1.2s ease-in-out infinite',
  ].join(';');

  const txt = document.createElement('span');
  txt.style.cssText = 'color:rgba(255,255,255,0.75);transition:opacity 0.3s';

  el.appendChild(dot);
  el.appendChild(txt);
  contentArea.appendChild(el);

  // 注入脉冲 CSS（仅一次）
  if (!document.getElementById('orb-hint-css')) {
    const style = document.createElement('style');
    style.id = 'orb-hint-css';
    style.textContent = '@keyframes orb-hint-pulse{0%,100%{opacity:0.4;transform:scale(1)}50%{opacity:1;transform:scale(1.3)}}';
    document.head.appendChild(style);
  }

  // 随机打乱提示顺序，循环播放
  const pool = [...WAITING_HINTS].sort(() => Math.random() - 0.5);
  let pos = 0;
  let timerId: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  function next(): void {
    if (stopped) return;
    txt.style.opacity = '0';
    setTimeout(() => {
      if (stopped) return;
      txt.textContent = pool[pos % pool.length];
      pos++;
      txt.style.opacity = '1';
    }, 150);
    // 随机间隔 800-2200ms，看起来忙碌但不规律
    const delay = 800 + Math.random() * 1400;
    timerId = setTimeout(next, delay);
  }

  // 第一条立即显示
  txt.textContent = pool[pos % pool.length];
  txt.style.opacity = '1';
  pos++;
  timerId = setTimeout(next, 800 + Math.random() * 1400);

  // 等待提示出现时始终滚到底（提示应始终可见）
  contentArea.scrollTop = contentArea.scrollHeight;

  return function stop(): void {
    stopped = true;
    timerId && clearTimeout(timerId);
    el.remove();
  };
}

// ========== 工具执行期随机提示（每工具独立打乱列表） ==========
// 设计：与等待提示共用 WAITING_HINTS 数据源，但每个工具调用有自己的随机打乱顺序。
// 渲染时带脉冲圆点动画，与 startWaitingIndicator 同款视觉风格。
// tool_result 到达后由 doSend 调 clearToolHint 清除对应条目。

const _toolHints = new Map<string, { pool: string[]; start: number }>();

export function getToolHint(toolId: string): { text: string; dotHtml: string } {
  let h = _toolHints.get(toolId);
  if (!h) {
    h = { pool: [...WAITING_HINTS].sort(() => Math.random() - 0.5), start: Date.now() };
    _toolHints.set(toolId, h);
  }
  const elapsed = Date.now() - h.start;
  const interval = elapsed < 2000 ? 2000 : 1500;
  const idx = Math.floor(elapsed / interval) % h.pool.length;
  return {
    text: h.pool[idx],
    dotHtml: '<span style="display:inline-block;width:5px;height:5px;border-radius:50%;background:rgba(0,212,255,0.6);animation:orb-hint-pulse 1.2s ease-in-out infinite;vertical-align:middle;margin-right:5px"></span>',
  };
}

export function clearToolHint(toolId: string): void {
  _toolHints.delete(toolId);
}

// ========== 浮动 Todo 面板 ==========
let _todoPanel: HTMLDivElement | null = null;
let _todoDismissTimer: ReturnType<typeof setTimeout> | null = null;
let _lastTodos: Array<{content: string; status: string}> | null = null; // 持久化状态

// 圆角方案：border-image 会覆盖 border-radius，改用 background 双层渐变
// 即 padding-box（内）和 border-box（外）两段渐变实现圆角边框。
// 定位方案：贴在面板的滚动内容区（.orb-panel-content）顶部，用 position:sticky
// 让面板在消息滚动时保持可见；不贴在 panelEl 上以免挡住右上角会话下拉框。
const TODO_GRADIENT = 'linear-gradient(rgba(10,15,30,0.94),rgba(10,15,30,0.94)) padding-box,linear-gradient(135deg,rgba(0,212,255,0.5),rgba(124,58,237,0.5)) border-box';

function ensureTodoPanel(panelEl: HTMLElement): HTMLDivElement {
  const contentArea = DOM.orbPanelContent(panelEl);
  const target = contentArea || panelEl;
  // 用 wrapper 类名标识已存在；_todoPanel 指向内层面板，不直接用 _todoPanel.parentElement
  // 因为外层有 sticky wrapper，parentElement 是 wrapper 而非 target。
  let wrapper = target.querySelector('.orb-todo-wrapper') as HTMLDivElement | null;
  if (!wrapper) {
    wrapper = document.createElement('div');
    wrapper.className = 'orb-todo-wrapper';
    wrapper.style.cssText = 'position:sticky;top:-12px;display:flex;justify-content:flex-end;z-index:' + Z.TODO_PANEL + ';pointer-events:none';
    _todoPanel = document.createElement('div');
    _todoPanel.className = 'orb-todo-panel';
    _todoPanel.style.cssText = 'min-width:140px;max-width:220px;background:' + TODO_GRADIENT + ';border:1px solid transparent;border-radius:8px;padding:6px 8px;font-size:9px;box-shadow:0 2px 12px rgba(0,0,0,0.4);overflow:hidden;transition:opacity 0.3s;pointer-events:auto';
    wrapper.appendChild(_todoPanel);
    target.prepend(wrapper);
  } else {
    wrapper.style.cssText = 'position:sticky;top:-12px;display:flex;justify-content:flex-end;z-index:' + Z.TODO_PANEL + ';pointer-events:none';
    _todoPanel = wrapper.querySelector('.orb-todo-panel') as HTMLDivElement | null;
    if (!_todoPanel) {
      _todoPanel = document.createElement('div');
      _todoPanel.className = 'orb-todo-panel';
      _todoPanel.style.cssText = 'min-width:140px;max-width:220px;background:' + TODO_GRADIENT + ';border:1px solid transparent;border-radius:8px;padding:6px 8px;font-size:9px;box-shadow:0 2px 12px rgba(0,0,0,0.4);overflow:hidden;transition:opacity 0.3s;pointer-events:auto';
      wrapper.appendChild(_todoPanel);
    }
  }
  return _todoPanel;
}

function renderTodoPanel(todos: Array<{content: string; status: string}>, panelEl: HTMLElement): void {
  const panel = ensureTodoPanel(panelEl);
  if (todos.length === 0) { panel.style.opacity = '0'; return; }
  panel.style.opacity = '1';
  const doneCount = todos.filter(t => t.status === 'completed' || t.status === 'cancelled').length;
  const allDone = doneCount === todos.length;
  let html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;gap:6px">';
  html += '<span style="color:rgba(0,212,255,0.7);font-weight:600;font-size:8px">📋 ' + doneCount + '/' + todos.length + '</span>';
  html += '<span class="orb-todo-close" style="color:rgba(255,80,80,0.7);font-size:9px;cursor:pointer;user-select:none;font-weight:700;line-height:1" onclick="var p=this.closest(\'.orb-todo-panel\');if(p){p.style.opacity=\'0\';}try{window.__clearTodoPanel()}catch(e){}">✕</span>';
  html += '</div>';
  for (const t of todos) {
    const s = t.status;
    const icon = s === 'completed' ? '✓' : s === 'in_progress' ? '●' : s === 'cancelled' ? '✕' : '○';
    const color = s === 'completed' ? 'rgba(80,255,160,0.8)'
      : s === 'in_progress' ? 'rgba(0,212,255,0.9)'
      : s === 'cancelled' ? 'rgba(255,100,100,0.7)'
      : 'rgba(255,255,255,0.55)';
    const deco = s === 'completed' || s === 'cancelled' ? 'text-decoration:line-through;' : '';
    const pulse = s === 'in_progress' ? 'animation:orb-todo-pulse 1.5s ease-in-out infinite;' : '';
    html += '<div style="display:flex;gap:4px;padding:1px 0;align-items:baseline;' + deco + '">';
    html += '<span style="color:' + color + ';font-size:8px;flex-shrink:0;' + pulse + '">' + icon + '</span>';
    // 内联 escapeHtml：只替换 & < >
    const escaped = t.content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    html += '<span style="color:' + color + ';font-size:8px;line-height:1.3;word-break:break-word;' + deco + '">' + escaped + '</span>';
    html += '</div>';
  }
  panel.innerHTML = html;
  if (allDone) {
    if (_todoDismissTimer) {
      clearTimeout(_todoDismissTimer);
      _todoDismissTimer = null;
    }
  } else {
    if (_todoDismissTimer) {
      clearTimeout(_todoDismissTimer);
      _todoDismissTimer = null;
    }
    _todoDismissTimer = setTimeout(() => { panel.style.opacity = '0'; _lastTodos = null; }, 5000);
  }
}

/** 切换会话时清理 todo 面板（防止旧会话的任务列表残留） */
export function clearTodoPanel(): void {
  _lastTodos = null;
  _todoDismissTimer && clearTimeout(_todoDismissTimer);
  _todoDismissTimer = null;
  if (_todoPanel) { _todoPanel.style.opacity = '0'; }
}
(window as unknown as Record<string, unknown>).__clearTodoPanel = clearTodoPanel; // escape-ok: 供内联 onclick 关闭 todo 面板时清理内部状态

export function updateTodoFromTool(tc: ToolBlock): void {
  if (tc.name !== 'todo' || !tc.result || tc.result.isError) return;
  const todos = (tc.input?.todos as Array<{content: string; status: string}> | undefined) || [];
  _lastTodos = todos.length > 0 ? todos : null;
}
