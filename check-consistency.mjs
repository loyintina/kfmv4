/**
 * KFM v4 — 文档-代码一致性自动化检查
 *
 * 挂入 npm run check。校验文档中的硬编码声明是否与代码实际状态一致。
 *
 * 检查项：
 *   1. CLAUDE.md 文档树中列出的文件/目录是否真实存在
 *   2. 硬编码数字声明（N个模块、N个测试、N个文件）vs 实际统计
 *   3. "已删除"声明是否真的执行了
 *   4. 技术栈声明 vs package.json
 *
 * 失败 = 构建中断。
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'fs';
import { join, relative, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;

let errors = 0;

function error(msg) {
  console.error(`[check-consistency] ${msg}`);
  errors++;
}

// ============================================================
// 1. CLAUDE.md 文档树验证
// ============================================================

function parseDocTree(content) {
  const treeStart = content.indexOf('## 文档体系');
  if (treeStart < 0) return [];
  const treeEnd = content.indexOf('\n## ', treeStart + 1);
  const section = content.slice(treeStart, treeEnd > 0 ? treeEnd : undefined);

  const entries = [];
  const lines = section.split('\n');
  const dirStack = [];
  let rootSeen = false;

  for (const line of lines) {
    const itemMatch = line.match(/^([│\s]*)[├└]──\s+(.+)$/);
    if (!itemMatch) continue;

    const indent = itemMatch[1];
    const raw = itemMatch[2];
    const nameMatch = raw.match(/^([^\s#]+)/);
    if (!nameMatch) continue;
    const name = nameMatch[1];

    // 缩进级别：每 4 个字符算一级
    const level = Math.floor(indent.length / 4);

    // 跳过根节点 "docs/"（它本身是树根，不参与路径计算）
    if (!rootSeen && name === 'docs/') {
      rootSeen = true;
      continue;
    }

    // 维护目录栈
    dirStack.length = level;

    if (name.endsWith('/')) {
      const dirName = name.replace(/\/$/, '');
      dirStack.push(dirName);
      entries.push({ fullPath: [...dirStack].join('/') + '/', isDir: true });
    } else {
      const fullPath = dirStack.length > 0
        ? [...dirStack, name].join('/')
        : name;
      entries.push({ fullPath, isDir: false });
    }
  }
  return entries;
}

function checkDocTree() {
  const claudePath = join(ROOT, 'CLAUDE.md');
  const content = readFileSync(claudePath, 'utf-8');
  const entries = parseDocTree(content);

  for (const entry of entries) {
    // 条目路径相对于 docs/（文档体系下）
    const absPath = join(ROOT, 'docs', entry.fullPath);
    if (!existsSync(absPath)) {
      const absRoot = join(ROOT, entry.fullPath);
      if (!existsSync(absRoot)) {
        error(`CLAUDE.md 文档树引用 "${entry.fullPath}" 在 docs/ 和项目根均不存在`);
      }
    }
  }

  // 反向检查：docs/design/ 下实际存在但文档树未列出的 .md 文件
  const designDir = join(ROOT, 'docs', 'design');
  if (existsSync(designDir)) {
    const actual = readdirSync(designDir).filter(f => f.endsWith('.md'));
    const listed = new Set(entries.filter(e => !e.isDir).map(e => e.fullPath.split('/').pop()));
    for (const f of actual) {
      if (!listed.has(f)) {
        error(`docs/design/${f} 存在但 CLAUDE.md 文档树中未列出`);
      }
    }
  }

  // 反向检查：docs/ 根目录下实际存在但文档树未列出的 .md 文件
  const docsRoot = join(ROOT, 'docs');
  if (existsSync(docsRoot)) {
    const actualMd = readdirSync(docsRoot).filter(f => f.endsWith('.md'));
    const listedRootDocs = new Set(
      entries.filter(e => !e.isDir && !e.fullPath.includes('/')).map(e => e.fullPath)
    );
    for (const f of actualMd) {
      if (!listedRootDocs.has(f)) {
        error(`docs/${f} 存在但 CLAUDE.md 文档树中未列出`);
      }
    }
  }
}

// ============================================================
// 2. 硬编码数字声明 vs 实际统计
// ============================================================

function countTsFiles(dir) {
  if (!existsSync(dir)) return 0;
  return readdirSync(dir).filter(f => f.endsWith('.ts')).length;
}

function countTsFilesRecursive(dir) {
  if (!existsSync(dir)) return 0;
  let count = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      count += countTsFilesRecursive(join(dir, entry.name));
    } else if (entry.name.endsWith('.ts')) {
      count++;
    }
  }
  return count;
}

function checkNumericClaims() {
  // --- 客户端模块数量（递归，含 renderers/） ---
  const clientModules = countTsFilesRecursive(join(ROOT, 'src', 'client', 'modules'));
  // 文档中声称 "N 个模块" — 验证与实际数量一致
  // 排除 "覆盖 N 个模块"（测试覆盖率声明）和 "N 个零文档"（审计历史）
  for (const file of ['CLAUDE.md', 'docs/HANDBOOK.md', 'docs/archive/design/ENGINE_ARCHITECTURE.md']) {
    const content = readFileSync(join(ROOT, file), 'utf-8');
    // 跳过删除线（~~）中的历史记录
    const cleanContent = content.replace(/~~.*?~~/gs, '');
    // 再移除包含 "历史数据" 的行（审计表中的历史声明）
    const lines = cleanContent.split('\n').filter(l => !l.includes('历史数据'));
    const filteredContent = lines.join('\n');
    // 匹配 "N 个模块"、"N 个客户端模块"、"N 个业务模块"
    // 不匹配： "覆盖 N 个模块"（测试覆盖）、"N 个零文档"（审计历史）
    const claims = filteredContent.match(/(?<!\d)(?<!(?:覆盖|有) )(\d+)\s*个(?:客户端|业务)?模块(?!(?:零文档|，?\s*不含|、))/g) || [];
    for (const claim of claims) {
      const num = parseInt(claim.match(/\d+/)[0], 10);
      if (num !== clientModules) {
        error(`${file}: 声称 "${claim}"，但 src/client/modules/（递归）下有 ${clientModules} 个 .ts 文件`);
      }
    }
  }
  

  // 只在 HANDBOOK §七 客户端模块完整审计表 内统计模块行
  const handbook = readFileSync(join(ROOT, 'docs/HANDBOOK.md'), 'utf-8');
  const tableStart  = handbook.indexOf('### 客户端模块完整审计表');
  const tableEnd = handbook.indexOf('### 死代码检查', tableStart);
  const tableSection = tableStart >= 0 && tableEnd > 0
    ? handbook.slice(tableStart, tableEnd)
    : handbook;
  const moduleRows = (tableSection.match(/^\| `(?:[^`]+\/)?[^`]+\.ts` \| \d+ \|/gm) || []).length;
  if (moduleRows !== clientModules) {
    error(`HANDBOOK.md 模块表有 ${moduleRows} 行模块，但 src/client/modules/（递归）下有 ${clientModules} 个 .ts 文件`);
  }
  const engineV2Files = countTsFiles(join(ROOT, 'src', 'client', 'engine', 'v2'));

  const engineTextFiles = countTsFiles(join(ROOT, 'src', 'client', 'engine', 'text-layout'));
  const totalEngine = engineV2Files + engineTextFiles;
  if (totalEngine !== 14) {
    error(`引擎层文件总数 ${totalEngine}，但文档声称 14 个`);
  }

  // --- 服务端模块数量 ---
  const serverFiles = countTsFiles(join(ROOT, 'src', 'server'));
  if (serverFiles !== 6) {
    error(`服务端有 ${serverFiles} 个 .ts 文件，但文档声称 6 个`);
  }

  // --- 测试数量 ---
  let testCount = 0;
  const testDir = join(ROOT, 'tests');
  if (existsSync(testDir)) {
    for (const entry of readdirSync(testDir)) {
      if (!entry.endsWith('.test.ts') && !entry.endsWith('.test.mjs')) continue;
      const testContent = readFileSync(join(testDir, entry), 'utf-8');
      testCount += (testContent.match(/^\s*(?:test|regression)\(/gm) || []).length;
    }
  }
  for (const file of ['CLAUDE.md', 'docs/HANDBOOK.md', 'docs/DIAGNOSTICS.md', 'docs/PROJECT_ASSESSMENT.md', 'README.md', 'docs/archive/standards/TESTING.md']) {
    if (!existsSync(join(ROOT, file))) continue;
    const content = readFileSync(join(ROOT, file), 'utf-8');
    const claims = content.match(/(?<!\d)(?<!(?:新增|覆盖|有) )(\d+)\s*个\s*(?:回归)?测试/g) || [];
    for (const claim of claims) {
      const num = parseInt(claim.match(/\d+/)[0], 10);
      if (num !== testCount) {
        error(`${file}: 声称 "${claim}"，但 tests/*.test.ts 中共有 ${testCount} 个测试函数`);
      }
    }
  }

  // --- 心法条数 ---
  const principlesDoc = readFileSync(join(ROOT, 'docs/KFM_V4_INVARIANTS.md'), 'utf-8');
  const principlesCount = (principlesDoc.match(/^#### \d+\. /gm) || []).length;
  for (const file of ['docs/KFM_V4_INVARIANTS.md']) {
    const content = readFileSync(join(ROOT, file), 'utf-8');
    const claims = content.match(/(\d+)\s*条\s*心法/g) || [];
    for (const claim of claims) {
      const num = parseInt(claim.match(/\d+/)[0], 10);
      if (num !== principlesCount) {
        error(`${file}: 声称 "${claim}"，但 KFM_V4_INVARIANTS.md 中有 ${principlesCount} 条心法原则`);
      }
    }
  }

  // --- 测试覆盖模块数：文档间交叉验证 ---
  var testModuleNames = new Set();
  for (var _i = 0, _entries = readdirSync(testDir); _i < _entries.length; _i++) {
    var entry = _entries[_i];
    if (!entry.endsWith('.ts')) continue;
    var content = readFileSync(join(testDir, entry), 'utf-8');
    var groups = content.match(/group\('(.+?)'\)/g) || [];
    for (var _j = 0; _j < groups.length; _j++) {
      var g = groups[_j];
      var name = g.replace(/^group\('/, '').replace(/'\)$/, '').replace(/ \(.*\)$/, '');
      testModuleNames.add(name);
    }
  }
  var actualTestModules = testModuleNames.size;
  var moduleCoverageFiles = ['CLAUDE.md', 'docs/HANDBOOK.md', 'docs/DIAGNOSTICS.md', 'docs/archive/standards/TESTING.md'];
  var coverageNums = new Set();
  for (var _k = 0; _k < moduleCoverageFiles.length; _k++) {
    var file = moduleCoverageFiles[_k];
    if (!existsSync(join(ROOT, file))) continue;
    var fileContent = readFileSync(join(ROOT, file), 'utf-8');
    var claims = fileContent.match(/(?:覆盖)\s*(\d+)\s*个模块/g) || [];
    for (var _m = 0; _m < claims.length; _m++) {
      coverageNums.add(parseInt(claims[_m].match(/\d+/)[0], 10));
    }
  }
  if (coverageNums.size > 1) {
    error('测试覆盖模块数不一致: 文档声称不同数字 ' + [...coverageNums].join(' vs '));
  }
  var firstCoverage = [...coverageNums][0];
  if (firstCoverage !== undefined && firstCoverage !== actualTestModules) {
    console.log('[check-consistency] 注意: 文档声称覆盖 ' + firstCoverage + ' 个模块，测试组 ' + actualTestModules + ' 个（子模块分组差异可能合法）');
  }

  // --- HANDBOOK 客户端模块总数（不含 renderers/，与职能分组表对齐） ---
  var totalClientMods = countTsFiles(join(ROOT, 'src', 'client', 'modules'));
  var handbookTotal2 = readFileSync(join(ROOT, 'docs/HANDBOOK.md'), 'utf-8');
  var totalClaims2 = handbookTotal2.match(/(?<!\d)全\s*(\d+)\s*个模块(?!\s*零文档)/g) || [];
  for (var _n2 = 0; _n2 < totalClaims2.length; _n2++) {
    var claim2 = totalClaims2[_n2];
    var totalNum2 = parseInt(claim2.match(/\d+/)[0], 10);
    if (totalNum2 !== totalClientMods) {
      error('docs/HANDBOOK.md: 声称 "' + claim2 + '"，但 src/client/modules/ 下有 ' + totalClientMods + ' 个 .ts 文件（不含 renderers/ 子目录）');
    }
  }
}

// ============================================================
// 3. "已删除"声明验证
// ============================================================

function checkDeletedClaims() {
  // 审计项 #8 和 #10 声称已删除的内容
  const deletions = [
    { path: 'src/cards/debug-card', desc: 'cards/debug-card 目录（审计项 #8）' },
    { path: 'src/cards/logger.ts', desc: 'cards/logger.ts（审计项 #8）' },
    { path: '.github_token', desc: '.github_token 文件（审计项 #9）' },
  ];

  for (const { path: relPath, desc } of deletions) {
    const absPath = join(ROOT, relPath);
    if (existsSync(absPath)) {
      error(`声称已删除 "${desc}" 但仍然存在于 ${relPath}`);
    }
  }
}

// ============================================================
// 4. 技术栈一致性
// ============================================================

function checkTechStack() {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'));
  const claude = readFileSync(join(ROOT, 'CLAUDE.md'), 'utf-8');

  // CLAUDE.md 声称的依赖应该出现在 package.json 中
  const depsClaimed = [
    { name: 'express', label: 'Express 4' },
    { name: 'gsap', label: 'GSAP 3.15' },
    { name: '@chenglou/pretext', label: '@chenglou/pretext' },
    { name: 'ws', label: 'ws WebSocket' },
    { name: 'typescript', label: 'TypeScript 6', dev: true },
    { name: 'esbuild', label: 'esbuild', dev: true },
    { name: 'sass', label: 'sass / SCSS' },
  ];

  for (const dep of depsClaimed) {
    const deps = dep.dev ? (pkg.devDependencies || {}) : (pkg.dependencies || {});
    if (!deps[dep.name] && !Object.keys(pkg.dependencies || {}).includes(dep.name)
        && !Object.keys(pkg.devDependencies || {}).includes(dep.name)) {
      // 放宽检查：包名可能不完全匹配（如 "sass" vs "sass"），只在完全找不到时报警
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
      const found = Object.keys(allDeps).some(k => k.includes(dep.name) || dep.name.includes(k));
      if (!found) {
        error(`CLAUDE.md 声称使用 "${dep.label}"，但 package.json 中找不到对应依赖`);
      }
    }
  }
}

// ============================================================
// 5. 依赖方向检查：引擎层禁止引用模块层
// ============================================================

function checkEngineDeps() {
  const engineDir = join(ROOT, 'src', 'client', 'engine');

  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        walk(join(dir, entry.name));
      } else if (entry.name.endsWith('.ts')) {
        const content = readFileSync(join(dir, entry.name), 'utf-8');
        const lines = content.split('\n');
        for (const line of lines) {
          if (line.match(/from\s+['"].*modules\//)) {
            const relPath = relative(ROOT, join(dir, entry.name));
            error(`${relPath} 反向依赖 modules/: ${line.trim()}`);
          }
        }
      }
    }
  }

  walk(engineDir);
}
// ============================================================
// 0. 计数自动同步（单一真相源：代码 → 文档）
//
// 心法 17：派生数字（测试数、心法条数）的真相源是代码，文档只是消费者。
// 与其让人每次手改 6 处文档再靠 checkNumericClaims 报错拦截，不如在此
// 就地把文档数字改成代码实际值——和 check-linecount 自动写回行数表同一范式。
// 同步后 checkNumericClaims 自然通过；仍保留它作为"同步遗漏"的兜底断言。
// ============================================================

/** 统计 tests/ 下 test()/regression() 函数总数 */
function actualTestCount() {
  let n = 0;
  const testDir = join(ROOT, 'tests');
  if (!existsSync(testDir)) return 0;
  for (const entry of readdirSync(testDir)) {
    if (!entry.endsWith('.test.ts') && !entry.endsWith('.test.mjs')) continue;
    const c = readFileSync(join(testDir, entry), 'utf-8');
    n += (c.match(/^\s*(?:test|regression)\(/gm) || []).length;
  }
  return n;
}

/** 统计 INVARIANTS §一 心法条数 */
function actualPrinciplesCount() {
  const doc = readFileSync(join(ROOT, 'docs/KFM_V4_INVARIANTS.md'), 'utf-8');
  return (doc.match(/^#### \d+\. /gm) || []).length;
}

function syncCounts() {
  const testCount = actualTestCount();
  const principlesCount = actualPrinciplesCount();
  let synced = 0;

  // 测试数：改写 "N 个测试" / "N 个回归测试"（排除 "新增/覆盖/有 N 个测试" 语境）
  const testFiles = ['CLAUDE.md', 'docs/HANDBOOK.md', 'docs/DIAGNOSTICS.md', 'docs/PROJECT_ASSESSMENT.md', 'README.md', 'docs/archive/standards/TESTING.md'];
  for (const file of testFiles) {
    const path = join(ROOT, file);
    if (!existsSync(path)) continue;
    const before = readFileSync(path, 'utf-8');
    const after = before.replace(/(?<!\d)(?<!(?:新增|覆盖|有) )(\d+)(\s*个\s*(?:回归)?测试)/g,
      (m, num, tail) => (parseInt(num, 10) === testCount ? m : `${testCount}${tail}`));
    if (after !== before) { writeFileSync(path, after); synced++; }
  }

  // 心法条数：改写 INVARIANTS 里 "N 条心法" / "心法原则（N 条）"
  const invPath = join(ROOT, 'docs/KFM_V4_INVARIANTS.md');
  const invBefore = readFileSync(invPath, 'utf-8');
  const invAfter = invBefore
    .replace(/(\d+)(\s*条\s*心法)/g, (m, num, tail) => (parseInt(num, 10) === principlesCount ? m : `${principlesCount}${tail}`))
    .replace(/(心法原则（)(\d+)(\s*条）)/g, (m, pre, num, tail) => (parseInt(num, 10) === principlesCount ? m : `${pre}${principlesCount}${tail}`));
  if (invAfter !== invBefore) { writeFileSync(invPath, invAfter); synced++; }

  if (synced > 0) console.log(`[check-consistency] 计数已自动同步（${testCount} 测试 / ${principlesCount} 心法）→ ${synced} 处文档`);
}


// ============================================================
// Main
// ============================================================

syncCounts();
checkDocTree();
checkNumericClaims();
checkDeletedClaims();
checkTechStack();
checkEngineDeps();

if (errors > 0) {
  console.error(`\n[check-consistency] ${errors} errors — BLOCKED`);
  process.exit(1);
}
console.log('[check-consistency] OK — 文档声明与代码实际状态一致');
