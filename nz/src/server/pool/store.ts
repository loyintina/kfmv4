/**
 * store.ts — 池数据层存储底座（设计清单 §2.2 目录结构 + §2.4 激活总账）
 *
 *   ~/.kfmv4/                    NZ_AI_CONFIG_DIR 可覆盖（A1 既有机制，池层共用）
 *   ├── providers.json           provider-model 池（单文件数组——§八③例外）
 *   ├── .env                     密钥明文唯一落点（chmod 600，fuse-on-save）
 *   ├── active.json              激活总账（nz 侧 /pool/active 唯一门，仲裁②）
 *   ├── agents/roles/<id>.json   agent-prompt 池（一文件一条目）
 *   └── sessions/<id>.json       session 池（一文件一条目，v0 壳）
 *
 * 激活总账纪律（§2.4）：
 *   - schema = v8 实录子集 {providerId, modelId, roleFile, sessionId}——
 *     configFile（组合配置卡字段）砍掉不迁（nz 无组合池，登记在案）；
 *   - 读 = mtime 缓存直读：kfmv4 双端边界不监听（仲裁②），文件 mtime 一变
 *     下次读即重读（刷新校准），自己写账后缓存即刻校准；
 *   - 写 = 原子写（临时文件+rename，防半截 JSON）且恒四字段。
 *
 * 观测：/tmp/nz-pool.log JSONL 逐拍落 CRUD/守卫拦截/fuse/激活（清单可观测性
 * 约束）——不落明文 key、不落条目全文（摘要+计数），NZ_POOL_LOG 可覆盖。
 */
import { readFileSync, statSync, writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { appendFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { aiConfigDir } from '../ai/providers.ts';

/** 池根目录：NZ_AI_CONFIG_DIR 可覆盖，默认 ~/.kfmv4（A1 同款机制） */
export function poolDir(dir?: string): string {
  return dir ?? aiConfigDir();
}

export const providersPath = (dir: string) => join(dir, 'providers.json');
export const rolesDir = (dir: string) => join(dir, 'agents', 'roles');
export const sessionsDir = (dir: string) => join(dir, 'sessions');
export const activePath = (dir: string) => join(dir, 'active.json');
export const envPath = (dir: string) => join(dir, '.env');

/** 原子写 JSON（临时文件+rename，防半截 JSON）；mode 仅建文件时生效 */
export function atomicWriteJson(path: string, value: unknown, mode = 0o600): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp-${process.pid}`;
  writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n', { mode });
  renameSync(tmp, path);
}

// ========== 激活总账（§2.4） ==========

export interface ActiveLedger {
  providerId: string;
  modelId: string;
  roleFile: string;
  sessionId: string;
}

export const ACTIVE_FIELDS = ['providerId', 'modelId', 'roleFile', 'sessionId'] as const;

const EMPTY_LEDGER: ActiveLedger = { providerId: '', modelId: '', roleFile: '', sessionId: '' };

const _activeCache = new Map<string, { mtimeMs: number; ledger: ActiveLedger }>();

/** 读总账：mtime 缓存直读（kfmv4 改账 mtime 变 → 下次读重读，刷新校准）；
 *  文件缺失/坏 JSON → 四字段空壳（降级不崩）；configFile 等 v8 字段不投影 */
export function readActive(dir: string): ActiveLedger {
  const path = activePath(dir);
  try {
    const st = statSync(path);
    const hit = _activeCache.get(path);
    if (hit && hit.mtimeMs === st.mtimeMs) return { ...hit.ledger };
    const raw = JSON.parse(readFileSync(path, 'utf-8')) as Record<string, unknown>;
    const ledger = { ...EMPTY_LEDGER };
    for (const f of ACTIVE_FIELDS) {
      if (typeof raw[f] === 'string') ledger[f] = raw[f] as string;
    }
    _activeCache.set(path, { mtimeMs: st.mtimeMs, ledger });
    return { ...ledger };
  } catch {
    return { ...EMPTY_LEDGER };
  }
}

/** 写总账：恒四字段原子落盘（configFile 砍掉不迁），写后缓存即刻校准 */
export function writeActive(dir: string, ledger: ActiveLedger): void {
  const clean: ActiveLedger = { ...EMPTY_LEDGER };
  for (const f of ACTIVE_FIELDS) clean[f] = ledger[f];
  atomicWriteJson(activePath(dir), clean);
  try {
    const st = statSync(activePath(dir));
    _activeCache.set(activePath(dir), { mtimeMs: st.mtimeMs, ledger: clean });
  } catch { /* 校准失败下次读重读 */ }
}

// ========== 观测日志（可观测性约束：摘要+计数，不落明文不落全文） ==========

export function poolLog(rec: Record<string, unknown>): void {
  const path = process.env.NZ_POOL_LOG ?? '/tmp/nz-pool.log';
  const line = JSON.stringify({ ts: new Date().toISOString(), ...rec }) + '\n';
  appendFile(path, line).catch(() => { /* 观测落盘失败不挡业务 */ });
}
