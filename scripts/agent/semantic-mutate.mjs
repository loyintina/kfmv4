/**
 * semantic-mutate.mjs — 变异基准卷（mutation testing for 语义审计管线）
 *
 * 定位（2026-07-30 用户拍板）：真实漂移收敛后准确度信号枯竭——注入已知缺陷
 * 测召回率/精确率，给「改 prompt/换模型/开关思考」一把标尺。这是基准不是训练：
 * LLM 不被训练，被考的是审计管线（prompt + 机械复核 + 豁免 + 模型链）。
 *
 * 取材（五井）：L1 历史复刻（git 矿 10ae324/1400eea/7b54c7b）、L2 SEM×元素矩阵、
 * L3 对抗负例（三/四轮假发现改造，near-miss 不应报告）。
 * 2026-07-30 扩卷：L2 矩阵系统填充（M11-M15）+ MID 中间难度档（MID-1..4）——
 * 四条稳定盲区（M02/M05/M06/M07）各拆单一难点降级成可逮题，用于分辨
 * 「改 prompt/换模型」动的是哪个能力维度。
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
    find: '**31 个 check-* 脚本 + 440 个回归测试**',
    replace: '**30 个 check-* 脚本 + 440 个回归测试**',
    tasks: ['readme-vs-maps', 'inter-readme-codemap'],
    note: 'check 计数应为 31（复刻 10ae324 README 20→19；锚点随 sync-counts 30→31 迁移）',
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
    tasks: ['vision-vs-maps', 'vision-internal'],
    note: '植入与 agent-runner 现实相悖的远景断言（用户 2026-07-30 亲述的过时表述原型）',
  },
  {
    id: 'M08', level: 'L2', sem: 'SEM002', file: 'docs/domains/infra/contract.md', expect: 'report',
    find: '## 检查管线（npm run check，31 脚本，顺序固定）',
    replace: '## 检查管线（npm run check，29 脚本，顺序固定）',
    tasks: ['contract-vs-map-infra'],
    note: '契约计数 29 vs code-map「30 个 check（含 check-checks 自身）」冲突（锚点随 31 迁移）',
  },
  // ---- L3 对抗层：near-miss 负例（报了即误报） ----
  {
    id: 'M09', level: 'L3', sem: 'NC', file: 'README.md', expect: 'silent',
    find: '| 自动化检查管线 | 31 个 check-* 脚本',
    replace: '| 自动化检查管线 | 31（三十一）个 check-* 脚本',
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
  // ---- L2 矩阵填充（2026-07-30 扩卷）：SEM × 文档元素空格系统补齐 ----
  {
    id: 'M11', level: 'L2', sem: 'SEM001', file: 'docs/guides/testing.md', expect: 'report',
    find: '440 个测试（单元/集成/回归钉/不变量），~1.3s',
    replace: '420 个测试（单元/集成/回归钉/不变量），~1.3s',
    tasks: ['guides-testing-vs-infra'],
    note: '测试计数漂移（infra code-map 明记 440——baseline 可逮）',
  },
  {
    id: 'M12', level: 'L2', sem: 'SEM002', file: 'CLAUDE.md', expect: 'report',
    find: 'npm run check    # 31 个 check-*.mjs + tsc --noEmit（仅检查，不构建）',
    replace: 'npm run check    # 30 个 check-*.mjs + tsc --noEmit（仅检查，不构建）',
    tasks: ['claude-vs-docs'],
    note: '入口文档计数 30 vs infra 契约「31 脚本」冲突（锚点随 31 迁移）',
  },
  {
    id: 'M13', level: 'L2', sem: 'SEM003', file: 'docs/constraints/diagnostics.md', expect: 'report',
    find: '构建由 build.mjs 接管',
    replace: '构建由 bundle.mjs 接管',
    tasks: ['diagnostics-vs-maps'],
    note: '幽灵文件名——bundle 只是 npm script 别名，build.mjs 才真实存在（codeMaps 可逮）',
  },
  {
    id: 'M14', level: 'L2', sem: 'SEM004', file: 'docs/constraints/invariants.md', expect: 'report',
    find: 'AI 的长期记忆是产品本体',
    replace: 'AI 的长期记忆只是易失缓存，产品本体是文件管理功能',
    tasks: ['inter-vision-invariants', 'invariants-vs-maps'],
    note: '与 vision §1.8「文档系统 = AI 的长期记忆库」争夺产品定位权威',
  },
  {
    id: 'M15', level: 'L3', sem: 'NC', file: 'docs/guides/release.md', expect: 'silent',
    find: '距上个 tag ≥30 提交或 ≥10 feat → WARN，不中断',
    replace: '距上个 tag ≥30 个提交或 ≥10 个 feat → WARN，不中断',
    tasks: ['guides-release-vs-history'],
    note: '正确阈值的量词变体——不应报告。2026-07-30 迁址：原锚 CLAUDE.md:42 距 M12 仅 3 行，±5 容差必然双中（出题事故非模型误报）',
  },
  // ---- MID 中间难度档（2026-07-30 扩卷）：四条稳定盲区各拆单一难点，降级可逮 ----
  // 设计逻辑：M02 难在需 src/ 代码知识 → MID-1 同款改名回退但 code-map 基线明记新名；
  // M05 难在拼写需 FS 对证 → MID-2 同文件语义自相矛盾；M06 难在跨账本对账 → MID-3
  // 状态词翻转与下行结算详情自打架；M07 难在远景 vs 实现现实 → MID-4 决策翻转被下句自反驳
  {
    id: 'MID-1', level: 'MID', sem: 'SEM003', file: 'docs/domains/ai-chat/detail-runtime.md', expect: 'report',
    find: '| `src/client/modules/session-client.ts` | 客户端会话管理',
    replace: '| `src/client/modules/session-store.ts` | 客户端会话管理',
    tasks: ['inter-detail-contract-aichat'],
    note: '改名回退（M02 同族）——但 code-map 明记 session-client.ts:149，且下行 280 行服务端同名 session-store.ts，文档面即可逮',
  },
  {
    id: 'MID-2', level: 'MID', sem: 'SEM002', file: 'docs/guides/agent-runner.md', expect: 'report',
    find: '2 = 全部任务失败/环境缺 provider',
    replace: '1 = 全部任务失败/环境缺 provider',
    tasks: ['inter-agentrunner-infra'],
    note: '同文件 17-19 行明记 exit 0/2 且 exit 1 未实现——自相矛盾，无需外部知识（M05 拼写难点摘除）',
  },
  {
    id: 'MID-3', level: 'MID', sem: 'SEM005', file: 'docs/active/STACK.md', expect: 'report',
    find: 'v8.2 文档系统重构 — ✅ 完成（2026-07-29 切换提交）',
    replace: 'v8.2 文档系统重构 — 进行中（2026-07-29 切换提交）',
    tasks: ['stack-vs-ledger'],
    note: '状态词翻转（比 M06 摘除更响）——下行「65 份结算/压缩轮/设计文档已自我分散」全是完成语气，自打架',
  },
  {
    id: 'MID-4', level: 'MID', sem: 'SEM005', file: 'docs/active/vision.md', expect: 'report',
    find: '「决定：不做」对内置通路不再成立',
    replace: '「决定：不做」对内置通路依然成立',
    tasks: ['vision-vs-maps', 'vision-internal', 'inter-vision-invariants'],
    note: '决策翻转——下句「实际走出的是第三条路：窄域自建」直接反驳，code-maps 遍布 scripts/agent/（M07 实现知识难点摘除）',
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
