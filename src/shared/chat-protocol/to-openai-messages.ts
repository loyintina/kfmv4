/**
 * to-openai-messages.ts — content blocks → OpenAI 载荷的**唯一**构造函数。
 *
 * v8 宪法 + 上游严格端点契约（BAR-PROVIDER-01/02）的交汇点：
 * 会话文件存全量 content blocks，发给 provider 前必须在这里统一投影——
 * tool_calls/tool 配对、压缩投影（v8.1.0，契约 docs/domains/ai-chat/detail-tool-compaction.md）、
 * 空壳 assistant 过滤。**任何发送路径（doSend / tryAutoResume / 未来第三条）都必须
 * 经此函数**，禁止第三份手写转换（BAR-ORB-RESUME-01：orb.ts 曾内联复制简化版，
 * 无压缩、不过滤空壳、塞 content:null，严格端点 400）。
 *
 * 纯函数：不碰 localStorage/DOM/网络。客户端特有输入（灰度逃生门、todo dismiss
 * 指纹）由调用方经 opts 注入——这也让它可直接单测。
 */

import type { ChatMessage, TextBlock, ToolBlock } from './messages.js';
import {
  compactToolInput, compactToolResult, normalizeBashCommand, MUT_BURST_GAP,
  todoResultAnnotation, webTitleKey, errorFingerprint, failRepeatAnnotation,
  EXEMPT_USER_ROUNDS,
} from '../tool-compaction/index.js';
import type { CompactionCtx } from '../tool-compaction/index.js';

export interface OpenAiToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface OpenAiMessage {
  role: string;
  content: string | null;
  tool_calls?: OpenAiToolCall[];
  tool_call_id?: string;
}

export interface ToOpenAiOptions {
  /** false = 灰度逃生门（kfm-no-compact=1）：跳过压缩发全量。标注仍照常附加。 */
  compact: boolean;
  /** todo dismiss 指纹判定（客户端 localStorage 注入）；缺省视为未 dismiss。 */
  isTodoDismissed?: (todos: Array<{ content: string; status: string }>) => boolean;
}

export interface ToOpenAiResult {
  apiMessages: OpenAiMessage[];
  compactSaved: number; // 压缩省下的字符数（观测日志用）
}

function extractText(msg: ChatMessage): string {
  return msg.content
    .filter((b): b is TextBlock => b?.type === 'text')
    .map(b => b.text)
    .join('');
}

/** [MM-DD HH:MM] 前缀（投影端本地时区）。ts 缺失/非法 → 空串（旧消息向后兼容）。
 *  给 AI 对话时间感（跨度、间隔）。不违反 G6：ts 是写入侧盖章的真相源数据，
 *  确定不变；G6 禁的是投影时现生成时间戳。 */
function tsPrefix(ts?: string): string {
  if (!ts) return '';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `[${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}] `;
}

/**
 * 客户端产物占位符（非 AI 真实输出）：API 失败/空响应时的本地兜底消息。
 * 不进载荷——它们是客户端事故记录，不是对话内容；原样上行会让「最近的自己」
 * 看起来像一连串错误文本（实测 k3 400 时代：最近 10 条占位错误里 8 条挤在最近几十轮）。
 * 会话文件原样保留（真相源不动），只在投影层过滤。
 * 混有真实正文的（错误追加在正文后）不在此列——isClientArtifact 要求整条都是占位符。
 * [已取消] 不过滤：用户主动取消是对话信号（AI 不该续着被取消的思路讲）。
 */
function isClientArtifact(text: string): boolean {
  const t = text.trim();
  return (t.startsWith('[错误: ') && t.endsWith(']')) || t === '[未收到回复，请重试]';
}

export function toOpenAiMessages(messages: ChatMessage[], opts: ToOpenAiOptions): ToOpenAiResult {
  const compact = opts.compact;
  // G1：最近 EXEMPT_USER_ROUNDS 轮用户回合（含当前输入所在回合）豁免压缩。
  // 豁免单位是用户回合而非 AI 消息数：一轮多工具调用会产生多条 AI 消息，同属一个
  // 逻辑回合——按 AI 消息计数（旧 G1=2 条），上一回合的多轮工具证据本回合就蒸发，
  // AI 失去校验锚点只能依赖自己的叙述（v8.3.x 边界实验定标，见 EXEMPT_USER_ROUNDS）。
  let compactExemptFrom = 0; // 不足 EXEMPT_USER_ROUNDS 轮用户消息 = 全部豁免
  let userSeen = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === 'user' && ++userSeen === EXEMPT_USER_ROUNDS) { compactExemptFrom = i; break; }
  }
  // G4：整个历史中最后出现的 todo 工具结果豁免（承载当前任务状态，压了=失忆当前进度）
  // 同时捕获该块与其后 AI 消息数，供投影标注（契约第九节 todo 小节）。
  let lastTodoResultId = '';
  let lastTodoBlock: ToolBlock | null = null;
  let todoAiRoundsAfter = 0; // 最后一次 todo 更新之后经过的 AI 消息数（烂尾判定用）
  for (let i = messages.length - 1; i >= 0 && !lastTodoResultId; i--) {
    const m = messages[i];
    if (m?.role !== 'ai') continue;
    for (const b of m.content) {
      if (b?.type === 'tool' && b.name === 'todo' && b.result) {
        lastTodoResultId = b.id;
        lastTodoBlock = b;
        break;
      }
    }
    if (!lastTodoResultId) todoAiRoundsAfter++;
  }
  // todo 投影标注（契约第九节）：dismiss 指纹命中 = 用户 ✕ 关闭过这份列表；
  // 烂尾 = ≥TODO_STALE_GAP 轮未更新。措辞只陈述事实不做因果断言——
  // 手动关闭 ≠ 任务结束，也可能只是嫌碍眼（用户原话），信号本身分不出来。
  let todoAnnotation = '';
  if (lastTodoBlock) {
    const todos = Array.isArray(lastTodoBlock.input?.todos)
      ? lastTodoBlock.input.todos as Array<{ content: string; status: string }> : [];
    const dismissed = todos.length > 0 && opts.isTodoDismissed ? opts.isTodoDismissed(todos) : false;
    todoAnnotation = todoResultAnnotation({ dismissed, aiRoundsAfter: todoAiRoundsAfter });
  }
  // 跨调用标注预扫描（契约第九节：标注只向后看——每个调用的 ctx 只由它之前的
  // 调用决定，旧压缩行永不因后续消息改变，prompt 缓存前缀稳定）。
  // 压缩器保持纯函数，此处在压缩循环前产出每个工具块的 CompactionCtx。
  const compactCtxById = new Map<string, CompactionCtx>();
  const failRepeatById = new Map<string, number>(); // 块 id → 同错误第 N 次（投影标注用，需在块外可见）
  {
    const readFpsByPath = new Map<string, string[]>();
    const bashRunsByCmd = new Map<string, boolean[]>(); // 归一化命令 → isError 序列
    // 路径 → 修改爆发状态（write+edit 成功调用）。cum=全会话累计；burst=本轮爆发内序号；
    // lastMi=上次成功修改所在 AI 消息索引（相距 >MUT_BURST_GAP 轮 = 新一轮爆发）
    const mutStateByPath = new Map<string, { cum: number; burst: number; lastMi: number }>();
    let bashFailCmds: string[] = []; // 当前连续失败的归一化命令序列（环境故障判定用）
    const webPrevTitles: string[] = []; // web_search 历史标题键（空键不入，契约第九节空键守卫）
    const failCountByKey = new Map<string, number>(); // 工具:错误指纹 → 次数（失败模式重复标注用）
    for (let mi = 0; mi < messages.length; mi++) {
      const m = messages[mi];
      if (m?.role !== 'ai') continue;
      for (const b of m.content) {
        if (b?.type !== 'tool' || !b.result) continue;
        const resultText = b.result.content?.map(c => c.text || '').join('') || '';
        // 失败模式重复（跨工具通用层；bash 除外——它有更精细的弧线/环境故障机制）
        if (b.result.isError && b.name !== 'bash') {
          const efp = errorFingerprint(resultText);
          if (efp) { // 空指纹（无信息失败文本）不入库不比对
            const key = `${b.name}:${efp}`;
            const n = (failCountByKey.get(key) || 0) + 1;
            failCountByKey.set(key, n);
            failRepeatById.set(b.id, n);
          }
        }
        if (b.name === 'read') {
          // 失败的 read 不是「读到了内容」——不推进指纹历史（否则 EISDIR 这类
          // 错误指纹会让后续成功读取误判「文件已被修改」，宁漏勿错）
          if (b.result.isError) continue;
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
        } else if (b.name === 'web_search') {
          // 重复搜索标注：标题键精确全等才判同；空键（失败/异常结果无标题行）
          // 不入历史也不比对——两个空键会互相误判「相同」（契约空键守卫）。
          compactCtxById.set(b.id, { webPrevTitles: [...webPrevTitles] });
          const key = webTitleKey(resultText);
          if (key) webPrevTitles.push(key);
        } else if (b.name === 'write' || b.name === 'edit') {
          // 修改轨迹（锚定真相源：从全量会话文件计数，与投影窗口无关）。
          // 只有成功调用才算「修改」——失败的 edit 什么都没改。
          // 爆发语义：相邻两次成功修改相距 >MUT_BURST_GAP 轮 = 新一轮爆发，
          // 历史累计降级为「再进入」背景（几轮内集中修改的计数才有时效性）。
          const path = typeof b.input.path === 'string' ? b.input.path : '';
          // edit 行号区间来自 result.details（omp/edit.ts 写入，编辑当时位置，后续会漂移）
          let editRange: CompactionCtx['editRange'];
          if (b.name === 'edit') {
            const d = b.result.details;
            const ls = d?.lineStart, le = d?.lineEnd;
            if (typeof ls === 'number' && typeof le === 'number') editRange = { start: ls, end: le };
          }
          if (b.result.isError) {
            compactCtxById.set(b.id, editRange ? { editRange } : {}); // 失败不更新爆发状态
          } else {
            const st = mutStateByPath.get(path) || { cum: 0, burst: 0, lastMi: -1 };
            const reEntry = st.cum > 0 && mi - st.lastMi > MUT_BURST_GAP;
            const next = {
              cum: st.cum + 1,
              burst: reEntry || st.lastMi < 0 ? 1 : st.burst + 1,
              lastMi: mi,
            };
            mutStateByPath.set(path, next);
            const ctx: CompactionCtx = { mutBurst: { burst: next.burst, cum: next.cum, reEntry } };
            if (editRange) ctx.editRange = editRange;
            compactCtxById.set(b.id, ctx);
          }
        }
      }
    }
  }
  let compactSaved = 0;
  const apiMessages: OpenAiMessage[] = [];
  for (let mi = 0; mi < messages.length; mi++) {
    const m = messages[mi];
    if (!m) continue;
    const compactable = compact && mi < compactExemptFrom; // G1 豁免期外的旧消息才压
    if (m.role === 'user') {
      // G5：user 消息一个字不动（压缩绝对禁区；ts 前缀是元数据渲染，非压缩）
      apiMessages.push({ role: 'user', content: tsPrefix(m.ts) + extractText(m) });
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
        const headText = mainText && !isClientArtifact(mainText) ? tsPrefix(m.ts) + mainText : null;
        apiMessages.push({ role: 'assistant', content: headText, tool_calls: toolCalls });
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
          if (tc.id === lastTodoResultId && todoAnnotation) content += todoAnnotation; // 投影标注：dismiss/烂尾
          const failNote = failRepeatAnnotation(failRepeatById.get(tc.id) || 0);
          if (failNote) content += failNote; // 失败模式重复标注（≥FAIL_REPEAT_MIN 才标，不限压缩区）
          apiMessages.push({ role: 'tool', content, tool_call_id: tc.id });
        }
      } else {
        // 空壳 assistant（纯思考/取消残留的零正文零工具消息）不进载荷——
        // 宽松端点容忍，严格端点（kimi）400「assistant must not be empty」（BAR-PROVIDER-02）。
        // 客户端产物占位符（[错误:…]/[未收到回复，请重试]）同样不进载荷：
        // 本地事故记录不是对话内容，上行会污染 AI 的「最近的自己」。
        if (mainText && !isClientArtifact(mainText)) {
          apiMessages.push({ role: 'assistant', content: tsPrefix(m.ts) + mainText });
        }
      }
    }
  }
  return { apiMessages, compactSaved };
}
