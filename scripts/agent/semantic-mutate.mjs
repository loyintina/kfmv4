/**
 * semantic-mutate.mjs — 变异基准卷（mutation testing for 语义审计管线）
 *
 * 定位（2026-07-30 用户拍板）：真实漂移收敛后准确度信号枯竭——注入已知缺陷
 * 测召回率/精确率，给「改 prompt/换模型/开关思考」一把标尺。这是基准不是训练：
 * LLM 不被训练，被考的是审计管线（prompt + 机械复核 + 豁免 + 模型链）。
 *
 * 取材（五井）：L1 历史复刻（git 矿 10ae324/1400eea/7b54c7b）、L2 SEM×元素矩阵、
 * L3 对抗负例（三/四轮假发现改造，near-miss 不应报告）。
 *
 * 纪律：
 * - 变异只打沙盒副本（tmp/semantic-bench/，gitignored），活树/账本/check 链无感
 * - find 串必须在源文件出现且仅出现一次，否则物料失效（文档演进后须维护本目录）
 * - 逃逸病例（实战漏报）裁决后复刻进目录——卷子只长不缩
 *
 * 用法：
 *   node scripts/agent/semantic-mutate.mjs           物化沙盒 + ground-truth.json
 *   node scripts/agent/semantic-mutate.mjs --clean   拆除沙盒
 */

import { readFileSync, writeFileSync, cpSync, rmSync, existsSync, mkdirSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const REPO = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const SANDBOX = join(REPO, 'tmp/semantic-bench');

/** expect: 'report' = 探针应逮到（L1/L2）；'silent' = near-miss 负例，报了即误报（L3） */
export const MUTATIONS = [
  // ---- L1 回归层：历史真案例复刻 ----
  {
    id: 'M01', level: 'L1', sem: 'SEM001', file: 'README.md', expect: 'report',
    find: '**30 个 check-* 脚本 + 440 个回归测试**',
    replace: '**29 个 check-* 脚本 + 440 个回归测试**',
    tasks: ['readme-vs-maps', 'inter-readme-codemap'],
    note: 'check 计数应为 30（复刻 10ae324 README 20→19）',
  },
  {
    id: 'M02', level: 'L1', sem: 'SEM002', file: 'docs/domains/ai-chat/detail-runtime.md', expect: 'report',
    find: '`orb-chat-host.ts` 的监听器**不能**',
    replace: '`orb.ts` 的监听器**不能**',
    tasks: ['inter-detail-contract-aichat'],
    note: '符号回退已死的 orb.ts（复刻 1400eea orb 拆分追平批）',
  },
  {
    id: 'M03', level: 'L1', sem: 'SEM003', file: 'docs/workflows/contract-maintain.yaml', expect: 'report',
    find: 'exit_condition: contract <150 行 + check-contract-freshness 绿',
    replace: 'exit_condition: contract <150 行 + check-desc-freshness 绿',
    tasks: ['workflows-vs-guides', 'inter-workflows-infra'],
    note: 'check 改名未同步（复刻 1400eea；check-desc-freshness 已死）',
  },
  {
    id: 'M04', level: 'L1', sem: 'SEM001', file: 'docs/domains/server/contract.md', expect: 'report',
    find: 'providers/active/sessions/roles/configs/page-state.md/restart-pending.json',
    replace: 'providers/active/sessions/roles/configs',
    tasks: ['contract-vs-map-server'],
    note: '数据目录清单缺 page-state/restart-pending（复刻 1400eea）',
  },
  {
    id: 'M05', level: 'L1', sem: 'SEM003', file: 'docs/guides/agent-runner.md', expect: 'report',
    find: '`node scripts/agent/tag-advisor.mjs`——语义判级别',
    replace: '`node scripts/agent/tag-adviser.mjs`——语义判级别',
    tasks: ['inter-agentrunner-infra'],
    note: '同文件 4 处引用仅 1 处拼错 tag-adviser——死路径引用（复刻 7b54c7b 类的路径版）',
  },
  // ---- L2 枚举层：SEM × 文档元素矩阵 ----
  {
    id: 'M06', level: 'L2', sem: 'SEM005', file: 'docs/active/STACK.md', expect: 'report',
    find: '批 1.5 语义审计试点 ✅ 结案（2026-07-30',
    replace: '批 1.5 语义审计试点（2026-07-30',
    tasks: ['stack-vs-ledger'],
    note: '状态词摘除：已闭环但未标注，账本（semantic-provenance G1-G6）仍记结案',
  },
  {
    id: 'M07', level: 'L2', sem: 'SEM004', file: 'docs/active/vision.md', expect: 'report',
    find: '随时展开收起、随手调配。',
    replace: '随时展开收起、随手调配。\n\nKFM 不内置自己的 agent 运行时——agent 能力一律由外部 CLI 工具转接，项目只做人机交互层。',
    tasks: ['vision-vs-maps'],
    note: '植入与 agent-runner 现实相悖的远景断言（用户 2026-07-30 亲述的过时表述原型）',
  },
  {
    id: 'M08', level: 'L2', sem: 'SEM002', file: 'docs/domains/infra/contract.md', expect: 'report',
    find: '## 检查管线（npm run check，30 脚本，顺序固定）',
    replace: '## 检查管线（npm run check，28 脚本，顺序固定）',
    tasks: ['contract-vs-map-infra'],
    note: '契约计数 28 vs code-map「30 个 check（含 check-checks 自身）」冲突',
  },
  // ---- L3 对抗层：near-miss 负例（报了即误报） ----
  {
    id: 'M09', level: 'L3', sem: 'NC', file: 'README.md', expect: 'silent',
    find: '| 自动化检查管线 | 30 个 check-* 脚本',
    replace: '| 自动化检查管线 | 30（三十）个 check-* 脚本',
    tasks: ['readme-vs-maps', 'inter-readme-codemap'],
    note: '正确计数的表述变体——不应报告（三轮假发现改造）',
  },
  {
    id: 'M10', level: 'L3', sem: 'NC', file: 'docs/guides/doc-maintenance.md', expect: 'silent',
    find: 'check-docs 锚点检查（已有）',
    replace: 'check-docs 锚点检查（已在链）',
    tasks: ['doc-maintenance-vs-pipeline'],
    note: 'check-docs.mjs 真实存在——真声称换措辞不应报告（四轮假发现改造）',
  },
];

function materialize() {
  rmSync(SANDBOX, { recursive: true, force: true });
  mkdirSync(SANDBOX, { recursive: true });
  // 沙盒 = 仓库文档面的完整镜像（审计任务 feeds/baseline 只读文档 + README/CLAUDE）
  cpSync(join(REPO, 'docs'), join(SANDBOX, 'docs'), { recursive: true });
  for (const f of ['README.md', 'CLAUDE.md']) cpSync(join(REPO, f), join(SANDBOX, f));

  const truth = [];
  for (const m of MUTATIONS) {
    const abs = join(SANDBOX, m.file);
    const content = readFileSync(abs, 'utf-8');
    const first = content.indexOf(m.find);
    if (first === -1) throw new Error(`[mutate] ${m.id} 物料失效：${m.file} 找不到「${m.find.slice(0, 40)}…」（文档已演进，维护目录）`);
    if (content.indexOf(m.find, first + 1) !== -1) throw new Error(`[mutate] ${m.id} find 串不唯一：${m.file}「${m.find.slice(0, 40)}…」`);
    writeFileSync(abs, content.slice(0, first) + m.replace + content.slice(first + m.find.length));
    truth.push({ ...m, line: content.slice(0, first).split('\n').length });
  }
  writeFileSync(join(SANDBOX, 'ground-truth.json'), JSON.stringify({ sandbox: SANDBOX, mutations: truth }, null, 2) + '\n');
  return truth;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--clean')) {
    rmSync(SANDBOX, { recursive: true, force: true });
    console.log('[mutate] 沙盒已拆除');
  } else {
    const truth = materialize();
    console.log(`[mutate] 沙盒物化完成 → ${SANDBOX}`);
    for (const t of truth) console.log(`  ${t.id} [${t.level}/${t.sem}] ${t.file}:${t.line}（${t.expect}）${t.note}`);
  }
}
