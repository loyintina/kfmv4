/**
 * tag-advisor.mjs — 发版建议 agent（agent-runner 一号负载）
 *
 * 分工（STACK #3 定稿）：机械算下限，agent 判级别起草稿，人拍板（tag 永远是人工动作）。
 *   下限规则：breaking → major；有任意提交 → patch；全空 → none（feat 不抬下限，级别归语义层）
 *   agent 输出 {level, reason, notes}，级别不得低于机械下限（一致性校验）
 *
 * 用法：node scripts/agent/tag-advisor.mjs [基准tag] [顶端ref=HEAD]
 * exit 0 = 精确建议（可机械流转）；exit 2 = 全 provider 失败或重试耗尽
 * （exit 1「模糊输出交调用方」是设计意图未实现——语义审计 B2 修订，重试耗尽现归 exit 2）
 */

import { execSync } from 'child_process';
import { runAgent, extractJson } from './agent-runner.mjs';

const LEVELS = ['none', 'patch', 'minor', 'major'];

const [baseArg, headArg] = process.argv.slice(2);
const baseTag = baseArg || execSync('git describe --tags --abbrev=0', { encoding: 'utf-8' }).trim();
const headRef = headArg || 'HEAD';
const log = execSync(`git log ${baseTag}..${headRef} --format='%s'`, { encoding: 'utf-8' }).trim();
const commits = log ? log.split('\n') : [];

const count = re => commits.filter(s => re.test(s)).length;
const stats = {
  total: commits.length,
  feat: count(/^feat/),
  fix: count(/^fix/),
  docs: count(/^docs/),
  refactor: count(/^refactor/),
  breaking: count(/BREAKING|^feat!|^fix!/),
};
const floor = stats.breaking > 0 ? 'major' : stats.total > 0 ? 'patch' : 'none';

const recentTags = execSync("git tag -l 'v*' --sort=-v:refname | head -5", { encoding: 'utf-8' }).trim();

const system = '你是版本发布顾问。只输出要求的 JSON，不要任何多余文字。';
const prompt = `项目采用 semver，但有本项目的家规（v8.3.1 定稿于 docs/guides/release.md，优先级高于教科书规则）：
- 级别看主题不看类型计数：major=架构设计跃迁；minor=单一主题的完整功能闭环（多个 feat 轮组合后的成品，不是 feat 累计）；patch=问题轮闭环（这一轮发现的问题都解决了，开新循环）
- 一批提交混两个主题时，以已完成主题定级；未完成主题（地基/半成品能力）不抬级别，写进 notes 注明
- feat 提交若只是上一版刚发布能力的细化/收尾/补全 → patch；独立新能力才 minor
- 窗口很小（≤7 提交）且无 breaking → 倾向 patch，除非有明确独立新能力
- major 只用于架构级推翻（会有 BREAKING 标记或主题级重构）；无法从提交清单确认 major 时给 minor 并在 reason 注明

真实判例（照这个尺度判）：
- 「逐工具压缩细化 + 失败模式标注」（v8.1.0 压缩器的细化）→ patch（v8.1.1 实况）
- 「文档管线再设计：新增 7 个检查 + 探针自检体系」（此前不存在的能力域）→ minor（v8.3.0 实况）
- 「后台挂机 run-manager + WS 真心跳」（新能力域）→ minor（v7.3.0 实况）
- 「分段传输 + nginx 修复」（v7.3.0 能力的收尾）→ patch（v7.3.1 实况）
- 「审计闭环：漂移溯源裁决 + 死代码清理 + orb 拆分」（问题轮；同批含 agent-runner 地基但主题未完成，不抬级）→ patch（v8.3.1 实况）

最近 tag：${recentTags.split('\n').join('、')}
基准：${baseTag} 以来共 ${stats.total} 提交（feat:${stats.feat} fix:${stats.fix} docs:${stats.docs} refactor:${stats.refactor} breaking:${stats.breaking}）
机械下限：${floor}（你的建议不得低于此级别）

提交清单：
${commits.map(s => '- ' + s).join('\n')}

判断这批变化该不该发版、发哪一级，并起草 release note（一句话）。
输出 JSON：{"level":"none|patch|minor|major","reason":"20字内理由","notes":"release note 草稿"}`;

const result = await runAgent({
  system,
  prompt,
  validate: text => {
    const j = extractJson(text);
    if (!j || !LEVELS.includes(j.level)) return null;
    if (LEVELS.indexOf(j.level) < LEVELS.indexOf(floor)) return null;
    return j;
  },
});

if (!result.ok) {
  console.error('[tag-advisor] 全部 provider 失败：');
  for (const e of result.errors) console.error('  - ' + e);
  process.exit(2);
}

if (result.attempts > 1 || result.errors.length) {
  console.error(`[tag-advisor] 注：${result.provider} 第 ${result.attempts} 次尝试成功` + (result.errors.length ? `（前置失败：${result.errors.join('；')}）` : ''));
}

const { level, reason, notes } = result.data;
console.log(JSON.stringify({ level, floor, reason, notes, stats, provider: result.provider }, null, 2));
if (level === 'none') {
  console.log(`\n[tag-advisor] 建议：暂不发版（${reason}）`);
} else {
  const version = baseTag.replace(/^v/, '');
  const [major, minor, patch] = version.split('.').map(Number);
  const next = level === 'major' ? `${major + 1}.0.0` : level === 'minor' ? `${major}.${minor + 1}.0` : `${major}.${minor}.${patch + 1}`;
  console.log(`\n[tag-advisor] 建议：v${next}（${reason}）`);
  console.log(`[tag-advisor] release note 草稿：${notes}`);
}
process.exit(0);
