/**
 * check-doc-schema.mjs — 文档结构 schema 校验（v8.2 批 2）
 *
 * 契约：docs/guides/doc-maintenance.md「各层 grammar」——
 *   1. domains/＊/contract.md 必备章节：## #陷阱、## 文件清单
 *   2. workflows/＊.yaml 必备字段：id / name / trigger / frequency / reads / steps / writes /
 *      exit_condition / natural_next
 *
 * 即「文档的接口类型检查」：结构缺席 = 下游消费者（路由/机检/agent 导航）失效。
 * 挂入 npm run check，缺失 = 构建中断。
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { DOCS_ROOT } from './docs-root-const.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

let errors = 0;
function error(msg) {
  console.error(`[check-doc-schema] ${msg}`);
  errors++;
}

// ========== 1. 域契约必备章节 ==========

const CONTRACT_SECTIONS = ['## #陷阱', '## 文件清单'];
const domainsDir = join(ROOT, DOCS_ROOT, 'domains');
for (const d of readdirSync(domainsDir, { withFileTypes: true })) {
  if (!d.isDirectory()) continue;
  const f = join(domainsDir, d.name, 'contract.md');
  const content = readFileSync(f, 'utf-8');
  for (const sec of CONTRACT_SECTIONS) {
    if (!content.includes('\n' + sec) && !content.startsWith(sec)) {
      error(`domains/${d.name}/contract.md 缺少必备章节「${sec}」`);
    }
  }
}

// ========== 2. workflows 必备字段 ==========

const WORKFLOW_KEYS = ['id', 'name', 'trigger', 'frequency', 'reads', 'steps', 'writes', 'exit_condition', 'natural_next'];
const wfDir = join(ROOT, DOCS_ROOT, 'workflows');
for (const f of readdirSync(wfDir).filter(f => f.endsWith('.yaml'))) {
  const content = readFileSync(join(wfDir, f), 'utf-8');
  const keys = new Set(
    content.split('\n').filter(l => /^[a-z_]+:/.test(l)).map(l => l.split(':')[0]),
  );
  for (const k of WORKFLOW_KEYS) {
    if (!keys.has(k)) error(`workflows/${f} 缺少必备字段「${k}」`);
  }
}

if (errors > 0) {
  console.error(`\n[check-doc-schema] ${errors} 处结构缺失，构建中断。`);
  process.exit(1);
}
console.log('[check-doc-schema] OK — 契约必备章节、workflows 必备字段齐全');
