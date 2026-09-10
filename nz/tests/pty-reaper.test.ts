/**
 * tests/pty-reaper.test.ts — R3-reaper 订阅者缺席收割 A 档考题（2026-09-10
 * 用户签收；幽灵安装案排障中 21 只孤儿 zsh 实证后的方案落地）。
 *
 * 覆盖：无订阅者超时收割 / 有订阅者永活（宽限持续刷新）/ 退订后进入宽限 /
 * reapAfterMs=0 禁用 / 出生宽限（新会话不当场杀）。
 *
 * 变异抽检靶子（本文件指定）：
 *   ①sweep 里「有订阅者刷新宽限」删掉 → 钉②红；
 *   ②收割条件 `>` 改 `>=` → 钉③边界红（视具体时序，可能钉①红）。
 */
import { Context } from 'cordis';
import { test, group, assert } from './runner.ts';
import { TermConnectionService } from '../src/server/term-connection.ts';

group('pty-reaper（订阅者缺席收割 A 档）');

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

const makeSvc = (reapAfterMs: number, sweepMs = 20) => {
  const ctx = new Context();
  const svc = new TermConnectionService(ctx, { shell: '/bin/sh', reapAfterMs, sweepMs });
  return { ctx, svc };
};

test('①无订阅者超时收割', async () => {
  const { svc } = makeSvc(300);
  const id = (await svc.open({ command: 'sleep 300' })).id;
  await sleep(120); // 出生宽限内
  assert(svc.list().includes(id), `出生宽限内存活 size=${svc.size} list=${JSON.stringify(svc.list())}`);
  await sleep(500); // 300ms 阈值 + sweep 拍
  assert(!svc.list().includes(id), '缺席超阈值应被收割');
});

test('②有订阅者永不收割（宽限持续刷新）', async () => {
  const { svc } = makeSvc(300);
  const id = (await svc.open({ command: 'sleep 300' })).id;
  svc.subscriberAdd(id);
  for (let i = 0; i < 6; i++) {
    await sleep(120); // 远超 300ms 阈值，但订阅在=每拍刷新宽限
    svc.subscriberAdd(id); // 模拟持续订阅心跳（计数上升无妨）
  }
  assert(svc.list().includes(id), '有订阅者必须存活');
  svc.subscriberRemove(id);
});

test('③退订后进入宽限，超时收割', async () => {
  const { svc } = makeSvc(300);
  const id = (await svc.open({ command: 'sleep 300' })).id;
  svc.subscriberAdd(id);
  await sleep(100);
  svc.subscriberRemove(id); // 退订：宽限从此刻起算
  await sleep(150);
  assert(svc.list().includes(id), '宽限期内存活');
  await sleep(500);
  assert(!svc.list().includes(id), '退订超阈值应被收割');
});

test('④reapAfterMs=0 禁用收割', async () => {
  const { svc } = makeSvc(0);
  const id = (await svc.open({ command: 'sleep 300' })).id;
  await sleep(500);
  assert(svc.list().includes(id), `禁用态必须存活 size=${svc.size} list=${JSON.stringify(svc.list())}`);
});

test('⑤订阅计数幂等：多加多减不穿透', async () => {
  const { svc } = makeSvc(300);
  const id = (await svc.open({ command: 'sleep 300' })).id;
  svc.subscriberAdd(id);
  svc.subscriberAdd(id);
  svc.subscriberRemove(id);
  svc.subscriberRemove(id);
  svc.subscriberRemove(id); // 多减：地板 0，不许负数穿透
  await sleep(500);
  assert(!svc.list().includes(id), '归零后照常收割');
});
