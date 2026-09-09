/**
 * tests/notify-gate.test.ts — R3 长任务通知 A 档考题（2026-09-09 判据稿
 * 签收）。
 *
 * 覆盖：NotifyGate 节流窗（时钟可注入）/ 会话间隔离 / alert-bell hook
 * 命令形状 / __tmux-notify 端点集成（真 HTTP POST → onNotify 事件）。
 *
 * 变异抽检靶子（本文件指定）：
 *   ①gate 节流窗删掉（恒放行）→ 钉①④红；
 *   ②hook 命令丢 format 变量 #{session_name} → 钉③红。
 */
import { Context } from 'cordis';
import { test, group, assert } from './runner.ts';
import { createNzServer } from '../src/server/index.ts';
import { NotifyGate, alertBellHookCmd, onNotify } from '../src/server/notify.ts';
import type { AddressInfo } from 'node:net';

group('notify-gate（R3 长任务通知 A 档）');

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

test('①节流窗：窗内第二条拒，窗外放行（时钟注入）', () => {
  let t = 1000;
  const g = new NotifyGate(30000, () => t);
  assert(g.allow('dsh') === true, '首条放行');
  assert(g.allow('dsh') === false, '窗内拒');
  t += 30000;
  assert(g.allow('dsh') === true, '窗外放行');
});

test('②会话间隔离：dsh 节流不影响 amp', () => {
  let t = 1000;
  const g = new NotifyGate(30000, () => t);
  assert(g.allow('dsh') === true);
  assert(g.allow('amp') === true, '不同会话独立');
  assert(g.allow('dsh') === false, 'dsh 仍在窗内');
});

test('③hook 命令形状：URL 带 port、format 变量在场（变异靶②）', () => {
  const cmd = alertBellHookCmd(8023);
  assert(cmd.includes('127.0.0.1:8023/__tmux-notify'), '端点地址在场');
  assert(cmd.includes("#{session_name}"), 'format 变量必须保留');
  assert(cmd.includes('kind=bell'), 'kind=bell 标记');
  assert(cmd.startsWith('run-shell'), 'tmux hook 壳');
});

test('④端点集成：真 POST → onNotify 事件 + 节流（变异靶①）', async () => {
  const server = createNzServer();
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address() as AddressInfo;
  const fired: Array<{ session: string; kind: string; message?: string }> = [];
  const off = onNotify((session, kind, message) => fired.push({ session, kind, message }));
  const post = async (body: string) => {
    const r = await fetch(`http://127.0.0.1:${port}/__tmux-notify`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    });
    return r.status;
  };
  assert((await post('session=dsh&kind=bell')) === 204, '首条 204');
  await sleep(50);
  assert(fired.length === 1 && fired[0]?.session === 'dsh' && fired[0]?.kind === 'bell', `首条必达：${JSON.stringify(fired)}`);
  await post('session=dsh&message=第二条');
  await sleep(50);
  assert(fired.length === 1, `节流窗内第二条必须被吞（实到 ${fired.length}）`);
  assert((await post('session=amp&message=需要拍板')) === 204, '异会话 204');
  await sleep(50);
  assert(fired.length === 2 && fired[1]?.message === '需要拍板', '异会话透传文案');
  assert((await post('')) === 204, '无 session 也 204（防探测口径）');
  await sleep(30);
  assert(fired.length === 2, '空 session 不产生事件');
  off();
  await new Promise<void>((r) => server.close(() => r()));
});
