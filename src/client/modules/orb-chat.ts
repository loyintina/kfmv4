/**
 * orb-chat.ts — AI 对话消息渲染与 SSE 流式通信
 *
 * 从 orb.ts 拆分出聊天相关逻辑。orb.ts 负责光球 UI / 手势 / 面板状态机，
 * 本模块负责消息气泡渲染、Markdown 管线和 SSE 流式请求。
 *
 * 所有状态通过参数传入，不持有模块级可变状态。
 */

import { DOM } from './dom-refs.js';
import { currentTheme as theme } from './theme.js';
import { sessionStore } from './session-store.js';
import { MD_CSS } from './renderers/md-css.js';
import { marked } from 'marked';
import { preprocessMd, MARKED_OPTS } from './renderers/md-extensions.js';
import { highlightAll } from './renderers/code-highlight.js';
import { renderMath, renderMermaid, type MathData } from './renderers/math-diagram.js';

// ========== 类型 ==========

export interface ToolCallRecord {
  name: string;
  params: Record<string, unknown>;
  result?: { content: Array<{ type: string; text?: string }>; isError?: boolean };
  // 随机配色（渲染时生成，不做持久化）
  color1?: string;
  color2?: string;
}

export interface ChatMessage {
  role: 'user' | 'ai';
  text: string;
  reasoning?: string;
  toolCalls?: ToolCallRecord[];
  ruleWarnings?: string[];
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
    let bubbleHtml = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px">
      <span style="font-size:10px;color:${labelColor};font-weight:600">${label}</span>
      <span class="orb-msg-actions" data-idx="${idx}" style="display:flex;gap:2px">
        <button class="orb-act-btn" data-action="copy" style="padding:0 2px;border:none;background:transparent;color:rgba(0,212,255,0.25);font-size:8px;cursor:pointer;line-height:1;font-family:inherit" onmouseenter="this.style.color='rgba(0,212,255,0.85)'" onmouseleave="this.style.color='rgba(0,212,255,0.25)'">复制</button>
        <button class="orb-act-btn" data-action="edit" style="padding:0 2px;border:none;background:transparent;color:rgba(0,212,255,0.25);font-size:8px;cursor:pointer;line-height:1;font-family:inherit" onmouseenter="this.style.color='rgba(0,212,255,0.85)'" onmouseleave="this.style.color='rgba(0,212,255,0.25)'">编辑</button>
        <button class="orb-act-btn" data-action="del"  style="padding:0 2px;border:none;background:transparent;color:rgba(255,100,100,0.25);font-size:8px;cursor:pointer;line-height:1;font-family:inherit" onmouseenter="this.style.color='rgba(255,100,100,0.85)'" onmouseleave="this.style.color='rgba(255,100,100,0.25)'">删除</button>
      </span>
    </div>`;

    // 思考内容
    const hasToolCalls = !isUser && msg.toolCalls && msg.toolCalls.length > 0;
    const reasoningDone = !!(msg.text || hasToolCalls); // 有正文或有工具调用 = 思考已完成
    if (!isUser && msg.reasoning) {
      const rid = 'r' + idx;
      const rlabel = reasoningDone ? '已思考' : '思考中...';
      const displayStyle = reasoningDone ? 'display:none' : 'display:block';
      bubbleHtml += `<div onclick="var p=document.getElementById('${rid}');p.style.display=p.style.display==='none'?'':'none'" style="font-size:9px;color:rgba(0,212,255,0.5);cursor:pointer;margin-bottom:2px;user-select:none">${rlabel} <span style="font-size:7px">▼</span></div>`;
      bubbleHtml += `<div id="${rid}" style="${displayStyle};font-size:var(--card-font-size,10px);line-height:16px;color:rgba(255,255,255,0.45);margin-bottom:4px;padding:4px 6px;border-radius:4px;background:rgba(0,0,0,0.2);white-space:pre-wrap">${escapeHtml(msg.reasoning)}</div>`;
    }

    const lineHeight = 16;
    bubbleHtml += `<div class="orb-msg-text" data-msg-idx="${idx}" style="font-family:sans-serif;font-size:var(--card-font-size,13px);line-height:${lineHeight}px;color:${theme.aiChat.bubbleText};word-break:break-word">${renderPlainText(msg.text)}</div>`;

    // 纯思考气泡（无正文、无工具调用）→ 全宽独立块，样式同工具卡片
    const reasoningOnly = !isUser && msg.reasoning && !msg.text && !hasToolCalls;
    if (reasoningOnly) {
      const rid2 = 'r' + idx;
      const rlabel2 = reasoningDone ? '已思考' : '思考中...';
      const displayStyle2 = reasoningDone ? 'display:none' : 'display:block';
      html += `
        <div style="display:flex;justify-content:flex-start;margin-bottom:8px">
          <div style="flex:1;max-width:100%;padding:5px 10px;border-radius:8px;background:linear-gradient(rgba(10,15,30,0.75),rgba(10,15,30,0.75)) padding-box,${theme.aiChat.panelBorderGradient} border-box;border:1px solid transparent;border-left-width:3px;font-size:var(--card-font-size,10px)">
            <div onclick="var p=document.getElementById('${rid2}');var s=p.style.display==='none'?'block':'none';p.style.display=s;this.querySelector('.rt-arrow').textContent=s==='block'?'▼':'▶'" style="display:flex;align-items:center;gap:6px;cursor:pointer;user-select:none">
              <span class="rt-arrow" style="font-size:7px;color:rgba(0,212,255,0.5)">${reasoningDone ? '▶' : '▼'}</span>
              <span style="color:rgba(0,212,255,0.6);font-weight:600">${rlabel2}</span>
            </div>
            <div id="${rid2}" style="${displayStyle2};margin-top:4px">
              <pre style="font-size:var(--card-font-size,9px);color:rgba(255,255,255,0.45);line-height:1.4;white-space:pre-wrap;word-break:break-word;margin:0;font-family:inherit;background:rgba(0,0,0,0.15);padding:4px 6px;border-radius:4px">${escapeHtml(msg.reasoning ?? '')}</pre>
            </div>
          </div>
        </div>`;
    } else {
      const maxWidth = isUser ? Math.min(innerWidth - 8, innerWidth * 0.85) : innerWidth - 8;
      html += `
        <div style="display:flex;justify-content:${align};margin-bottom:8px">
          <div style="max-width:${maxWidth}px;padding:6px 12px;background:${bgColor};${borderStyle}border-radius:8px;box-shadow:${boxShadow}">
            ${bubbleHtml}
          </div>
        </div>`;
    }

    // 工具调用卡片（气泡外，独立块）
    if (!isUser && msg.toolCalls && msg.toolCalls.length > 0) {
      for (const tc of msg.toolCalls) {
        if (!tc.color1) { const a = randomToolAccent(); tc.color1 = a.color1; tc.color2 = a.color2; }
        const c1 = tc.color1!, c2 = tc.color2!;
        const tid = 'tc' + idx + '_' + (msg.toolCalls!.indexOf(tc));
        const hasResult = !!tc.result;
        const isExecuting = !hasResult;
        const isError = hasResult && tc.result!.isError;
        const statusLabel = isExecuting ? '执行中' : (isError ? '失败' : '成功');
        const statusColor = isExecuting ? 'rgba(255,255,255,0.4)' : (isError ? 'rgba(255,100,100,0.8)' : 'rgba(0,212,115,0.8)');
        // 显示参数（执行中或完成后都显示）
        const paramsText = Object.keys(tc.params).length > 0 ? JSON.stringify(tc.params, null, 2) : '';
        const resultText = hasResult ? (tc.result!.content?.[0]?.text || '') : '';
        // 执行中显示参数 + 执行中提示，完成后显示结果
        const contentText = isExecuting
          ? (paramsText ? '参数:\n' + paramsText + '\n\n执行中...' : '执行中...')
          : (resultText || '(无结果)');
        // 执行中默认展开，完成后默认折叠
        const defaultDisplay = isExecuting ? 'block' : 'none';
        const defaultArrow = isExecuting ? '▼' : '▶';
        const gradientBorder = `linear-gradient(rgba(10,15,30,0.75),rgba(10,15,30,0.75)) padding-box,linear-gradient(135deg,${hexToRgba(c2, 0.55)} 30%,${hexToRgba(c1, 0.55)} 70%) border-box`;
        html += `
          <div style="display:flex;justify-content:flex-start;margin-bottom:6px">
            <div class="orb-tool-card" style="flex:1;max-width:100%;padding:5px 10px;border-radius:8px;background:${gradientBorder};border:1px solid transparent;border-left-width:3px;border-left-color:${hexToRgba(c1, 0.7)};font-size:var(--card-font-size,10px)">
              <div onclick="var p=document.getElementById('${tid}');var s=p.style.display==='none'?'block':'none';p.style.display=s;this.querySelector('.orb-tc-arrow').textContent=s==='block'?'▼':'▶'" style="display:flex;align-items:center;gap:6px;cursor:pointer;user-select:none">
                <span class="orb-tc-arrow" style="font-size:7px;color:rgba(255,255,255,0.5)">${defaultArrow}</span>
                <span style="color:${hexToRgba(c1, 0.9)};font-weight:600">${escapeHtml(tc.name)}</span>
                <span style="color:${statusColor};font-size:var(--card-font-size,9px);font-weight:600">${statusLabel}</span>
              </div>
              <div id="${tid}" style="display:${defaultDisplay};margin-top:4px">
                <pre style="font-size:var(--card-font-size,9px);color:rgba(255,255,255,0.6);line-height:1.4;white-space:pre-wrap;word-break:break-word;margin:0 0 2px 0;font-family:inherit;background:rgba(0,0,0,0.2);padding:4px 6px;border-radius:4px">${escapeHtml(contentText)}</pre>
              </div>
            </div>
          </div>`;
      }
    }

    // 规则警告框（红色，工具卡片后）
    if (!isUser && msg.ruleWarnings && msg.ruleWarnings.length > 0) {
      for (const warning of msg.ruleWarnings) {
        const shortName = warning.match(/\[规则警告: ([^\]]+)\]/)?.[1] || '规则警告';
        const wid = 'rw' + idx + '_' + msg.ruleWarnings.indexOf(warning);
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
  const scrollTop = contentArea.scrollTop;
  const atBottomThreshold = Math.max(200, contentArea.clientHeight * 0.33);
  const wasAtBottom = scrollTop + contentArea.clientHeight >= contentArea.scrollHeight - atBottomThreshold;
  contentArea.innerHTML = html;
  // 消息操作按钮事件绑定
  contentArea.querySelectorAll('.orb-act-btn').forEach(btn => {
    btn.addEventListener('pointerdown', (e: Event) => {
      e.stopPropagation();
      e.preventDefault();
      const el = btn as HTMLElement;
      const actionsEl = el.parentElement!;
      const idx = parseInt(actionsEl.dataset.idx || '-1', 10);
      if (idx < 0 || idx >= messages.length) return;
      const msg = messages[idx];
      const action = el.dataset.action;
      if (action === 'copy') {
        navigator.clipboard?.writeText(msg.text).then(() => {
          el.textContent = '✓';
          setTimeout(() => { el.textContent = '复制'; }, 1000);
        }).catch(() => {});
      } else if (action === 'edit') {
        window.dispatchEvent(new CustomEvent('kfm-message-edit', {
          detail: { message: { role: msg.role, text: msg.text }, sessionId: sessionStore.activeId }
        }));
      } else if (action === 'del') {
        window.dispatchEvent(new CustomEvent('kfm-message-delete', {
          detail: { message: { role: msg.role, text: msg.text }, sessionId: sessionStore.activeId }
        }));
      }
    });
  });
  // 滚动策略
  if (scrollMode === 'preserve') {
    contentArea.scrollTop = scrollTop;
  } else if (scrollMode === 'follow' || (scrollMode === 'auto' && wasAtBottom)) {
    // rAF 延迟一帧：innerHTML 重建后布局未完成，scrollHeight 还是旧值
    // 等浏览器 layout 完成再设 scrollTop，确保真正到底
    requestAnimationFrame(() => { contentArea.scrollTop = contentArea.scrollHeight; });
  } else {
    contentArea.scrollTop = scrollTop;
  }
  // 注入 CSS（仅一次）
  if (!contentArea.querySelector('.orb-md-css')) {
    const style = document.createElement('style');
    style.className = 'orb-md-css';
    style.textContent = MD_CSS;
    contentArea.appendChild(style);
  }
  // 同步渲染 markdown（仅 AI 消息）
  // 注意：marked.parse 本身同步，Promise 包装会导致后续 renderChatContent 调用覆盖结果
  const msgEls = contentArea.querySelectorAll<HTMLElement>('.orb-msg-text');
  for (const el of msgEls) {
    const i = parseInt(el.dataset.msgIdx || '-1', 10);
    if (i >= 0 && i < messages.length && messages[i].role !== 'user') {
      const text = messages[i].text;
      if (text && text.length > 0) {
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
  messages.push({ role: 'user', text });
  onBeforeSend();
  onRender();

  const config = await readActiveConfig(apiBase);
  if (!config.providerId) { onConfigMissing('未配置 Provider，请先在 API 卡中添加并选择一个 Provider。'); return; }
  if (!config.modelId) { onConfigMissing('未选择 Model，请先在 API 卡或光球面板底部选择一个 Model。'); return; }

  // 加载活跃角色：prompt 字段 + promptFiles 文件内容
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
    messages.push({ role: 'ai', text: '', reasoning: '' });
    onRender();
    // msgIdx: 当前轮次的气泡（挂工具卡片、当轮思考）
    let msgIdx = messages.length - 1;
    let reasoningBuf = '';
    let contentBuf = '';

    const apiMessages: Array<{ role: string; content: string }> = [];
    if (systemPrompt) apiMessages.push({ role: 'system', content: systemPrompt });
    for (const m of messages.slice(0, -1)) {
      apiMessages.push({ role: m.role === 'ai' ? 'assistant' : m.role, content: m.text });
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
            case 'message_start':
              // 新轮次开始：推新气泡，msgIdx 前进，重置 buf
              messages.push({ role: 'ai', text: '', reasoning: '' });
              msgIdx = messages.length - 1;
              reasoningBuf = '';
              contentBuf = '';
              break;
            case 'thinking':
              reasoningBuf += event.content || '';
              messages[msgIdx].reasoning = reasoningBuf;
              break;
            case 'text':
              contentBuf += event.content || '';
              messages[msgIdx].text = contentBuf;
              break;
            case 'tool_call':
              if (!messages[msgIdx].toolCalls) messages[msgIdx].toolCalls = [];
              messages[msgIdx].toolCalls!.push({ name: event.toolName || 'unknown', params: event.toolParams || {} });
              break;
            case 'tool_result':
              if (messages[msgIdx].toolCalls) {
                const pending = messages[msgIdx].toolCalls!.find(tc => !tc.result);
                if (pending) pending.result = event.toolResult;
              }
              break;
            case 'rule_warning':
              if (!messages[msgIdx].ruleWarnings) messages[msgIdx].ruleWarnings = [];
              messages[msgIdx].ruleWarnings!.push(event.content || '');
              break;
            case 'error':
              contentBuf += '\n\n[错误: ' + event.content + ']';
              messages[msgIdx].text = contentBuf;
              break;
          }
          throttledRender();
        } catch {}
      }
    }
    // 兜底：流结束时目标为空则填入
    if (!messages[msgIdx].text && contentBuf) messages[msgIdx].text = contentBuf;
    if (!messages[msgIdx].reasoning && reasoningBuf) messages[msgIdx].reasoning = reasoningBuf;
    if (!messages[msgIdx].text && !messages[msgIdx].reasoning) messages[msgIdx].text = '未获取到回复';
    onRender();
    await sessionStore.saveMessages(messages, config.modelId, config.providerId);
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      messages[messages.length - 1].text = '已取消';
    } else {
      messages.push({ role: 'ai', text: '请求失败: ' + (e instanceof Error ? e.message : '未知错误') });
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
