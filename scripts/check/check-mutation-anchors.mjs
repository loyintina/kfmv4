/**
 * check-mutation-anchors.mjs — 变异集物料锚点新鲜度硬标准（2026-08-02 立）
 *
 * 背景：变异基准（semantic-bench）的刻度 = semantic-mutate.mjs 的变异物料——
 * 物料的 find 锚点是文档旧文本的摘录，文档演进后锚点失效，--remutate 物化即崩
 * （2026-08-02 事故：M01 锚 31 check/440 测试，文档已 36/490）。
 * 纪律：**测量工具的刻度也是状态类条目，随文档演进过期，必须机械保鲜**——
 * 本脚本是硬标准：任一锚点失效 = 构建中断（锚点失效 = 基准刻度失真 = 尺子坏了）。
 *
 * 实现：文本解析 semantic-mutate.mjs 的 MUTATIONS（不 import——import 会触发
 * materialize 副作用），提取 {id, file, find} 逐条核验。
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const MUTATE = join(ROOT, 'scripts/agent/semantic-mutate.mjs');
const src = readFileSync(MUTATE, 'utf-8');

// MUTATIONS 数组条目文本抽取（宽松：id/file/find + line/expect/tasks 完整性）
const entries = [];
const re = /id:\s*['"]([^'"]+)['"][\s\S]*?file:\s*['"]([^'"]+)['"][\s\S]*?find:\s*['"]([^'"]*)['"][\s\S]*?replace:\s*['"]([^'"]*)['"][\s\S]*?tasks:\s*\[([^\]]*)\]/g;
let m;
while ((m = re.exec(src))) entries.push({ id: m[1], file: m[2], find: m[3], replace: m[4], tasks: m[5] });

// 探针比较面（feeds+baseline——对照面判定用；import TASKS 纯数据模块，
// contract-vs-map 等由 DOMAINS 循环生成，字面正则匹配不到——2026-08-02 教训）
import { statSync, readdirSync } from 'fs';
const { TASKS } = await import('../agent/semantic-audit.tasks.mjs');
function expandPaths(paths) {
  const out = [];
  for (const p of paths) {
    if (p.endsWith('/')) {
      const dir = join(ROOT, p);
      if (existsSync(dir)) for (const f of readdirSync(dir)) {
        const full = join(dir, f);
        if (statSync(full).isFile()) out.push(join(p, f));
      }
    } else if (existsSync(join(ROOT, p))) out.push(p);
  }
  return out;
}
const taskFilesOf = (id) => {
  const task = TASKS.find(t => t.id === id);
  if (!task) return [];
  return [...new Set([...expandPaths(task.feeds || []), ...expandPaths(task.baseline || [])])];
};

/** 判别词：find/replace 差异区扩展后清洗（去 markdown/反引号/引号，截长），
 *  对照面应包含被变异的事实 */
function discriminator(find, replace) {
  let p = 0;
  while (p < find.length && p < replace.length && find[p] === replace[p]) p++;
  let s = 0;
  while (s < find.length - p && s < replace.length - p && find[find.length - 1 - s] === replace[replace.length - 1 - s]) s++;
  let start = p, end = find.length - s;
  while (start > 0 && !/[\s,;:()|<>*「」，。：；、`]/.test(find[start - 1])) start--;
  while (end < find.length && !/[\s,;:()|<>*「」，。：；、`]/.test(find[end])) end++;
  let tok = find.slice(start, end).trim().replace(/^[`*"']+|[`*"']+$/g, '').trim();
  // 截到 20 字符（避免长句碎片）；数字 + 单位保留完整（如 100dvh）
  const numTok = tok.match(/^[\d.]+\S+/);
  return (numTok ? numTok[0] : tok).slice(0, 20);
}

const entryTextOf = (e) => src.slice(src.indexOf(`id: '${e.id}'`) < 0 ? src.indexOf(`id: "${e.id}"`) : src.indexOf(`id: '${e.id}'`), src.indexOf(`id: '${e.id}'`) < 0 ? src.indexOf(`id: "${e.id}"`) + 600 : src.indexOf(`id: '${e.id}'`) + 600);

const errors = [];
// schema 完整性（2026-08-02 补：新变异漏写字段 → 基准失真；
// line 非必填——物化时由 find 位置自动计算（semantic-mutate.mjs:242）
const countField = (re) => (src.match(re) || []).length;
const nExpect = countField(/\bexpect:\s*['"](report|silent)['"]/g);
const nTasks = countField(/\btasks:\s*\[/g);
if (nExpect < entries.length) errors.push(`变异物料缺 expect 字段（${entries.length - nExpect} 条）`);
if (nTasks < entries.length) errors.push(`变异物料缺 tasks 字段（${entries.length - nTasks} 条）`);
for (const e of entries) {
  if (!existsSync(join(ROOT, e.file))) {
    errors.push(`${e.id}: 目标文件不存在 ${e.file}`);
    continue;
  }
  const content = readFileSync(join(ROOT, e.file), 'utf-8');
  if (!content.includes(e.find)) errors.push(`${e.id}: 「${e.find.slice(0, 50)}…」不在 ${e.file}（文档已演进，维护 semantic-mutate.mjs 锚点）`);
  // 对照面铁律（2026-08-02 机制化，盲因诊断教训）：被变异的事实必须在
  // 探针比较面的「其他文件」中出现——否则探针找不到可冲突来源，测空气。
  if (e.tasks) {
    const disc = discriminator(e.find, e.replace || '');
    const taskIds = (e.tasks.match(/['"]([^'"]+)['"]/g) || []).map(t => t.replace(/['"]/g, ''));
    let hasContrast = false;
    const contrastDocs = [];
    for (const tid of taskIds) {
      const files = taskFilesOf(tid).filter(f => f !== e.file && existsSync(join(ROOT, f)));
      contrastDocs.push(...files);
      for (const f of files) {
        if (readFileSync(join(ROOT, f), 'utf-8').includes(disc)) { hasContrast = true; break; }
      }
      if (hasContrast) break;
    }
    if (contrastDocs.length > 0 && !hasContrast) {
      // 只对 token 型判别词（计数/文件名/标识符）强制对照面——CJK 长句类变异
      // 靠主题推断（对照面措辞不同但事实在），字面匹配会误报（M14/MID-4 教训）
      const isToken = /^[\w.\/-]+$/.test(disc);
      const isSilent = /expect:\s*['"]silent['"]/.test(entryTextOf(e));
      if (isToken && !isSilent) {
        // 引用式豁免：对照面含「实报为准/不记快照/sync-counts」且判别词带数字 → 走推断（有效）
        const refStyle = contrastDocs.some(f => /实报为准|不记快照|以.*为准|sync-counts/.test(readFileSync(join(ROOT, f), 'utf-8')));
        const numeric = /\d/.test(disc);
        if (!(refStyle && numeric)) {
          errors.push(`${e.id}: 对照面无「${disc}」——被变异事实不在探针比较面的其他文档（${contrastDocs.slice(0, 2).join(', ')}…），测的是空气（铁律：变异前先确认对照面存在该事实）`);
        }
      }
    }
  }
}

if (entries.length === 0) {
  console.error('[check-mutation-anchors] MUTATIONS 解析失败（0 条）——格式变了要修本检查');
  console.error('[check-mutation-anchors] ⛳ MECH-FLOW-01：锚点失效需维护 semantic-mutate——读 experiments/coldstart/reports/13-probe-matrix.md，走 workflows/discipline-mechanize.yaml');
  process.exit(1);
}

if (errors.length) {
  for (const e of errors) console.error(`  ❌ ${e}`);
  console.error(`[check-mutation-anchors] ${errors.length}/${entries.length} 个变异锚点失效——基准刻度失真，构建中断`);
  process.exit(1);
}
console.log(`[check-mutation-anchors] OK — ${entries.length} 个变异锚点全部有效`);
