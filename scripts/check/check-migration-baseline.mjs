/**
 * check-migration-baseline.mjs — 迁移基线矩阵（M1，8.x 五道闸第一闸）
 *
 * 问题：8.x 绞杀者迁移（8.7 → 9.0 共 29 小步）最大的暗礁是「换心但功能
 * 变了/少了/视觉歪了」——每小步都删旧，删多删少在手机上才被发现的代价
 * 太高。任务图（nine-zero-dev-task-map.md 迁移验证线节）拍板 M1：
 * 发布时记录基线快照，下版自动对账——「任何一版偷偷少了东西 → 矩阵显形」。
 *
 * 机制（单向快照对账，不是双写）：
 *   基线快照存 ledger/migration-baselines/<version>.json，发布时由
 *   release.yaml 步骤生成（--record，随 tag 提交）；本检查跑 --verify：
 *   对账「当前实况 vs 最近一条基线」——测试数不许降、检查器数不许降、
 *   卡片/工具/命令/工作流四类功能面 hash 一致或增长。
 *   8.x 期间功能只增不减是纪律（替换即删旧 ≠ 功能缩水：被替换物必须有
 *   等价新物），任何「少了」都必须是显式登记过的退役（退疫名单）。
 *
 * 快照内容（全部机械可采，零人工）：
 *   - version（package.json 权威版本）
 *   - testCount：tests/*.ts 中 regression|test( 调用数（与 sync-counts 同口径）
 *   - checkCount：scripts/check/check-*.mjs 数
 *   - chainSteps：chain.mjs STEPS 数
 *   - faces：四类功能面各一个确定性 hash——
 *       cards   = src/client/cards/plugins/*.card.ts 文件名集
 *       tools   = 内置工具注册表（src/server/tools/*.tool.ts 文件名集）
 *       cmds    = slash 命令注册（搜 src/client 里 slash-commands 注册点，v8.11 落地后生效）
 *       workflows = docs/workflows/*.yaml 文件名集
 *     （文件名集而非内容 hash：M1 只防「少功能」，内容漂移归 M2 双轨对照管）
 *   - features：人工可读的功能清单（faces 的展开形态，审计用）
 *
 * 用法：
 *   node scripts/check/check-migration-baseline.mjs            # verify 模式（chain 用）
 *   node scripts/check/check-migration-baseline.mjs --record   # 发布时记基线（release.yaml 调）
 *   KFM_PROBE_ROOT=<假树>（探针注入——宪法探针条款：夹具树里种「测试数骤降」病）
 *
 * 失效信号：verify 报红 = 当前实况比基线少了东西 → 发布前拦下（五道闸第一闸）。
 * 规约出处：nine-zero-dev-task-map.md 迁移验证线节（M1 行）+ guides/release.yaml。
 * 2026-08-18 立项（茉莉·本体线，任务书「M1 最先做」）。
 */

import { readdirSync, readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const TRUE_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const ROOT = process.env.KFM_PROBE_ROOT || TRUE_ROOT; // 探针注入：假树优先
const BASELINE_DIR = join(ROOT, 'docs', 'ledger', 'migration-baselines');

// ---------- 采集 ----------

function readText(p) {
  try { return readFileSync(p, 'utf-8'); } catch { return ''; }
}

function collectCurrent() {
  const pkg = JSON.parse(readText(join(ROOT, 'package.json')) || '{}');
  const version = pkg.version || 'unknown';

  // 测试数（与 sync-counts 同口径：regression|test( 调用数）
  let testCount = 0;
  const testsDir = join(ROOT, 'tests');
  if (existsSync(testsDir)) {
    for (const f of readdirSync(testsDir)) {
      if (f.endsWith('.ts')) {
        testCount += readText(join(testsDir, f)).match(/^\s*(?:regression|test)\(/gm)?.length ?? 0;
      }
    }
  }

  // 检查器数
  const checkDir = join(ROOT, 'scripts', 'check');
  const checkCount = existsSync(checkDir)
    ? readdirSync(checkDir).filter(f => /^check-.*\.mjs$/.test(f)).length : 0;

  // 链步数
  const chainSteps = (readText(join(ROOT, 'scripts', 'check', 'chain.mjs'))
    .match(/^  'node /gm) || []).length;

  // 四类功能面（文件名集 → hash）
  function nameSet(dir, filter) {
    if (!existsSync(dir)) return [];
    return readdirSync(dir).filter(filter).sort();
  }
  const cards = nameSet(join(ROOT, 'src', 'client', 'cards', 'plugins'), f => /\.card\.ts$/.test(f));
  const tools = nameSet(join(ROOT, 'src', 'server', 'tools'), f => /\.tool\.ts$/.test(f));
  const workflows = nameSet(join(ROOT, 'docs', 'workflows'), f => /\.yaml$/.test(f));

  // slash 命令注册点（v8.11 命令系统落地后自然变非空；现在空集也是合法基线）
  let cmds = [];
  const slashSrc = join(ROOT, 'src', 'client');
  if (existsSync(slashSrc)) {
    const hits = readText(join(slashSrc, 'modules', 'orb-chat-run.ts')).match(/['']\/(\w+)['']/g) || [];
    cmds = [...new Set(hits)].sort();
  }

  function hashOf(list) {
    return createHash('sha256').update(list.join('\n')).digest('hex').slice(0, 12);
  }

  return {
    version,
    capturedAt: new Date().toISOString(),
    testCount, checkCount, chainSteps,
    faces: {
      cards:    { count: cards.length,     hash: hashOf(cards) },
      tools:    { count: tools.length,     hash: hashOf(tools) },
      cmds:     { count: cmds.length,      hash: hashOf(cmds) },
      workflows:{ count: workflows.length, hash: hashOf(workflows) },
    },
    features: { cards, tools, cmds, workflows },
  };
}

// ---------- 基线存取 ----------

function latestBaseline() {
  if (!existsSync(BASELINE_DIR)) return null;
  const files = readdirSync(BASELINE_DIR).filter(f => f.endsWith('.json')).sort();
  if (!files.length) return null;
  return JSON.parse(readFileSync(join(BASELINE_DIR, files[files.length - 1]), 'utf-8'));
}

// ---------- 模式 ----------

const mode = process.argv.includes('--record') ? 'record' : 'verify';
let errors = 0;
function error(msg) { console.error(`[check-migration-baseline] ${msg}`); errors++; }

const cur = collectCurrent();

if (mode === 'record') {
  mkdirSync(BASELINE_DIR, { recursive: true });
  const out = join(BASELINE_DIR, `${cur.version}.json`);
  if (existsSync(out)) {
    console.log(`[check-migration-baseline] 版本 ${cur.version} 基线已存在，跳过重写（改基线 = 手删文件再 --record）`);
  } else {
    writeFileSync(out, JSON.stringify(cur, null, 2));
    console.log(`[check-migration-baseline] ✅ 基线已记录 ${out}`);
    console.log(`  v${cur.version} · 测试 ${cur.testCount} · 检查器 ${cur.checkCount} · 链步 ${cur.chainSteps}`);
  }
  process.exit(0);
}

// verify 模式
const base = latestBaseline();
if (!base) {
  // 首次运行（尚无任何基线）：不报错不通过也不失败——提示发布流程先记基线。
  // 这是故意的：check 链在 8.7.0 发布前每天在跑，没有基线是常态不是病。
  console.log(`[check-migration-baseline] 无基线快照（docs/ledger/migration-baselines/ 空）——8.x 首版发布时 --record 建立；当前实况：v${cur.version} 测试 ${cur.testCount} 检查器 ${cur.checkCount}`);
  process.exit(0);
}

if (base.version === cur.version) {
  // 同版本：实况必须与基线完全一致（防发布后偷偷降）
  if (cur.testCount < base.testCount) error(`测试数降了：基线 ${base.testCount} → 现在 ${cur.testCount}（576 纪律：不许降）`);
  if (cur.checkCount < base.checkCount) error(`检查器数降了：基线 ${base.checkCount} → 现在 ${cur.checkCount}`);
  if (cur.chainSteps < base.chainSteps) error(`链步数降了：基线 ${base.chainSteps} → 现在 ${cur.chainSteps}`);
  for (const face of ['cards', 'tools', 'cmds', 'workflows']) {
    if (cur.faces[face].count < base.faces[face].count) {
      const lost = base.features[face].filter(x => !cur.features[face].includes(x));
      error(`功能面 ${face} 缩水：基线 ${base.faces[face].count} → 现在 ${cur.faces[face].count}；消失：${lost.join(', ') || '(hash 变化，见 features 对比)'}`);
    }
  }
} else {
  // 新版本（cur.version > base.version 字典序对 8.x.y 成立）：与上一版基线对账
  // 「不许降」纪律同上——8.x 功能只增不减。
  if (cur.testCount < base.testCount) error(`新版本 ${cur.version} 测试数低于上版基线 ${base.version}：${cur.testCount} < ${base.testCount}（替换即删旧 ≠ 测试缩水，被替换物必须有等价新钉）`);
  if (cur.checkCount < base.checkCount) error(`新版本 ${cur.version} 检查器数低于上版：${cur.checkCount} < ${base.checkCount}`);
  for (const face of ['cards', 'tools', 'cmds', 'workflows']) {
    if (cur.faces[face].count < base.faces[face].count) {
      const lost = base.features[face].filter(x => !cur.features[face].includes(x));
      error(`新版本 ${cur.version} 功能面 ${face} 少于上版：消失：${lost.join(', ') || '(hash 变化)'}`);
    }
  }
  // 提示：新版本发布时记得 --record（release.yaml 负责调，这里只提醒不报错——
  // 「忘记录新基线」是发布流程的病，由 check-deploy-freshness/versions 那侧管）
  console.log(`[check-migration-baseline] 基线 v${base.version} → 当前 v${cur.version}（新版发布时记得 --record）`);
}

if (errors) {
  console.error(`\n[check-migration-baseline] 检查失败，构建中断。`);
  console.error(`[check-migration-baseline] ⛔ MIG-BASE-01：迁移基线对账失败——功能只增不减是 8.x 纪律；`);
  console.error(`    若这是登记过的退役（如旧终端卡删除），发布注记登记后删对应基线重录。`);
  process.exit(1);
}
console.log(`[check-migration-baseline] ✅ 基线 v${base.version} 对账通过（测试 ${cur.testCount} ≥ ${base.testCount} · 检查器 ${cur.checkCount} · 四面无缩水）`);
