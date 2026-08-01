// ==========================================================================
// tests/tag-advisor.test.ts — tag-advisor shell 注入回归钉子（BAR-SEC-15）
//
// bug：tag-advisor.mjs:21 把命令行 base/head ref 直插
// `execSync(\`git log ${baseTag}..${headRef} --format='%s'\`)` 模板串——恶意 ref
// 带 shell 元字符（`$()`、`;`、反引号）即以脚本用户权限执行命令。
// 2026-07-31 冷启动实验 gpt-5.6-sol 臂发现，源码复核实锤（P0）。
//
// 契约：改 execFileSync 参数数组（ref 不进 shell）+ ref 严格格式校验
// （^[A-Za-z0-9._/-]{1,256}$）+ 恶意 ref 否定测试。
//
// revert 验证：去掉校验/换回 execSync 模板串后，否定测试真红（pwned 文件被创建）。
// ==========================================================================

import assert from 'assert';
import { execFile } from 'child_process';
import { existsSync, rmSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { group, regression, test } from './runner.js';
import { isValidRef } from '../scripts/agent/tag-advisor.mjs';

group('BAR-SEC-15 — tag-advisor ref 注入防护');

// ========== 1. ref 校验器边界（单元，直接 import 不触发 LLM） ==========

test('合法 ref 通过：tag/分支/HEAD/斜杠路径', () => {
  for (const ref of ['v8.3.3', 'HEAD', 'main', 'feature/foo', 'refs/tags/v1.2.3', 'v1.2.3-beta.1', 'a'.repeat(256)]) {
    assert(isValidRef(ref), `应通过: ${JSON.stringify(ref)}`);
  }
});

test('非法 ref 拒绝：shell 元字符/空白/引号/超长', () => {
  const bad = ['', 'a b', 'a;b', '$(touch x)', 'a`b', 'a"b', "a'b", 'a\nb', 'a&b', 'a|b', 'a'.repeat(257)];
  for (const ref of bad) {
    assert(!isValidRef(ref), `应拒绝: ${JSON.stringify(ref)}`);
  }
});

// ========== 2. 恶意 ref 否定测试（子进程实跑：不创建文件 + 非零退出） ==========

const PWN = join(tmpdir(), 'kfm-tag-advisor-pwned');

/** 跑 tag-advisor 并返回 { status, stderr }。非法 ref 应在 LLM 调用前快速退出。 */
function runWithRef(ref: string): Promise<{ status: number; stderr: string }> {
  return new Promise((resolvePromise) => {
    execFile('node', ['scripts/agent/tag-advisor.mjs', ref], { timeout: 15_000 }, (err, _stdout, stderr) => {
      const status = err ? (typeof err.code === 'number' ? err.code : -1) : 0;
      resolvePromise({ status, stderr: String(stderr) });
    });
  });
}

regression('BAR-SEC-15', 'tag-advisor-inject', '`$()` 恶意 ref → 拒绝且不执行命令', async () => {
  if (existsSync(PWN)) rmSync(PWN);
  const { status, stderr } = await runWithRef(`$(touch ${PWN})`);
  assert(!existsSync(PWN), `命令被注入执行：${PWN} 已创建（exit=${status}）——shell 注入实锤`);
  assert(status !== 0, `恶意 ref 应以非零退出，得 ${status}`);
  assert(/非法基准 ref/.test(stderr), `应提示非法 ref，得: ${stderr.slice(0, 120)}`);
});

regression('BAR-SEC-15', 'tag-advisor-inject2', '`;` 命令分隔恶意 ref → 拒绝且不执行', async () => {
  if (existsSync(PWN)) rmSync(PWN);
  const { status, stderr } = await runWithRef(`v8.3.3; touch ${PWN}`);
  assert(!existsSync(PWN), `命令被注入执行：${PWN} 已创建（exit=${status}）`);
  assert(status !== 0, `恶意 ref 应以非零退出，得 ${status}`);
  assert(/非法基准 ref/.test(stderr), `应提示非法 ref，得: ${stderr.slice(0, 120)}`);
});

// ========== 3. 调用形态源码断言 ==========

regression('BAR-SEC-15', 'tag-advisor-execless', 'git log 走 execFileSync 参数数组，无 shell 插值', () => {
  const src = readFileSync(new URL('../scripts/agent/tag-advisor.mjs', import.meta.url), 'utf-8');
  assert(!/execSync\(\s*`git log/.test(src), '存在 shell 模板串插值的 git log 调用——注入面未除');
  assert(/execFileSync\('git', \['log'/.test(src), '缺少 execFileSync 参数数组调用');
});
