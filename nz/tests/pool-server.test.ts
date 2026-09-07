/**
 * tests/pool-server.test.ts — 配置池 A2a 考卷 A 档（阶段一：server 统一池数据层）
 *
 * 语义基准 = 设计清单 §二（统一池数据层：路由族形状/错误语义/池描述表）
 *   §2.4（激活总账 active.json：schema={providerId,modelId,roleFile,sessionId}，
 *        砍 configFile；nz 侧 /pool/active 唯一门）
 *   §2.5（relied 守卫：被引用+激活中禁删 409{error,reliedBy}；断引用降级不崩）
 *   §2.6（密钥代字 fuse-on-save：明文落 .env chmod 600、池文件只留 ${VAR}、
 *        撞名 _2 后缀、响应/日志永不出明文——P4）
 *   §三（四池 schema：provider 单文件数组例外 / role 目录一文件一条目 /
 *        session 核心壳 messages 恒空禁写（仲裁①）/ basic 只读聚合视图）
 *
 * 七钉：
 *   A1 四池 CRUD round-trip（create→list→update→delete），目录型一文件一条目落盘互证
 *   A2 代字 fuse-on-save 三处落点（池文件只留 ${VAR} / .env 落明文 chmod 600 /
 *      响应无明文）+ 撞名 _2 后缀 + 旧明文条目读取掩码（P4）
 *   A3 relied 守卫：删被 session 引用的 provider → 409+reliedBy；删激活条目 → 拒；
 *      断引用列表降级不崩（dangling 标注）；/pool/:pool/:id/reliers 查引用
 *   A4 激活双态：update 条目不动总账；POST /pool/active 部分更新只改指定字段；
 *      未知字段（configFile 已砍）→ 400
 *   A5 schema 校验：坏 role/session/provider 条目 → 400 人话不写盘；
 *      session messages 非空 → 400（仲裁① 禁写）
 *   A6 providers.json 兼容联动：池层写后 A1 loadProviders 照读、数组保序、
 *      /ai/providers 投影即变、写侧 fuse 出的 ${VAR} 被 A1 读侧 resolveKey 解通
 *      （A1 旧钉不回退的联动证明）
 *
 * 变异抽检靶子（本文件指定）：
 *   ①fuse 缺失裸发明文（fuseEntry 不写 .env / 池文件落明文）→ A2 钉红；
 *   ②守卫删除（relied/激活中照样删）→ A3 钉红；
 *   ③edit 偷写总账（update 顺手写 active.json）→ A4 钉红。
 */
import { test, group, assert } from './runner.ts';
import type { Server } from 'node:http';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createNzServer } from '../src/server/index.ts';
import * as aiProviders from '../src/server/ai/providers.ts';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function listen(server: Server): Promise<number> {
  return new Promise((resolveListen) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolveListen(typeof addr === 'object' && addr ? addr.port : 0);
    });
  });
}

/** env 现场保护：设值 → 跑 → 还原（ai-server.test.ts 同款） */
async function withEnv<T>(vars: Record<string, string>, fn: () => Promise<T>): Promise<T> {
  const saved: Record<string, string | undefined> = {};
  for (const k of Object.keys(vars)) { saved[k] = process.env[k]; process.env[k] = vars[k]; }
  try {
    return await fn();
  } finally {
    for (const k of Object.keys(vars)) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}

/** 临时 ~/.kfmv4 夹具（NZ_AI_CONFIG_DIR 同款机制，§2.2 池层共用） */
function mkConfigDir(seed: {
  providers?: unknown[];
  env?: string;
  active?: Record<string, unknown>;
  roles?: Record<string, unknown>;
  sessions?: Record<string, unknown>;
} = {}): string {
  const dir = mkdtempSync(join(tmpdir(), 'nz-pool-'));
  mkdirSync(join(dir, 'agents', 'roles'), { recursive: true });
  mkdirSync(join(dir, 'sessions'), { recursive: true });
  writeFileSync(join(dir, 'providers.json'), JSON.stringify(seed.providers ?? []));
  if (seed.env !== undefined) writeFileSync(join(dir, '.env'), seed.env);
  if (seed.active) writeFileSync(join(dir, 'active.json'), JSON.stringify(seed.active));
  for (const [id, entry] of Object.entries(seed.roles ?? {})) {
    writeFileSync(join(dir, 'agents', 'roles', `${id}.json`), JSON.stringify(entry));
  }
  for (const [id, entry] of Object.entries(seed.sessions ?? {})) {
    writeFileSync(join(dir, 'sessions', `${id}.json`), JSON.stringify(entry));
  }
  return dir;
}

interface Rig { port: number; close: () => void }

async function startRig(dir: string, extraEnv: Record<string, string> = {}): Promise<Rig> {
  const server = createNzServer();
  const port = await listen(server);
  void extraEnv;
  return { port, close: () => server.close() };
}

async function req(port: number, method: string, path: string, body?: unknown): Promise<{ status: number; json: any; raw: string }> {
  const resp = await fetch(`http://127.0.0.1:${port}${path}`, {
    method,
    headers: body !== undefined ? { 'content-type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const raw = await resp.text();
  let json: any = null;
  try { json = JSON.parse(raw); } catch { /* 非 JSON 响应留给断言 */ }
  return { status: resp.status, json, raw };
}

const PLAIN_KEY = 'sk-plain-SECRET-pool-a2-9f8e7d';

// ==========================================================================
group('pool-server（A1：四池 CRUD round-trip）');

test('/pool/list：池描述表投影四池齐全（pool/title/readonly/count），基本池只读', async () => {
  const dir = mkConfigDir({
    providers: [{ id: 'P1', name: 'P1', baseUrl: 'https://x', apiKey: '', models: ['m1'] }],
    roles: { 'r1': { id: 'r1', name: 'r1', promptFiles: [], dynamicPromptFiles: [], createdAt: 't', updatedAt: 't' } },
  });
  await withEnv({ NZ_AI_CONFIG_DIR: dir }, async () => {
    const rig = await startRig(dir);
    try {
      const { status, json } = await req(rig.port, 'GET', '/pool/list');
      assert(status === 200, `/pool/list 应 200，实际 ${status}`);
      assert(Array.isArray(json), '投影应为数组');
      const ids = json.map((p: any) => p.pool).sort();
      assert(JSON.stringify(ids) === JSON.stringify(['basic', 'provider', 'session']),
        `三池应在册（prompt 2026-09-07 退役），实际 ${ids.join(',')}`);
      for (const p of json) {
        assert(typeof p.title === 'string' && p.title.length > 0, `${p.pool} 应有 title`);
        assert(typeof p.count === 'number', `${p.pool} 应有 count`);
      }
      const basic = json.find((p: any) => p.pool === 'basic');
      assert(basic.readonly === true, '基本池应为只读聚合视图（§3.1）');
      const provider = json.find((p: any) => p.pool === 'provider');
      assert(provider.count === 1, `provider count 应为 1，实际 ${provider.count}`);
    } finally { rig.close(); }
  });
});

test('provider CRUD round-trip + 数组保序（A6 同源：文件顺序=数组顺序）', async () => {
  const dir = mkConfigDir();
  await withEnv({ NZ_AI_CONFIG_DIR: dir }, async () => {
    const rig = await startRig(dir);
    try {
      const mk = (id: string) => ({ id, name: id, baseUrl: 'https://x', apiKey: '', models: [`${id}-m1`] });
      for (const id of ['PA', 'PB', 'PC']) {
        const r = await req(rig.port, 'POST', '/pool/provider/create', { entry: mk(id) });
        assert(r.status === 200 && r.json.entry?.id === id, `create ${id} 应 200 回 entry，实际 ${r.status} ${r.raw}`);
      }
      let list = (await req(rig.port, 'GET', '/pool/provider')).json as any[];
      assert(JSON.stringify(list.map((e) => e.id)) === JSON.stringify(['PA', 'PB', 'PC']), 'create 后数组保序');
      const upd = await req(rig.port, 'POST', '/pool/provider/PB/update', { entry: { ...mk('PB'), name: 'PB改', models: ['x', 'y'] } });
      assert(upd.status === 200 && upd.json.entry.name === 'PB改' && upd.json.entry.models.length === 2, 'update 应回新 entry');
      list = (await req(rig.port, 'GET', '/pool/provider')).json as any[];
      assert(list[1].name === 'PB改' && list.length === 3, 'update 后保序原位替换');
      const del = await req(rig.port, 'POST', '/pool/provider/PB/delete');
      assert(del.status === 200 && del.json.ok === true, `delete 应 200{ok}，实际 ${del.status} ${del.raw}`);
      list = (await req(rig.port, 'GET', '/pool/provider')).json as any[];
      assert(JSON.stringify(list.map((e) => e.id)) === JSON.stringify(['PA', 'PC']), 'delete 后保序');
      // 文件互证（L2：磁盘是事实）
      const onDisk = JSON.parse(readFileSync(join(dir, 'providers.json'), 'utf-8')) as any[];
      assert(JSON.stringify(onDisk.map((e) => e.id)) === JSON.stringify(['PA', 'PC']), 'providers.json 磁盘保序一致');
      const again = await req(rig.port, 'POST', '/pool/provider/PA/delete');
      assert(again.status === 200, '删第二条应 200');
      const ghost = await req(rig.port, 'POST', '/pool/provider/NOPE/delete');
      assert(ghost.status === 404, `删不存在条目应 404，实际 ${ghost.status}`);
      const dup = await req(rig.port, 'POST', '/pool/provider/create', { entry: mk('PC') });
      assert(dup.status === 409, `重复 id create 应 409，实际 ${dup.status}`);
    } finally { rig.close(); }
  });
});

test('session CRUD round-trip：核心壳（messages 恒空）+ 改名保 messages 禁写（仲裁①）', async () => {
  const dir = mkConfigDir();
  await withEnv({ NZ_AI_CONFIG_DIR: dir }, async () => {
    const rig = await startRig(dir);
    try {
      const c = await req(rig.port, 'POST', '/pool/session/create', { entry: { title: '新会话' } });
      assert(c.status === 200 && c.json.entry?.id === '新会话', `session create 应 200 且 id=文件名裸名，实际 ${c.status} ${c.raw}`);
      assert(JSON.stringify(c.json.entry.messages) === JSON.stringify([]), '新建会话 messages 恒空数组');
      const file = join(dir, 'sessions', '新会话.json');
      assert(existsSync(file), 'sessions/<id>.json 应落盘');
      const onDisk = JSON.parse(readFileSync(file, 'utf-8')) as any;
      assert(JSON.stringify(onDisk.messages) === JSON.stringify([]), '磁盘 messages 恒空（任何件禁写，P5）');
      assert(typeof onDisk.createdAt === 'string' && typeof onDisk.updatedAt === 'string', '壳字段齐全');
      // 改名（v0 壳管理语义）
      const u = await req(rig.port, 'POST', '/pool/session/新会话/update', { entry: { title: '改名后' } });
      assert(u.status === 200 && u.json.entry.title === '改名后', `改名应 200，实际 ${u.status} ${u.raw}`);
      // 与 kfmv4 双端共存：带 messages/压缩字段的 8.x 会话改名不毁数据
      writeFileSync(join(dir, 'sessions', '老会话.json'), JSON.stringify({
        id: '老会话', title: '老会话', createdAt: 't0', updatedAt: 't0',
        providerId: 'ghost-p', modelId: 'ghost-m', messageCount: 999,
        messages: [{ role: 'user', content: [{ type: 'text', text: '双端共存证据' }] }],
      }));
      const u2 = await req(rig.port, 'POST', '/pool/session/老会话/update', { entry: { title: '老会话改名' } });
      assert(u2.status === 200, `8.x 会话改名应 200，实际 ${u2.status} ${u2.raw}`);
      const old = JSON.parse(readFileSync(join(dir, 'sessions', '老会话.json'), 'utf-8')) as any;
      assert(old.title === '老会话改名' && old.messageCount === 999
        && old.messages[0].content[0].text === '双端共存证据',
        '改名不得毁 8.x 既有字段与 messages（双端共读）');
      // 列表投影 = 核心壳（messages 投影为空，不出全文）
      const list = (await req(rig.port, 'GET', '/pool/session')).json as any[];
      const proj = list.find((e) => e.id === '老会话');
      assert(proj && JSON.stringify(proj.messages) === JSON.stringify([]), '列表 messages 投影恒空');
      assert(!JSON.stringify(list).includes('双端共存证据'), '列表不得出消息全文');
      const d = await req(rig.port, 'POST', '/pool/session/改名后/delete');
      // 注意：delete 按 id（文件名裸名），改名改的是 title 不是 id
      assert(d.status === 404, 'title 不是 id，按 title 删应 404');
      const d2 = await req(rig.port, 'POST', '/pool/session/新会话/delete');
      assert(d2.status === 200 && !existsSync(file), '按 id 删应 200 并摘除文件');
    } finally { rig.close(); }
  });
});

test('basic 池：只读聚合视图（激活总账 UI 化）+ 失效槽位降级标注 + 禁写', async () => {
  const dir = mkConfigDir({
    providers: [{ id: 'P1', name: 'P1', baseUrl: 'https://x', apiKey: '', models: ['m1', 'm2'] }],
    roles: { 'r1': { id: 'r1', name: 'r1', promptFiles: [], dynamicPromptFiles: [], createdAt: 't', updatedAt: 't' } },
    active: { providerId: 'P1', modelId: 'm1', roleFile: 'r1', sessionId: 'ghost-session', configFile: '已砍字段' },
  });
  await withEnv({ NZ_AI_CONFIG_DIR: dir }, async () => {
    const rig = await startRig(dir);
    try {
      const { status, json } = await req(rig.port, 'GET', '/pool/basic');
      assert(status === 200, 'GET /pool/basic 应 200');
      assert(Array.isArray(json) && json.length === 2, '基本池=两个激活槽位行（§3.1；role 槽 2026-09-07 退役）');
      const slotP = json.find((s: any) => s.id === 'provider');
      assert(slotP.providerId === 'P1' && slotP.modelId === 'm1' && slotP.dangling === false,
        `provider 槽位应有效，实际 ${JSON.stringify(slotP)}`);
      const slotS = json.find((s: any) => s.id === 'session');
      assert(slotS.sessionId === 'ghost-session' && slotS.dangling === true,
        `失效激活会话应标 dangling 不崩（§2.5 降级首个兑现），实际 ${JSON.stringify(slotS)}`);
      const w = await req(rig.port, 'POST', '/pool/basic/create', { entry: {} });
      assert(w.status === 400, `只读池禁写应 400，实际 ${w.status}`);
    } finally { rig.close(); }
  });
});

// ==========================================================================
group('pool-fuse（A2：密钥代字 fuse-on-save 三处落点，P4）');

test('明文 key POST → 池文件只留 ${VAR}、.env 落明文 chmod 600、响应无明文', async () => {
  const dir = mkConfigDir({ env: '# 注释行应保留\n' });
  await withEnv({ NZ_AI_CONFIG_DIR: dir }, async () => {
    const rig = await startRig(dir);
    try {
      const r = await req(rig.port, 'POST', '/pool/provider/create', {
        entry: { id: 'Zhipu', name: '智谱', baseUrl: 'https://open.bigmodel.cn/api/coding/paas/v4', apiKey: PLAIN_KEY, models: ['glm-5.3-flash'] },
      });
      assert(r.status === 200, `create 应 200，实际 ${r.status} ${r.raw}`);
      // 落点③：响应无明文（整个 body grep）
      assert(!r.raw.includes(PLAIN_KEY), 'create 响应不得出明文 key（P4）');
      assert(typeof r.json.entry.apiKey === 'string' && /^\$\{[A-Z0-9_]+\}$/.test(r.json.entry.apiKey),
        `响应 apiKey 应为代字形态，实际 ${r.json.entry.apiKey}`);
      const varName = /^\$\{([A-Z0-9_]+)\}$/.exec(r.json.entry.apiKey)![1];
      // 落点①：池文件只留 ${VAR}
      const diskRaw = readFileSync(join(dir, 'providers.json'), 'utf-8');
      assert(!diskRaw.includes(PLAIN_KEY), 'providers.json 不得落明文（fuse-on-save）');
      assert(diskRaw.includes('${' + varName + '}'), 'providers.json 应落代字');
      // 落点②：.env 落明文 + chmod 600 + 注释行保留
      const envRaw = readFileSync(join(dir, '.env'), 'utf-8');
      assert(envRaw.includes(`${varName}=${PLAIN_KEY}`), '.env 应落明文 VAR=值');
      assert(envRaw.includes('# 注释行应保留'), 'upsertEnvVar 应保留注释行');
      assert((statSync(join(dir, '.env')).mode & 0o777) === 0o600,
        `.env 应 chmod 600，实际 ${(statSync(join(dir, '.env')).mode & 0o777).toString(8)}`);
      // GET 列表同样只出代字
      const list = await req(rig.port, 'GET', '/pool/provider');
      assert(!list.raw.includes(PLAIN_KEY) && list.raw.includes('${' + varName + '}'), 'GET 列表只出代字形态');
    } finally { rig.close(); }
  });
});

test('撞名 _2 后缀：两条目派生同变量名 → 第二条 _2；已是代字/空值原样透传', async () => {
  const dir = mkConfigDir();
  await withEnv({ NZ_AI_CONFIG_DIR: dir }, async () => {
    const rig = await startRig(dir);
    try {
      const k1 = 'sk-collision-one-111';
      const k2 = 'sk-collision-two-222';
      // 'foo bar' 与 'foo-bar' 大写规范化后同塌缩为 KFM_PROVIDER_FOO_BAR（na 401 同族地形）
      const r1 = await req(rig.port, 'POST', '/pool/provider/create', {
        entry: { id: 'foo bar', name: 'foo bar', baseUrl: 'https://x', apiKey: k1, models: [] },
      });
      const r2 = await req(rig.port, 'POST', '/pool/provider/create', {
        entry: { id: 'foo-bar', name: 'foo-bar', baseUrl: 'https://x', apiKey: k2, models: [] },
      });
      assert(r1.status === 200 && r2.status === 200, '两 create 都应 200');
      const v1 = r1.json.entry.apiKey as string;
      const v2 = r2.json.entry.apiKey as string;
      assert(v1 !== v2, `撞名必须分叉（_2 后缀），实际 ${v1} vs ${v2}`);
      assert(v2.endsWith('_2}'), `第二条应以 _2 后缀，实际 ${v2}`);
      const envRaw = readFileSync(join(dir, '.env'), 'utf-8');
      const n1 = /^\$\{(.+)\}$/.exec(v1)![1];
      const n2 = /^\$\{(.+)\}$/.exec(v2)![1];
      assert(envRaw.includes(`${n1}=${k1}`) && envRaw.includes(`${n2}=${k2}`), '两变量各落各的 key 不串号');
      // 代字/空值透传
      const r3 = await req(rig.port, 'POST', '/pool/provider/create', {
        entry: { id: 'manual', name: 'manual', baseUrl: 'https://x', apiKey: '${KFM_MANUAL_VAR}', models: [] },
      });
      assert(r3.status === 200 && r3.json.entry.apiKey === '${KFM_MANUAL_VAR}', '已是代字原样透传（显式写死纪律）');
      const r4 = await req(rig.port, 'POST', '/pool/provider/create', {
        entry: { id: 'nokey', name: 'nokey', baseUrl: 'https://x', apiKey: '', models: [] },
      });
      assert(r4.status === 200 && r4.json.entry.apiKey === '', '空值原样透传');
    } finally { rig.close(); }
  });
});

test('旧明文条目读取掩码（P4）：预置明文 key 的 providers.json，GET 不出明文；update 空 apiKey 不毁已存 key', async () => {
  const LEGACY = 'sk-legacy-plain-bbb-legacy';
  const dir = mkConfigDir({
    providers: [{ id: 'old', name: 'old', baseUrl: 'https://x', apiKey: LEGACY, models: ['m'] }],
  });
  await withEnv({ NZ_AI_CONFIG_DIR: dir }, async () => {
    const rig = await startRig(dir);
    try {
      const list = await req(rig.port, 'GET', '/pool/provider');
      assert(list.status === 200, 'GET 应 200');
      assert(!list.raw.includes(LEGACY), '旧明文条目读取必须掩码（响应出明文=钉红，P4）');
      // update 带空 apiKey = 未改动，不得把已存 key 抹掉
      const u = await req(rig.port, 'POST', '/pool/provider/old/update', {
        entry: { id: 'old', name: 'old改', baseUrl: 'https://x', apiKey: '', models: ['m'] },
      });
      assert(u.status === 200, `update 应 200，实际 ${u.status} ${u.raw}`);
      const onDisk = JSON.parse(readFileSync(join(dir, 'providers.json'), 'utf-8')) as any[];
      assert(onDisk[0].name === 'old改', '空 apiKey 更新应只改 name');
      // 不毁已存 key：fuse-on-save 语义下旧明文可能被顺势转正（kfmv4 /providers/save
      // 同语义——任何保存过 fuse），不变量 = key 不丢，resolveKey 仍解出原值
      const resolved = aiProviders.resolveKey(onDisk[0].apiKey, dir);
      assert(resolved.value === LEGACY && resolved.missingVar === null,
        `已存 key 不得丢失（fuse 转正后 .env 应兜底），实际 ${JSON.stringify(resolved)}`);
      // 贴新明文 → fuse 转正：从此池文件只留代字
      const NEWK = 'sk-legacy-rotated-ccc';
      const u2 = await req(rig.port, 'POST', '/pool/provider/old/update', {
        entry: { id: 'old', name: 'old改', baseUrl: 'https://x', apiKey: NEWK, models: ['m'] },
      });
      assert(u2.status === 200 && !u2.raw.includes(NEWK), '换 key 响应无明文');
      const disk2 = readFileSync(join(dir, 'providers.json'), 'utf-8');
      assert(!disk2.includes(NEWK) && !disk2.includes(LEGACY), '换 key 后池文件新旧明文都不留');
      const envRaw = readFileSync(join(dir, '.env'), 'utf-8');
      assert(envRaw.includes(NEWK), '新 key 应落 .env');
    } finally { rig.close(); }
  });
});

// ==========================================================================
group('pool-guard（A3：relied 守卫 + 断引用降级）');

test('删被 session 引用的 provider → 409{error,reliedBy} 人话；/reliers 查引用', async () => {
  const dir = mkConfigDir({
    providers: [
      { id: 'P1', name: 'P1', baseUrl: 'https://x', apiKey: '', models: ['m1'] },
      { id: 'P2', name: 'P2', baseUrl: 'https://x', apiKey: '', models: ['m9'] },
    ],
    sessions: {
      's1': { id: 's1', title: 's1', createdAt: 't', updatedAt: 't', providerId: 'P1', modelId: 'm1', messages: [] },
      's2': { id: 's2', title: 's2', createdAt: 't', updatedAt: 't', providerId: 'P1', modelId: 'm9', messages: [] },
    },
  });
  await withEnv({ NZ_AI_CONFIG_DIR: dir }, async () => {
    const rig = await startRig(dir);
    try {
      const rel = await req(rig.port, 'GET', '/pool/provider/P1/reliers');
      assert(rel.status === 200 && Array.isArray(rel.json.reliers), 'reliers 应 200 出数组');
      const relPairs = rel.json.reliers.map((r: any) => `${r.pool}:${r.id}:${r.field}`).sort();
      assert(relPairs.includes('session:s1:providerId') && relPairs.includes('session:s2:providerId'),
        `reliers 应点名两个 session 的 providerId 引用，实际 ${relPairs.join(',')}`);
      const del = await req(rig.port, 'POST', '/pool/provider/P1/delete');
      assert(del.status === 409, `被引用删除应 409，实际 ${del.status} ${del.raw}`);
      assert(typeof del.json.error === 'string' && del.json.error.length > 0, '409 应带人话 error');
      assert(Array.isArray(del.json.reliedBy) && del.json.reliedBy.length === 2,
        `reliedBy 应两处，实际 ${JSON.stringify(del.json.reliedBy)}`);
      const list = (await req(rig.port, 'GET', '/pool/provider')).json as any[];
      assert(list.length === 2, '409 后条目仍在（守卫不删）');
      // P2 只被 s2 的 modelId 引用（modelId → provider.models 匹配）
      const del2 = await req(rig.port, 'POST', '/pool/provider/P2/delete');
      assert(del2.status === 409, 'modelId 引用也应拦截（session.modelId → provider 池条目）');
      // 摘掉引用后放行
      const u = await req(rig.port, 'POST', '/pool/session/s1/update', { entry: { title: 's1', providerId: '', modelId: '' } });
      assert(u.status === 200, 'session update 应 200');
      const u2 = await req(rig.port, 'POST', '/pool/session/s2/update', { entry: { title: 's2', providerId: '', modelId: '' } });
      assert(u2.status === 200, 'session update2 应 200');
      const del3 = await req(rig.port, 'POST', '/pool/provider/P1/delete');
      assert(del3.status === 200, '引用摘净后删除应放行');
    } finally { rig.close(); }
  });
});

test('激活中条目视同 relied 禁删（先切走再删）：provider/role/session 三池', async () => {
  const dir = mkConfigDir({
    providers: [
      { id: 'P1', name: 'P1', baseUrl: 'https://x', apiKey: '', models: ['m1'] },
      { id: 'P2', name: 'P2', baseUrl: 'https://x', apiKey: '', models: ['m2'] },
    ],
    roles: { 'r1': { id: 'r1', name: 'r1', promptFiles: [], dynamicPromptFiles: [], createdAt: 't', updatedAt: 't' } },
    sessions: { 's1': { id: 's1', title: 's1', createdAt: 't', updatedAt: 't', messages: [] } },
    active: { providerId: 'P1', modelId: 'm1', roleFile: 'r1', sessionId: 's1' },
  });
  await withEnv({ NZ_AI_CONFIG_DIR: dir }, async () => {
    const rig = await startRig(dir);
    try {
      const dP = await req(rig.port, 'POST', '/pool/provider/P1/delete');
      assert(dP.status === 409 && dP.json.reliedBy.some((r: any) => r.pool === 'active'),
        `激活中 provider 禁删，实际 ${dP.status} ${dP.raw}`);
      const dS = await req(rig.port, 'POST', '/pool/session/s1/delete');
      assert(dS.status === 409, '激活中 session 禁删');
      // 切走后放行
      const sw = await req(rig.port, 'POST', '/pool/active', { providerId: 'P2', modelId: 'm2' });
      assert(sw.status === 200, '切激活应 200');
      const dP2 = await req(rig.port, 'POST', '/pool/provider/P1/delete');
      assert(dP2.status === 200, '切走后删 provider 放行');
      // 非激活的 P2 变激活后同样被守
      const dP3 = await req(rig.port, 'POST', '/pool/provider/P2/delete');
      assert(dP3.status === 409, '新激活项立即受守（总账即事实）');
    } finally { rig.close(); }
  });
});

test('断引用降级不崩：session 指向不存在 provider → 列表照出 + dangling 标注', async () => {
  const dir = mkConfigDir({
    sessions: {
      's1': { id: 's1', title: 's1', createdAt: 't', updatedAt: 't', providerId: 'ghost', modelId: 'ghost-m', messages: [] },
    },
  });
  await withEnv({ NZ_AI_CONFIG_DIR: dir }, async () => {
    const rig = await startRig(dir);
    try {
      const list = await req(rig.port, 'GET', '/pool/session');
      assert(list.status === 200, '断引用不得抛错/拦列表（9.0 契约 №3 验收项）');
      const s1 = (list.json as any[]).find((e) => e.id === 's1');
      assert(!!s1, '断引用条目照出');
      assert(Array.isArray(s1.dangling) && s1.dangling.includes('providerId') && s1.dangling.includes('modelId'),
        `断引用字段应标 dangling（已失效），实际 ${JSON.stringify(s1.dangling)}`);
    } finally { rig.close(); }
  });
});

// ==========================================================================
group('pool-active（A4：激活双态 + 总账 schema）');

test('update 条目不动总账；POST /pool/active 部分更新只改指定字段；GET 恒四字段（砍 configFile）', async () => {
  const dir = mkConfigDir({
    providers: [{ id: 'P1', name: 'P1', baseUrl: 'https://x', apiKey: '', models: ['m1', 'm2'] }],
    active: { providerId: 'P1', modelId: 'm1', roleFile: 'r0', sessionId: 's0', configFile: 'v8遗留' },
  });
  await withEnv({ NZ_AI_CONFIG_DIR: dir }, async () => {
    const rig = await startRig(dir);
    try {
      const before = (await req(rig.port, 'GET', '/pool/active')).json;
      assert(JSON.stringify(Object.keys(before).sort()) === JSON.stringify(['modelId', 'providerId', 'roleFile', 'sessionId']),
        `总账 schema 恒四字段（configFile 砍），实际 ${Object.keys(before).join(',')}`);
      assert(before.providerId === 'P1' && before.roleFile === 'r0' && before.sessionId === 's0', '既有值照读');
      // 编辑目标 ≠ 激活项：update 条目（含激活中的 P1）不得动总账（变异靶子③）
      const u = await req(rig.port, 'POST', '/pool/provider/P1/update', {
        entry: { id: 'P1', name: 'P1新名', baseUrl: 'https://y', apiKey: '', models: ['m9'] },
      });
      assert(u.status === 200, 'update 应 200');
      const afterEdit = (await req(rig.port, 'GET', '/pool/active')).json;
      assert(JSON.stringify(afterEdit) === JSON.stringify(before),
        `update 条目禁动总账（P2 激活双态），前 ${JSON.stringify(before)} 后 ${JSON.stringify(afterEdit)}`);
      // 激活唯一路径 = POST /pool/active，部分更新只改指定字段
      const p = await req(rig.port, 'POST', '/pool/active', { providerId: 'P1新名', modelId: 'm9' });
      assert(p.status === 200, `部分更新应 200，实际 ${p.status} ${p.raw}`);
      assert(p.json.providerId === 'P1新名' && p.json.modelId === 'm9'
        && p.json.roleFile === 'r0' && p.json.sessionId === 's0',
        `只改指定字段，实际 ${JSON.stringify(p.json)}`);
      const p2 = await req(rig.port, 'POST', '/pool/active', { sessionId: 's9' });
      assert(p2.status === 200 && p2.json.sessionId === 's9' && p2.json.providerId === 'P1新名',
        '单字段部分更新其余不动');
      // 磁盘互证 + configFile 不迁
      const disk = JSON.parse(readFileSync(join(dir, 'active.json'), 'utf-8')) as any;
      assert(!('configFile' in disk), '写盘后 configFile 砍掉不迁（§2.4-3）');
      assert(disk.sessionId === 's9' && disk.roleFile === 'r0', '磁盘与响应一致');
      // 未知字段/坏值 → 400 不写盘
      const bad = await req(rig.port, 'POST', '/pool/active', { configFile: '复活尝试' });
      assert(bad.status === 400, `configFile 已砍，写它应 400，实际 ${bad.status}`);
      const bad2 = await req(rig.port, 'POST', '/pool/active', { providerId: 123 });
      assert(bad2.status === 400, '非字符串值应 400');
      const disk2 = JSON.parse(readFileSync(join(dir, 'active.json'), 'utf-8')) as any;
      assert(disk2.sessionId === 's9', '400 不写盘');
    } finally { rig.close(); }
  });
});

test('无总账文件 → GET 出四字段空壳；部分更新落盘即建', async () => {
  const dir = mkConfigDir();
  await withEnv({ NZ_AI_CONFIG_DIR: dir }, async () => {
    const rig = await startRig(dir);
    try {
      const g = await req(rig.port, 'GET', '/pool/active');
      assert(g.status === 200, '无文件 GET 应 200（降级不崩）');
      assert(JSON.stringify(Object.keys(g.json).sort()) === JSON.stringify(['modelId', 'providerId', 'roleFile', 'sessionId']),
        '空壳也恒四字段');
      const p = await req(rig.port, 'POST', '/pool/active', { roleFile: 'r1' });
      assert(p.status === 200 && p.json.roleFile === 'r1', '首写即建账');
      assert(existsSync(join(dir, 'active.json')), 'active.json 应落盘');
    } finally { rig.close(); }
  });
});

// ==========================================================================
group('pool-schema（A5：schema 校验 400 人话不写盘）');

test('坏 role/session/provider 条目 → 400 人话；session messages 非空 → 400（仲裁①）', async () => {
  const dir = mkConfigDir();
  await withEnv({ NZ_AI_CONFIG_DIR: dir }, async () => {
    const rig = await startRig(dir);
    try {
      const cases: Array<[string, unknown, string]> = [
        ['/pool/session/create', { entry: { title: 't', messages: [{ role: 'user', content: [] }] } }, 'messages 非空禁写'],
        ['/pool/provider/create', { entry: { id: 'x', name: 'x', baseUrl: 'https://x', apiKey: '', models: 'm' } }, 'models 非数组'],
        ['/pool/provider/create', { entry: { name: 'x', baseUrl: 'https://x', apiKey: '', models: [] } }, 'provider 缺 id'],
        ['/pool/provider/create', { entry: { id: 'x', name: 'x', baseUrl: 42, apiKey: '', models: [] } }, 'baseUrl 非字符串'],
      ];
      for (const [path, body, label] of cases) {
        const r = await req(rig.port, 'POST', path, body);
        assert(r.status === 400 && typeof r.json?.error === 'string' && r.json.error.length > 0,
          `${label} 应 400 人话，实际 ${r.status} ${r.raw}`);
      }
      assert(readFileSync(join(dir, 'providers.json'), 'utf-8') === '[]', '坏载荷一律不写盘');
      assert(!existsSync(join(dir, 'agents', 'roles', 'x.json')), '坏 role 不落盘');
      assert(!existsSync(join(dir, 'sessions', 't.json')), '坏 session 不落盘');
      // 坏 JSON body → 400
      const resp = await fetch(`http://127.0.0.1:${rig.port}/pool/provider/create`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: '{oops',
      });
      assert(resp.status === 400, `坏 JSON 应 400，实际 ${resp.status}`);
      // 未知池 → 404
      const noPool = await req(rig.port, 'GET', '/pool/nope');
      assert(noPool.status === 404, `未知池应 404，实际 ${noPool.status}`);
    } finally { rig.close(); }
  });
});

// ==========================================================================
group('pool-compat（A6：providers.json 单文件数组兼容联动，A1 旧钉不回退）');

test('池层写后 A1 loadProviders 照读保序、/ai/providers 投影即变、写侧 fuse 被读侧 resolveKey 解通', async () => {
  const dir = mkConfigDir({
    providers: [{ id: 'P0', name: 'P0', baseUrl: 'https://x', apiKey: '', models: ['m0'] }],
  });
  await withEnv({ NZ_AI_CONFIG_DIR: dir }, async () => {
    const rig = await startRig(dir);
    try {
      const KEY = 'sk-compat-fuse-roundtrip-ddd';
      const c = await req(rig.port, 'POST', '/pool/provider/create', {
        entry: { id: 'Compat', name: 'Compat', baseUrl: 'https://y', apiKey: KEY, models: ['cm1'] },
      });
      assert(c.status === 200, '池层 create 应 200');
      // A1 读侧直读同一文件（同源互证是考卷不是新机制，§3.2 接点）
      const loaded = aiProviders.loadProviders(dir);
      assert(JSON.stringify(loaded.map((p) => p.id)) === JSON.stringify(['P0', 'Compat']),
        `A1 loadProviders 照读且保序，实际 ${loaded.map((p) => p.id).join(',')}`);
      const compat = aiProviders.findProvider(loaded, 'Compat');
      assert(!!compat && /^\$\{[A-Z0-9_]+\}$/.test(compat.apiKey), '池层写出的条目 A1 读侧形状不变');
      // 写侧 fuse 出的 ${VAR} 被 A1 读侧 fuse 解通（一套代码两个消费者的互证）
      const resolved = aiProviders.resolveKey(compat!.apiKey, dir);
      assert(resolved.value === KEY && resolved.missingVar === null,
        `写侧 fuse 落 .env 的明文应被读侧 resolveKey 解通，实际 ${JSON.stringify(resolved)}`);
      // picker 数据源投影即变（形状一字不改：只出 id/name/models）
      const picker = await req(rig.port, 'GET', '/ai/providers');
      const ids = (picker.json.providers as any[]).map((p) => p.id);
      assert(ids.includes('Compat') && ids.includes('P0'), '/ai/providers 投影应见池层新条目');
      for (const p of picker.json.providers) {
        assert(JSON.stringify(Object.keys(p).sort()) === JSON.stringify(['id', 'models', 'name']),
          'picker 形状一字不改（A1 考卷不回退）');
      }
      assert(!picker.raw.includes(KEY), 'picker 投影无明文');
    } finally { rig.close(); }
  });
});

// ==========================================================================
group('pool-observability（/tmp/nz-pool.log 逐拍落账，不落明文不落全文）');

test('CRUD/守卫拦截/fuse/激活 逐拍落 JSONL；日志无明文 key', async () => {
  const dir = mkConfigDir();
  const log = join(mkdtempSync(join(tmpdir(), 'nz-pool-log-')), 'pool.log');
  await withEnv({ NZ_AI_CONFIG_DIR: dir, NZ_POOL_LOG: log }, async () => {
    const rig = await startRig(dir);
    try {
      const KEY = 'sk-log-must-not-contain-eee';
      await req(rig.port, 'POST', '/pool/provider/create', {
        entry: { id: 'L1', name: 'L1', baseUrl: 'https://x', apiKey: KEY, models: ['m'] },
      });
      await req(rig.port, 'POST', '/pool/active', { providerId: 'L1', modelId: 'm' });
      await req(rig.port, 'POST', '/pool/provider/L1/delete'); // 409 激活中
      await req(rig.port, 'POST', '/pool/active', { providerId: '', modelId: '' });
      await req(rig.port, 'POST', '/pool/provider/L1/delete'); // 200
      await sleep(150); // 等异步 appendFile 落盘
      const raw = readFileSync(log, 'utf-8');
      const lines = raw.trim().split('\n').map((l) => JSON.parse(l) as any);
      const kinds = lines.map((l) => l.kind);
      assert(kinds.includes('create') && kinds.includes('fuse'), `应有 create+fuse 拍，实际 ${kinds.join(',')}`);
      assert(kinds.includes('activated'), '应有 activated 拍');
      assert(kinds.includes('guard-reject'), `守卫拦截应落拍，实际 ${kinds.join(',')}`);
      assert(kinds.includes('delete'), '删除放行应落拍');
      assert(!raw.includes(KEY), '日志不得出明文 key（P4，变异靶子①同族）');
      for (const l of lines) assert(l.pool === 'provider' || l.pool === 'active', '每拍带 pool 字段');
    } finally { rig.close(); }
  });
});
