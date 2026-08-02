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
const re = /id:\s*['"]([^'"]+)['"][\s\S]*?file:\s*['"]([^'"]+)['"][\s\S]*?find:\s*['"]([^'"]*)['"]/g;
let m;
while ((m = re.exec(src))) entries.push({ id: m[1], file: m[2], find: m[3] });

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
}

if (entries.length === 0) {
  console.error('[check-mutation-anchors] MUTATIONS 解析失败（0 条）——格式变了要修本检查');
  process.exit(1);
}

if (errors.length) {
  for (const e of errors) console.error(`  ❌ ${e}`);
  console.error(`[check-mutation-anchors] ${errors.length}/${entries.length} 个变异锚点失效——基准刻度失真，构建中断`);
  process.exit(1);
}
console.log(`[check-mutation-anchors] OK — ${entries.length} 个变异锚点全部有效`);
