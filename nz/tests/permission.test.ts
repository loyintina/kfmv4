/**
 * tests/permission.test.ts — 安全包影子 A+B 档考题（契约 №15 影子期）
 *
 * 影子期 DoD：只记录不拦截（决策全量落日志，零行为变化）。
 *
 * 变异抽检靶子（本文件指定）：
 *   ①riskClassOf 缺省不 fail-closed（如改返回 'read'）→ 「未知工具
 *     fail-closed」钉红；
 *   ②evaluate 不落审计（摘掉 _appendAudit 调用）→ 「判定全量落日志」钉红。
 */
import { Context } from 'cordis';
import { test, group, assert } from './runner.ts';
import { PermissionEngine, declareToolRisk } from '../src/client/permission.ts';

group('permission（安全包影子）');

test('read → allow（永不拦），且落审计', () => {
  const eng = new PermissionEngine();
  eng.declareRisk('read', 'read');
  const d = eng.evaluate({ tool: 'read', params: { path: 'a.md' } });
  assert(d.action === 'allow' && d.rule === 'risk:read', `read 应 allow，实际 ${d.rule}`);
  assert(eng.audit.length === 1 && eng.audit[0].decision === 'allow', '判定应落审计');
});

test('write_local：相对路径界内 allow；roots 内绝对路径 allow', () => {
  const eng = new PermissionEngine();
  eng.declareRisk('write', 'write_local');
  eng.setRoots(['/root/kfmv4']);
  const d1 = eng.evaluate({ tool: 'write', params: { path: 'nz/src/x.ts' } });
  assert(d1.action === 'allow' && d1.rule === 'write_local:in-root', '相对路径应界内');
  const d2 = eng.evaluate({ tool: 'write', params: { path: '/root/kfmv4/nz/src/x.ts' } });
  assert(d2.action === 'allow', 'roots 内绝对路径应 allow');
});

test('write_local：roots 外绝对路径 → ask（带 rule 与 prompt）', () => {
  const eng = new PermissionEngine();
  eng.declareRisk('write', 'write_local');
  eng.setRoots(['/root/kfmv4']);
  const d = eng.evaluate({ tool: 'write', params: { path: '/etc/passwd' } });
  assert(d.action === 'ask' && d.rule === 'write_local:out-of-root', `界外写应 ask，实际 ${d.rule}`);
  assert(d.action === 'ask' && d.prompt.includes('/etc/passwd'), 'ask 应带可解释 prompt');
});

test('write_local：空 path → ask（fail-closed 方向，不放行）', () => {
  const eng = new PermissionEngine();
  eng.declareRisk('write', 'write_local');
  eng.setRoots(['/root/kfmv4']);
  const d = eng.evaluate({ tool: 'write', params: {} });
  assert(d.action === 'ask' && d.rule === 'write_local:out-of-root', '空 path 不应放行');
});

test('exec：含 shell 元字符 → ask；干净命令 → allow', () => {
  const eng = new PermissionEngine();
  eng.declareRisk('bash', 'exec');
  const d1 = eng.evaluate({ tool: 'bash', params: { command: 'ls; rm -rf /' } });
  assert(d1.action === 'ask' && d1.rule === 'exec:shell-meta', '元字符应门控');
  const d2 = eng.evaluate({ tool: 'bash', params: { command: 'ls' } });
  assert(d2.action === 'allow' && d2.rule === 'exec:no-meta', '干净命令应放行');
});

test('external → ask（审批级）', () => {
  const eng = new PermissionEngine();
  eng.declareRisk('kfm-restart', 'external');
  const d = eng.evaluate({ tool: 'kfm-restart' });
  assert(d.action === 'ask' && d.rule === 'external:approval', '外部副作用应审批');
});

test('未知工具 fail-closed：riskClassOf=exec，evaluate=ask（变异靶①）', () => {
  const eng = new PermissionEngine();
  assert(eng.riskClassOf('never-heard-of') === 'exec', '未知工具应按 exec 级处理');
  const d = eng.evaluate({ tool: 'never-heard-of' });
  assert(d.action === 'ask' && d.rule === 'unknown:fail-closed', '未知工具应 fail-closed ask');
});

test('判定全量落日志：每条 evaluate 必落一条审计（变异靶②）', () => {
  const eng = new PermissionEngine();
  eng.declareRisk('read', 'read');
  eng.declareRisk('bash', 'exec');
  eng.evaluate({ tool: 'read' });
  eng.evaluate({ tool: 'bash', params: { command: 'ls' } });
  eng.evaluate({ tool: 'ghost' });
  assert(eng.audit.length === 3, `3 次判定应落 3 条，实际 ${eng.audit.length}`);
  assert(eng.audit.every((e) => e.mode === 'shadow'), '影子期 mode 恒 shadow');
  assert(eng.audit[2].rule === 'unknown:fail-closed', '末条应为未知工具判定');
});

test('审计摘要剥敏感字段：只留 path/command/cwd 前 40 字符', () => {
  const eng = new PermissionEngine();
  eng.declareRisk('bash', 'exec');
  const long = 'x'.repeat(60);
  eng.evaluate({ tool: 'bash', params: { command: long, token: 'sk-secret', path: 'a' } });
  const s = eng.audit[0].paramsSummary;
  assert(!s.includes('sk-secret'), '敏感字段不得入审计');
  assert(s.includes('command=' + 'x'.repeat(40)) && !s.includes('x'.repeat(41)), 'command 应截断 40 字符');
});

test('declareRisk 销户：dispose 后回到未登记（fail-closed）', () => {
  const eng = new PermissionEngine();
  const dispose = eng.declareRisk('tmp', 'read');
  assert(eng.declared('tmp'), '登记后应在册');
  dispose();
  assert(!eng.declared('tmp') && eng.riskClassOf('tmp') === 'exec', '销户后应回 fail-closed');
});

test('ctx.effect 登记：插件 dispose → RiskClass 自动销户（题眼）', async () => {
  const eng = new PermissionEngine();
  const ctx = new Context();
  ctx.provide('permissions', eng);
  const fiber = ctx.plugin((child) => {
    declareToolRisk(child, 'eye-read', 'read');
  });
  await fiber;
  assert(eng.declared('eye-read'), '插件活着登记应在册');
  await fiber.dispose();
  assert(!eng.declared('eye-read'), '插件卸载后登记应自动销户');
});

test('scope 口子：v1 只记录不裁决（per-agent 档位数据口子）', () => {
  const eng = new PermissionEngine();
  eng.declareRisk('read', 'read');
  eng.evaluate({ tool: 'read', scope: 'agent-茉莉' });
  assert(eng.audit[0].scope === 'agent-茉莉', 'scope 标签应落审计');
  eng.evaluate({ tool: 'read' });
  assert(eng.audit[1].scope === undefined, '无 scope 不留字段');
});

test('sink 可注入且故障不阻断判定（转正期接 ledger-service 的口子）', () => {
  const eng = new PermissionEngine();
  eng.declareRisk('read', 'read');
  const got: string[] = [];
  eng.setSink((e) => got.push(e.rule));
  eng.evaluate({ tool: 'read' });
  assert(got.length === 1 && got[0] === 'risk:read', 'sink 应收判定');
  eng.setSink(() => { throw new Error('sink 炸了'); });
  const d = eng.evaluate({ tool: 'read' });
  assert(d.action === 'allow', 'sink 故障不应阻断判定');
});
