#!/usr/bin/env node
/**
 * plugin-exam.mjs — 插件生命周期实验驱动器（考生 + 教官双会话）
 *
 * 考生：kfm 工具流会话（session-runner 多轮续写），池里任意模型。
 * 教官：裸 API 调用（独立提示词文件），逐轮审查考生回答，产出：
 *   ① 对考生的分析 ② 挂载/摘除范式包决策 ③ 下一句对话。
 * 挂载语义 = 方案 A（忠实还原面板插件）：
 *   挂载 = 把包包裹进下一轮 user 消息（同 applyParadigm 的〔范式包〕格式）；
 *   摘除 = 之后发往 API 的消息里包块真的消失（驱动器内部维护无包历史，
 *   视图按需包装）——归档文件保留全部真实收发，审计可查。
 * 可观测性（硬需求）：全程实时追加 <id>.transcript.md——每轮教官分析、
 *   决策、考生全文、挂载/摘除事件，带时间戳，随时可打开检查。
 *
 * 用法：
 *   node experiments/paradigm/tools/plugin-exam.mjs \
 *     --id px-test1 --scenario-file /tmp/px-scenario.txt \
 *     --examiner-model "THUDM/GLM-Z1-9B-0414" --examiner-provider "硅基流动" \
 *     --pack metacognition --turns 6 [--examiner-role kfm-dev]
 *
 * --examiner-role：考生角色卡名（~/.kfmv4/roles/<名>.json）。
 *   不传时服务端回落到面板当前激活角色（prompt-assembler 的 getActiveRoleFile），
 *   即考生的「人格底材」会被面板状态污染——跑实验建议显式指定。
 */
import { runSession, loadParadigm } from './session-runner.mjs';
import { readFileSync, writeFileSync, appendFileSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';

const argv = process.argv.slice(2);
const get = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };

const id = get('id', `px-${Date.now().toString(36)}`);
const examinerModel = get('examiner-model', 'THUDM/GLM-Z1-9B-0414'); // 默认免费模型
const examinerProvider = get('examiner-provider', '硅基流动');
const instructorModel = get('instructor-model', 'deepseek-v4-flash');
const instructorProvider = get('instructor-provider', 'deepseek');
const instructorFile = get('instructor-file',
  join(dirname(fileURLToPath(import.meta.url)), '..', 'instructors', 'design-discussion.md'));
const packName = get('pack', 'metacognition');
const scenarioFile = get('scenario-file');
const maxTurns = parseInt(get('turns', '10'), 10);
const tools = get('examiner-tools', 'read,grep,glob').split(',');
const examinerRole = get('examiner-role', ''); // 考生角色卡；空 = 服务端回落面板激活角色

const SCRIPT_DIR = join(homedir(), '.kfmv4', 'sessions', 'script');
const transcriptPath = join(SCRIPT_DIR, `${id}.transcript.md`);
const metaPath = join(SCRIPT_DIR, `${id}.exam-meta.json`);

// ===== 可观测性：实时记录（用户随时打开 transcript 检查）=====
function log(section, body) {
  const ts = new Date().toISOString().slice(5, 19).replace('T', ' ');
  appendFileSync(transcriptPath, `\n## [${ts}] ${section}\n\n${body}\n`);
  console.log(`[${ts}] ${section}（${String(body).length} 字）`);
}

// ===== provider 解析（复刻服务端 ${VAR} 展开：process.env → ~/.kfmv4/.env）=====
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

// ===== 教官调用（裸 API，非流式；JSON 解析失败带反馈重试一次）=====
async function callInstructor(sysPrompt, view, note) {
  const { baseUrl, apiKey } = resolveProvider(instructorProvider);
  const user = `${view}\n\n【当前挂载状态】${mounted ? `已挂载 ${packName}` : '未挂载'}` +
    `${note ? `\n【系统反馈】${note}` : ''}\n\n请严格按 JSON 格式输出你的决策。`;
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: instructorModel,
      messages: [{ role: 'system', content: sysPrompt }, { role: 'user', content: user }],
      max_tokens: 1500,
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`教官 API HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || '';
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error(`教官输出无 JSON: ${text.slice(0, 120)}`);
  const dec = JSON.parse(m[0]);
  if (typeof dec.message !== 'string' && dec.action !== 'end')
    throw new Error(`教官 JSON 缺 message 字段: ${m[0].slice(0, 120)}`);
  return dec;
}

// ===== 视图构建（方案 A 核心）：cleanHistory 永远无包；视图按需包装 =====
// 挂载点 = 挂载时 cleanHistory 的长度（即下一轮 user 消息的下标）
let mounted = false;
let mountIdx = -1;
const PACK_WRAP = (text, pack) =>
  `〔范式包〕以下是你要同化的思维/行为范式（示范性上下文）：\n\n${pack}\n\n————\n${text}`;
function buildView(cleanHistory, newUserText, packText) {
  const msgs = [...cleanHistory, { role: 'user', content: [{ type: 'text', text: newUserText }] }];
  if (mounted && mountIdx >= 0 && mountIdx < msgs.length) {
    const t = msgs[mountIdx].content.filter(c => c && c.type === 'text').map(c => c.text).join('');
    msgs[mountIdx] = { role: 'user', content: [{ type: 'text', text: PACK_WRAP(t, packText) }] };
  }
  return msgs;
}

// ===== 考生一轮（失败重试一次；全程写 transcript）=====
async function examinerTurn(cleanHistory, userText, packText, sessionFile) {
  const posted = buildView(cleanHistory, userText, packText);
  for (let n = 0; n < 2; n++) {
    try {
      await runSession({
        sessionId: n === 0 ? id : `${id}-rt`,
        messages: posted,
        userText,
        model: examinerModel,
        provider: examinerProvider,
        roleFile: examinerRole || undefined,
        tools,
        out: sessionFile,
      });
      const d = JSON.parse(readFileSync(sessionFile, 'utf-8'));
      const ais = (d.messages || []).filter(x => x.role === 'ai');
      const last = ais[ais.length - 1];
      const reply = (last?.content || []).filter(c => c && c.type === 'text').map(c => c.text).join('');
      const reasoning = (last?.content || []).map(c => (c && c.reasoning) || '').join('');
      // 新增轮次 = 归档里 posted 之后的部分；user 轮用无包原文入 cleanHistory
      const newTurns = (d.messages || []).slice(posted.length);
      return { reply, reasoning, newTurns };
    } catch (e) {
      log(`⚠️ 考生第 ${n + 1} 次尝试失败`, String(e.message || e).slice(0, 300));
      if (n === 1) throw e;
    }
  }
}

// ===== 主流程 =====
const scenario = scenarioFile ? readFileSync(scenarioFile, 'utf-8').trim() : null;
if (!scenario) { console.error('需要 --scenario-file（开场 user 消息）'); process.exit(2); }
const packText = loadParadigm(packName);
if (!packText) { console.error(`范式包不存在: ${packName}`); process.exit(2); }
const instructorSys = readFileSync(instructorFile, 'utf-8');
const sessionFile = join(SCRIPT_DIR, `${id}.json`);

writeFileSync(transcriptPath,
  `# 插件实验 ${id}\n\n- 考生: ${examinerModel} @ ${examinerProvider}\n` +
  `- 教官: ${instructorModel} @ ${instructorProvider}\n- 范式包: ${packName}（${packText.length} 字符）\n` +
  `- 考生角色卡: ${examinerRole || '（未指定，回落面板激活角色）'}\n` +
  `- 教官提示词: ${instructorFile}\n- 轮次上限: ${maxTurns}\n- 开始: ${new Date().toISOString()}\n`);
console.log(`[plugin-exam] ${id} 考生=${examinerModel} 教官=${instructorModel} 包=${packName} 角色=${examinerRole || '面板默认'} 上限=${maxTurns}轮`);
console.log(`[plugin-exam] 实时记录: ${transcriptPath}`);

const cleanHistory = [];
const mountLog = [];
let nextUser = scenario;
let instructorNote = '';

for (let turn = 1; turn <= maxTurns; turn++) {
  // --- 考生回话 ---
  log(`▶ 第 ${turn} 轮 · 用户发言${mounted ? `（挂载 ${packName}）` : ''}`, nextUser);
  let r;
  try {
    r = await examinerTurn(cleanHistory, nextUser, packText, sessionFile);
  } catch (e) {
    log('✗ 考生两轮均失败，实验中止', String(e.message || e).slice(0, 300));
    break;
  }
  cleanHistory.push({ role: 'user', content: [{ type: 'text', text: nextUser }] }, ...r.newTurns);
  if (r.reasoning) log(`◀ 第 ${turn} 轮 · 考生回复（推理通道）`, r.reasoning);
  log(`◀ 第 ${turn} 轮 · 考生回复`, r.reply || '（正文为空）');

  // --- 教官审查 ---
  const view = cleanHistory.map(m => {
    const t = (m.content || []).filter(c => c && c.type === 'text').map(c => c.text).join('');
    return `【${m.role === 'user' ? '用户' : '考生'}】${t}`;
  }).join('\n\n') + `\n\n【说明】对话中用户的下一句发言由你（教官）产出。范式包内容不展示给你，你只决策挂载时机。`;
  let dec = null;
  // 教官重试：空响应/JSON 异常是上游间歇病且时间聚簇（2026-08-05 px-1 实测：
  // 4 次×短退避穿不透 ~90s 故障窗口，两跑因此夭折）——8 次 + 递增退避（10s×n，封顶 60s），
  // 总忍耐 ~5 分钟，仍败才中止
  for (let n = 0; n < 8 && !dec; n++) {
    try {
      dec = await callInstructor(instructorSys, view, instructorNote ||
        (n ? `上次输出解析失败（第 ${n} 次），请严格只输出 JSON。` : ''));
      instructorNote = '';
    } catch (e) {
      log(`⚠️ 教官第 ${n + 1} 次输出异常`, String(e.message || e).slice(0, 200));
      if (n < 7) await new Promise(r => setTimeout(r, Math.min(10000 * (n + 1), 60000)));
    }
  }
  if (!dec) {
    log('✗ 教官连续 8 次异常，实验中止', '');
    break;
  }
  log(`★ 第 ${turn} 轮 · 教官分析`, dec.analysis || '（无）');

  // --- 执行挂载决策（方案 A）---
  const action = dec.action || 'none';
  if (action === 'attach' && !mounted) {
    mounted = true;
    mountIdx = cleanHistory.length; // 包裹下一轮 user 消息
    mountLog.push({ turn, action: 'attach', pack: packName, reason: dec.analysis || '' });
    log(`⬆ 挂载范式包 ${packName}`, `教官理由：${dec.analysis || '（无）'}`);
  } else if (action === 'detach' && mounted) {
    mounted = false;
    mountIdx = -1;
    mountLog.push({ turn, action: 'detach', pack: packName, reason: dec.analysis || '' });
    log(`⬇ 摘除范式包 ${packName}`, `教官理由：${dec.analysis || '（无）'}`);
  } else if (action === 'end') {
    mountLog.push({ turn, action: 'end', reason: dec.analysis || '' });
    log(`■ 教官判定实验结束`, dec.analysis || '（无）');
    break;
  }
  nextUser = dec.message;
}

writeFileSync(metaPath, JSON.stringify({
  id, examinerModel, examinerProvider, instructorModel, instructorProvider,
  packName, maxTurns, mountLog, endedAt: new Date().toISOString(),
}, null, 1));
console.log(`[plugin-exam] 结束。记录: ${transcriptPath} 元数据: ${metaPath}`);
