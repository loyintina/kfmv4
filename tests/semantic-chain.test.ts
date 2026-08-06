import assert from 'assert';
import { regression } from './harness.js';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';

// BAR-SEMCHAIN-01 家族：巡逻 runner 静默死亡事故（08-03）——三枚源码断言钉：
// 病根（裸 ROOT）、信道（崩溃投信箱）、主人（心跳 check 挂链 + 探针夹具在场）。

const url = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));
const src = (rel: string) => readFileSync(url(rel), 'utf-8');

regression('BAR-SEMCHAIN-01', 'no-bare-root', 'semantic-chain.mjs 不得引用未定义的裸 ROOT（事故病根：本模块只定义 REPO，ROOT 是 check 家族惯例名）', async () => {
  const runnerSrc = src('../scripts/agent/semantic-chain.mjs');
  // \bROOT\b 不误伤 KFM_PROBE_ROOT（下划线是词字符，无边界）与 REPO
  assert(!/\bROOT\b/.test(runnerSrc), 'semantic-chain.mjs 出现裸 ROOT——回到 BAR-SEMCHAIN-01 病根');
  assert(/\bREPO\b/.test(runnerSrc), 'semantic-chain.mjs 应以 REPO 为根常量');
});

regression('BAR-SEMCHAIN-01', 'crash-channel', 'runner 崩溃必须投信箱——沉默不允许（事故中 runner 死了一天无人知晓）', async () => {
  const runnerSrc = src('../scripts/agent/semantic-chain.mjs');
  assert(/\bcatch[\s\S]{0,400}💀/.test(runnerSrc), 'catch 块后必须紧跟 💀 崩溃 verdict 投信箱');
  assert(runnerSrc.includes('💀 崩溃'), 'verdict 家族必须含崩溃态');
});

regression('BAR-SEMCHAIN-01', 'heartbeat-wired', '信箱心跳 check 挂链 + 探针可注入 + 夹具在场（巡逻失败全谱系的机械化主人）', async () => {
  assert(existsSync(url('../scripts/check/check-inbox-heartbeat.mjs')), 'check-inbox-heartbeat.mjs 必须存在');
  const heartbeatSrc = src('../scripts/check/check-inbox-heartbeat.mjs');
  const chainSrc = src('../scripts/check/chain.mjs');
  assert(chainSrc.includes('check-inbox-heartbeat.mjs'), '心跳 check 必须在 chain STEPS 上');
  assert(heartbeatSrc.includes('KFM_PROBE_ROOT'), '心跳 check 必须支持 KFM_PROBE_ROOT 注入（宪法探针条款）');
  assert(heartbeatSrc.includes('MECH-FLOW-10'), '报错必须带 MECH-FLOW-10 引导码（error-codes.md 已登记）');
  assert(existsSync(url('./probes/inbox-heartbeat/expect.txt')), '探针负例夹具必须在场');
});

// ========== BAR-SEMCHAIN-02 家族：巡逻探针工具化（工具流通道，2026-08-04） ==========
// 腿一探针从纯文本升级为可带白名单工具流：服务端 extraSystem 注入 + runAgentTooled
// 通道 + 任务级 tools 声明。三层断言钉防链路退化 + parseToolStream 真实单测。

regression('BAR-SEMCHAIN-02', 'tooled-wired', 'agent-runner 必须导出 runAgentTooled/parseToolStream 且含白名单/extraSystem/fallback 三要素', async () => {
  const arSrc = src('../scripts/agent/agent-runner.mjs');
  assert(arSrc.includes('export async function runAgentTooled'), 'runAgentTooled 必须导出（语义审计分流依赖）');
  assert(arSrc.includes('export async function parseToolStream'), 'parseToolStream 必须导出（可单测）');
  assert(arSrc.includes('tools,'), '工具白名单必须透传给服务端 start');
  assert(arSrc.includes('extraSystem: system'), '探针 system 必须经 extraSystem 注入（服务端 system 段，非角色卡）');
  assert(arSrc.includes('fallbackToPlain'), '服务端不可达必须 fallback 纯文本（巡逻无人值守不空窗）');
});

regression('BAR-SEMCHAIN-02', 'server-extraSystem', '服务端三文件必须含 extraSystem 透传（start → streamFn 链路不退化）', async () => {
  const chatSrc = src('../src/server/ai/chat.ts');
  const rmSrc = src('../src/server/ai/run-manager.ts');
  const rtSrc = src('../src/server/ai/routes.ts');
  assert(chatSrc.includes('extraSystem?: string'), 'streamChat 必须接受 extraSystem 参数');
  assert(/if \(extraSystem\) staticSystemParts\.push\(extraSystem\)/.test(chatSrc), 'extraSystem 必须注入 staticSystemParts');
  assert(rmSrc.includes('extraSystem?: string'), 'run-manager StreamFn/startRun 必须透传 extraSystem');
  assert(rtSrc.includes('extraSystem'), 'routes /ai/chat/start 必须解构并透传 extraSystem');
});

regression('BAR-SEMCHAIN-02', 'task-tools-field', '试点任务必须声明 tools 且白名单 ⊆ 读类（巡逻边界=检测，禁止写/执行类）', async () => {
  const tasksSrc = src('../scripts/agent/semantic-audit.tasks.mjs');
  assert(/\btools: \['read', 'grep', 'glob'\]/.test(tasksSrc), '试点任务 code-map-vs-src 必须声明读类白名单');
  const READ_ONLY = new Set(['read', 'grep', 'glob']);
  const m = tasksSrc.match(/\btools: \[([^\]]*)\]/);
  assert(m, '任务清单必须存在 tools 声明');
  const names = m[1].split(',').map(s => s.trim().replace(/^'|'$/g, ''));
  for (const n of names) {
    assert(READ_ONLY.has(n), `白名单含非读类工具 ${n}——巡逻探针不得持有写/执行工具（修复留给会话 agent）`);
  }
});

regression('BAR-SEMCHAIN-02', 'parse-tool-stream', 'parseToolStream 拼接 text_delta / 跳过工具事件 / error 抛错（SSE 解析真实单测）', async () => {
  const { parseToolStream } = await import('../scripts/agent/agent-runner.mjs');
  const enc = new TextEncoder();
  const fakeReader = (chunks: string[]) => {
    let i = 0;
    return { read: async () => (i < chunks.length ? { done: false as const, value: enc.encode(chunks[i++]) } : { done: true as const, value: undefined }) };
  };
  // 1) 真实服务端封装格式（{index, event} 包装 + __end__ 哨兵）——多轮 text_delta +
  //    工具事件穿插 → 只拼文本，工具/思考事件不产生文本
  const wrap = (index: number, event: unknown) => `data: ${JSON.stringify({ index, event })}\n`;
  const sse1 = [
    wrap(0, { type: 'content_block_start', index: 0, blockType: 'text' }),
    wrap(0, { type: 'content_block_delta', index: 0, deltaType: 'thinking_delta', deltaText: '思考中' }),
    wrap(0, { type: 'content_block_delta', index: 0, deltaType: 'text_delta', deltaText: '发现' }),
    wrap(1, { type: 'content_block_start', index: 1, blockType: 'tool_use', toolName: 'read' }),
    wrap(1, { type: 'content_block_delta', index: 1, deltaType: 'input_json_delta', deltaText: '{"path":"x"}' }),
    wrap(1, { type: 'tool_result', toolUseId: 't1', toolResult: { content: [] } }),
    wrap(0, { type: 'content_block_delta', index: 0, deltaType: 'text_delta', deltaText: '一条' }),
    'data: {"type":"__end__"}\n',
  ];
  const t1 = await parseToolStream(fakeReader(sse1));
  assert.strictEqual(t1, '发现一条', '应解包 {index,event}、只拼接 text_delta、__end__ 即完成');
  // 2) error 事件（封装格式）→ 抛错
  const sse2 = [wrap(0, { type: 'error', content: '上游配额耗尽' })];
  await assert.rejects(() => parseToolStream(fakeReader(sse2)), /上游配额耗尽/, 'error 事件必须抛错');
  await assert.rejects(() => parseToolStream(fakeReader(sse2)), /上游配额耗尽/, 'error 事件必须抛错');
  // 3) 流结束未收到 done → 返回已收集文本（容错）
  const sse3 = ['data: {"type":"content_block_delta","index":0,"deltaType":"text_delta","deltaText":"半截"}\n'];
  const t3 = await parseToolStream(fakeReader(sse3));
  assert.strictEqual(t3, '半截', '流中断应返回已收集文本');
});

regression('BAR-SEMCHAIN-04', 'script-class-routed', 'tooledOnce 必须传 sessionClass:script——巡逻会话落盘分流 sessions/script/，不得进面板区', async () => {
  const arSrc = src('../scripts/agent/agent-runner.mjs');
  // 事故（2026-08-06）：tooledOnce 未传 sessionClass → 巡逻会话落 sessions/ 根目录 →
  // /sessions/list（面板会话列表）无过滤全列 → 探针档案裸奔进用户会话列表。
  assert(/sessionClass:\s*'script'/.test(arSrc), 'tooledOnce 的 /ai/chat/start 负载必须含 sessionClass:\'script\'（routes.ts 分流闸只认这个字段）');
});
