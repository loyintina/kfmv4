/**
 * tests/tmux-connection.test.ts — tmux 控制通道 A 档考题（宪法 §6 Step 2
 * server 侧，2026-09-01）
 *
 * tmux -C（control mode）= 结构化事实源：窗口列表/增删改名通知是 tmux
 * 主动推的，不解析画面。本卷用**真实 tmux**打（自建一次性考试会话，
 * 不碰用户 dsh/na 会话），钉四件：
 *   ①attach→初始窗口列表同步（id/名字/active 位）
 *   ②外部扰动→推送刷新（new-window 出现、rename 生效）
 *   ③selectWindow 经通道切换→active 位正确
 *   ④close() 干净收尸（控制 PTY 退出、考试会话不被误杀）
 *
 * 变异抽检靶子：notification → scheduleRefresh 链断了 → ②必红。
 */
import { test, group, assert } from './runner.ts';
import { execSync } from 'node:child_process';
import { TmuxControl } from '../src/server/tmux-connection.ts';

const S = 'kfm-tmux-exam';
const sh = (cmd: string): string => execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
const ensureSession = (): void => {
  try { sh(`tmux kill-session -t ${S} 2>/dev/null`); } catch { /* 不存在即可 */ }
  sh(`tmux new-session -d -s ${S} -x 120 -y 30 -n first`);
};
const waitFor = async (cond: () => boolean, ms = 6000): Promise<boolean> => {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) { if (cond()) return true; await new Promise((r) => setTimeout(r, 60)); }
  return cond();
};

group('tmux-connection（控制通道：结构化事实源）');

test('①attach→初始窗口列表同步（id/名字/active）', async () => {
  ensureSession();
  const c = new TmuxControl({ session: S });
  try {
    await c.ready(6000);
    const st = c.state();
    assert(st.session === S, `session 应为 ${S}，实际 ${st.session}`);
    assert(st.windows.length === 1, `应 1 个窗口，实际 ${st.windows.length}`);
    assert(st.windows[0].name === 'first', `窗口名应 first，实际 ${st.windows[0].name}`);
    assert(st.windows[0].active === true, '唯一窗口应 active');
    assert(st.windows[0].id.startsWith('@'), `窗口 id 应 @ 开头，实际 ${st.windows[0].id}`);
  } finally {
    c.close();
    sh(`tmux kill-session -t ${S} 2>/dev/null || true`);
  }
});

test('②外部扰动→推送刷新（new-window 出现 + rename 生效）', async () => {
  ensureSession();
  const c = new TmuxControl({ session: S });
  try {
    await c.ready(6000);
    sh(`tmux new-window -t ${S} -n second`);
    const appeared = await waitFor(() => c.state().windows.length === 2);
    assert(appeared, `通知应推送新窗口（实际 ${c.state().windows.length} 个）`);
    const second = c.state().windows.find((w) => w.name === 'second');
    assert(!!second, '新窗口名应 second');
    sh(`tmux rename-window -t ${S}:${second!.id} renamed-exam`);
    const renamed = await waitFor(() => c.state().windows.some((w) => w.name === 'renamed-exam'));
    assert(renamed, 'rename 通知应刷新到状态');
  } finally {
    c.close();
    sh(`tmux kill-session -t ${S} 2>/dev/null || true`);
  }
});

test('③selectWindow 经通道切换→active 位正确', async () => {
  ensureSession();
  const c = new TmuxControl({ session: S });
  try {
    await c.ready(6000);
    sh(`tmux new-window -t ${S} -n second`);
    await waitFor(() => c.state().windows.length === 2);
    const target = c.state().windows.find((w) => w.name === 'second')!;
    c.selectWindow(target.id); // 通道内命令，非外部 tmux CLI
    const switched = await waitFor(() => {
      const w = c.state().windows.find((x) => x.id === target.id);
      return !!w?.active && !c.state().windows.find((x) => x.name === 'first')?.active;
    });
    assert(switched, 'select-window 后 active 位应切到目标窗');
  } finally {
    c.close();
    sh(`tmux kill-session -t ${S} 2>/dev/null || true`);
  }
});

test('④close() 干净收尸：控制 PTY 退出、考试会话存活', async () => {
  ensureSession();
  const c = new TmuxControl({ session: S });
  await c.ready(6000);
  let exited = false;
  c.onExit(() => { exited = true; });
  c.close();
  assert(await waitFor(() => exited || c.exited, 4000), 'close 后控制 PTY 应退出');
  assert(c.state().windows.length === 0, 'close 后状态应清零');
  assert(sh(`tmux has-session -t ${S} 2>&1 || echo gone`).trim() !== 'gone', 'close 不得误杀考试会话');
  sh(`tmux kill-session -t ${S} 2>/dev/null || true`);
});
