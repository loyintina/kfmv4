/**
 * check-secrets.mjs — 开源守门：工作树明文 key 泄露扫描
 *
 * 背景（2026-08-01）：providers.json 持久化落地时（1e5897d）把真实 apiKey 当默认示例
 * 提交，三个 key 进入公开历史（已全部失效注销，用户裁决不重写历史，只守门防新增）。
 *
 * 规则：扫描 git 跟踪的工作树文件（尊重 .gitignore），命中 key 形态即硬失败。
 * 形态：sk-{20+} / tp-{20+} / AIza{20+}（OpenAI 风格、Moonshot/DeepSeek 风格、Gemini）。
 * 不扫 .git 与 node_modules（git ls-files 天然排除）。
 * 例外：本文件自身、以及显式登记于例外清单的测试夹具（含真实 key 形态的样例，
 * 用于测守门本身——如真样例文件不存在则例外清单保持空）。
 */
import { execSync } from 'child_process';

const KEY_RE = /\b(sk-[A-Za-z0-9]{20,}|tp-[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{20,})\b/;

// 显式例外：路径（相对仓库根）。守门脚本自己的正则文本不算（正则里没有完整 key 形态）。
const ALLOW = new Set([
  'scripts/check/check-secrets.mjs', // 本文件（正则以字符类拼写，不构成真实 key）
]);

const files = execSync('git ls-files', { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean)
  .filter(f => !ALLOW.has(f));

const { readFileSync } = await import('fs');
const hits = [];
for (const f of files) {
  let text;
  try {
    text = readFileSync(f, 'utf8');
  } catch {
    continue; // 二进制等不可读文件跳过
  }
  for (const [i, line] of text.split('\n').entries()) {
    const m = KEY_RE.exec(line);
    if (m) {
      const key = m[1];
      hits.push(`${f}:${i + 1} ${key.slice(0, 7)}…${key.slice(-4)}`);
    }
  }
}

if (hits.length > 0) {
  console.error(`[check-secrets] ❌ 检测到 ${hits.length} 处明文 key 形态：`);
  for (const h of hits) console.error(`  ${h}`);
  console.error('[check-secrets] 真实 key 禁止进入仓库：改走 .kfmv4/.env 代字（${VAR}）或吊销该 key。');
  process.exit(1);
}
console.log('[check-secrets] OK — 工作树无明文 key 形态');
