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

export interface ChatMessage {
  role: 'user' | 'ai';
  text: string;
  reasoning?: string;
}

export interface ChatState {
  panelEl: HTMLDivElement;
  messages: ChatMessage[];
  renderWidth: number;
  apiBase: string;
}

// ========== 工具函数 ==========

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderPlainText(text: string): string {
  return escapeHtml(text);
}

// ========== 核心：消息气泡渲染 ==========

export function renderChatContent(state: ChatState): void {
  const { panelEl, messages, renderWidth } = state;
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
    let bubbleHtml = `<div style="font-size:10px;color:${labelColor};margin-bottom:2px;font-weight:600">${label}</div>`;

    // 思考内容（可折叠）
    if (!isUser && msg.reasoning) {
      const rid = 'r' + idx;
      const rlabel = msg.text ? '已思考' : '思考中...';
      bubbleHtml += `<div onclick="var p=document.getElementById('${rid}');p.style.display=p.style.display==='none'?'':'none'" style="font-size:9px;color:rgba(0,212,255,0.5);cursor:pointer;margin-bottom:2px;user-select:none">${rlabel} <span style="font-size:7px">▼</span></div>`;
      const displayStyle = msg.text ? 'display:none' : 'display:block';
      bubbleHtml += `<div id="${rid}" style="${displayStyle};font-size:var(--card-font-size,10px);line-height:16px;color:rgba(255,255,255,0.45);margin-bottom:4px;padding:4px 6px;border-radius:4px;background:rgba(0,0,0,0.2);white-space:pre-wrap">${escapeHtml(msg.reasoning)}</div>`;
    }

    const lineHeight = 20;
    bubbleHtml += `<div class="orb-msg-text" data-msg-idx="${idx}" style="font-family:sans-serif;font-size:var(--card-font-size,13px);line-height:${lineHeight}px;color:${theme.aiChat.bubbleText};white-space:pre-wrap;word-break:break-word">${renderPlainText(msg.text)}</div>`;

    const maxWidth = isUser ? Math.min(innerWidth - 8, innerWidth * 0.85) : innerWidth - 8;
    html += `
      <div style="display:flex;justify-content:${align};margin-bottom:8px">
        <div style="max-width:${maxWidth}px;padding:6px 12px;background:${bgColor};${borderStyle}border-radius:8px;box-shadow:${boxShadow}">
          ${bubbleHtml}
        </div>
      </div>`;
    idx++;
  }
  // 保存滚动位置
  const scrollTop = contentArea.scrollTop;
  const wasAtBottom = scrollTop + contentArea.clientHeight >= contentArea.scrollHeight - 80;
  contentArea.innerHTML = html;
  if (wasAtBottom) { contentArea.scrollTop = contentArea.scrollHeight; }
  else { contentArea.scrollTop = scrollTop; }
  // 注入 CSS（仅一次）
  if (!contentArea.querySelector('.orb-md-css')) {
    const style = document.createElement('style');
    style.className = 'orb-md-css';
    style.textContent = MD_CSS;
    contentArea.appendChild(style);
  }
  // 异步渲染 markdown（仅 AI 消息）
  const msgEls = contentArea.querySelectorAll<HTMLElement>('.orb-msg-text');
  for (const el of msgEls) {
    const i = parseInt(el.dataset.msgIdx || '-1', 10);
    if (i >= 0 && i < messages.length && messages[i].role !== 'user') {
      const text = messages[i].text;
      if (text && text.length > 0) {
        const mathData: MathData = { display: [], inline: [] };
        const processed = preprocessMd(text, mathData);
        Promise.resolve(marked.parse(processed, MARKED_OPTS) as string).then((mdHtml: string) => {
          el.innerHTML = '<div class="md-body">' + mdHtml + '</div>';
          const mdBody = el.querySelector('.md-body') as HTMLElement;
          highlightAll(mdBody);
          renderMath(mdBody, mathData);
          renderMermaid(mdBody, '#00d4ff');
        });
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
    const msgIdx = messages.length - 1;
    let reasoningBuf = ''; let contentBuf = '';

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
            case 'thinking': reasoningBuf += event.content || ''; messages[msgIdx].reasoning = reasoningBuf; break;
            case 'text': contentBuf += event.content || ''; messages[msgIdx].text = contentBuf; break;
            case 'tool_call': contentBuf += '\n\n[调用工具: ' + event.toolName + '...]'; messages[msgIdx].text = contentBuf; break;
            case 'error': contentBuf += '\n\n[错误: ' + event.content + ']'; messages[msgIdx].text = contentBuf; break;
          }
          onRender();
        } catch {}
      }
    }
    messages[msgIdx].text = contentBuf || '未获取到回复';
    messages[msgIdx].reasoning = reasoningBuf || undefined;
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
