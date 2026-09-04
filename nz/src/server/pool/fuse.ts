/**
 * fuse.ts — 密钥代字 fuse-on-save 写侧（设计清单 §2.6：照 kfmv4
 * routes/providers.ts:44-76 + env-store.ts 语义在池数据层重落）
 *
 * 保存 provider 条目：
 *   1. apiKey 为明文 → 变量名 KFM_PROVIDER_<ID 大写规范化>（撞名 _2/_3 后缀）
 *      写入 .env（chmod 600，upsertEnvVar 保注释行）；
 *   2. 池文件只落 ${VAR} 代字——明文从此不进 providers.json；
 *   3. 已是 ${...} 代字 / 空值原样透传。
 *
 * na 智谱 401 事故纪律沿用（A1 §1.3 冻结）：派生只发生在**保存这一刻**，
 * 派生出的变量名以 ${VAR} 字面量显式写死进条目——读侧永不重新派生
 * （本模块的 envNameForProvider 仅供写侧 fuse 使用，读侧 resolveKey 在
 * ai/providers.ts，一字不动）。撞名检测范围 = 其他条目已写死的代字，
 * 自己换 key 允许复用自己的变量名（key 轮换=同变量 upsert 覆盖）。
 *
 * A1 读侧 fuse（loadProviders/resolveKey）一行不动；本模块是 A2a 新增的
 * 写侧，一套语义两个消费者。
 */
import { readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { envPath } from './store.ts';

const ENV_REF_RE = /^\$\{([A-Za-z_][A-Za-z0-9_]*)\}$/;

/** 值是否整个就是 ${VAR} 代字 */
export function isEnvRef(value: string): boolean {
  return ENV_REF_RE.test(value.trim());
}

/** provider id → 环境变量名（仅写侧保存时用一次，随即写死进条目） */
export function envNameForProvider(id: string): string {
  const norm = id.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return 'KFM_PROVIDER_' + (norm || 'KEY');
}

/** 原地更新/追加 .env 变量（保留注释与其他行），文件权限固定 600 */
export function upsertEnvVar(dir: string, name: string, value: string): void {
  const path = envPath(dir);
  let lines: string[] = [];
  try { lines = readFileSync(path, 'utf-8').split('\n'); } catch { /* 不存在则新建 */ }
  const re = new RegExp('^\\s*' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*=');
  let found = false;
  const out = lines.map((l) => {
    if (re.test(l)) { found = true; return `${name}=${value}`; }
    return l;
  });
  if (!found) {
    if (out.length > 0 && out[out.length - 1].trim() !== '') out.push('');
    out.push(`${name}=${value}`);
  }
  writeFileSync(path, out.join('\n'), { mode: 0o600 });
  try { chmodSync(path, 0o600); } catch { /* 权限提醒由启动检查兜底 */ }
}

export interface FuseEntry {
  id: string;
  apiKey: string;
}

/**
 * fuse-on-save：明文 apiKey → .env 落明文 + 返回 ${VAR} 代字；
 * 代字/空值原样透传。siblings = 同池其他条目（撞名检测用，自己除外）。
 */
export function fuseApiKey(dir: string, entry: FuseEntry, siblings: Array<Partial<FuseEntry>>): string {
  const raw = entry.apiKey.trim();
  if (!raw || isEnvRef(raw)) return entry.apiKey; // 空值/代字透传
  const taken = new Set<string>();
  for (const s of siblings) {
    if (!s || s.id === entry.id || typeof s.apiKey !== 'string') continue;
    const m = ENV_REF_RE.exec(s.apiKey.trim());
    if (m) taken.add(m[1]);
  }
  let name = envNameForProvider(entry.id);
  if (taken.has(name)) {
    let i = 2;
    while (taken.has(`${name}_${i}`)) i++;
    name = `${name}_${i}`;
  }
  upsertEnvVar(dir, name, raw);
  return '${' + name + '}';
}
