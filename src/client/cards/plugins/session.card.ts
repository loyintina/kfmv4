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

interface Session {
  id: string;
  title: string;
  manuallyNamed?: boolean;
  createdAt: string;
  updatedAt: string;
  providerId?: string;
  modelId?: string;
  messages: Array<{ role: string; text: string; reasoning?: string }>;
}

const SESSIONS_PATH = '.kfmv4/sessions';

// ====== API 基础 ======

const API_BASE = (() => {
  const base = window.location.pathname.replace(/\/+$/, '');
  return base + '/api/';
})();

async function readFile(path: string): Promise<string | null> {
  try {
    const res = await fetch(API_BASE + 'files/read', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    });
    const data = await res.json();
    return data.content || null;
  } catch { return null; }
}

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
async function loadSessions(): Promise<Session[]> {
  const files = await listDir(SESSIONS_PATH);
  const sessions: Session[] = [];
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const content = await readFile(`${SESSIONS_PATH}/${file}`);
    if (content) {
      try {
        const session: Session = JSON.parse(content);
        if (session.id && session.title) sessions.push(session);
      } catch { /* skip corrupt files */ }
    }
  }
  sessions.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return sessions;
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

// ====== 卡片处理器 ======

function createSessionHandler(meta: Record<string, unknown>): CardContentHandler {
  let sessions: Session[] = [];
  let activeSessionId = '';
  let _c1 = '#00d4ff', _c2 = '#7c3aed';
  let _sessionSelect: ReturnType<typeof createCustomSelect> | null = null;

  function getActiveSession(): Session | null {
    return sessions.find(s => s.id === activeSessionId) || null;
  }

  // ---- 编辑弹窗 ----
  function showMessageEditor(
    message: { role: string; text: string },
    onSave: (newText: string) => void,
  ): void {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:flex-start;justify-content:center;padding-top:50px;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px)';

    const dialog = document.createElement('div');
    dialog.style.cssText = `width:calc(94vw - 20px);max-width:460px;border-radius:12px;padding:0;background:linear-gradient(rgba(20,16,32,0.98),rgba(20,16,32,0.98)) padding-box,linear-gradient(135deg,${_c1} 30%,${_c2} 70%) border-box;border:1px solid transparent;border-left-width:3px;display:flex;flex-direction:column;max-height:85vh;min-height:50vh`;

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
    copyBtn.style.cssText = `padding:3px 10px;border-radius:4px;font-size:10px;font-weight:600;cursor:pointer;border:1px solid ${_c1}40;color:${_c1};background:transparent`;
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
        accent: _c1,
        accent2: _c2,
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
    saveBtn.style.cssText = `flex:1;padding:0.5em 0;border-radius:6px;font-size:var(--card-font-size,12px);font-weight:600;cursor:pointer;border:1px solid ${_c1}40;color:${_c1};background:transparent`;
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
      metaRow.innerHTML = `<span>${formatDate(session.updatedAt)}</span><span>${session.messages.length} 条消息</span>`;
      if (session.providerId) metaRow.innerHTML += `<span>${session.providerId}</span>`;

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
        window.dispatchEvent(new CustomEvent('kfm-session-change', { detail: { sessionId: session.id } }));
        renderAll();
      };

      listEl.appendChild(item);
    }
  }

  // ---- 对话气泡预览 ----
  function renderBubbles(container: HTMLElement, session: Session | null): void {
    container.innerHTML = '';
    if (!session || session.messages.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'font-size:var(--card-font-size,11px);color:rgba(255,255,255,0.4);text-align:center;padding:20px 0';
      empty.textContent = '暂无对话';
      container.appendChild(empty);
      return;
    }

    const msgs = session.messages.slice(-20); // 最多显示最近 20 条
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
      text.textContent = msg.text;

      bubble.appendChild(label);
      bubble.appendChild(text);

      // 点击气泡 → 编辑
      bubble.style.cursor = 'pointer';
      bubble.onclick = () => {
        showMessageEditor(msg, async (newText) => {
          const idx = session.messages.indexOf(msg);
          if (idx >= 0) {
            if (!newText.trim()) {
              session.messages.splice(idx, 1);
            } else {
              session.messages[idx].text = newText;
            }
            await saveSession(session);
            renderAll();
          }
        });
      };

      container.appendChild(bubble);
    }
  }

  // ---- 全量刷新 ----
  let _poolListEl: HTMLElement | null = null;
  let _bubbleContainer: HTMLElement | null = null;

  function renderAll(): void {
    if (_poolListEl) renderSessionList(_poolListEl);
    if (_bubbleContainer) renderBubbles(_bubbleContainer, getActiveSession());
  }

  return {
    async activate(contentEl, card, reason) {
      const c1 = card?.accents?.color1 || '#00d4ff';
      const c2 = card?.accents?.color2 || '#7c3aed';
      _c1 = c1;
      _c2 = c2;
      const { bodyEl } = buildCardLayout(contentEl, '会话管理', c1, c2);
      bodyEl.style.cssText = 'flex:1;display:flex;flex-direction:column;gap:8px;padding:0 10px;overflow-y:auto';

      sessions = await loadSessions();
      if (!activeSessionId && sessions.length > 0) activeSessionId = sessions[0].id;

      // ===== 预览框（二层反色） =====
      const previewCard = document.createElement('div');
      previewCard.style.cssText = `border-radius:10px;padding:8px 12px;margin-top:6px;background:linear-gradient(rgba(10,10,15,0.92),rgba(10,10,15,0.92)) padding-box,linear-gradient(135deg,${c2} 30%,${c1} 70%) border-box;border:1px solid transparent;border-left-width:3px;display:flex;flex-direction:column;max-height:55%;min-height:120px`;

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
      previewCard.appendChild(previewHeader);

      // 气泡区（三层框，正向渐变，半屏高可滚动）
      const bubbleFrame = document.createElement('div');
      bubbleFrame.style.cssText = `flex:1;overflow-y:auto;min-height:80px;max-height:50vh;border-radius:8px;padding:8px;background:linear-gradient(rgba(10,10,15,0.94),rgba(10,10,15,0.94)) padding-box,linear-gradient(135deg,${c1} 30%,${c2} 70%) border-box;border:1px solid transparent;border-left-width:3px`;
      _bubbleContainer = document.createElement('div');
      _bubbleContainer.style.cssText = 'display:flex;flex-direction:column';
      bubbleFrame.appendChild(_bubbleContainer);
      previewCard.appendChild(bubbleFrame);

      bodyEl.appendChild(previewCard);

      // ===== 池框（二层反色） =====
      const poolCard = document.createElement('div');
      poolCard.style.cssText = `border-radius:10px;padding:8px 12px;background:linear-gradient(rgba(10,10,15,0.92),rgba(10,10,15,0.92)) padding-box,linear-gradient(135deg,${c2} 30%,${c1} 70%) border-box;border:1px solid transparent;border-left-width:3px;flex:1;display:flex;flex-direction:column;min-height:0`;

      // 顶栏：统计
      const poolHeader = document.createElement('div');
      poolHeader.style.cssText = 'display:flex;align-items:center;margin-bottom:6px;flex-shrink:0';

      const statsEl = document.createElement('span');
      statsEl.style.cssText = 'font-size:var(--card-font-size,10px);color:rgba(255,255,255,0.5)';
      statsEl.textContent = `共 ${sessions.length} 个会话，${sessions.reduce((n, s) => n + s.messages.length, 0)} 条消息`;
      poolHeader.appendChild(statsEl);
      poolCard.appendChild(poolHeader);

      // 列表区
      const listEl = document.createElement('div');
      listEl.style.cssText = 'flex:1;overflow-y:auto;min-height:0';
      _poolListEl = listEl;
      poolCard.appendChild(listEl);
      bodyEl.appendChild(poolCard);

      renderAll();

      // 监听外部会话变化
      window.addEventListener('kfm-session-change', ((e: CustomEvent) => {
        if (e.detail?.sessionId && e.detail.sessionId !== activeSessionId) {
          activeSessionId = e.detail.sessionId;
          _sessionSelect?.updateItems(sessions.map(s => ({ label: s.title, value: s.id })), activeSessionId);
          renderAll();
        }
      }) as EventListener);
    },

    deactivate(contentEl) {
      _poolListEl = null;
      _bubbleContainer = null;
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
