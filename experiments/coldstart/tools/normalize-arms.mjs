#!/usr/bin/env node
/**
 * normalize-arms.mjs — 冷启动多臂实验数据归一化器
 *
 * 读取 /root/.kfmv4/experiments/coldstart/sessions/ 下 124 份原始答卷
 * （kfmv4 面板 .json / kimi-code / opencode / oh-my-pi / qoder 四类 .jsonl），
 * 归一为统一格式，输出到 /root/.kfmv4/experiments/coldstart/derived/：
 *   - arms.json            全量元数据数组（每臂一条）
 *   - transcripts/<armId>.md  统一时间线成绩单（供判卷子代理阅读）
 *
 * 零依赖（仅 node 标准库），幂等：重复运行覆盖输出。
 * 对坏行/缺字段容错：记 parseWarnings 继续，不炸整批。
 */
import { readFileSync, readdirSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';

const SRC = '/root/.kfmv4/experiments/coldstart/sessions';
const OUT = '/root/.kfmv4/experiments/coldstart/derived';
const TRANSCRIPT_DIR = join(OUT, 'transcripts');

const EXPECTED_ARMS = 124;
const SOFT_CAP = 80_000; // transcript 单文件软上限（字节）
const THINKING_LIMIT = 1000;
const INPUT_LIMIT = 200;

// ---------------------------------------------------------------- 工具函数

function trunc(s, n) {
  if (s == null) return '';
  s = String(s);
  return s.length <= n ? s : s.slice(0, n) + `… [truncated, 原长度 ${s.length}]`;
}

function toIso(v) {
  if (v == null) return null;
  if (typeof v === 'number') {
    // epoch 毫秒（本实验时间戳均 > 1e12）
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function toMs(v) {
  const iso = toIso(v);
  return iso ? Date.parse(iso) : null;
}

/** 工具名分类：write / unknown（bash 类）/ read（其他）。todo 类待办工具非文件写，排除。 */
function toolKind(name) {
  const n = String(name || '').toLowerCase();
  if (/(^|_)(bash|shell|terminal|exec|powershell|cmd|run_command)/.test(n)) return 'unknown';
  if (/todo/.test(n)) return 'read';
  if (/write|edit|patch|apply|create|delete|rename|move|mkdir|notebook/.test(n)) return 'write';
  return 'read';
}

/** 从工具 input 提取关键参数，做一行式摘要 */
function inputSummary(input) {
  if (input == null) return '';
  let s = '';
  if (typeof input === 'object' && !Array.isArray(input)) {
    const keys = ['path', 'filePath', 'file_path', 'pattern', 'command', 'query', 'url', 'content'];
    const picked = [];
    for (const k of keys) {
      if (input[k] != null) picked.push(`${k}=${JSON.stringify(String(input[k]))}`);
      if (picked.length >= 2) break;
    }
    s = picked.length ? picked.join(' ') : JSON.stringify(input);
  } else {
    s = typeof input === 'string' ? input : JSON.stringify(input);
  }
  return trunc(s.replace(/\s+/g, ' ').trim(), INPUT_LIMIT);
}

function safeJsonParse(line) {
  try { return JSON.parse(line); } catch { return null; }
}

function parseJsonl(file, warn) {
  const raw = readFileSync(file, 'utf8');
  const lines = raw.split('\n').filter((l) => l.trim() !== '');
  const rows = [];
  lines.forEach((line, i) => {
    const d = safeJsonParse(line);
    if (d == null) warn(`第 ${i + 1} 行 JSON 解析失败，已跳过`);
    else rows.push(d);
  });
  return rows;
}

/** 从文件名解析模型名（去 harness 前缀和扩展名） */
function modelFromFilename(armId) {
  return armId.replace(/^(kimicode|qoderclicn|oc|omp)-/, '');
}

/** 文本数组拼接：content 可能是 string 或 [{type:'text',text}] */
function joinText(content) {
  if (content == null) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((c) => (typeof c === 'string' ? c : c?.text ?? ''))
      .filter(Boolean)
      .join('\n');
  }
  return '';
}

// ---------------------------------------------------------------- 事件模型
// event = { kind: 'user'|'ai'|'tool'|'result', tsMs,
//           text, reasoning, name, input, isError }

function makeArm(armId, file, harness) {
  const warnings = [];
  return {
    armId, file, harness, warnings,
    model: null, provider: null, role: null,
    createdAtMs: null, updatedAtMs: null,
    events: [],
    warn(msg) { this.warnings.push(msg); },
    ev(e) { this.events.push(e); },
  };
}

// ---------------------------------------------------------------- 解析器：kfmv4 面板 (.json)

function parsePanel(arm) {
  let obj;
  try {
    obj = JSON.parse(readFileSync(join(SRC, arm.file), 'utf8'));
  } catch (e) {
    arm.warn(`整文件 JSON 解析失败: ${e.message}`);
    return;
  }
  arm.model = obj.modelId ?? null;
  arm.provider = obj.providerId ?? null;
  arm.createdAtMs = toMs(obj.createdAt);
  arm.updatedAtMs = toMs(obj.updatedAt);
  // role 仅从 kfmv4_test_* 命名规律解析
  const m = arm.armId.match(/^kfmv4[_-]test[_-].+?(-weiran-kfmv4|-weiran|-kfmdocs-only)?$/);
  if (m) arm.role = m[1] ? m[1].slice(1) : 'kfm-dev';

  const messages = Array.isArray(obj.messages) ? obj.messages : [];
  if (!Array.isArray(obj.messages)) arm.warn('缺少 messages 数组');
  for (const msg of messages) {
    const tsMs = toMs(msg.ts);
    const content = Array.isArray(msg.content) ? msg.content : [];
    if (msg.role === 'user') {
      arm.ev({ kind: 'user', tsMs, text: joinText(content) });
    } else if (msg.role === 'ai') {
      for (const part of content) {
        if (part?.type === 'text') {
          arm.ev({ kind: 'ai', tsMs, text: part.text ?? '', reasoning: part.reasoning || null });
        } else if (part?.type === 'tool') {
          arm.ev({ kind: 'tool', tsMs, name: part.name, input: part.input });
          arm.ev({
            kind: 'result', tsMs, name: part.name,
            text: joinText(part.result?.content),
            isError: !!part.result?.isError,
          });
        }
      }
    }
  }
}

// ---------------------------------------------------------------- 解析器：kimi-code (wire protocol 1.4)

function parseKimiCode(arm) {
  const rows = parseJsonl(join(SRC, arm.file), (w) => arm.warn(w));
  const toolCallNames = new Map(); // toolCallId -> 工具名（tool.result 事件本身不带 name）
  let fallbackPrompt = null;
  for (const d of rows) {
    const tsMs = typeof d.time === 'number' ? d.time : null;
    switch (d.type) {
      case 'metadata':
        arm.createdAtMs = d.created_at ?? null;
        break;
      case 'llm.request':
        if (arm.model == null && d.model) arm.model = d.model;
        if (arm.provider == null && d.provider) arm.provider = d.provider;
        break;
      case 'turn.prompt':
        fallbackPrompt = joinText(d.input);
        break;
      case 'context.append_message': {
        const msg = d.message;
        if (msg?.role === 'user') arm.ev({ kind: 'user', tsMs, text: joinText(msg.content) });
        else if (msg?.role === 'assistant') arm.ev({ kind: 'ai', tsMs, text: joinText(msg.content) });
        break;
      }
      case 'context.append_loop_event': {
        const e = d.event;
        if (!e) break;
        if (e.type === 'content.part' && e.part) {
          if (e.part.type === 'text') arm.ev({ kind: 'ai', tsMs, text: e.part.text ?? '' });
          else if (e.part.type === 'think') arm.ev({ kind: 'ai', tsMs, text: '', reasoning: e.part.think ?? '' });
        } else if (e.type === 'tool.call') {
          if (e.toolCallId) toolCallNames.set(e.toolCallId, e.name);
          arm.ev({ kind: 'tool', tsMs, name: e.name, input: e.args });
        } else if (e.type === 'tool.result') {
          const r = e.result;
          arm.ev({
            kind: 'result', tsMs, name: toolCallNames.get(e.toolCallId) ?? null,
            text: typeof r?.output === 'string' ? r.output : JSON.stringify(r ?? ''),
            isError: !!(r?.isError || r?.is_error),
          });
        }
        break;
      }
    }
  }
  if (!arm.events.some((e) => e.kind === 'user') && fallbackPrompt) {
    arm.ev({ kind: 'user', tsMs: arm.createdAtMs, text: fallbackPrompt });
    arm.warn('无 context.append_message 用户消息，回退使用 turn.prompt');
  }
  if (arm.model == null) {
    arm.model = modelFromFilename(arm.armId);
    arm.warn('数据中无模型信息，模型名取自文件名');
  }
}

// ---------------------------------------------------------------- 解析器：opencode

function parseOpencode(arm) {
  const rows = parseJsonl(join(SRC, arm.file), (w) => arm.warn(w));
  const msgMeta = new Map(); // message id -> {role, tsMs, model, provider}

  const applySessionModel = (raw) => {
    if (!raw || raw === 'None' || raw === 'None/None') return;
    const [provider, ...rest] = String(raw).split('/');
    if (rest.length) {
      if (arm.model == null) arm.model = rest.join('/');
      if (arm.provider == null) arm.provider = provider;
    } else if (arm.model == null) arm.model = raw;
  };

  for (const d of rows) {
    if (d._kind === 'session') {
      applySessionModel(d.model);
    } else if (d._kind === 'message') {
      // 新式：message 元数据行
      const data = d.data ?? {};
      const tsMs = data.time?.created ?? null;
      msgMeta.set(d.id, { role: data.role, tsMs });
      if (arm.createdAtMs == null && tsMs != null) arm.createdAtMs = tsMs;
      if (data.model) applySessionModel(`${data.model.providerID}/${data.model.modelID}`);
      else if (data.modelID) applySessionModel(`${data.providerID ?? ''}/${data.modelID}`);
    } else if (d._kind === 'part') {
      // 新式：part 行，挂到 message_id
      const data = d.data ?? {};
      const meta = msgMeta.get(d.message_id) ?? {};
      const tsMs = data.time?.start ?? meta.tsMs ?? null;
      if (data.type === 'text') {
        const kind = meta.role === 'user' ? 'user' : 'ai';
        arm.ev({ kind, tsMs, text: data.text ?? '' });
      } else if (data.type === 'reasoning') {
        arm.ev({ kind: 'ai', tsMs, text: '', reasoning: data.text ?? '' });
      } else if (data.type === 'tool') {
        const st = data.state ?? {};
        arm.ev({ kind: 'tool', tsMs, name: data.tool, input: st.input });
        arm.ev({
          kind: 'result', tsMs: data.time?.end ?? tsMs, name: data.tool,
          text: typeof st.output === 'string' ? st.output : JSON.stringify(st.output ?? ''),
          isError: st.status === 'error',
        });
      }
      // step-start / step-finish 忽略
    } else if (Array.isArray(d.parts)) {
      // 旧式：{id, ts, parts:[{role, text?, tool?, input?, output?}]}
      const tsMs = d.ts ?? null;
      if (arm.createdAtMs == null && tsMs != null) arm.createdAtMs = tsMs;
      for (const p of d.parts) {
        if (p.role === 'user') arm.ev({ kind: 'user', tsMs, text: p.text ?? '' });
        else if (p.role === 'assistant') arm.ev({ kind: 'ai', tsMs, text: p.text ?? '' });
        else if (p.role === 'thinking') arm.ev({ kind: 'ai', tsMs, text: '', reasoning: p.text ?? '' });
        else if (p.role === 'tool') {
          arm.ev({ kind: 'tool', tsMs, name: p.tool, input: p.input });
          arm.ev({ kind: 'result', tsMs, name: p.tool, text: typeof p.output === 'string' ? p.output : JSON.stringify(p.output ?? ''), isError: false });
        }
      }
    }
  }
  if (arm.model == null) {
    arm.model = modelFromFilename(arm.armId);
    arm.warn('session 行无有效 model 字段，模型名取自文件名');
  }
}

// ---------------------------------------------------------------- 解析器：oh-my-pi (omp)

function parseOmp(arm) {
  const rows = parseJsonl(join(SRC, arm.file), (w) => arm.warn(w));
  const modelChanges = new Set();
  for (const d of rows) {
    const tsMs = toMs(d.timestamp);
    switch (d.type) {
      case 'session':
        if (arm.createdAtMs == null) arm.createdAtMs = tsMs;
        break;
      case 'model_change':
        if (d.model) modelChanges.add(d.model);
        break;
      case 'message': {
        const msg = d.message ?? {};
        if (msg.role === 'user') {
          arm.ev({ kind: 'user', tsMs, text: joinText(msg.content) });
        } else if (msg.role === 'assistant') {
          const content = Array.isArray(msg.content) ? msg.content : [];
          let reasoning = null;
          for (const c of content) {
            if (c?.type === 'thinking') reasoning = (reasoning ?? '') + (reasoning ? '\n' : '') + (c.thinking ?? '');
            else if (c?.type === 'text') arm.ev({ kind: 'ai', tsMs, text: c.text ?? '', reasoning });
            else if (c?.type === 'toolCall') arm.ev({ kind: 'tool', tsMs, name: c.name, input: c.arguments ?? safeJsonParse(c.partialArgs ?? 'null') });
          }
          if (reasoning != null && !content.some((c) => c?.type === 'text')) {
            arm.ev({ kind: 'ai', tsMs, text: '', reasoning });
          }
        } else if (msg.role === 'toolResult') {
          arm.ev({
            kind: 'result', tsMs, name: msg.toolName ?? null,
            text: joinText(msg.content),
            isError: !!msg.isError,
          });
        }
        break;
      }
    }
  }
  if (modelChanges.size > 0) {
    const last = [...modelChanges][modelChanges.size - 1];
    const [provider, ...rest] = last.split('/');
    arm.model = rest.join('/') || last;
    arm.provider = rest.length ? provider : null;
    if (modelChanges.size > 1) arm.warn(`出现多个 model_change: ${[...modelChanges].join(', ')}，取最后一个`);
  } else {
    arm.model = modelFromFilename(arm.armId);
    arm.warn('无 model_change 事件，模型名取自文件名');
  }
}

// ---------------------------------------------------------------- 解析器：qoder (claude-code 风格 jsonl)

function parseQoder(arm) {
  const rows = parseJsonl(join(SRC, arm.file), (w) => arm.warn(w));
  const toolNames = new Map(); // tool_use id -> name
  for (const d of rows) {
    const tsMs = toMs(d.timestamp);
    if (arm.createdAtMs == null && tsMs != null) arm.createdAtMs = tsMs;
    const msg = d.message;
    if (d.type === 'user' && msg) {
      const content = msg.content;
      if (typeof content === 'string') {
        arm.ev({ kind: 'user', tsMs, text: content });
      } else if (Array.isArray(content)) {
        for (const c of content) {
          if (c?.type === 'text') arm.ev({ kind: 'user', tsMs, text: c.text ?? '' });
          else if (c?.type === 'tool_result') {
            arm.ev({
              kind: 'result', tsMs,
              name: toolNames.get(c.tool_use_id) ?? null,
              text: joinText(c.content),
              isError: !!c.is_error,
            });
          }
        }
      }
    } else if (d.type === 'assistant' && msg) {
      const content = Array.isArray(msg.content) ? msg.content : [];
      let reasoning = null;
      for (const c of content) {
        if (c?.type === 'thinking') reasoning = (reasoning ?? '') + (reasoning ? '\n' : '') + (c.thinking ?? '');
        else if (c?.type === 'text') arm.ev({ kind: 'ai', tsMs, text: c.text ?? '', reasoning });
        else if (c?.type === 'tool_use') {
          toolNames.set(c.id, c.name);
          arm.ev({ kind: 'tool', tsMs, name: c.name, input: c.input });
        }
      }
      if (reasoning != null && !content.some((c) => c?.type === 'text')) {
        arm.ev({ kind: 'ai', tsMs, text: '', reasoning });
      }
    }
    // runtime-config 中的 model 是内部别名（如 gm51model），不采用
  }
  arm.model = modelFromFilename(arm.armId);
  arm.provider = null;
  arm.warn('数据中 model 字段为内部别名，模型名取自文件名');
}

// ---------------------------------------------------------------- transcript 渲染

function renderTranscript(arm, stats, resultLimit, thinkingLimit = THINKING_LIMIT) {
  const L = [];
  L.push(`# 冷启动实验成绩单：${arm.armId}`);
  L.push('');
  L.push(`- **harness**: ${arm.harness}`);
  L.push(`- **model**: ${arm.model ?? 'unknown'}${arm.provider ? ` (provider: ${arm.provider})` : ''}`);
  if (arm.role) L.push(`- **role**: ${arm.role}`);
  L.push(`- **createdAt**: ${arm.createdAtMs ? new Date(arm.createdAtMs).toISOString() : 'unknown'}`);
  L.push(`- **时长**: ${(stats.durationMs / 1000).toFixed(0)}s | **消息数**: ${stats.messageCount} | **工具调用**: ${stats.toolCalls.total}（writes: ${stats.toolCalls.writes}）`);
  L.push('');
  L.push('---');
  L.push('');
  L.push('## 时间线');
  L.push('');

  let seq = 0;
  let toolSeq = 0;
  let finalText = null;
  for (const e of arm.events) {
    if (e.kind === 'ai' && e.text && e.text.trim()) finalText = e.text; // 最后一条 AI 正文
  }

  for (const e of arm.events) {
    const ts = e.tsMs ? new Date(e.tsMs).toISOString().slice(11, 19) : '--:--:--';
    if (e.kind === 'user') {
      seq++;
      L.push(`### [U${seq}] 用户 · ${ts}`);
      L.push('');
      L.push(e.text || '_(空)_');
      L.push('');
    } else if (e.kind === 'ai') {
      // 纯 reasoning 且无正文的单独事件也保留
      seq++;
      L.push(`### [A${seq}] AI · ${ts}`);
      L.push('');
      if (e.reasoning) {
        for (const line of trunc(e.reasoning, thinkingLimit).split('\n')) L.push(`> [thinking] ${line}`);
        L.push('');
      }
      if (e.text && e.text.trim()) L.push(e.text);
      else if (!e.reasoning) L.push('_(无正文)_');
      L.push('');
    } else if (e.kind === 'tool') {
      toolSeq++;
      const summary = inputSummary(e.input);
      L.push(`- **[T${toolSeq}]** \`${e.name ?? '?'}\`${summary ? ` — ${summary}` : ''}`);
    } else if (e.kind === 'result') {
      const body = trunc(e.text ?? '', resultLimit);
      L.push(`  - ${e.isError ? '⚠️ 错误' : '结果'}${e.name ? ` (${e.name})` : ''}:`);
      L.push('    ```');
      for (const line of body.split('\n')) L.push(`    ${line}`);
      L.push('    ```');
    }
  }

  L.push('');
  L.push('---');
  L.push('');
  L.push('## 最终报告（全文）');
  L.push('');
  if (finalText != null) {
    L.push(finalText);
  } else {
    L.push('_(该臂无 AI 正文最终报告)_');
  }
  L.push('');
  return L.join('\n');
}

// ---------------------------------------------------------------- 统计汇总

function computeStats(arm) {
  const toolEvents = arm.events.filter((e) => e.kind === 'tool');
  const byName = {};
  let writes = 0;
  for (const t of toolEvents) {
    const name = String(t.name ?? 'unknown');
    byName[name] = (byName[name] ?? 0) + 1;
    if (toolKind(name) === 'write') writes++;
  }
  const tsList = arm.events.map((e) => e.tsMs).filter((v) => v != null);
  let durationMs = tsList.length >= 2 ? Math.max(...tsList) - Math.min(...tsList) : 0;
  if (durationMs === 0 && arm.createdAtMs != null && arm.updatedAtMs != null) {
    durationMs = Math.max(0, arm.updatedAtMs - arm.createdAtMs);
  }
  const messageCount = arm.events.filter((e) => e.kind === 'user' || (e.kind === 'ai' && e.text && e.text.trim())).length;
  let finalReportChars = 0;
  for (const e of arm.events) {
    if (e.kind === 'ai' && e.text && e.text.trim()) finalReportChars = e.text.length;
  }
  return {
    durationMs,
    messageCount,
    toolCalls: { total: toolEvents.length, byName, writes },
    readOnly: writes === 0,
    finalReportChars,
  };
}

// ---------------------------------------------------------------- 主流程

function main() {
  mkdirSync(TRANSCRIPT_DIR, { recursive: true });
  rmSync(TRANSCRIPT_DIR, { recursive: true, force: true });
  mkdirSync(TRANSCRIPT_DIR, { recursive: true });

  const files = readdirSync(SRC).filter((f) => f.endsWith('.json') || f.endsWith('.jsonl')).sort();
  const arms = [];
  const failures = [];

  for (const file of files) {
    const armId = basename(file).replace(/\.jsonl?$/, '');
    let harness;
    if (file.endsWith('.json')) harness = 'kfmv4-panel';
    else if (file.startsWith('kimicode-')) harness = 'kimi-code';
    else if (file.startsWith('oc-')) harness = 'opencode';
    else if (file.startsWith('omp-')) harness = 'omp';
    else if (file.startsWith('qoderclicn-')) harness = 'qoder';
    else harness = 'unknown';

    const arm = makeArm(armId, file, harness);
    try {
      switch (harness) {
        case 'kfmv4-panel': parsePanel(arm); break;
        case 'kimi-code': parseKimiCode(arm); break;
        case 'opencode': parseOpencode(arm); break;
        case 'omp': parseOmp(arm); break;
        case 'qoder': parseQoder(arm); break;
        default:
          arm.warn('无法识别的 harness（文件名前缀不匹配）');
      }
    } catch (e) {
      arm.warn(`解析器异常: ${e.message}`);
      failures.push(armId);
    }

    const stats = computeStats(arm);

    // transcript：软上限 80KB，超限则逐级加大对工具结果与 thinking 的截断力度（最终报告永不截断）
    let truncated = false;
    let md = renderTranscript(arm, stats, 2000);
    for (const [rLimit, tLimit] of [[600, 1000], [200, 300], [200, 100]]) {
      if (Buffer.byteLength(md, 'utf8') <= SOFT_CAP) break;
      truncated = true;
      md = renderTranscript(arm, stats, rLimit, tLimit);
    }
    writeFileSync(join(TRANSCRIPT_DIR, `${armId}.md`), md);

    arms.push({
      armId,
      file: arm.file,
      harness: arm.harness,
      model: arm.model,
      provider: arm.provider,
      role: arm.role,
      createdAt: arm.createdAtMs ? new Date(arm.createdAtMs).toISOString() : null,
      durationMs: stats.durationMs,
      messageCount: stats.messageCount,
      toolCalls: stats.toolCalls,
      readOnly: stats.readOnly,
      finalReportChars: stats.finalReportChars,
      truncated,
      parseWarnings: arm.warnings,
    });
  }

  writeFileSync(join(OUT, 'arms.json'), JSON.stringify(arms, null, 2) + '\n');

  // ---------------- 汇总表 ----------------
  const byHarness = {};
  for (const a of arms) {
    byHarness[a.harness] ??= { count: 0, warnings: 0 };
    byHarness[a.harness].count++;
    if (a.parseWarnings.length > 0) byHarness[a.harness].warnings++;
  }
  console.log('\n=== 归一化汇总 ===');
  console.log('harness        臂数   有警告臂数');
  for (const [h, s] of Object.entries(byHarness).sort()) {
    console.log(`${h.padEnd(14)} ${String(s.count).padStart(4)}   ${String(s.warnings).padStart(6)}`);
  }
  console.log(`解析器异常臂数: ${failures.length}${failures.length ? ' -> ' + failures.join(', ') : ''}`);
  console.log(`总臂数: ${arms.length}（期望 ${EXPECTED_ARMS}）`);
  const ro = arms.filter((a) => a.readOnly).length;
  console.log(`readOnly: ${ro} 只读 / ${arms.length - ro} 有写入`);
  console.log(`输出: ${OUT}/arms.json + ${TRANSCRIPT_DIR}/ (${arms.length} 份)`);

  if (arms.length !== EXPECTED_ARMS) {
    console.error(`\n错误：总臂数 ${arms.length} != ${EXPECTED_ARMS}`);
    process.exit(1);
  }
}

main();
