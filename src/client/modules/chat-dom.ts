/**
 * chat-dom.ts — 聊天面板增量 DOM 投影（v8 唯一渲染路径）
 *
 * 每个 SSE 事件到达时直接操作 DOM（append/replace/patch），
 * 永不全量重建。历史消息的 DOM 节点一旦创建就不再触碰。
 *
 * 渲染时机：
 *   - 流式 text_delta：追加裸文本（打字机效果）
 *   - content_block_stop（text）：跑 markdown 管线（marked + hljs + math + mermaid）
 *   - tool_result：按工具类型渲染富输出（write/edit/grep/glob/通用）
 *   - mountAiMessage（历史加载）：直接渲染最终态
 *
 * 随机配色在此层生成（宪法第二条），绑定 blockId 稳定哈希。
 */

import { DOM } from './dom-refs.js';
import { currentTheme as theme } from './theme.js';
import { hslToHex } from './color-utils.js';
import { WAITING_HINTS } from '../data/waiting-hints.js';
import { marked } from 'marked';
import { preprocessMd, MARKED_OPTS } from './renderers/md-extensions.js';
import { highlightAll, highlightCode } from './renderers/code-highlight.js';
import { renderMath, renderMermaid, type MathData } from './renderers/math-diagram.js';
import { MD_CSS } from './renderers/md-css.js';
import type { StreamEvent } from '../../shared/chat-protocol/events.js';
import type { ContentBlock, TextBlock, ToolBlock } from '../../shared/chat-protocol/messages.js';

// ========== 状态（最小化） ==========

interface ToolEls {
  card: HTMLElement;
  header: HTMLElement;
  content: HTMLElement;
  inputPre: HTMLElement | null;
  outputArea: HTMLElement | null;
  statusEl: HTMLElement;
  arrowEl: HTMLElement;
}

let _panelEl: HTMLDivElement | null = null;
let _contentArea: HTMLElement | null = null;
const _messageEls: HTMLElement[] = [];
const _toolEls: Map<string, ToolEls> = new Map();
let _currentMsgIdx = -1;
let _toolCountInMsg = 0;
let _followBottom = true;
let _onFilesChanged: (() => void) | null = null;

// 折叠状态（会话内记住，切换清空）
const _foldState: Map<string, boolean> = new Map();

// ========== 初始化 ==========

export function initChatDom(panelEl: HTMLDivElement, onFilesChanged?: () => void): void {
  _panelEl = panelEl;
  _contentArea = DOM.orbPanelContent(panelEl);
  _onFilesChanged = onFilesChanged || null;
  if (_contentArea) {
    _attachScrollWatch(_contentArea);
    _injectMdCss(_contentArea);
  }
}

export function clearChatDom(): void {
  if (_contentArea) _contentArea.innerHTML = '';
  _messageEls.length = 0;
  _toolEls.clear();
  _foldState.clear();
  _currentMsgIdx = -1;
  _toolCountInMsg = 0;
  if (_contentArea) _injectMdCss(_contentArea);
}

export function getFollowBottom(): boolean { return _followBottom; }
export function setFollowBottom(v: boolean): void { _followBottom = v; }

// ========== MD CSS 注入 ==========

function _injectMdCss(ca: HTMLElement): void {
  if (ca.querySelector('.orb-md-css')) return;
  const style = document.createElement('style');
  style.className = 'orb-md-css';
  style.textContent = MD_CSS;
  ca.appendChild(style);
}

// ========== 随机配色（宪法第二条） ==========

function _hashHue(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = ((h << 5) - h + id.charCodeAt(i)) | 0;
  return ((h % 360) + 360) % 360;
}

function _toolColors(blockId: string): { c1: string; c2: string } {
  const h1 = _hashHue(blockId);
  const offset = 30 + (_hashHue(blockId + '_off') % 90);
  const h2 = (h1 + offset) % 360;
  const sat = 45 + (_hashHue(blockId + '_sat') % 25);
  const lit = 50 + (_hashHue(blockId + '_lit') % 15);
  return { c1: hslToHex(h1, sat, lit), c2: hslToHex(h2, sat, lit) };
}

function _hexToRgba(hex: string, alpha: number): string {
  const num = parseInt(hex.slice(1), 16);
  const r = (num >> 16) & 0xFF;
  const g = (num >> 8) & 0xFF;
  const b = num & 0xFF;
  return `rgba(${r},${g},${b},${alpha})`;
}

// ========== 滚动 ==========

function _attachScrollWatch(ca: HTMLElement): void {
  const tagged = ca as HTMLElement & { _v8ScrollWatch?: boolean };
  if (tagged._v8ScrollWatch) return;
  tagged._v8ScrollWatch = true;
  ca.addEventListener('scroll', () => {
    const dist = ca.scrollHeight - ca.scrollTop - ca.clientHeight;
    _followBottom = dist < 40;
  }, { passive: true });
  let _touchY = 0;
  ca.addEventListener('touchstart', (e) => { _touchY = e.touches[0]?.clientY ?? 0; }, { passive: true });
  ca.addEventListener('touchmove', (e) => {
    const y = e.touches[0]?.clientY ?? 0;
    if (y - _touchY > 4) _followBottom = false;
    _touchY = y;
  }, { passive: true });
  ca.addEventListener('wheel', (e) => { if (e.deltaY < 0) _followBottom = false; }, { passive: true });
}

export function scrollToBottom(): void {
  if (_contentArea) _contentArea.scrollTop = _contentArea.scrollHeight;
}

function _maybeScroll(): void {
  if (_followBottom) scrollToBottom();
}

// ========== 摸鱼提示 ==========

function _randomHint(): string {
  return WAITING_HINTS[Math.floor(Math.random() * WAITING_HINTS.length)];
}

const HINT_DOT_HTML = '<span style="display:inline-block;width:5px;height:5px;border-radius:50%;background:rgba(0,212,255,0.6);animation:orb-hint-pulse 1.2s ease-in-out infinite;vertical-align:middle;margin-right:5px"></span>';

// ========== DOM 构建工具 ==========

function _el(tag: string, className?: string, style?: string): HTMLElement {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (style) el.style.cssText = style;
  return el;
}

function _escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ========== Markdown 渲染管线 ==========

function _renderMarkdown(textEl: HTMLElement, text: string): void {
  const mathData: MathData = { display: [], inline: [] };
  const processed = preprocessMd(text, mathData);
  const mdHtml = marked.parse(processed, MARKED_OPTS) as string;
  textEl.innerHTML = '<div class="md-body">' + mdHtml + '</div>';
  const mdBody = textEl.querySelector('.md-body') as HTMLElement;
  if (mdBody) {
    highlightAll(mdBody);
    renderMath(mdBody, mathData);
    renderMermaid(mdBody, '#00d4ff');
  }
}

// ========== 工具输出富渲染 ==========

const _EXT_LANG: Record<string, string> = {
  ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript', mjs: 'javascript',
  py: 'python', sh: 'bash', bash: 'bash', zsh: 'bash', json: 'json', html: 'html', xml: 'xml',
  css: 'css', scss: 'scss', sql: 'sql', yaml: 'yaml', yml: 'yaml', rs: 'rust', go: 'go',
  java: 'java', c: 'c', h: 'c', cpp: 'cpp', cc: 'cpp', hpp: 'cpp',
};

function _pathExt(input: Record<string, unknown>): string {
  const p = typeof input.path === 'string' ? input.path : '';
  if (!p) return '';
  const clean = p.replace(/:\d+(-\d*)?$/, '');
  const m = clean.match(/\.([a-zA-Z0-9]+)$/);
  return m ? m[1].toLowerCase() : '';
}

function _pathName(input: Record<string, unknown>): string {
  const p = typeof input.path === 'string' ? input.path : '';
  return p.split('/').pop() || p;
}

function _unescapeNL(s: string): string {
  return s.replace(/\\n/g, '\n').replace(/\\t/g, '\t');
}

const PRE_STYLE = 'font-size:var(--card-font-size,9px);line-height:1.4;white-space:pre-wrap;word-break:break-word;margin:0;font-family:inherit;background:rgba(0,0,0,0.2);padding:4px 6px;border-radius:4px;color:rgba(255,255,255,0.6);max-height:80px;overflow-y:auto';

/** 渲染工具输出区（按工具类型分发） */
function _renderToolOutput(outputArea: HTMLElement, toolName: string, input: Record<string, unknown>, resultText: string, isError: boolean, details?: Record<string, unknown>): void {
  outputArea.innerHTML = '';

  if ((toolName === 'write' || toolName === 'edit') && !isError) {
    _renderWriteEditCard(outputArea, toolName, input, resultText, details);
  } else if ((toolName === 'grep' || toolName === 'glob') && !isError) {
    _renderGrepGlobCard(outputArea, toolName, resultText, details);
  } else if (toolName === 'todo' && !isError) {
    const div = _el('div', '', 'color:rgba(255,255,255,0.4);font-size:8px;padding:2px 0');
    div.textContent = '📋 任务列表已更新 — 详见右上角面板';
    outputArea.appendChild(div);
  } else {
    // 通用输出：按扩展名决定是否高亮
    const ext = _pathExt(input);
    const lang = _EXT_LANG[ext];
    const pre = _el('pre', 'orb-tool-output-pre', PRE_STYLE);
    if (lang && resultText) {
      const code = document.createElement('code');
      code.className = 'language-' + lang;
      code.textContent = _unescapeNL(resultText);
      pre.appendChild(code);
      outputArea.appendChild(pre);
      highlightCode(code);
    } else {
      pre.textContent = resultText || '(无结果)';
      outputArea.appendChild(pre);
    }
  }
}

function _renderWriteEditCard(outputArea: HTMLElement, toolName: string, input: Record<string, unknown>, resultText: string, details?: Record<string, unknown>): void {
  const fileName = (details?.name as string) || _pathName(input);
  const filePath = (details?.path as string) || (input.path as string) || '';

  if (toolName === 'write') {
    const lines = (details?.lines as number) || 0;
    const size = (details?.size as number) || 0;
    const card = _el('div', 'orb-write-card');
    card.dataset.writePath = filePath;
    card.innerHTML = `
      <div style="display:flex;align-items:center;gap:4px;margin-bottom:3px">
        <span style="font-size:11px">📄</span>
        <span style="color:rgba(0,212,255,0.8);font-size:9px;font-weight:600">${_escapeHtml(fileName)}</span>
        <span style="color:rgba(0,255,180,0.7);font-size:8px">${lines} 行 · ${size} 字符</span>
      </div>`;
    const pre = _el('pre', '', 'font-size:8px;line-height:1.3;white-space:pre-wrap;word-break:break-word;margin:0;font-family:ui-monospace,monospace;background:rgba(0,0,0,0.2);padding:3px 5px;border-radius:3px;color:rgba(255,255,255,0.55);max-height:80px;overflow-y:auto');
    const ext = _pathExt(input);
    const lang = _EXT_LANG[ext];
    if (lang && resultText) {
      const code = document.createElement('code');
      code.className = 'language-' + lang;
      code.textContent = resultText;
      pre.appendChild(code);
      highlightCode(code);
    } else {
      pre.textContent = resultText;
    }
    card.appendChild(pre);
    outputArea.appendChild(card);
  } else {
    // edit: diff 卡片
    const oldText = (details?.oldText as string) || '';
    const newText = (details?.newText as string) || '';
    const lineStart = details?.lineStart as number | undefined;
    const lineEnd = details?.lineEnd as number | undefined;
    const lineInfo = lineStart ? (lineStart === lineEnd ? `L${lineStart}` : `L${lineStart}-${lineEnd}`) : '';
    const card = _el('div', 'orb-edit-card');
    card.dataset.editPath = filePath;
    let headerHtml = `
      <div style="display:flex;align-items:center;gap:4px;margin-bottom:3px">
        <span style="font-size:11px">✏️</span>
        <span style="color:rgba(0,212,255,0.8);font-size:9px;font-weight:600">${_escapeHtml(fileName)}</span>
        ${lineInfo ? `<span style="color:rgba(255,255,255,0.35);font-size:8px">${lineInfo}</span>` : ''}
      </div>`;
    card.innerHTML = headerHtml;
    if (oldText && newText) {
      const diff = _el('div', '', 'margin:0;font-family:ui-monospace,monospace;font-size:8px;line-height:1.5');
      const oldDiv = _el('div', '', 'color:#ff6b6b;background:rgba(255,60,60,0.08);padding:2px 5px;border-radius:2px;margin-bottom:2px');
      oldDiv.innerHTML = '<span style="opacity:0.6">−</span> ' + _escapeHtml(_unescapeNL(oldText.slice(0, 300))) + (oldText.length > 300 ? '...' : '');
      const newDiv = _el('div', '', 'color:#51cf66;background:rgba(80,255,100,0.08);padding:2px 5px;border-radius:2px');
      newDiv.innerHTML = '<span style="opacity:0.6">+</span> ' + _escapeHtml(_unescapeNL(newText.slice(0, 300))) + (newText.length > 300 ? '...' : '');
      diff.appendChild(oldDiv);
      diff.appendChild(newDiv);
      card.appendChild(diff);
    } else {
      const pre = _el('pre', '', PRE_STYLE);
      pre.textContent = resultText;
      card.appendChild(pre);
    }
    outputArea.appendChild(card);
  }
}

function _renderGrepGlobCard(outputArea: HTMLElement, toolName: string, resultText: string, details?: Record<string, unknown>): void {
  const count = (details?.count as number) || 0;
  const lines = resultText.split('\n').filter(l => l.trim());

  if (toolName === 'grep') {
    const card = _el('div', 'orb-grep-card');
    card.innerHTML = `
      <div style="display:flex;align-items:center;gap:4px;margin-bottom:3px">
        <span style="font-size:10px">🔍</span>
        <span style="color:rgba(0,212,255,0.7);font-size:8px;font-weight:600">${count} 处匹配</span>
      </div>`;
    const container = _el('div', '', 'background:rgba(0,0,0,0.2);border-radius:4px;padding:3px 6px;max-height:80px;overflow-y:auto');
    for (const line of lines) {
      const m = line.match(/^(.+?):(\d+): (.*)/);
      if (m) {
        const row = _el('div', '', 'display:flex;gap:4px;padding:1px 0');
        row.innerHTML = `<span style="color:rgba(0,212,255,0.7);font-size:8px;white-space:nowrap;flex-shrink:0">${_escapeHtml(m[1])}:</span><span style="color:rgba(255,255,255,0.3);font-size:8px;white-space:nowrap;flex-shrink:0;min-width:24px;text-align:right">${m[2]}</span><span style="color:rgba(255,255,255,0.6);font-size:8px;white-space:pre-wrap;word-break:break-word">${_escapeHtml(m[3])}</span>`;
        container.appendChild(row);
      } else {
        const row = _el('div', '', 'color:rgba(255,255,255,0.4);font-size:8px;padding:1px 0');
        row.textContent = line;
        container.appendChild(row);
      }
    }
    if (details?.limitReached) {
      const footer = _el('div', '', 'color:rgba(255,255,255,0.3);font-size:7px;padding-top:2px');
      footer.textContent = '(结果被截断)';
      container.appendChild(footer);
    }
    card.appendChild(container);
    outputArea.appendChild(card);
  } else {
    // glob
    const card = _el('div', 'orb-glob-card');
    card.innerHTML = `
      <div style="display:flex;align-items:center;gap:4px;margin-bottom:3px">
        <span style="font-size:10px">📂</span>
        <span style="color:rgba(0,212,255,0.7);font-size:8px;font-weight:600">${count} 个文件</span>
      </div>`;
    const container = _el('div', '', 'background:rgba(0,0,0,0.2);border-radius:4px;padding:3px 6px;max-height:80px;overflow-y:auto');
    for (const line of lines) {
      const isDir = line.endsWith('/');
      const display = isDir ? line.slice(0, -1) : line;
      const icon = isDir ? '📁' : '📄';
      const row = _el('div', '', 'display:flex;gap:4px;padding:1px 0;align-items:center');
      row.innerHTML = `<span style="font-size:9px;flex-shrink:0">${icon}</span><span style="color:rgba(255,255,255,0.6);font-size:8px;white-space:pre-wrap;word-break:break-word;font-family:ui-monospace,monospace">${_escapeHtml(display)}</span>`;
      container.appendChild(row);
    }
    card.appendChild(container);
    outputArea.appendChild(card);
  }
}

/** JSON 高亮工具输入 */
function _highlightInput(inputPre: HTMLElement): void {
  const raw = inputPre.textContent || '';
  if (!raw) return;
  inputPre.innerHTML = '';
  const code = document.createElement('code');
  code.className = 'language-json';
  code.textContent = raw;
  inputPre.appendChild(code);
  highlightCode(code);
}

// ========== 消息容器 ==========

function _createMsgContainer(mi: number, role: 'user' | 'ai'): HTMLElement {
  const msgEl = _el('div', 'orb-msg');
  msgEl.dataset.mi = String(mi);
  if (_contentArea) _contentArea.appendChild(msgEl);
  _messageEls[mi] = msgEl;
  return msgEl;
}

// ========== 用户消息 ==========

export function mountUserMessage(mi: number, text: string): void {
  const msgEl = _createMsgContainer(mi, 'user');
  const innerWidth = (_contentArea?.clientWidth || 390) - 24;
  const maxWidth = Math.min(innerWidth - 8, innerWidth * 0.85);
  const bgColor = `linear-gradient(${theme.surface.bgLight},${theme.surface.bgLight}) padding-box,${theme.aiChat.bubbleSelfGradient} border-box`;

  const row = _el('div', '', `display:flex;justify-content:flex-end;margin-bottom:8px`);
  const bubble = _el('div', '', `max-width:${maxWidth}px;padding:6px 12px;background:${bgColor};border:1px solid transparent;border-left-width:3px;border-radius:8px;box-shadow:${theme.aiChat.bubbleSelfShadow}`);

  const header = _el('div', '', 'display:flex;justify-content:space-between;align-items:center;margin-bottom:2px;gap:8px');
  const label = _el('span', '', `font-size:10px;color:${theme.aiChat.bubbleLabelSelf};font-weight:600`);
  label.textContent = '你';
  const copyBtn = _el('span', 'orb-copy-btn', 'font-size:9px;color:rgba(255,255,255,0.35);cursor:pointer;flex-shrink:0;user-select:none');
  copyBtn.dataset.copyIdx = String(mi);
  copyBtn.textContent = '复制';
  header.appendChild(label);
  header.appendChild(copyBtn);

  const textEl = _el('div', 'orb-msg-text', `font-family:sans-serif;font-size:var(--card-font-size,13px);line-height:16px;color:${theme.aiChat.bubbleText};word-break:break-word`);
  textEl.dataset.msgIdx = String(mi);
  textEl.textContent = text;

  bubble.appendChild(header);
  bubble.appendChild(textEl);
  row.appendChild(bubble);
  msgEl.appendChild(row);
  _maybeScroll();
}

// ========== AI 消息：思考框 ==========

function _createThinkingBlock(msgEl: HTMLElement, mi: number): { pre: HTMLElement; foldEl: HTMLElement; labelEl: HTMLElement } {
  const row = _el('div', '', 'display:flex;justify-content:flex-start;margin-bottom:4px');
  const container = _el('div', '', `flex:1;max-width:100%;padding:5px 10px;border-radius:8px;background:linear-gradient(rgba(10,15,30,0.75),rgba(10,15,30,0.75)) padding-box,${theme.aiChat.panelBorderGradient} border-box;border:1px solid transparent;border-left-width:3px;font-size:var(--card-font-size,10px)`);

  const headerEl = _el('div', '', 'display:flex;align-items:center;gap:6px;cursor:pointer;user-select:none');
  const arrow = _el('span', 'rt-arrow', 'font-size:7px;color:rgba(0,212,255,0.5)');
  arrow.textContent = '▼';
  const labelEl = _el('span', '', 'color:rgba(0,212,255,0.6);font-weight:600');
  labelEl.textContent = '思考中...';
  headerEl.appendChild(arrow);
  headerEl.appendChild(labelEl);

  const foldEl = _el('div', 'orb-fold-open', 'margin-top:4px');
  foldEl.id = 'r' + mi;
  const pre = _el('pre', '', 'font-size:var(--card-font-size,9px);color:rgba(255,255,255,0.45);line-height:1.4;white-space:pre-wrap;word-break:break-word;margin:0;font-family:inherit;background:rgba(0,0,0,0.15);padding:4px 6px;border-radius:4px;max-height:80px;overflow-y:auto');
  foldEl.appendChild(pre);

  headerEl.addEventListener('click', () => {
    const collapsed = foldEl.classList.toggle('collapsed');
    arrow.textContent = collapsed ? '▶' : '▼';
    _foldState.set('r' + mi, !collapsed);
  });

  container.appendChild(headerEl);
  container.appendChild(foldEl);
  row.appendChild(container);
  msgEl.appendChild(row);
  return { pre, foldEl, labelEl };
}

// ========== AI 消息：正文气泡 ==========

function _createTextBubble(msgEl: HTMLElement, mi: number): HTMLElement {
  const innerWidth = (_contentArea?.clientWidth || 390) - 24;
  const maxWidth = innerWidth - 8;
  const bgColor = `linear-gradient(rgba(10,15,30,0.88),rgba(10,15,30,0.88)) padding-box,${theme.aiChat.panelBorderGradient} border-box`;

  const row = _el('div', '', 'display:flex;justify-content:flex-start;margin-bottom:8px');
  const bubble = _el('div', '', `max-width:${maxWidth}px;padding:6px 12px;background:${bgColor};border:1px solid transparent;border-left-width:3px;border-radius:8px;box-shadow:${theme.aiChat.bubbleAIShadow}`);

  const header = _el('div', '', 'display:flex;justify-content:space-between;align-items:center;margin-bottom:2px;gap:8px');
  const label = _el('span', '', `font-size:10px;color:${theme.aiChat.bubbleLabelAI};font-weight:600`);
  label.textContent = '蔚然';
  const copyBtn = _el('span', 'orb-copy-btn', 'font-size:9px;color:rgba(255,255,255,0.35);cursor:pointer;flex-shrink:0;user-select:none');
  copyBtn.dataset.copyIdx = String(mi);
  copyBtn.textContent = '复制';
  header.appendChild(label);
  header.appendChild(copyBtn);

  const textEl = _el('div', 'orb-msg-text', `font-family:sans-serif;font-size:var(--card-font-size,13px);line-height:16px;color:${theme.aiChat.bubbleText};word-break:break-word`);
  textEl.dataset.msgIdx = String(mi);

  bubble.appendChild(header);
  bubble.appendChild(textEl);
  row.appendChild(bubble);
  msgEl.appendChild(row);
  return textEl;
}

// ========== AI 消息：工具卡 ==========

function _createToolCard(msgEl: HTMLElement, mi: number, ti: number, blockId: string, toolName: string): ToolEls {
  const { c1, c2 } = _toolColors(blockId);
  const gradientBorder = `linear-gradient(rgba(10,15,30,0.75),rgba(10,15,30,0.75)) padding-box,linear-gradient(135deg,${_hexToRgba(c2, 0.55)} 30%,${_hexToRgba(c1, 0.55)} 70%) border-box`;

  const row = _el('div', '', 'display:flex;justify-content:flex-start;margin-bottom:6px');
  const card = _el('div', 'orb-tool-card', `flex:1;max-width:100%;padding:5px 10px;border-radius:8px;background:${gradientBorder};border:1px solid transparent;border-left-width:3px;border-left-color:${_hexToRgba(c1, 0.7)};font-size:var(--card-font-size,10px)`);

  const headerEl = _el('div', '', 'display:flex;align-items:center;gap:6px;cursor:pointer;user-select:none;margin-bottom:2px');
  const arrow = _el('span', 'orb-tc-arrow', 'font-size:7px;color:rgba(255,255,255,0.5)');
  arrow.textContent = '▼';
  const nameEl = _el('span', '', `color:${_hexToRgba(c1, 0.9)};font-weight:600`);
  nameEl.textContent = toolName;
  const statusEl = _el('span', '', 'color:rgba(255,255,255,0.4);font-size:var(--card-font-size,9px);font-weight:600');
  statusEl.textContent = '忙碌中';
  headerEl.appendChild(arrow);
  headerEl.appendChild(nameEl);
  headerEl.appendChild(statusEl);

  const contentEl = _el('div', 'orb-fold-content', 'margin-top:4px;');
  contentEl.id = 'tc' + mi + '_' + ti;

  const inputPre = _el('pre', 'orb-tool-input-pre', 'font-size:var(--card-font-size,9px);line-height:1.4;white-space:pre-wrap;word-break:break-word;margin:0;font-family:inherit;background:rgba(0,0,0,0.2);padding:4px 6px;border-radius:4px;color:rgba(255,255,255,0.45);max-height:80px;overflow-y:auto');

  const divider = _el('div', '', `height:1px;margin:5px 0;border-radius:1px;background:linear-gradient(90deg,${_hexToRgba(c1, 0.7)},${_hexToRgba(c2, 0.7)})`);

  const outputArea = _el('div', '', 'color:rgba(255,255,255,0.75);font-size:var(--card-font-size,9px);line-height:1.4;padding:2px 0');
  outputArea.innerHTML = HINT_DOT_HTML + _escapeHtml(_randomHint());

  contentEl.appendChild(inputPre);
  contentEl.appendChild(divider);
  contentEl.appendChild(outputArea);

  headerEl.addEventListener('click', () => {
    const collapsed = contentEl.classList.toggle('collapsed');
    arrow.textContent = collapsed ? '▶' : '▼';
    _foldState.set(blockId, !collapsed);
  });

  card.appendChild(headerEl);
  card.appendChild(contentEl);
  row.appendChild(card);
  msgEl.appendChild(row);

  const els: ToolEls = { card, header: headerEl, content: contentEl, inputPre, outputArea, statusEl, arrowEl: arrow };
  _toolEls.set(blockId, els);
  return els;
}

// ========== AI 消息：规则警告 ==========

function _createWarningBlock(msgEl: HTMLElement, mi: number, wi: number, content: string): void {
  const shortName = content.match(/\[规则警告: ([^\]]+)\]/)?.[1] || '规则警告';
  const wid = 'rw' + mi + '_' + wi;

  const row = _el('div', '', 'display:flex;justify-content:flex-start;margin-bottom:6px');
  const container = _el('div', '', 'flex:1;max-width:100%;padding:5px 10px;border-radius:8px;background:linear-gradient(rgba(10,15,30,0.85),rgba(10,15,30,0.85)) padding-box,linear-gradient(135deg,rgba(255,60,60,0.5),rgba(255,120,0,0.5)) border-box;border:1px solid transparent;border-left-width:3px;border-left-color:rgba(255,60,60,0.8);font-size:var(--card-font-size,10px)');

  const headerEl = _el('div', '', 'display:flex;align-items:center;gap:6px;cursor:pointer;user-select:none');
  const arrow = _el('span', 'rw-arrow', 'font-size:7px;color:rgba(255,100,100,0.7)');
  arrow.textContent = '▶';
  const label = _el('span', '', 'color:rgba(255,80,80,0.95);font-weight:600');
  label.textContent = '⚠ ' + shortName;
  headerEl.appendChild(arrow);
  headerEl.appendChild(label);

  const body = _el('div', '', 'display:none;margin-top:4px');
  body.id = wid;
  const pre = _el('pre', '', 'font-size:var(--card-font-size,9px);color:rgba(255,200,200,0.8);line-height:1.4;white-space:pre-wrap;word-break:break-word;margin:0;font-family:inherit;background:rgba(255,0,0,0.06);padding:4px 6px;border-radius:4px');
  pre.textContent = content;
  body.appendChild(pre);

  headerEl.addEventListener('click', () => {
    const show = body.style.display === 'none';
    body.style.display = show ? 'block' : 'none';
    arrow.textContent = show ? '▼' : '▶';
  });

  container.appendChild(headerEl);
  container.appendChild(body);
  row.appendChild(container);
  msgEl.appendChild(row);
}

// ========== 事件投影（核心） ==========

interface MsgStreamState {
  msgEl: HTMLElement;
  thinkingPre: HTMLElement | null;
  thinkingLabel: HTMLElement | null;
  thinkingFold: HTMLElement | null;
  textEl: HTMLElement | null;
  textBuf: string;
  warningCount: number;
}

const _streamState: Map<number, MsgStreamState> = new Map();

export function patchEvent(event: StreamEvent): void {
  if (!_contentArea) return;

  switch (event.type) {
    case 'message_start': {
      const mi = _messageEls.length;
      const msgEl = _createMsgContainer(mi, 'ai');
      _currentMsgIdx = mi;
      _toolCountInMsg = 0;
      _streamState.set(mi, { msgEl, thinkingPre: null, thinkingLabel: null, thinkingFold: null, textEl: null, textBuf: '', warningCount: 0 });
      _maybeScroll();
      break;
    }

    case 'content_block_start': {
      const mi = _currentMsgIdx;
      if (mi < 0) break;
      const st = _streamState.get(mi);
      if (!st) break;

      if (event.blockType === 'text') {
        const { pre, foldEl, labelEl } = _createThinkingBlock(st.msgEl, mi);
        st.thinkingPre = pre;
        st.thinkingFold = foldEl;
        st.thinkingLabel = labelEl;
      } else if (event.blockType === 'tool_use') {
        const blockId = event.toolUseId || `tool_${mi}_${_toolCountInMsg}`;
        _createToolCard(st.msgEl, mi, _toolCountInMsg, blockId, event.toolName || 'unknown');
        _toolCountInMsg++;
      }
      _maybeScroll();
      break;
    }

    case 'content_block_delta': {
      const mi = _currentMsgIdx;
      if (mi < 0) break;
      const st = _streamState.get(mi);
      if (!st) break;

      if (event.deltaType === 'thinking_delta' && st.thinkingPre) {
        st.thinkingPre.textContent += event.deltaText || '';
        st.thinkingPre.scrollTop = st.thinkingPre.scrollHeight;
        _maybeScroll();
      } else if (event.deltaType === 'text_delta') {
        if (!st.textEl) {
          st.textEl = _createTextBubble(st.msgEl, mi);
          if (st.thinkingLabel) st.thinkingLabel.textContent = '已思考';
        }
        st.textBuf += event.deltaText || '';
        st.textEl.textContent = st.textBuf;
        _maybeScroll();
      } else if (event.deltaType === 'input_json_delta') {
        const lastToolId = _findLastToolId();
        if (lastToolId) {
          const els = _toolEls.get(lastToolId);
          if (els?.inputPre) {
            els.inputPre.textContent += event.deltaText || '';
            els.inputPre.scrollTop = els.inputPre.scrollHeight;
          }
        }
      }
      break;
    }

    case 'content_block_stop': {
      const mi = _currentMsgIdx;
      if (mi < 0) break;
      const st = _streamState.get(mi);
      if (!st) break;

      // v8 修复：通过 event.index 区分 text block (index=0) 和 tool block (index>0)
      // 避免 text block stop 时重复高亮已完成的 tool input，反之亦然
      const blockIdx = event.index ?? -1;
      if (blockIdx === 0) {
        // text block 完成 → 跑 markdown 管线
        if (st.textEl && st.textBuf) {
          _renderMarkdown(st.textEl, st.textBuf);
          _maybeScroll();
        }
      } else if (blockIdx > 0) {
        // tool block 完成 → JSON 高亮该工具的 input
        const lastToolId = _findLastToolId();
        if (lastToolId) {
          const els = _toolEls.get(lastToolId);
          if (els?.inputPre && els.inputPre.textContent) {
            _highlightInput(els.inputPre);
          }
        }
      }
      break;
    }

    case 'tool_result': {
      const mi = _currentMsgIdx;
      if (mi < 0) break;
      const els = _toolEls.get(event.toolUseId || '');
      if (els) {
        const isError = !!event.toolResult?.isError;
        els.statusEl.textContent = isError ? '失败' : '成功';
        els.statusEl.style.color = isError ? 'rgba(255,100,100,0.8)' : 'rgba(0,212,115,0.8)';

        if (els.outputArea) {
          const text = event.toolResult?.content?.[0]?.text || '';
          const toolName = els.header.querySelector('span:nth-child(2)')?.textContent || '';
          const input = _getToolInput(els.inputPre);
          _renderToolOutput(els.outputArea, toolName, input, text, isError, event.toolResult?.details);
        }

        // 折叠
        const blockId = event.toolUseId || '';
        if (!_foldState.get(blockId)) {
          setTimeout(() => {
            if (!_foldState.get(blockId)) {
              els.content.classList.add('collapsed');
              els.arrowEl.textContent = '▶';
            }
          }, 340);
        }

        // 思考框折叠
        const st = _streamState.get(mi);
        if (st?.thinkingLabel) {
          st.thinkingLabel.textContent = '已思考';
          if (st.thinkingFold && !_foldState.get('r' + mi)) {
            setTimeout(() => {
              if (st.thinkingFold && !_foldState.get('r' + mi)) {
                st.thinkingFold.classList.add('collapsed');
                const arrow = st.thinkingFold.previousElementSibling?.querySelector('.rt-arrow');
                if (arrow) arrow.textContent = '▶';
              }
            }, 400);
          }
        }
      }
      if (event.filesChanged && _onFilesChanged) _onFilesChanged();
      _maybeScroll();
      break;
    }

    case 'rule_warning': {
      const mi = _currentMsgIdx;
      if (mi < 0) break;
      const st = _streamState.get(mi);
      if (!st) break;
      _createWarningBlock(st.msgEl, mi, st.warningCount, event.content || '');
      st.warningCount++;
      _maybeScroll();
      break;
    }

    case 'message_stop': {
      _maybeScroll();
      break;
    }

    case 'error': {
      const mi = _currentMsgIdx;
      if (mi < 0) {
        const msgEl = _createMsgContainer(_messageEls.length, 'ai');
        const textEl = _createTextBubble(msgEl, _messageEls.length - 1);
        textEl.textContent = '[错误: ' + (event.content || '') + ']';
      } else {
        const st = _streamState.get(mi);
        if (st?.textEl) {
          st.textBuf += '\n\n[错误: ' + (event.content || '') + ']';
          st.textEl.textContent = st.textBuf;
        }
      }
      _maybeScroll();
      break;
    }

    case 'done': {
      _currentMsgIdx = -1;
      break;
    }
  }
}

function _findLastToolId(): string | null {
  let last: string | null = null;
  for (const [id] of _toolEls) last = id;
  return last;
}

function _getToolInput(inputPre: HTMLElement | null): Record<string, unknown> {
  if (!inputPre) return {};
  try { return JSON.parse(inputPre.textContent || '{}'); } catch { return {}; }
}

// ========== 历史消息挂载（会话加载） ==========

export function mountAiMessage(mi: number, blocks: ContentBlock[]): void {
  const msgEl = _createMsgContainer(mi, 'ai');
  _currentMsgIdx = mi;
  _toolCountInMsg = 0;
  const st: MsgStreamState = { msgEl, thinkingPre: null, thinkingLabel: null, thinkingFold: null, textEl: null, textBuf: '', warningCount: 0 };
  _streamState.set(mi, st);

  for (const block of blocks) {
    if (!block) continue;
    if (block.type === 'text') {
      const tb = block as TextBlock;
      const reasoning = tb.reasoning || '';
      const text = tb.text || '';
      if (reasoning) {
        const { pre, foldEl, labelEl } = _createThinkingBlock(msgEl, mi);
        pre.textContent = reasoning;
        labelEl.textContent = '已思考';
        foldEl.classList.add('collapsed');
        foldEl.classList.remove('orb-fold-open');
        const arrow = foldEl.previousElementSibling?.querySelector('.rt-arrow');
        if (arrow) arrow.textContent = '▶';
        st.thinkingFold = foldEl;
        st.thinkingLabel = labelEl;
      }
      if (text) {
        st.textEl = _createTextBubble(msgEl, mi);
        st.textBuf = text;
        _renderMarkdown(st.textEl, text);
      }
    } else if (block.type === 'tool') {
      const tb = block as ToolBlock;
      const blockId = tb.id || `tool_${mi}_${_toolCountInMsg}`;
      const els = _createToolCard(msgEl, mi, _toolCountInMsg, blockId, tb.name);
      _toolCountInMsg++;

      if (els.inputPre && Object.keys(tb.input || {}).length > 0) {
        els.inputPre.textContent = JSON.stringify(tb.input, null, 2);
        _highlightInput(els.inputPre);
      }
      if (tb.result && els.outputArea) {
        const isError = !!tb.result.isError;
        els.statusEl.textContent = isError ? '失败' : '成功';
        els.statusEl.style.color = isError ? 'rgba(255,100,100,0.8)' : 'rgba(0,212,115,0.8)';
        const text = tb.result.content?.[0]?.text || '';
        _renderToolOutput(els.outputArea, tb.name, tb.input || {}, text, isError, tb.result.details);
        els.content.classList.add('collapsed');
        els.arrowEl.textContent = '▶';
      }
    } else if (block.type === 'rule_warning') {
      _createWarningBlock(msgEl, mi, st.warningCount, (block as { content?: string }).content || '');
      st.warningCount++;
    }
  }
  _currentMsgIdx = -1;
}
