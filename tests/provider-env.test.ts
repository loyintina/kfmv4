// ==========================================================================
// tests/provider-env.test.ts — apiKey 代字解析 + 粘贴即入库（fuse-on-save）钉子
//
// 覆盖：
//   1. parseEnv / resolveKey：明文透传、${VAR} 进程 env 优先、.env 兜底、缺失标记
//   2. envNameForProvider：id 大写规范化
//   3. upsertEnvVar：新建/原地更新/保留注释/权限 600
//   4. POST /providers/save 融合路由：明文 key → .env + providers.json 只留代字
//
// 完全离线：数据目录已被 preload（BAR-TEST-ENV-01）重定向到临时目录。
// ==========================================================================

import assert from 'assert';
import { readFileSync, writeFileSync, unlinkSync, statSync } from 'fs';
import { join } from 'path';
import { group, test } from './runner.js';
import {
  ENV_PATH, parseEnv, resolveKey, isEnvRef, envNameForProvider, upsertEnvVar,
} from '../src/server/env-store.js';
import { KFM_DATA_DIR } from '../src/server/path-utils.js';
import { setupProvidersRoutes } from '../src/server/routes/providers.js';
import { findApiProvider } from '../src/server/ai/chat.js';

group('env-store — 代字解析');

test('parseEnv：KEY=VALUE、注释、引号、空行', () => {
  const vars = parseEnv('# 注释\n\nA=1\nB="two words"\nC=\'three\'\n坏行\nD=x=y');
  assert(vars.A === '1' && vars.B === 'two words' && vars.C === 'three' && vars['D'] === 'x=y',
    `解析错误: ${JSON.stringify(vars)}`);
});

test('resolveKey：明文原样透传', () => {
  const r = resolveKey('sk-plaintext-key');
  assert(r.value === 'sk-plaintext-key' && r.missingVar === null);
});

test('resolveKey：${VAR} 进程 env 优先于 .env 文件', () => {
  writeFileSync(ENV_PATH, 'KFM_TEST_PRIO=from-file\n');
  process.env.KFM_TEST_PRIO = 'from-proc';
  try {
    const r = resolveKey('${KFM_TEST_PRIO}');
    assert(r.value === 'from-proc' && r.missingVar === null, `进程 env 未优先: ${JSON.stringify(r)}`);
  } finally { delete process.env.KFM_TEST_PRIO; }
});

test('resolveKey：${VAR} 落 .env 文件兜底', () => {
  delete process.env.KFM_TEST_FALLBACK;
  writeFileSync(ENV_PATH, 'KFM_TEST_FALLBACK=file-value\n');
  const r = resolveKey('${KFM_TEST_FALLBACK}');
  assert(r.value === 'file-value' && r.missingVar === null, `.env 兜底失败: ${JSON.stringify(r)}`);
});

test('resolveKey：引用未设置 → missingVar 人话标记', () => {
  delete process.env.KFM_TEST_MISSING;
  writeFileSync(ENV_PATH, '# 空文件\n');
  const r = resolveKey('${KFM_TEST_MISSING}');
  assert(r.value === '' && r.missingVar === 'KFM_TEST_MISSING', `缺失标记失败: ${JSON.stringify(r)}`);
});

test('isEnvRef：只认整个值是 ${VAR}', () => {
  assert(isEnvRef('${KFM_PROVIDER_X}') && !isEnvRef('sk-xxx') && !isEnvRef('前缀${X}'));
});

test('envNameForProvider：id 大写规范化', () => {
  assert(envNameForProvider('deepseek') === 'KFM_PROVIDER_DEEPSEEK');
  assert(envNameForProvider('Opencode Go Google') === 'KFM_PROVIDER_OPENCODE_GO_GOOGLE');
  assert(envNameForProvider('聚光') === 'KFM_PROVIDER_KEY', `非 ASCII 兜底错误: ${envNameForProvider('聚光')}`);
});

group('env-store — upsertEnvVar');

test('upsertEnvVar：新建文件 → 追加 → 原地更新且保留注释', () => {
  try { unlinkSync(ENV_PATH); } catch {}
  upsertEnvVar('KFM_TEST_A', 'v1');
  upsertEnvVar('KFM_TEST_B', 'b-val');
  let content = readFileSync(ENV_PATH, 'utf-8');
  assert(content.includes('KFM_TEST_A=v1') && content.includes('KFM_TEST_B=b-val'), '追加失败');

  writeFileSync(ENV_PATH, '# 我的注释\nKFM_TEST_A=old\n\nKFM_TEST_KEEP=keep\n');
  upsertEnvVar('KFM_TEST_A', 'new');
  content = readFileSync(ENV_PATH, 'utf-8');
  assert(content.includes('# 我的注释'), '注释丢失');
  assert(content.includes('KFM_TEST_A=new') && !content.includes('KFM_TEST_A=old'), '原地更新失败');
  assert(content.includes('KFM_TEST_KEEP=keep'), '其他变量被误伤');

  const mode = statSync(ENV_PATH).mode & 0o777;
  assert(mode === 0o600, `.env 权限应为 600，得 ${mode.toString(8)}`);
});

group('routes/providers — /providers/save 粘贴即入库');

type Handler = (req: any, res: any) => void;
function collectSaveRoute(): Handler {
  const routes = new Map<string, Handler>();
  const fakeRouter = {
    post: (path: string, ...handlers: Handler[]) => routes.set(`POST ${path}`, handlers[handlers.length - 1]),
  } as any;
  setupProvidersRoutes(fakeRouter);
  return routes.get('POST /providers/save')!;
}
function makeRes() {
  const r: { statusCode: number; body: any } = { statusCode: 200, body: null };
  return { _r: r, status(n: number) { r.statusCode = n; return this; }, json(b: any) { r.body = b; return this; } };
}

test('明文 apiKey → .env 入库 + providers.json 只留代字 + 响应回传代字', () => {
  upsertEnvVar('KFM_TEST_RESET', 'x'); // 确保 .env 存在
  const save = collectSaveRoute();
  const res = makeRes();
  save({ body: { providers: [
    { id: 'deepseek', name: 'deepseek', baseUrl: 'https://api.deepseek.com', apiKey: 'sk-fused-test-123', models: [] },
    { id: 'juguang', name: '聚光', baseUrl: 'https://x', apiKey: '${KFM_PROVIDER_JUGUANG}', models: [] },
  ] } }, res);

  assert(res._r.body?.success === true, `保存失败: ${JSON.stringify(res._r.body)}`);
  const fused = res._r.body.providers;
  assert(fused[0].apiKey === '${KFM_PROVIDER_DEEPSEEK}', `响应未回代字: ${fused[0].apiKey}`);
  assert(fused[1].apiKey === '${KFM_PROVIDER_JUGUANG}', '代字条目被误改写');

  const onDisk = JSON.parse(readFileSync(join(KFM_DATA_DIR, 'providers.json'), 'utf-8'));
  assert(onDisk[0].apiKey === '${KFM_PROVIDER_DEEPSEEK}', 'providers.json 落了明文');

  const envContent = readFileSync(ENV_PATH, 'utf-8');
  assert(envContent.includes('KFM_PROVIDER_DEEPSEEK=sk-fused-test-123'), '.env 未入库');

  // 闭环：代字能被 resolveKey 解回原值
  delete process.env.KFM_PROVIDER_DEEPSEEK;
  const r = resolveKey(onDisk[0].apiKey);
  assert(r.value === 'sk-fused-test-123' && r.missingVar === null, '代字闭环解析失败');
});

test('providers 非数组 → 400', () => {
  const save = collectSaveRoute();
  const res = makeRes();
  save({ body: { providers: 'not-array' } }, res);
  assert(res._r.statusCode === 400, `期望 400，得 ${res._r.statusCode}`);
});

// ==========================================================================
// findApiProvider — BAR-PROVIDER-MATCH-01 回归钉（2026-08-05）
// 事故：旧逻辑只按 id 匹配且静默回退 providers[0]，硅基流动传中文名时
// 全部请求被静默路由到 OpenCode Go GitHub（上游报 Model is not supported），
// 实验臂打到错误网关还以为是目标模型不稳——静默回退 = 数据污染源。
// ==========================================================================

group('findApiProvider — BAR-PROVIDER-MATCH-01 回归钉');

const PROVIDER_POOL = [
  { id: 'opencode-go', name: 'OpenCode Go GitHub', baseUrl: '', apiKey: '', models: [] },
  { id: 'siliconflow', name: '硅基流动', baseUrl: '', apiKey: '', models: [] },
  { id: 'deepseek', name: 'deepseek', baseUrl: '', apiKey: '', models: [] },
];

test('按 id 匹配', () => {
  assert(findApiProvider(PROVIDER_POOL, 'siliconflow')?.id === 'siliconflow');
});

test('按 name 匹配（中文名不再静默打到 providers[0]）', () => {
  const hit = findApiProvider(PROVIDER_POOL, '硅基流动');
  assert(hit?.id === 'siliconflow', `name 匹配失败/路由错: ${hit?.id}`);
});

test('匹配不上 → null（显式报错路径），绝不回退 providers[0]', () => {
  assert(findApiProvider(PROVIDER_POOL, '不存在的网关') === null, '未知 provider 竟有命中');
  assert(findApiProvider(PROVIDER_POOL, undefined) === null, 'undefined 竟有命中');
});
