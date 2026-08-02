#!/usr/bin/env node
/**
 * gen-route-table.mjs — CLAUDE.md 路由表生成器（可生成事实登记表 P0）
 *
 * 语义单源 + 生成呈现：任务路由表的工作流行从 docs/workflows/*.yaml 的
 * name/id 生成（防「新工作流靠人记得加进路由表」——路由表门已有，生成器彻底消灭手写）。
 *
 * CLAUDE.md 约定：工作流行包在 `<!-- gen:route-table -->` ... `<!-- /gen:route-table -->`
 * 内；非工作流行（active/vision.md、guides/agent-runner.md、无匹配）留在标记外（判断类）。
 *
 * 用法：node scripts/check/gen-route-table.mjs [--check-only]
 */
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const CHECK_ONLY = process.argv.includes('--check-only');
const claudePath = join(ROOT, 'CLAUDE.md');
const wfDir = join(ROOT, 'docs/workflows');

const rows = [];
for (const f of readdirSync(wfDir).filter(f => f.endsWith('.yaml')).sort()) {
  if (f === '_template.yaml') continue;
  const id = f.replace(/\.yaml$/, '');
  const content = readFileSync(join(wfDir, f), 'utf-8');
  const nameM = content.match(/^name:\s*(.+)$/m);
  const name = (nameM ? nameM[1].trim() : id).replace(/（.*$/, '');
  rows.push(`| ${name} | workflows/${f} |`);
}
const generated = `<!-- gen:route-table 自动生成，禁止手改（源：docs/workflows/*.yaml name/id） -->\n${rows.join('\n')}\n<!-- /gen:route-table -->`;

const claude = readFileSync(claudePath, 'utf-8');
const m = claude.match(/<!-- gen:route-table[\s\S]*?-->[\s\S]*?<!-- \/gen:route-table -->/);
if (!m) {
  console.error('[gen-route-table] CLAUDE.md 无 gen:route-table 标记——先包裹工作流行');
  process.exit(1);
}
if (m[0] !== generated) {
  if (CHECK_ONLY) {
    console.error('[gen-route-table] 路由表与 workflows/ 目录漂移（未同步）');
    process.exit(1);
  }
  writeFileSync(claudePath, claude.replace(m[0], generated));
  console.log(`[gen-route-table] 已生成 ${rows.length} 行工作流行`);
} else {
  console.log(`[gen-route-table] 路由表与 workflows/ 一致（${rows.length} 行）`);
}
