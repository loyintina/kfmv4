/**
 * orb-chat-host.ts — ai-chat 客户端宿主（自 orb.ts 拆出，ADR-004 裁决一）
 *
 * 职责：会话状态 + run 生命周期 + 消息窗口编排。
 * DOM 依赖（面板元素、orb 状态、展开动作、会话选择器）经 ChatHostDeps 注入，
 * 本文件不直接持有 orb.ts 的模块级状态。
 *
 * 历史消息窗口化挂载（v8.1）：
 * - 首屏只挂末尾 MOUNT_WINDOW 条，滚动近顶部经 chat-dom 的
 *   setHistoryLoader 回调翻页 prepend。chatMessages 始终持有全量（发送上下文需要），
 *   窗口只控制 DOM 规模。为什么不做全量挂载：markdown/hljs 全量同步渲染是
 *   v8.0 展开卡顿 2-3s 的根因。
 */

import { Registry } from './ui-registry.js';
import { sessionStore } from './session-client.js';
import { doSend, resumeRun, readPersistedRun, clearPersistedRun, clearTodoPanel, startWaitingIndicator, setEventHook, updateTodoFromTool, type ChatMessage, type ToolBlock } from './orb-chat.js';
import { TODO_DISMISS_KEY, todosFingerprint } from './orb-chat-hints.js';
import { toOpenAiMessages } from '../../shared/chat-protocol/to-openai-messages.js';
import { patchEvent, clearChatDom, mountUserMessage, mountAiMessage, mountFallbackAiMessage, scrollToBottom, suspendScroll, resumeScroll, withScrollAnchor, setHistoryLoader, getFollowBottom, setFollowBottom } from './chat-dom.js';
import type { OrbState } from './orb-state.js';

export interface ChatHostDeps {
  inputEl: HTMLTextAreaElement;
  sendBtn: HTMLElement;
  getPanelEl(): HTMLDivElement | null;   // 原代码直接读 orb.ts 模块级 panelEl
  getOrbState(): OrbState;               // 原代码读 orbState
  expandPanel(): void;                   // 原代码调 expandPanel()
  updateSessionSelect(items: { label: string; value: string }[], activeId: string): void; // 原 _orbSessionSelect?.updateItems(...)
}

const chatMessages: ChatMessage[] = [];

// ========== 历史消息窗口化挂载（v8.1） ==========
// chatMessages 持有全量历史（发送上下文需要），DOM 只挂载尾部一个窗口。
// 为什么窗口编排在宿主而非 chat-dom：窗口语义 = 「chatMessages 索引 ↔ DOM」
// 映射策略，属于本模块的编排职责；chat-dom 只提供 prepend/锚定/翻页回调原语。
const MOUNT_WINDOW = 20; // 首屏挂载条数
const OLDER_BATCH = 20;  // 向上翻页批量
let _oldestMounted = 0;  // chatMessages 中已挂载的最老索引

function _mountOne(i: number, atTop = false): void {
  const m = chatMessages[i];
  if (m.role === 'user') {
    const tb = m.content.find(b => b?.type === 'text');
    mountUserMessage(i, tb && 'text' in tb ? tb.text : '', atTop);
  } else {
    mountAiMessage(i, m.content, atTop);
  }
}

// 重挂尾部窗口（会话加载/切换/历史补齐段到达后）。补齐段 unshift 会使已挂载
// 索引整体偏移，所以这里总是全清重挂——窗口只有 20 条且有渲染缓存，成本可忽略。
function _mountHistoryWindow(): void {
  clearChatDom();
  _oldestMounted = Math.max(0, chatMessages.length - MOUNT_WINDOW);
  suspendScroll();
  for (let i = _oldestMounted; i < chatMessages.length; i++) _mountOne(i);
  setHistoryLoader(_oldestMounted > 0 ? _loadOlderHistory : null);
  resumeScroll(true); // 批量挂载后只追底一次
  _restoreTodoPanel();
}

// v7 行为恢复：历史窗口（重）挂载后，从数据层找回最近一次 todo 工具结果重挂面板。
// v8 曾只有 live tool_result 触发 updateTodoFromTool——刷新/切会话后面板消失。
function _restoreTodoPanel(): void {
  for (let i = chatMessages.length - 1; i >= 0; i--) {
    const tb = chatMessages[i].content.find(
      (b): b is ToolBlock => b?.type === 'tool' && b.name === 'todo' && !!b.result
    );
    if (tb) { updateTodoFromTool(tb); return; }
  }
}

// 滚动近顶部时向前翻一页（由 chat-dom 滚动监听同步触发）
function _loadOlderHistory(): void {
  if (_oldestMounted === 0) { setHistoryLoader(null); return; }
  const from = Math.max(0, _oldestMounted - OLDER_BATCH);
  suspendScroll();
  withScrollAnchor(() => {
    for (let i = from; i < _oldestMounted; i++) _mountOne(i, true);
  });
  _oldestMounted = from;
  resumeScroll(false);
  if (_oldestMounted === 0) setHistoryLoader(null);
}

export async function initChatHost(deps: ChatHostDeps): Promise<void> {
  // 注册内容层：AI 对话摘要（使用生成器，每次 snapshot 返回最新消息）
  Registry.registerContentGenerator('orb-chat', () => ({
    id: 'orb-chat',
    type: 'text-output',
    summary: chatMessages.length > 0
      ? `最后一条消息: ${chatMessages[chatMessages.length - 1].role === 'user' ? '我' : 'AI'}说「${(chatMessages[chatMessages.length - 1].content.find((b) => b.type === 'text') as { type: 'text'; text: string } | undefined)?.text?.slice(0, 40) || ''}${((chatMessages[chatMessages.length - 1].content.find((b) => b.type === 'text') as { type: 'text'; text: string } | undefined)?.text?.length ?? 0) > 40 ? '…' : ''}」`
      : '暂无对话历史',
  }));

  const base = window.location.pathname.replace(/\/+$/, '') + '/api/';
  // scrollMode 语义（v8.1 恢复 v7 契约）：
  //   follow  = 强制追底（发送/首轮渲染），并重新附着底部
  //   auto    = 仅用户本就在底部时追底（流式事件默认；上滑浏览时不拽回）
  //   preserve= 不动（DOM 持久化后视觉位置天然保持，无需补偿）
  const _renderChat = (scrollMode: 'follow' | 'preserve' | 'auto' = 'auto') => {
    if (scrollMode === 'follow') { setFollowBottom(true); scrollToBottom(); }
    else if (scrollMode === 'auto' && getFollowBottom()) scrollToBottom();
  };
  setEventHook(patchEvent);
  sessionStore.init(base);
  await sessionStore.load();

  let abortCtrl: AbortController | null = null;
  let _switchToken = 0; // 会话切换序号，防并发切换的过期加载覆盖
  let _renderedSessionId = ''; // 当前已渲染到聊天面板的会话 id（guard 用，不依赖 sessionStore.activeId）

  // 分段加载会话到聊天面板：先取末尾 TAIL_FIRST 条立即渲染（追底可见），
  // 其余更早的消息后台补拉进数据层（不直接进 DOM，由窗口翻页按需挂载）。
  // _switchToken 防并发切换的过期覆盖。
  const TAIL_FIRST = 12;
  async function loadSessionInto(sid: string): Promise<void> {
    const myToken = _switchToken;
    const first = await sessionStore.getMessagesRange(sid, 'tail', 0, TAIL_FIRST);
    if (myToken !== _switchToken) return;
    chatMessages.length = 0;
    chatMessages.push(...first.messages.map(m => ({ role: m.role as 'user' | 'ai', content: m.content || [] })));
    _renderedSessionId = sid;
    _mountHistoryWindow();

    if (first.total > first.messages.length) {
      const rest = await sessionStore.getMessagesRange(sid, 'head', 0, first.total - first.messages.length);
      if (myToken !== _switchToken || _renderedSessionId !== sid) return;
      chatMessages.unshift(...rest.messages.map(m => ({ role: m.role as 'user' | 'ai', content: m.content || [] })));
      _mountHistoryWindow(); // unshift 偏移了索引，重挂窗口校正（窗口小 + 缓存，成本可忽略）
    }
  }

  // 加载活跃会话的历史消息（分段：末尾优先）
  if (sessionStore.activeId) {
    await loadSessionInto(sessionStore.activeId);
  }

  // 页面恢复（刷新/切后台回来）：若上次有未完成的后台 run 且属于当前会话，
  // 自动重连续读——补齐刷新期间错过的输出并继续实时尾随。这是"挂机持久化"入口。
  (async () => {
    const persisted = readPersistedRun();
    if (!persisted || persisted.sessionId !== sessionStore.activeId) { if (persisted) clearPersistedRun(); return; }
    // 校验服务端该 run 是否还在（进程重启后运行态已丢）
    try {
      const chk = await fetch(base + 'ai/chat/active?sessionId=' + encodeURIComponent(persisted.sessionId)).then(r => r.json());
      if (!chk.runId || chk.runId !== persisted.runId) { clearPersistedRun(); return; }
      if (chk.done) { clearPersistedRun(); return; } // 已完成无需重连（终态由续读或历史呈现）
    } catch { clearPersistedRun(); return; }
    if (deps.getOrbState() === 'collapsed') deps.expandPanel();
    // 复用 handleSend 的 abortCtrl + 按钮态：重连期间按钮显示"发送中"，点击=中断
    abortCtrl = new AbortController();
    deps.sendBtn.classList.add('sending');
    let stopHint2: (() => void) | null = null;
    const setWait2 = (w: boolean) => {
      const panel = deps.getPanelEl();
      if (w) { if (!stopHint2 && panel) stopHint2 = startWaitingIndicator(panel); }
      else if (stopHint2) { stopHint2(); stopHint2 = null; }
    };
    // 从头续读：服务端缓冲了本轮全部事件，from=0 全量重放重建 AI 回复
    await resumeRun(base, persisted.runId, 0, chatMessages, abortCtrl.signal,
      () => _renderChat('auto'), setWait2,
    );
    setWait2(false);
    abortCtrl = null;
    deps.sendBtn.classList.remove('sending');
    clearPersistedRun();
  })();

  // v8 冷恢复：检测"未完成的对话"（kfm-restart 后 AI 工具执行完了但没来得及回应）
  // 判据：末尾是 AI 消息且含 tool result → 工具执行完了但 AI 还没回应（回应会是新 message）
  // 防护：restartCount 计数器防止无限循环（连续自动 resume 超过 3 次则停止）
  async function tryAutoResume(): Promise<void> {
    if (!sessionStore.activeId || chatMessages.length === 0) return;
    const RESTART_COUNT_KEY = 'kfm-restart-count';
    const MAX_RESTART_COUNT = 3;
    let restartCount = 0;
    try { restartCount = parseInt(localStorage.getItem(RESTART_COUNT_KEY) || '0', 10); } catch {}
    if (restartCount >= MAX_RESTART_COUNT) {
      try { localStorage.removeItem(RESTART_COUNT_KEY); } catch {}
      return;
    }
    const last = chatMessages[chatMessages.length - 1];
    if (last.role !== 'ai') return;
    const hasToolResult = last.content.some(b => b?.type === 'tool' && b.result);
    if (!hasToolResult) return;
    const sid = sessionStore.activeId;
    const meta = sessionStore.list.find(s => s.id === sid);
    const model = meta?.modelId || '';
    const provider = meta?.providerId || '';
    if (!model || !provider) return;
    // 构建 apiMessages——唯一构造函数（BAR-ORB-RESUME-01）：冷恢复与正常发送同投影，
    // 压缩 + 空壳过滤 + 严格端点契约全部继承，禁止再手写第三份转换。
    const noCompact = localStorage.getItem('kfm-no-compact') === '1';
    const { apiMessages } = toOpenAiMessages(chatMessages, {
      compact: !noCompact,
      isTodoDismissed: (todos) => {
        try { return (localStorage.getItem(TODO_DISMISS_KEY) || '') === todosFingerprint(todos); } catch { return false; }
      },
    });
    try {
      const res = await fetch(base + 'ai/chat/start', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sid, messages: apiMessages, model, provider }),
      });
      const data = await res.json();
      if (data.runId) {
        // 自动续读（复用 resumeRun 路径）
        if (deps.getOrbState() === 'collapsed') deps.expandPanel();
        // 等面板展开动画完成（~300ms），确保 page-state snapshot 反映展开态
        const { promise: delayPromise, resolve: delayResolve } = Promise.withResolvers<void>();
        setTimeout(delayResolve, 400);
        await delayPromise;
        abortCtrl = new AbortController();
        deps.sendBtn.classList.add('sending');
        let stopHintR: (() => void) | null = null;
        const setWaitR = (w: boolean) => {
          const panel = deps.getPanelEl();
          if (w) { if (!stopHintR && panel) stopHintR = startWaitingIndicator(panel); }
          else if (stopHintR) { stopHintR(); stopHintR = null; }
        };
        setWaitR(true);
        await resumeRun(base, data.runId, 0, chatMessages, abortCtrl.signal,
          () => _renderChat('auto'), setWaitR,
        );
        deps.sendBtn.classList.remove('sending');
        _renderChat('auto');
        // 递增重启计数（防止无限循环）
        try { localStorage.setItem(RESTART_COUNT_KEY, String(restartCount + 1)); } catch {}
      }
    } catch { /* 网络失败静默，用户可手动重发 */ }
  }
  tryAutoResume();

  // 监听会话切换 → 中止进行中的 run + 分段重载消息
  // 竞态防护：切换前 abort 进行中流式 run，防止流继续写入已切走的会话。
  // guard 用 _renderedSessionId（本模块真相），不用 sessionStore.activeId——后者
  // 会被 sessionStore.init() 的监听器抢先改掉，导致 guard 误判、切换被跳过。
  window.addEventListener('kfm-session-change', async (e: Event) => {
    const detail = (e as CustomEvent).detail;
    const sid: string = detail?.sessionId ?? '';
    // 目标已是当前渲染的会话且无进行中 run → 无需重载，避免打断流式
    if (sid && sid === _renderedSessionId && !abortCtrl) return;
    // 中止进行中的后台 run（流式尾随）
    if (abortCtrl) { abortCtrl.abort(); abortCtrl = null; deps.sendBtn.classList.remove('sending'); }
    // 清理旧会话的 todo 面板（防止残留）
    clearTodoPanel();
    const myToken = ++_switchToken;
    await sessionStore.load();
    if (myToken !== _switchToken) return; // 期间又切换，放弃
    sessionStore.activeId = sid;
    deps.updateSessionSelect(
      sessionStore.list.map(s => ({ label: s.title, value: s.id })),
      sid
    );
    if (!sid) {
      chatMessages.length = 0;
      _renderedSessionId = '';
      clearChatDom(); // 面板 DOM 持久化后必须显式清空（v8.0 靠重建面板顺带清掉）
      return;
    }
    await loadSessionInto(sid);
  });

  async function handleSend(): Promise<void> {
    if (abortCtrl) { abortCtrl.abort(); abortCtrl = null; deps.sendBtn.classList.remove('sending'); return; }
    const text = deps.inputEl.value.trim();
    if (!text) return;
    // 用户手动发送 → 重置重启计数（允许下次冷恢复自动 resume）
    try { localStorage.removeItem('kfm-restart-count'); } catch {}
    deps.inputEl.value = '';
    if (deps.getOrbState() === 'collapsed') deps.expandPanel();
    deps.inputEl.style.height = 'auto';

    abortCtrl = new AbortController();
    deps.sendBtn.classList.add('sending');

    // 等待提示动画：由 doSend 的 onWait 显式控制——
    //   发送后 / 每轮 message_stop 后（工具调用后 AI 再次请求的空档）起提示，
    //   message_start 到达即停。覆盖工具轮次之间的等待，不再只在首次请求时显示。
    let stopHint: (() => void) | null = null;
    let firstRenderDone = false;
    const setWait = (waiting: boolean) => {
      const panel = deps.getPanelEl();
      if (waiting) {
        if (!stopHint && panel) stopHint = startWaitingIndicator(panel);
      } else {
        if (stopHint) { stopHint(); stopHint = null; }
      }
    };
    // 发送即起提示（用户消息入队前）
    setWait(true);

    await doSend(text, chatMessages, base, abortCtrl.signal,
      () => {
        // onBeforeSend: 用户消息已入队（doSend 内部 push 后调此回调）
        // live 发送传 animate=true：滑入动画（v7 orb-msg-new 行为恢复，历史挂载不动画）
        mountUserMessage(chatMessages.length - 1, text, false, true);
        scrollToBottom();
      },
      () => {
        if (!firstRenderDone) {
          // 第一次 onRender = 用户消息已入队，强制追底显示用户消息
          firstRenderDone = true;
          _renderChat('follow');
        } else {
          _renderChat('auto');
        }
      },
      (msg) => {
        setWait(false);
        chatMessages.push({ role: 'ai', content: [{ type: 'text', text: msg }] });
        // 兜底消息必须显式上屏——_renderChat 只滚动不挂载（v8 曾只 push 数据层，用户看不到）
        mountFallbackAiMessage(msg);
        _renderChat('auto');
      },
      setWait,
      sessionStore.activeId || '',
    );

    // 流结束兜底：确保提示已停
    setWait(false);
    abortCtrl = null;
    deps.sendBtn.classList.remove('sending');
    _renderChat('auto');
  }

  deps.sendBtn.addEventListener('click', () => handleSend());
}
