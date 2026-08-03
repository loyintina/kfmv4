#!/usr/bin/env node
/**
 * gen-tool-docs.mjs — 工具文档「参数节」拼接器（原代码注册驱动）
 *
 * 工具参数在 tools/*.ts 的 KfmTool.parameters（JSON schema）注册，文档的
 * 「## 参数」节由本生成器从 schema 拼接生成（描述/必填/枚举直接取 schema）。
 * 手写段（能力描述/关键规则/使用时机）保留不动。新增/修改工具参数而文档
 * 未同步 = check 中断（--check-only 漂移报红）。
 *
 * 用法：
 *   node scripts/check/gen-tool-docs.mjs             # 回写全部工具文档
 *   node scripts/check/gen-tool-docs.mjs --check-only  # 校验漂移
 * 支持 KFM_PROBE_ROOT 注入（check-probes 夹具，走迷你工具树）。
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const BASE = process.env.KFM_PROBE_ROOT || ROOT;
const TOOLS_DIR = join(BASE, 'src', 'server', 'prompts', 'global', 'tools');

const MARK_START = '<!-- gen:tool-params:start -->';
const MARK_END = '<!-- gen:tool-params:end -->';

/** 用 tsx 从工具注册表导出 schema JSON（原代码注册的活源头） */
function dumpToolDefs() {
  const script = `
    import { getToolDefinitions } from './src/server/ai/tools/index.ts';
    process.stdout.write(JSON.stringify(getToolDefinitions()));
  `;
  const out = execFileSync('npx', ['tsx', '-e', script], {
    cwd: BASE, encoding: 'utf-8', timeout: 60_000,
  });
  return JSON.parse(out);
}

/** 从 schema 生成「## 参数」节（含标记） */
function buildParamsSection(def) {
  const props = def.parameters?.properties || {};
  const required = Array.isArray(def.parameters?.required) ? def.parameters.required : [];
  const lines = [MARK_START, '', '## 参数', ''];
  const names = Object.keys(props);
  if (names.length === 0) {
    lines.push('（无参数）');
  } else {
    for (const name of names) {
      const p = props[name] || {};
      const req = required.includes(name) ? '必填' : '可选';
      let extra = '';
      if (Array.isArray(p.enum) && p.enum.length) extra = `，枚举：${p.enum.join('、')}`;
      else if (p.type === 'boolean') extra = '，布尔';
      const desc = typeof p.description === 'string' ? p.description : '';
      lines.push(`- \`${name}\`（${req}${extra}）— ${desc}`);
    }
  }
  lines.push('', MARK_END);
  return lines.join('\n');
}

/** 去掉手写参数节（## 参数 到下一个 ## 或 EOF），避免与生成节双份 */
function stripManualParams(doc) {
  if (doc.includes(MARK_START)) return doc;
  return doc.replace(/\n## 参数\n[\s\S]*?(?=\n## |\n<!-- |$)/, '\n');
}

/** 插入或替换标记段：有标记 → 替换标记间；无标记 → 首个 ## 节前插入 */
function upsertSection(doc, section) {
  const s = doc.indexOf(MARK_START);
  if (s !== -1) {
    const e = doc.indexOf(MARK_END, s);
    if (e !== -1) return doc.slice(0, s) + section + doc.slice(e + MARK_END.length);
  }
  const head = doc.indexOf('\n## ');
  const pos = head === -1 ? doc.length : head + 1;
  return doc.slice(0, pos) + '\n' + section + '\n' + doc.slice(pos);
}

const checkOnly = process.argv.includes('--check-only');
const defs = dumpToolDefs();
let changed = 0, missing = 0;
const errors = [];

for (const def of defs) {
  const docPath = join(TOOLS_DIR, `${def.name}.md`);
  if (!existsSync(docPath)) {
    errors.push(`工具 ${def.name} 缺文档 ${def.name}.md（生成器只更新文档，缺失需补建）`);
    missing++;
    continue;
  }
  const doc = readFileSync(docPath, 'utf-8');
  const stripped = stripManualParams(doc);
  const next = upsertSection(stripped, buildParamsSection(def));
  if (next !== doc) {
    changed++;
    if (checkOnly) {
      errors.push(`工具 ${def.name} 参数节漂移（schema 与文档不一致）`);
  console.error('[gen-tool-docs] ⛳ DOC-FLOW-04：工具参数由 schema 拼接，改参数别改文档——读 docs/active/generateable-facts.md，走 workflows/doc-write.yaml 第 2 步');
    } else {
      writeFileSync(docPath, next, 'utf-8');
    }
  }
}

// 反向：文档比注册工具多（幽灵文档）
for (const f of readdirSync(TOOLS_DIR)) {
  if (!f.endsWith('.md')) continue;
  const name = f.replace(/\.md$/, '');
  if (!defs.some(d => d.name === name)) {
    errors.push(`幽灵文档 ${f}（代码未注册同名工具，应删除）`);
  }
}

if (errors.length) {
  for (const e of errors) console.error(`[gen-tool-docs] ${e}`);
  console.error(`[gen-tool-docs] ${errors.length} 处问题` + (checkOnly ? '——跑 node scripts/check/gen-tool-docs.mjs 回写' : ''));
  process.exit(1);
}
console.log(`[gen-tool-docs] ${checkOnly ? 'OK — 全部工具文档参数节与 schema 一致' : `已回写 ${changed}/${defs.length} 份工具文档参数节`}`);
