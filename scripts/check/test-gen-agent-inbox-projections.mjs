#!/usr/bin/env node
/**
 * test-gen-agent-inbox-projections.mjs — gen 投影回写考题（公约②配套,
 * 2026-08-28 裁决「gen 补丁归 na 代改,考题咬:只准替换 N 封信数字」）。
 *
 * 用 KFM_PROBE_ROOT 夹具隔离跑真 gen 脚本,断言四条:
 *   ①回写后投影文件除「N 封信」数字外逐字节不变（含拒改无关键锚点）;
 *   ②所有计数统一为实际信件数;
 *   ③stale 计数在 --check-only 下报「投影计数漂移」错误(防人手回退);
 *   ④README 信件清单表照常生成。
 * 用法: node scripts/check/test-gen-agent-inbox-projections.mjs（零依赖,秒级）
 */
import { execFileSync } from 'child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const GEN = join(here, 'gen-agent-inbox.mjs');
const root = mkdtempSync(join(__dirnameTmp(), 'gen-inbox-test-'));
function __dirnameTmp() { return tmpdir(); }

const inbox = join(root, 'docs', 'ledger', 'agent-inbox');
const nz = join(root, 'docs', 'active', 'nine-zero');
mkdirSync(inbox, { recursive: true });
mkdirSync(nz, { recursive: true });

writeFileSync(join(inbox, 'README.md'),
  `# inbox\n\n<!-- gen:agent-inbox:start -->\n| 日期 | 信件 | 回哪条 | 状态 |\n|------|------|--------|------|\n<!-- gen:agent-inbox:end -->\n`);
writeFileSync(join(inbox, 'a.md'),
  `> 日期: 2026-08-28\n> 致: kfm-na\n> 流型: 链条\n> 预期表态方: 无\n> 收敛判据: 知会\n> 回: 无\n> 状态: 已回\n\n正文。\n`);

// 投影夹具:两处 202 封信(应统一为 1)+ 无关键锚点行(逐字节不许动)
const INDEX_BEFORE = `# 9.0 索引\n\n跨线评审往来（202 封信原始裁决）| 台账\n总数:共 202 封信,按日归档。\n无关锚点行:2020 个条目、refs #202——不得改写。\n`;
writeFileSync(join(nz, '00-index.md'), INDEX_BEFORE);
writeFileSync(join(nz, 'nine-zero-decision-index.md'), `# 决策索引（202 封信 → 一张表）\n`);

const run = (flags = []) => {
  try {
    execFileSync('node', [GEN, ...flags], {
      env: { ...process.env, KFM_PROBE_ROOT: root },
      encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { rc: 0, out: '', err: '' };
  } catch (e) {
    return { rc: e.status, out: e.stdout || '', err: e.stderr || '' };
  }
};
const fail = (m) => { console.error(`❌ ${m}`); process.exit(1); };

// ①回写模式:投影统一为实际信数
run();
const after = readFileSync(join(nz, '00-index.md'), 'utf-8');
const expected = INDEX_BEFORE.replace(/202 封信/g, '1 封信');
if (after !== expected) fail(`①字节安全违约:\n期望:\n${expected}\n实得:\n${after}`);
if (!after.includes('1 封信')) fail('①计数未统一');
const di = readFileSync(join(nz, 'nine-zero-decision-index.md'), 'utf-8');
if (!di.includes('1 封信')) fail('①决策索引计数未统一');

// ②check-only:stale 计数必须报「投影计数漂移」
writeFileSync(join(nz, '00-index.md'), INDEX_BEFORE); // 复原 stale
const chk = run(['--check-only']);
if (chk.rc === 0) fail('②stale 计数在 --check-only 下未报错');
if (!/投影计数漂移/.test(chk.err)) fail(`②错误文案缺「投影计数漂移」:\n${chk.err}`);

// ③README 表照常生成
run();
const readme = readFileSync(join(inbox, 'README.md'), 'utf-8');
if (!readme.includes('[`a.md`](a.md)')) fail('③README 信件清单表未生成');

// ④锚点行逐字节不变(复核①的字节安全断言独立再验一次)
if (!after.includes('无关锚点行:2020 个条目、refs #202——不得改写。')) fail('④无关键锚点被改写');

rmSync(root, { recursive: true, force: true });
console.log('✅ gen 投影回写考题四条:字节安全/计数统一/漂移检出/表生成');
