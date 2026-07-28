/**
 * orb-chat-run.ts — 持久化运行态 + 流消费 + 重连
 *
 * 从 orb-chat.ts 拆分（v8 审计：706 行 → 3 文件）。
 * 职责：
 *   - 持久化运行态（runId/cursor/sessionId + localStorage 跨刷新恢复）
 *   - SSE 流消费（_applyEvent 状态变更 + _consumeRun 流读取）
 *   - 自动重连（_consumeWithReconnect 指数退避）
 *   - 收尾逻辑（_finalizeRun + settlePendingToolBlocks + _cancelPendingTools）
 *   - 公开 API（resumeRun + doSend）
 *
 * 依赖：
 *   - orb-chat-hints（clearToolHint + updateTodoFromTool）
 *   - chat-dom（mountFallbackAiMessage 兜底上屏 + settleToolCardsDom 取消收尾）
 *   - session-client（会话管理）
 *   - KFMState + loadFileTree（文件树刷新）
 */

import { KFMState } from './state.js';
import { loadFileTree } from './tree-loader.js';
import { sessionStore } from './session-client.js';
import type { ContentBlock, TextBlock, ToolBlock, RuleWarningBlock } from './session-client.js';
import { clearToolHint, updateTodoFromTool } from './orb-chat-hints.js';
import { log } from './logger.js';
// 工具 I/O 上下文压缩（v8.1.0）：纯函数注册表，契约 docs/design/TOOL_IO_COMPACTION.md
import { compactToolInput, compactToolResult, normalizeBashCommand } from '../../shared/tool-compaction/index.js';
import type { CompactionCtx } from '../../shared/tool-compaction/index.js';
// 兜底消息上屏 + 取消时工具卡 DOM 收尾（v8 增量 DOM：数据层变更不会自动投影）
import { mountFallbackAiMessage, settleToolCardsDom } from './chat-dom.js';

// ========== 类型 ==========

export type { ContentBlock, TextBlock, ToolBlock, RuleWarningBlock };

/** 消息结构：content 是 block 数组，一次 AI 回复 = 一条消息 = 多个 block */
export interface ChatMessage {
  role: 'user' | 'ai';
  content: ContentBlock[];
}

/** 流式事件（服务端 → 客户端 SSE 协议） */
export interface StreamEvent {
  type: 'message_start' | 'message_stop' | 'content_block_start' | 'content_block_delta' | 'content_block_stop' | 'tool_result' | 'rule_warning' | 'error' | 'done';
  index?: number;
  blockType?: 'text' | 'tool_use';
  toolUseId?: string;
  toolName?: string;
  deltaType?: 'text_delta' | 'thinking_delta' | 'input_json_delta';
  deltaText?: string;
  toolResult?: { content: Array<{ type: string; text?: string }>; isError?: boolean };
  filesChanged?: boolean;
  content?: string;
}

// ========== 持久化挂机运行态 ==========
// 当前活跃 runId（服务端后台生成任务）。刷新/切后台后据此重连续读。
let _activeRunId: string | null = null;
let _activeCursor = 0; // 已消费到的事件 index（重连从此续读）
let _sendSessionId = ''; // doSend 时传入的 sessionId

export function getActiveRunId(): string | null {
  return _activeRunId;
}

export function getActiveCursor(): number {
  return _activeCursor;
}
// ========== v8 事件钩子 ==========
// orb.ts 注入 chat-dom.patchEvent，每个 SSE 事件在 _applyEvent（状态层）之后
// 额外调此钩子做增量 DOM 投影。
let _eventHook: ((event: StreamEvent) => void) | null = null;

export function setEventHook(fn: ((event: StreamEvent) => void) | null): void {
  _eventHook = fn;
}


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

// ========== 流消费 ==========

/** 流消费上下文：把事件应用到 messages 所需的回调与状态 */
interface RunConsumeCtx {
  messages: ChatMessage[];
  onRender: () => void;
  onWait?: (waiting: boolean) => void;
  getMsgIdx: () => number;
  setMsgIdx: (i: number) => void;
}

/** 把单个 StreamEvent 应用到 messages（纯状态变更，不含渲染节流） */
function _applyEvent(event: StreamEvent, ctx: RunConsumeCtx): void {
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
    case 'message_stop': {
      onWait?.(true);
      break;
    }
    case 'content_block_start': {
      if (msgIdx < 0) break;
      const { index, blockType, toolUseId, toolName } = event;
      if (blockType === 'text') {
        messages[msgIdx].content[index!] = { type: 'text', text: '', reasoning: '' };
      } else if (blockType === 'tool_use') {
        onWait?.(false); // 工具块到达 = 有实际内容，停等待提示
        messages[msgIdx].content[index!] = { type: 'tool', id: toolUseId || '', name: toolName || 'unknown', input: {} };
      }
      break;
    }
    case 'content_block_delta': {
      if (msgIdx < 0) break;
      const { index, deltaType, deltaText } = event;
      const block = messages[msgIdx].content[index!];
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
      }
      break;
    }
    case 'content_block_stop': {
      if (msgIdx < 0) break;
      const { index } = event;
      const block = messages[msgIdx].content[index!];
      if (block?.type === 'tool' && (block as ToolBlock & { _jsonBuf?: string })._jsonBuf) {
        let parsed: Record<string, unknown> = {};
        try { parsed = JSON.parse((block as ToolBlock & { _jsonBuf: string })._jsonBuf); } catch {}
        block.input = parsed;
        delete (block as ToolBlock & { _jsonBuf?: string })._jsonBuf;
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
        updateTodoFromTool(toolBlock);
        clearToolHint(toolBlock.id);
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
        const env = JSON.parse(jsonStr) as { type?: string; index?: number; event?: StreamEvent };
        if (env.type === '__end__') return 'done';
        const event = env.event;
        if (!event) continue;
        if (typeof env.index === 'number') _activeCursor = env.index + 1;
        _applyEvent(event, ctx);
        _eventHook?.(event);
        if (
          event.type === 'message_start' ||
          (event.type === 'content_block_start' && event.blockType === 'tool_use') ||
          event.type === 'tool_result' ||
          event.type === 'rule_warning'
        ) { ctx.onRender(); }
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
      const chk = await fetch(apiBase + 'ai/chat/' + runId + '/status').then(r => r.json()) as { done?: boolean; exists?: boolean };
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

// ========== 收尾逻辑 ==========

/** 生成完成后的收尾：去除临时字段 + 标记未完成工具块 */
async function _finalizeRun(messages: ChatMessage[], msgIdx: number): Promise<void> {
  const noReply = msgIdx < 0 || (messages[msgIdx] && messages[msgIdx].content.length === 0);
  if (noReply) {
    // 兜底一律新起一条消息并显式上屏：v8 增量 DOM 下 append 进已挂载的空消息
    // 容器不会投影（chat-dom 只增不改）；新起一条同时保持 _messageEls 与 messages 对齐
    messages.push({ role: 'ai', content: [{ type: 'text', text: '[未收到回复，请重试]' }] });
    mountFallbackAiMessage('[未收到回复，请重试]');
  }
  // 收尾任何仍无 result 的工具块（流已结束，如上游 error 中断时工具未返回结果）——
  // 否则渲染判 isExecuting=!result 会让工具卡永久卡"忙碌中"（BAR-105 同类，error 触发路径）。
  settlePendingToolBlocks(messages, '(未完成)');
  for (const m of messages) {
    for (const b of m.content) {
      if (b?.type === 'tool') clearToolHint((b as ToolBlock).id);
      if (b?.type === 'text') delete (b as TextBlock & { _reasonExpanded?: boolean })._reasonExpanded;
    }
  }
  // v8: 持久化由服务端 SessionStore 接管（run-manager finally flush），客户端不再双写。
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
        delete (b as ToolBlock & { _userExpanded?: boolean })._userExpanded;
      }
    }
  }
  return settled;
}

/** 取消时收尾：清 toolHint（DOM 副作用），再调纯函数标记未完成工具块。 */
function _cancelPendingTools(messages: ChatMessage[]): void {
  for (const m of messages) {
    for (const b of m.content) {
      if (b?.type === 'tool') clearToolHint((b as ToolBlock).id);
    }
  }
  settlePendingToolBlocks(messages, '(已取消)');
}

// ========== 公开 API ==========

/**
 * 重连一个已存在的后台 run（页面刷新/切后台恢复后调用）。
 * 从 fromIndex 续读补齐已错过的事件 + 实时尾随到完成。
 */
export async function resumeRun(
  apiBase: string, runId: string, fromIndex: number,
  messages: ChatMessage[], signal: AbortSignal,
  onRender: () => void, onWait?: (waiting: boolean) => void,
): Promise<void> {
  _activeRunId = runId;
  let msgIdx = -1;
  // 重连时 messages 已含历史；新 AI 消息由 message_start 追加。msgIdx 从末尾 AI 消息推断。
  const ctx: RunConsumeCtx = {
    messages, onRender, onWait,
    getMsgIdx: () => msgIdx, setMsgIdx: (i) => { msgIdx = i; },
  };
  try {
    await _consumeWithReconnect(apiBase, runId, fromIndex, signal, ctx);
    _activeRunId = null;
    _persistActiveRun('', null);
    // 无条件落盘——无论流正常结束(done)还是 run 消失(gone/服务重启)
    await _finalizeRun(messages, msgIdx);
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      // 用户在重连态点暂停 → 通知服务端取消后台 run（彻底停止生成）
      fetch(apiBase + 'ai/chat/' + runId + '/cancel', { method: 'POST' }).catch(() => {});
      _persistActiveRun('', null);
      _cancelPendingTools(messages);
      settleToolCardsDom('(已取消)'); // 工具卡 DOM 同步收尾：忙碌中 → 已取消（v8 数据层变更不自动投影）
      const lastMsg = messages[messages.length - 1];
      if (lastMsg?.role === 'ai') {
        // 同 _finalizeRun：不 append 进已挂载消息（不会上屏），新起一条保证对齐
        messages.push({ role: 'ai', content: [{ type: 'text', text: '[已取消]' }] });
        mountFallbackAiMessage('[已取消]');
      }
    }
    _activeRunId = null;
  }
  onWait?.(false);
  onRender();
}

/** 从 ChatMessage 中提取纯文本 */
function extractText(msg: ChatMessage): string {
  return msg.content
    .filter((b): b is TextBlock => b?.type === 'text')
    .map(b => b.text)
    .join('');
}

/** 读取活跃配置（provider/model/roleFile） */
async function readActiveConfig(base: string): Promise<{ providerId?: string; modelId?: string; roleFile?: string }> {
  try {
    const res = await fetch(base + 'files/read', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '.kfmv4/active.json' }),
    });
    const data = await res.json() as { content?: string };
    return data.content ? JSON.parse(data.content) : {};
  } catch { return {}; }
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
  // 推用户消息（content block 格式）
  messages.push({ role: 'user', content: [{ type: 'text', text }] });
  onBeforeSend();
  // onRender 在这里只是为了让用户消息气泡先出现，不影响 hint（hint 在 orb.ts 里 startWaitingIndicator 之后追加）
  onRender();

  const config = await readActiveConfig(apiBase);
  if (!config.providerId) { onConfigMissing('未配置 Provider，请先在 API 卡中添加并选择一个 Provider。'); return; }
  if (!config.modelId) { onConfigMissing('未选择 Model，请先在 API 卡或光球面板底部选择一个 Model。'); return; }

  // system prompt 不再在客户端组装 —— 改由服务端每轮重组（眼睛系统 v7.4）。
  // 客户端只把当前角色文件名传给服务端，服务端读角色卡 promptFiles（含动态 page-state.md）。
  const roleFile = config.roleFile || '';
  const model = config.modelId;
  const provider = config.providerId;

  try {
    // 构建发给 API 的消息（content blocks → OpenAI 格式）。
    // 会话文件存的是完整 content blocks（含 tool_use + tool_result），
    // 发给 API 时必须转为 OpenAI 的 tool_calls + role:"tool" 格式。
    //
    // 工具 I/O 上下文压缩（v8.1.0，契约 docs/design/TOOL_IO_COMPACTION.md）：
    // 会话文件是全量真相源（永不压缩），apiMessages 是投影——压缩只发生在这一处。
    const noCompact = localStorage.getItem('kfm-no-compact') === '1'; // 灰度逃生门：=1 跳过压缩发全量
    // G1：最近 2 条 AI 消息（工作记忆）及之后的全部消息豁免压缩
    let compactExemptFrom = 0; // 不足 2 条 AI 消息 = 全部豁免
    let aiSeen = 0;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]?.role === 'ai' && ++aiSeen === 2) { compactExemptFrom = i; break; }
    }
    // G4：整个历史中最后出现的 todo 工具结果豁免（承载当前任务状态，压了=失忆当前进度）
    let lastTodoResultId = '';
    for (let i = messages.length - 1; i >= 0 && !lastTodoResultId; i--) {
      const m = messages[i];
      if (m?.role !== 'ai') continue;
      for (const b of m.content) {
        if (b?.type === 'tool' && b.name === 'todo' && b.result) { lastTodoResultId = b.id; break; }
      }
    }
    // 跨调用标注预扫描（契约第九节：标注只向后看——每个调用的 ctx 只由它之前的
    // 调用决定，旧压缩行永不因后续消息改变，prompt 缓存前缀稳定）。
    // 压缩器保持纯函数，此处在压缩循环前产出每个工具块的 CompactionCtx。
    const compactCtxById = new Map<string, CompactionCtx>();
    {
      const readFpsByPath = new Map<string, string[]>();
      const bashRunsByCmd = new Map<string, boolean[]>(); // 归一化命令 → isError 序列
      const mutCountByPath = new Map<string, number>(); // 路径 → 成功修改次数（write+edit）
      let bashFailCmds: string[] = []; // 当前连续失败的归一化命令序列（环境故障判定用）
      for (const m of messages) {
        if (m?.role !== 'ai') continue;
        for (const b of m.content) {
          if (b?.type !== 'tool' || !b.result) continue;
          const resultText = b.result.content?.map(c => c.text || '').join('') || '';
          if (b.name === 'read') {
            const path = typeof b.input.path === 'string' ? b.input.path : '';
            const fp = `${resultText.split('\n').length}行/${resultText.length}字符`;
            const prev = readFpsByPath.get(path) || [];
            compactCtxById.set(b.id, { readPrevFps: [...prev] });
            prev.push(fp);
            readFpsByPath.set(path, prev);
          } else if (b.name === 'bash') {
            const rawCmd = typeof b.input.command === 'string' ? b.input.command : '';
            const norm = normalizeBashCommand(rawCmd) || rawCmd.trim(); // 归一化为空 → 退回原串分组
            const isError = !!b.result.isError;
            const runs = bashRunsByCmd.get(norm) || [];
            let tailFails = 0; // runs 末尾的连续失败数
            for (let i = runs.length - 1; i >= 0 && runs[i]; i--) tailFails++;
            // 环境故障：连续 ≥3 次 bash 失败且最近 3 次命令各不相同（不同意图同一结局 = 通道问题）
            if (isError) bashFailCmds.push(norm); else bashFailCmds = [];
            const last3 = bashFailCmds.slice(-3);
            const envStreak = isError && bashFailCmds.length >= 3 && new Set(last3).size === 3
              ? bashFailCmds.length : 0;
            compactCtxById.set(b.id, {
              bashRetry: {
                ordinal: runs.length + 1,
                failStreak: isError ? tailFails + 1 : 0,
                prevFailStreak: isError ? 0 : tailFails,
              },
              bashEnvStreak: envStreak,
            });
            runs.push(isError);
            bashRunsByCmd.set(norm, runs);
          } else if (b.name === 'write' || b.name === 'edit') {
            // 修改轨迹（锚定真相源：从全量会话文件计数，与投影窗口无关）。
            // 只有成功调用才算「修改」——失败的 edit 什么都没改。
            const path = typeof b.input.path === 'string' ? b.input.path : '';
            const prev = mutCountByPath.get(path) || 0;
            const ordinal = prev + 1;
            compactCtxById.set(b.id, b.result.isError ? {} : { mutOrdinal: ordinal });
            if (!b.result.isError) mutCountByPath.set(path, ordinal);
          }
        }
      }
    }
    let compactSaved = 0; // 压缩省下的字符数（观测日志用）
    const apiMessages: Array<{ role: string; content: string | null; tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>; tool_call_id?: string }> = [];
    for (let mi = 0; mi < messages.length; mi++) {
      const m = messages[mi];
      if (!m) continue;
      const compactable = !noCompact && mi < compactExemptFrom; // G1 豁免期外的旧消息才压
      if (m.role === 'user') {
        apiMessages.push({ role: 'user', content: extractText(m) }); // G5：user 消息一个字不动
      } else {
        // AI 消息：拆分 text + tool blocks 为 OpenAI 格式
        const textBlocks = m.content.filter((b): b is TextBlock => b?.type === 'text');
        const toolBlocks = m.content.filter((b): b is ToolBlock => b?.type === 'tool');
        const mainText = textBlocks.map(b => b.text || '').join(''); // G5：AI 正文一个字不动
        if (toolBlocks.length > 0) {
          // 有工具调用：assistant 消息带 tool_calls
          const toolCalls = toolBlocks.map(tc => {
            let args = JSON.stringify(tc.input);
            if (compactable) {
              const compacted = compactToolInput(tc.name, tc.input, !!tc.result?.isError, compactCtxById.get(tc.id));
              if (compacted) {
                const compactedArgs = JSON.stringify(compacted);
                compactSaved += args.length - compactedArgs.length;
                args = compactedArgs;
              }
            }
            return { id: tc.id, type: 'function' as const, function: { name: tc.name, arguments: args } };
          });
          apiMessages.push({ role: 'assistant', content: mainText || null, tool_calls: toolCalls });
          // 每个工具结果作为独立的 role:"tool" 消息（tool_calls/tool 配对结构原样保留，只压 content）
          for (const tc of toolBlocks) {
            const resultText = tc.result?.content?.map(c => c.text || '').join('') || '';
            let content = resultText;
            if (compactable && tc.id !== lastTodoResultId) { // G4：最新 todo 结果豁免
              const compacted = compactToolResult(tc.name, tc.input, resultText, !!tc.result?.isError, compactCtxById.get(tc.id));
              if (compacted !== null) {
                compactSaved += resultText.length - compacted.length;
                content = compacted;
              }
            }
            apiMessages.push({ role: 'tool', content, tool_call_id: tc.id });
          }
        } else {
          apiMessages.push({ role: 'assistant', content: mainText });
        }
      }
    }
    if (!noCompact) {
      // 观测：压缩前后大小（JSON.stringify 长度估算；压缩前 = 压缩后 + 省下的字符）
      const afterSize = JSON.stringify(apiMessages).length;
      log(`[compact] apiMessages ${((afterSize + compactSaved) / 1000).toFixed(1)}KB → ${(afterSize / 1000).toFixed(1)}KB`);
    }

    // 落盘用户消息：仅新会话（无 activeId）需要 saveMessages——它负责建会话并回填 activeId，
    // 否则删除最后一个会话后再发送会带空 sessionId 触发服务端 400。
    // activeId 已存在时跳过——等价性论证：服务端 /ai/chat/start 自己会 appendUserMessage
    // 落盘用户消息（routes.ts，带末条去重），AI 回复由 run-manager flush 落盘，
    // 客户端这次全量 saveMessages 是冗余写。
    if (!sessionStore.activeId) {
      await sessionStore.saveMessages(messages, model, provider);
    }
    if (!_sendSessionId) _sendSessionId = sessionStore.activeId;

    // 后台启动生成任务（服务端挂机），拿 runId
    const startRes = await fetch(apiBase + 'ai/chat/start', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: _sendSessionId, messages: apiMessages, model, provider, roleFile }),
      signal,
    });
    const startData = await startRes.json() as { runId?: string; fromIndex?: number; error?: string };
    if (!startData.runId) { throw new Error(startData.error || '启动生成失败'); }
    _activeRunId = startData.runId;
    _persistActiveRun(_sendSessionId, startData.runId);

    let msgIdx = -1;
    const ctx: RunConsumeCtx = {
      messages, onRender, onWait,
      getMsgIdx: () => msgIdx, setMsgIdx: (i) => { msgIdx = i; },
    };
    await _consumeWithReconnect(apiBase, startData.runId, startData.fromIndex || 0, signal, ctx);
    // 流结束：最后一轮 message_stop 会把等待提示打开，此处立即关闭，
    // 避免 _finalizeRun 的落盘网络往返期间残留一个多余的等待框。
    onWait?.(false);
    _activeRunId = null;
    _persistActiveRun(_sendSessionId, null);
    // 无条件落盘——无论流正常结束(done)还是 run 消失(gone/服务重启)，
    // 已渲染在面板上的 AI 回复都应该持久化，否则刷新后永久丢失。
    await _finalizeRun(messages, msgIdx);
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      // 用户主动取消：通知服务端取消后台 run
      if (_activeRunId) { fetch(apiBase + 'ai/chat/' + _activeRunId + '/cancel', { method: 'POST' }).catch(() => {}); _activeRunId = null; }
      _persistActiveRun(_sendSessionId, null);
      // 收尾未完成的工具卡（从"忙碌中"→已取消→折叠），并追加取消标注
      _cancelPendingTools(messages);
      settleToolCardsDom('(已取消)'); // 工具卡 DOM 同步收尾（v8 数据层变更不自动投影）
      const lastMsg = messages[messages.length - 1];
      if (lastMsg?.role === 'ai') {
        // 新起一条取消标注：append 进已挂载消息不会上屏（v8 增量 DOM 只增不改）
        messages.push({ role: 'ai', content: [{ type: 'text', text: '[已取消]' }] });
        mountFallbackAiMessage('[已取消]');
      }
    } else {
      // 兜底消息 push 后必须显式上屏——onRender 只滚动不挂载，否则用户看不到失败原因
      const errText = '请求失败: ' + (e instanceof Error ? e.message : '未知错误');
      messages.push({ role: 'ai', content: [{ type: 'text', text: errText }] });
      mountFallbackAiMessage(errText);
    }
  }
  // 流彻底结束（成功/错误/取消）：确保等待提示已停
  onWait?.(false);
  onRender();
}
