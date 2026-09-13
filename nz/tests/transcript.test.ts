/**
 * tests/transcript.test.ts — 会话记录回看器 A 档考题（2026-09-13 A 线：
 * 正式回看器=wire.jsonl 增量 tail 服务+live 页）
 *
 * 五枚钉：
 *   ①解析语义：用户=append_message text 部件；助手=content.part 按 turnId
 *     聚合+tool.call 芯片；tool.result 回填（无文本部件）滤除；think 不产消息；
 *     同轮跨 tool.result 续写=同 seq 合并
 *   ②增量 tail：残行 carry（半行等下一拍补全）、追加只出新消息
 *   ③名册：只收 session_x 型目录下的 agents/main/wire.jsonl，新者在前
 *   ④key 安全闸：穿越/缺段/非法字符一律 fail-closed
 *   ⑤真 socket E2E：sessions+messages 端点全链（HOME 注入隔离真实会话）
 */
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, group, assert } from './runner.ts';
import { TranscriptDoc, TranscriptService } from '../src/server/transcript.ts';
import { createNzServer } from '../src/server/index.ts';
import type { AddressInfo } from 'node:net';

let tmpRoot = '';
let sessionsRoot = '';
let wirePath = '';

const seedWire = async (): Promise<void> => {
  const L = [
    JSON.stringify({ type: 'context.append_message', time: 1000, message: { role: 'user', content: [{ type: 'text', text: '你好' }] } }),
    JSON.stringify({ type: 'context.append_loop_event', time: 1100, event: { type: 'content.part', turnId: 't1', part: { type: 'text', text: '回答一' } } }),
    JSON.stringify({ type: 'context.append_loop_event', time: 1200, event: { type: 'tool.call', turnId: 't1', call: { name: 'Bash' } } }),
    // 工具结果回填走 user 角色、无 text 部件 → 必须滤除
    JSON.stringify({ type: 'context.append_message', time: 1250, message: { role: 'user', content: [{ type: 'tool_result', text: 'raw output' }] } }),
    // 同轮（t1）跨 tool.result 续写 → 同 seq 合并
    JSON.stringify({ type: 'context.append_loop_event', time: 1300, event: { type: 'content.part', turnId: 't1', part: { type: 'text', text: '+续写' } } }),
    // 新轮 t2 + think 部件（不产消息）
    JSON.stringify({ type: 'context.append_loop_event', time: 1400, event: { type: 'content.part', turnId: 't2', part: { type: 'text', text: '轮二' } } }),
    JSON.stringify({ type: 'context.append_loop_event', time: 1450, event: { type: 'content.part', turnId: 't2', part: { type: 'think', text: 'thinking…' } } }),
    JSON.stringify({ type: 'context.append_message', time: 1500, message: { role: 'user', content: [{ type: 'text', text: '第二条' }] } }),
    '这不是JSON，必须被忽略',
  ];
  await mkdir(join(sessionsRoot, 'wd_exam', 'session_exam1', 'agents', 'main'), { recursive: true });
  wirePath = join(sessionsRoot, 'wd_exam', 'session_exam1', 'agents', 'main', 'wire.jsonl');
  await writeFile(wirePath, L.join('\n') + '\n');
};

group('transcript（会话记录回看器）');

test('①解析语义：角色/聚合/滤除/续写合并', async () => {
  tmpRoot = await mkdtemp(join(tmpdir(), 'nz-tr-'));
  sessionsRoot = join(tmpRoot, '.kimi-code', 'sessions');
  await seedWire();
  const doc = new TranscriptDoc('wd_exam/session_exam1', wirePath);
  await doc.poll();
  const all = doc.tail(100).messages;
  assert(all.length === 4, `应 4 条（user/助手t1/助手t2/user），实 ${all.length}`);
  assert(all[0].kind === 'user' && all[0].text === '你好', '首条=用户你好');
  assert(all[1].kind === 'asst' && all[1].text === '回答一+续写', `t1 续写合并=「回答一+续写」，实「${all[1].text}」`);
  assert(all[1].tools.includes('Bash'), 't1 应带 Bash 芯片');
  assert(all[2].kind === 'asst' && all[2].text === '轮二', 't2=轮二');
  assert(all[3].kind === 'user' && all[3].text === '第二条', '尾条=用户第二条');
});

test('②增量 tail：残行 carry+补全后只出新消息', async () => {
  const doc = new TranscriptDoc('wd_exam/session_exam1', wirePath);
  await doc.poll();
  const base = doc.cursor;
  const full = JSON.stringify({ type: 'context.append_message', time: 1600, message: { role: 'user', content: [{ type: 'text', text: '增量甲' }] } });
  await writeFile(wirePath, (await readFile(wirePath, 'utf8')) + full.slice(0, 40)); // 追加半行（无换行）
  await doc.poll();
  assert(doc.since(base).messages.length === 0, '残行不成消息');
  const cur = await readFile(wirePath, 'utf8');
  await writeFile(wirePath, cur + full.slice(40) + '\n'); // 补全整行
  const got = await doc.poll();
  assert(got.some((m) => m.text === '增量甲'), '补全后出消息');
  assert(doc.since(base).messages.some((m) => m.text === '增量甲'), 'since 游标语义正确');
});

test('③名册：只收 session_*/agents/main/wire.jsonl，新者在前', async () => {
  const svc = new TranscriptService(sessionsRoot);
  await mkdir(join(sessionsRoot, 'wd_exam', 'session_empty'), { recursive: true }); // 无 wire → 不收
  const ss = await svc.sessions();
  assert(ss.length === 1 && ss[0].key === 'wd_exam/session_exam1', `名册恰 exam1，实 ${JSON.stringify(ss[0])}`);
  assert(ss[0].size > 0, '带尺寸');
});

test('④key 安全闸：穿越/缺段/非法字符 fail-closed', () => {
  const svc = new TranscriptService(sessionsRoot);
  assert(svc.resolveKey('../../etc/passwd') === null, '穿越拒');
  assert(svc.resolveKey('wd_exam') === null, '缺段拒');
  assert(svc.resolveKey('wd_exam/session_exam1/extra') === null, '多段拒');
  assert(svc.resolveKey('wd_exam/session_x9') === null, '不存在拒');
  assert(svc.resolveKey('wd_exam/session_exam1') !== null, '合法通过');
});

// ========== 真 socket E2E（HOME 注入隔离真实会话）==========

test('⑤端点全链：sessions+messages（真 socket）', async () => {
  const realHome = process.env.HOME;
  process.env.HOME = tmpRoot; // 服务根=$HOME/.kimi-code/sessions → 注入夹具
  const server = createNzServer();
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address() as AddressInfo;
  try {
    const ss = await (await fetch(`http://127.0.0.1:${port}/api/transcript/sessions`)).json();
    assert(ss.sessions.some((s: { key: string }) => s.key === 'wd_exam/session_exam1'), '名册含夹具');
    const bad = await fetch(`http://127.0.0.1:${port}/api/transcript/messages?key=../..%2Fetc`);
    assert(bad.status === 404, `坏 key=404，实 ${bad.status}`);
    const first = await (await fetch(`http://127.0.0.1:${port}/api/transcript/messages?key=wd_exam/session_exam1&tail=2`)).json();
    // 夹具 4 条 + 钉②追加的增量甲=5
    assert(first.messages.length === 2 && first.total === 5, `tail=2 应 2 条 total=5，实 ${first.messages.length}/${first.total}`);
    const inc = await (await fetch(`http://127.0.0.1:${port}/api/transcript/messages?key=wd_exam/session_exam1&since=2`)).json();
    assert(inc.messages.length === 3 && inc.messages[0].text === '轮二', 'since=2 出后三条');
  } finally {
    server.close();
    process.env.HOME = realHome;
  }
  await rm(tmpRoot, { recursive: true, force: true });
});
