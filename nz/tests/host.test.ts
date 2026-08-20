/**
 * tests/host.test.ts — 渲染宿主 A 档考题（№14 四设计要件逐条钉住）
 */
import { Context } from 'cordis';
import { test, group, assert } from './runner.ts';
import { RenderHost, createContainer, type ContainerHandle } from '../src/client/host.ts';
import { FakeDoc, FakeEl } from './fake-dom.ts';

function newHost(): { host: RenderHost; doc: FakeDoc; ctx: Context } {
  const host = new RenderHost();
  const doc = new FakeDoc();
  host.init(doc as unknown as Document); // escape-ok: fake 覆盖宿主全部 DOM 操作面
  const ctx = new Context();
  ctx.provide('host', host);
  return { host, doc, ctx };
}

function layer(doc: FakeDoc, id: string): FakeEl {
  const found = doc.body.children.find((c) => c.id === id);
  if (!found) throw new Error(`层根 ${id} 不存在`);
  return found;
}

function asFake(h: ContainerHandle): FakeEl {
  return h.el as unknown as FakeEl;
}

group('host（渲染宿主）');

test('init 建三个层根挂 body（全项目唯一 body 入口），z-index 递升', () => {
  const { doc } = newHost();
  const ids = doc.body.children.map((c) => c.id);
  assert(ids.join(',') === 'kfm-layer-layout,kfm-layer-persistent,kfm-layer-overlay', `层根不齐：${ids.join(',')}`);
  const z = doc.body.children.map((c) => Number(c.style.zIndex));
  assert(z[0] < z[1] && z[1] < z[2], `z-index 应递升：${z.join(',')}`);
});

test('create 按 kind 挂对应层根，登记可回查', () => {
  const { doc, ctx } = newHost();
  const h = createContainer(ctx, { kind: 'overlay', slot: 'confirm', owner: 'p1' });
  const overlay = layer(doc, 'kfm-layer-overlay');
  assert(asFake(h).parentElement === overlay, 'overlay 容器应挂 overlay 层根');
  assert(asFake(h).dataset.kfmOwner === 'p1' && asFake(h).dataset.kfmSlot === 'confirm', 'owner/slot 应登记在 DOM 上');
});

test('detach 后 DOM 无残留（№14 A 档原话）', () => {
  const { doc, ctx } = newHost();
  const h = createContainer(ctx, { kind: 'overlay', slot: 'toast', owner: 'p1' });
  const overlay = layer(doc, 'kfm-layer-overlay');
  assert(overlay.children.length === 1, '挂载后应有 1 个容器');
  h.detach();
  assert(overlay.children.length === 0, 'detach 后层根应无残留');
  h.detach(); // 幂等不炸
  assert(!h.attached, 'detach 后 attached 应为 false');
});

test('owner 死自动摘：插件 dispose → 容器 detach（要件 2）', async () => {
  const { doc, ctx } = newHost();
  const overlay = layer(doc, 'kfm-layer-overlay');
  const fiber = ctx.plugin((child) => {
    createContainer(child, { kind: 'overlay', slot: 'panel', owner: 'p-doomed' });
  });
  await fiber;
  assert(overlay.children.length === 1, '插件活着时容器应在');
  await fiber.dispose();
  assert(overlay.children.length === 0, '插件 dispose 后容器应自动摘除');
});

test('连带清场：detachByOwner 摘该 owner 全部，别家不动（要件 1）', () => {
  const { doc, ctx } = newHost();
  const overlay = layer(doc, 'kfm-layer-overlay');
  createContainer(ctx, { kind: 'overlay', slot: 'a', owner: 'p1' });
  createContainer(ctx, { kind: 'overlay', slot: 'b', owner: 'p1' });
  createContainer(ctx, { kind: 'overlay', slot: 'c', owner: 'p1' });
  createContainer(ctx, { kind: 'overlay', slot: 'x', owner: 'p2' });
  assert(overlay.children.length === 4, '应挂 4 个容器');
  const n = ctx.host.detachByOwner('p1');
  assert(n === 3, `应摘 3 个，实际 ${n}`);
  assert(overlay.children.length === 1, '应只剩 p2 的容器');
  assert(overlay.children[0].dataset.kfmOwner === 'p2', `剩下的应是 p2 的容器，实际 owner=${overlay.children[0].dataset.kfmOwner}`);
});

test('防重下沉：同 owner+slot 重建默认摘旧建新（要件 4）', () => {
  const { ctx } = newHost();
  const h1 = createContainer(ctx, { kind: 'overlay', slot: 'dlg', owner: 'p1' });
  const h2 = createContainer(ctx, { kind: 'overlay', slot: 'dlg', owner: 'p1' });
  assert(!h1.attached, '旧 handle 应被摘除');
  assert(h2.attached && h1 !== h2, '应返回新 handle');
});

test('防重下沉：reuse:true 返回旧 handle（真常驻档）', () => {
  const { ctx } = newHost();
  const h1 = createContainer(ctx, { kind: 'persistent', slot: 'orb', owner: 'orb' });
  const h2 = createContainer(ctx, { kind: 'persistent', slot: 'orb', owner: 'orb', reuse: true });
  assert(h1 === h2 && h1.attached, 'reuse 应返回同一 handle 且不摘');
});

test('show/hide 与 attach/detach 分档：hide 不摘 DOM（要件 3）', () => {
  const { doc, ctx } = newHost();
  const persistent = layer(doc, 'kfm-layer-persistent');
  const h = createContainer(ctx, { kind: 'persistent', slot: 'hud', owner: 'obs' });
  h.hide();
  assert(persistent.children.length === 1, 'hide 不应摘 DOM（伪生灭档）');
  assert(asFake(h).style.display === 'none' && !h.visible, 'hide 应 display:none');
  h.show();
  assert(asFake(h).style.display === '' && h.visible, 'show 应恢复显示');
});

test('宿主未挂载时插件入口显式报错（不静默漏清场）', () => {
  const ctx = new Context(); // 未 provide host
  let msg = '';
  try {
    createContainer(ctx, { kind: 'overlay', slot: 's', owner: 'p1' });
  } catch (e) {
    msg = (e as Error).message;
  }
  assert(msg.includes('内核未挂载'), `应报内核未挂载，实际：${msg || '未抛错'}`);
});
