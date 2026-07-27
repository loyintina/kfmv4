/**
 * orb-chat.ts — AI 对话消息渲染与 SSE 流式通信
 *
 * 从 orb.ts 拆分出聊天相关逻辑。orb.ts 负责光球 UI / 手势 / 面板状态机，
 * 本模块负责消息气泡渲染、Markdown 管线和 SSE 流式请求。
 *
 * 消息采用 content block 数组模型（对齐 Claude/OpenAI 标准）：
 *   ChatMessage.content = Array<TextBlock | ToolBlock | RuleWarningBlock>
 *
 * SSE 协议（服务端 → 客户端）：
 *   message_start → content_block_start/delta/stop → tool_result → message_stop
 */

import { KFMState } from './state.js';
import { loadFileTree } from './tree-loader.js';
import { DOM } from './dom-refs.js';
import { sessionStore } from './session-client.js';
import type { ContentBlock, TextBlock, ToolBlock, RuleWarningBlock } from './session-client.js';
import { marked } from 'marked';
import { preprocessMd, MARKED_OPTS } from './renderers/md-extensions.js';
import { Z } from './z-index-layers.js';
import { type MathData } from './renderers/math-diagram.js';
import { WAITING_HINTS } from '../data/waiting-hints.js';

// ========== 类型 ==========

export type { ContentBlock, TextBlock, ToolBlock, RuleWarningBlock } from './session-client.js';

/** 消息结构：content 是 block 数组，一次 AI 回复 = 一条消息 = 多个 block */
export interface ChatMessage {
  role: 'user' | 'ai';
  content: ContentBlock[];
}

// ========== 工具函数 ==========

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

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
  scrollToBottom(contentArea);

  return function stop(): void {
    stopped = true;
    if (timerId !== null) clearTimeout(timerId);
    el.remove();
  };
}

// ========== 工具执行期随机提示（每工具独立打乱列表） ==========
// 设计：与等待提示共用 WAITING_HINTS 数据源，但每个工具调用有自己的随机打乱顺序。
// 渲染时带脉冲圆点动画，与 startWaitingIndicator 同款视觉风格。
// tool_result 到达后由 doSend 调 clearToolHint 清除对应条目。

const _toolHints = new Map<string, { pool: string[]; start: number }>();

function getToolHint(toolId: string): { text: string; dotHtml: string } {
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

function clearToolHint(toolId: string): void {
  _toolHints.delete(toolId);
}


// v8 事件钩子：orb.ts 在 ?renderer=v8 模式下注入 chat-dom.patchEvent，
// 每个 SSE 事件在 _applyEvent 之后额外调此钩子做增量 DOM 投影。
let _eventHook: ((event: any) => void) | null = null;
export function setEventHook(fn: ((event: any) => void) | null): void { _eventHook = fn; }


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
    html += '<span style="color:' + color + ';font-size:8px;line-height:1.3;word-break:break-word;' + deco + '">' + escapeHtml(t.content) + '</span>';
    html += '</div>';
  }
  panel.innerHTML = html;
  if (allDone) {
    if (_todoDismissTimer) clearTimeout(_todoDismissTimer);
    _todoDismissTimer = setTimeout(() => { panel.style.opacity = '0'; _lastTodos = null; }, 5000);
  } else {
    if (_todoDismissTimer) { clearTimeout(_todoDismissTimer); _todoDismissTimer = null; }
  }
}

/** 切换会话时清理 todo 面板（防止旧会话的任务列表残留） */
export function clearTodoPanel(): void {
  _lastTodos = null;
  if (_todoDismissTimer) { clearTimeout(_todoDismissTimer); _todoDismissTimer = null; }
  if (_todoPanel) { _todoPanel.style.opacity = '0'; }
}
(window as unknown as Record<string, unknown>).__clearTodoPanel = clearTodoPanel; // escape-ok: 供内联 onclick 关闭 todo 面板时清理内部状态

function updateTodoFromTool(tc: ToolBlock): void {
  if (tc.name !== 'todo' || !tc.result || tc.result.isError) return;
  const todos = (tc.input?.todos as Array<{content: string; status: string}> | undefined) || [];
  _lastTodos = todos.length > 0 ? todos : null;
}


// ========== 滚动追底状态 ==========
// 反复回归的老问题（4次）根治方案：区分「用户主动手势」和「程序化滚动」。
// v8: 滚动追底状态由 chat-dom.ts 管理（_attachScrollWatch + getFollowBottom）。
// startWaitingIndicator 中直接滚到底（等待提示应始终可见）。
function scrollToBottom(ca: HTMLElement): void {
  ca.scrollTop = ca.scrollHeight;
}

/** 从 ChatMessage 中提取纯文本 */
function extractText(msg: ChatMessage): string {
  return msg.content
    .filter((b): b is TextBlock => b?.type === 'text')
    .map(b => b.text)
    .join('');
}

// ========== SSE 流式请求 ==========

// ========== 持久化挂机运行态 ==========
// 当前活跃 runId（服务端后台生成任务）。刷新/切后台后据此重连续读。
let _activeRunId: string | null = null;
let _activeCursor = 0; // 已消费到的事件 index（重连从此续读）
let _sendSessionId = ''; // doSend 时传入的 sessionId
export function getActiveRunId(): string | null { return _activeRunId; }
export function getActiveCursor(): number { return _activeCursor; }

// localStorage 持久化：{sessionId, runId} —— 跨刷新/切后台/杀浏览器重启后据此重连。
// 用 localStorage 而非 sessionStorage：后者随标签页/浏览器关闭清空，杀浏览器就丢了。
const RUN_KEY = 'kfm-active-run';
function _persistActiveRun(sessionId: string, runId: string | null): void {
  try {
    if (runId) localStorage.setItem(RUN_KEY, JSON.stringify({ sessionId, runId }));
    else localStorage.removeItem(RUN_KEY);
  } catch { /* ignore */ }
}
/** 读取上次未完成的 run（供 orb.ts 页面恢复时重连）。 */
export function readPersistedRun(): { sessionId: string; runId: string } | null {
  try {
    const raw = localStorage.getItem(RUN_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
export function clearPersistedRun(): void {
  try { localStorage.removeItem(RUN_KEY); } catch { /* ignore */ }
}

/** 流消费上下文：把事件应用到 messages 所需的回调与状态 */
interface RunConsumeCtx {
  messages: ChatMessage[];
  onRender: () => void;
  onWait?: (waiting: boolean) => void;
  onEvent?: (event: any) => void;
  getMsgIdx: () => number;
  setMsgIdx: (i: number) => void;
}

/** 把单个 StreamEvent 应用到 messages（纯状态变更 + 动画调度，不含渲染节流） */
function _applyEvent(event: any, ctx: RunConsumeCtx): void {
  const { messages, onWait } = ctx;
  let msgIdx = ctx.getMsgIdx();
  switch (event.type) {
    case 'message_start': {
      // 不在此处停等待提示：推理模型（如 deepseek-v4-pro）message_start 后
      // 首个 thinking_delta 可能延迟很久，过早停提示会留下空白。改为首个
      // 实际内容（正文/思考 delta 或工具块）到达时才停（见下方各 case）。
      messages.push({ role: 'ai', content: [] });
      ctx.setMsgIdx(messages.length - 1);
      break;
    }
    case 'message_stop': { onWait?.(true); break; }
    case 'content_block_start': {
      if (msgIdx < 0) break;
      const { index, blockType, toolUseId, toolName } = event;
      if (blockType === 'text') {
        messages[msgIdx].content[index] = { type: 'text', text: '', reasoning: '' };
      } else if (blockType === 'tool_use') {
        onWait?.(false); // 工具块到达 = 有实际内容，停等待提示
        messages[msgIdx].content[index] = { type: 'tool', id: toolUseId || '', name: toolName || 'unknown', input: {} };
      }
      break;
    }
    case 'content_block_delta': {
      if (msgIdx < 0) break;
      const { index, deltaType, deltaText } = event;
      const block = messages[msgIdx].content[index];
      if (!block) break;
      if (deltaType === 'text_delta' && block.type === 'text') {
        onWait?.(false); // 首个正文 delta = 内容开始，停等待提示
        block.text += deltaText || '';
      } else if (deltaType === 'thinking_delta' && block.type === 'text') {
        onWait?.(false); // 首个思考 delta = 推理开始，停等待提示（推理模型关键路径）
        block.reasoning = (block.reasoning || '') + (deltaText || '');
      } else if (deltaType === 'input_json_delta' && block.type === 'tool') {
        const buf = ((block as ToolBlock & { _jsonBuf?: string })._jsonBuf || '') + (deltaText || '');
        (block as ToolBlock & { _jsonBuf?: string })._jsonBuf = buf;
      }
      break;
    }
    case 'content_block_stop': {
      if (msgIdx < 0) break;
      const { index } = event;
      const block = messages[msgIdx].content[index];
      if (block?.type === 'tool' && (block as ToolBlock & { _jsonBuf?: string })._jsonBuf) {
        let parsed: Record<string, unknown> = {};
        try { parsed = JSON.parse((block as ToolBlock & { _jsonBuf: string })._jsonBuf); } catch {}
        block.input = parsed;
        delete (block as ToolBlock & { _jsonBuf?: string })._jsonBuf;
      }
      break;
    }
    case 'tool_result': {
      if (msgIdx < 0) break;
      const toolBlock = messages[msgIdx].content.find(
        (b): b is ToolBlock => b?.type === 'tool' && b.id === event.toolUseId
      );
      if (toolBlock) {
        toolBlock.result = event.toolResult;
        updateTodoFromTool(toolBlock);
        clearToolHint(toolBlock.id);
      }
      // 服务端目录指纹检测到文件系统变化 → 刷新文件树
      if (event.filesChanged) {
        loadFileTree(KFMState.currentRoot);
      }
      break;
    }
    case 'rule_warning': {
      if (msgIdx < 0) break;
      messages[msgIdx].content.push({ type: 'rule_warning', content: event.content || '' } as RuleWarningBlock);
      break;
    }
    case 'error': {
      if (msgIdx < 0) {
        messages.push({ role: 'ai', content: [{ type: 'text', text: '[错误: ' + event.content + ']' }] });
        ctx.setMsgIdx(messages.length - 1);
        break;
      }
      const tb = messages[msgIdx].content.find((b): b is TextBlock => b?.type === 'text');
      if (tb) tb.text += '\n\n[错误: ' + event.content + ']';
      else messages[msgIdx].content.push({ type: 'text', text: '[错误: ' + event.content + ']' });
      break;
    }
  }
}

/**
 * 消费一个 run 的 SSE 续读流（{index,event} 信封）。
 * 从服务端补齐 fromIndex 起的事件 + 实时尾随，更新 _activeCursor。
 * 客户端断开（signal abort / 页面关闭）不影响服务端后台生成。
 * 返回 'done'（生成完成）| 'disconnected'（本次连接中断，run 可能仍在跑）。
 */
async function _consumeRun(
  apiBase: string, runId: string, fromIndex: number,
  signal: AbortSignal, ctx: RunConsumeCtx,
): Promise<'done' | 'disconnected'> {
  const res = await fetch(apiBase + 'ai/chat/' + runId + '/stream?from=' + fromIndex, { signal });
  const reader = res.body?.getReader();
  if (!reader) throw new Error('无响应体');
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    let chunk: ReadableStreamReadResult<Uint8Array>;
    try {
      chunk = await reader.read();
    } catch (e) {
      // 网络中断（切后台被挂起/断网）→ 视为断连，交给上层重连，不当硬错误
      if (signal.aborted) throw e; // 用户主动取消，照常上抛
      return 'disconnected';
    }
    const { done, value } = chunk;
    if (done) return 'disconnected';
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const jsonStr = line.slice(6).trim();
      if (!jsonStr) continue;
      try {
        const env = JSON.parse(jsonStr);
        if (env.type === '__end__') return 'done';
        const event = env.event;
        if (typeof env.index === 'number') _activeCursor = env.index + 1;
        _applyEvent(event, ctx);
        _eventHook?.(event);
        if (
          event.type === 'message_start' ||
          (event.type === 'content_block_start' && event.blockType === 'tool_use') ||
          event.type === 'tool_result' ||
          event.type === 'rule_warning'
        ) { ctx.onRender(); }
      } catch {}
    }
  }
}

/**
 * 带自动重连的续读：断连（切后台/网络抖动）后，只要服务端该 run 仍存活，
 * 就从当前 cursor 续读补齐，最多重试若干次（指数退避）。用户主动取消或 run
 * 已消失则停止。返回最终状态。
 */
async function _consumeWithReconnect(
  apiBase: string, runId: string, startFrom: number,
  signal: AbortSignal, ctx: RunConsumeCtx,
): Promise<'done' | 'gone'> {
  let from = startFrom;
  let attempt = 0;
  while (true) {
    if (signal.aborted) return 'gone';
    let result: 'done' | 'disconnected';
    try {
      result = await _consumeRun(apiBase, runId, from, signal, ctx);
    } catch (e) {
      if (signal.aborted) throw e;
      result = 'disconnected';
    }
    if (result === 'done') return 'done';
    // 断连：从已消费到的 cursor 续读
    from = _activeCursor;
    // 校验服务端 run 是否还在
    try {
      const chk = await fetch(apiBase + 'ai/chat/' + runId + '/status').then(r => r.json());
      if (chk.done) {
        // 已完成：再补一次剩余事件即返回
        await _consumeRun(apiBase, runId, from, signal, ctx).catch(() => {});
        return 'done';
      }
      if (!chk.exists) return 'gone';
    } catch {
      if (++attempt > 5) return 'gone';
    }
    // 指数退避重连（0.3s、0.6s、1.2s… 上限 3s）
    const delay = Math.min(300 * 2 ** attempt, 3000);
    attempt++;
    await new Promise(r => setTimeout(r, delay));
  }
}

/** 生成完成后的收尾：去除临时字段 + 标记未完成工具块 */
async function _finalizeRun(messages: ChatMessage[], msgIdx: number, model: string, provider: string): Promise<void> {
  if (msgIdx < 0) {
    messages.push({ role: 'ai', content: [{ type: 'text', text: '[未收到回复，请重试]' }] });
  } else if (messages[msgIdx] && messages[msgIdx].content.length === 0) {
    messages[msgIdx].content.push({ type: 'text', text: '[未收到回复，请重试]' });
  }
  // 收尾任何仍无 result 的工具块（流已结束，如上游 error 中断时工具未返回结果）——
  // 否则渲染判 isExecuting=!result 会让工具卡永久卡"忙碌中"（BAR-105 同类，error 触发路径）。
  settlePendingToolBlocks(messages, '(未完成)');
  for (const m of messages) {
    for (const b of m.content) {
      if (b?.type === 'tool') clearToolHint((b as ToolBlock).id);
      if (b?.type === 'text') delete (b as TextBlock & { _reasonExpanded?: boolean })._reasonExpanded;
    }
  }
  // v8: 持久化由服务端 SessionStore 接管（run-manager finally flush），客户端不再双写。
}

/**
 * 收尾纯逻辑（BAR-105 核心，抽出为可测函数）：给所有仍处于"执行中"
 * （无 result）的工具块打上结果，使其从"忙碌中"变完成态（渲染判 isExecuting=!result）。
 * 已有 result 的工具块不覆盖。返回被标记的工具块数。
 *
 * @param label 收尾文案：取消路径传 "(已取消)"，流结束/中断路径传 "(未完成)"。
 *
 * 纯函数：只改 content 数组里工具块的 result + 清 UI-only 动画字段，
 * 不碰计时器/toolHint（那些 DOM 副作用留在调用方）。
 */
export function settlePendingToolBlocks(messages: ChatMessage[], label: string): number {
  let settled = 0;
  for (const m of messages) {
    for (const b of m.content) {
      if (b?.type === 'tool') {
        const tb = b as ToolBlock;
        if (!tb.result) {
          tb.result = { content: [{ type: 'text', text: label }], isError: true };
          settled++;
        }
        delete (b as ToolBlock & { _userExpanded?: boolean })._userExpanded;
      }
    }
  }
  return settled;
}

/**
 * 取消时收尾：清 toolHint（DOM 副作用），再调纯函数标记未完成工具块。
 */
function _cancelPendingTools(messages: ChatMessage[]): void {
  for (const m of messages) {
    for (const b of m.content) {
      if (b?.type === 'tool') clearToolHint((b as ToolBlock).id);
    }
  }
  settlePendingToolBlocks(messages, '(已取消)');
}

/**
 * 重连一个已存在的后台 run（页面刷新/切后台恢复后调用）。
 * 从 fromIndex 续读补齐已错过的事件 + 实时尾随到完成。
 */
export async function resumeRun(
  apiBase: string, runId: string, fromIndex: number,
  messages: ChatMessage[], signal: AbortSignal,
  onRender: () => void, onWait?: (waiting: boolean) => void,
  model = '', provider = '',
): Promise<void> {
  _activeRunId = runId;
  let msgIdx = -1;
  // 重连时 messages 已含历史；新 AI 消息由 message_start 追加。msgIdx 从末尾 AI 消息推断。
  const ctx: RunConsumeCtx = {
    messages, onRender, onWait,
    getMsgIdx: () => msgIdx, setMsgIdx: (i) => { msgIdx = i; },
  };
  try {
    const result = await _consumeWithReconnect(apiBase, runId, fromIndex, signal, ctx);
    _activeRunId = null;
    _persistActiveRun('', null);
    // 无条件落盘——无论流正常结束(done)还是 run 消失(gone/服务重启)
    await _finalizeRun(messages, msgIdx, model, provider);
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      // 用户在重连态点暂停 → 通知服务端取消后台 run（彻底停止生成）
      fetch(apiBase + 'ai/chat/' + runId + '/cancel', { method: 'POST' }).catch(() => {});
      _persistActiveRun('', null);
      _cancelPendingTools(messages);
      const lastMsg = messages[messages.length - 1];
      if (lastMsg?.role === 'ai') lastMsg.content.push({ type: 'text', text: '[已取消]' });
    }
    _activeRunId = null;
  }
  onWait?.(false);
  onRender();
}

export async function doSend(
  text: string,
  messages: ChatMessage[],
  apiBase: string,
  signal: AbortSignal,
  onBeforeSend: () => void,
  onRender: () => void,
  onConfigMissing: (msg: string) => void,
  onWait?: (waiting: boolean) => void,
  sessionId = '',
): Promise<void> {
  _sendSessionId = sessionId;
  // 推用户消息（content block 格式）
  messages.push({ role: 'user', content: [{ type: 'text', text }] });
  onBeforeSend();
  // onRender 在这里只是为了让用户消息气泡先出现，不影响 hint（hint 在 orb.ts 里 startWaitingIndicator 之后追加）
  onRender();

  const config = await readActiveConfig(apiBase);
  if (!config.providerId) { onConfigMissing('未配置 Provider，请先在 API 卡中添加并选择一个 Provider。'); return; }
  if (!config.modelId) { onConfigMissing('未选择 Model，请先在 API 卡或光球面板底部选择一个 Model。'); return; }

  // system prompt 不再在客户端组装 —— 改由服务端每轮重组（眼睛系统 v7.4）。
  // 客户端只把当前角色文件名传给服务端，服务端读角色卡 promptFiles（含动态 page-state.md）。
  const roleFile = config.roleFile || '';
  const model = config.modelId;
  const provider = config.providerId;

  try {
    // 构建发给 API 的消息（content blocks → OpenAI 格式）。
    // 会话文件存的是完整 content blocks（含 tool_use + tool_result），
    // 发给 API 时必须转为 OpenAI 的 tool_calls + role:"tool" 格式。
    const apiMessages: Array<{ role: string; content: string | null; tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>; tool_call_id?: string }> = [];
    for (const m of messages) {
      if (m.role === 'user') {
        apiMessages.push({ role: 'user', content: extractText(m) });
      } else {
        // AI 消息：拆分 text + tool blocks 为 OpenAI 格式
        const textBlocks = m.content.filter((b): b is TextBlock => b?.type === 'text');
        const toolBlocks = m.content.filter((b): b is ToolBlock => b?.type === 'tool');
        const mainText = textBlocks.map(b => b.text || '').join('');
        if (toolBlocks.length > 0) {
          // 有工具调用：assistant 消息带 tool_calls
          const toolCalls = toolBlocks.map(tc => ({
            id: tc.id,
            type: 'function' as const,
            function: { name: tc.name, arguments: JSON.stringify(tc.input) },
          }));
          apiMessages.push({ role: 'assistant', content: mainText || null, tool_calls: toolCalls });
          // 每个工具结果作为独立的 role:"tool" 消息
          for (const tc of toolBlocks) {
            const resultText = tc.result?.content?.map(c => c.text || '').join('') || '';
            apiMessages.push({ role: 'tool', content: resultText, tool_call_id: tc.id });
          }
        } else {
          apiMessages.push({ role: 'assistant', content: mainText });
        }
      }
    }

    // 先落盘用户消息，保证刷新/切后台后能恢复（AI 回复由重连续读补齐）
    // saveMessages 会在 activeId 为空时自动新建会话——同步回 _sendSessionId，
    // 否则删除最后一个会话后再发送会带空 sessionId 触发服务端 400。
    await sessionStore.saveMessages(messages, model, provider);
    if (!_sendSessionId) _sendSessionId = sessionStore.activeId;

    // 后台启动生成任务（服务端挂机），拿 runId
    const startRes = await fetch(apiBase + 'ai/chat/start', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: _sendSessionId, messages: apiMessages, model, provider, roleFile }),
      signal,
    });
    const startData = await startRes.json();
    if (!startData.runId) { throw new Error(startData.error || '启动生成失败'); }
    _activeRunId = startData.runId;
    _persistActiveRun(_sendSessionId, startData.runId);

    let msgIdx = -1;
    const ctx: RunConsumeCtx = {
      messages, onRender, onWait,
      getMsgIdx: () => msgIdx, setMsgIdx: (i) => { msgIdx = i; },
    };
    const result = await _consumeWithReconnect(apiBase, startData.runId, startData.fromIndex || 0, signal, ctx);
    // 流结束：最后一轮 message_stop 会把等待提示打开，此处立即关闭，
    // 避免 _finalizeRun 的落盘网络往返期间残留一个多余的等待框。
    onWait?.(false);
    _activeRunId = null;
    _persistActiveRun(_sendSessionId, null);
    // 无条件落盘——无论流正常结束(done)还是 run 消失(gone/服务重启)，
    // 已渲染在面板上的 AI 回复都应该持久化，否则刷新后永久丢失。
    await _finalizeRun(messages, msgIdx, model, provider);
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      // 用户主动取消：通知服务端取消后台 run
      if (_activeRunId) { fetch(apiBase + 'ai/chat/' + _activeRunId + '/cancel', { method: 'POST' }).catch(() => {}); _activeRunId = null; }
      _persistActiveRun(_sendSessionId, null);
      // 收尾未完成的工具卡（从"忙碌中"→已取消→折叠），并追加取消标注
      _cancelPendingTools(messages);
      const lastMsg = messages[messages.length - 1];
      if (lastMsg?.role === 'ai') lastMsg.content.push({ type: 'text', text: '[已取消]' });
    } else {
      messages.push({ role: 'ai', content: [{ type: 'text', text: '请求失败: ' + (e instanceof Error ? e.message : '未知错误') }] });
    }
  }
  // 流彻底结束（成功/错误/取消）：确保等待提示已停
  onWait?.(false);
  onRender();
}

// ========== 配置读取 ==========

async function readActiveConfig(base: string): Promise<Record<string, string>> {
  try {
    const res = await fetch(base + 'files/read', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '.kfmv4/active.json' }),
    });
    const data = await res.json();
    return data.content ? JSON.parse(data.content) : {};
  } catch { return {}; }
}

// ========== 异步 Markdown 渲染（用于标题生成等） ==========

export async function renderMarkdownAsync(text: string): Promise<string> {
  const mathData: MathData = { display: [], inline: [] };
  const processed = preprocessMd(text, mathData);
  return await marked.parse(processed, MARKED_OPTS) as string;
}
