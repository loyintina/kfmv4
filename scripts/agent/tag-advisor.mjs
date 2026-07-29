/**
 * tag-advisor.mjs — 发版建议 agent（agent-runner 一号负载）
 *
 * 分工（STACK #3 定稿）：机械算下限，agent 判级别起草稿，人拍板（tag 永远是人工动作）。
 *   下限规则：breaking → major；有 feat → minor；有 fix/docs/refactor → patch；全空 → none
 *   agent 输出 {level, reason, notes}，级别不得低于机械下限（一致性校验）
 *
 * 用法：node scripts/agent/tag-advisor.mjs [基准tag] [顶端ref=HEAD]
 * exit 0 = 精确建议（可机械流转）；exit 1 = 模糊输出（原始结果交调用方）；exit 2 = 全 provider 失败
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
const floor = stats.breaking > 0 ? 'major' : stats.feat > 0 ? 'minor' : (stats.fix + stats.docs + stats.refactor) > 0 ? 'patch' : 'none';

const recentTags = execSync("git tag -l 'v*' --sort=-v:refname | head -5", { encoding: 'utf-8' }).trim();

const system = '你是版本发布顾问。只输出要求的 JSON，不要任何多余文字。';
const prompt = `项目采用 semver（major=架构推翻/minor=新能力/patch=修复细化/none=不值得发）。

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
