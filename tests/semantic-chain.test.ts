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
