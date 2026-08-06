#!/usr/bin/env node
/**
 * judge-px1-blind.mjs — px-1 插件实验盲判复核（2026-08-05 用户拍板）
 *
 * 动机：教官身兼挂载决策与质量评价，且知道挂载状态（期望偏差），评价是散文。
 * 本脚本把考生每轮回复抽出，抹去挂载标记/跑次/轮次身份，洗牌后逐轮盲打分，
 * 把「挂载跳变」「摘除残留」从教官叙述换成可检验的分数曲线。
 *
 * 数据源：~/.kfmv4/sessions/script/px-*.json（考生会话）+ *.exam-meta.json（挂摘日志）
 * 相位标注：attach 决策在第 T 轮末做出 → 包裹第 T+1 轮的 user 消息 →
 *   考生挂载轮 = T_attach+1 … T_detach；T_detach+1 起为摘除后。首个 attach 前为基线。
 *
 * 输出：meta-pool/judge-px1-blind.json { jid: {score, note} }
 *       meta-pool/judge-px1-blind.keymap.json { jid: {run, turn, phase, len} }
 *   —— 判卷提示词只含回复文本 + 量尺，不含任何身份/相位信息；
 *      keymap 供分析时回连（判卷员永远看不到）。
 *
 * 用法：node experiments/paradigm/tools/judge-px1-blind.mjs [--runs px-g25-1,px-c46-3] [--concurrency 6]
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';

const argv = process.argv.slice(2);
const get = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const SCRIPT_DIR = join(homedir(), '.kfmv4', 'sessions', 'script');
const META_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'meta-pool');
const OUT = join(META_DIR, 'judge-px1-blind.json');
const KEYMAP = join(META_DIR, 'judge-px1-blind.keymap.json');
const concurrency = Number(get('concurrency', 6));
const judgeModel = get('judge-model', 'deepseek-v4-flash');
const judgeProvider = get('judge-provider', 'deepseek');

const RUNS = (get('runs') || 'px-g25-1,px-g25-6,px-g25-7,px-c46-3,px-c46-4').split(',');

// ===== 量尺（讨论质量 0-5×3=0-15，锚定）=====
const RUBRIC = `你在评审一段「AI 参与软件项目设计讨论」的单轮回复。只依据这段回复本身打分，不要猜测上下文。

三维各 0-5：
1. position 立场与理由：0=回避立场/罗列方案/正确的废话；3=有立场但理由泛；5=立场明确+给出权衡+说明立场成立的条件
2. specificity 具体性：0=通用教科书模板，换任何项目都成立；3=有少量具体指涉；5=紧扣讨论中的具体约束/证据/前文细节
3. self_revision 思考暴露与自我修正：0=结论从天而降；3=展示部分推理；5=显式暴露假设/承认不确定性/修正过自己观点或说明为什么不修

只输出 JSON：{"position":N,"specificity":N,"self_revision":N,"note":"一句话依据"}`;

// ===== provider 解析（复刻 plugin-exam）=====
function resolveProvider(name) {
  const p = JSON.parse(readFileSync(join(homedir(), '.kfmv4', 'providers.json'), 'utf-8'));
  const arr = Array.isArray(p) ? p : (p.providers || Object.values(p));
  const prov = arr.find(v => v && (v.id === name || v.name === name));
  if (!prov) throw new Error(`provider 不存在: ${name}`);
  let key = prov.apiKey || '';
  const m = key.match(/^\$\{(.+)\}$/);
  if (m) {
    let env = {};
    try {
      for (const line of readFileSync(join(homedir(), '.kfmv4', '.env'), 'utf-8').split('\n')) {
        const i = line.indexOf('=');
        if (i > 0) env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
      }
    } catch { /* 无 .env */ }
    key = process.env[m[1]] ?? env[m[1]] ?? '';
  }
  return { baseUrl: prov.baseUrl.replace(/\/$/, ''), apiKey: key };
}

// ===== 相位标注 =====
function phasesFor(run, nTurns) {
  const metaPath = join(SCRIPT_DIR, `${run}.exam-meta.json`);
  const phase = Array(nTurns + 1).fill('baseline');
  if (!existsSync(metaPath)) { console.warn(`[warn] ${run} 无 exam-meta，全部标 baseline`); return phase; }
  const mountLog = JSON.parse(readFileSync(metaPath, 'utf-8')).mountLog || [];
  let mountedFrom = -1;
  for (const e of mountLog) {
    if (e.action === 'attach') mountedFrom = e.turn + 1;       // 决策在 T 轮末，包裹 T+1
    if (e.action === 'detach' && mountedFrom > 0) {
      for (let t = mountedFrom; t <= Math.min(e.turn, nTurns); t++) phase[t] = 'mounted';
      mountedFrom = -1;
      for (let t = e.turn + 1; t <= nTurns; t++) if (phase[t] === 'baseline') phase[t] = 'post-detach';
    }
  }
  if (mountedFrom > 0) for (let t = mountedFrom; t <= nTurns; t++) phase[t] = 'mounted';
  // detach 之后再次 attach 前的轮次保持 post-detach；再次挂载的轮次已被 mounted 覆盖
  return phase;
}

// ===== 抽轮 =====
function extractTurns(run) {
  const d = JSON.parse(readFileSync(join(SCRIPT_DIR, `${run}.json`), 'utf-8'));
  const ais = (d.messages || []).filter(m => m.role === 'ai');
  const turns = [];
  for (const m of ais) {
    const c = m.content || [];
    let txt = c.filter(b => b && b.type === 'text').map(b => b.text).join('');
    if (!txt) txt = c.map(b => (b && b.reasoning) || '').join(''); // 推理通道回落
    txt = txt.trim();
    if (txt.length >= 100) turns.push(txt); // 过短轮（错误/残句）不入判
  }
  return turns;
}

// ===== 洗牌（固定种子，可复现）=====
function shuffle(arr, seed = 42) {
  let s = seed;
  const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ===== 主流程 =====
const items = [];
for (const run of RUNS) {
  const turns = extractTurns(run);
  const phase = phasesFor(run, turns.length);
  turns.forEach((text, i) => items.push({ run, turn: i + 1, phase: phase[i + 1], text }));
}
shuffle(items);
const keymap = {};
items.forEach((it, idx) => {
  it.jid = `b${String(idx).padStart(3, '0')}`;
  keymap[it.jid] = { run: it.run, turn: it.turn, phase: it.phase, len: it.text.length };
});
console.log(`[judge-px1-blind] ${items.length} 轮待判（${RUNS.join(', ')}），判卷员 ${judgeModel} @ ${judgeProvider}`);

const done = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf-8')) : {};
const todo = items.filter(it => !done[it.jid]);
const { baseUrl, apiKey } = resolveProvider(judgeProvider);

async function judgeOne(it) {
  for (let n = 0; n < 4; n++) {
    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: judgeModel,
          messages: [
            { role: 'system', content: RUBRIC },
            { role: 'user', content: `【待评审的回复】\n${it.text.slice(0, 6000)}` },
          ],
          max_tokens: 800,
        }),
        signal: AbortSignal.timeout(120_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content || '';
      const m = text.match(/\{[\s\S]*\}/);
      if (!m) throw new Error('无 JSON');
      const score = JSON.parse(m[0]);
      done[it.jid] = { score, note: score.note || '' };
      writeFileSync(OUT, JSON.stringify(done, null, 1));
      console.log(`[judge-px1-blind] ${it.jid} ✓ pos=${score.position} spec=${score.specificity} rev=${score.self_revision}`);
      return;
    } catch (e) {
      if (n === 3) {
        console.error(`[judge-px1-blind] ${it.jid} 判卷失败: ${e.message}`);
        done[it.jid] = { error: e.message.slice(0, 80) };
        writeFileSync(OUT, JSON.stringify(done, null, 1));
      } else {
        await new Promise(r => setTimeout(r, 5000 * (n + 1)));
      }
    }
  }
}

let i = 0;
await Promise.all(Array.from({ length: Math.min(concurrency, todo.length) }, async () => {
  while (i < todo.length) await judgeOne(todo[i++]);
}));
writeFileSync(KEYMAP, JSON.stringify(keymap, null, 1));
console.log(`[judge-px1-blind] 完成。分数 ${OUT} 身份表 ${KEYMAP}`);
process.exit(0);
