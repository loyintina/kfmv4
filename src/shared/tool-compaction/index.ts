/**
 * tool-compaction/index.ts — 工具 I/O 上下文压缩器注册表（v8.1.0）
 *
 * 契约：docs/design/TOOL_IO_COMPACTION.md —— 改压缩行为、增删工具前必须先读。
 * 本模块是纯函数、双端可用、零依赖（不 import 任何 DOM/Node API）。
 *
 * 哲学：会话文件是全量真相源（永不压缩），发给 LLM 的 apiMessages 是投影——
 * 「压缩证据，保留判决」「可寻址的丢失，不是遗忘」。压缩行必须确定性/幂等
 * （禁时间戳/随机数/会话 ID，G6），否则 prompt 缓存前缀全废。
 *
 * 机械执行：check-tool-compaction.mjs 用 COMPACTOR_REGISTRY 的键与
 * src/server/ai/tools/index.ts 的注册工具双向核对，失配 = 构建中断。
 */

// ========== 注册表 ==========

export interface CompactorEntry {
  /** 豁免依据（G2/G4 等）。有值 = 该工具不产压缩行，走通用规则豁免 */
  exempt?: string;
  /** 备注（豁免在调用层执行、走兜底等），不影响行为 */
  note?: string;
}

/**
 * 全部显式登记的工具名——每个注册工具必须有条目（豁免型也要，注明依据）。
 * 新增工具的 DoD：本注册表 + 文档第五节映射表同步更新（契约禁令 5）。
 */
export const COMPACTOR_REGISTRY: Record<string, CompactorEntry> = {
  bash: {},
  read: {},
  write: {},
  edit: {},
  grep: {},
  glob: {},
  todo: { note: 'G4「最新一个 todo 结果豁免」在调用层（orb-chat-run.ts）判断，压缩器只管产行' },
  web_search: {},
  debug: {},
  eval: {},
  browser_eval: {},
  browser: {},
  'kfm-logs': { note: '日志输出大但跨轮引用价值低、可重取，走 G7 兜底压缩器全压' },
  'kfm-snapshot': { exempt: 'G2：输出通常 ≤300 字符，压缩是负优化' },
  'kfm-exec': { exempt: 'G2：输出通常 ≤300 字符' },
  'kfm-restart': { exempt: 'G2：输出通常 ≤300 字符' },
  checkpoint: { exempt: 'G2：输出通常 ≤300 字符' },
  rewind: { exempt: 'G2：输出通常 ≤300 字符' },
};

/** 全部登记工具名（供 check-tool-compaction.mjs 与注册工具双向核对） */
export const COMPACTOR_NAMES: string[] = Object.keys(COMPACTOR_REGISTRY);

// ========== 工具函数 ==========

/** 截断到 max 字符（保留前半，超长追加省略号——确定性，G6 合规） */
function trunc(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + '…' : s;
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

// ========== 工具结果压缩 ==========

/**
 * 压缩工具结果为单行摘要。返回 null = 豁免不压（保留原文）；返回字符串 = 压缩行。
 * 通用规则（所有工具继承）：
 *   G2：结果 ≤300 字符不压（压缩行本身占 token，压了反而亏）
 *   G3：失败结果 ≤500 字符保留原文（错误信息往往正是后续诊断对象）
 *   G7：未登记工具走兜底压缩器（行为永不出错；check 会对未登记工具报红）
 * G1（最近 2 轮豁免）与 G4（最新 todo 豁免）在调用层判断，不在此函数内。
 */
export function compactToolResult(
  name: string,
  input: Record<string, unknown>,
  resultText: string,
  isError: boolean,
): string | null {
  if (resultText.length <= 300) return null; // G2
  if (isError && resultText.length <= 500) return null; // G3

  const lines = resultText.split('\n').length;
  switch (name) {
    case 'bash': {
      const cmd = trunc(str(input.command), 60);
      return `[bash: ${cmd} → ${isError ? '失败' : '成功'}，${lines}行输出已折叠]`;
    }
    case 'read': {
      // KB = 1000 字符（对齐契约示例：41,203 字符 → 41.2KB）
      const kb = (resultText.length / 1000).toFixed(1);
      return `[read ${str(input.path)} → ${kb}KB，可用 read 重读]`;
    }
    case 'write': {
      const content = str(input.content);
      const n = content ? content.split('\n').length : 0;
      return `[write ${str(input.path)} ${n}行]`;
    }
    case 'edit': {
      const a = num(input.lineStart);
      const b = num(input.lineEnd);
      const range = a !== null && b !== null ? ` 第${a}-${b}行` : '';
      return `[edit ${str(input.path)}${range}]`;
    }
    case 'grep': {
      // grep 输出每行一处匹配（path:line: text），末尾可能带「(结果被截断)」标记行
      const count = resultText.split('\n').filter(l => l !== '(结果被截断)').length;
      return `[grep ${str(input.pattern)} → ${count}处匹配，可重跑]`;
    }
    case 'glob':
      return `[glob ${str(input.pattern)} → ${lines}个文件]`;
    case 'todo': {
      const n = Array.isArray(input.todos) ? input.todos.length : 0;
      return `[todo 更新${n}项]`;
    }
    case 'web_search':
      return `[web_search ${trunc(str(input.query), 50)} → 结果已折叠]`;
    case 'debug':
      return `[debug ${str(input.action)} → 已折叠]`;
    case 'eval':
    case 'browser_eval':
      return `[eval ${trunc(str(input.code) || str(input.expression), 40)} → 已折叠]`;
    case 'browser':
      return `[browser ${str(input.action)}]`;
    default:
      return `[${name} → 输出${resultText.length}字符已折叠]`; // G7 兜底
  }
}

// ========== 工具入参压缩 ==========

/**
 * 压缩大入参（发给 API 的 tool_calls.arguments）。
 * 返回 null = 保留原 input；返回对象 = 压缩后的 arguments。
 * 只压 write（文件全文）与 edit（old/new 全文）——其余工具入参保留原文。
 * 小入参（JSON ≤300 字符）一律不压（与 G2 同理：占位本身也占 token）。
 */
export function compactToolInput(
  name: string,
  input: Record<string, unknown>,
): Record<string, unknown> | null {
  if (JSON.stringify(input).length <= 300) return null;
  switch (name) {
    case 'write': {
      const content = str(input.content);
      const n = content ? content.split('\n').length : 0;
      return { path: input.path, _compacted: `${n}行内容已折叠` };
    }
    case 'edit': {
      const a = num(input.lineStart);
      const b = num(input.lineEnd);
      const note = a !== null && b !== null ? `第${a}-${b}行编辑已折叠` : '编辑已折叠';
      return { path: input.path, _compacted: note };
    }
    default:
      return null;
  }
}
