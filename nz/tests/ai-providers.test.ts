/**
 * tests/ai-providers.test.ts — A 档钉 A6：providers 配置 + 代字 fuse
 *
 * 语义基准 = kfmv4 env-store.ts resolveKey（process.env 优先、.env 其次、
 * mtime 缓存、缺失点名变量绝不裸发代字）× na providers.rs parse_dotenv
 * 行格式（# 注释 / export 前缀 / 成对引号 / = 两侧空白）。
 *
 * na 智谱 401 事故回归（§1.3）：env 变量名必须显式写死在 providers.json
 * 条目里，禁止从 id 自动派生（中文 id 经派生函数全塌缩成同名代字 → 两卡
 * 串号）。本组钉死：两条目显式不同 ${VAR} 各解各的，不串号；模块不出口
 * envNameForProvider 派生函数。
 *
 * 变异抽检靶子（本文件指定）：
 *   ①fuse 缺失裸发代字（missing 时返回 ${VAR} 原文）→ 「绝不裸发」钉红；
 *   ②.env 优先于 process.env（顺序颠倒）→ 「process.env 优先」钉红；
 *   ③自动派生变量名回潮 → 「不出口派生函数」钉红。
 */
import { test, group, assert } from './runner.ts';
import { mkdtempSync, writeFileSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as providers from '../src/server/ai/providers.ts';

group('ai-providers（A6：.env 行格式 + 代字 fuse）');

test('parseEnv：注释 / export 前缀 / 成对引号 / = 两侧空白 / 废行跳过', () => {
  const vars = providers.parseEnv([
    '# 注释行',
    'KFM_A=plain',
    'export KFM_B=exported',
    'KFM_C = "double quoted"',
    "KFM_D='single quoted'",
    'KFM_E=  value with spaces  ',
    '废行无等号',
    '=空键跳过',
    '',
  ].join('\n'));
  assert(vars.KFM_A === 'plain', '普通行');
  assert(vars.KFM_B === 'exported', 'export 前缀（na parse_dotenv 同语义）');
  assert(vars.KFM_C === 'double quoted', '双引号剥离');
  assert(vars.KFM_D === 'single quoted', '单引号剥离');
  assert(vars.KFM_E === 'value with spaces', '两侧空白修剪');
  assert(!('=' in vars) && Object.keys(vars).length === 5, '废行/空键/空行跳过');
});

function mkConfig(providersJson: unknown, envContent: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'nz-ai-cfg-'));
  writeFileSync(join(dir, 'providers.json'), JSON.stringify(providersJson));
  writeFileSync(join(dir, '.env'), envContent);
  return dir;
}

test('代字 fuse：process.env 优先，.env 其次', () => {
  const dir = mkConfig([], 'KFM_FUSE_T1=from-dotenv\n');
  process.env.KFM_FUSE_T1 = 'from-process';
  try {
    assert(providers.resolveKey('${KFM_FUSE_T1}', dir).value === 'from-process', 'process.env 应优先');
  } finally {
    delete process.env.KFM_FUSE_T1;
  }
  assert(providers.resolveKey('${KFM_FUSE_T1}', dir).value === 'from-dotenv', '.env 兜底');
});

test('代字 fuse：变量缺失 → missingVar 点名，value 为空绝不裸发代字', () => {
  const dir = mkConfig([], '');
  const r = providers.resolveKey('${KFM_FUSE_MISSING}', dir);
  assert(r.missingVar === 'KFM_FUSE_MISSING', '缺失应点名变量名');
  assert(r.value === '' && !r.value.includes('${'), '绝不裸发 ${VAR} 代字（fuse 断在 server）');
  const plain = providers.resolveKey('sk-plain-key', dir);
  assert(plain.value === 'sk-plain-key' && plain.missingVar === null, '明文 key 原样使用');
  const embedded = providers.resolveKey('prefix-${KFM_FUSE_T1}', dir);
  assert(embedded.value === 'prefix-${KFM_FUSE_T1}' && embedded.missingVar === null,
    '非整体代字不展开（kfmv4 ENV_REF_RE 全串锚定语义）');
});

test('.env mtime 缓存：文件变更后重读生效（保存即生效）', () => {
  const dir = mkConfig([], 'KFM_FUSE_T2=v1\n');
  assert(providers.loadEnvFile(dir).KFM_FUSE_T2 === 'v1', '初读 v1');
  writeFileSync(join(dir, '.env'), 'KFM_FUSE_T2=v2\n');
  utimesSync(join(dir, '.env'), new Date(), new Date(Date.now() + 5000)); // 保证 mtime 变化
  assert(providers.loadEnvFile(dir).KFM_FUSE_T2 === 'v2', 'mtime 变化后应重读');
});

test('na 智谱 401 事故回归：两条目显式不同 ${VAR} 各解各的不串号；禁自动派生', () => {
  // 事故实录：智谱卡与聚光卡共用 ${KFM_PROVIDER_KEY}（中文 id 经派生函数塌缩同名）
  const dir = mkConfig([
    { id: '智谱', name: '智谱', baseUrl: 'https://open.bigmodel.cn/api/coding/paas/v4', apiKey: '${KFM_PROVIDER_ZHIPU}', models: ['glm-5.3-flash'] },
    { id: '聚光', name: '聚光', baseUrl: 'https://example.invalid/v1', apiKey: '${KFM_PROVIDER_JUGUANG}', models: ['x'] },
  ], 'KFM_PROVIDER_ZHIPU=zhipu-key\nKFM_PROVIDER_JUGUANG=juguang-key\n');
  const list = providers.loadProviders(dir);
  assert(list.length === 2, '两条目都应载入');
  const zhipu = providers.findProvider(list, '智谱');
  const juguang = providers.findProvider(list, '聚光');
  assert(zhipu !== null && juguang !== null, '按 id/name 都应匹配');
  assert(providers.resolveKey(zhipu!.apiKey, dir).value === 'zhipu-key', '智谱解智谱的 key');
  assert(providers.resolveKey(juguang!.apiKey, dir).value === 'juguang-key', '聚光解聚光的 key，不串号');
  assert(!('envNameForProvider' in providers), '禁出口 id→变量名派生函数（塌缩源头）');
});

test('provider 匹配：id 或 name，无静默回退（BAR-PROVIDER-MATCH-01）', () => {
  const list = [{ id: 'Kimi', name: 'Kimi', baseUrl: 'https://x', apiKey: 'k', models: ['m'] }];
  assert(providers.findProvider(list, 'Kimi')?.id === 'Kimi', 'id/name 匹配');
  assert(providers.findProvider(list, '不存在') === null, '匹配不上 → null，无静默回退 providers[0]');
  assert(providers.findProvider(list, undefined) === null, '未指定 → null');
});
