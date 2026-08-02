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

import { getSafeRoot, getActiveRoot, setActiveRoot, KFM_DATA_DIR, sanitizePath } from '../src/server/path-utils.js';

test('getSafeRoot() 以 path.sep 结尾', () => {
  assert(getSafeRoot().endsWith(path.sep), `getSafeRoot() 应以 sep 结尾，实际: ${getSafeRoot()}`);
});

test('KFM_DATA_DIR 是绝对路径', () => {
  assert(path.isAbsolute(KFM_DATA_DIR), 'KFM_DATA_DIR 应是绝对路径');
});

test('sanitizePath 是函数', () => {
  assert(typeof sanitizePath === 'function');
});

test('sanitizePath 合法子路径返回非 null', () => {
  const r = sanitizePath('docs/test');
  assert(r !== null, 'sanitizePath("docs/test") 应返回非 null');
});

test('sanitizePath "../../etc/passwd" 返回 null', () => {
  assert(sanitizePath('../../etc/passwd') === null, '目录遍历应被拒绝');
});

// ---- 动态根切换 ----
group('path-utils — 动态根切换');

test('setActiveRoot 后 sanitizePath 使用新根', () => {
  const original = getActiveRoot();
  // 新根取独立临时目录——测试不得假设旧根位置（BAR-TEST-ENV-01 后旧根也在 /tmp 下）
  const newRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kfm-newroot-'));
  try {
    setActiveRoot(newRoot);
    assert(sanitizePath(path.join(newRoot, 'foo.txt')) !== null, '新根内路径应通过');
    // 旧根与新根互不包含时，旧根路径才应被拒绝（包含关系下该断言无意义）
    if (!original.startsWith(newRoot + path.sep) && !newRoot.startsWith(original + path.sep)) {
      assert(sanitizePath(path.join(original, 'x')) === null, '旧根路径应被拒绝');
    }
  } finally {
    setActiveRoot(original);
  }
});

test('KFM_DATA_DIR 不随 activeRoot 变化', () => {
  const original = getActiveRoot();
  const dataDir = KFM_DATA_DIR;
  try {
    setActiveRoot('/tmp');
    assert(KFM_DATA_DIR === dataDir, 'KFM_DATA_DIR 应不变');
  } finally {
    setActiveRoot(original);
  }
});

regression('BAR-ROOT-01', 'path-utils', 'setActiveRoot 后 getSafeRoot 反映新根', () => {
  const original = getActiveRoot();
  try {
    setActiveRoot('/tmp');
    assert(getSafeRoot() === '/tmp' + path.sep, 'getSafeRoot 应反映新根');
    assert(getActiveRoot() === '/tmp', 'getActiveRoot 应返回新根');
  } finally {
    setActiveRoot(original);
  }
});

// ---- 安全加固回归钉子（2026-07-21 审计四洞修复）----
// 这些测真实模块的 sanitizePath，覆盖 realpath 软链解析 + .kfmv4 敏感区。
// 依赖真实 HOME 作 SAFE_ROOT（ACTUAL_ROOT），用 /tmp 外的软链验证逃逸拦截。
import fs from 'fs';
import os from 'os';

regression('BAR-SEC-07', 'path-utils', '.kfmv4/ 不再屏蔽（用户个人配置，不在仓库中）', () => {
  // .kfmv4/ 整个目录对文件 API 放行，数据在 $HOME/.kfmv4/ 不在 git 仓库中
  assert(sanitizePath('.kfmv4/providers.json') !== null, 'providers.json 应放行');
  assert(sanitizePath('.kfmv4/active.json') !== null, 'active.json 应放行');
  assert(sanitizePath('.kfmv4/sessions') !== null, 'sessions 目录应放行');
});

regression('BAR-SEC-08', 'path-utils', 'SAFE_ROOT 内指向外部的软链 → null（realpath 逃逸）', () => {
  const linkName = '.kfm-sec-test-' + Date.now();
  // 软链必须建在当前活跃根内（不得假设根 = HOME，BAR-TEST-ENV-01 后根为临时目录）
  const linkPath = path.join(getActiveRoot(), linkName);
  try {
    fs.symlinkSync('/etc/passwd', linkPath);
    assert(sanitizePath(linkName) === null, '指向 /etc/passwd 的软链应被 realpath 拦截');
  } finally {
    try { fs.unlinkSync(linkPath); } catch { /* ignore */ }
  }
});

// ==========================================================================
// BAR-TEST-ENV-01：测试环境数据目录隔离（2026-08-01，STACK #16）
// 病灶：测试以真实 $HOME 跑，run-manager/session 类测试落盘把 s-basic/
// s-stall/sess-x 等垃圾会话写进生产 ~/.kfmv4/sessions/（用户会话卡可见，
// 手工清过 11 个，每轮 npm test 再长）。根治：preload 把 KFM_ROOT 重定向
// 到临时目录（path-utils import 时读 env 计算 KFM_DATA_DIR）。
// revert 验证：删掉 preload 的隔离段，本钉 KFM_ROOT 断言即红。
// ==========================================================================

regression('BAR-TEST-ENV-01', 'test-data-dir-isolation', '测试数据根重定向临时目录，不污染生产 ~/.kfmv4', async () => {
  assert(process.env.KFM_ROOT, 'preload 必须设置 KFM_ROOT（缺失 = 测试落盘会进生产数据目录）');
  assert(process.env.KFM_ROOT.includes('kfmv4-test-root-'), `KFM_ROOT 应为 preload 临时目录，实际: ${process.env.KFM_ROOT}`);
  const { KFM_DATA_DIR } = await import('../src/server/path-utils.js');
  assert(KFM_DATA_DIR === path.join(process.env.KFM_ROOT, '.kfmv4'), `KFM_DATA_DIR 应落在临时根下，实际: ${KFM_DATA_DIR}`);
  const prodDir = path.join(process.env.HOME || '', '.kfmv4');
  assert(KFM_DATA_DIR !== prodDir, `KFM_DATA_DIR 不得是生产数据目录 ${prodDir}`);
  // preload 源码断言：隔离段必须在文件头部（path-utils import 前生效）
  const { readFileSync } = await import('fs');
  const preload = readFileSync(new URL('./preload.mjs', import.meta.url), 'utf-8');
  assert(preload.includes('kfmv4-test-root-'), 'preload.mjs 缺数据目录隔离段');
});

regression('BAR-CWD-DRIFT-01', 'project-root-deterministic', '工具默认 cwd 确定性：PROJECT_ROOT 基于文件位置而非进程 cwd', async () => {
  const { PROJECT_ROOT } = await import('../src/server/path-utils.js');
  assert(path.isAbsolute(PROJECT_ROOT), `PROJECT_ROOT 必须是绝对路径，实际: ${PROJECT_ROOT}`);
  // 项目根必须存在 package.json（根判据）
  const { existsSync, readFileSync } = await import('fs');
  const pkg = path.join(PROJECT_ROOT, 'package.json');
  assert(existsSync(pkg), `PROJECT_ROOT 下应有 package.json，实际: ${pkg}`);
  // 与进程 cwd 解耦：服务从任意目录启动，PROJECT_ROOT 不变（值推导自文件位置）
  const pkg2 = JSON.parse(readFileSync(pkg, 'utf-8'));
  assert(pkg2.name, 'package.json 应可读且含 name');
  // 关键路径（提示词/规则/构建产物）应落在 PROJECT_ROOT 下
  assert(existsSync(path.join(PROJECT_ROOT, 'src', 'server', 'prompts', 'tools')), 'PROMPTS_DIR 应基于 PROJECT_ROOT');
  assert(existsSync(path.join(PROJECT_ROOT, 'src', 'server', 'ai', 'rules')), 'RULES_DIR 应基于 PROJECT_ROOT');
});
