/**
 * providers.ts — providers.json 载入 + 代字 fuse（纯逻辑 + 文件读取，无网络）。
 *
 * 语义基准 = kfmv4 env-store.ts resolveKey 精简复刻 × na providers.rs：
 *   - apiKey = "${VAR}" 代字 → process.env 优先，.env 其次（12-factor）；
 *   - .env 行格式对齐 na parse_dotenv：KEY=VALUE、# 注释、export 前缀、
 *     可选成对引号、= 两侧空白（kfmv4 冻结契约 + export 支持）；
 *   - mtime 缓存：文件没变直接命中，保存即生效；
 *   - 变量缺失 → missingVar 点名变量名（人话报错由调用方组），value 为空，
 *     绝不裸发代字（fuse = 引线，断在 server，不烧到上游）；
 *   - 明文 key（旧习惯）原样使用；
 *   - provider 匹配按 id 或 name，无静默回退（BAR-PROVIDER-MATCH-01）。
 *
 * na 智谱 401 事故纪律（§1.3）：env 变量名必须显式写死在 providers.json
 * 条目里，禁止从 id 自动派生（中文 id 经派生函数全塌缩成同名代字 → 两卡
 * 串号）——本模块不出口 envNameForProvider，也不做 upsertEnvVar（A1 不写配置）。
 *
 * 配置目录：默认 ~/.kfmv4/（直读 kfmv4 数据目录，零重复配置），
 * NZ_AI_CONFIG_DIR 环境变量整体覆盖；函数级 dir 参数供考卷注入。
 */

import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

export interface AiProvider {
  id: string;
  name: string;
  baseUrl: string;
  /** 原始 apiKey 字段：可能是 ${VAR} 代字，也可能是明文 */
  apiKey: string;
  models: string[];
}

/** 配置目录：NZ_AI_CONFIG_DIR 可覆盖，默认 ~/.kfmv4（kfmv4 数据目录直读） */
export function aiConfigDir(): string {
  return process.env.NZ_AI_CONFIG_DIR || join(homedir(), '.kfmv4');
}

/** 解析 .env 行格式：KEY=VALUE、# 注释、export 前缀、可选成对引号、= 两侧空白 */
export function parseEnv(content: string): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const line of content.split('\n')) {
    let t = line.trim();
    if (!t || t.startsWith('#')) continue;
    if (t.startsWith('export ')) t = t.slice(7).trimStart();
    const eq = t.indexOf('=');
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    if (!key) continue;
    let val = t.slice(eq + 1).trim();
    if (val.length >= 2 &&
        ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))) {
      val = val.slice(1, -1);
    }
    vars[key] = val;
  }
  return vars;
}

const _envCache = new Map<string, { mtimeMs: number; vars: Record<string, string> }>();

/** 读 .env（mtime 缓存：文件没变直接命中缓存，保存即生效）；文件不存在 → 空表 */
export function loadEnvFile(dir: string = aiConfigDir()): Record<string, string> {
  const path = join(dir, '.env');
  try {
    const st = statSync(path);
    const hit = _envCache.get(path);
    if (hit && hit.mtimeMs === st.mtimeMs) return hit.vars;
    const vars = parseEnv(readFileSync(path, 'utf-8'));
    _envCache.set(path, { mtimeMs: st.mtimeMs, vars });
    return vars;
  } catch {
    return {};
  }
}

const ENV_REF_RE = /^\$\{([A-Za-z_][A-Za-z0-9_]*)\}$/;

export interface ResolvedKey {
  value: string;
  /** 引用存在但变量未设置时的变量名（人话报错用），否则 null */
  missingVar: string | null;
}

/** 解析 apiKey：${VAR}（全串锚定）→ process.env 优先、.env 其次；其余原样返回 */
export function resolveKey(raw: string, dir: string = aiConfigDir()): ResolvedKey {
  const m = ENV_REF_RE.exec(raw.trim());
  if (!m) return { value: raw, missingVar: null };
  const name = m[1];
  const v = process.env[name] ?? loadEnvFile(dir)[name];
  if (v) return { value: v, missingVar: null };
  return { value: '', missingVar: name };
}

/** 读取 providers.json（数组）；文件缺失/坏 JSON → 空表（错误人话由调用方组） */
export function loadProviders(dir: string = aiConfigDir()): AiProvider[] {
  try {
    const arr = JSON.parse(readFileSync(join(dir, 'providers.json'), 'utf-8')) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.map((item) => {
      const o = (item ?? {}) as Record<string, unknown>;
      const s = (k: string) => (typeof o[k] === 'string' ? (o[k] as string) : '');
      return {
        id: s('id'),
        name: s('name'),
        baseUrl: s('baseUrl'),
        apiKey: s('apiKey'),
        models: Array.isArray(o.models) ? o.models.filter((m): m is string => typeof m === 'string') : [],
      };
    });
  } catch {
    return [];
  }
}

/** provider 解析（BAR-PROVIDER-MATCH-01）：按 id 或 name 匹配，无静默回退 */
export function findProvider(providers: AiProvider[], key: string | undefined): AiProvider | null {
  if (!key) return null;
  return providers.find(p => p.id === key || p.name === key) ?? null;
}
