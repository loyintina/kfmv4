/**
 * session-client.ts — 客户端会话管理（只读缓存 + pre-run 创建）
 *
 * 注意：实际持久化存储在服务端 `src/server/ai/session-store.ts`。
 * 本模块职责：会话列表缓存、activeId 管理、pre-run saveMessages（创建会话+标题生成）。
 * 替代 orb.ts 中散布的 loadSessions / loadActiveSessionId / generateSessionTitle。
 *
 * ## 数据流
 *   sessionStore.load()          → 从服务端拉取列表 + 恢复 activeId → notify
 *   sessionStore.switchTo(id)    → 持久化到 active.json → notify + 派发事件
 *   sessionStore.saveMessages()  → 读写会话文件 + 自动生成标题
 *   sessionStore.subscribe(fn)   → UI 自动刷新
 *
 * ## 跨模块通信
 *   - 内部订阅：orb.ts 通过 subscribe() 感知变化
 *   - 外部事件：config.card / session.card 派发 kfm-session-change，本模块监听
 *   - 对外通知：switchTo() / _generateTitle() 派发 kfm-session-change 通知其他卡片
 */

import { log } from './logger.js';

// ========== 类型 ==========

// Content Block 类型：唯一来源在 shared/chat-protocol/messages.ts（双端共享）。
// 此处 re-export 保持现有 import 路径兼容（orb-chat.ts 等从此处导入）。
export type { TextBlock, ToolBlock, RuleWarningBlock, ContentBlock, ChatMessage } from '../../shared/chat-protocol/messages.js';
import type { TextBlock, ToolBlock, ContentBlock, ChatMessage } from '../../shared/chat-protocol/messages.js';
import { promoteReasoningBlocks } from '../../shared/message-normalize.js';

/** SessionMessage 是 ChatMessage 的别名（历史兼容） */
export type SessionMessage = ChatMessage;

export interface Session {
  id: string;
  title: string;
  manuallyNamed?: boolean;
  createdAt: string;
  updatedAt: string;
  providerId?: string;
  modelId?: string;
  messages: SessionMessage[];
  /** 有正文的消息数（元数据加载时由服务端提供；messages 为空时用于统计显示）。 */
  messageCount?: number;
  /** 估算 token 数（压缩投影口径：实际发给 API 的量级） */
  tokenCount?: number;
  /** 摘要 token（L4 /compact 后摘要本身；无 compact 时为 undefined → 界面退化为双数字） */
  compactToken?: number;
  /** 全量会话 token 估算（含 reasoning 与全部工具 I/O；与 tokenCount 并列显示「压缩/全量」） */
  fullTokenCount?: number;
}

// ========== 纯函数：消息正文提取 / 计数（无副作用，可单测） ==========

/** 提取一条消息所有 TextBlock 的纯文本（跳过工具块、警告块）。 */
export function extractMessageText(msg: SessionMessage): string {
  return (msg.content || [])
    .filter((b): b is TextBlock => b != null && b.type === 'text')
    .map(b => b.text || '')
    .join('');
}

/** 统计「有正文」的消息数——纯工具调用 / 纯思考气泡（无 text 或 text 全空白）不计。
 *  BAR-103：会话统计行「N 条消息」的正确口径，删除最后一个会话后归零。 */
export function countTextMessages(messages: SessionMessage[]): number {
  return messages.filter(m => extractMessageText(m).trim()).length;
}

/** 从服务端会话元数据项解析 Session（纯函数，可单测）。
 *  2026-08-16 修复：补 compactToken 解析——曾缺导致三数字 b 透传断链（BAR-COMPACT-L4-01e）。 */
export function parseSessionItem(s: Record<string, unknown>): Session | null {
  if (typeof s['id'] !== 'string' || typeof s['title'] !== 'string') return null;
  return {
    id: s['id'],
    title: s['title'],
    createdAt: typeof s['createdAt'] === 'string' ? s['createdAt'] : '',
    updatedAt: typeof s['updatedAt'] === 'string' ? s['updatedAt'] : '',
    ...(typeof s['manuallyNamed'] === 'boolean' && { manuallyNamed: s['manuallyNamed'] }),
    ...(typeof s['providerId'] === 'string' && { providerId: s['providerId'] }),
    ...(typeof s['modelId'] === 'string' && { modelId: s['modelId'] }),
    messageCount: typeof s['messageCount'] === 'number' ? s['messageCount'] : 0,
    tokenCount: typeof s['tokenCount'] === 'number' ? s['tokenCount'] : 0,
    ...(typeof s['compactToken'] === 'number' && { compactToken: s['compactToken'] }),
    ...(typeof s['fullTokenCount'] === 'number' && { fullTokenCount: s['fullTokenCount'] }),
    messages: [], // 元数据加载不含消息，需要时通过 getMessages() 按需加载
  };
}

// ========== 保存前清洗：深拷贝 + 剥离 UI-only 字段 ==========
// saveMessages 的快照引用共享问题：旧代码 messages.map(m => ({ role, content: m.content }))
// 只浅拷贝外层，content 数组和 block 对象仍是引用。当 _saveChain 异步执行 _doSaveMessages
// 时，block 已被后续事件原地修改（_jsonBuf 流式缓冲），导致增量保存将中间态持久化到磁盘。
//
// cleanBlockForSave 做两件事：
//   1. 深拷贝——切断与实时 objects 的引用，链上后续变异不影响已排队的保存
//   2. 剥离 UI-only 字段——_jsonBuf 不应落地（v8 已删除动画字段 _animText/_animInput/_foldPhase）
// 保留：color1/color2（工具卡配色，跨页面加载保持一致）

function cleanBlockForSave(b: ContentBlock): ContentBlock {
  if (!b) return b;
  if (b.type === 'text') {
    return { type: 'text', text: b.text || '', reasoning: b.reasoning || '' };
  }
  if (b.type === 'tool') {
    const out: ToolBlock = { type: 'tool', id: b.id, name: b.name, input: { ...(b.input || {}) } };
    if (b.result) {
      out.result = {
        content: (b.result.content || []).map(c => ({ ...c })),
        ...(b.result.isError !== undefined && { isError: b.result.isError }),
        ...(b.result.details && { details: { ...b.result.details } }),
      };
    }
    if (b.color1) out.color1 = b.color1;
    if (b.color2) out.color2 = b.color2;
    return out;
  }
  if (b.type === 'rule_warning') {
    return { type: 'rule_warning', content: b.content };
  }
  // 未知类型防御（ContentBlock 当前仅含 text/tool/rule_warning，此分支不命中）
  return b;
}

type Listener = () => void;

// ========== Helpers ==========

async function readActiveConfig(apiBase: string): Promise<Record<string, string>> {
  try {
    const res = await fetch(apiBase + 'files/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '.kfmv4/active.json' }),
    });
    const data = await res.json();
    return data.content ? JSON.parse(data.content) : {};
  } catch {
    return {};
  }
}

async function patchActiveConfig(apiBase: string, patch: Record<string, string>): Promise<void> {
  const current = await readActiveConfig(apiBase);
  const merged = { ...current, ...patch };
  // 必须 await：create()/switchTo() 依赖 active.json 落盘后才派发事件，
  // 否则随后的 load() 读到旧 sessionId → activeId 被覆盖回旧会话（新会话丢失/串写）。
  try {
    await fetch(apiBase + 'files/write', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '.kfmv4/active.json', content: JSON.stringify(merged) }),
    });
  } catch { /* ignore */ }
}

// 将单个会话对象写盘。create() 立即调用以消除「新会话未落盘 → load 重拉不含它」竞态。
async function writeSessionFile(apiBase: string, session: Session): Promise<void> {
  try {
    await fetch(apiBase + 'files/write', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: `.kfmv4/sessions/${session.id}.json`,
        content: JSON.stringify(session, null, 2),
      }),
    });
  } catch (e) {
    log('写入会话文件失败: ' + (e instanceof Error ? e.message : 'unknown'));
  }
}

// ========== Store ==========

export const sessionStore = {
  activeId: '',
  list: [] as Session[],
  _apiBase: '',
  _listeners: [] as Listener[],
  // 保存串行锁：增量落盘（每轮 message_stop）+ 收尾落盘可能重叠，
  // 串行化避免并发写同一文件交错、以及"读-改-写"竞态丢消息。
  _saveChain: Promise.resolve() as Promise<void>,
  // 最近一次保存是否成功（null=从未保存或已成功，string=最后一次失败原因）
  _lastSaveError: null as string | null,
  // 标记本会话是否由 auto-create 路径创建（仅此路径才有权触发 _generateTitle）
  _pendingAutoTitle: false,

  // ========== 初始化 ==========

  /** 设置 API 前缀并监听外部会话变化事件 */
  init(apiBase: string): void {
    this._apiBase = apiBase;
    window.addEventListener('kfm-session-change', ((e: CustomEvent) => {
      if (e.detail?.sessionId && e.detail.sessionId !== this.activeId) {
        this.activeId = e.detail.sessionId;
        this._notify();
      }
    }) as EventListener);
  },

  // ========== 订阅 ==========

  subscribe(fn: Listener): void {
    this._listeners.push(fn);
  },

  _notify(): void {
    for (const fn of this._listeners) fn();
  },

  // ========== 数据加载 ==========

  /** 从服务端加载会话列表（仅元数据，不含 messages）+ 恢复活跃会话 ID。
   *  使用 /api/sessions/list 单请求端点：服务端读所有文件但只序列化元数据，
   *  比逐文件 list+read 快 N 倍（大会话文件可达 600KB，元数据仅约 200B/条）。*/
  async load(): Promise<void> {
    // 1. 加载会话元数据列表（单次请求，服务端剥离 messages）
    try {
      const res = await fetch(this._apiBase + 'sessions/list');
      const data: unknown = await res.json();
      if (data && typeof data === 'object' && 'sessions' in data && Array.isArray(data.sessions)) {
        const sessions: Session[] = [];
        for (const item of data.sessions) {
          if (!item || typeof item !== 'object') continue;
          const parsed = parseSessionItem(item as Record<string, unknown>);
          if (parsed) sessions.push(parsed);
        }
        this.list = sessions;
      }
    } catch (e) {
      log('加载会话列表失败: ' + (e instanceof Error ? e.message : 'unknown'));
    }

    // 2. 恢复活跃会话
    // 仅当内存无 activeId、或其指向的会话已不在列表中（被删）时，才用 active.json 恢复。
    // 若内存 activeId 有效（如 create()/switchTo() 刚设、文件可能尚未落盘），保留内存值，
    // 否则 active.json 的旧 sessionId 会覆盖回旧会话 → 新会话丢失/串写。
    const memValid = this.activeId && this.list.some(s => s.id === this.activeId);
    if (!memValid) {
      try {
        const res = await fetch(this._apiBase + 'files/read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: '.kfmv4/active.json' }),
        });
        const data = await res.json();
        if (data.content) {
          const config = JSON.parse(data.content);
          if (config.sessionId) this.activeId = config.sessionId;
        }
      } catch { /* 首次使用，尚无配置文件 */ }
    }

    // 3. 兜底：无活跃会话（或指向的会话已不存在）时选第一个
    if ((!this.activeId || !this.list.some(s => s.id === this.activeId)) && this.list.length > 0) {
      this.activeId = this.list[0].id;
    }

    this._notify();
  },

  /** 获取指定会话的完整消息列表（一次性全量，用于需要整段的场景）。 */
  async getMessages(id: string): Promise<SessionMessage[]> {
    try {
      const res = await fetch(this._apiBase + 'files/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: `.kfmv4/sessions/${id}.json` }),
      });
      const data = await res.json();
      if (data.content) {
        const session: Session = JSON.parse(data.content);
        // 读时归一化（BAR-ORB-EMPTY-01）：历史壳的 reasoning 回复归位正文，文件不改写
        for (const m of session.messages || []) promoteReasoningBlocks(m.content as TextBlock[]);
        return session.messages || [];
      }
    } catch (e) {
      log('加载会话消息失败: ' + (e instanceof Error ? e.message : 'unknown'));
    }
    return [];
  },

  /** 分段获取会话消息。from='tail' 取末尾（面板追底优先），'head' 取开头（会话卡预览优先）。
   *  返回 { total, messages }；messages 已是文件中的原始顺序切片。 */
  async getMessagesRange(
    id: string, from: 'head' | 'tail', offset: number, limit: number,
  ): Promise<{ total: number; messages: SessionMessage[] }> {
    try {
      const q = `id=${encodeURIComponent(id)}&from=${from}&offset=${offset}&limit=${limit}`;
      const res = await fetch(this._apiBase + 'sessions/messages?' + q);
      const data: unknown = await res.json();
      if (data && typeof data === 'object' && 'messages' in data && Array.isArray(data.messages)) {
        const total = 'total' in data && typeof data.total === 'number' ? data.total : data.messages.length;
        // messages 内容来自受信任的本地会话文件，结构由写入端保证
        // 读时归一化（BAR-ORB-EMPTY-01）：历史壳的 reasoning 回复归位正文，文件不改写
        for (const m of data.messages as SessionMessage[]) promoteReasoningBlocks(m.content as TextBlock[]);
        return { total, messages: data.messages as SessionMessage[] };
      }
    } catch (e) {
      log('分段加载会话消息失败: ' + (e instanceof Error ? e.message : 'unknown'));
    }
    return { total: 0, messages: [] };
  },
  /** 生成不冲突的会话 id：用 title 作基础名，文件已存在则加序号后缀。 */
  async _makeUniqueId(title: string): Promise<string> {
    let id = title;
    let seq = 1;
    while (true) {
      try {
        const res = await fetch(this._apiBase + 'files/read', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: `.kfmv4/sessions/${id}.json` }),
        });
        const data = await res.json();
        if (data.error || !data.content) return id; // 文件不存在 → 可用
        id = `${title} (${++seq})`;
      } catch { return id; } // 查失败就当可用
    }
  },

  /** 创建新会话：id = title 作基础名，文件已存在则加序号。随后写盘。 */
  async create(): Promise<string> {
    const base = '新会话';
    const id = await this._makeUniqueId(base);
    this.activeId = id;
    const session: Session = {
      id, title: base, manuallyNamed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
    };
    this.list.unshift(session);
    await writeSessionFile(this._apiBase, session);
    await patchActiveConfig(this._apiBase, { sessionId: id });
    this._notify();
    window.dispatchEvent(new CustomEvent('kfm-session-change', { detail: { sessionId: id } }));
    return id;
  },

  /** 更新会话标题并同步文件名。若标题与当前 id 不同则重命名文件 + 更新 active.json。 */
  async setTitle(session: Session, newTitle: string): Promise<void> {
    if (!newTitle || newTitle === session.title) return;
    const oldId = session.id;
    const newId = await this._makeUniqueId(newTitle);
    // 标题未导致 id 变化 → 只需更新 title 字段
    if (newId === oldId) { session.title = newTitle; return; }
    // 重命名文件：写新 → 删旧
    session.title = newTitle;
    session.id = newId;
    session.updatedAt = new Date().toISOString();
    await writeSessionFile(this._apiBase, session);
    // 删旧文件
    try { await fetch(this._apiBase + 'files/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: `.kfmv4/sessions/${oldId}.json` }) }); } catch {}
    // 更新活跃引用
    if (this.activeId === oldId) this.activeId = newId;
    // 更新 list 中的缓存
    const entry = this.list.find(s => s.id === oldId);
    if (entry) { entry.id = newId; entry.title = newTitle; entry.updatedAt = session.updatedAt; }
    await patchActiveConfig(this._apiBase, { sessionId: this.activeId });
    this._notify();
    window.dispatchEvent(new CustomEvent('kfm-session-change', { detail: { sessionId: this.activeId } }));
  },

  // ========== 会话操作 ==========

  /** 切换活跃会话 */
  async switchTo(id: string): Promise<void> {
    if (id === this.activeId) return;
    this.activeId = id;

    // 持久化到 active.json（读→合并→写，不覆盖其他字段）
    patchActiveConfig(this._apiBase, { sessionId: id });

    this._notify();

    // 通知其他模块（config.card, session.card）
    window.dispatchEvent(new CustomEvent('kfm-session-change', { detail: { sessionId: id } }));
  },

  // ========== 消息持久化 ==========

  /** 保存当前消息到活跃会话。串行锁防并发写入竞争——
   *  工具密集型对话中 onToolCall 可能触发多次快速保存，
   *  若不串行，先后两轮保存的快照可能乱序落盘（新数据被旧快照覆盖）。
   *  _saveLock 保证顺序，失败不阻断（.then(action, action)）。 */
  saveMessages(
    messages: SessionMessage[],
    modelId?: string,
    providerId?: string,
  ): Promise<void> {
    try {
      const snapshot = messages.map(m => ({
        role: m.role,
        content: (m.content || []).map(b => cleanBlockForSave(b)),
        ...(m.ts ? { ts: m.ts } : {}), // 时间戳随快照存活
      }));
      const doSave = () => this._doSaveMessages(snapshot, modelId, providerId);
      return (this._saveChain = this._saveChain.then(doSave, doSave).catch(() => {}));
    } catch {
      return Promise.resolve();
    }
  },

  async _doSaveMessages(
    messages: SessionMessage[],
    modelId?: string,
    providerId?: string,
  ): Promise<void> {
    // 首次发消息时自动创建会话
    if (!this.activeId) {
      this.activeId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      await patchActiveConfig(this._apiBase, { sessionId: this.activeId });
      this.list.unshift({
        id: this.activeId,
        title: '新会话',
        manuallyNamed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: [],
      });
      this._notify();
      window.dispatchEvent(new CustomEvent('kfm-session-change', { detail: { sessionId: this.activeId } }));
      this._pendingAutoTitle = true; // 仅 auto-create 创建的会话才能触发自动命名
    }
    log(`[save] 开始执行 → ${this.activeId} (${messages.length}msgs)`);
    try {
      // 读取现有会话（或创建新的）
      const readRes = await fetch(this._apiBase + 'files/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: `.kfmv4/sessions/${this.activeId}.json` }),
      });
      const readData = await readRes.json();

      // 区分「文件不存在」（新会话）与「读取失败」（服务端异常）
      let session: Session;
      if (readData.error) {
        if (readData.error === '文件不存在') {
          log(`[save] ${this.activeId} 文件不存在，创建新会话 (写入 ${messages.length} 条)`);
          session = {
            id: this.activeId, title: '新会话', manuallyNamed: false,
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), messages: [],
          };
        } else {
          throw new Error('读取会话文件失败: ' + readData.error);
        }
      } else if (readData.content) {
        session = JSON.parse(readData.content);
      } else {
        log(`[save] ${this.activeId} 空响应，创建新会话 (写入 ${messages.length} 条)`);
        session = {
          id: this.activeId, title: '新会话', manuallyNamed: false,
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), messages: [],
        };
      }

      // content block 格式直接序列化，无需转换
      session.messages = messages.map(m => ({
        role: m.role,
        content: m.content,
        ...(m.ts ? { ts: m.ts } : {}), // 时间戳随落盘存活
      }));
      session.updatedAt = new Date().toISOString();
      if (modelId) session.modelId = modelId;
      if (providerId) session.providerId = providerId;

      // 写入会话文件（含重试：最多 3 次，指数退避 100/300/900ms）
      const content = JSON.stringify(session, null, 2);
      let lastErr: Error | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const writeRes = await fetch(this._apiBase + 'files/write', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              path: `.kfmv4/sessions/${this.activeId}.json`,
              content,
            }),
          });
          const writeData = await writeRes.json();
          if (writeData.error) {
            throw new Error('写入会话文件失败: ' + writeData.error);
          }
          lastErr = null;
          log(`[save] 写入 ${messages.length} 条 → ${this.activeId} (${(content.length / 1024).toFixed(0)}KB, attempt ${attempt + 1})`);
          break; // 写入成功，退出重试循环
        } catch (e) {
          lastErr = e instanceof Error ? e : new Error(String(e));
          if (attempt < 2) {
            await new Promise(r => setTimeout(r, 100 * (3 ** attempt)));
          }
        }
      }
      if (lastErr) {
        this._lastSaveError = lastErr.message;
        throw lastErr;
      }
      this._lastSaveError = null; // 写盘成功，清错误标记

      // 本地同步 list 中该会话（不再无条件 this.load()——增量落盘每轮触发，
      // 全量重拉 N 个会话文件会拖慢流式并与切换竞态；标题变化由 _generateTitle 派发事件刷新）。
      const idx = this.list.findIndex(s => s.id === this.activeId);
      if (idx >= 0) {
        this.list[idx].messages = session.messages;
        this.list[idx].updatedAt = session.updatedAt;
        if (modelId) this.list[idx].modelId = modelId;
      }

      // 首次对话自动生成标题——仅限 auto-create 创建的会话。
      // 旧逻辑 !session.manuallyNamed && session.messages.length===2 会误触发：
      // 已有 365 条的会话被 snapshot(messages=2) 覆盖时，_generateTitle 重新
      // 触发 → setTitle 重命名 → kfm-session-change → chatMessages 被清空。
      if (this._pendingAutoTitle && messages.length >= 2) {
        this._pendingAutoTitle = false;
        this._generateTitle(session);
      }
    } catch (e) {
      this._lastSaveError = (e instanceof Error ? e.message : 'unknown');
      log('保存会话失败: ' + this._lastSaveError);
      // 不 rethrow：保存失败不应阻塞调用方（doSend/_finalizeRun）。
      // _saveChain 的 .catch(()=>{}) 已保证链不会因单次失败断裂，下一轮保存会覆盖。
    }
  },

  // ========== 内部方法 ==========

  /** 用第一条用户消息的前 18 字生成会话标题，文件自动重命名。 */
  async _generateTitle(session: Session): Promise<void> {
    const userMsg = session.messages.find(m => m.role === 'user')
      ?.content.find((b): b is TextBlock => b.type === 'text')?.text || '';
    const cleaned = userMsg.trim();
    if (!cleaned) return;
    const MAX = 18;
    const newTitle = cleaned.length <= MAX ? cleaned : cleaned.slice(0, MAX) + '...';
    // setTitle 负责文件重命名 + active.json 同步
    await this.setTitle(session, newTitle);
    session.manuallyNamed = true; // 自动生成后视为已命名，避免再次自动改变
  },
};
