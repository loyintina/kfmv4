/**
 * env-store.ts — .kfmv4/.env 读取与「粘贴即入库」（fuse-on-save）
 *
 * providers.json 的 apiKey 支持两种形态：
 *   - 明文（旧习惯，原样使用）
 *   - ${VAR} 代字 → process.env 优先，其次 .kfmv4/.env（12-factor：进程 env 可覆盖文件）
 *
 * 融合保存（routes/providers.ts）：API 卡粘贴明文 key → 服务端写入 .env
 * （KFM_PROVIDER_<ID>），providers.json 只留代字——明文从此不落 providers.json。
 *
 * resolve 用「读 .env 文件 + mtime 缓存」而非进程启动 env：保存即生效，免重启。
 * agent 脚本侧有同语义副本（scripts/agent/agent-runner.mjs，构建边界两侧各一份，
 * .env 行格式为冻结契约：KEY=VALUE、# 注释、可选引号）。
 */

import { readFileSync, writeFileSync, statSync, chmodSync } from 'fs';
import { join } from 'path';
import { KFM_DATA_DIR } from './path-utils.js';

export const ENV_PATH = join(KFM_DATA_DIR, '.env');

const ENV_REF_RE = /^\$\{([A-Za-z_][A-Za-z0-9_]*)\}$/;

let _cache: { mtimeMs: number; vars: Record<string, string> } | null = null;

/** 解析 .env 行格式（冻结契约）：KEY=VALUE、# 注释、可选成对引号 */
export function parseEnv(content: string): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (val.length >= 2 &&
        ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))) {
      val = val.slice(1, -1);
    }
    vars[key] = val;
  }
  return vars;
}

/** 读 .env（mtime 缓存：文件没变直接命中缓存，保存即生效） */
export function loadEnvFile(): Record<string, string> {
  try {
    const st = statSync(ENV_PATH);
    if (_cache && _cache.mtimeMs === st.mtimeMs) return _cache.vars;
    const vars = parseEnv(readFileSync(ENV_PATH, 'utf-8'));
    _cache = { mtimeMs: st.mtimeMs, vars };
    return vars;
  } catch {
    return {};
  }
}

/** 值是否整个就是 ${VAR} 代字 */
export function isEnvRef(value: string): boolean {
  return ENV_REF_RE.test(value.trim());
}

export interface ResolvedKey {
  value: string;
  /** 引用存在但变量未设置时的变量名（人话报错用），否则 null */
  missingVar: string | null;
}

/** 解析 apiKey：${VAR} → process.env 优先、.env 其次；其余原样返回 */
export function resolveKey(raw: string): ResolvedKey {
  const m = ENV_REF_RE.exec(raw.trim());
  if (!m) return { value: raw, missingVar: null };
  const name = m[1];
  const v = process.env[name] ?? loadEnvFile()[name];
  if (v) return { value: v, missingVar: null };
  return { value: '', missingVar: name };
}

/** provider id → 环境变量名（Opencode Go Google → KFM_PROVIDER_OPENCODE_GO_GOOGLE） */
export function envNameForProvider(id: string): string {
  const norm = id.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return 'KFM_PROVIDER_' + (norm || 'KEY');
}

/** 原地更新/追加 .env 变量（保留注释与其他行），文件权限固定 600 */
export function upsertEnvVar(name: string, value: string): void {
  let lines: string[] = [];
  try { lines = readFileSync(ENV_PATH, 'utf-8').split('\n'); } catch { /* 不存在则新建 */ }
  const re = new RegExp('^\\s*' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*=');
  let found = false;
  const out = lines.map(l => {
    if (re.test(l)) { found = true; return `${name}=${value}`; }
    return l;
  });
  if (!found) {
    if (out.length > 0 && out[out.length - 1].trim() !== '') out.push('');
    out.push(`${name}=${value}`);
  }
  writeFileSync(ENV_PATH, out.join('\n'), { mode: 0o600 });
  try { chmodSync(ENV_PATH, 0o600); } catch { /* 权限提醒由 index.ts 启动检查兜底 */ }
  _cache = null; // 立即失效缓存：保存即生效
}
