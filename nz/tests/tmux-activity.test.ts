/**
 * tests/tmux-activity.test.ts — R2 多会话活动指示 A 档考题（2026-09-08
 * 判据稿签收）。
 *
 * 覆盖：窗级行→会话聚合纯函数（activity OR 链/attached/windows 归并）+
 * 徽标可见性纯规则（有活动 且 非附着）+ listSessions 真机集成钉
 * （真 tmux：游离会话灌输出后 activity 置位）。
 *
 * 变异抽检靶子（本文件指定）：
 *   ①聚合函数 act||bell 改成只认 act → 钉③红；
 *   ②可见性规则去掉「非附着」条件 → 钉⑤红。
 */
import { execSync, spawn } from 'node:child_process';
import { test, group, assert } from './runner.ts';
import {
  aggregateWindowsToSessions,
  listSessions,
  mountTmuxConnection,
} from '../src/server/tmux-connection.ts';
import { activityBadgeVisible } from '../src/client/plugins/tmux-tabs/index.tsx';
import { Context } from 'cordis';

group('tmux-activity（R2 多会话活动指示 A 档）');

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const UNIQUE = `nzact-a-${Date.now() % 100000}`;

test('①聚合：多会话多窗归并，activity=任一窗 act 或 bell', () => {
  const out = [
    'amp\x1f0\x1f0\x1f1\x1f2',
    'amp\x1f1\x1f0\x1f1\x1f2', // amp 第二窗 act=1
    'dsh\x1f0\x1f0\x1f0\x1f1',
    'psh\x1f0\x1f1\x1f0\x1f1', // psh bell=1
  ].join('\n');
  const ss = aggregateWindowsToSessions(out);
  assert(ss.length === 3, `会话数=${ss.length}`);
  const amp = ss.find((s) => s.name === 'amp');
  const dsh = ss.find((s) => s.name === 'dsh');
  const psh = ss.find((s) => s.name === 'psh');
  assert(amp?.activity === true, 'amp 任一窗 act → activity');
  assert(amp?.attached === true && amp?.windows === 2, `attached/windows 归并：${JSON.stringify(amp)}`);
  assert(dsh?.activity === false, 'dsh 全静默 → activity=false');
  assert(psh?.activity === true, 'psh bell → activity（bell 也算活动）');
});

test('②聚合：空输出=空表；无名行跳过', () => {
  assert(aggregateWindowsToSessions('').length === 0, '空串');
  assert(aggregateWindowsToSessions('\n').length === 0, '纯换行');
  assert(aggregateWindowsToSessions('\x1f0\x1f0\x1f0\x1f1').length === 0, '无名行跳过');
});

test('③bell 独立置位（变异靶①：只认 act 则此钉红）', () => {
  const ss = aggregateWindowsToSessions('x\x1f0\x1f1\x1f0\x1f1');
  assert(ss[0]?.activity === true, 'bell=1 必须置 activity');
});

test('④可见性规则：有活动 且 非附着（变异靶②）', () => {
  const on = { name: 'amp', windows: 1, attached: false, activity: true };
  const off = { name: 'amp', windows: 1, attached: false, activity: false };
  assert(activityBadgeVisible(on, null) === true, '终端态+有活动 → 亮');
  assert(activityBadgeVisible(on, 'amp') === false, '附着中不亮（内容在屏上）');
  assert(activityBadgeVisible(on, 'dsh') === true, '附着别的会话 → 亮');
  assert(activityBadgeVisible(off, null) === false, '无活动不亮');
});

test('⑤listSessions 集成：查看清零 → 灌输出置位（完整生命周期）', async () => {
  mountTmuxConnection(new Context()); // 幂等开 monitor-activity（真机同路径）
  execSync('tmux set -g monitor-activity on', { stdio: 'ignore' }); // 测试内不等异步挂载
  try { execSync(`tmux kill-session -t ${UNIQUE}`, { stdio: 'ignore' }); } catch { /* 无则罢 */ }
  // tmux 语义（实证）：新建游离会话出生即 act=1（shell 印提示符+创建即活动）。
  // 清零的正路=有客户端看过窗：script 给 attach 一个 pty，看 2 秒即走。
  execSync(`tmux new-session -d -s ${UNIQUE} -x 120 -y 30`, { stdio: 'ignore' });
  try {
    // timeout 杀客户端退出码 124=预期路径；TERM 必带（无 TERM tmux 拒附，
    // flag 不清——首跑实锤）。attach 看一眼即清零
    execSync(`TERM=xterm timeout 2 script -qec "tmux attach -t ${UNIQUE}" /dev/null >/dev/null 2>&1`);
  } catch { /* 预期非零 */ }
  await sleep(300);
  const cleared = (await listSessions()).find((s) => s.name === UNIQUE);
  assert(!!cleared, '会话在表');
  assert(cleared?.activity === false, `被查看后 activity 应回零：${JSON.stringify(cleared)}`);
  // 灌输出 → 轮询等置位（标志位由 tmux 后台置，留节拍）
  execSync(`tmux send-keys -t ${UNIQUE} 'echo act-exam' Enter`, { stdio: 'ignore' });
  let lit = false;
  for (let i = 0; i < 15 && !lit; i++) {
    await sleep(400);
    lit = (await listSessions()).find((s) => s.name === UNIQUE)?.activity === true;
  }
  assert(lit, '产生输出后 activity 应置位');
  execSync(`tmux kill-session -t ${UNIQUE}`, { stdio: 'ignore' });
});

test('⑥同名多窗归并为一条会话记录', () => {
  // 占位聚合钉：聚合输出按名稳定排序不承诺——只锁「重复名归并为一条」
  const dup = aggregateWindowsToSessions(
    'z\x1f0\x1f0\x1f0\x1f1\nz\x1f1\x1f0\x1f0\x1f1\nz\x1f0\x1f0\x1f0\x1f1',
  );
  assert(dup.length === 1 && dup[0]?.activity === true, '同名窗归并一条');
});
