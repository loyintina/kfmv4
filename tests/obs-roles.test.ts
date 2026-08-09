// ==========================================================================
// tests/obs-roles.test.ts — collectRoles 聚合钉子（角色卡星座图数据源）
//
// 覆盖：
//   1. 读 .kfmv4/agents/roles/*.json + active.json：id/name/静态动态引用
//   2. 文件去重 refCount：同一文件被 N 张卡引用 → refCount=N（共用边）
//   3. 文件元数据 stat：size/mtime；缺失文件标 missing 仍入图
//   4. activeRoleId 兜底：active 缺失/无效 → 第一张卡
//   5. 坏 JSON 跳过、非 json 文件忽略
//
// 完全离线：数据目录已被 preload（BAR-TEST-ENV-01）重定向到临时目录。
// ==========================================================================

import assert from 'assert';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { group, test } from './runner.js';
import { buildRolesData } from '../src/server/routes/obs.js';

group('obs-roles — collectRoles 聚合');

function mkFixture(): string {
  const dir = join(process.cwd(), '.test-tmp-roles');
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(join(dir, 'roles'), { recursive: true });
  // 三张卡：A 引 2 个文件（一个与 B 共用）、B 引 1 个共用文件 + 1 个缺失文件、C 无引用
  writeFileSync(join(dir, 'roles', 'a.json'), JSON.stringify({
    id: 'a', name: 'Alpha',
    promptFiles: ['/tmp/fake-shared.md', '/tmp/fake-a-only.md'],
    dynamicPromptFiles: ['/tmp/fake-dyn.md'],
    updatedAt: '2026-08-09T00:00:00.000Z',
  }));
  writeFileSync(join(dir, 'roles', 'b.json'), JSON.stringify({
    id: 'b', name: 'Beta',
    promptFiles: ['/tmp/fake-shared.md', '/tmp/fake-missing.md'],
    updatedAt: '2026-08-09T01:00:00.000Z',
  }));
  writeFileSync(join(dir, 'roles', 'c.json'), JSON.stringify({
    id: 'c', name: 'Gamma', promptFiles: [], updatedAt: '',
  }));
  writeFileSync(join(dir, 'roles', 'garbage.json'), 'not-json{');
  writeFileSync(join(dir, 'roles', 'ignore.txt'), '非 json 文件');
  // 真实存在的文件让 stat 命中
  writeFileSync('/tmp/fake-shared.md', 'shared content');
  writeFileSync('/tmp/fake-a-only.md', 'a only');
  writeFileSync('/tmp/fake-dyn.md', 'dyn');
  // active 指向 b
  writeFileSync(join(dir, 'active.json'), JSON.stringify({ roleFile: 'b' }));
  return dir;
}

test('buildRolesData：解析三卡 + 引用计数 + 元数据 + 缺失标记 + active', () => {
  const dir = mkFixture();
  try {
    const d = buildRolesData(join(dir, 'roles'), join(dir, 'active.json'));
    assert.strictEqual(d.totalRoles, 3, `totalRoles: ${d.totalRoles}`);
    assert.strictEqual(d.totalFiles, 4, `totalFiles 应含缺失文件: ${d.totalFiles}`);
    assert.strictEqual(d.activeRoleId, 'b', 'active 应指向 b');
    const a = d.roles.find(r => r.id === 'a')!;
    const b = d.roles.find(r => r.id === 'b')!;
    const c = d.roles.find(r => r.id === 'c')!;
    assert(a && b && c, '三卡都在');
    assert.strictEqual(a.name, 'Alpha');
    assert.strictEqual(a.static.length, 2, `a 静态引用: ${a.static.length}`);
    assert.strictEqual(a.dynamic.length, 1);
    assert.strictEqual(c.static.length, 0, '空引用卡');
    const shared = a.static.find(f => f.name === 'fake-shared.md')!;
    assert.strictEqual(shared.refCount, 2, `共用文件 refCount 应为 2: ${shared.refCount}`);
    assert.strictEqual(shared.size, 'shared content'.length, 'stat size');
    assert.ok(shared.mtime > 0, 'mtime');
    const missing = b.static.find(f => f.name === 'fake-missing.md')!;
    assert.strictEqual(missing.missing, true, '缺失文件标 missing');
    assert.strictEqual(missing.refCount, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync('/tmp/fake-shared.md', { force: true });
    rmSync('/tmp/fake-a-only.md', { force: true });
    rmSync('/tmp/fake-dyn.md', { force: true });
  }
});

test('buildRolesData：active 缺失/无效兜底第一张卡', () => {
  const dir = mkFixture();
  try {
    writeFileSync(join(dir, 'active.json'), JSON.stringify({ roleFile: 'nope' }));
    const d = buildRolesData(join(dir, 'roles'), join(dir, 'active.json'));
    assert.strictEqual(d.activeRoleId, 'a', '无效 active 兜底第一张卡（文件序 a）');
    rmSync(join(dir, 'active.json'), { force: true });
    const d2 = buildRolesData(join(dir, 'roles'), join(dir, 'active.json'));
    assert.strictEqual(d2.activeRoleId, 'a', 'active 缺失兜底第一张卡');
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync('/tmp/fake-shared.md', { force: true });
    rmSync('/tmp/fake-a-only.md', { force: true });
    rmSync('/tmp/fake-dyn.md', { force: true });
  }
});

test('buildRolesData：roles 目录不存在返回空态', () => {
  const d = buildRolesData('/nonexistent/roles-dir', '/nonexistent/active.json');
  assert.strictEqual(d.totalRoles, 0);
  assert.strictEqual(d.totalFiles, 0);
  assert.strictEqual(d.activeRoleId, '');
  assert.deepStrictEqual(d.roles, []);
});
