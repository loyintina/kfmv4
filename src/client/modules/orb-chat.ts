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

import { DOM } from './dom-refs.js';
import { currentTheme as theme } from './theme.js';
import { sessionStore } from './session-store.js';
import type { ContentBlock, TextBlock, ToolBlock, RuleWarningBlock } from './session-store.js';
import { MD_CSS } from './renderers/md-css.js';
import { marked } from 'marked';
import { preprocessMd, MARKED_OPTS } from './renderers/md-extensions.js';
import { highlightAll } from './renderers/code-highlight.js';
import { renderMath, renderMermaid, type MathData } from './renderers/math-diagram.js';
import { WAITING_HINTS } from '../data/waiting-hints.js';

// ========== 类型 ==========

export type { ContentBlock, TextBlock, ToolBlock, RuleWarningBlock } from './session-store.js';

/** 消息结构：content 是 block 数组，一次 AI 回复 = 一条消息 = 多个 block */
export interface ChatMessage {
  role: 'user' | 'ai';
  content: ContentBlock[];
}

export interface ChatState {
  panelEl: HTMLDivElement;
  messages: ChatMessage[];
  renderWidth: number;
  apiBase: string;
  /** 'follow'  = 强制滚到底（发送时），'preserve' = 保留位置（resize 时），'auto' = 默认启发式 */
  scrollMode?: 'follow' | 'preserve' | 'auto';
}

// ========== 工具函数 ==========

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderPlainText(text: string): string {
  return escapeHtml(text);
}

function hslToHex(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => { const k = (n + h / 30) % 12; return Math.round((l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)) * 255); };
  const r = f(0).toString(16).padStart(2, '0');
  const g = f(8).toString(16).padStart(2, '0');
  const b = f(4).toString(16).padStart(2, '0');
  return '#' + r + g + b;
}

function hexToRgba(hex: string, alpha: number): string {
  const num = parseInt(hex.slice(1), 16);
  const r = (num >> 16) & 0xFF;
  const g = (num >> 8) & 0xFF;
  const b = num & 0xFF;
  return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
}

function randomToolAccent(): { color1: string; color2: string } {
  const h1 = Math.random() * 360;
  const offset = (30 + Math.random() * 90) * (Math.random() > 0.5 ? 1 : -1);
  const h2 = ((h1 + offset) % 360 + 360) % 360;
  const sat = 45 + Math.random() * 25;
  const lit = 50 + Math.random() * 15;
  return { color1: hslToHex(h1, sat, lit), color2: hslToHex(h2, sat, lit) };
}

// ========== 等待提示动画 ==========
// 设计：attach 到 orb-panel-content 尾部的独立 DOM 节点，不走 renderChatContent 的 innerHTML 重建。
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
  txt.style.cssText = 'color:rgba(255,255,255,0.35);transition:opacity 0.3s';

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

  // 滚到底部让提示可见（发送场景默认追底）
  followBottom = true;
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

// 打字机动画 interval 追踪：新 content block 到达时立即结束未完成的动画，
// 避免用户在 AI 已开始回复时还要等 3 秒装饰动画跑完。
const _activeAnimTimers = new Set<ReturnType<typeof setTimeout>>();

function clearAllAnimTimers(): void {
  for (const t of _activeAnimTimers) clearTimeout(t);
  _activeAnimTimers.clear();
}

// 折叠动画追踪：用时间戳驱动 max-height/opacity 过渡，替代 CSS transition。
// 原因：renderChatContent 通过 innerHTML 重建 DOM，CSS transition 只在已有元素
// 改变样式时工作——新创建的元素 max-height 直接是 0，没有过渡可执行。
// 不持有 element 引用（innerHTML 会销毁元素导致 isConnected=false），只存 tid → 开始时间。
const _activeFoldAnims = new Map<string, number>(); // tid → start timestamp
let _lastRenderState: ChatState | null = null;

// rAF 合批渲染调度器：并行工具的多个打字机/折叠动画各自 tick 时，若直接调 onRender，
// 12 个动画 = 每帧 12 次全量重渲染 → 卡死。改为标记脏 + 单个 rAF 每帧最多渲染一次。
// 关闭面板后不再自我调度，避免后台空转。
let _renderCb: (() => void) | null = null;
let _renderScheduled = false;
function scheduleRender(): void {
  if (_renderScheduled) return;
  _renderScheduled = true;
  requestAnimationFrame(() => {
    _renderScheduled = false;
    if (_renderCb) _renderCb();
  });
}

// Markdown 渲染缓存：源文本 → 渲染好的 HTML 字符串。
// 流式回复时 renderChatContent 每帧全量重建 innerHTML，历史消息内容不变却每帧
// 重跑 marked+highlight+math+mermaid 管线（O(n) 条消息 × 每帧 = O(n²) 卡顿）。
// 缓存后：文本未变的消息直接注入缓存 HTML，只有正在流式的那条跑完整管线。
// 上限 200 条，超出按插入序淘汰最旧，防止长会话内存无限增长。
const _mdCache = new Map<string, string>();
const MD_CACHE_MAX = 200;
function _mdCacheGet(text: string): string | undefined { return _mdCache.get(text); }
function _mdCacheSet(text: string, html: string): void {
  if (_mdCache.size >= MD_CACHE_MAX) {
    const oldest = _mdCache.keys().next().value;
    if (oldest !== undefined) _mdCache.delete(oldest);
  }
  _mdCache.set(text, html);
}

// 视口裁剪（虚拟滚动）：长会话时只渲染视口附近的消息，其余用等高占位撑住滚动条。
// 仅当消息数 > CULL_THRESHOLD 时启用；短会话走全量渲染，零回归。
// 高度表按绝对消息索引缓存实测高度，占位块用它撑出正确的滚动高度。
const CULL_THRESHOLD = 40;   // 消息数超过才启用裁剪
const CULL_BUFFER_PX = 1200; // 视口上下各多渲染的缓冲高度
const _msgHeights = new Map<number, number>(); // 绝对索引 → 实测高度(px)
const DEFAULT_MSG_H = 80;    // 未测量消息的高度估计

// 裁剪滚动监听：用户滚动进入被占位的区域时，重渲染以物化该区间消息。
// rAF 节流；preserve 模式保持滚动位置不跳。
let _cullRafPending = false;
function _attachCullScroll(ca: HTMLElement): void {
  const tagged = ca as HTMLElement & { _cullScroll?: boolean };
  if (tagged._cullScroll) return;
  tagged._cullScroll = true;
  ca.addEventListener('scroll', () => {
    if (_cullRafPending) return;
    _cullRafPending = true;
    requestAnimationFrame(() => {
      _cullRafPending = false;
      const st = _lastRenderState;
      if (st && st.messages.length > CULL_THRESHOLD) {
        renderChatContent({ ...st, scrollMode: 'preserve' });
      }
    });
  }, { passive: true });
}

// ========== 滚动追底状态 ==========
// 用显式 followBottom 标志替代旧的 wasAtBottom 启发式 + rAF 竞态。
// 用户主动上滑（scroll 事件，且非程序化）→ 关闭追底；滑回底部 → 重新追底。
// 程序化设置 scrollTop 期间 suppressScroll=true，避免 innerHTML 重建/自身滚动误翻标志。
let followBottom = true;
let suppressScroll = false;

function attachScrollWatch(ca: HTMLElement): void {
  const tagged = ca as HTMLElement & { _scrollWatch?: boolean };
  if (tagged._scrollWatch) return;
  tagged._scrollWatch = true;
  ca.addEventListener('scroll', () => {
    if (suppressScroll) return;
    const dist = ca.scrollHeight - ca.scrollTop - ca.clientHeight;
    followBottom = dist < 40;
  }, { passive: true });
}

function scrollToBottom(ca: HTMLElement): void {
  suppressScroll = true;
  ca.scrollTop = ca.scrollHeight;
  requestAnimationFrame(() => { suppressScroll = false; });
}

// ========== 渲染 ==========

export function renderChatContent(state: ChatState): void {
  const { panelEl, messages, renderWidth, scrollMode = 'auto' } = state;
  if (!panelEl) return;
  const contentArea = DOM.orbPanelContent(panelEl);
  if (!contentArea) return;
  // 面板关闭/隐藏时跳过昂贵渲染：动画 timer 仍在更新消息数据，重开面板时会全量重绘。
  // （关闭面板后并行工具动画每帧全量重渲染是"关了还卡"的元凶。）
  if (panelEl.style.pointerEvents === 'none') { _lastRenderState = state; return; }
  _lastRenderState = state;

  const innerWidth = renderWidth - 24;
  (window as unknown as Record<string, unknown>).__orbMsgs = messages;
  if (innerWidth < 50) return;

  const msgHtmls: string[] = [];  // 每条消息一个 HTML 片段（视口裁剪按条替换为占位）
  let idx = 0;
  for (const msg of messages) {
    let html = '';  // 本条消息的片段
    const isUser = msg.role === 'user';
    const bgColor = isUser
      ? `linear-gradient(${theme.surface.bgLight},${theme.surface.bgLight}) padding-box,${theme.aiChat.bubbleSelfGradient} border-box`
      : `linear-gradient(rgba(10,15,30,0.88),rgba(10,15,30,0.88)) padding-box,${theme.aiChat.panelBorderGradient} border-box`;
    const borderStyle = 'border:1px solid transparent;border-left-width:3px;';
    const align = isUser ? 'flex-end' : 'flex-start';
    const label = isUser ? '你' : '蔚然';
    const labelColor = isUser ? theme.aiChat.bubbleLabelSelf : theme.aiChat.bubbleLabelAI;
    const boxShadow = isUser ? theme.aiChat.bubbleSelfShadow : theme.aiChat.bubbleAIShadow;

    if (isUser) {
      // 用户消息：单 text block
      const userText = msg.content.find((b): b is TextBlock => b.type === 'text')?.text || '';
      const maxWidth = Math.min(innerWidth - 8, innerWidth * 0.85);
      let bubbleHtml = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px;gap:8px">
        <span style="font-size:10px;color:${labelColor};font-weight:600">${label}</span>
        <span class="orb-copy-btn" data-copy-idx="${idx}" style="font-size:9px;color:rgba(255,255,255,0.35);cursor:pointer;flex-shrink:0;user-select:none">复制</span>
      </div>`;
      bubbleHtml += `<div class="orb-msg-text" data-msg-idx="${idx}" style="font-family:sans-serif;font-size:var(--card-font-size,13px);line-height:16px;color:${theme.aiChat.bubbleText};word-break:break-word">${renderPlainText(userText)}</div>`;
      html += `
        <div style="display:flex;justify-content:${align};margin-bottom:8px">
          <div style="max-width:${maxWidth}px;padding:6px 12px;background:${bgColor};${borderStyle}border-radius:8px;box-shadow:${boxShadow}">
            ${bubbleHtml}
          </div>
        </div>`;
    } else {
      // AI 消息：从 content 数组渲染每个 block
      // 设计决策：reasoning / 正文气泡 / 工具卡片 / 警告框各自独立条件渲染，
      // 不再用 reasoningOnly 分支——reasoning 块始终全宽，气泡仅在有正文时出现。
      const textBlocks = msg.content.filter((b): b is TextBlock => b.type === 'text');
      const toolBlocks = msg.content.filter((b): b is ToolBlock => b.type === 'tool');
      const warningBlocks = msg.content.filter(b => b.type === 'rule_warning') as Array<{ type: 'rule_warning'; content: string }>;
      const reasoning = textBlocks.map(b => b.reasoning || '').join('');
      const mainText = textBlocks.map(b => b.text || '').join('');
      const hasToolCalls = toolBlocks.length > 0;
      const reasoningDone = !!(mainText || hasToolCalls);

      // 思考块：独立全宽行，与工具框同宽
      // 折叠状态持久化：默认思考完成后折叠；用户点击展开/折叠写回首个 text block 的
      // _reasonExpanded，跨重渲染保持（否则正文/工具到达后 reasoningDone 变 true 会强制折叠）。
      if (reasoning) {
        const rid = 'r' + idx;
        const rlabel = reasoningDone ? '已思考' : '思考中...';
        const firstTb = textBlocks[0] as (TextBlock & { _reasonExpanded?: boolean }) | undefined;
        const re = firstTb?._reasonExpanded;
        // 思考中默认展开；完成后默认折叠；用户显式操作优先
        const reasonOpen = re !== undefined ? re : !reasoningDone;
        const displayStyle = reasonOpen ? 'display:block' : 'display:none';
        html += `
          <div style="display:flex;justify-content:flex-start;margin-bottom:4px">
            <div style="flex:1;max-width:100%;padding:5px 10px;border-radius:8px;background:linear-gradient(rgba(10,15,30,0.75),rgba(10,15,30,0.75)) padding-box,${theme.aiChat.panelBorderGradient} border-box;border:1px solid transparent;border-left-width:3px;font-size:var(--card-font-size,10px)">
              <div data-msg="${idx}" onclick="var p=document.getElementById('${rid}');var s=p.style.display==='none'?'block':'none';p.style.display=s;this.querySelector('.rt-arrow').textContent=s==='block'?'▼':'▶';var m=this.dataset.msg;if(window.__orbMsgs&&m>=0){var t=window.__orbMsgs[m]?.content?.filter(function(x){return x.type==='text'})[0];if(t)t._reasonExpanded=(s==='block')}" style="display:flex;align-items:center;gap:6px;cursor:pointer;user-select:none">
                <span class="rt-arrow" style="font-size:7px;color:rgba(0,212,255,0.5)">${reasonOpen ? '▼' : '▶'}</span>
                <span style="color:rgba(0,212,255,0.6);font-weight:600">${rlabel}</span>
              </div>
              <div id="${rid}" style="${displayStyle};margin-top:4px">
                <pre style="font-size:var(--card-font-size,9px);color:rgba(255,255,255,0.45);line-height:1.4;white-space:pre-wrap;word-break:break-word;margin:0;font-family:inherit;background:rgba(0,0,0,0.15);padding:4px 6px;border-radius:4px">${escapeHtml(reasoning)}</pre>
              </div>
            </div>
          </div>`;
      }

      // 正文气泡：仅在有正文时渲染（无正文时不渲染空气泡）
      if (mainText) {
        const lineHeight = 16;
        const bubbleHtml = `
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px;gap:8px">
            <span style="font-size:10px;color:${labelColor};font-weight:600">${label}</span>
            <span class="orb-copy-btn" data-copy-idx="${idx}" style="font-size:9px;color:rgba(255,255,255,0.35);cursor:pointer;flex-shrink:0;user-select:none">复制</span>
          </div>
          <div class="orb-msg-text" data-msg-idx="${idx}" style="font-family:sans-serif;font-size:var(--card-font-size,13px);line-height:${lineHeight}px;color:${theme.aiChat.bubbleText};word-break:break-word">${renderPlainText(mainText)}</div>`;
        const maxWidth = innerWidth - 8;
        html += `
          <div style="display:flex;justify-content:${align};margin-bottom:8px">
            <div style="max-width:${maxWidth}px;padding:6px 12px;background:${bgColor};${borderStyle}border-radius:8px;box-shadow:${boxShadow}">
              ${bubbleHtml}
            </div>
          </div>`;
      }

      // 工具调用卡片（气泡外，独立块）
      for (let ti = 0; ti < toolBlocks.length; ti++) {
        const tc = toolBlocks[ti];
        if (!tc.color1) { const a = randomToolAccent(); tc.color1 = a.color1; tc.color2 = a.color2; }
        const c1 = tc.color1!, c2 = tc.color2!;
        const tid = 'tc' + idx + '_' + ti;
        const hasResult = !!tc.result;
        const isExecuting = !hasResult;
        const isError = hasResult && tc.result!.isError;
        const statusLabel = isExecuting ? '忙碌中' : (isError ? '失败' : '成功');
        const statusColor = isExecuting ? 'rgba(255,255,255,0.4)' : (isError ? 'rgba(255,100,100,0.8)' : 'rgba(0,212,115,0.8)');
        const paramsFull = Object.keys(tc.input).length > 0 ? JSON.stringify(tc.input, null, 2) : '';
        type AnimBlock = ToolBlock & { _animText?: string; _animInput?: string; _foldPhase?: 'out' | 'fold' };
        const ab = tc as AnimBlock;
        const isAnimating = ab._animText !== undefined;
        const gradientBorder = `linear-gradient(rgba(10,15,30,0.75),rgba(10,15,30,0.75)) padding-box,linear-gradient(135deg,${hexToRgba(c2, 0.55)} 30%,${hexToRgba(c1, 0.55)} 70%) border-box`;
        // 展开态三段结构：输入参数 → 渐变分隔线 → 输出区（执行中为摸鱼提示，完成为结果）。
        // 分隔线复用工具卡的随机双色 c1/c2，视觉上标记"这次交互是独特的"（Fi 审美）。
        // 无参数的工具（如 kfm-snapshot）不渲染输入区和分隔线，直接显示输出区。
        const preStyle = 'font-size:var(--card-font-size,9px);line-height:1.4;white-space:pre-wrap;word-break:break-word;margin:0;font-family:inherit;background:rgba(0,0,0,0.2);padding:4px 6px;border-radius:4px';
        const isInputAnimating = ab._animInput !== undefined;
        const paramsDisplay = isInputAnimating ? ab._animInput! : paramsFull;
        const isCollapsible = hasResult && paramsDisplay; // 有输出+有参数 → 整体容器折叠
        const isFolding = isAnimating || (!!ab._foldPhase && !isCollapsible);
        // 容器级折叠动画：无论 isCollapsible 与否，都在容器 <div> 上做 max-height/opacity 过渡。
        // 这样输入参数也会跟着折叠，而非只有输出 <pre> 折叠。
        let containerFoldClip = '';
        if (ab._foldPhase === 'fold') {
          const fStart = _activeFoldAnims.get(tid);
          if (fStart !== undefined) {
            const elapsed = Date.now() - fStart;
            const progress = Math.min(elapsed / 300, 1);
            const eased = 1 - (1 - progress) * (1 - progress);
            containerFoldClip = `max-height:${80 * (1 - eased)}px;overflow:hidden;opacity:${1 - eased};`;
            if (progress >= 1) {
              _activeFoldAnims.delete(tid);
              delete ab._foldPhase;
            }
          }
        }
        const resultText = hasResult
          ? (isAnimating ? ab._animText! : (tc.result!.content?.[0]?.text || ''))
          : '';
        // 折叠状态持久化：完成的工具卡默认折叠。执行中/动画中强制展开；
        // 否则由 block._userExpanded 决定（用户点击展开/折叠会写回此标志，跨重渲染保持）。
        const ue = (tc as ToolBlock & { _userExpanded?: boolean })._userExpanded;
        const forceOpen = isExecuting || isAnimating || isFolding;
        const isOpen = forceOpen || ue === true;
        const defaultDisplay = isOpen ? 'block' : 'none';
        const defaultArrow = isOpen ? '▼' : '▶';
        // 展开态两区结构：输入区 + 分隔线 + 输出区，各自限高可滚动。
        // 内容少时以内容高度为准；内容多时撑到 max-height 并内部滚动（不撑爆卡片）。
        const INPUT_MAX_H = 80, OUTPUT_MAX_H = 80;
        const inputHtml = paramsDisplay
          ? `<pre class="orb-tool-input-pre" style="${preStyle};color:rgba(255,255,255,0.45);max-height:${INPUT_MAX_H}px;overflow-y:auto">${escapeHtml(paramsDisplay)}</pre>`
          : '';
        const dividerHtml = paramsFull
          ? `<div style="height:1px;margin:5px 0;border-radius:1px;background:linear-gradient(90deg,${hexToRgba(c1, 0.7)},${hexToRgba(c2, 0.7)})"></div>`
          : '';
        let outputHtml: string;
        if (isExecuting) {
          const hint = getToolHint(tc.id);
          outputHtml = `<div style="color:rgba(255,255,255,0.4);font-size:var(--card-font-size,9px);line-height:1.4;padding:2px 0">${hint.dotHtml}${escapeHtml(hint.text)}</div>`;
        } else {
          // 输出区始终限高可滚动；动画中标记 orb-tool-anim-pre 使其自动滚到底显示最新
          const animClass = isAnimating ? ' orb-tool-anim-pre' : '';
          outputHtml = `<pre class="orb-tool-output-pre${animClass}" style="${preStyle};color:rgba(255,255,255,0.6);max-height:${OUTPUT_MAX_H}px;overflow-y:auto">${escapeHtml(resultText || '(无结果)')}</pre>`;
        }
        html += `
          <div style="display:flex;justify-content:flex-start;margin-bottom:6px">
            <div class="orb-tool-card" style="flex:1;max-width:100%;padding:5px 10px;border-radius:8px;background:${gradientBorder};border:1px solid transparent;border-left-width:3px;border-left-color:${hexToRgba(c1, 0.7)};font-size:var(--card-font-size,10px)">
              <div data-msg="${idx}" data-ti="${ti}" onclick="var p=document.getElementById('${tid}');var s=p.style.display==='none'?'block':'none';p.style.display=s;this.querySelector('.orb-tc-arrow').textContent=s==='block'?'▼':'▶';var m=this.dataset.msg,t=this.dataset.ti;if(window.__orbMsgs&&m>=0){var b=window.__orbMsgs[m]?.content?.filter(function(x){return x.type==='tool'})[t];if(b){b._userExpanded=(s==='block');if(s==='block'){delete b._foldPhase}}}if(s==='block'){p.style.maxHeight='';p.style.overflow='';p.style.opacity=''}" style="display:flex;align-items:center;gap:6px;cursor:pointer;user-select:none">
                <span class="orb-tc-arrow" style="font-size:7px;color:rgba(255,255,255,0.5)">${defaultArrow}</span>
                <span style="color:${hexToRgba(c1, 0.9)};font-weight:600">${escapeHtml(tc.name)}</span>
                <span style="color:${statusColor};font-size:var(--card-font-size,9px);font-weight:600">${statusLabel}</span>
              </div>
              <div id="${tid}" style="display:${defaultDisplay};margin-top:4px;${containerFoldClip}">
                ${inputHtml}${dividerHtml}${outputHtml}
              </div>
            </div>
          </div>`;
      }

      // 规则警告框（红色）
      for (let wi = 0; wi < warningBlocks.length; wi++) {
        const warning = warningBlocks[wi].content;
        const shortName = warning.match(/\[规则警告: ([^\]]+)\]/)?.[1] || '规则警告';
        const wid = 'rw' + idx + '_' + wi;
        html += `
          <div style="display:flex;justify-content:flex-start;margin-bottom:6px">
            <div style="flex:1;max-width:100%;padding:5px 10px;border-radius:8px;background:linear-gradient(rgba(10,15,30,0.85),rgba(10,15,30,0.85)) padding-box,linear-gradient(135deg,rgba(255,60,60,0.5),rgba(255,120,0,0.5)) border-box;border:1px solid transparent;border-left-width:3px;border-left-color:rgba(255,60,60,0.8);font-size:var(--card-font-size,10px)">
              <div onclick="var p=document.getElementById('${wid}');var s=p.style.display==='none'?'block':'none';p.style.display=s;this.querySelector('.rw-arrow').textContent=s==='block'?'▼':'▶'" style="display:flex;align-items:center;gap:6px;cursor:pointer;user-select:none">
                <span class="rw-arrow" style="font-size:7px;color:rgba(255,100,100,0.7)">▶</span>
                <span style="color:rgba(255,80,80,0.95);font-weight:600">⚠ ${escapeHtml(shortName)}</span>
              </div>
              <div id="${wid}" style="display:none;margin-top:4px">
                <pre style="font-size:var(--card-font-size,9px);color:rgba(255,200,200,0.8);line-height:1.4;white-space:pre-wrap;word-break:break-word;margin:0;font-family:inherit;background:rgba(255,0,0,0.06);padding:4px 6px;border-radius:4px">${escapeHtml(warning)}</pre>
              </div>
            </div>
          </div>`;
      }
    }

    msgHtmls.push('<div class="orb-msg" data-mi="' + idx + '">' + html + '</div>');
    idx++;
  }
  // 保存滚动位置（在重建 innerHTML 之前）
  const prevScrollTop = contentArea.scrollTop;
  const viewportH = contentArea.clientHeight || 400;
  // 等待提示节点在 innerHTML 重建后需要恢复（它是独立 DOM 节点，不在 html 字符串里）
  const hintEl = contentArea.querySelector('#' + HINT_ID) as HTMLElement | null;
  attachScrollWatch(contentArea);
  suppressScroll = true;

  // ===== 视口裁剪：决定渲染窗口 =====
  const cull = messages.length > CULL_THRESHOLD;
  let html: string;
  if (!cull) {
    html = msgHtmls.join('');
  } else {
    // 追底时窗口锚在末尾；否则按 scrollTop 用高度表定位可见区间
    const h = (i: number) => _msgHeights.get(i) ?? DEFAULT_MSG_H;
    // 累积偏移，找到 [top-buffer, top+viewport+buffer] 覆盖的消息区间
    const top = followBottom ? Number.MAX_SAFE_INTEGER : prevScrollTop;
    const winTop = top - CULL_BUFFER_PX;
    const winBot = (followBottom ? Number.MAX_SAFE_INTEGER : prevScrollTop + viewportH) + CULL_BUFFER_PX;
    let firstVisible = messages.length, lastVisible = -1;
    let acc = 0;
    for (let i = 0; i < msgHtmls.length; i++) {
      const hi = h(i);
      const elemTop = acc, elemBot = acc + hi;
      if (elemBot >= winTop && elemTop <= winBot) {
        if (i < firstVisible) firstVisible = i;
        if (i > lastVisible) lastVisible = i;
      }
      acc += hi;
    }
    // 追底场景：强制包含末尾若干条（流式消息必须在窗口内）
    if (followBottom) { lastVisible = msgHtmls.length - 1; firstVisible = Math.min(firstVisible, Math.max(0, lastVisible - 12)); }
    if (lastVisible < 0) { firstVisible = 0; lastVisible = msgHtmls.length - 1; }
    // 上下占位高度
    let topPad = 0, botPad = 0;
    for (let i = 0; i < firstVisible; i++) topPad += h(i);
    for (let i = lastVisible + 1; i < msgHtmls.length; i++) botPad += h(i);
    const parts: string[] = [];
    if (topPad > 0) parts.push('<div class="orb-cull-pad" style="height:' + topPad + 'px"></div>');
    for (let i = firstVisible; i <= lastVisible; i++) parts.push(msgHtmls[i]);
    if (botPad > 0) parts.push('<div class="orb-cull-pad" style="height:' + botPad + 'px"></div>');
    html = parts.join('');
  }
  contentArea.innerHTML = html;
  if (hintEl) contentArea.appendChild(hintEl);
  // 注入 CSS（仅一次）
  if (!contentArea.querySelector('.orb-md-css')) {
    const style = document.createElement('style');
    style.className = 'orb-md-css';
    style.textContent = MD_CSS;
    contentArea.appendChild(style);
  }
  // 同步渲染 markdown（仅 AI 消息中的 text block）
  // 性能：命中缓存直接注入 HTML，跳过 marked+highlight+math+mermaid 全套管线。
  // 只有正在流式（文本每帧变化）的那条会缓存未命中 → 跑完整管线；历史消息 O(1)。
  const msgEls = contentArea.querySelectorAll<HTMLElement>('.orb-msg-text');
  for (const el of msgEls) {
    const i = parseInt(el.dataset.msgIdx || '-1', 10);
    if (i >= 0 && i < messages.length && messages[i].role !== 'user') {
      const text = messages[i].content
        .filter((b): b is TextBlock => b.type === 'text')
        .map(b => b.text || '').join('');
      if (text.length > 0) {
        const cached = _mdCacheGet(text);
        if (cached !== undefined) {
          el.innerHTML = cached;
          continue;
        }
        const mathData: MathData = { display: [], inline: [] };
        const processed = preprocessMd(text, mathData);
        const mdHtml = marked.parse(processed, MARKED_OPTS) as string;
        el.innerHTML = '<div class="md-body">' + mdHtml + '</div>';
        const mdBody = el.querySelector('.md-body') as HTMLElement;
        highlightAll(mdBody);
        renderMath(mdBody, mathData);
        renderMermaid(mdBody, '#00d4ff');
        // mermaid 异步渲染，其 SVG 此刻可能未就绪 → 含 mermaid 的不缓存，避免缓存半成品
        if (!/```mermaid/.test(text)) _mdCacheSet(text, el.innerHTML);
      }
    }
  }
  // 复制按钮：复用会话卡逻辑（writeText + "✓ 已复制" 1.5s 回弹）
  const copyEls = contentArea.querySelectorAll<HTMLElement>('.orb-copy-btn');
  for (const btn of copyEls) {
    const i = parseInt(btn.dataset.copyIdx || '-1', 10);
    if (i < 0 || i >= messages.length) continue;
    btn.onclick = (e) => {
      e.stopPropagation();
      const txt = extractText(messages[i]);
      navigator.clipboard?.writeText(txt).then(() => {
        btn.textContent = '✓ 已复制';
        setTimeout(() => { btn.textContent = '复制'; }, 1500);
      }).catch(() => {});
    };
  }
  // 打字机/折叠阶段自动滚动：让超出 80px 的工具结果始终显示最新输出
  const animPres = contentArea.querySelectorAll<HTMLElement>(".orb-tool-anim-pre");
  for (const pre of animPres) {
    pre.scrollTop = pre.scrollHeight;
  }
  // 测量已渲染消息的真实高度存入高度表，供下次裁剪的占位块撑出正确滚动高度
  if (messages.length > CULL_THRESHOLD) {
    const rendered = contentArea.querySelectorAll<HTMLElement>('.orb-msg');
    for (const el of rendered) {
      const mi = parseInt(el.dataset.mi || '-1', 10);
      if (mi >= 0) { const hgt = el.offsetHeight; if (hgt > 0) _msgHeights.set(mi, hgt); }
    }
    _attachCullScroll(contentArea);
  }
  // 折叠动画 RAF：时间戳驱动，每帧重新渲染计算当前 max-height。
  // _activeFoldAnims 中的动画在上面的模板渲染中根据 elapsed 计算并清理。
  // 如有未完成的动画，下一帧继续渲染。
  if (_activeFoldAnims.size > 0) {
    requestAnimationFrame(() => {
      const state = _lastRenderState;
      if (state && _activeFoldAnims.size > 0) renderChatContent(state);
    });
  }
  // 滚动策略（在 markdown 渲染后同步执行：读 scrollHeight 强制 reflow 得到真实高度，
  // 不用 rAF 以消除竞态；suppressScroll 防止程序化滚动误翻 followBottom）
  if (scrollMode === 'follow') {
    followBottom = true;
    contentArea.scrollTop = contentArea.scrollHeight;
  } else if (scrollMode === 'preserve') {
    contentArea.scrollTop = prevScrollTop;
  } else {
    contentArea.scrollTop = followBottom ? contentArea.scrollHeight : prevScrollTop;
  }
  requestAnimationFrame(() => { suppressScroll = false; });
}

/** 从 ChatMessage 中提取纯文本 */
function extractText(msg: ChatMessage): string {
  return msg.content
    .filter((b): b is TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('');
}

// ========== SSE 流式请求 ==========

export async function doSend(
  text: string,
  messages: ChatMessage[],
  apiBase: string,
  signal: AbortSignal,
  onBeforeSend: () => void,
  onRender: () => void,
  onConfigMissing: (msg: string) => void,
): Promise<void> {
  // 注册渲染回调供 scheduleRender 合批调用（并行动画共用一个 rAF）
  _renderCb = onRender;
  // 推用户消息（content block 格式）
  messages.push({ role: 'user', content: [{ type: 'text', text }] });
  onBeforeSend();
  // onRender 在这里只是为了让用户消息气泡先出现，不影响 hint（hint 在 orb.ts 里 startWaitingIndicator 之后追加）
  onRender();

  const config = await readActiveConfig(apiBase);
  if (!config.providerId) { onConfigMissing('未配置 Provider，请先在 API 卡中添加并选择一个 Provider。'); return; }
  if (!config.modelId) { onConfigMissing('未选择 Model，请先在 API 卡或光球面板底部选择一个 Model。'); return; }

  // 加载活跃角色
  let systemPrompt = '';
  if (config.roleFile) {
    try {
      const roleRes = await fetch(apiBase + 'files/read', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: '.kfmv4/roles/' + config.roleFile + '.json' }),
      });
      const roleData = await roleRes.json();
      if (roleData.content) {
        const role = JSON.parse(roleData.content);
        const parts: string[] = [];
        if (role.prompt) parts.push(role.prompt);
        for (const pf of (role.promptFiles || [])) {
          try {
            const fileRes = await fetch(apiBase + 'files/read', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ path: pf }),
            });
            const fileData = await fileRes.json();
            if (fileData.content) parts.push(fileData.content);
          } catch {}
        }
        systemPrompt = parts.join('\n\n');
      }
    } catch {}
  }

  try {
    const model = config.modelId;
    const provider = config.providerId;

    // 构建发给 API 的消息（content → text 压平）
    const apiMessages: Array<{ role: string; content: string }> = [];
    if (systemPrompt) apiMessages.push({ role: 'system', content: systemPrompt });
    for (const m of messages) {
      apiMessages.push({
        role: m.role === 'ai' ? 'assistant' : m.role,
        content: extractText(m),
      });
    }

    const apiRes = await fetch(apiBase + 'ai/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: apiMessages, model, provider }),
      signal,
    });

    const reader = apiRes.body?.getReader();
    if (!reader) throw new Error('无响应体');
    const decoder = new TextDecoder();
    let buffer = '';
    let msgIdx = -1;
    let lastRender = 0;
    const throttledRender = () => { const now = Date.now(); if (now - lastRender > 80) { lastRender = now; onRender(); } };

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
            case 'message_start': {
              // 新轮次：推空 AI 消息
              messages.push({ role: 'ai', content: [] });
              msgIdx = messages.length - 1;
              break;
            }
            case 'content_block_start': {
              if (msgIdx < 0) break;
              // 新 block 到达：不打扰正在运行的工具动画。
              // 每个工具的打字机/折叠动画各自独立跑到完成并自动收起（tick 链自终止、
              // 折叠 300ms 自清理），新 block 只在下方独立渲染自己的内容。
              // 历史 bug：这里曾 finalize 所有进行中的打字机 + clearAllAnimTimers()，
              // 导致上方正在滚动流式的工具框被杀掉 tick timer → 卡住不动、也收不回去。
              // 现在只做无害的容器插槽初始化，动画状态一律保留。
              const { index, blockType, toolUseId, toolName } = event;
              if (blockType === 'text') {
                messages[msgIdx].content[index] = { type: 'text', text: '', reasoning: '' };
              } else if (blockType === 'tool_use') {
                messages[msgIdx].content[index] = {
                  type: 'tool', id: toolUseId || '', name: toolName || 'unknown', input: {},
                };
              }
              break;
            }
            case 'content_block_delta': {
              if (msgIdx < 0) break;
              const { index, deltaType, deltaText } = event;
              const block = messages[msgIdx].content[index];
              if (!block) break;
              if (deltaType === 'text_delta' && block.type === 'text') {
                block.text += deltaText || '';
              } else if (deltaType === 'thinking_delta' && block.type === 'text') {
                block.reasoning = (block.reasoning || '') + (deltaText || '');
              } else if (deltaType === 'input_json_delta' && block.type === 'tool') {
                // 累积 JSON 片段 + 实时流式展示（复用 _animInput）
                const buf = ((block as ToolBlock & { _jsonBuf?: string })._jsonBuf || '') + (deltaText || '');
                (block as ToolBlock & { _jsonBuf?: string })._jsonBuf = buf;
                (block as ToolBlock & { _animInput?: string })._animInput = buf;
              }
              break;
            }
            case 'content_block_stop': {
              // tool block：解析累积的 JSON，设置 block.input（输入参数已通过 content_block_delta 实时流式展示）
              if (msgIdx < 0) break;
              const { index } = event;
              const block = messages[msgIdx].content[index];
              if (block?.type === 'tool' && (block as ToolBlock & { _jsonBuf?: string })._jsonBuf) {
                let parsed: Record<string, unknown> = {};
                try { parsed = JSON.parse((block as ToolBlock & { _jsonBuf: string })._jsonBuf); } catch {}
                block.input = parsed;
                delete (block as ToolBlock & { _jsonBuf?: string })._jsonBuf;
                delete (block as ToolBlock & { _animInput?: string })._animInput;
              }
              break;
            }
            case 'tool_result': {
              if (msgIdx < 0) break;
              const toolBlock = messages[msgIdx].content.find(
                (b): b is ToolBlock => b.type === 'tool' && b.id === event.toolUseId
              );
              if (toolBlock) {
                toolBlock.result = event.toolResult;
                clearToolHint(toolBlock.id);
                const fullText = event.toolResult?.content?.[0]?.text || '';
                type AnimBlock = ToolBlock & { _animText?: string; _foldPhase?: 'out' | 'fold' };
                // 输出动画：500ms 流完 → 340ms 等待 → CSS transition 300ms 折叠
                const DURATION = 500; // ms，打字机动画时长
                const WAIT = 340;     // ms，流完后等待
                const INTERVAL = 16;  // ms，帧间隔
                const totalTicks = Math.max(1, Math.round(DURATION / INTERVAL));
                const cpt = Math.max(1, Math.ceil(fullText.length / totalTicks));
                (toolBlock as AnimBlock)._animText = '';
                let pos = 0;
                requestAnimationFrame(() => {
                  const tick = (): void => {
                    pos = Math.min(pos + cpt, fullText.length);
                    (toolBlock as AnimBlock)._animText = fullText.slice(0, pos);
                    scheduleRender();
                    if (pos >= fullText.length) {
                      // Phase 2: 等待 340ms，然后折叠
                      const t2 = setTimeout(() => {
                        _activeAnimTimers.delete(t2);
                        // Phase 3: 时间戳驱动折叠动画（替代 CSS transition）。
                        // CSS transition 无法工作：innerHTML 重建创建新元素，max-height 从 0 开始。
                        // 不持有 element 引用（innerHTML 会销毁），用 tid → 时间戳映射。
                        delete (toolBlock as AnimBlock)._animText;
                        (toolBlock as AnimBlock)._foldPhase = 'fold';
                        const ti3 = messages[msgIdx].content.filter(b => b.type === 'tool').indexOf(toolBlock);
                        const tid3 = 'tc' + msgIdx + '_' + ti3;
                        _activeFoldAnims.set(tid3, Date.now());
                        scheduleRender();
                      }, WAIT);
                      _activeAnimTimers.add(t2);
                    } else {
                      const t1 = setTimeout(tick, INTERVAL);
                      _activeAnimTimers.add(t1);
                    }
                  };
                  const t0 = setTimeout(tick, INTERVAL);
                  _activeAnimTimers.add(t0);
                });
              }
              break;
            }
            case 'rule_warning': {
              if (msgIdx < 0) break;
              messages[msgIdx].content.push({ type: 'rule_warning', content: event.content || '' } as RuleWarningBlock);
              break;
            }
            case 'error': {
              // 上游/服务错误：即使 message_start 未到达（msgIdx<0）也要显示，
              // 否则用户只看到静默断流。无 AI 消息则新建一条承载错误。
              if (msgIdx < 0) {
                messages.push({ role: 'ai', content: [{ type: 'text', text: '[错误: ' + event.content + ']' }] });
                msgIdx = messages.length - 1;
                break;
              }
              const tb = messages[msgIdx].content.find((b): b is TextBlock => b.type === 'text');
              if (tb) {
                tb.text += '\n\n[错误: ' + event.content + ']';
              } else {
                messages[msgIdx].content.push({ type: 'text', text: '[错误: ' + event.content + ']' });
              }
              break;
            }
          }
          // 结构性事件绕过 throttle 立即渲染；content delta 节流（避免高频重绘）。
          // 设计决策：
          //   message_start — AI 消息容器出现
          //   content_block_start(tool) — 工具卡出现（带摸鱼提示）
          //   tool_result — 执行结果到达
          //   rule_warning — 警告框出现
          //   input_json_delta — 输入参数实时流式展示（走节流渲染，不需要立即渲染）
          if (
            event.type === 'message_start' ||
            (event.type === 'content_block_start' && event.blockType === 'tool_use') ||
            event.type === 'tool_result' ||
            event.type === 'rule_warning'
          ) {
            lastRender = Date.now();
            onRender();
          } else {
            throttledRender();
          }
        } catch {}
      }
    }
    // 兜底：流结束但 message_start 从未收到（provider 静默断流）
    if (msgIdx < 0) {
      messages.push({ role: 'ai', content: [{ type: 'text', text: '[未收到回复，请重试]' }] });
    } else if (messages[msgIdx].content.length === 0) {
      messages[msgIdx].content.push({ type: 'text', text: '[未收到回复，请重试]' });
    }
    onRender();
    // 流结束：清掉所有仍挂着的打字机/折叠 tick timer，否则它们会在下面 cleanup
    // 删除 _animText 后又 fire、把动画状态写回并触发渲染（动画"复活"）。
    clearAllAnimTimers();
    _activeFoldAnims.clear();
    // saveMessages 前清除所有 _animText/_animInput（打字机动画可能仍在运行），防止污染持久化数据
    for (const m of messages) {
      for (const b of m.content) {
        if (b.type === 'tool') {
          delete (b as ToolBlock & { _animText?: string })._animText;
          delete (b as ToolBlock & { _animInput?: string })._animInput;
          delete (b as ToolBlock & { _foldPhase?: string })._foldPhase;
          delete (b as ToolBlock & { _userExpanded?: boolean })._userExpanded;
        }
        if (b.type === 'text') {
          delete (b as TextBlock & { _reasonExpanded?: boolean })._reasonExpanded;
        }
      }
    }
    await sessionStore.saveMessages(messages, config.modelId, config.providerId);
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      const lastMsg = messages[messages.length - 1];
      const tb = lastMsg?.content?.find((b): b is TextBlock => b.type === 'text');
      if (tb) tb.text = '已取消';
      else if (lastMsg) lastMsg.content = [{ type: 'text', text: '已取消' }];
    } else {
      messages.push({ role: 'ai', content: [{ type: 'text', text: '请求失败: ' + (e instanceof Error ? e.message : '未知错误') }] });
    }
  }
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
