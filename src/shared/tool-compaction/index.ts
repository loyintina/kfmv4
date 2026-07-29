/**
 * tool-compaction/index.ts — 工具 I/O 上下文压缩器注册表（v8.1.0）
 *
 * 契约：docs/domains/ai-chat/detail-tool-compaction.md —— 改压缩行为、增删工具前必须先读。
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

// ========== 跨调用标注（契约第九节）==========

/**
 * eval/browser_eval 代码描述符（结果行与入参折叠行共用，同词汇原则）：
 * 取首个非空行、去注释符（// # /* *）、trim、截 40——实测 13/31 首行是意图
 * 注释，其余首行代码本身有描述性（DOM 查询），100% 有值。
 */
function codeDescriptor(code: string): string {
  const first = (code.split('\n').find(l => l.trim()) || '').replace(/^\s*(?:\/\/+|#+|\/\*+|\*+)\s*/, '').trim();
  return trunc(first || code.trim(), 40);
}

/**
 * web_search 标题键（去重指纹，契约第九节）：提取 `N. 标题` 行原样 join。
 * 精确全等才判同（宁漏勿错，假阳性≈0）；**空键不参与比对**——失败/异常
 * 结果没有标题行，两个空键会互相误判「相同」。
 */
export function webTitleKey(resultText: string): string {
  return resultText.split('\n').filter(l => /^\d+\. /.test(l)).join('\n');
}

/** web_search 标题段展示版：每条截 30、`；` 连接、总截 120（G6 确定性截断） */
function webTitlesDisplay(resultText: string): string {
  const titles = webTitleKey(resultText).split('\n').filter(Boolean)
    .map(l => trunc(l.replace(/^\d+\.\s*/, ''), 30));
  return trunc(titles.join('；'), 120);
}

/**
 * 跨调用标注上下文——由调用层（orb-chat-run.ts）预扫描产出，压缩器保持纯函数。
 * 公理（契约第九节「标注层」）：宁漏勿错 / 决策相关性检验 / 只向后看
 * （旧压缩行永不因后续消息改变，prompt 缓存前缀稳定）。
 */
export interface CompactionCtx {
  /** read：同路径历史指纹（"行/字符" 串，按调用顺序） */
  readPrevFps?: string[];
  /** bash 重试弧线（同一归一化命令）：执行序 / 含本次连续失败数 / 本次成功前的连续失败数 */
  bashRetry?: { ordinal: number; failStreak: number; prevFailStreak: number };
  /** bash 环境故障：连续 n 次失败且最近 3 次为不同归一化命令（≥3 才标注） */
  bashEnvStreak?: number;
  /** write/edit：修改爆发状态（write+edit 成功调用合并计数，锚定真相源，见 compactToolInput 头注）。
   *  同一路径相邻两次成功修改相距 ≤MUT_BURST_GAP 轮 = 同一爆发期；超出则开新一轮，
   *  此时历史累计数降级为「再进入」背景——几轮内集中修改的计数才有时效性。 */
  mutBurst?: { burst: number; cum: number; reEntry: boolean };
  /** edit：该次替换涉及的行号区间（读 result.details.lineStart/lineEnd，编辑当时位置，
   *  后续编辑会使行号漂移——仅作当次定位，不代表当前文件状态）。 */
  editRange?: { start: number; end: number };
  /** web_search：此前各次搜索的标题键（webTitleKey，空键不入），用于重复搜索标注 */
  webPrevTitles?: string[];
}

/** mutBurst 判定阈值：相邻两次成功修改相距超过这么多轮 AI 消息即视为新一轮爆发（可调常量）。 */
export const MUT_BURST_GAP = 8;

/** todo 烂尾判定阈值：最后一次 todo 更新后超过这么多轮 AI 消息未再更新 = 可能已过时（可调常量）。 */
export const TODO_STALE_GAP = 10;

/** 失败模式重复标注的起始序号：第 2 次可能是合理重试，第 3 次才是「模式」（可调常量）。 */
export const FAIL_REPEAT_MIN = 3;

/**
 * 失败文本指纹（契约第九节「失败模式重复标注」）：取 trim 后前 100 字符精确匹配。
 * 守卫：无信息失败文本返回空串（不参与比对不入库）——`(未完成)`/`(退出码: N)`
 * 是不同命令的不同结局（实测 bash 失败 17/34 是 `(未完成)`），exact-match 会
 * 互相误判「相同错误」；<20 字符同理无鉴别力。
 */
export function errorFingerprint(text: string): string {
  const t = text.trim();
  if (t.length < 20) return '';
  if (/^\((未完成|已取消)\)$/.test(t) || /^\(退出码: \d+\)$/.test(t)) return '';
  return t.slice(0, 100);
}

/** 失败模式重复标注拼装（<FAIL_REPEAT_MIN → 空串）。只陈述事实，不开处方。 */
export function failRepeatAnnotation(n: number): string {
  return n >= FAIL_REPEAT_MIN ? `\n（第${n}次相同错误）` : '';
}

/**
 * todo 结果投影标注（契约第九节，只追加在最后一个 todo 结果上）。
 * 两条都是**只陈述事实、不做因果断言**（宁漏勿错）：
 * - dismissed：用户手动 ✕ 关闭面板——可能是任务结束，也可能只是嫌碍眼（用户原话），
 *   信号本身分不出来，所以只说「被关闭」，不替用户下「任务完成」的结论。
 * - 烂尾：超过 TODO_STALE_GAP 轮未更新——阈值式单调布尔（一旦为真恒真，
 *   标注行只翻转一次，prompt 缓存前缀稳定；直接标轮数会每轮变，不可接受）。
 */
export function todoResultAnnotation(opts: { dismissed: boolean; aiRoundsAfter: number }): string {
  let a = '';
  if (opts.dismissed) a += '\n（面板已被用户手动关闭）';
  if (opts.aiRoundsAfter >= TODO_STALE_GAP) a += `\n（此后超过${TODO_STALE_GAP}轮未更新，可能已过时）`;
  return a;
}

/**
 * bash 命令归一化语法（契约第九节，四条规则，改规则先改文档）：
 *   1. 截断 | 管道尾（tail/head 是展示层，不改命令意图）
 *   2. 去 2>&1 重定向
 *   3. 按 && / ; 切段，丢弃 cd / export / time 前缀段，取第一个实质段（带参数）
 *   4. 折叠多余空白
 * 原则：宁漏勿错——语义等价但写法不同的命令（npm test vs npm run test）宁可漏标。
 */
export function normalizeBashCommand(cmd: string): string {
  const noPipe = String(cmd || '').split('|')[0] ?? '';
  const noRedir = noPipe.replace(/2>&1/g, '');
  const segs = noRedir.split(/&&|;/).map(s => s.trim()).filter(s => s && !/^(cd|export)\s/.test(s));
  return (segs[0] || '').replace(/^time\s+/, '').replace(/\s+/g, ' ').trim();
}

/** bash 重试弧线/环境故障标注拼装（无 ctx 或无信号 → 空串） */
function bashAnnotation(isError: boolean, ctx?: CompactionCtx): string {
  const r = ctx?.bashRetry;
  if (r && r.ordinal >= 2) {
    let a = `（第${r.ordinal}次执行`;
    if (isError && r.failStreak >= 2) a += `，连续${r.failStreak}次失败`;
    else if (!isError && r.prevFailStreak >= 1) a += `，此前连续${r.prevFailStreak}次失败`;
    return a + '）';
  }
  if (isError && (ctx?.bashEnvStreak ?? 0) >= 3) {
    return `（连续${ctx?.bashEnvStreak}次失败均为不同命令——疑似环境问题）`;
  }
  return '';
}

// ========== 工具结果压缩 ==========

/**
 * 压缩工具结果为单行摘要。返回 null = 豁免不压（保留原文）；返回字符串 = 压缩行。
 * 通用规则（所有工具继承）：
 *   G2：结果 ≤300 字符不压（压缩行本身占 token，压了反而亏）
 *   G3：失败结果 ≤500 字符保留原文（错误信息往往正是后续诊断对象）
 *   G7：未登记工具走兜底压缩器（行为永不出错；check 会对未登记工具报红）
 * G1（最近 2 轮豁免）与 G4（最新 todo 豁免）在调用层判断，不在此函数内。
 * ctx：跨调用标注上下文（可选，契约第九节）。
 */
export function compactToolResult(
  name: string,
  input: Record<string, unknown>,
  resultText: string,
  isError: boolean,
  ctx?: CompactionCtx,
): string | null {
  if (resultText.length <= 300) return null; // G2
  if (isError && resultText.length <= 500) return null; // G3

  const lines = resultText.split('\n').length;
  switch (name) {
    case 'bash': {
      const cmd = trunc(str(input.command), 60);
      const anno = bashAnnotation(isError, ctx);
      if (!isError) {
        // 关键指标提取（白名单制，契约第九节）：只认跨工具通用的测试结果模式，
        // 不认就不提取——绝不为各种输出格式维护专属解析器。
        const m = resultText.match(/\d+ passed, \d+ failed/);
        const metrics = m ? `（${m[0]}）` : '';
        return `[bash: ${cmd} → 成功，${lines}行输出已折叠${metrics}${anno}]`;
      }
      // 失败 = 诊断证据（重跑可能昂贵/有副作用/不可复现）：确定性保留尾部 200 字符
      // （stderr 惯例错误信息在末尾）。换行压为 ⏎——压缩行单行契约不可破坏。
      const tail = resultText.slice(-200).replace(/\n/g, '⏎');
      return `[bash: ${cmd} → 失败，${lines}行输出已折叠，尾部: …${tail}]${anno}`;
    }
    case 'read': {
      // 指纹对（行数+字符数）：同一路径两条压缩行指纹不同 = 两次读取之间文件被修改，
      // AI 看历史即可推断——LLM 不会自发对比元数据，显式提示才会进思考链。
      // 截断标记：read 工具 >100KB 截断/采样时结果自带标记（omp/read.ts），
      // 必须透传——否则 AI 误以为自己看过全文。
      let note = '';
      if (resultText.includes('仅显示前')) note = '，原读取截断未看全';
      else if (resultText.includes('采样 (前 ')) note = '，采样读取未看全';
      // 去重/回退标注（ctx 驱动）：指纹是证据，标注是结论——省去 AI 跨行比对
      const fp = `${lines}行/${resultText.length}字符`;
      let dup = '';
      const prev = ctx?.readPrevFps;
      if (prev && prev.length > 0) {
        const idx = prev.lastIndexOf(fp);
        if (idx === prev.length - 1) dup = '，内容与上方读取相同';
        else if (idx >= 0) dup = `，内容回退到第${idx + 1}次读取时的状态`;
        else dup = '，内容与上方读取不同（文件已被修改）';
      }
      return `[read ${str(input.path)} → ${fp}${note}${dup}，可用 read 重读]`;
    }
    case 'write': {
      const content = str(input.content);
      const n = content ? content.split('\n').length : 0;
      // 指纹对与 read 同词汇：write 时指纹 ≠ 后来 read 时指纹 = 写后被修改（跨工具指纹链）
      return `[write ${str(input.path)} → ${n}行/${content.length}字符已写入]`;
    }
    case 'edit': {
      // 真实 schema（omp/edit.ts）：input.old / input.new，无行号——行号读 ctx.editRange
      // （来自 result.details.lineStart/lineEnd，真相源数据；无则省略）。
      // diff-stat 形状自带故事：-0/+12=纯新增，-15/+0=纯删除，-30/+3=大幅简化（心法 18）。
      const oldLines = str(input.old) ? str(input.old).split('\n').length : 0;
      const newLines = str(input.new) ? str(input.new).split('\n').length : 0;
      const range = ctx?.editRange ? ` 第${ctx.editRange.start}-${ctx.editRange.end}行` : '';
      return `[edit ${str(input.path)}${range} → -${oldLines}/+${newLines}行]`;
    }
    case 'grep': {
      // grep 输出每行一处匹配（path:line: text），末尾可能带「(结果被截断)」标记行
      // 「未看全」透传（契约第九节）：截断时 count 不全，必须显式标注
      // 参数标注规则（契约第九节）：影响结果语义的非默认参数进压缩行——
      // path（实测 27/27 显式传，不带则无法区分搜索覆盖范围）；
      // ignoreCase（同 pattern 大小写敏感与否计数不同）。maxCount 不标（可推断）。
      const truncated = resultText.includes('(结果被截断)');
      const count = resultText.split('\n').filter(l => l !== '(结果被截断)').length;
      const at = str(input.path) ? ` @ ${str(input.path)}` : '';
      const ic = input.ignoreCase ? '（忽略大小写）' : '';
      return `[grep ${str(input.pattern)}${at}${ic} → ${count}${truncated ? '+' : ''}处匹配${truncated ? '（结果被截断）' : ''}，可重跑]`;
    }
    case 'glob': {
      // 截断透传（BAR-COMPACT-03 起工具侧带标记行）：顶格时 count 不全，必须显式
      // 参数标注规则同 grep：path 影响覆盖范围；hidden 影响结果集（含隐藏文件）。
      const truncated = resultText.includes('(结果被截断)');
      const count = resultText.split('\n').filter(l => l.trim() && l !== '(结果被截断)').length;
      const at = str(input.path) ? ` @ ${str(input.path)}` : '';
      const hid = input.hidden ? '（含隐藏）' : '';
      return `[glob ${str(input.pattern)}${at}${hid} → ${count}${truncated ? '+' : ''}个文件${truncated ? '（结果被截断）' : ''}]`;
    }
    case 'todo': {
      const n = Array.isArray(input.todos) ? input.todos.length : 0;
      return `[todo 更新${n}项]`;
    }
    case 'web_search': {
      // 留判决不留证据：标题清单=「找到了什么来源」（占输出仅 12-23%），
      // snippet 正文=证据，折叠可重搜（可寻址的丢失）。
      // 重复搜索标注（ctx）：标题键精确全等才判同（换措辞同结果=搜索空间饱和，
      // 打断搜索循环）；空键不参与（失败结果无标题行，两空键会误判）。
      const key = webTitleKey(resultText);
      const dup = key && (ctx?.webPrevTitles || []).includes(key) ? '（结果与上方搜索相同）' : '';
      const titles = webTitlesDisplay(resultText);
      const n = key ? key.split('\n').length : 0;
      if (!titles) return `[web_search ${trunc(str(input.query), 50)} → 结果已折叠，可重搜]${dup}`;
      return `[web_search ${trunc(str(input.query), 50)} → ${n}条：${titles}，正文已折叠，可重搜]${dup}`;
    }
    case 'debug':
      return `[debug ${str(input.action)} → 已折叠]`;
    case 'eval':
    case 'browser_eval':
      // codeDescriptor 与入参折叠行同词汇（首行清理版，非 raw 前 40 字符）
      return `[eval ${codeDescriptor(str(input.code) || str(input.expression))} → 已折叠]`;
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
 * 压 write（文件全文）、edit（old/new 全文）、eval/browser_eval（代码）——
 * 其余工具入参保留原文。
 * 小入参（JSON ≤300 字符）一律不压（与 G2 同理：占位本身也占 token）。
 * 失败调用入参 ≤500 字符不压（与 G3 同理：失败 edit 的 old/new 正是诊断对象）。
 * ctx.mutBurst：修改爆发状态（write+edit 合并计数，锚定真相源——从全量会话文件
 * 预扫描，与投影窗口无关，未来上下文压缩不影响计数）。只计成功调用（失败 edit
 * 什么都没改）。相邻两次成功修改相距 >MUT_BURST_GAP 轮 = 新一轮爆发，历史累计
 * 降级为再进入背景（几轮内集中修改的计数才有时效性）。
 */
export function compactToolInput(
  name: string,
  input: Record<string, unknown>,
  isError = false,
  ctx?: CompactionCtx,
): Record<string, unknown> | null {
  const jsonLen = JSON.stringify(input).length;
  if (jsonLen <= 300) return null;
  if (isError && jsonLen <= 500) return null;
  const mb = !isError ? ctx?.mutBurst : undefined;
  const mut = mb?.reEntry
    ? `（重新进入修改，此前共${mb.cum - 1}次）`
    : mb && mb.burst >= 2 ? `（本轮第${mb.burst}次修改）` : '';
  switch (name) {
    case 'write': {
      const content = str(input.content);
      const n = content ? content.split('\n').length : 0;
      return { path: input.path, _compacted: `${n}行/${content.length}字符内容已折叠${mut}` };
    }
    case 'edit': {
      const oldLines = str(input.old) ? str(input.old).split('\n').length : 0;
      const newLines = str(input.new) ? str(input.new).split('\n').length : 0;
      const range = ctx?.editRange ? `第${ctx.editRange.start}-${ctx.editRange.end}行 ` : '';
      return { path: input.path, _compacted: `编辑已折叠: ${range}-${oldLines}/+${newLines}行${mut}` };
    }
    case 'eval':
    case 'browser_eval': {
      // 入参代码是载荷（实测 med 323 字符，17/31 >300，最大 1327）：一次性
      // 探针/计算，价值在结果不在代码。折叠留首行描述（注释优先、代码行兜底）。
      // eval 的 language 透传（js/py 语义不同）；browser_eval 无此字段。
      const code = str(input.code) || str(input.expression);
      if (!code) return null; // 无代码输入折叠无意义
      return {
        ...(typeof input.language === 'string' ? { language: input.language } : {}),
        _compacted: `代码已折叠: ${codeDescriptor(code)}`,
      };
    }
    default:
      return null;
  }
}
