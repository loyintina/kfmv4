import assert from 'assert';
import { regression } from './harness.js';
import { mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// 测试重定向审计日志到临时目录（防污染史官账本——KFM_AUDIT_PATH 覆盖）
const auditTmp = mkdtempSync(join(tmpdir(), 'perm-audit-'));
process.env.KFM_AUDIT_PATH = join(auditTmp, 'audit.jsonl');

regression('BAR-PERM-01', 'riskclass-mapping', '工具 RiskClass 映射完整（read 永不 gate / bash=exec / restart=external）', async () => {
  const { riskClassOf, TOOL_RISK } = await import('../src/server/ai/permissions.js');
  assert.strictEqual(riskClassOf('read'), 'read');
  assert.strictEqual(riskClassOf('glob'), 'read');
  assert.strictEqual(riskClassOf('grep'), 'read');
  assert.strictEqual(riskClassOf('bash'), 'exec');
  assert.strictEqual(riskClassOf('browser_eval'), 'exec');
  assert.strictEqual(riskClassOf('kfm-restart'), 'external');
  assert.strictEqual(riskClassOf('write'), 'write_local');
  assert.strictEqual(riskClassOf('unknown-tool'), 'exec', '未知工具默认 exec 级（fail-closed 方向）');
  // 注册表覆盖度：核心工具都有映射
  for (const t of ['read', 'write', 'edit', 'bash', 'glob', 'grep', 'eval', 'todo', 'checkpoint', 'rewind', 'browser', 'browser_eval', 'debug', 'web_search', 'kfm-logs', 'kfm-restart']) {
    assert(TOOL_RISK[t], `工具 ${t} 缺 RiskClass 登记`);
  }
});

regression('BAR-PERM-02', 'evaluate-decisions', 'evaluate 判定：read 放行 / bash 元字符 ask / 外部 ask / 未知 ask', async () => {
  const { evaluate } = await import('../src/server/ai/permissions.js');
  const ctx = { cwd: '/tmp/proj' };
  assert.strictEqual(evaluate('read', { path: '/tmp/proj/a.md' }, ctx).action, 'allow');
  assert.strictEqual(evaluate('bash', { command: 'git status' }, ctx).action, 'allow', '无元字符命令放行');
  assert.strictEqual(evaluate('bash', { command: 'git status && rm -rf ~' }, ctx).action, 'ask', '含元字符应 ask');
  assert.strictEqual(evaluate('kfm-restart', {}, ctx).action, 'ask', '外部副作用 ask');
  assert.strictEqual(evaluate('nonexistent-tool', {}, ctx).action, 'ask', '未知工具 ask（fail-closed）');
});

regression('BAR-PERM-03', 'audit-log-written', '审计日志落盘（permission-audit.jsonl）', async () => {
  const { evaluate } = await import('../src/server/ai/permissions.js');
  // 触发一次 evaluate 产生审计条目
  evaluate('read', { path: '/tmp/x.md' }, { cwd: '/tmp' });
  const log = join(process.env.HOME || '', '.kfmv4', 'permission-audit.jsonl');
  const { existsSync } = await import('fs');
  assert(existsSync(log), '审计日志应存在');
  const tail = readFileSync(log, 'utf-8').trim().split('\n').pop();
  const entry = JSON.parse(tail);
  assert.strictEqual(entry.tool, 'read');
  assert(entry.riskClass && entry.ts && entry.rule, '审计条目字段完整');
});
