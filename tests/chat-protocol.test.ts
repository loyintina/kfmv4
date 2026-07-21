// ==========================================================================
// tests/chat-protocol.test.ts — SSE 事件协议 · 工具块索引连续化回归钉子
//
// BAR-106 (7ac8f47)：Claude 等 provider 的 tool_call tc.index 可能不从 0 起（如从
// 1），若直接 idx+1 映射会在客户端 content 数组留 undefined 空洞，
// .filter(b=>b.type) 读空洞崩 "Cannot read properties of undefined (reading 'type')"。
//
// 修复：createClientIdxMapper 把任意 provider index 映射为「text=0，工具从 1 起
// 按首见顺序连续」的客户端块索引。本测试钉住这个映射不变量。
// ==========================================================================

import assert from 'assert';
import { group, regression, test } from './runner.js';
import { createClientIdxMapper } from '../src/server/ai/chat.js';

group('chat 协议 — 工具块索引连续化');

// ==========================================================================
// BAR-106 核心：非零起始 provider index 也映射为连续的 1,2,3…
// ==========================================================================

regression('BAR-106a', '7ac8f47', 'Claude 从 index=1 起 → 客户端块从 1 连续（无空洞）', () => {
  const { clientIdx } = createClientIdxMapper();
  // Claude 首个工具 tc.index=1（不是 0）
  assert(clientIdx(1) === 1, `首见 providerIdx=1 应映射为 clientIdx=1，得 ${clientIdx(1)}`);
  assert(clientIdx(2) === 2, `第二个 providerIdx=2 应映射为 2，得 ${clientIdx(2)}`);
});

regression('BAR-106b', '7ac8f47', '同一 providerIdx 多次映射幂等（流式 delta 复用同块）', () => {
  const { clientIdx } = createClientIdxMapper();
  const first = clientIdx(1);
  const again = clientIdx(1);
  assert(first === again, `同一 providerIdx 应返回同一 clientIdx，得 ${first} vs ${again}`);
});

regression('BAR-106c', '7ac8f47', '乱序/跳跃 provider index → 客户端块仍按首见顺序连续', () => {
  const { clientIdx } = createClientIdxMapper();
  // provider 给出跳跃的 index：5, 3, 9
  assert(clientIdx(5) === 1, '首见 5 → 1');
  assert(clientIdx(3) === 2, '次见 3 → 2');
  assert(clientIdx(9) === 3, '再见 9 → 3');
  // 回访已见的 index 仍返回原值
  assert(clientIdx(3) === 2, '回访 3 仍是 2');
  assert(clientIdx(5) === 1, '回访 5 仍是 1');
});

regression('BAR-106d', '7ac8f47', 'text 块占 index=0，工具块从 1 起（不与 text 冲突）', () => {
  const { clientIdx } = createClientIdxMapper();
  // text 块由 streamChat 固定用 index=0，工具映射从 1 起，永不返回 0
  assert(clientIdx(0) === 1, 'providerIdx=0 的工具也应映射为 1（不占 text 的 0）');
  assert(clientIdx(1) === 2, '下一个工具 → 2');
});

// ---- 连续性不变量 ----

test('连续 N 个不同 provider index → 客户端块严格连续 1..N', () => {
  const { clientIdx } = createClientIdxMapper();
  const providerIndices = [7, 2, 100, 0, 42]; // 任意乱序
  const mapped = providerIndices.map(clientIdx);
  // 首见顺序 → 严格 1,2,3,4,5
  assert.deepStrictEqual(mapped, [1, 2, 3, 4, 5], `应严格连续，得 ${mapped}`);
  // 无重复、无空洞
  assert(new Set(mapped).size === mapped.length, '无重复');
}, { tag: 'integration' });

test('独立 mapper 实例互不干扰', () => {
  const a = createClientIdxMapper();
  const b = createClientIdxMapper();
  a.clientIdx(5); a.clientIdx(6);
  // b 是全新实例，首见从 1 起
  assert(b.clientIdx(99) === 1, '新实例应从 1 起，不受其他实例影响');
}, { tag: 'integration' });

// ==========================================================================
// BAR-105 (da39891): 取消时未完成工具卡卡在「忙碌中」
// 根因：取消分支只改文本块，未处理无 result 的工具块 → 渲染判定 isExecuting
// 一直转。修复：cancelPendingToolBlocks 给无 result 工具块打 {已取消, isError}。
// ==========================================================================

import { cancelPendingToolBlocks } from '../src/client/modules/orb-chat.js';
import type { ChatMessage } from '../src/client/modules/orb-chat.js';

group('orb-chat — 取消收尾（BAR-105）');

regression('BAR-105a', 'da39891', '无 result 工具块 → 打上 {已取消, isError} 结果', () => {
  const messages: ChatMessage[] = [
    { role: 'ai', content: [{ type: 'tool', id: 't1', name: 'bash', input: {} }] },
  ];
  const n = cancelPendingToolBlocks(messages);
  const tb = messages[0].content[0] as { type: 'tool'; result?: { isError?: boolean } };
  assert(n === 1, `应标记 1 个未完成工具块，得 ${n}`);
  assert(tb.result !== undefined, '无 result 工具块取消后必须有 result（否则渲染仍判 isExecuting 卡住）');
  assert(tb.result?.isError === true, '取消结果应 isError=true');
});

regression('BAR-105b', 'da39891', '已有 result 的工具块 → 不覆盖', () => {
  const done = { content: [{ type: 'text', text: '真实结果' }], isError: false };
  const messages: ChatMessage[] = [
    { role: 'ai', content: [{ type: 'tool', id: 't1', name: 'bash', input: {}, result: done }] },
  ];
  const n = cancelPendingToolBlocks(messages);
  const tb = messages[0].content[0] as { type: 'tool'; result?: { content: Array<{ text?: string }> } };
  assert(n === 0, `已完成工具块不应被计入取消，得 ${n}`);
  assert(tb.result?.content[0].text === '真实结果', '已有 result 不能被取消结果覆盖');
});

regression('BAR-105c', 'da39891', '混合消息：只取消未完成的，文本块不受影响', () => {
  const messages: ChatMessage[] = [
    { role: 'ai', content: [
      { type: 'text', text: '正文' },
      { type: 'tool', id: 't1', name: 'a', input: {} },
      { type: 'tool', id: 't2', name: 'b', input: {}, result: { content: [{ type: 'text', text: 'ok' }] } },
    ] },
  ];
  const n = cancelPendingToolBlocks(messages);
  const text = messages[0].content[0] as { type: 'text'; text: string };
  assert(n === 1, `只应取消 1 个未完成工具块，得 ${n}`);
  assert(text.text === '正文', '文本块不应被触碰');
});
