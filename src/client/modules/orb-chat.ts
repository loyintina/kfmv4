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
import { currentTheme as theme } from './theme.js';
import { sessionStore } from './session-store.js';
import type { ContentBlock, TextBlock, ToolBlock, RuleWarningBlock } from './session-store.js';
import { MD_CSS } from './renderers/md-css.js';
import { marked } from 'marked';
import { preprocessMd, MARKED_OPTS } from './renderers/md-extensions.js';
import { highlightAll, highlightCode } from './renderers/code-highlight.js';
import { renderMath, renderMermaid, type MathData } from './renderers/math-diagram.js';
import { WAITING_HINTS } from '../data/waiting-hints.js';
import { hslToHex } from './color-utils.js';

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

  // 仅在当前处于追底态时才滚到底让提示可见；用户已上滑浏览（followBottom=false）
  // 则不抢滚——否则工具轮次空档每次 onWait(true) 都强制追底，破坏上滑浏览。
  // 发送新消息的追底由 doSend/scrollMode='follow' 负责，不依赖这里。
  if (followBottom) scrollToBottom(contentArea);

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
let _lastMsgCount = 0; // 上次渲染的消息数——仅当数量增加时给新消息播入场动画（防滑动重渲染反复触发）

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

// 工具框输入/输出富化渲染：按工具类型 + 文件扩展名决定渲染方式。
// 输入参数(JSON) → json 高亮；read/write/edit 的输出按扩展名代码高亮；
// read 的 .md 文件 → 复用正文 marked 管线（富文本）；bash/其它 → 纯文本。
// 完成态内容不变，富化后缓存（key = tool名+内容），滚动重渲染 O(1) 注入。
const _toolCache = new Map<string, string>();
function _toolCacheGet(k: string): string | undefined { return _toolCache.get(k); }
function _toolCacheSet(k: string, html: string): void {
  if (_toolCache.size >= MD_CACHE_MAX) {
    const oldest = _toolCache.keys().next().value;
    if (oldest !== undefined) _toolCache.delete(oldest);
  }
  _toolCache.set(k, html);
}

// 扩展名 → highlight.js language（未列出的返回空串 = 纯文本）
const _EXT_LANG: Record<string, string> = {
  ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript', mjs: 'javascript',
  py: 'python', sh: 'bash', bash: 'bash', zsh: 'bash', json: 'json', html: 'html', xml: 'xml',
  css: 'css', scss: 'scss', sql: 'sql', yaml: 'yaml', yml: 'yaml', rs: 'rust', go: 'go',
  java: 'java', c: 'c', h: 'c', cpp: 'cpp', cc: 'cpp', hpp: 'cpp',
};
/** 从工具 input.path 提取扩展名（去掉 :行号 选择器）。无 path 返回空。 */
function _pathExt(input: Record<string, unknown>): string {
  const p = typeof input.path === 'string' ? input.path : '';
  if (!p) return '';
  const clean = p.replace(/:\d+(-\d*)?$/, ''); // 去 :50 / :50-100 选择器
  const m = clean.match(/\.([a-zA-Z0-9]+)$/);
  return m ? m[1].toLowerCase() : '';
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
// 防闪烁关键：只在裁剪窗口 [firstVisible,lastVisible] 真正变化时才重渲染。
// 滚动在当前窗口内移动（大部分帧）不重建 DOM——否则每次 scroll 都全量 innerHTML
// 重建，代码块高亮 span 销毁重建 = 闪烁。
let _cullRafPending = false;
let _lastCullWin = ''; // 上次裁剪窗口签名 "first:last"，未变则跳过重渲染
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
        // 预判新窗口：若与当前渲染的窗口相同，跳过重渲染（避免 DOM 重建闪烁）
        if (_computeCullWin(ca, st.messages.length) === _lastCullWin) return;
        renderChatContent({ ...st, scrollMode: 'preserve' });
      }
    });
  }, { passive: true });
}

// 用当前 scrollTop + 高度表预判裁剪窗口签名，与实际渲染逻辑一致。
function _computeCullWin(ca: HTMLElement, msgCount: number): string {
  const h = (i: number) => _msgHeights.get(i) ?? DEFAULT_MSG_H;
  const scrollTop = ca.scrollTop;
  const viewportH = ca.clientHeight || 400;
  const winTop = scrollTop - CULL_BUFFER_PX;
  const winBot = scrollTop + viewportH + CULL_BUFFER_PX;
  let firstVisible = msgCount, lastVisible = -1, acc = 0;
  for (let i = 0; i < msgCount; i++) {
    const hi = h(i);
    if (acc + hi >= winTop && acc <= winBot) {
      if (i < firstVisible) firstVisible = i;
      if (i > lastVisible) lastVisible = i;
    }
    acc += hi;
  }
  if (lastVisible < 0) { firstVisible = 0; lastVisible = msgCount - 1; }
  return firstVisible + ':' + lastVisible;
}

// ========== 滚动追底状态 ==========
// 反复回归的老问题（4次）根治方案：区分「用户主动手势」和「程序化滚动」。
// 旧方案用 suppressScroll 时间窗口忽略 scroll 事件——但流式渲染每帧都
// suppressScroll=true，用户上滑的 scroll 事件全被吞 → 追底取消不了。
//
// 新方案：
//   - 用户主动手势（touchmove 向下拖 / wheel 向上）→ 立即 followBottom=false
//   - scroll 事件只读当前位置：滑回底部（dist<40）→ followBottom=true 恢复追底
//   - 不再抑制任何事件；程序化滚动产生的 scroll 事件读位置也是自洽的
//     （滚到底→dist<40→true，本就该追底；preserve 滚到别处→false，也对）
let followBottom = true;

function attachScrollWatch(ca: HTMLElement): void {
  const tagged = ca as HTMLElement & { _scrollWatch?: boolean };
  if (tagged._scrollWatch) return;
  tagged._scrollWatch = true;
  // scroll 事件：纯读当前位置判断是否在底部（不区分来源，位置语义自洽）
  ca.addEventListener('scroll', () => {
    const dist = ca.scrollHeight - ca.scrollTop - ca.clientHeight;
    followBottom = dist < 40;
  }, { passive: true });
  // 用户主动手势：向上浏览的意图立即生效，不等 scroll 事件（移动端关键）
  let _touchY = 0;
  ca.addEventListener('touchstart', (e) => {
    _touchY = e.touches[0]?.clientY ?? 0;
  }, { passive: true });
  ca.addEventListener('touchmove', (e) => {
    const y = e.touches[0]?.clientY ?? 0;
    // 手指下移（y 增大）= 内容上滑 = 用户想往回看 → 取消追底
    if (y - _touchY > 4) followBottom = false;
    _touchY = y;
  }, { passive: true });
  ca.addEventListener('wheel', (e) => {
    if (e.deltaY < 0) followBottom = false; // 滚轮向上 → 取消追底
  }, { passive: true });
}

function scrollToBottom(ca: HTMLElement): void {
  ca.scrollTop = ca.scrollHeight;
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
  (window as unknown as Record<string, unknown>).__orbMsgs = messages; // escape-ok: 挂到 window 供内联 onclick 读取，DOM 全局无类型
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
      const userText = msg.content.find((b): b is TextBlock => b?.type === 'text')?.text || '';
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
      const textBlocks = msg.content.filter((b): b is TextBlock => b?.type === 'text');
      const toolBlocks = msg.content.filter((b): b is ToolBlock => b?.type === 'tool');
      const warningBlocks = msg.content.filter(b => b?.type === 'rule_warning') as Array<{ type: 'rule_warning'; content: string }>;
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
        // 折叠规则：思考中展开；完成后默认折叠；用户点击后以 _reasonExpanded 为准。
        // 流式中用 orb-fold-open（无过渡，内容稳定显示，避免全量重建让 CSS 过渡失效而卡住）；
        // 完成/折叠态用 orb-fold-content（+collapsed），用户点击展开/折叠时同一元素 class 切换
        // 能触发 CSS 过渡（onclick 里 classList.toggle）。历史消息直接静态折叠，无动画。
        const reasonOpen = re !== undefined ? re : !reasoningDone;
        const streaming = !reasoningDone;
        const displayClass = streaming
          ? 'orb-fold-open'
          : (reasonOpen ? 'orb-fold-content' : 'orb-fold-content collapsed');
        html += `
          <div style="display:flex;justify-content:flex-start;margin-bottom:4px">
            <div style="flex:1;max-width:100%;padding:5px 10px;border-radius:8px;background:linear-gradient(rgba(10,15,30,0.75),rgba(10,15,30,0.75)) padding-box,${theme.aiChat.panelBorderGradient} border-box;border:1px solid transparent;border-left-width:3px;font-size:var(--card-font-size,10px)">
              <div data-msg="${idx}" onclick="var p=document.getElementById('${rid}');p.classList.toggle('collapsed');this.querySelector('.rt-arrow').textContent=p.classList.contains('collapsed')?'▶':'▼';var m=this.dataset.msg;if(window.__orbMsgs&&m>=0){var t=window.__orbMsgs[m]?.content?.filter(function(x){return x&&x.type==='text'})[0];if(t)t._reasonExpanded=!p.classList.contains('collapsed')}" style="display:flex;align-items:center;gap:6px;cursor:pointer;user-select:none">
                <span class="rt-arrow" style="font-size:7px;color:rgba(0,212,255,0.5)">${reasonOpen ? '▼' : '▶'}</span>
                <span style="color:rgba(0,212,255,0.6);font-weight:600">${rlabel}</span>
              </div>
              <div id="${rid}" class="${displayClass}" style="margin-top:4px">
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
        type AnimBlock = ToolBlock & { _animInput?: string; _foldPhase?: 'out' | 'fold' };
        const ab = tc as AnimBlock;
        const gradientBorder = `linear-gradient(rgba(10,15,30,0.75),rgba(10,15,30,0.75)) padding-box,linear-gradient(135deg,${hexToRgba(c2, 0.55)} 30%,${hexToRgba(c1, 0.55)} 70%) border-box`;
        // 展开态三段结构：输入参数 → 渐变分隔线 → 输出区（执行中为摸鱼提示，完成为结果）。
        // 分隔线复用工具卡的随机双色 c1/c2，视觉上标记"这次交互是独特的"（Fi 审美）。
        // 无参数的工具（如 kfm-snapshot）不渲染输入区和分隔线，直接显示输出区。
        const preStyle = 'font-size:var(--card-font-size,9px);line-height:1.4;white-space:pre-wrap;word-break:break-word;margin:0;font-family:inherit;background:rgba(0,0,0,0.2);padding:4px 6px;border-radius:4px';
        const isInputAnimating = ab._animInput !== undefined;
        const paramsDisplay = isInputAnimating ? ab._animInput! : paramsFull;
        const isCollapsible = hasResult && paramsDisplay; // 有输出+有参数 → 整体容器折叠
        const isFolding = !!ab._foldPhase && !isCollapsible;
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
        const resultText = hasResult ? (tc.result!.content?.[0]?.text || '') : '';
        // 折叠状态持久化：完成的工具卡默认折叠。执行中/折叠动画中强制展开；
        // 否则由 block._userExpanded 决定（用户点击展开/折叠会写回此标志，跨重渲染保持）。
        const ue = (tc as ToolBlock & { _userExpanded?: boolean })._userExpanded;
        const forceOpen = isExecuting || isFolding;
        const isOpen = forceOpen || ue === true;
        // 折叠动画期间（_foldPhase）用 orb-fold-anim 关掉 CSS transition，
        // 避免与 containerFoldClip 逐帧 inline max-height 打架抖动；否则用 orb-fold-content 走 CSS 过渡。
        const isFoldAnim = ab._foldPhase === 'fold';
        const foldClass = isFoldAnim ? 'orb-fold-anim' : (isOpen ? 'orb-fold-content' : 'orb-fold-content collapsed');
        const defaultArrow = isOpen ? '▼' : '▶';
        // 展开态两区结构：输入区 + 分隔线 + 输出区，各自限高可滚动。
        // 内容少时以内容高度为准；内容多时撑到 max-height 并内部滚动（不撑爆卡片）。
        const INPUT_MAX_H = 80, OUTPUT_MAX_H = 80;
        // 输入区流式时（_animInput）标记 orb-tool-anim-pre 自动滚到底；非动画完成态
        // 标记 data-tool-in 供后处理做 JSON 高亮（打字机动画中不高亮，避免闪烁）。
        const inputAnimClass = isInputAnimating ? ' orb-tool-anim-pre' : '';
        const inputRich = paramsDisplay && !isInputAnimating ? ' data-tool-in="1"' : '';
        const inputHtml = paramsDisplay
          ? `<pre class="orb-tool-input-pre${inputAnimClass}"${inputRich} style="${preStyle};color:rgba(255,255,255,0.45);max-height:${INPUT_MAX_H}px;overflow-y:auto">${escapeHtml(paramsDisplay)}</pre>`
          : '';
        const dividerHtml = paramsFull
          ? `<div style="height:1px;margin:5px 0;border-radius:1px;background:linear-gradient(90deg,${hexToRgba(c1, 0.7)},${hexToRgba(c2, 0.7)})"></div>`
          : '';
        let outputHtml: string;
        if (isExecuting) {
          const hint = getToolHint(tc.id);
          outputHtml = `<div style="color:rgba(255,255,255,0.4);font-size:var(--card-font-size,9px);line-height:1.4;padding:2px 0">${hint.dotHtml}${escapeHtml(hint.text)}</div>`;
        } else {
          // 输出到达即完成态（不再有打字机流式）。标记 data-tool-out=工具名、
          // data-tool-ext=扩展名，供后处理一次性完整富化（marked/highlight 只跑一次+缓存）。
          // reveal 动画（内容涌现感）交给 CSS .orb-tool-reveal，零重复渲染。
          const outExt = _pathExt(tc.input);
          outputHtml = `<pre class="orb-tool-output-pre" data-tool-out="${escapeHtml(tc.name)}" data-tool-ext="${outExt}" style="${preStyle};color:rgba(255,255,255,0.6);max-height:${OUTPUT_MAX_H}px;overflow-y:auto">${escapeHtml(resultText || '(无结果)')}</pre>`;
        }
        html += `
          <div style="display:flex;justify-content:flex-start;margin-bottom:6px">
            <div class="orb-tool-card" style="flex:1;max-width:100%;padding:5px 10px;border-radius:8px;background:${gradientBorder};border:1px solid transparent;border-left-width:3px;border-left-color:${hexToRgba(c1, 0.7)};font-size:var(--card-font-size,10px)">
              <div data-msg="${idx}" data-ti="${ti}" onclick="var p=document.getElementById('${tid}');p.classList.toggle('collapsed');this.querySelector('.orb-tc-arrow').textContent=p.classList.contains('collapsed')?'▶':'▼';var m=this.dataset.msg,t=this.dataset.ti;if(window.__orbMsgs&&m>=0){var b=window.__orbMsgs[m]?.content?.filter(function(x){return x&&x.type==='tool'})[t];if(b){b._userExpanded=!p.classList.contains('collapsed');if(!p.classList.contains('collapsed')){delete b._foldPhase}}}" style="display:flex;align-items:center;gap:6px;cursor:pointer;user-select:none;margin-bottom:2px">
                <span class="orb-tc-arrow" style="font-size:7px;color:rgba(255,255,255,0.5)">${defaultArrow}</span>
                <span style="color:${hexToRgba(c1, 0.9)};font-weight:600">${escapeHtml(tc.name)}</span>
                <span style="color:${statusColor};font-size:var(--card-font-size,9px);font-weight:600">${statusLabel}</span>
              </div>
              <div id="${tid}" class="${foldClass}" style="margin-top:4px;${containerFoldClip}">
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

    const isNewMsg = idx === messages.length - 1 && messages.length > _lastMsgCount;
    msgHtmls.push('<div class="orb-msg' + (isNewMsg ? ' orb-msg-new' : '') + '" data-mi="' + idx + '">' + html + '</div>');
    idx++;
  }
  // 保存滚动位置（在重建 innerHTML 之前）
  const prevScrollTop = contentArea.scrollTop;
  const viewportH = contentArea.clientHeight || 400;
  // 等待提示节点在 innerHTML 重建后需要恢复（它是独立 DOM 节点，不在 html 字符串里）
  const hintEl = contentArea.querySelector('#' + HINT_ID) as HTMLElement | null;
  attachScrollWatch(contentArea);

  // ===== 视口裁剪：决定渲染窗口 =====
  const cull = messages.length > CULL_THRESHOLD;
  let html: string;
  let _cullFirstVisible = 0;    // 本次裁剪的窗口起始索引（-1 = 未裁剪）
  let _cullEstTopPad = 0;       // 估算的 topPad（供渲染后对比真实高度补偿抖动）
  if (!cull) {
    html = msgHtmls.join('');
    _cullFirstVisible = -1;
    _lastCullWin = '';
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
    _cullFirstVisible = firstVisible;
    _cullEstTopPad = topPad;
    _lastCullWin = firstVisible + ':' + lastVisible;
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
        .filter((b): b is TextBlock => b?.type === 'text')
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
  // 工具框输入/输出富化：输入 JSON 高亮；输出按工具类型（read .md → marked，
  // read/write/edit 代码 → 高亮，其它 → 纯文本）。完成态富化+缓存，滚动 O(1)。
  const toolIns = contentArea.querySelectorAll<HTMLElement>('pre[data-tool-in]');
  for (const pre of toolIns) {
    const raw = pre.textContent || '';
    if (!raw) continue;
    const key = 'in:' + raw;
    const cached = _toolCacheGet(key);
    if (cached !== undefined) { pre.innerHTML = cached; pre.removeAttribute('data-tool-in'); continue; }
    pre.innerHTML = '<code class="language-json">' + escapeHtml(raw) + '</code>';
    const inCode = pre.querySelector('code'); if (inCode) highlightCode(inCode as HTMLElement);
    _toolCacheSet(key, pre.innerHTML);
    pre.removeAttribute('data-tool-in');
  }
  const toolOuts = contentArea.querySelectorAll<HTMLElement>('pre[data-tool-out]');
  for (const pre of toolOuts) {
    const raw = pre.textContent || '';
    if (!raw || raw === '(无结果)') continue;
    const tool = pre.dataset.toolOut || '';
    const ext = pre.dataset.toolExt || '';
    const key = 'out:' + tool + ':' + ext + ':' + raw;
    const cached = _toolCacheGet(key);
    if (cached !== undefined) { pre.outerHTML = cached; continue; }
    // read 的 markdown → marked 完整管线（一次性，含 highlight/math/mermaid）+ 缓存
    if (tool === 'read' && (ext === 'md' || ext === 'markdown')) {
      const mathData: MathData = { display: [], inline: [] };
      const processed = preprocessMd(raw, mathData);
      const mdHtml = marked.parse(processed, MARKED_OPTS) as string;
      const wrap = document.createElement('div');
      wrap.className = 'md-body orb-tool-md orb-tool-reveal';
      wrap.innerHTML = mdHtml;
      highlightAll(wrap); renderMath(wrap, mathData); renderMermaid(wrap, '#00d4ff');
      pre.replaceWith(wrap);
      if (!/```mermaid/.test(raw)) _toolCacheSet(key, wrap.outerHTML);
      continue;
    }
    // read/write/edit 代码文件 → 按扩展名高亮（一次性）+ 缓存
    const lang = (tool === 'read' || tool === 'write' || tool === 'edit') ? _EXT_LANG[ext] : '';
    if (lang) {
      pre.innerHTML = '<code class="language-' + lang + '">' + escapeHtml(raw) + '</code>';
      pre.classList.add('orb-tool-reveal');
      const outCode = pre.querySelector('code'); if (outCode) highlightCode(outCode as HTMLElement);
      _toolCacheSet(key, pre.outerHTML);
      continue;
    }
    // 其它（bash/grep/无扩展名）→ 纯文本，加 reveal 动画
    pre.classList.add('orb-tool-reveal');
    pre.removeAttribute('data-tool-out');
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
  // 裁剪抖动补偿：物化新消息后，firstVisible 之前的真实累积高度可能 ≠ 估算 topPad
  // （之前用 DEFAULT_MSG_H=80 估算）。差值补进 prevScrollTop，保持视觉位置不跳 → 消除抖动。
  let scrollAdjust = 0;
  if (_cullFirstVisible > 0) {
    let realTopPad = 0;
    for (let i = 0; i < _cullFirstVisible; i++) realTopPad += _msgHeights.get(i) ?? DEFAULT_MSG_H;
    scrollAdjust = realTopPad - _cullEstTopPad;
  }
  // 滚动策略（在 markdown 渲染后同步执行：读 scrollHeight 强制 reflow 得到真实高度）：
  //   follow  = 发送时强制追底；preserve = resize 保留位置；
  //   auto    = 按 followBottom（用户上滑取消追底，滑回底部恢复）
  if (scrollMode === 'follow') {
    followBottom = true;
    contentArea.scrollTop = contentArea.scrollHeight;
  } else if (scrollMode === 'preserve') {
    contentArea.scrollTop = prevScrollTop + scrollAdjust;
  } else {
    contentArea.scrollTop = followBottom ? contentArea.scrollHeight : prevScrollTop + scrollAdjust;
  }
  _lastMsgCount = messages.length;
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
        (block as ToolBlock & { _animInput?: string })._animInput = buf;
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
        delete (block as ToolBlock & { _animInput?: string })._animInput;
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
        clearToolHint(toolBlock.id);
        // 不再用 _animText 打字机逐帧重渲染（每 tick 重跑 marked/highlight 是卡顿根源）。
        // 结果直接落定 → 渲染一次完整富文本（进缓存），reveal 动画交给 CSS（见 .orb-tool-reveal）。
        // 停留 WAIT 后自动折叠（保留原体验）。
        const WAIT = 340;
        const capturedMsgIdx = msgIdx;
        scheduleRender();
        const t2 = setTimeout(() => {
          _activeAnimTimers.delete(t2);
          (toolBlock as ToolBlock & { _foldPhase?: 'out' | 'fold' })._foldPhase = 'fold';
          const ti3 = messages[capturedMsgIdx].content.filter(b => b?.type === 'tool').indexOf(toolBlock);
          const tid3 = 'tc' + capturedMsgIdx + '_' + ti3;
          _activeFoldAnims.set(tid3, Date.now());
          scheduleRender();
        }, WAIT);
        _activeAnimTimers.add(t2);
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
  let lastRender = 0;
  const throttledRender = () => { const now = Date.now(); if (now - lastRender > 80) { lastRender = now; ctx.onRender(); } };
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
        if (
          event.type === 'message_start' ||
          (event.type === 'content_block_start' && event.blockType === 'tool_use') ||
          event.type === 'tool_result' ||
          event.type === 'rule_warning'
        ) { lastRender = Date.now(); ctx.onRender(); }
        else throttledRender();
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

/** 生成完成后的收尾：清动画 timer + 去除临时字段 + 落盘 */
async function _finalizeRun(messages: ChatMessage[], msgIdx: number, model: string, provider: string): Promise<void> {
  if (msgIdx < 0) {
    messages.push({ role: 'ai', content: [{ type: 'text', text: '[未收到回复，请重试]' }] });
  } else if (messages[msgIdx] && messages[msgIdx].content.length === 0) {
    messages[msgIdx].content.push({ type: 'text', text: '[未收到回复，请重试]' });
  }
  clearAllAnimTimers();
  _activeFoldAnims.clear();
  // 收尾任何仍无 result 的工具块（流已结束，如上游 error 中断时工具未返回结果）——
  // 否则渲染判 isExecuting=!result 会让工具卡永久卡"忙碌中"（BAR-105 同类，error 触发路径）。
  settlePendingToolBlocks(messages, '(未完成)');
  for (const m of messages) {
    for (const b of m.content) {
      if (b?.type === 'tool') clearToolHint((b as ToolBlock).id);
      if (b?.type === 'text') delete (b as TextBlock & { _reasonExpanded?: boolean })._reasonExpanded;
    }
  }
  await sessionStore.saveMessages(messages, model, provider);
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
        delete (b as ToolBlock & { _animText?: string })._animText;
        delete (b as ToolBlock & { _animInput?: string })._animInput;
        delete (b as ToolBlock & { _foldPhase?: string })._foldPhase;
        delete (b as ToolBlock & { _userExpanded?: boolean })._userExpanded;
      }
    }
  }
  return settled;
}

/**
 * 取消时收尾：清动画计时器/toolHint（DOM 副作用），再调纯函数标记未完成工具块。
 */
function _cancelPendingTools(messages: ChatMessage[]): void {
  clearAllAnimTimers();
  _activeFoldAnims.clear();
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
  _renderCb = onRender;
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
    if (result === 'done') {
      _persistActiveRun('', null);
      await _finalizeRun(messages, msgIdx, model, provider);
    }
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

    // 构建发给 API 的消息（content blocks → OpenAI 格式）。
    // 会话文件存的是完整 content blocks（含 tool_use + tool_result），
    // 发给 API 时必须转为 OpenAI 的 tool_calls + role:"tool" 格式。
    const apiMessages: Array<{ role: string; content: string | null; tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>; tool_call_id?: string }> = [];
    if (systemPrompt) apiMessages.push({ role: 'system', content: systemPrompt });
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
      body: JSON.stringify({ sessionId: _sendSessionId, messages: apiMessages, model, provider }),
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
    if (result === 'done') {
      await _finalizeRun(messages, msgIdx, model, provider);
    }
    // result==='gone'：run 在服务端消失（进程重启/淘汰），停止；已渲染的内容保留
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
