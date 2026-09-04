/**
 * tests/ai-sse-parser.test.ts — A 档钉 A1：SSE 帧解析器（纯逻辑）
 *
 * 语义基准 = na src/brain.rs SseParser（同语义复刻）：
 * data: 行 + 空行分隔、多 data 行按 SSE 规范 \n 拼接、注释行/CRLF/碎喂/
 * 粘包/半帧全容忍、[DONE] 作载荷原样透出（翻译器判定）。
 *
 * 变异抽检靶子（本文件指定）：
 *   ①碎喂改整喂语义（半帧提前吐出）→ 「半帧不吐」钉红；
 *   ②CRLF 不剥 \r → 「CRLF 容忍」钉红；
 *   ③注释行当 data 收 → 「注释行」钉红。
 */
import { test, group, assert } from './runner.ts';
import { readFileSync } from 'node:fs';
import { SseParser } from '../src/server/ai/sse-parser.ts';

group('ai-sse-parser（A1：SSE 帧解析，na SseParser 同语义）');

const FRAME_A = '{"id":"a","choices":[{"delta":{"content":"x"}}]}';
const FRAME_B = '{"id":"b","choices":[{"delta":{"content":"y"}}]}';

test('整喂：两帧粘包一次喂入 → 两帧依序产出', () => {
  const p = new SseParser();
  p.feed(`data: ${FRAME_A}\n\ndata: ${FRAME_B}\n\n`);
  assert(p.drainFrames().join('|') === `${FRAME_A}|${FRAME_B}`, '粘包两帧应依序产出');
});

test('碎喂：逐字节喂入与整喂帧序列一致', () => {
  const raw = `data: ${FRAME_A}\n\ndata: ${FRAME_B}\n\ndata: [DONE]\n\n`;
  const whole = new SseParser();
  whole.feed(raw);
  const expected = whole.drainFrames();
  const drip = new SseParser();
  const got: string[] = [];
  for (const ch of raw) {
    drip.feed(ch);
    got.push(...drip.drainFrames());
  }
  assert(JSON.stringify(got) === JSON.stringify(expected), '碎喂帧序列应与整喂一致');
  assert(got.length === 3 && got[2] === '[DONE]', '[DONE] 应作载荷原样透出');
});

test('半帧不吐：无帧界空行时 nextFrame 返回 null，补齐后才成帧', () => {
  const p = new SseParser();
  p.feed(`data: ${FRAME_A}\n`); // 有 data 行但无帧界空行
  assert(p.nextFrame() === null, '半帧（无空行收尾）不许吐出');
  p.feed('\n');
  assert(p.nextFrame() === FRAME_A, '空行到达后应成帧');
});

test('CRLF 容忍：\\r\\n 行尾与 \\n 行尾产出同一载荷', () => {
  const p = new SseParser();
  p.feed(`data: ${FRAME_A}\r\n\r\n`);
  assert(p.drainFrames().join('') === FRAME_A, 'CRLF 应剥 \\r');
});

test('注释行（: 开头）忽略；连续空行不算帧', () => {
  const p = new SseParser();
  p.feed(`: keep-alive\n\n\ndata: ${FRAME_A}\n\n`);
  assert(p.drainFrames().join('') === FRAME_A, '注释行/连续空行不应成帧');
});

test('多 data 行按 SSE 规范以 \\n 拼接成一帧', () => {
  const p = new SseParser();
  p.feed('data: {"a":\ndata: 1}\n\n');
  assert(p.drainFrames().join('') === '{"a":\n1}', '多 data 行应 \\n 拼接');
});

test('data: 后至多剥一个前导空格；event:/id:/retry: 字段行静默忽略', () => {
  const p = new SseParser();
  p.feed('event: message\nid: 7\nretry: 3000\ndata:no-space\n\n');
  p.feed('data:  two-spaces\n\n');
  const frames = p.drainFrames();
  assert(frames[0] === 'no-space', 'data: 无空格应原样收');
  assert(frames[1] === ' two-spaces', 'data: 后只剥一个前导空格');
  assert(frames.length === 2, 'event:/id:/retry: 行不应成帧');
});

test('真实 fixture 碎喂回归：upstream-kimi 全文逐字节 = 44 数据帧 + [DONE]', () => {
  const raw = readFileSync(
    new URL('./fixtures/ai-chat/upstream-kimi-k2.7-highspeed-20260830.sse', import.meta.url), 'utf-8');
  const p = new SseParser();
  const frames: string[] = [];
  for (const ch of raw) {
    p.feed(ch);
    frames.push(...p.drainFrames());
  }
  assert(frames.length === 45, `应为 44 数据帧 + [DONE]，实得 ${frames.length}`);
  assert(frames[44] === '[DONE]', '末帧应为 [DONE]');
  assert(frames.slice(0, 44).every(f => f.startsWith('{')), '数据帧应为 JSON 载荷');
});
