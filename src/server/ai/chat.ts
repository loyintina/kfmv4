/**
 * kfmv4 AI 调用层
 *
 * 使用 kfmv4 的 API 卡配置和 proxy 端点实现流式对话
 */

import { mkdirSync, existsSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { KFM_DATA_DIR, PROJECT_ROOT } from '../path-utils.js';
import { resolveKey } from '../env-store.js';
import type { WsServer } from '../ws-server.js';
import { getToolDefinitions, executeTool } from './tools/index.js';
import type { KfmTool, ToolContext } from './tools/types.js';
import { buildAlwaysApplyPrompt, checkToolCallRules } from './rule-engine.js';
import { assembleRoleSystemPrompt, assembleDynamicPrompt } from './prompt-assembler.js';
import { refreshPageState } from './page-state.js';

/** 从 prompts/global/tools/*.md 加载工具描述（基于 PROJECT_ROOT，不依赖进程 cwd） */
const PROMPTS_DIR = join(PROJECT_ROOT, 'src', 'server', 'prompts', 'global', 'tools');
const GLOBAL_PROMPTS_DIR = join(PROJECT_ROOT, 'src', 'server', 'prompts', 'global');
const toolDocs = new Map<string, string>();
function loadToolDocs(): void {
  try {
    const files = readdirSync(PROMPTS_DIR).filter(f => f.endsWith('.md'));
    for (const f of files) {
      const name = f.replace('.md', '');
      toolDocs.set(name, readFileSync(join(PROMPTS_DIR, f), 'utf-8'));
    }
  } catch (e) {
    console.error('[chat] loadToolDocs failed:', e instanceof Error ? e.message : e);
  }
}
loadToolDocs();

/**
 * 全局预设提示词（prompts/global/*.md 顶层）：自动注入静态 system 段，全部会话强制，
 * 独立于角色卡。工具文档在 prompts/global/tools/（自动注入，见 PROMPTS_DIR）。
 * 与 prompts/system/*.md（角色卡挂载才生效）语义区分：global = 自动；system = 挂载。
 * 目录语义见 prompts/README.md。readdirSync 不递归 → 顶层与 tools/ 子目录互不干扰。
 */
const globalPrompts: string[] = (() => {
  try {
    return readdirSync(GLOBAL_PROMPTS_DIR)
      .filter(f => f.endsWith('.md'))
      .sort()
      .map(f => readFileSync(join(GLOBAL_PROMPTS_DIR, f), 'utf-8'));
  } catch {
    console.error('[chat] prompts/global 读取失败');
    return [];
  }
})();

function buildToolDocsPrompt(allowTools?: string[]): string {
  if (toolDocs.size === 0) return '';
  let text = '\n\n## 可用工具\n\n';
  const names = allowTools?.length ? allowTools : [...toolDocs.keys()];
  for (const name of names) {
    const doc = toolDocs.get(name);
    if (!doc) continue; // 白名单内但没有文档的工具：跳过（保留工具定义但无说明）
    text += `### ${name}\n\n${doc}\n\n`;
  }
  return text;
}

/** 聊天消息（支持 OpenAI 格式：tool_calls + tool_call_id） */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | null;
  tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>;
  tool_call_id?: string;
}

/** 流式事件（content block 协议）
 *
 * 协议结构（按 SSE 顺序）：
 *   message_start                        ← 新一轮 LLM 消息开始（客户端推新气泡）
 *   content_block_start  index type      ← 创建 block（text / tool_use）
 *   content_block_delta  index delta     ← 增量更新 block 内容
 *   content_block_stop   index           ← block 完成
 *   tool_result          toolUseId       ← 工具执行结果（填入对应 ToolBlock）
 *   message_stop                         ← 本轮消息结束
 *   done                                 ← 全部结束
 *   error                                ← 错误
 */
export interface StreamEvent {
  type:
    | 'message_start'
    | 'content_block_start'
    | 'content_block_delta'
    | 'content_block_stop'
    | 'tool_result'
    | 'message_stop'
    | 'error'
    | 'done'
    | 'rule_warning';
  // content_block_start
  index?: number;
  blockType?: 'text' | 'tool_use';
  toolUseId?: string;
  toolName?: string;
  // content_block_delta
  deltaType?: 'text_delta' | 'thinking_delta' | 'input_json_delta';
  deltaText?: string;
  // tool_result
  toolResult?: { content: Array<{ type: string; text?: string }>; isError?: boolean; details?: Record<string, unknown> };
  filesChanged?: boolean; // 工具执行后文件系统有变化，客户端应刷新文件树
  // error / rule_warning
  content?: string;
}

// BAR-106 核心逻辑已迁移到 shared/chat-protocol/block-idx.ts（双端共享）。
// import + re-export：本地使用 + 保持现有外部 import 路径兼容。
import { createClientIdxMapper } from '../../shared/chat-protocol/block-idx.js';
export { createClientIdxMapper };

/** API Provider 配置 */
interface ApiProvider {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  models: string[];
}


/** 读取 providers.json */
function loadProviders(): ApiProvider[] {
  try {
    const configPath = join(KFM_DATA_DIR, 'providers.json');
    const content = readFileSync(configPath, 'utf-8');
    return JSON.parse(content);
  } catch (e) {
    console.error('[chat] loadProviders failed:', e instanceof Error ? e.message : e);
    return [];
  }
}

/** provider 解析（BAR-PROVIDER-MATCH-01，2026-08-05）：按 id 或 name 匹配——
 *  旧逻辑只按 id 且静默回退 providers[0]，provider 传 name（如「硅基流动」，
 *  id=siliconflow）时请求被静默路由到 providers[0]（OpenCode Go GitHub），
 *  上游报「Model is not supported」，排查半天才发现路由错了。静默回退 = 数据污染
 *  源（实验臂会打到错误的网关还以为是目标模型不稳），匹配不上必须显式报错（返回 null）。
 *  抽出成纯函数供回归钉直接测（tests/provider-env.test.ts）。 */
export function findApiProvider(providers: ApiProvider[], provider: string | undefined): ApiProvider | null {
  if (!provider) return null;
  return providers.find(p => p.id === provider || p.name === provider) ?? null;
}

/** 流式对话。roleFile 供每轮重组 system prompt（读角色卡 promptFiles，含动态 page-state）。 */
export async function* streamChat(
  messages: ChatMessage[],
  model: string,
  provider: string,
  wsServer: WsServer,
  signal?: AbortSignal,
  roleFile?: string,
  allowTools?: string[], // 工具白名单（脚本用——不给的 AI 不会用，2026-08-04 用户提议）
  extraSystem?: string, // 外部 system 约束注入（脚本工具流会话用——如探针的「只输出 JSON」；非角色卡）
  maxTokens?: number, // 单轮输出预算覆盖（默认 16384；工具流思考型探针需放宽——思考链计入 max_tokens，预算被吃光则 text 为 0，2026-08-04 试点事故）
  params?: Record<string, unknown>, // 上游请求参数透传（provider 特定：thinking 开关等；与 tools/max_tokens 平级合并进 requestBody）
  sandboxRoot?: string, // script 会话写监狱沙箱根（2026-08-06 e13 逃逸事故）；设置后 write/edit 路径强制限制在内
  readRoot?: string, // script 会话读监狱根（2026-08-08 docprobe v2 污染事故）；设置后 read/grep/glob 路径强制限制在内
): AsyncGenerator<StreamEvent> {
  const tools = allowTools?.length
    ? getToolDefinitions().filter(t => allowTools.includes(t.name))
    : getToolDefinitions();

  // 构建工具上下文（cwd = PROJECT_ROOT 确定性默认，不随服务启动目录漂移——BAR-CWD-DRIFT-01）
  const toolCtx: ToolContext = {
    cwd: PROJECT_ROOT,
    wsServer,
    signal, // run 中止信号透传（BAR-BASH-HANG-01：看门狗/取消要能杀死原生子进程）
    sandboxRoot, // script 会话写监狱（未设置 = 不限制，面板会话不受影响）
    readRoot, // script 会话读监狱（同上，docprobe 考场边界）
  };

  // 读取 API 配置
  const providers = loadProviders();
  // BAR-PROVIDER-MATCH-01：匹配逻辑见 findApiProvider（id/name 匹配，无静默回退）
  const apiProvider = provider
    ? findApiProvider(providers, provider)
    : null;

  if (!apiProvider) {
    yield { type: 'error', content: provider
      ? `Provider「${provider}」不存在（id/name 均未匹配）——请检查 providers.json 或面板 API 卡。`
      : '未配置 API Provider，请先在 API 卡中添加。' };
    return;
  }

  // apiKey 代字解析（${VAR} → process.env / .kfmv4/.env，见 env-store.ts）——
  // 使用点展开而非加载点：raw 代字不流出服务端，API 卡编辑回写不会冲掉引用。
  const resolvedKey = resolveKey(apiProvider.apiKey);
  if (resolvedKey.missingVar) {
    yield { type: 'error', content: `Provider「${apiProvider.name || apiProvider.id}」的 apiKey 引用了环境变量 ${resolvedKey.missingVar}，但未设置——请在 .kfmv4/.env 中配置（或 export 后重启服务）。` };
    return;
  }
  const apiKey = resolvedKey.value;

  // 构建 OpenAI 格式的 tools 参数
  const toolsParam = tools.length > 0 ? tools.map(t => ({
    type: 'function' as const,
    function: { name: t.name, description: t.description, parameters: t.parameters },
  })) : undefined;
  // 对话消息：只保留 user/assistant/tool（透传 OpenAI 格式字段）。
  // 客户端发来的 system 一律剥离——system 由服务端每轮重组（眼睛系统核心）。
  // 边界规范化（2026-07-29，kimi-k3 400 根因）：tool/assistant 的 content 可能是
  // 结构化对象（工具结果未字符串化），宽松 provider 容忍、严格 provider（kimi）400。
  // OpenAI 规范 tool.content 必须是 string——非字符串一律 JSON.stringify。
  const apiMessages: Array<Record<string, unknown>> = messages
    .filter(m => m.role !== 'system')
    .map(m => {
      const out: Record<string, unknown> = {
        role: m.role === 'assistant' ? 'assistant' : m.role,
        content: typeof m.content === 'string' || m.content == null ? m.content : JSON.stringify(m.content),
      };
      if (m.role === 'tool' && out.content == null) out.content = '';
      if (m.tool_calls) out.tool_calls = m.tool_calls;
      if (m.tool_call_id) out.tool_call_id = m.tool_call_id;
      // 官方 deepseek thinking mode 要求带 tools 的 assistant 历史必须回传 reasoning_content
      //（会话回放场景：客户端重发历史时思考链不能丢，否则 api.deepseek.com 400）
      const rc = (m as { reasoning_content?: unknown }).reasoning_content;
      if (typeof rc === 'string' && rc) out.reasoning_content = rc;
      return out;
    })
    // 边界兜底（BAR-PROVIDER-02）：无 tool_calls 的空 assistant 一律丢弃——
    // 严格端点（kimi）400「assistant must not be empty」，源头在客户端，此处 fail-closed。
    .filter(m => !(m.role === 'assistant' && !m.tool_calls && (m.content == null || m.content === '')));
  // 静态 system 段（工具文档 + 全局预设 + alwaysApply 规则）：整轮对话不变，算一次。
  const staticSystemParts: string[] = [];
  const toolDocsPrompt = buildToolDocsPrompt(allowTools);
  if (toolDocsPrompt) staticSystemParts.push(toolDocsPrompt);
  staticSystemParts.push(...globalPrompts);
  // 外部 system 约束（脚本工具流会话：探针「只输出 JSON」等机械约束）。
  // 与 roleFile（角色卡）语义区分：这是调用方强制的行为约束，非人格/角色内容。
  if (extraSystem) staticSystemParts.push(extraSystem);
  const alwaysApplyPrompt = buildAlwaysApplyPrompt();
  if (alwaysApplyPrompt) staticSystemParts.push(alwaysApplyPrompt);
  // ts 元数据声明（BAR-TS-MIMIC-01）：投影层只给 user 消息盖 [ts …] 前缀（to-openai-messages），
  // assistant 侧不盖——盖了 AI 就把前缀学成自己的行文格式复读。声明兜底残留模仿冲动。
  // 静态段：整轮对话不变，不破坏前缀缓存。
  staticSystemParts.push('用户消息前的 [ts MM-DD HH:MM:SS] 是系统加盖的时间元数据（精确到秒），供你感知对话的节奏与间隔；它不是用户写的内容。你的回复从不带这个前缀——也不要自己以任何形式加上它。');

  // system 消息只构建一次（静态前缀，利于 API 缓存命中）。
  // 动态内容（page-state 等）改由工具循环末尾注入对话尾部，不再每轮重建 system。
  const systemParts: string[] = [];
  const roleSystem = assembleRoleSystemPrompt(roleFile);
  if (roleSystem) systemParts.push(roleSystem);
  systemParts.push(...staticSystemParts);
  // L4 会话压缩（/compact）：固化摘要注入 system 尾部（roleSystem/静态段之后）。
  // 摘要固化后跨轮不变——system 前缀缓存不受影响；需要细节时 AI 可用 read 工具
  // 回读会话文件（可寻址的丢失，不是遗忘）。来源：meta.compacts 最后一条。
  const compactSummary = (extraSystem && extraSystem.startsWith('__KFM_COMPACT__'))
    ? extraSystem.slice('__KFM_COMPACT__'.length) : '';
  if (compactSummary) {
    systemParts.push(`# 此前对话的固化摘要（/compact 生成，覆盖更早的历史；原文在会话文件可回读）\n\n${compactSummary}`);
  }
  // 严格端点适配（BAR-QWEN-01，2026-08-05）：硅基流动 Qwen 系 400
  // 「System message must be at the beginning」——多条 system 段被拒。
  // 所有 system 段合并为单条（\n\n 拼接），内容/顺序不变，缓存前缀不受影响。
  const systemMessages: Array<Record<string, unknown>> = systemParts.length
    ? [{ role: 'system', content: systemParts.join('\n\n') }]
    : [];

  // 首轮前刷新一次 page-state（AI 发第一条前先看到当前页面）。
  refreshPageState(wsServer);
  void import('./eyes.js').then(m => m.genEyes(wsServer)).catch(() => {});
  // 首轮注入动态反馈（让 AI 第一条就能看到页面状态）
  // 包裹（分隔线 + 「勿主动提及」规则）统一由 assembleDynamicPrompt 完成。
  const initialDynamic = assembleDynamicPrompt(roleFile);
  if (initialDynamic) {
    apiMessages.push({ role: 'user', content: initialDynamic });
  }
  // 工具调用循环（上限 50 轮，连续失败 3 次则截断）
  const MAX_TURNS = 50;
  let toolFailureCount = 0;
  let turn = 0;


  while (true) {
    if (signal?.aborted) { yield { type: 'error', content: '已取消' }; return; }
    turn++;
    if (turn > MAX_TURNS) { yield { type: 'error', content: `工具调用超过 ${MAX_TURNS} 轮上限，已停止` }; return; }
    // 静态 system 前缀 + 累积的对话消息
    const requestBody: Record<string, unknown> = {
      model: model || apiProvider.models[0] || 'deepseek-v4-flash',
      messages: [...systemMessages, ...apiMessages],
      max_tokens: maxTokens ?? 16384,
      stream: true,
      stream_options: { include_usage: true },
      ...(params || {}),
    };
    if (toolsParam) requestBody.tools = toolsParam;

    const _tFetch = Date.now();
    // 上游瞬时错误重试（仅网络级：fetch 抛出 = DNS/连接重置/超时，非 HTTP 状态码）。
    // 病灶：一次网络抖动杀死整轮 run——工具续写中途「fetch failed」怼进正文，
    // AI 无法接着说话（todo工具测试 msg 734 尸检）。HTTP 错误（4xx/5xx）是确定性
    // 失败，不重试、直接透传错误体；用户取消（signal aborted）立即上抛不重试。
    const MAX_NET_RETRIES = 2;
    let response: Response | null = null;
    for (let attempt = 0; attempt <= MAX_NET_RETRIES; attempt++) {
      try {
        response = await fetch(`${apiProvider.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
          signal,
        });
        break;
      } catch (err) {
        if (signal?.aborted) throw err;
        if (attempt >= MAX_NET_RETRIES) {
          yield { type: 'error', content: `网络错误（已重试 ${MAX_NET_RETRIES} 次仍失败）: ${err instanceof Error ? err.message : String(err)}` };
          return;
        }
        const waitMs = (attempt + 1) * 2000; // 2s / 4s 线性退避
        console.log(`[chat] upstream 网络错误（turn ${turn}, 第 ${attempt + 1} 次），${waitMs}ms 后重试: ${err instanceof Error ? err.message : err}`);
        await new Promise(r => setTimeout(r, waitMs));
      }
    }
    if (!response) { yield { type: 'error', content: '网络错误：未能建立连接' }; return; }

    // 计时诊断：上游 TTFB（首字节耗时）。若远大于直接请求 API 的首 token 耗时，
    // 说明慢在上游 prefill/网关而非 kfm 中间层（中间层全链路流式，无缓冲点）。
    console.log(`[chat] upstream TTFB: ${Date.now() - _tFetch}ms (turn ${turn}, ~${JSON.stringify(requestBody).length}B body)`);

    if (!response.ok) {
      // 透传上游错误体（kimi 等严格端点会给出具体原因，只报状态码等于扔掉诊断）
      const errBody = await response.text().catch(() => '');
      yield { type: 'error', content: `API 请求失败: ${response.status}${errBody ? ` — ${errBody.slice(0, 300)}` : ''}` };
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      yield { type: 'error', content: '无响应体' };
      return;
    }
    const decoder = new TextDecoder();
    let buffer = '';
    const toolCallBufs = new Map<number, { id: string; name: string; args: string }>();
    let finishReason = '';
    let contentBuf = '';
    let reasoningBuf = ''; // 服务端保存用：记录 thinking delta，构建 AI 消息时填入 reasoning 字段
    // text block（含 reasoning）始终在 index=0，tool_use block 从 index=1 开始
    // 设计决策：thinking(reasoning_content) 和 text(content) 合并到同一个 TextBlock，
    // 不拆成两个 block。客户端 content[0] 同时持有 reasoning 和 text，
    // chat-dom.ts patchEvent 取 textBlocks[0] 即可正确渲染两者。
    // 历史问题：曾经 thinking 开 index=0，text 再 stop/reopen 到 index=1，
    // 导致 textBlocks[0].text 永远为空。
    let hasTextBlock = false; // 已 yield content_block_start index=0
    const toolStarted = new Set<number>(); // 已 yield content_block_start 的工具 provider idx
    // 工具块索引连续化：见 createClientIdxMapper（BAR-106 核心）。
    const { clientIdx } = createClientIdxMapper();

    // 本轮 message_start
    yield { type: 'message_start' };
    let _firstDeltaLogged = false;

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
          const chunk = JSON.parse(jsonStr);
          if (!_firstDeltaLogged && chunk?.choices?.[0]?.delta) {
            _firstDeltaLogged = true;
            console.log(`[chat] first delta at +${Date.now() - _tFetch}ms (turn ${turn})`);
          }
          // 上游错误块（配额/限流/内部错误）：非 OpenAI chunk 格式，无 choices。
          // 必须显式上抛，否则流静默结束——用户只看到思考后戛然而止、工具调用"被截断"。
          if (chunk?.error || chunk?.type === 'error') {
            const em = chunk.error?.message || chunk.message || '上游服务错误';
            yield { type: 'error', content: `模型服务错误：${em}` };
            return;
          }
          const delta = chunk?.choices?.[0]?.delta || {};
          if (chunk.choices?.[0]?.finish_reason) finishReason = chunk.choices[0].finish_reason;
          if (chunk.usage) console.log('[chat] usage:', JSON.stringify(chunk.usage));

          // 工具调用：流式累积 + 即时 yield content_block_start/delta
          // 设计决策：工具名一出现就 yield start（客户端立刻渲染卡片），参数片段到了就 yield delta。
          // 之前是等 LLM 整个响应结束后才一次性 yield 所有事件，导致工具卡出现有延迟。
          if (delta.tool_calls) {
            for (const tc of (delta.tool_calls as Array<Record<string, unknown>>)) {
              const idx = (tc.index as number) ?? 0;
              if (!toolCallBufs.has(idx)) {
                toolCallBufs.set(idx, { id: '', name: '', args: '' });
              }
              const buf = toolCallBufs.get(idx)!;
              if (tc.id) buf.id = tc.id as string;
              if ((tc.function as Record<string, string>)?.name) buf.name += (tc.function as Record<string, string>).name;
              if ((tc.function as Record<string, string>)?.arguments) buf.args += (tc.function as Record<string, string>).arguments;

              // 工具名出现即 yield start（客户端立刻显示工具卡片）
              if (!toolStarted.has(idx) && buf.name) {
                toolStarted.add(idx);
                yield {
                  type: 'content_block_start',
                  index: clientIdx(idx),
                  blockType: 'tool_use',
                  toolUseId: buf.id || `call_${turn}_${idx}`,
                  toolName: buf.name,
                };
              }
              // 参数片段到了即 yield delta（客户端流式显示参数）
              if (tc.function && (tc.function as Record<string, string>).arguments) {
                yield {
                  type: 'content_block_delta',
                  index: clientIdx(idx),
                  deltaType: 'input_json_delta',
                  deltaText: (tc.function as Record<string, string>).arguments,
                };
              }
            }
          }

          // thinking delta → 写入 index=0 block 的 reasoning 字段
          if (delta.reasoning_content) {
            if (!hasTextBlock) {
              hasTextBlock = true;
              yield { type: 'content_block_start', index: 0, blockType: 'text' };
            }
            reasoningBuf += delta.reasoning_content as string;
            yield { type: 'content_block_delta', index: 0, deltaType: 'thinking_delta', deltaText: delta.reasoning_content as string };
          }

          // text delta → 写入同一个 index=0 block 的 text 字段
          if (delta.content) {
            contentBuf += delta.content as string;
            if (!hasTextBlock) {
              hasTextBlock = true;
              yield { type: 'content_block_start', index: 0, blockType: 'text' };
            }
            yield { type: 'content_block_delta', index: 0, deltaType: 'text_delta', deltaText: delta.content as string };
          }
        } catch { /* skip malformed chunks */ }
      }
    }

    // 关闭 text/thinking block（如果开过）
    if (hasTextBlock) {
      yield { type: 'content_block_stop', index: 0 };
    }
    // 关闭已 start 的工具 block
    for (const idx of toolStarted) {
      yield { type: 'content_block_stop', index: clientIdx(idx) };
    }


    // 检查是否需要执行工具
    if (finishReason === 'tool_calls' && toolCallBufs.size > 0) {
      const assistantMsg: Record<string, unknown> = { role: 'assistant', content: contentBuf || null };
      const toolCalls: Array<Record<string, unknown>> = [];
      const todo: Array<{ name: string; params: Record<string, unknown>; tcId: string; blockIdx: number }> = [];
      let tcIdx = 0;
      for (const [, buf] of toolCallBufs) {
        const tcId = buf.id || `call_${turn}_${tcIdx}`;
        const params = safeParseJson(buf.args);
        toolCalls.push({ id: tcId, type: 'function', function: { name: buf.name, arguments: buf.args } });
        todo.push({ name: buf.name, params, tcId, blockIdx: tcIdx + 1 });
        tcIdx++;
      }
      assistantMsg.tool_calls = toolCalls;
      // 官方 deepseek thinking mode + tools 硬性要求（2026-08-04 接官方研究实测 400）：
      // 「The reasoning_content in the thinking mode must be passed back to the API」——
      // 带 tool_calls 的 assistant 消息必须回传当轮思考链，否则 api.deepseek.com 直接 400。
      // 中转网关（opencode）通常不强制，官方严格；reasoningBuf 服务端一直在收集，带上有益无害。
      if (reasoningBuf) assistantMsg.reasoning_content = reasoningBuf;
      apiMessages.push(assistantMsg);

      // 规则检查（仅白名单内工具——白名单外的根本不执行，无需警告）
      const pendingWarnings: string[] = [];
      for (const t of todo) {
        if (allowTools?.length && !allowTools.includes(t.name)) continue;
        const ruleWarning = checkToolCallRules(t.name, t.params);
        if (ruleWarning) {
          pendingWarnings.push(ruleWarning);
          yield { type: 'rule_warning', content: ruleWarning };
        }
      }

      // 文件工具成功执行 → 标记 filesChanged（bash 可改任意路径，指纹覆盖不了子目录）
      const FILE_TOOLS: Record<string, true> = { write: true, edit: true, bash: true };

      // 并行执行所有工具
      const results = await Promise.all(todo.map(async t => {
        // 白名单 fail-closed（2026-08-04 用户提议）：脚本会话只允许清单内工具。
        // AI 可能从历史消息/预置对话中学到白名单外工具名——执行层必须再拦一道，
        // 否则「文档过滤 + 定义过滤」只是提示层，AI 硬调照样执行。
        if (allowTools?.length && !allowTools.includes(t.name)) {
          return {
            content: [{ type: 'text', text: `工具「${t.name}」不在本次会话的工具白名单内（允许: ${allowTools.join(', ')}），已拒绝执行。请改用白名单内的工具，或直接文字回复。` }],
            isError: true,
          };
        }
        try {
          return await executeTool(t.name, t.params, toolCtx);
        } catch (err) {
          return {
            content: [{ type: 'text', text: `工具执行失败: ${err instanceof Error ? err.message : String(err)}` }],
            isError: true,
          };
        }
      }));

      // yield tool_result，同时推入 apiMessages
      let filesChanged = false;
      for (let i = 0; i < todo.length; i++) {
        const t = todo[i];
        const result = results[i];
        if (result.isError) {
          toolFailureCount++;
        } else {
          toolFailureCount = 0;
        }
        // 文件工具无论成败都标记 filesChanged
        if (t.name in FILE_TOOLS) filesChanged = true;
        // 每个工具都 yield tool_result（客户端需要收到每个事件更新动画）
        // 最后一个带 filesChanged 标记
        yield { type: 'tool_result', toolUseId: t.tcId, toolResult: result, filesChanged: i === todo.length - 1 ? filesChanged : undefined };
        apiMessages.push({ role: 'tool', content: JSON.stringify(result), tool_call_id: t.tcId });
      }

      // 注入 warning
      if (pendingWarnings.length > 0) {
        apiMessages.push({ role: 'user', content: pendingWarnings.join('\n\n---\n\n') });
      }

      // 连续失败 3 次 → 注入提示词让 AI 停止调工具，改用文字回复
      if (toolFailureCount >= 3) {
        apiMessages.push({ role: 'user', content: '你的工具调用已连续失败 3 次。请停止调用工具，直接用文字回复用户，说明当前情况。' });
        toolFailureCount = 0; // 重置，避免下一轮立即触发
      }
      // UI 变化是异步的：服务端发指令 → 浏览器应用 → 浏览器 pushSnapshot 回传。
      // 给一个 settle 窗口让最新快照到达，再刷新 page-state.md，使下一轮重组 system
      // 时 AI 能看到工具对页面的实际影响（眼睛闭环）。
      const { promise: settle, resolve: settleDone } = Promise.withResolvers<void>();
      setTimeout(settleDone, 250);
      await settle;
      refreshPageState(wsServer);
  void import('./eyes.js').then(m => m.genEyes(wsServer)).catch(() => {});
      // 动态反馈注入对话末尾（不破坏 system 前缀缓存；包裹同首轮）
      const dynamicPrompt = assembleDynamicPrompt(roleFile);
      if (dynamicPrompt) {
        apiMessages.push({ role: 'user', content: dynamicPrompt });
      }
      // 本轮消息结束，进入下一轮
      yield { type: 'message_stop' };
      continue;
    }

    yield { type: 'message_stop' };
    yield { type: 'done' };
    return;
  }
}

function safeParseJson(s: string): Record<string, unknown> {
  try { return JSON.parse(s); } catch { return {}; }
}
