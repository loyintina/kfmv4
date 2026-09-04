/**
 * tests/ai-projection.test.ts — A 档钉 A8：简版 to-openai-messages（三条事故规则）
 *
 * 设计 §1.1 末 + §八①：不搬 kfmv4 308 行整树（tool-compaction 重件），
 * 只保留三条有事故教训的规则：
 *   ①ts 前缀只盖 user（BAR-TS-MIMIC-01：assistant 盖前缀 = AI 学成自己的
 *     行文格式复读；A1 无 ts 字段也要把结构钉死，防后补踩雷）；
 *   ②客户端产物占位符不进载荷（[错误: …] / [未收到回复，请重试] 整条过滤；
 *     [已取消] 不过滤，是对话信号）；
 *   ③空壳 assistant 一律丢弃（无 tool_calls 且正文空 → 严格端点 kimi 400，
 *     BAR-PROVIDER-02）。
 */
import { test, group, assert } from './runner.ts';
import { toOpenAiMessages } from '../src/shared/chat-protocol/to-openai-messages.ts';
import type { ChatMessage } from '../src/shared/chat-protocol/messages.ts';

function userMsg(text: string, ts?: string): ChatMessage {
  return { role: 'user', content: [{ type: 'text', text }], ...(ts ? { ts } : {}) };
}
function aiMsg(text: string, ts?: string): ChatMessage {
  return { role: 'ai', content: [{ type: 'text', text }], ...(ts ? { ts } : {}) };
}

group('ai-projection（A8：简版投影三条事故规则）');

test('规则① ts 前缀只盖 user：assistant 带 ts 也不盖', () => {
  const out = toOpenAiMessages([
    userMsg('你好', '2026-09-04T08:30:15.000Z'),
    aiMsg('回复', '2026-09-04T08:30:20.000Z'),
  ]);
  assert(out.length === 2, '两条都应进载荷');
  assert(out[0].role === 'user' && /^\[ts \d{2}-\d{2} \d{2}:\d{2}:\d{2}\] 你好$/.test(out[0].content || ''),
    `user 应盖 [ts …] 前缀，实得: ${out[0].content}`);
  assert(out[1].role === 'assistant' && out[1].content === '回复',
    `assistant 绝不盖前缀（BAR-TS-MIMIC-01），实得: ${out[1].content}`);
});

test('规则① 边界：无 ts / 非法 ts → 无前缀（向后兼容）', () => {
  const out = toOpenAiMessages([userMsg('无戳'), userMsg('坏戳', 'not-a-date')]);
  assert(out[0].content === '无戳' && out[1].content === '坏戳', '无 ts/非法 ts 不盖前缀');
});

test('规则② 占位符整条过滤；[已取消] 保留；混有正文不过滤', () => {
  const out = toOpenAiMessages([
    userMsg('问1'),
    aiMsg('[错误: API 请求失败: 401 — x]'),
    userMsg('问2'),
    aiMsg('[未收到回复，请重试]'),
    userMsg('问3'),
    aiMsg('[已取消]'),
    userMsg('问4'),
    aiMsg('正文在前\n\n[错误: 尾巴]'),
  ]);
  const texts = out.map(m => m.content);
  assert(out.length === 6, `占位符两条应被过滤，实得 ${out.length} 条`);
  assert(!texts.some(t => (t || '').includes('API 请求失败')), '[错误: …] 整条不进载荷');
  assert(!texts.some(t => t === '[未收到回复，请重试]'), '[未收到回复，请重试] 不进载荷');
  assert(texts.includes('[已取消]'), '[已取消] 是对话信号，保留');
  assert(texts.includes('正文在前\n\n[错误: 尾巴]'), '混有真实正文的一字不动（整条才是占位符才过滤）');
});

test('规则② user 消息一字不动（G5：占位符形态出现在 user 侧也不过滤）', () => {
  const out = toOpenAiMessages([userMsg('[错误: 用户自己打的]')]);
  assert(out.length === 1 && out[0].content === '[错误: 用户自己打的]', 'user 消息原样上行');
});

test('规则③ 空壳 assistant 一律丢弃；纯思考残留同判', () => {
  const out = toOpenAiMessages([
    userMsg('问'),
    { role: 'ai', content: [{ type: 'text', text: '' }] },                    // 空壳
    { role: 'ai', content: [{ type: 'text', text: '', reasoning: '只想没说' }] }, // 纯思考残留
    aiMsg('正经回复'),
  ]);
  assert(out.length === 2 && out[1].content === '正经回复',
    `空壳/纯思考 assistant 应丢弃（kimi 400 防线），实得 ${JSON.stringify(out.map(m => m.content))}`);
});

test('工具块最小投影（不压缩）：tool_calls + tool 结果配对，结构不静默丢', () => {
  const out = toOpenAiMessages([
    userMsg('跑个 ls'),
    { role: 'ai', content: [
      { type: 'text', text: '我来跑' },
      { type: 'tool', id: 'c1', name: 'bash', input: { command: 'ls' },
        result: { content: [{ type: 'text', text: 'a.txt' }] } },
    ] },
  ]);
  assert(out.length === 3, `assistant + tool 结果应配对出现，实得 ${out.length}`);
  assert(out[1].role === 'assistant' && out[1].content === '我来跑', '正文保留');
  const tc = out[1].tool_calls?.[0];
  assert(tc?.function.name === 'bash' && tc.function.arguments === '{"command":"ls"}', 'tool_calls 原样投影（无压缩）');
  assert(out[2].role === 'tool' && out[2].tool_call_id === 'c1' && out[2].content === 'a.txt', 'tool 结果配对');
});

test('载荷不带 reasoning_content（简版：思考链不上行）', () => {
  const out = toOpenAiMessages([
    { role: 'ai', content: [{ type: 'text', text: '判决', reasoning: '长篇思考' }] },
  ]);
  assert(!('reasoning_content' in out[0]), '简版投影不上行思考链');
});
