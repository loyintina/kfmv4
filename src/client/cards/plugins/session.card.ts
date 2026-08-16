/**
 * session.card.ts — 会话管理卡
 *
 * 双框布局（§10.0）：预览框 + 池框。
 * - 预览框：会话选择器 + 对话气泡预览 + 复制全部
 * - 池框：会话统计 + 列表（可删除）
 * 数据存储于 .kfmv4/sessions/ 文件夹。
 */

import { registerCardType, type CardContentHandler } from '../../modules/card-registry.js';
import { buildCardLayout } from '../../modules/floating-card.js';
import { log } from '../../modules/logger.js';
import { showConfirm } from '../../modules/confirm-dialog.js';
import { createCustomSelect } from '../../modules/custom-select.js';
import type { Session } from '../../modules/session-client.js';
import { sessionStore, extractMessageText as extractMsgText, countTextMessages, parseSessionItem } from '../../modules/session-client.js';
import { Z } from '../../modules/z-index-layers.js';
import { innerCardStyle, flashSaved } from '../card-ui.js';

const SESSIONS_PATH = '.kfmv4/sessions';

/** token 数格式化为可读字符串：<1K 显示数字，<1M 显示 nK，>=1M 显示 n.nM */
function formatTokens(n?: number): string {
  if (!n || n < 1) return '0';
  if (n < 1000) return String(n);
  if (n < 1_000_000) return Math.round(n / 1000) + 'K';
  return (n / 1_000_000).toFixed(1) + 'M';
}

// ====== API 基础 ======

const API_BASE = (() => {
  const base = window.location.pathname.replace(/\/+$/, '');
  return base + '/api/';
})();

async function writeFile(path: string, content: string): Promise<void> {
  await fetch(API_BASE + 'files/write', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, content }),
  }).catch(() => {});
}

async function deleteFile(path: string): Promise<void> {
  await fetch(API_BASE + 'files/delete', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  }).catch(() => {});
}

async function listDir(dir: string): Promise<string[]> {
  try {
    const res = await fetch(API_BASE + 'files/list', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: dir }),
    });
    const data = await res.json();
    return (data.items || []).map((f: { name: string }) => f.name);
  } catch { return []; }
}
/** 加载会话元数据列表（单次请求，不含 messages）。快速渲染列表和统计行用此。
 *  气泡预览时通过 sessionStore.getMessagesRange 分段按需拉取。 */
async function loadSessions(): Promise<Session[]> {
  try {
    const res = await fetch(API_BASE + 'sessions/list');
    const data: unknown = await res.json();
    if (!data || typeof data !== 'object' || !('sessions' in data) || !Array.isArray(data.sessions)) return [];
    const sessions: Session[] = [];
    for (const item of data.sessions) {
      if (!item || typeof item !== 'object') continue;
      // 2026-08-16：解析唯一生产者 parseSessionItem（曾内联复制一份、漏 compactToken，
      // 导致会话卡三数字 b 拿不到——BAR-COMPACT-L4-01e 系列断链的最后一环）
      const parsed = parseSessionItem(item as Record<string, unknown>);
      if (parsed) sessions.push(parsed);
    }
    return sessions;
  } catch { return []; }
}


async function saveSession(session: Session): Promise<void> {
  await writeFile(`${SESSIONS_PATH}/${session.id}.json`, JSON.stringify(session, null, 2));
}

// ====== DOM 辅助 ======

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return Math.floor(diff / 60000) + ' 分钟前';
    if (diff < 86400000) return Math.floor(diff / 3600000) + ' 小时前';
    return d.toLocaleDateString('zh-CN');
  } catch { return dateStr; }
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ====== 消息编辑器（模块级，供 orb 面板通过事件调用） ======

function showMessageEditor(
  message: { role: string; text: string },
  onSave: (newText: string) => void,
  c1: string,
  c2: string,
): void {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:' + Z.MODAL_DIALOG + ';display:flex;align-items:flex-start;justify-content:center;padding-top:50px;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px)';

  const dialog = document.createElement('div');
  dialog.style.cssText = `width:calc(94vw - 20px);max-width:460px;border-radius:12px;padding:0;background:linear-gradient(rgba(20,16,32,0.98),rgba(20,16,32,0.98)) padding-box,linear-gradient(135deg,${c1} 30%,${c2} 70%) border-box;border:1px solid transparent;border-left-width:3px;display:flex;flex-direction:column;max-height:85vh;min-height:50vh`;

  // 上行：复制 + 删除
  const topBar = document.createElement('div');
  topBar.style.cssText = `display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-bottom:1px solid rgba(255,255,255,0.06);flex-shrink:0`;

  const topLabel = document.createElement('span');
  topLabel.style.cssText = `font-size:11px;font-weight:600;color:rgba(255,255,255,0.75)`;
  topLabel.textContent = message.role === 'user' ? '你的消息' : 'AI 回复';

  const topActions = document.createElement('div');
  topActions.style.cssText = 'display:flex;gap:6px';

  const copyBtn = document.createElement('button');
  copyBtn.textContent = '复制';
  copyBtn.style.cssText = `padding:3px 10px;border-radius:4px;font-size:10px;font-weight:600;cursor:pointer;border:1px solid ${c1}40;color:${c1};background:transparent`;
  copyBtn.onclick = () => {
    navigator.clipboard?.writeText(message.text).then(() => {
      copyBtn.textContent = '✓ 已复制';
      setTimeout(() => { copyBtn.textContent = '复制'; }, 1500);
    }).catch(() => {});
  };

  const delBtn = document.createElement('button');
  delBtn.textContent = '删除';
  delBtn.style.cssText = `padding:3px 10px;border-radius:4px;font-size:10px;font-weight:600;cursor:pointer;border:1px solid rgba(255,100,100,0.4);color:rgba(255,100,100,0.8);background:transparent`;
  delBtn.onclick = async () => {
    const confirmed = await showConfirm({
      title: '删除消息',
      message: '确定删除这条消息？',
      accent: c1,
      accent2: c2,
      confirmText: '删除',
      cancelText: '取消',
    });
    if (confirmed) {
      onSave('');
      overlay.remove();
    }
  };

  topActions.appendChild(copyBtn);
  topActions.appendChild(delBtn);
  topBar.appendChild(topLabel);
  topBar.appendChild(topActions);

  // 编辑区
  const ta = document.createElement('textarea');
  ta.style.cssText = 'flex:1;min-height:180px;border:none;padding:12px 14px;font-size:var(--card-font-size,13px);color:rgba(255,255,255,0.85);background:transparent;resize:none;font-family:inherit;line-height:1.6;outline:none';
  ta.value = message.text;

  // 底栏：取消 + 保存
  const bottomBar = document.createElement('div');
  bottomBar.style.cssText = 'display:flex;gap:8px;padding:10px 14px;border-top:1px solid rgba(255,255,255,0.06);flex-shrink:0';

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = '取消';
  cancelBtn.style.cssText = `flex:1;padding:0.5em 0;border-radius:6px;font-size:var(--card-font-size,12px);font-weight:600;cursor:pointer;border:1px solid rgba(255,255,255,0.15);color:rgba(255,255,255,0.6);background:transparent`;
  cancelBtn.onclick = () => overlay.remove();

  const saveBtn = document.createElement('button');
  saveBtn.textContent = '保存';
  saveBtn.style.cssText = `flex:1;padding:0.5em 0;border-radius:6px;font-size:var(--card-font-size,12px);font-weight:600;cursor:pointer;border:1px solid ${c1}40;color:${c1};background:transparent`;
  saveBtn.onclick = () => {
    onSave(ta.value);
    overlay.remove();
  };

  bottomBar.appendChild(cancelBtn);
  bottomBar.appendChild(saveBtn);

  dialog.appendChild(topBar);
  dialog.appendChild(ta);
  dialog.appendChild(bottomBar);
  overlay.appendChild(dialog);

  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  document.body.appendChild(overlay);
  setTimeout(() => ta.focus(), 100);
}


// ====== 卡片处理器 ======

function createSessionHandler(meta: Record<string, unknown>): CardContentHandler {
  let sessions: Session[] = [];
  let activeSessionId = '';
  let _c1 = '#00d4ff', _c2 = '#7c3aed';
  let _sessionSelect: ReturnType<typeof createCustomSelect> | null = null;
  let _nameInput: HTMLInputElement | null = null;
  // window 事件监听持有引用：deactivate 时移除防泄漏；重复 activate 先摘后挂防叠加
  let _onExternalSessionChange: EventListener | null = null;

  function getActiveSession(): Session | null {
    return sessions.find(s => s.id === activeSessionId) || null;
  }

  // ---- 会话列表渲染 ----
  function renderSessionList(listEl: HTMLElement): void {
    listEl.innerHTML = '';

    if (sessions.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'font-size:var(--card-font-size,11px);color:rgba(255,255,255,0.5);text-align:center;padding:20px 0';
      empty.textContent = '暂无会话';
      listEl.appendChild(empty);
      return;
    }

    for (const session of sessions) {
      const item = document.createElement('div');
      item.style.cssText = `padding:6px 8px;margin-bottom:4px;border-radius:6px;cursor:pointer;border:1px solid transparent;border-left-width:3px;background:rgba(255,255,255,0.03);transition:all 0.15s;position:relative`;

      if (session.id === activeSessionId) {
        item.style.background = `linear-gradient(rgba(10,10,15,0.92),rgba(10,10,15,0.92)) padding-box,linear-gradient(135deg,${_c1} 30%,${_c2} 70%) border-box`;
        item.style.borderColor = 'transparent';
      }

      const titleRow = document.createElement('div');
      titleRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between';

      const title = document.createElement('div');
      title.style.cssText = 'font-size:var(--card-font-size,11px);color:rgba(255,255,255,0.85);font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1';
      title.textContent = session.title;

      const delBtn = document.createElement('span');
      delBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 12 12"><line x1="3" y1="3" x2="9" y2="9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="9" y1="3" x2="3" y2="9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
      delBtn.style.cssText = 'position:absolute;right:8px;top:50%;transform:translateY(-50%);font-size:12px;color:rgba(255,100,100,0.6);cursor:pointer';
      delBtn.onmouseenter = () => { delBtn.style.color = 'rgba(255,100,100,1)'; };
      delBtn.onmouseleave = () => { delBtn.style.color = 'rgba(255,100,100,0.6)'; };
      delBtn.onclick = async (e: MouseEvent) => {
        e.stopPropagation();
        const confirmed = await showConfirm({
          title: '删除会话',
          message: '确定删除会话「' + session.title + '」？此操作不可撤销。',
          accent: _c1,
          accent2: _c2,
          confirmText: '删除',
          cancelText: '取消',
        });
        if (confirmed) {
          await deleteFile(`${SESSIONS_PATH}/${session.id}.json`);
          sessions = sessions.filter(s => s.id !== session.id);
          if (activeSessionId === session.id) {
            activeSessionId = sessions.length > 0 ? sessions[0].id : '';
          }
          window.dispatchEvent(new CustomEvent('kfm-session-change', { detail: { sessionId: activeSessionId } }));
          renderAll();
        }
      };

      titleRow.appendChild(title);
      titleRow.appendChild(delBtn);

      const metaRow = document.createElement('div');
      metaRow.style.cssText = 'display:flex;gap:8px;font-size:var(--card-font-size,9px);color:rgba(255,255,255,0.5)';
      // 三 token 显示「API载荷/摘要/全量」（a/b/c，2026-08-16 用户定稿）：
      // a = 摘要后实际发给 API 的压缩载荷，b = 摘要本身 token，c = 会话文件全量真相源。
      // 有 compact 时显三数字；无 compact 时 b=0 → 退化为「载荷/全量」双数字。
      const a = formatTokens(session.tokenCount);
      const b = typeof session.compactToken === 'number' ? formatTokens(session.compactToken) : null;
      const c = session.fullTokenCount ? formatTokens(session.fullTokenCount) : null;
      const tokenText = b && c
        ? `${a}/${b}/${c}` : (c ? `${a}/${c}` : a);
      metaRow.innerHTML = `<span>${formatDate(session.updatedAt)}</span><span>${session.messageCount ?? countTextMessages(session.messages)} 条</span><span title="API载荷/摘要/全量 token">${tokenText}</span>`;

      item.appendChild(titleRow);
      item.appendChild(metaRow);

      item.onmouseenter = () => {
        if (session.id !== activeSessionId) { item.style.background = 'rgba(255,255,255,0.06)'; }
      };
      item.onmouseleave = () => {
        if (session.id !== activeSessionId) { item.style.background = 'rgba(255,255,255,0.03)'; }
      };
      item.onclick = () => {
        activeSessionId = session.id;
        sessionStore.activeId = session.id; // 保持 sessionStore 权威状态同步
        window.dispatchEvent(new CustomEvent('kfm-session-change', { detail: { sessionId: session.id } }));
        renderAll();
      };

      listEl.appendChild(item);
    }
  }

  // ---- 对话气泡预览 ----
  function renderBubbles(container: HTMLElement, session: Session | null): void {
    container.innerHTML = '';
    if (!session || !session.messages.some(m => extractMsgText(m).trim())) {
      const empty = document.createElement('div');
      empty.style.cssText = 'font-size:var(--card-font-size,11px);color:rgba(255,255,255,0.4);text-align:center;padding:20px 0';
      empty.textContent = '暂无对话';
      container.appendChild(empty);
      return;
    }

    // 过滤：只显示有正文的消息（工具调用、纯思考气泡跳过）；渲染全部，不截断
    const msgs = session.messages.filter(m => extractMsgText(m).trim());
    if (msgs.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'font-size:var(--card-font-size,11px);color:rgba(255,255,255,0.4);text-align:center;padding:20px 0';
      empty.textContent = '暂无对话';
      container.appendChild(empty);
      return;
    }
    for (let i = 0; i < msgs.length; i++) {
      const msg = msgs[i];
      const isUser = msg.role === 'user';

      const bubble = document.createElement('div');
      // 四层框：反向三层（c2→c1）
      bubble.style.cssText = [
        `margin-bottom:6px;padding:6px 10px;border-radius:8px`,
        `border:1px solid transparent;border-left-width:3px`,
        `background:linear-gradient(rgba(10,10,15,0.92),rgba(10,10,15,0.92)) padding-box,linear-gradient(135deg,${_c2} 30%,${_c1} 70%) border-box`,
        isUser ? 'align-self:flex-end;max-width:85%' : 'align-self:flex-start;max-width:92%',
      ].join(';');

      const label = document.createElement('div');
      label.style.cssText = `font-size:9px;color:${isUser ? _c1 : _c2};margin-bottom:2px;font-weight:600`;
      label.textContent = isUser ? '你' : '蔚然';

      const text = document.createElement('div');
      text.style.cssText = `font-size:var(--card-font-size,11px);line-height:1.5;color:rgba(255,255,255,0.75);white-space:pre-wrap;word-break:break-word;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:4;overflow:hidden`;
      text.textContent = extractMsgText(msg);

      bubble.appendChild(label);
      bubble.appendChild(text);

      // 点击气泡 → 编辑
      bubble.style.cursor = 'pointer';
      bubble.onclick = () => {
        const plainText = extractMsgText(msg);
        showMessageEditor({ role: msg.role, text: plainText }, async (newText) => {
          const idx = session.messages.indexOf(msg);
          if (idx >= 0) {
            if (!newText.trim()) {
              session.messages.splice(idx, 1);
            } else {
              // 写回第一个 text block，保留其余 block
              const tb = session.messages[idx].content.find(b => b.type === 'text');
              if (tb && tb.type === 'text') { tb.text = newText; }
              else { session.messages[idx].content.unshift({ type: 'text', text: newText }); }
            }
            await saveSession(session);
            renderAll();
            window.dispatchEvent(new CustomEvent('kfm-session-change', { detail: { sessionId: session.id } }));
          }
        }, _c1, _c2);
      };

      container.appendChild(bubble);
    }
  }

  // ---- 全量刷新 ----
  let _poolListEl: HTMLElement | null = null;
  let _bubbleContainer: HTMLElement | null = null;
  let _statsEl: HTMLSpanElement | null = null;

  function renderAll(): void {
    if (_statsEl) {
      const totalMsgs = sessions.reduce((n, s) => n + (s.messageCount ?? countTextMessages(s.messages)), 0);
      const totalTokens = sessions.reduce((n, s) => n + (s.tokenCount ?? 0), 0);
      _statsEl.textContent = `共 ${sessions.length} 个会话，${totalMsgs} 条 · ${formatTokens(totalTokens)}`;
    }
    if (_nameInput) { const s = getActiveSession(); if (document.activeElement !== _nameInput) _nameInput!.value = s?.title || ''; }
    if (_sessionSelect) {
      _sessionSelect.updateItems(sessions.map(s => ({ label: s.title, value: s.id })), activeSessionId);
    }
    if (_poolListEl) renderSessionList(_poolListEl);
    void refreshBubbles();
  }

  // 气泡预览：活跃会话消息按需分段加载（元数据列表不含 messages）。
  //   1. 先取头部 HEAD_FIRST 条立即渲染（预览显示最前面几条，头部优先）
  //   2. 后台补齐其余，使 session.messages 完整——编辑保存写回整个对象，
  //      若只有部分消息会截断会话，故必须补全后才允许安全保存。
  const HEAD_FIRST = 8;
  let _bubbleLoadToken = 0;
  async function refreshBubbles(): Promise<void> {
    if (!_bubbleContainer) return;
    const session = getActiveSession();
    if (!session) { renderBubbles(_bubbleContainer, null); return; }
    const count = session.messageCount ?? session.messages.length;
    // 已完整加载（消息数达标）→ 直接渲染
    if (session.messages.length >= count || count === 0) {
      renderBubbles(_bubbleContainer, session);
      return;
    }
    const myToken = ++_bubbleLoadToken;
    // 头部优先：先拉前 HEAD_FIRST 条渲染
    const head = await sessionStore.getMessagesRange(session.id, 'head', 0, HEAD_FIRST);
    if (myToken !== _bubbleLoadToken || getActiveSession()?.id !== session.id) return;
    session.messages = head.messages;
    renderBubbles(_bubbleContainer, session);
    // 后台补齐其余（供编辑保存用完整数据）
    if (head.total > head.messages.length) {
      const rest = await sessionStore.getMessagesRange(session.id, 'tail', 0, head.total - head.messages.length);
      if (myToken !== _bubbleLoadToken || getActiveSession()?.id !== session.id) return;
      // head 是前 N 条，rest 是剩余（末尾方向），拼成完整顺序
      session.messages = [...head.messages, ...rest.messages];
      if (_bubbleContainer) renderBubbles(_bubbleContainer, session);
    }
  }

  return {
    async activate(contentEl, card, reason) {
      const c1 = card?.accents?.color1 || '#00d4ff';
      const c2 = card?.accents?.color2 || '#7c3aed';
      _c1 = c1;
      _c2 = c2;
      const { bodyEl } = buildCardLayout(contentEl, '会话管理', c1, c2);
      bodyEl.style.cssText = 'flex:1;display:flex;flex-direction:column;gap:8px;padding:0 10px;overflow-y:auto;touch-action:pan-y';

      sessions = await loadSessions();
      // 以 sessionStore.activeId 为权威来源（orb 面板也用它）；无则取列表第一个
      if (!activeSessionId) activeSessionId = sessionStore.activeId || (sessions.length > 0 ? sessions[0].id : '');
      // 如果 sessionStore 已有有效 activeId，以它为准（防止卡打开时还停在旧会话）
      if (sessionStore.activeId && sessions.some(s => s.id === sessionStore.activeId)) {
        activeSessionId = sessionStore.activeId;
      }

      // ===== 预览框（二层反色） =====
      const previewCard = document.createElement('div');
      previewCard.style.cssText = `${innerCardStyle(c1, c2)};display:flex;flex-direction:column;flex:1 1 50%;min-height:0`;

      // 顶栏：会话选择器
      const previewHeader = document.createElement('div');
      previewHeader.style.cssText = 'display:flex;align-items:center;margin-bottom:6px;flex-shrink:0';

      const sessionLabel = document.createElement('span');
      sessionLabel.style.cssText = 'font-size:var(--card-font-size,11px);color:rgba(255,255,255,0.75);flex-shrink:0;margin-right:8px';
      sessionLabel.textContent = '会话';

      _sessionSelect = createCustomSelect({
        accent: c1,
        accent2: c2,
        placeholder: '选择会话',
        minWidth: 80,
        onSelect: (id) => {
          activeSessionId = id;
          window.dispatchEvent(new CustomEvent('kfm-session-change', { detail: { sessionId: id } }));
          renderAll();
        },
      });
      _sessionSelect.updateItems(
        sessions.map(s => ({ label: s.title, value: s.id })),
        activeSessionId
      );
      previewHeader.appendChild(sessionLabel);
      previewHeader.appendChild(_sessionSelect.element);

      // 名称编辑
      const nameRow = document.createElement('div');
      nameRow.style.cssText = 'display:flex;align-items:center;margin-bottom:6px';
      const nameLabel = document.createElement('span');
      nameLabel.style.cssText = 'font-size:var(--card-font-size,11px);color:rgba(255,255,255,0.75);flex-shrink:0;margin-right:8px';
      _nameInput = document.createElement('input');
      _nameInput!.type = 'text';
      _nameInput!.style.cssText = 'flex:1;min-width:0;padding:3px 6px;border-radius:4px;font-size:var(--card-font-size,11px);color:rgba(255,255,255,0.85);background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);outline:none';
      nameRow.appendChild(nameLabel);
      nameRow.appendChild(_nameInput);

      const fillName = () => {
        const s = getActiveSession();
        _nameInput!.value = s?.title || '';
      };
      fillName();

      // 操作按钮
      const btnRow = document.createElement('div');
      btnRow.style.cssText = 'display:flex;gap:6px;margin-top:8px;margin-bottom:6px';

      // 保存逻辑：保存按钮与 input 失焦共用。dirty 检查去重——点保存按钮会先触发 blur 再触发 click
      const saveName = async () => {
        const s = getActiveSession();
        if (!s) return;
        const newTitle = _nameInput!.value.trim();
        if (!newTitle || newTitle === s.title) return;
        // setTitle 负责文件重命名 + active.json 同步 + store 状态更新
        await sessionStore.setTitle(s, newTitle);
        // 本地状态同步：sessionStore 已更新 list/activeId，只需刷新本地缓存
        sessions = sessionStore.list.slice();
        if (activeSessionId !== sessionStore.activeId) activeSessionId = sessionStore.activeId;
        renderAll();
        // 成功反馈（BAR-SESSION-FEEDBACK-01）：真正发生保存动作时给视觉确认，
        // 复用 card-ui 共享 helper（config/paradigm 同款）——消除「保存无反馈」的静默感。
        flashSaved(saveBtn);
      };

      const saveBtn = document.createElement('button');
      saveBtn.textContent = '保存';
      saveBtn.style.cssText = `flex:1;padding:0.3em 0;border-radius:6px;font-size:var(--card-font-size,10px);font-weight:600;cursor:pointer;border:1px solid ${c1}40;color:${c1};background:transparent`;
      saveBtn.onclick = saveName;
      _nameInput!.addEventListener('blur', () => { void saveName(); });

      const newBtn = document.createElement('button');
      newBtn.textContent = '新建';
      newBtn.style.cssText = `flex:1;padding:0.3em 0;border-radius:6px;font-size:var(--card-font-size,10px);font-weight:600;cursor:pointer;border:1px solid ${c2}40;color:${c2};background:transparent`;
      newBtn.onclick = async () => {
        // 委托给 sessionStore.create()：写盘 + await active.json + 派发事件，
        // 保证 orb 面板的监听器能正确同步（同一套状态机，不自己重复实现）。
        const id = await sessionStore.create();
        sessions = sessionStore.list.slice(); // 直接用 store 内存列表，无需重拉
        activeSessionId = id;
        fillName();
        renderAll();
        // 事件已由 sessionStore.create() 派发，此处不重复
      };

      btnRow.appendChild(saveBtn);
      btnRow.appendChild(newBtn);

      previewCard.appendChild(previewHeader);
      previewCard.appendChild(nameRow);

      // 气泡区（三层框，正向渐变，半屏高可滚动）
      const bubbleFrame = document.createElement('div');
      bubbleFrame.style.cssText = `flex:1;overflow-y:auto;min-height:80px;max-height:50vh;touch-action:pan-y;border-radius:8px;padding:8px;background:linear-gradient(rgba(10,10,15,0.94),rgba(10,10,15,0.94)) padding-box,linear-gradient(135deg,${c1} 30%,${c2} 70%) border-box;border:1px solid transparent;border-left-width:3px`;
      _bubbleContainer = document.createElement('div');
      _bubbleContainer.style.cssText = 'display:flex;flex-direction:column';
      bubbleFrame.appendChild(_bubbleContainer);
      previewCard.appendChild(bubbleFrame);

      // 按钮放在内容区下方
      previewCard.appendChild(btnRow);

      bodyEl.appendChild(previewCard);

      // ===== 池框（二层反色） =====
      const poolCard = document.createElement('div');
      poolCard.style.cssText = `${innerCardStyle(c1, c2)};flex:1 1 50%;display:flex;flex-direction:column;min-height:0`;

      // 顶栏：统计
      const poolHeader = document.createElement('div');
      poolHeader.style.cssText = 'display:flex;align-items:center;margin-bottom:6px;flex-shrink:0';

      const statsEl = document.createElement('span');
      statsEl.style.cssText = 'font-size:var(--card-font-size,10px);color:rgba(255,255,255,0.5)';
      statsEl.textContent = `共 ${sessions.length} 个会话，${sessions.reduce((n, s) => n + (s.messageCount ?? countTextMessages(s.messages)), 0)} 条 · ${formatTokens(sessions.reduce((n, s) => n + (s.tokenCount ?? 0), 0))}`;
      _statsEl = statsEl;
      poolHeader.appendChild(statsEl);
      poolCard.appendChild(poolHeader);

      // 列表区
      const listEl = document.createElement('div');
      listEl.style.cssText = 'flex:1;overflow-y:auto;min-height:0;touch-action:pan-y';
      _poolListEl = listEl;
      poolCard.appendChild(listEl);
      bodyEl.appendChild(poolCard);

      renderAll();

      // 监听外部会话变化（orb 面板切换 / sessionStore.create() 新建）
      // 先摘旧监听，保证重复 activate 不叠加注册
      if (_onExternalSessionChange) window.removeEventListener('kfm-session-change', _onExternalSessionChange);
      _onExternalSessionChange = ((e: CustomEvent) => {
        const sid = e.detail?.sessionId;
        // sid 可为空串（最后一个会话被删）
        (async () => {
          // 优先用 sessionStore 内存列表（已最新），避免再发一次全量网络请求
          if (sessionStore.list.length > 0) {
            sessions = sessionStore.list.slice();
          } else {
            sessions = await loadSessions();
          }
          if (sid !== undefined) activeSessionId = sid || (sessions.length > 0 ? sessions[0].id : '');
          _sessionSelect?.updateItems(sessions.map(s => ({ label: s.title, value: s.id })), activeSessionId);
          renderAll();
        })();
      }) as EventListener;
      window.addEventListener('kfm-session-change', _onExternalSessionChange);
    },

    deactivate(contentEl) {
      if (_onExternalSessionChange) {
        window.removeEventListener('kfm-session-change', _onExternalSessionChange);
        _onExternalSessionChange = null;
      }
      _poolListEl = null;
      _bubbleContainer = null;
      _statsEl = null;
      contentEl.innerHTML = '';
    },
  };
}

registerCardType({
  typeId: 'session',
  icon: '\uD83D\uDCAC',
  name: '会话',
  description: '会话管理与对话预览',
  kind: 'tool',
  createHandler: createSessionHandler,
});
