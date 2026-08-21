/**
 * tests/term-connection.test.ts — 终端连接家族 A 档考题（№1 连接层 / nz 8.8.1）
 *
 * 五动作全真 PTY 实测（不 mock）：open / input / resize / close / 重连=attach。
 * 加两枚语义钉：输出同时走单会话订阅与总线事件（传输无关）；服务卸载全杀。
 *
 * 变异抽检靶子（本文件指定）：
 *   ①onData 不发 'term/output' 总线事件（只调订阅回调）→ 「双通道」钉红；
 *   ②close 不从会话表摘除 → 「close 后 attach 不到」钉红。
 */
import { Context } from 'cordis';
import { test, group, assert } from './runner.ts';
import { mountTermConnection, type TermConnectionService } from '../src/server/term-connection.ts';

function newEnv(): { ctx: Context; conn: TermConnectionService } {
  const ctx = new Context();
  mountTermConnection(ctx, { shell: '/bin/sh' });
  return { ctx, conn: ctx.termConn };
}

/** 等条件成真（轮询，超时 3s 判失败） */
async function until(cond: () => boolean, what: string): Promise<void> {
  const t0 = Date.now();
  while (!cond()) {
    if (Date.now() - t0 > 3000) throw new Error(`等不到：${what}`);
    await new Promise((r) => setTimeout(r, 20));
  }
}

group('term-connection（终端连接家族）');

test('open+input：起真 PTY，喂输入，输出回得来（订阅与总线事件双通道）', async () => {
  const { ctx, conn } = newEnv();
  const busData: string[] = [];
  ctx.on('term/output', (_id, data) => busData.push(data));
  const s = await conn.open({ command: 'cat' });
  assert(typeof s.id === 'string' && conn.list().includes(s.id), 'open 后会话在册');
  let subbed = '';
  s.onOutput((d) => { subbed += d; });
  s.sendInput('hello-nz\n');
  await until(() => subbed.includes('hello-nz'), 'cat 回显');
  assert(busData.join('').includes('hello-nz'), '总线 term/output 事件应同步观察到');
  s.close();
  await until(() => conn.size === 0 || !conn.list().includes(s.id), '会话摘除');
});

test('resize：改尺寸后 stty size 报新值（真 ioctl 生效）', async () => {
  const { conn } = newEnv();
  const s = await conn.open({ cols: 80, rows: 24 });
  let out = '';
  s.onOutput((d) => { out += d; });
  s.resize(100, 30);
  // 交互 shell 里问终端尺寸（$COLUMNS 不可靠，stty 直读 tty）
  s.sendInput('stty size\n');
  await until(() => /\b30 100\b/.test(out), 'stty size 报 30 100');
  s.close();
});

test('close：杀会话 → exit 事件 + 会话表摘除；自然退出同样收口', async () => {
  const { ctx, conn } = newEnv();
  const exits: Array<[string, number]> = [];
  ctx.on('term/exit', (id, code) => exits.push([id, code]));
  // 自然退出：命令跑完即死，exit code 透传
  const s1 = await conn.open({ command: 'exit 7' });
  await until(() => exits.some(([id, c]) => id === s1.id && c === 7), 'exit 7 透传');
  // 主动 close
  const s2 = await conn.open({ command: 'cat' });
  s2.close();
  await until(() => exits.some(([id]) => id === s2.id), 'close 触发 exit 事件');
  await until(() => !conn.list().includes(s2.id), 'close 后会话表摘除');
  assert(conn.attach(s2.id) === undefined, 'close 后 attach 应拿不到');
});

test('重连=attach：消费者退订会话不死；新消费者按 id 复挂，replayTail 补断档', async () => {
  const { conn } = newEnv();
  const s = await conn.open({ command: 'cat' });
  let first = '';
  const off = s.onOutput((d) => { first += d; });
  s.sendInput('第一段\n');
  await until(() => first.includes('第一段'), '第一段回显');
  // 消费者退订（网页刷新/断网的传输无关等价物）——会话不死
  off();
  s.sendInput('断档期\n');
  await until(() => s.replayTail().includes('断档期'), '断档期输出进尾迹');
  assert(!first.includes('断档期'), '退订后不再收货');
  // 新消费者按 id 复挂 = 重连：先捞尾迹补断档，再续收实时输出
  const re = conn.attach(s.id)!;
  assert(re !== undefined && re.id === s.id, 'attach 应复挂同一会话');
  assert(re.replayTail().includes('第一段') && re.replayTail().includes('断档期'), '尾迹应含断档前后');
  let live = '';
  re.onOutput((d) => { live += d; });
  re.sendInput('重连后\n');
  await until(() => live.includes('重连后'), '重连后续收实时输出');
  s.close();
});

test('服务卸载全杀：dispose 后会话表清空（登记类逆序摘）', async () => {
  const ctx = new Context();
  const fiber = ctx.plugin((c) => mountTermConnection(c, { shell: '/bin/sh' }));
  await fiber;
  const conn = ctx.termConn;
  const s = await conn.open({ command: 'cat' });
  assert(conn.size === 1, '会话在册');
  await fiber.dispose();
  assert(conn.size === 0 && conn.list().length === 0, '卸载后会话表应清空');
  assert(conn.attach(s.id) === undefined, '卸载后 attach 不到');
});
