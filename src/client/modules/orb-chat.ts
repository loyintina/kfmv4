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

// （已删除 _inputAnimTimers — 输入参数改为实时流式展示，不再需要提前终止逻辑）

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

  const innerWidth = renderWidth - 24;
  if (innerWidth < 50) return;

  let html = '';
  let idx = 0;
  for (const msg of messages) {
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
      if (reasoning) {
        const rid = 'r' + idx;
        const rlabel = reasoningDone ? '已思考' : '思考中...';
        const displayStyle = reasoningDone ? 'display:none' : 'display:block';
        html += `
          <div style="display:flex;justify-content:flex-start;margin-bottom:4px">
            <div style="flex:1;max-width:100%;padding:5px 10px;border-radius:8px;background:linear-gradient(rgba(10,15,30,0.75),rgba(10,15,30,0.75)) padding-box,${theme.aiChat.panelBorderGradient} border-box;border:1px solid transparent;border-left-width:3px;font-size:var(--card-font-size,10px)">
              <div onclick="var p=document.getElementById('${rid}');var s=p.style.display==='none'?'block':'none';p.style.display=s;this.querySelector('.rt-arrow').textContent=s==='block'?'▼':'▶'" style="display:flex;align-items:center;gap:6px;cursor:pointer;user-select:none">
                <span class="rt-arrow" style="font-size:7px;color:rgba(0,212,255,0.5)">${reasoningDone ? '▶' : '▼'}</span>
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
        type AnimBlock = ToolBlock & { _animText?: string; _animInput?: string };
        const ab = tc as AnimBlock;
        const isAnimating = ab._animText !== undefined;
        const resultText = hasResult
          ? (isAnimating ? ab._animText! : (tc.result!.content?.[0]?.text || ''))
          : '';
        const defaultDisplay = (isExecuting || isAnimating) ? 'block' : 'none';
        const defaultArrow = (isExecuting || isAnimating) ? '▼' : '▶';
        const gradientBorder = `linear-gradient(rgba(10,15,30,0.75),rgba(10,15,30,0.75)) padding-box,linear-gradient(135deg,${hexToRgba(c2, 0.55)} 30%,${hexToRgba(c1, 0.55)} 70%) border-box`;
        // 展开态三段结构：输入参数 → 渐变分隔线 → 输出区（执行中为摸鱼提示，完成为结果）。
        // 分隔线复用工具卡的随机双色 c1/c2，视觉上标记"这次交互是独特的"（Fi 审美）。
        // 无参数的工具（如 kfm-snapshot）不渲染输入区和分隔线，直接显示输出区。
        const preStyle = 'font-size:var(--card-font-size,9px);line-height:1.4;white-space:pre-wrap;word-break:break-word;margin:0;font-family:inherit;background:rgba(0,0,0,0.2);padding:4px 6px;border-radius:4px';
        const isInputAnimating = ab._animInput !== undefined;
        const paramsDisplay = isInputAnimating ? ab._animInput! : paramsFull;
        const inputHtml = paramsDisplay
          ? `<pre style="${preStyle};color:rgba(255,255,255,0.45)">${escapeHtml(paramsDisplay)}</pre>`
          : '';
        const dividerHtml = paramsFull
          ? `<div style="height:1px;margin:5px 0;border-radius:1px;background:linear-gradient(90deg,${hexToRgba(c1, 0.7)},${hexToRgba(c2, 0.7)})"></div>`
          : '';
        let outputHtml: string;
        if (isExecuting) {
          const hint = getToolHint(tc.id);
          outputHtml = `<div style="color:rgba(255,255,255,0.4);font-size:var(--card-font-size,9px);line-height:1.4;padding:2px 0">${hint.dotHtml}${escapeHtml(hint.text)}</div>`;
        } else {
          outputHtml = `<pre style="${preStyle};color:rgba(255,255,255,0.6)">${escapeHtml(resultText || '(无结果)')}</pre>`;
        }
        html += `
          <div style="display:flex;justify-content:flex-start;margin-bottom:6px">
            <div class="orb-tool-card" style="flex:1;max-width:100%;padding:5px 10px;border-radius:8px;background:${gradientBorder};border:1px solid transparent;border-left-width:3px;border-left-color:${hexToRgba(c1, 0.7)};font-size:var(--card-font-size,10px)">
              <div onclick="var p=document.getElementById('${tid}');var s=p.style.display==='none'?'block':'none';p.style.display=s;this.querySelector('.orb-tc-arrow').textContent=s==='block'?'▼':'▶'" style="display:flex;align-items:center;gap:6px;cursor:pointer;user-select:none">
                <span class="orb-tc-arrow" style="font-size:7px;color:rgba(255,255,255,0.5)">${defaultArrow}</span>
                <span style="color:${hexToRgba(c1, 0.9)};font-weight:600">${escapeHtml(tc.name)}</span>
                <span style="color:${statusColor};font-size:var(--card-font-size,9px);font-weight:600">${statusLabel}</span>
              </div>
              <div id="${tid}" style="display:${defaultDisplay};margin-top:4px">
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

    idx++;
  }
  // 保存滚动位置（在重建 innerHTML 之前）
  const prevScrollTop = contentArea.scrollTop;
  // 等待提示节点在 innerHTML 重建后需要恢复（它是独立 DOM 节点，不在 html 字符串里）
  const hintEl = contentArea.querySelector('#' + HINT_ID) as HTMLElement | null;
  attachScrollWatch(contentArea);
  suppressScroll = true;
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
  const msgEls = contentArea.querySelectorAll<HTMLElement>('.orb-msg-text');
  for (const el of msgEls) {
    const i = parseInt(el.dataset.msgIdx || '-1', 10);
    if (i >= 0 && i < messages.length && messages[i].role !== 'user') {
      const text = messages[i].content
        .filter((b): b is TextBlock => b.type === 'text')
        .map(b => b.text || '').join('');
      if (text.length > 0) {
        const mathData: MathData = { display: [], inline: [] };
        const processed = preprocessMd(text, mathData);
        const mdHtml = marked.parse(processed, MARKED_OPTS) as string;
        el.innerHTML = '<div class="md-body">' + mdHtml + '</div>';
        const mdBody = el.querySelector('.md-body') as HTMLElement;
        highlightAll(mdBody);
        renderMath(mdBody, mathData);
        renderMermaid(mdBody, '#00d4ff');
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
                type AnimBlock = ToolBlock & { _animText?: string };
                requestAnimationFrame(() => {
                  if (fullText.length > 0) {
                    const TICKS = 90;
                    const charsPerTick = Math.max(1, Math.ceil(fullText.length / TICKS));
                    (toolBlock as AnimBlock)._animText = '';
                    let pos = 0;
                    const iv = setInterval(() => {
                      pos = Math.min(pos + charsPerTick, fullText.length);
                      (toolBlock as AnimBlock)._animText = fullText.slice(0, pos);
                      if (pos >= fullText.length) {
                        clearInterval(iv);
                        delete (toolBlock as AnimBlock)._animText;
                      }
                      onRender();
                    }, 16);
                  } else {
                    onRender();
                  }
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
              if (msgIdx < 0) break;
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
    // saveMessages 前清除所有 _animText/_animInput（打字机动画可能仍在运行），防止污染持久化数据
    for (const m of messages) {
      for (const b of m.content) {
        if (b.type === 'tool') {
          delete (b as ToolBlock & { _animText?: string })._animText;
          delete (b as ToolBlock & { _animInput?: string })._animInput;
        }
      }
    }
    _inputAnimTimers.clear();
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
