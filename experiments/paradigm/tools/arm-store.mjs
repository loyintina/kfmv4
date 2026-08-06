#!/usr/bin/env node
/**
 * arm-store.mjs — 实验臂数据库访问层（paradigm 研究线基建，2026-08-06）
 *
 * 设计 → ../design-arm-store.md。解决的问题：sessions/script 淤积 3883 文件、
 * 臂语义（p/m 下标是每批次独立编号）解码靠考古。本库两张表：
 *   batches：批次注册表——batch-run 启动时把 tasks/paradigms/models 清单写库
 *            （写入时全知，下标歧义从此根治；signature 去重，同命令重跑复用批次行）
 *   arms：   臂——语义列（experiment/task/paradigm/model/provider/rep）写入时直给，
 *            统计列（chan/occupancy/token 数）入库时算好，content 存完整会话 JSON。
 *
 * 技术：node:sqlite（node v22 内置，免标志可用，仅 ExperimentalWarning），WAL 模式。
 * 所有实验工具统一走本模块，不直接碰 DB 文件。
 *
 * 用法（作为模块）：
 *   import { registerBatch, putArm, hasArm, getArm, listArms, iterArms } from './arm-store.mjs';
 */
import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { createHash } from 'crypto';
import { occRatio } from './occupancy.mjs';

export const DB_PATH = join(homedir(), '.kfmv4', 'experiments', 'arms.db');

let _db = null;
function db() {
  if (_db) return _db;
  mkdirSync(dirname(DB_PATH), { recursive: true });
  _db = new DatabaseSync(DB_PATH);
  _db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 10000;
    CREATE TABLE IF NOT EXISTS batches (
      batch_id INTEGER PRIMARY KEY AUTOINCREMENT,
      signature TEXT UNIQUE NOT NULL,
      invoked_at TEXT NOT NULL,
      prefix TEXT NOT NULL,
      task_file TEXT,
      tasks TEXT NOT NULL,       -- JSON 数组（任务全文）
      paradigms TEXT NOT NULL,   -- JSON 数组，下标 = pN
      models TEXT NOT NULL,      -- JSON 数组，下标 = mN
      provider TEXT NOT NULL,
      arms_planned INTEGER NOT NULL,
      note TEXT
    );
    CREATE TABLE IF NOT EXISTS arms (
      arm_id TEXT PRIMARY KEY,
      batch_id INTEGER NOT NULL REFERENCES batches(batch_id),
      experiment TEXT NOT NULL,  -- e11 / e12 / …（prefix 去尾部 tN）
      task_idx INTEGER, paradigm_idx INTEGER, model_idx INTEGER, rep INTEGER,
      task TEXT NOT NULL,
      paradigm TEXT NOT NULL,    -- '无' = 对照组
      model TEXT NOT NULL,
      provider TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ok',   -- ok / error-stub / censored
      message_count INTEGER, token_count INTEGER, full_token_count INTEGER,
      chan TEXT,                 -- text / reasoning / empty（末条 AI 消息通道分桶）
      occupancy TEXT,            -- ⚠️ 废弃（fullTokenCount 是增量计数，不反映真实上下文，
                                 --   实测 <8k 带挤进 1232 臂）；保留仅为旧行兼容，
                                 --   占用率分析一律用 occ_ratio
      occ_ratio REAL,            -- 真实占用率 = 包标称尺寸÷模型窗口（occupancy.mjs，
                                 --   未登记为 NULL；写入时算好，旧行由 backfill 补齐）
      decode TEXT,               -- 语义解码来源：write(写入时直给) / hash(哈希重算)
                                 --   / registry(遗留注册表) / undecoded(未解码，paradigm='?')
      created_at TEXT, updated_at TEXT,
      content TEXT NOT NULL      -- 完整会话 JSON（原文件内容，不建索引）
    );
    CREATE INDEX IF NOT EXISTS idx_arms_cell ON arms(experiment, paradigm, model);
    CREATE INDEX IF NOT EXISTS idx_arms_batch ON arms(batch_id);
    CREATE INDEX IF NOT EXISTS idx_arms_status ON arms(status);
  `);
  // 旧库迁移：补 occ_ratio 列并回填（幂等）
  const cols = _db.prepare(`PRAGMA table_info(arms)`).all().map(c => c.name);
  if (!cols.includes('occ_ratio')) {
    _db.exec(`ALTER TABLE arms ADD COLUMN occ_ratio REAL`);
  }
  backfillOccRatio(_db);
  return _db;
}

/** 旧行回填 occ_ratio（写入时直给之前的存量臂；幂等，只碰 NULL 行） */
function backfillOccRatio(d) {
  const rows = d.prepare(`SELECT arm_id, paradigm, model FROM arms WHERE occ_ratio IS NULL`).all();
  if (!rows.length) return;
  const upd = d.prepare(`UPDATE arms SET occ_ratio = ? WHERE arm_id = ?`);
  for (const r of rows) upd.run(occRatio(r.paradigm, r.model), r.arm_id);
}

/** ⚠️ 废弃：占用率分带（fullTokenCount 增量计数的绝对分带，不反映真实上下文）。
 *  仅为旧行兼容保留写入；占用率分析用 occ_ratio（occupancy.mjs）。 */
export function occupancyBand(fullTokens) {
  const t = Number(fullTokens) || 0;
  for (const [band, hi] of [['<8k', 8192], ['8-16k', 16384], ['16-32k', 32768],
    ['32-64k', 65536], ['64-96k', 98304], ['96-128k', 131072]]) {
    if (t < hi) return band;
  }
  return '128k+';
}

/** 末条 AI 消息通道分桶（与 judge-llm 的提取逻辑同口径） */
export function chanOf(content) {
  const msgs = content.messages || [];
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i].role !== 'ai') continue;
    const hasText = (msgs[i].content || []).some(b => b && b.type === 'text' && b.text);
    if (hasText) return 'text';
    const hasReasoning = (msgs[i].content || []).some(b => b && b.reasoning);
    if (hasReasoning) return 'reasoning';
  }
  return 'empty';
}

/** 注册批次（signature 去重：同参数命令重跑/断点续跑复用同一批次行） */
export function registerBatch({ prefix, taskFile = null, tasks, paradigms, models, provider, armsPlanned, note = null }) {
  const signature = createHash('md5')
    .update(JSON.stringify({ prefix, tasks, paradigms, models, provider })).digest('hex');
  const d = db();
  const hit = d.prepare('SELECT batch_id FROM batches WHERE signature = ?').get(signature);
  if (hit) return hit.batch_id;
  const r = d.prepare(`INSERT INTO batches
    (signature, invoked_at, prefix, task_file, tasks, paradigms, models, provider, arms_planned, note)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    signature, new Date().toISOString(), prefix, taskFile,
    JSON.stringify(tasks), JSON.stringify(paradigms), JSON.stringify(models),
    provider, armsPlanned, note);
  return Number(r.lastInsertRowid);
}

/** 臂入库（content 为会话 JSON 对象或字符串；统计列自动算） */
export function putArm({ batchId, armId, taskIdx = null, paradigmIdx = null, modelIdx = null,
  rep = null, task, paradigm, model, provider, status = 'ok', decode = 'write', content }) {
  const c = typeof content === 'string' ? content : JSON.stringify(content);
  const parsed = typeof content === 'string' ? JSON.parse(content) : content;
  const experiment = armId.match(/^([a-z0-9]+?)-t\d/)?.[1] || armId.split('-')[0];
  db().prepare(`INSERT OR REPLACE INTO arms
    (arm_id, batch_id, experiment, task_idx, paradigm_idx, model_idx, rep,
     task, paradigm, model, provider, status,
     message_count, token_count, full_token_count, chan, occupancy, occ_ratio, decode,
     created_at, updated_at, content)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    armId, batchId, experiment, taskIdx, paradigmIdx, modelIdx, rep,
    task, paradigm, model, provider, status,
    parsed.messageCount ?? (parsed.messages || []).length,
    parsed.tokenCount ?? null, parsed.fullTokenCount ?? null,
    chanOf(parsed), occupancyBand(parsed.fullTokenCount),
    occRatio(paradigm, model), decode,
    parsed.createdAt ?? null, parsed.updatedAt ?? null, c);
}

export function hasArm(armId) {
  return !!db().prepare('SELECT 1 FROM arms WHERE arm_id = ?').get(armId);
}

/** 取单臂完整内容（返回解析后的会话对象） */
export function getArm(armId) {
  const row = db().prepare('SELECT content FROM arms WHERE arm_id = ?').get(armId);
  return row ? JSON.parse(row.content) : null;
}

/**
 * 枚举臂（元数据，不含 content）。
 * filter: { prefixes: ['e11-t0', ...] | experiment, paradigm, model, provider, status }
 */
export function listArms(filter = {}) {
  const where = [], args = [];
  if (filter.prefixes?.length) {
    where.push('(' + filter.prefixes.map(() => 'arm_id LIKE ?').join(' OR ') + ')');
    args.push(...filter.prefixes.map(p => `${p}%`));
  }
  for (const k of ['experiment', 'paradigm', 'model', 'provider', 'status']) {
    if (filter[k]) { where.push(`${k} = ?`); args.push(filter[k]); }
  }
  const sql = `SELECT arm_id, batch_id, experiment, task_idx, paradigm_idx, model_idx, rep,
    task, paradigm, model, provider, status, message_count, token_count, full_token_count,
    chan, occupancy, occ_ratio, decode, created_at, updated_at
    FROM arms${where.length ? ' WHERE ' + where.join(' AND ') : ''} ORDER BY arm_id`;
  return db().prepare(sql).all(...args);
}

/** 逐臂迭代（含 content 解析——判卷/分析主循环用，避免一次性载入全部） */
export function* iterArms(filter = {}) {
  for (const meta of listArms(filter)) {
    yield { ...meta, content: getArm(meta.arm_id) };
  }
}

/** 批次清单（迁移报告/审计用） */
export function listBatches() {
  return db().prepare('SELECT batch_id, invoked_at, prefix, provider, arms_planned, note FROM batches ORDER BY batch_id').all();
}

export function dbStats() {
  const d = db();
  return {
    batches: d.prepare('SELECT COUNT(*) c FROM batches').get().c,
    arms: d.prepare('SELECT COUNT(*) c FROM arms').get().c,
    byExperiment: d.prepare('SELECT experiment, COUNT(*) c FROM arms GROUP BY experiment ORDER BY experiment').all(),
    dbPath: DB_PATH,
    dbExists: existsSync(DB_PATH),
  };
}

// 直接执行 = 库状态自检
if (process.argv[1] && process.argv[1].endsWith('arm-store.mjs')) {
  console.log(JSON.stringify(dbStats(), null, 1));
}
