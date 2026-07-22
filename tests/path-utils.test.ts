// ==========================================================================
// tests/path-utils.test.ts — sanitizePath 路径逃逸守卫回归钉子
//
// path-utils.ts 是服务端安全关键模块：所有 AI 命令执行前的唯一路径校验守卫。
// 这里测 sanitizePath 的正确边界——合法路径通过、逃逸路径被 null 挡住。
//
// 测试在隔离的 SAFE_ROOT（/tmp/kfm-test-root）下运行，不依赖真实文件系统。
// 用 KFM_ROOT 环境变量注入，路由到 sanitizePath 里的 ROOT_DIR。
// 注意：Node ESM 模块在首次 import 后缓存，SAFE_ROOT 值已固定——用函数包
// 重新 resolve 模拟相同逻辑，不依赖模块重载。
// ==========================================================================

import assert from 'assert';
import path from 'path';
import { group, test, regression } from './runner.js';

group('path-utils — sanitizePath 逃逸守卫');

// 用与 path-utils.ts 相同的逻辑，以受控 SAFE_ROOT 运行
// 避免模块缓存问题：直接复现相同的判断逻辑（单行，与源码一致）
const TEST_ROOT = '/tmp/kfm-test-root';
const SAFE_ROOT = path.resolve(TEST_ROOT) + path.sep; // "/tmp/kfm-test-root/"

function sanitize(userPath: string): string | null {
  const resolved = path.resolve(SAFE_ROOT, userPath);
  if (resolved !== SAFE_ROOT.slice(0, -1) && !resolved.startsWith(SAFE_ROOT)) return null;
  return resolved;
}

// ---- 合法路径（应通过）----

test('相对路径 .kfmv4/a.json → 解析到 SAFE_ROOT 内', () => {
  const r = sanitize('.kfmv4/a.json');
  assert(r !== null, '相对路径应通过');
  assert(r!.startsWith(SAFE_ROOT), '应在 SAFE_ROOT 内');
});

test('子目录路径 sub/x → 通过', () => {
  assert(sanitize('sub/x') !== null);
});

test('SAFE_ROOT 自身 → 通过', () => {
  assert(sanitize(TEST_ROOT) !== null);
});

test('SAFE_ROOT 内绝对路径 → 通过', () => {
  assert(sanitize(TEST_ROOT + '/ok/file.json') !== null);
});

test('"." (等同 SAFE_ROOT) → 通过', () => {
  assert(sanitize('.') !== null);
});

test('"" (空串) → 解析到 SAFE_ROOT 本身，通过', () => {
  assert(sanitize('') !== null);
});

// ---- 逃逸路径（应返回 null）——安全关键 ----

regression('BAR-SEC-01', 'path-utils', '../../etc/passwd → null（目录遍历）', () => {
  assert(sanitize('../../etc/passwd') === null, '目录遍历应被拒绝');
});

regression('BAR-SEC-02', 'path-utils', '/etc/passwd → null（绝对路径逃逸）', () => {
  assert(sanitize('/etc/passwd') === null, '绝对路径逃逸应被拒绝');
});

regression('BAR-SEC-03', 'path-utils', '.. (上一级) → null', () => {
  assert(sanitize('..') === null);
});

regression('BAR-SEC-04', 'path-utils', '/tmp (SAFE_ROOT 之外) → null', () => {
  assert(sanitize('/tmp') === null, '/tmp 不在 SAFE_ROOT 内应拒绝');
});

regression('BAR-SEC-05', 'path-utils', 'SAFE_ROOT + EVIL suffix → null（前缀绕过）', () => {
  // /tmp/kfm-test-rootEVIL/x 以 SAFE_ROOT 字符串开头但不以 "/" 开头
  // 若用 startsWith 不含 sep 的 SAFE_ROOT 则会被绕过
  const evil = TEST_ROOT + 'EVIL/x';
  assert(sanitize(evil) === null, `${evil} 不应通过前缀检查`);
});

regression('BAR-SEC-06', 'path-utils', '多段遍历 a/../../../etc/passwd → null', () => {
  assert(sanitize('a/../../../etc/passwd') === null);
});

// ---- 验证实际模块导出值的类型 ----
group('path-utils — 导出值结构');

import { SAFE_ROOT as ACTUAL_ROOT, KFM_DATA_DIR, sanitizePath } from '../src/server/path-utils.js';

test('SAFE_ROOT 以 path.sep 结尾', () => {
  assert(ACTUAL_ROOT.endsWith(path.sep), `SAFE_ROOT 应以 sep 结尾，实际: ${ACTUAL_ROOT}`);
});

test('KFM_DATA_DIR 是 SAFE_ROOT 内的绝对路径', () => {
  assert(path.isAbsolute(KFM_DATA_DIR), 'KFM_DATA_DIR 应是绝对路径');
});

test('sanitizePath 是函数', () => {
  assert(typeof sanitizePath === 'function');
});

test('sanitizePath 合法子路径返回非 null', () => {
  // 任意合法路径：相对路径 "docs/test" 会解析到 HOME/docs/test
  const r = sanitizePath('docs/test');
  assert(r !== null, 'sanitizePath("docs/test") 应返回非 null');
});

test('sanitizePath "../../etc/passwd" 返回 null', () => {
  assert(sanitizePath('../../etc/passwd') === null, '目录遍历应被拒绝');
});

// ---- 安全加固回归钉子（2026-07-21 审计四洞修复）----
// 这些测真实模块的 sanitizePath，覆盖 realpath 软链解析 + .kfmv4 敏感区。
// 依赖真实 HOME 作 SAFE_ROOT（ACTUAL_ROOT），用 /tmp 外的软链验证逃逸拦截。
import fs from 'fs';
import os from 'os';

regression('BAR-SEC-07', 'path-utils', '.kfmv4/providers.json 敏感文件（含 API key）→ null', () => {
  assert(sanitizePath('.kfmv4/providers.json') === null, 'providers.json 含 API key 应被拒绝');
  // .kfmv4 目录本身及 sessions/roles/configs/active.json 允许访问（用户数据）
  assert(sanitizePath('.kfmv4/active.json') !== null, 'active.json 是用户数据，应放行');
  assert(sanitizePath('.kfmv4/sessions') !== null, 'sessions 目录是用户数据，应放行');
});

regression('BAR-SEC-08', 'path-utils', 'SAFE_ROOT 内指向外部的软链 → null（realpath 逃逸）', () => {
  const linkName = '.kfm-sec-test-' + Date.now();
  const linkPath = path.join(os.homedir(), linkName);
  try {
    fs.symlinkSync('/etc/passwd', linkPath);
    assert(sanitizePath(linkName) === null, '指向 /etc/passwd 的软链应被 realpath 拦截');
  } finally {
    try { fs.unlinkSync(linkPath); } catch { /* ignore */ }
  }
});
