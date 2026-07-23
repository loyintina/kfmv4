/**
 * KFM v4 - 会话持久化存储
 *
 * 单一数据源：会话列表、当前活跃会话、消息保存/加载。
 * 替代 orb.ts 中散布的 loadSessions / loadActiveSessionId / saveSession / generateSessionTitle。
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

// ========== Content Block 类型（与 orb-chat.ts 共享语义）==========

export interface TextBlock {
  type: 'text';
  text: string;
  reasoning?: string;
}

export interface ToolBlock {
  type: 'tool';
  id: string;
  name: string;
  input: Record<string, unknown>;
  result?: { content: Array<{ type: string; text?: string }>; isError?: boolean };
  // UI-only（渲染时生成，不做持久化）
  color1?: string;
  color2?: string;
}

export interface RuleWarningBlock {
  type: 'rule_warning';
  content: string;
}

export type ContentBlock = TextBlock | ToolBlock | RuleWarningBlock;

export interface SessionMessage {
  role: 'user' | 'ai';
  content: ContentBlock[];
}

export interface Session {
  id: string;
  title: string;
  manuallyNamed?: boolean;
  createdAt: string;
  updatedAt: string;
  providerId?: string;
  modelId?: string;
  messages: SessionMessage[];
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
  fetch(apiBase + 'files/write', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: '.kfmv4/active.json', content: JSON.stringify(merged) }),
  }).catch(() => {});
}

// ========== Store ==========

export const sessionStore = {
  activeId: '',
  list: [] as Session[],
  _apiBase: '',
  _listeners: [] as Listener[],

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

  /** 从服务端加载会话列表 + 恢复活跃会话 ID */
  async load(): Promise<void> {
    // 1. 加载会话列表
    try {
      const listRes = await fetch(this._apiBase + 'files/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: '.kfmv4/sessions' }),
      });
      const listData = await listRes.json();
      const files: string[] = (listData.items || []).map((f: { name: string }) => f.name);
      const sessions: Session[] = [];
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        try {
          const res = await fetch(this._apiBase + 'files/read', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: `.kfmv4/sessions/${file}` }),
          });
          const data = await res.json();
          if (data.content) {
            const session: Session = JSON.parse(data.content);
            if (session.id && session.title) sessions.push(session);
          }
        } catch { /* 跳过损坏的会话文件 */ }
      }
      sessions.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      this.list = sessions;
    } catch (e) {
      log('加载会话列表失败: ' + (e instanceof Error ? e.message : 'unknown'));
    }

    // 2. 恢复活跃会话
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

    // 3. 兜底：无活跃会话时选第一个
    if (!this.activeId && this.list.length > 0) {
      this.activeId = this.list[0].id;
    }

    this._notify();
  },

  /** 获取指定会话的消息列表 */
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
        return session.messages || [];
      }
    } catch (e) {
      log('加载会话消息失败: ' + (e instanceof Error ? e.message : 'unknown'));
    }
    return [];
  },

  /** 创建新会话 */
  async create(): Promise<string> {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    this.activeId = id;
    this.list.unshift({
      id, title: '新会话', manuallyNamed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
    });
    await patchActiveConfig(this._apiBase, { sessionId: id });
    this._notify();
    window.dispatchEvent(new CustomEvent('kfm-session-change', { detail: { sessionId: id } }));
    return id;
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

  /** 保存当前消息到活跃会话，首次对话自动生成标题 */
  async saveMessages(
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
    }
    try {
      // 读取现有会话（或创建新的）
      const readRes = await fetch(this._apiBase + 'files/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: `.kfmv4/sessions/${this.activeId}.json` }),
      });
      const readData = await readRes.json();

      let session: Session = readData.content
        ? JSON.parse(readData.content)
        : {
            id: this.activeId,
            title: '新会话',
            manuallyNamed: false,
            createdAt: new Date().toISOString(),
            messages: [],
          };

      // content block 格式直接序列化，无需转换
      session.messages = messages.map(m => ({
        role: m.role,
        content: m.content,
      }));
      session.updatedAt = new Date().toISOString();
      if (modelId) session.modelId = modelId;
      if (providerId) session.providerId = providerId;

      await fetch(this._apiBase + 'files/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: `.kfmv4/sessions/${this.activeId}.json`,
          content: JSON.stringify(session, null, 2),
        }),
      });

      // 首次对话自动生成标题
      if (!session.manuallyNamed && session.messages.length === 2) {
        this._generateTitle(session);
      }

      // 刷新列表（标题可能已更新）
      this.load();
    } catch (e) {
      log('保存会话失败: ' + (e instanceof Error ? e.message : 'unknown'));
    }
  },

  // ========== 内部方法 ==========

  /** 用第一条用户消息的前 18 字生成会话标题 */
  async _generateTitle(session: Session): Promise<void> {
    const userMsg = session.messages.find(m => m.role === 'user')
      ?.content.find((b): b is TextBlock => b.type === 'text')?.text || '';
    const cleaned = userMsg.trim();
    if (!cleaned) return;
    const MAX = 18;
    session.title = cleaned.length <= MAX ? cleaned : cleaned.slice(0, MAX) + '...';
    await fetch(this._apiBase + 'files/write', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: `.kfmv4/sessions/${this.activeId}.json`,
        content: JSON.stringify(session, null, 2),
      }),
    });
    window.dispatchEvent(
      new CustomEvent('kfm-session-change', { detail: { sessionId: this.activeId } }),
    );
  },
};
