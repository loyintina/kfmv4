#!/usr/bin/env node
/**
 * batch-run.mjs — 范式包实验批量驱动（并发烧 token 的关键基建）
 *
 * 变体矩阵（tasks × paradigms × models 笛卡尔积）× 每臂重复次数 →
 * 并发跑 runSession（复用 session-runner 内核），断点续跑（已归档跳过）。
 * 会话自动归档 sessions/script/（不进面板会话卡）。
 *
 * 用法：
 *   node experiments/paradigm/tools/batch-run.mjs \
 *     --tasks "探索 kfmv4-lab,审查 check 链" \
 *     --paradigms "无,evidence-discipline" \
 *     --models "deepseek-v4-flash" \
 *     --arms 2 --concurrency 4
 *   --paradigms "无" = 对照组（无范式包）；其他名 = .kfmv4/paradigms/<名>.md
 *   --arms N = 每配置重复次数（重复测量——模型随机性需多次取统计）
 */
import { existsSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';
import { runSession, loadParadigm } from './session-runner.mjs';

const REPO = join(fileURLToPath(new URL('../../..', import.meta.url)));
const SCRIPT = join(homedir(), '.kfmv4', 'sessions', 'script');

const argv = process.argv.slice(2);
const get = (k) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };

const tasks = (get('tasks') || '').split(',').map(s => s.trim()).filter(Boolean);
// --task-file <path>：整文件内容作为单一任务（JSON 契约含逗号时 --tasks 拆分不可用）
const taskFile = get('task-file');
if (taskFile) tasks.push(readFileSync(taskFile, 'utf-8').trim());
const paradigms = (get('paradigms') || '无').split(',').map(s => s.trim()).filter(Boolean);
const models = (get('models') || 'deepseek-v4-flash').split(',').map(s => s.trim()).filter(Boolean);
const arms = Number(get('arms') || 1);
const concurrency = Number(get('concurrency') || 4);
const provider = get('provider') || 'Opencode Go Google';
const prefix = get('prefix') || 'bi-';
const tools = get('tools')?.split(',').map(s => s.trim()).filter(Boolean);
const retries = Number(get('retries') || 2); // 失败臂自动重跑次数（断连/抖动用；服务重启掐 SSE 时重连仍可兜）

if (!tasks.length) {
  console.error('用法: --tasks "任务1,任务2" | --task-file <路径> [--paradigms "无,范式包名"] [--models m1,m2] [--arms N] [--concurrency N] [--provider 名] [--tools "read,grep,glob"] [--prefix bi-]');
  process.exit(2);
}
mkdirSync(SCRIPT, { recursive: true });

// 变体矩阵 → 臂清单（臂 id 编码配置，断点续跑用）
const armSpecs = [];
for (let ti = 0; ti < tasks.length; ti++) {
  for (let pi = 0; pi < paradigms.length; pi++) {
    for (let mi = 0; mi < models.length; mi++) {
      for (let n = 0; n < arms; n++) {
        armSpecs.push({ ti, pi, mi, n, task: tasks[ti], paradigm: paradigms[pi], model: models[mi] });
      }
    }
  }
}
const armId = (s) => `${prefix}t${s.ti}p${s.pi}m${s.mi}r${s.n}`;

// 断点续跑：已归档的跳过
const todo = armSpecs.filter(s => !existsSync(join(SCRIPT, `${armId(s)}.json`)));
console.log(`[batch-run] 变体 ${tasks.length} 任务 × ${paradigms.length} 范式 × ${models.length} 模型 × ${arms} 重复 = ${armSpecs.length} 臂；跳过已完成 ${armSpecs.length - todo.length}，本次 ${todo.length}（并发 ${concurrency}）`);

/** 并发 pool（hallucinate-batch 同款：并发 n，完成即取下一个） */
async function pool(items, worker, n) {
  const results = [];
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) {
      const item = items[i++];
      results.push(await worker(item));
      await new Promise(r => setTimeout(r, 200));
    }
  }));
  return results;
}

const t0 = Date.now();
const results = await pool(todo, async (s) => {
  const id = armId(s);
  const t1 = Date.now();
  const paradigmText = s.paradigm === '无' ? '' : loadParadigm(s.paradigm);
  // 失败臂自动重跑：新 sessionId（id-tN）避免服务端内存态残留接续旧 ctx，
  // out 归档回原 id 文件——断点续跑语义不变（成功即原 id 文件在场）
  for (let n = 0; n <= retries; n++) {
    const tryId = n === 0 ? id : `${id}-t${n}`;
    try {
      const res = await runSession({
        sessionId: tryId,
        messages: [{ role: 'user', content: [{ type: 'text', text: s.task }] }],
        userText: s.task,
        model: s.model,
        provider,
        paradigm: paradigmText,
        tools, // --tools 白名单透传（无 = 服务端全量工具）
        out: join(SCRIPT, `${id}.json`), // 重试也归档到原臂 id
      });
      console.log(`[batch-run] ${id} OK${n > 0 ? `（第 ${n} 次重试成功）` : ''}（${((Date.now() - t1) / 1000).toFixed(0)}s${paradigmText ? ` 范式=${s.paradigm}` : ' 对照'}${res.reconnects ? ` 重连${res.reconnects}` : ''}）`);
      return { id, ok: true, ms: res.ms, tries: n + 1 };
    } catch (e) {
      if (n === retries) {
        console.error(`[batch-run] ${id} 失败（重试 ${retries} 次后）: ${e.message.slice(0, 120)}`);
        return { id, ok: false, error: e.message.slice(0, 120) };
      }
      console.warn(`[batch-run] ${id} 第 ${n + 1} 次失败，重试…（${e.message.slice(0, 80)}）`);
    }
  }
  return { id, ok: false, error: 'unreachable' };
}, concurrency);

const ok = results.filter(r => r.ok).length;
console.log(`[batch-run] 完成 ${ok}/${results.length}，耗时 ${((Date.now() - t0) / 1000).toFixed(0)}s`);
process.exit(results.every(r => r.ok) ? 0 : 1);
