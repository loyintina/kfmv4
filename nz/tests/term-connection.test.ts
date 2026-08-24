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
import { mountTermConnection, resolveLoginShell, type TermConnectionService } from '../src/server/term-connection.ts';

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

test('list 口径：自然退出的会话不向 list 暴露，但仍可按 id attach 捞尾迹（评审 8.8.2 前置①）', async () => {
  const { ctx, conn } = newEnv();
  const exits: string[] = [];
  ctx.on('term/exit', (id) => exits.push(id));
  const s = await conn.open({ command: 'printf 遗言; exit 3' });
  await until(() => exits.includes(s.id), '会话自然退出');
  assert(!conn.list().includes(s.id), 'exited 会话不应出现在 list（客户端不见尸体）');
  const ghost = conn.attach(s.id);
  assert(ghost !== undefined, '死会话仍可 attach（捞 exit code/尾迹）');
  assert(ghost!.replayTail().includes('遗言'), '死会话尾迹可捞');
  s.close();
  await until(() => conn.attach(s.id) === undefined, 'close 后尸体摘除');
});

test('open 挂权限判定：交互 shell=exec:no-meta allow；含元字符命令=exec:shell-meta ask（影子期不拦截但落审计）', async () => {
  const ctx = new Context();
  const { PermissionEngine } = await import('../src/client/permission.ts');
  const perms = new PermissionEngine();
  ctx.provide('permissions', perms);
  mountTermConnection(ctx, { shell: '/bin/sh' });
  assert(perms.declared('term.open'), 'mount 应登记 term.open=exec 户口');
  const s1 = await ctx.termConn.open();
  const s2 = await ctx.termConn.open({ command: 'ls; whoami' });
  const rules = perms.audit.filter((e) => e.tool === 'term.open').map((e) => `${e.decision}:${e.rule}`);
  assert(rules.includes('allow:exec:no-meta'), `交互 shell 应 allow:no-meta（实际 ${rules}）`);
  assert(rules.includes('ask:exec:shell-meta'), `元字符命令应 ask:shell-meta（实际 ${rules}）`);
  assert(perms.audit.every((e) => e.mode === 'shadow'), '影子期全部 shadow 不拦截');
  s1.close();
  s2.close();
});

test('默认 shell=passwd 登录 shell（2026-08-24 评审信 pty-login-shell-review）：不传 opts 走 passwd 解析，交互会话真起登录 shell 且 $SHELL 覆写', async () => {
  // 动态对照（不写死 zsh）：测试自解 /etc/passwd 当前 uid 末字段
  const { readFileSync } = await import('node:fs');
  const uid = process.getuid!();
  const passwdShell = readFileSync('/etc/passwd', 'utf8').split('\n')
    .find((l) => l && !l.startsWith('#') && Number(l.split(':')[2]) === uid)!.split(':')[6].trim();
  // ①纯函数钉：解析结果=passwd 登录 shell
  assert(resolveLoginShell() === passwdShell,
    `resolveLoginShell()=${resolveLoginShell()} 应=passwd 登录 shell ${passwdShell}`);
  // ②opts 优先钉：显式传 shell 不被 passwd 抢
  const ctxOpt = new Context();
  mountTermConnection(ctxOpt, { shell: '/bin/sh' });
  assert(ctxOpt.termConn.shell === '/bin/sh', '显式 opts.shell 应优先于 passwd 解析');
  // ③默认挂载钉：不传 opts → 服务默认 shell=passwd 登录 shell
  const ctx = new Context();
  mountTermConnection(ctx);
  assert(ctx.termConn.shell === passwdShell,
    `默认挂载 shell=${ctx.termConn.shell} 应=passwd ${passwdShell}`);
  // ④真 PTY 行为钉：交互会话（command 空）进程名=passwd shell basename，
  //   且 $SHELL 同步覆写为登录 shell（login 语义）
  const s = await ctx.termConn.open();
  let out = '';
  s.onOutput((d) => { out += d; });
  s.sendInput('echo "PROBE:$(ps -o comm= -p $$):$SHELL"\n');
  const base = passwdShell.split('/').pop()!;
  const re = new RegExp(`PROBE:\\s*${base}:${passwdShell.replace(/\//g, '\\/')}`);
  await until(() => re.test(out), `交互会话进程=${base} 且 $SHELL=${passwdShell}（实收尾迹 ${out.slice(-160)}）`);
  s.close();
});
