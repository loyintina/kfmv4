// ==========================================================================
// tests/tool-compaction.test.ts — 工具 I/O 上下文压缩器行为测试（v8.1.0）
//
// 契约：docs/design/TOOL_IO_COMPACTION.md。覆盖：
//   1. 第五节逐工具映射表——每个登记工具至少一个用例，压缩行逐字符相等
//   2. 通用规则 G2（≤300 豁免）/ G3（失败 ≤500 豁免）边界 ±1
//   3. todo 压缩行（G4「最新豁免」在调用层，不在此测）
//   4. G7 兜底压缩器
//   5. compactToolInput 的 write/edit 大入参压缩 + 小入参豁免
//
// 被测对象是纯函数（src/shared/tool-compaction），无需 mock localStorage——
// 逃生门 kfm-no-compact 在调用层（orb-chat-run.ts），不在压缩器内。
// ==========================================================================

import assert from 'assert';
import { group, test } from './runner.js';
import {
  compactToolResult,
  compactToolInput,
  normalizeBashCommand,
  todoResultAnnotation,
  TODO_STALE_GAP,
  COMPACTOR_NAMES,
} from '../src/shared/tool-compaction/index.js';

// 构造超长文本：'x' * n（单行）或 n 行多行文本
const chars = (n: number): string => 'x'.repeat(n);
const lines = (n: number): string => Array.from({ length: n }, (_, i) => `line${i}`).join('\n');
// n 行且总长 >300（把超长垫在最后一行，行数保持精确）
const bigLines = (n: number): string => lines(n) + chars(400);

// ==========================================================================
// 1. 逐工具映射表（契约第五节）
// ==========================================================================

group('tool-compaction — 逐工具映射表');

test('bash 成功：[bash: {cmd} → 成功，{n}行输出已折叠]', () => {
  const out = compactToolResult('bash', { command: 'ls -la' }, bigLines(42), false);
  assert(out === '[bash: ls -la → 成功，42行输出已折叠]', `得 ${out}`);
});

test('bash 失败超 500 字符也压（G3 只保 ≤500），带尾部 200 字符诊断采样', () => {
  const out = compactToolResult('bash', { command: 'npm test' }, chars(501), true);
  assert(out === `[bash: npm test → 失败，1行输出已折叠，尾部: …${'x'.repeat(200)}]`, `得 ${out}`);
});

test('bash 失败尾部采样：换行压为 ⏎（压缩行单行契约），取末尾 200 字符', () => {
  const tail = 'error TS2307: Cannot find module\n  at src/index.ts(7,52)';
  const out = compactToolResult('bash', { command: 'npx tsc' }, bigLines(30) + '\n' + tail, true);
  const wantTail = (bigLines(30) + '\n' + tail).slice(-200).replace(/\n/g, '⏎');
  assert(out?.includes('⏎') && !out.slice(out.indexOf('尾部:')).includes('\n'), '尾部采样不得含裸换行');
  assert(out === `[bash: npx tsc → 失败，32行输出已折叠，尾部: …${wantTail}]`, `得 ${out}`);
});

test('bash 命令 >60 字符截断保留前半', () => {
  const cmd = 'a'.repeat(70);
  const out = compactToolResult('bash', { command: cmd }, bigLines(5), false);
  assert(out === `[bash: ${'a'.repeat(60)}… → 成功，5行输出已折叠]`, `得 ${out}`);
});

test('read：指纹对 {n}行/{c}字符（同路径指纹不同 = 读取间文件被修改）', () => {
  const out = compactToolResult('read', { path: '/src/orb.ts' }, chars(41203), false);
  assert(out === '[read /src/orb.ts → 1行/41203字符，可用 read 重读]', `得 ${out}`);
});

test('read：行选择器保留在 path（:275-370），重读能读对段', () => {
  const body = bigLines(96);
  const out = compactToolResult('read', { path: '/src/orb.ts:275-370' }, body, false);
  assert(out === `[read /src/orb.ts:275-370 → 96行/${body.length}字符，可用 read 重读]`, `得 ${out}`);
});

test('read：截断标记透传（>100KB 截断/采样，AI 需知道自己没看全）', () => {
  const truncated = chars(400) + '\n\n--- 文件较大 (2.1MB)，仅显示前 100.0KB ---';
  const out1 = compactToolResult('read', { path: '/big.log' }, truncated, false);
  assert(out1?.includes('原读取截断未看全'), `截断标记丢失: ${out1}`);
  const sampled = '📄 /big.log\n大小: 2.1MB\n\n采样 (前 30 行):\n---\n' + bigLines(30);
  const out2 = compactToolResult('read', { path: '/big.log' }, sampled, false);
  assert(out2?.includes('采样读取未看全'), `采样标记丢失: ${out2}`);
});

test('write：指纹对 {n}行/{c}字符已写入（与 read 同词汇，跨工具指纹链）', () => {
  const input = { path: '/src/a.ts', content: lines(17) };
  const out = compactToolResult('write', input, chars(400), false);
  assert(out === `[write /src/a.ts → 17行/${lines(17).length}字符已写入]`, `得 ${out}`);
});

test('edit：diff-stat -{old}/+{new}行（真实 schema：input.old/input.new，无 lineStart）', () => {
  const input = { path: '/src/a.ts', old: lines(3), new: lines(5) };
  const out = compactToolResult('edit', input, chars(400), false);
  assert(out === '[edit /src/a.ts → -3/+5行]', `得 ${out}`);
  // 带 ctx.editRange（result.details.lineStart/lineEnd）→ 插入行号段
  const ranged = compactToolResult('edit', input, chars(400), false, { editRange: { start: 36, end: 38 } });
  assert(ranged === '[edit /src/a.ts 第36-38行 → -3/+5行]', `得 ${ranged}`);
});

test('edit diff-stat 形状语义：纯新增 -0/+12 / 纯删除 -15/+0', () => {
  const add = compactToolResult('edit', { path: '/a', old: '', new: lines(12) }, chars(400), false);
  assert(add === '[edit /a → -0/+12行]', `得 ${add}`);
  const del = compactToolResult('edit', { path: '/a', old: lines(15), new: '' }, chars(400), false);
  assert(del === '[edit /a → -15/+0行]', `得 ${del}`);
});

test('grep：截断时透传「未看全」→ {count}+处匹配（结果被截断），标记行不计入', () => {
  const result = [
    'a.ts:1: ' + chars(150),
    'b.ts:2: ' + chars(150),
    'c.ts:3: ' + chars(150),
    '(结果被截断)',
  ].join('\n');
  const out = compactToolResult('grep', { pattern: 'foo' }, result, false);
  assert(out === '[grep foo → 3+处匹配（结果被截断），可重跑]', `得 ${out}`);
});

test('glob：[glob {pattern} → {count}个文件]', () => {
  const out = compactToolResult('glob', { pattern: 'src/**/*.ts' }, bigLines(8), false);
  assert(out === '[glob src/**/*.ts → 8个文件]', `得 ${out}`);
});

// ---- 参数标注规则（契约第九节：影响结果语义的非默认参数进压缩行）----

test('grep 参数标注：@ {path} 必标（传了才标），（忽略大小写）非默认才标', () => {
  const out = compactToolResult('grep', { pattern: 'foo', path: '/root/kfmv4/src/server' }, bigLines(5), false);
  assert(out === '[grep foo @ /root/kfmv4/src/server → 5处匹配，可重跑]', `得 ${out}`);
  const ic = compactToolResult('grep', { pattern: 'foo', path: '/a', ignoreCase: true }, bigLines(5), false);
  assert(ic === '[grep foo @ /a（忽略大小写） → 5处匹配，可重跑]', `得 ${ic}`);
  // 未传 path/ignoreCase → 不标（默认语义，标了是噪音）
  const def = compactToolResult('grep', { pattern: 'foo' }, bigLines(5), false);
  assert(def === '[grep foo → 5处匹配，可重跑]', `得 ${def}`);
});

test('glob 参数标注 + 截断透传（BAR-COMPACT-03 起工具侧带标记行）', () => {
  const out = compactToolResult('glob', { pattern: '*', path: '/w', hidden: true }, bigLines(8), false);
  assert(out === '[glob * @ /w（含隐藏） → 8个文件]', `得 ${out}`);
  // 截断：标记行不计入文件数，透传「未看全」
  const trunc = compactToolResult('glob', { pattern: '*' }, bigLines(200) + '\n(结果被截断)', false);
  assert(trunc === '[glob * → 200+个文件（结果被截断）]', `得 ${trunc}`);
});

test('todo：旧 todo [todo 更新{n}项]（n=input.todos 长度）', () => {
  const input = { todos: [{ content: 'a' }, { content: 'b' }, { content: 'c' }] };
  const out = compactToolResult('todo', input, chars(400), false);
  assert(out === '[todo 更新3项]', `得 ${out}`);
});

test('todo 投影标注：dismiss / 烂尾（只陈述事实，措辞不含因果断言）', () => {
  // 无信号 → 空串
  assert(todoResultAnnotation({ dismissed: false, aiRoundsAfter: 0 }) === '');
  // dismiss：只陈述「被关闭」事实——不含「任务结束」类断言（关闭也可能只是嫌碍眼）
  const d = todoResultAnnotation({ dismissed: true, aiRoundsAfter: 0 });
  assert(d === '\n（面板已被用户手动关闭）', `得 ${d}`);
  assert(!d.includes('结束') && !d.includes('完成'), 'dismiss 措辞不得做因果断言');
  // 烂尾：阈值式单调（≥TODO_STALE_GAP 才标），措辞带「可能」
  const below = todoResultAnnotation({ dismissed: false, aiRoundsAfter: TODO_STALE_GAP - 1 });
  assert(below === '', `阈值以下不标，得 ${below}`);
  const s = todoResultAnnotation({ dismissed: false, aiRoundsAfter: TODO_STALE_GAP });
  assert(s === `\n（此后超过${TODO_STALE_GAP}轮未更新，可能已过时）`, `得 ${s}`);
  // 双信号并存：dismiss 在前
  const both = todoResultAnnotation({ dismissed: true, aiRoundsAfter: TODO_STALE_GAP + 5 });
  assert(both === `\n（面板已被用户手动关闭）\n（此后超过${TODO_STALE_GAP}轮未更新，可能已过时）`, `得 ${both}`);
});

test('web_search：无标题行结果 → 兜底 [web_search {query(≤50)} → 结果已折叠，可重搜]', () => {
  const out = compactToolResult('web_search', { query: 'kimi code cli' }, chars(400), false);
  assert(out === '[web_search kimi code cli → 结果已折叠，可重搜]', `得 ${out}`);
});

test('web_search query >50 字符截断', () => {
  const q = 'q'.repeat(60);
  const out = compactToolResult('web_search', { query: q }, chars(400), false);
  assert(out === `[web_search ${'q'.repeat(50)}… → 结果已折叠，可重搜]`, `得 ${out}`);
});

// 真实结构的搜索结果夹具（标题行 `N. xxx` + URL 行 + snippet 行，垫长 >300）
function webResults(titles: string[]): string {
  return titles.map((t, i) => `${i + 1}. ${t}\n   https://example.com/${i}\n   ${chars(120)}`).join('\n');
}

test('web_search 保留标题清单（判决留下，证据折叠）', () => {
  const out = compactToolResult('web_search', { query: 'qoder api' }, webResults(['下载 | Qoder', 'API 文档', '镜像站']), false);
  assert(out === '[web_search qoder api → 3条：下载 | Qoder；API 文档；镜像站，正文已折叠，可重搜]', `得 ${out}`);
});

test('web_search 标题截断规则：每条 ≤30，标题段总 ≤120', () => {
  const longTitles = Array.from({ length: 5 }, (_, i) => `标题${i}` + '长'.repeat(40));
  const out = compactToolResult('web_search', { query: 'q' }, webResults(longTitles), false);
  const seg = out!.match(/→ 5条：(.+)，正文已折叠/)![1];
  assert(seg.length <= 121, `标题段 ${seg.length} 应 ≤121（含省略号）`);
  for (const t of seg.split('；')) assert(t.length <= 31, `单条 ${t.length} 应 ≤31`);
});

test('web_search 重复标注：标题键精确全等才判同，空键守卫', () => {
  const res = webResults(['甲', '乙', '丙']);
  const key = '1. 甲\n2. 乙\n3. 丙';
  // 命中：ctx 含相同标题键 → 标注
  const dup = compactToolResult('web_search', { query: '换个措辞' }, res, false, { webPrevTitles: [key] });
  assert(dup!.endsWith('（结果与上方搜索相同）'), `得 ${dup}`);
  // 标题不同 → 不标（宁漏勿错）
  const diff = compactToolResult('web_search', { query: 'q' }, res, false, { webPrevTitles: ['1. 别的'] });
  assert(!diff!.includes('相同'), `得 ${diff}`);
  // 空键守卫：ctx 里的空键 vs 无标题行结果 → 不得误判
  const emptyCur = compactToolResult('web_search', { query: 'q' }, chars(400), false, { webPrevTitles: [''] });
  assert(!emptyCur!.includes('相同'), `空键不得误判，得 ${emptyCur}`);
});

test('debug：[debug {action} → 已折叠]', () => {
  const out = compactToolResult('debug', { action: 'evaluate' }, chars(400), false);
  assert(out === '[debug evaluate → 已折叠]', `得 ${out}`);
});

test('eval：[eval {expr(≤40)} → 已折叠]（表达式取 input.code）', () => {
  const out = compactToolResult('eval', { language: 'py', code: 'print(1)' }, chars(400), false);
  assert(out === '[eval print(1) → 已折叠]', `得 ${out}`);
});

test('eval code >40 字符截断', () => {
  const code = 'c'.repeat(50);
  const out = compactToolResult('eval', { language: 'js', code }, chars(400), false);
  assert(out === `[eval ${'c'.repeat(40)}… → 已折叠]`, `得 ${out}`);
});

test('browser_eval 与 eval 同模板（表达式取 input.code）', () => {
  const out = compactToolResult('browser_eval', { code: 'return 1' }, chars(400), false);
  assert(out === '[eval return 1 → 已折叠]', `得 ${out}`);
});

test('browser：[browser {action}]', () => {
  const out = compactToolResult('browser', { action: 'open', url: 'https://x.com' }, chars(400), false);
  assert(out === '[browser open]', `得 ${out}`);
});

// ==========================================================================
// 2. 通用规则 G2 / G3 边界（±1 字符）
// ==========================================================================

group('tool-compaction — G2/G3 豁免边界');

test('G2：结果恰好 300 字符 → 豁免（返回 null）', () => {
  assert(compactToolResult('read', { path: '/a' }, chars(300), false) === null);
});

test('G2 边界 +1：结果 301 字符 → 压缩', () => {
  const out = compactToolResult('read', { path: '/a' }, chars(301), false);
  assert(out === '[read /a → 1行/301字符，可用 read 重读]', `得 ${out}`);
});

test('G3：失败结果恰好 500 字符 → 豁免', () => {
  assert(compactToolResult('bash', { command: 'ls' }, chars(500), true) === null);
});

test('G3 边界 +1：失败结果 501 字符 → 压缩（带尾部采样）', () => {
  const out = compactToolResult('bash', { command: 'ls' }, chars(501), true);
  assert(out === `[bash: ls → 失败，1行输出已折叠，尾部: …${'x'.repeat(200)}]`, `得 ${out}`);
});

test('G3 只保护失败结果：成功结果 400 字符（>300）仍压', () => {
  const out = compactToolResult('bash', { command: 'ls' }, chars(400), false);
  assert(out === '[bash: ls → 成功，1行输出已折叠]', `得 ${out}`);
});

test('失败结果 ≤300 时 G2 先生效（豁免与 G3 一致）', () => {
  assert(compactToolResult('bash', { command: 'ls' }, chars(300), true) === null);
});

// ==========================================================================
// 3. G7 兜底压缩器 + 豁免型工具
// ==========================================================================

group('tool-compaction — G7 兜底与豁免');

test('未登记工具走兜底：[{name} → 输出{n}字符已折叠]', () => {
  const out = compactToolResult('some-future-tool', {}, chars(400), false);
  assert(out === '[some-future-tool → 输出400字符已折叠]', `得 ${out}`);
});

test('kfm-logs 登记为兜底全压（日志可重取、跨轮价值低）', () => {
  const out = compactToolResult('kfm-logs', {}, chars(5000), false);
  assert(out === '[kfm-logs → 输出5000字符已折叠]', `得 ${out}`);
});

test('豁免型工具（kfm-snapshot 等）输出 ≤300 时 G2 自然豁免', () => {
  for (const name of ['kfm-snapshot', 'kfm-exec', 'kfm-restart', 'checkpoint', 'rewind']) {
    assert(compactToolResult(name, {}, chars(200), false) === null, `${name} 应豁免`);
    assert(COMPACTOR_NAMES.includes(name), `${name} 必须在注册表有登记条目`);
  }
});

// ==========================================================================
// 4. compactToolInput — 大入参压缩
// ==========================================================================

group('tool-compaction — compactToolInput');

test('write 大入参 → 指纹对 {n}行/{c}字符内容已折叠', () => {
  const input = { path: '/src/a.ts', content: lines(120) };
  const out = compactToolInput('write', input);
  assert(out !== null, '大入参应压');
  assert(out.path === '/src/a.ts', 'path 原样保留');
  assert(out._compacted === `120行/${lines(120).length}字符内容已折叠`, `得 ${out._compacted}`);
  assert(!('content' in out), '文件全文必须被折叠掉');
});

test('edit 大入参 → diff-stat（真实 schema：old/new）', () => {
  const input = { path: '/src/a.ts', old: lines(3) + chars(150), new: lines(9) + chars(150) };
  const out = compactToolInput('edit', input);
  assert(out !== null && out._compacted === '编辑已折叠: -3/+9行', `得 ${JSON.stringify(out)}`);
  assert(out.path === '/src/a.ts');
  assert(!('old' in out) && !('new' in out), 'old/new 全文必须被折叠掉');
});

test('edit 大入参带行号区间（ctx.editRange，来自 result.details）', () => {
  const input = { path: '/src/a.ts', old: lines(3) + chars(150), new: lines(5) + chars(150) };
  const out = compactToolInput('edit', input, false, { editRange: { start: 36, end: 38 } });
  assert(out !== null && out._compacted === '编辑已折叠: 第36-38行 -3/+5行', `得 ${JSON.stringify(out)}`);
});

test('write/edit 修改爆发标注（ctx.mutBurst：本轮序号 / 再进入）', () => {
  const input = { path: '/src/a.ts', content: lines(120) };
  const first = compactToolInput('write', input, false, { mutBurst: { burst: 1, cum: 1, reEntry: false } });
  assert(!first?._compacted?.includes('次修改') && !first?._compacted?.includes('重新进入'), '首次不标注');
  const burst3 = compactToolInput('write', input, false, { mutBurst: { burst: 3, cum: 3, reEntry: false } });
  assert(burst3?._compacted?.includes('（本轮第3次修改）'), `得 ${burst3?._compacted}`);
  // 相距 >MUT_BURST_GAP 轮后的再进入：历史累计降级为背景
  const reEntry = compactToolInput('write', input, false, { mutBurst: { burst: 1, cum: 5, reEntry: true } });
  assert(reEntry?._compacted?.includes('（重新进入修改，此前共4次）'), `得 ${reEntry?._compacted}`);
  // 失败调用不标注（失败 edit 什么都没改）
  const failed = compactToolInput('edit',
    { path: '/a.ts', old: lines(10) + chars(200), new: lines(10) + chars(200) },
    true, { mutBurst: { burst: 3, cum: 3, reEntry: false } });
  assert(failed !== null && !failed._compacted?.includes('次修改'), '失败调用不标爆发');
});

test('失败调用入参 ≤500 字符豁免（失败 edit 的 old/new 是诊断对象，镜像 G3）', () => {
  const input = { path: '/a.ts', old: lines(10) + chars(150), new: lines(10) + chars(150) };
  const len = JSON.stringify(input).length;
  assert(len > 300 && len <= 500, `夹具长度 ${len} 应在 (300,500]`);
  assert(compactToolInput('edit', input, true) === null, '失败且 ≤500 应豁免');
  assert(compactToolInput('edit', input, false) !== null, '成功同尺寸仍压');
});

test('小入参（JSON ≤300 字符）一律豁免', () => {
  assert(compactToolInput('write', { path: '/a', content: 'short' }) === null);
  assert(compactToolInput('edit', { path: '/a', old: 'x', new: 'y' }) === null);
});

test('write 小入参边界：301 字符 → 压，300 字符 → 豁免', () => {
  // 骨架 {"path":"/a","content":""} 的长度动态算，content 补齐到总长 300/301
  const skeleton = JSON.stringify({ path: '/a', content: '' }).length;
  const at300 = { path: '/a', content: chars(300 - skeleton) };
  const at301 = { path: '/a', content: chars(301 - skeleton) };
  assert(JSON.stringify(at300).length === 300, '夹具长度算错');
  assert(JSON.stringify(at301).length === 301, '夹具长度算错');
  assert(compactToolInput('write', at300) === null, '300 字符应豁免');
  assert(compactToolInput('write', at301) !== null, '301 字符应压');
});

test('其余工具入参保留原文（返回 null）', () => {
  const big = { command: chars(500) };
  for (const name of ['bash', 'read', 'grep', 'glob', 'todo', 'web_search', 'debug', 'browser']) {
    assert(compactToolInput(name, big) === null, `${name} 入参不应压`);
  }
});

test('eval/browser_eval 大入参 → 代码折叠留首行描述', () => {
  // 注释首行：去注释符
  const withComment = { language: 'js', code: '// 查看面板结构\n' + chars(400) };
  const a = compactToolInput('eval', withComment);
  assert(a !== null && a._compacted === '代码已折叠: 查看面板结构', `得 ${JSON.stringify(a)}`);
  assert(a.language === 'js', 'eval 的 language 透传');
  assert(!('code' in a), '代码全文必须被折叠掉');
  // 代码首行兜底（无注释也有描述性）
  const codeFirst = { code: `const panel = document.querySelector('.orb-panel');\n` + chars(400) };
  const b = compactToolInput('browser_eval', codeFirst);
  assert(b !== null && b._compacted === "代码已折叠: const panel = document.querySelector('.o…", `得 ${JSON.stringify(b)}`);
  assert(!('language' in b), 'browser_eval 无 language 字段');
  // 小入参豁免 / 无 code 不压
  assert(compactToolInput('eval', { language: 'js', code: 'return 1' }) === null);
  assert(compactToolInput('browser_eval', { command: chars(500) }) === null, '无 code 不压');
});

// ==========================================================================
// 5. 确定性（G6：同样输入永远产出同样文本）
// ==========================================================================

group('tool-compaction — 确定性与登记完整性');

test('同样输入两次调用产出逐字符相等（prompt 缓存前缀不失效）', () => {
  const input = { command: 'git status' };
  const a = compactToolResult('bash', input, lines(100), false);
  const b = compactToolResult('bash', input, lines(100), false);
  assert(a === b && a !== null, '必须确定性输出');
});

test('COMPACTOR_NAMES 覆盖映射表全部显式登记工具', () => {
  const expected = [
    'bash', 'read', 'write', 'edit', 'grep', 'glob', 'todo',
    'web_search', 'debug', 'eval', 'browser_eval', 'browser',
    'kfm-logs', 'kfm-snapshot', 'kfm-exec', 'kfm-restart', 'checkpoint', 'rewind',
  ];
  for (const name of expected) {
    assert(COMPACTOR_NAMES.includes(name), `注册表缺 ${name}`);
  }
  assert(COMPACTOR_NAMES.length === expected.length, `登记数应为 ${expected.length}，得 ${COMPACTOR_NAMES.length}`);
});

// ==========================================================================
// 6. 跨调用标注层（契约第九节：宁漏勿错 / 决策相关性 / 只向后看）
// ==========================================================================

group('tool-compaction — 跨调用标注层');

test('归一化语法：去 cd 前缀 + 截管道 + 去 2>&1 + 折叠空白', () => {
  assert(normalizeBashCommand('cd /root/kfmv4 && npm test 2>&1 | tail -5') === 'npm test');
  assert(normalizeBashCommand('cd /a && cd /b && npx tsc --noEmit') === 'npx tsc --noEmit');
  assert(normalizeBashCommand('export FOO=1 && git status') === 'git status');
  assert(normalizeBashCommand('time npx tsc --noEmit') === 'npx tsc --noEmit');
  assert(normalizeBashCommand('git  status') === 'git status');
  assert(normalizeBashCommand('cd /only-prefix &&') === '');
  // 宁漏勿错：语义等价写法不同 = 不同命令，不模糊匹配
  assert(normalizeBashCommand('npm run test') !== normalizeBashCommand('npm test'));
});

test('grep 截断透传：{count}+处匹配（结果被截断）', () => {
  const out = compactToolResult('grep', { pattern: 'foo' }, bigLines(20) + '\n(结果被截断)', false);
  assert(out === '[grep foo → 20+处匹配（结果被截断），可重跑]', `得 ${out}`);
  const full = compactToolResult('grep', { pattern: 'foo' }, bigLines(20), false);
  assert(full === '[grep foo → 20处匹配，可重跑]', `得 ${full}`);
});

test('bash 指标提取白名单：只认 N passed, N failed，其它输出不提取', () => {
  const withTests = bigLines(50) + '\n425 passed, 0 failed';
  const out = compactToolResult('bash', { command: 'npm test' }, withTests, false);
  assert(out?.includes('（425 passed, 0 failed）'), `指标未提取: ${out}`);
  const other = compactToolResult('bash', { command: 'ls' }, bigLines(50), false);
  assert(!other?.includes('passed'), `不应提取: ${other}`);
});

test('read 去重标注：指纹相同 → 内容与上方读取相同', () => {
  const body = bigLines(40);
  const fp = `${body.split('\n').length}行/${body.length}字符`;
  const out = compactToolResult('read', { path: '/a.ts' }, body, false, { readPrevFps: [fp] });
  assert(out?.includes('内容与上方读取相同'), `得 ${out}`);
});

test('read 修改标注：指纹不同 → 文件已被修改；回退 → 标明回到第几次读取', () => {
  const body = bigLines(40);
  const fpA = '10行/500字符';
  const fpB = `${body.split('\n').length}行/${body.length}字符`;
  const modified = compactToolResult('read', { path: '/a.ts' }, body, false, { readPrevFps: [fpA] });
  assert(modified?.includes('内容与上方读取不同（文件已被修改）'), `得 ${modified}`);
  const reverted = compactToolResult('read', { path: '/a.ts' }, body, false, { readPrevFps: [fpB, fpA] });
  assert(reverted?.includes('内容回退到第1次读取时的状态'), `得 ${reverted}`);
});

test('bash 重试弧线：第N次执行 / 连续失败 / 成功前的失败史', () => {
  const out1 = compactToolResult('bash', { command: 'npm test' }, bigLines(50), false,
    { bashRetry: { ordinal: 3, failStreak: 0, prevFailStreak: 2 } });
  assert(out1?.includes('（第3次执行，此前连续2次失败）'), `得 ${out1}`);
  const out2 = compactToolResult('bash', { command: 'npm test' }, bigLines(50), true,
    { bashRetry: { ordinal: 3, failStreak: 3, prevFailStreak: 0 } });
  assert(out2?.includes('（第3次执行，连续3次失败）'), `得 ${out2}`);
  const out3 = compactToolResult('bash', { command: 'npm test' }, bigLines(50), false,
    { bashRetry: { ordinal: 1, failStreak: 0, prevFailStreak: 0 } });
  assert(!out3?.includes('第1次执行'), '首次执行不标注');
});

test('bash 环境故障：连续 ≥3 次不同命令失败才标注（<3 不标）', () => {
  const out = compactToolResult('bash', { command: 'ss -tlnp' }, bigLines(50), true, { bashEnvStreak: 4 });
  assert(out?.includes('（连续4次失败均为不同命令——疑似环境问题）'), `得 ${out}`);
  const under = compactToolResult('bash', { command: 'ss -tlnp' }, bigLines(50), true, { bashEnvStreak: 2 });
  assert(!under?.includes('疑似环境问题'), '2 次不应标注');
});

test('无 ctx → 无任何标注（向后兼容 + 标注层不影响纯函数契约）', () => {
  const out = compactToolResult('read', { path: '/a.ts' }, bigLines(40), false);
  assert(!out?.includes('内容与上方'), `得 ${out}`);
  const out2 = compactToolResult('bash', { command: 'ls' }, bigLines(50), false);
  assert(!out2?.includes('次执行'), `得 ${out2}`);
});
