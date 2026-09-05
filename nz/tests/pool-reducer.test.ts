/**
 * tests/pool-reducer.test.ts — 配置池 A2a 阶段二考卷 A8：池框架状态机
 * （设计清单 docs/config-pool-a2a-design.md §四：页面机 POOL_CLOSED/POOL_OPEN
 * + 池页机 DETAIL/OVERLAY_DELETE，转换 C1-C13，禁令 P6 词汇表强制）
 *
 * 2026-09-05 改卷（§四 修订①，用户拍板老 kfmv4 池卡信息组织复刻）：池页机
 * 两态（BROWSE/EDITING）退役 → **选择制单态 DETAIL**——上区详情编辑常驻，
 * 点池行=切换编辑目标（C4 selectDetail），保存后编辑器保持载入（C5），
 * 取消=rev++ 重挂回存档值（C6），删除成功清目标由自动选首条补位（C8）。
 *
 * 红先证据：2026-09-04 先写本卷跑红（pool-link.ts 尚不存在）→ 实现 → 全绿；
 * 本轮改卷同法：改卷先行跑红（beginEdit 已退役+旧 BROWSE 断言红）→ 实现
 * （pool-link 词汇表/转换表改）→ 全绿。
 *
 * 纯逻辑层（L4）：createPoolCore() 不碰 DOM 不碰 fetch，转换单源 reducer
 * （唯一 transition 入口，from/to/trigger 记账，环形缓冲 ≥50 拍）。
 * 交互/DOM 半（手势三重判定/表单/推送到达）归 B 档 config-pool.test.mjs。
 *
 * 变异抽检靶子：C2/C6 草稿不蒸发 / C5 isNew 不翻转 / C6 rev 不动 /
 * P6 校验拆除 / C9 原状丢失 → 本卷咬红。
 */
import { test, group, assert } from './runner.ts';
import {
  createPoolCore,
  POOL_PAGE_VOCAB,
  POOL_INNER_VOCAB,
  POOL_TRIGGER_VOCAB,
} from '../src/client/plugins/config-pool/pool-link.ts';

group('pool-reducer（A8：池框架状态机 C1-C13 单源 reducer + P6 词汇表；修订①选择制）');

test('词汇表常量在脑：页面机/池页机/触发器三枚举（P6 清单外状态名禁止；修订①两态退役）', () => {
  assert(JSON.stringify(POOL_PAGE_VOCAB) === JSON.stringify(['POOL_CLOSED', 'POOL_OPEN']),
    `页面机词汇=${JSON.stringify(POOL_PAGE_VOCAB)}`);
  assert(JSON.stringify(POOL_INNER_VOCAB) === JSON.stringify(['DETAIL', 'OVERLAY_DELETE']),
    `池页机词汇=${JSON.stringify(POOL_INNER_VOCAB)}`);
  for (const t of ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9', 'C10', 'C11', 'C12', 'C13']) {
    assert((POOL_TRIGGER_VOCAB as readonly string[]).includes(t), `触发器缺 ${t}`);
  }
});

test('出生态：POOL_CLOSED + 无池语境 + DETAIL + 无编辑目标 + 无罩层', () => {
  const c = createPoolCore();
  assert(c.state.page === 'POOL_CLOSED', `page=${c.state.page}`);
  assert(c.state.pool === null, `pool=${c.state.pool}`);
  assert(c.state.inner === 'DETAIL', `inner=${c.state.inner}`);
  assert(c.state.editing === null && c.state.overlay === null, 'editing/overlay 应为 null');
  assert(c.state.rev === 0, `rev=${c.state.rev}`);
});

test('C1 左滑成立：POOL_CLOSED → POOL_OPEN+DETAIL，默认进基本池（§四 C1）', () => {
  const c = createPoolCore();
  c.openBySwipe();
  assert(c.state.page === 'POOL_OPEN' && c.state.inner === 'DETAIL', `page=${c.state.page} inner=${c.state.inner}`);
  assert(c.state.pool === 'basic', `默认池应 basic，实际 ${c.state.pool}`);
  const last = c.ring[c.ring.length - 1];
  assert(last.trigger === 'C1' && last.from.page === 'POOL_CLOSED' && last.to.page === 'POOL_OPEN', 'C1 记账错');
});

test('C2 右滑/× 返回：POOL_OPEN → POOL_CLOSED；详情中直接关编辑目标蒸发（§四 C2 裁定）', () => {
  const c = createPoolCore();
  c.openBySwipe();
  c.selectDetail({ id: 'x', isNew: false });
  assert(c.state.editing?.id === 'x', '前置编辑目标在场');
  c.close();
  assert(c.state.page === 'POOL_CLOSED', `page=${c.state.page}`);
  assert(c.state.editing === null && c.state.pool === null, '关闭必须蒸发编辑目标与池语境');
  assert(c.ring[c.ring.length - 1].trigger === 'C2', 'trigger 应 C2');
});

test('C3 点标签另一池：DETAIL 挂载；旧池草稿蒸发（§四 C3；新池由自动选首条效果补目标）', () => {
  const c = createPoolCore();
  c.openBySwipe();
  c.selectDetail({ id: 'draft', isNew: true });
  c.switchPool('provider');
  assert(c.state.page === 'POOL_OPEN' && c.state.pool === 'provider' && c.state.inner === 'DETAIL',
    `page=${c.state.page} pool=${c.state.pool} inner=${c.state.inner}`);
  assert(c.state.editing === null, '旧池草稿必须蒸发（自动选首条效果负责补位）');
  assert(c.ring[c.ring.length - 1].trigger === 'C3', 'trigger 应 C3');
});

test('C4 点条目行=切换编辑目标（选择制；null=新建草稿 PoolPage.edit §1.4）', () => {
  const c = createPoolCore();
  c.openBySwipe();
  c.selectDetail({ id: 'examprov', isNew: false });
  assert(c.state.inner === 'DETAIL' && c.state.editing?.id === 'examprov' && c.state.editing?.isNew === false,
    JSON.stringify(c.state.editing));
  c.selectDetail({ id: null, isNew: true });
  assert(c.state.inner === 'DETAIL' && c.state.editing?.isNew === true && c.state.editing?.id === null,
    'selectDetail(null) 应为新建草稿');
  assert(c.ring[c.ring.length - 1].trigger === 'C4', 'trigger 应 C4');
});

test('C5 保存成功：编辑器保持载入——saveDone() 目标不变；saveDone(id) 翻转 isNew（create→update）', () => {
  const c = createPoolCore();
  c.openBySwipe();
  c.selectDetail({ id: 'a', isNew: false });
  c.saveDone();
  assert(c.state.inner === 'DETAIL' && c.state.editing?.id === 'a', `编辑器应保持载入 a：${JSON.stringify(c.state.editing)}`);
  assert(c.ring[c.ring.length - 1].trigger === 'C5', 'trigger 应 C5');
  // 新建腿：isNew 草稿保存后拿真实 id 翻转（后续保存走 update 不再 create）
  c.selectDetail({ id: null, isNew: true });
  c.saveDone('b');
  assert(c.state.editing?.id === 'b' && c.state.editing?.isNew === false,
    `saveDone(id) 应翻转：${JSON.stringify(c.state.editing)}`);
});

test('C6 取消：草稿蒸发（rev++ 重挂）编辑目标不变（选择制语义）', () => {
  const c = createPoolCore();
  c.openBySwipe();
  c.selectDetail({ id: 'a', isNew: false });
  const rev0 = c.state.rev;
  c.cancelEdit();
  assert(c.state.inner === 'DETAIL' && c.state.editing?.id === 'a', `inner=${c.state.inner} 目标应保持`);
  assert(c.state.rev === rev0 + 1, `rev 应 ++（重挂 nonce）：${c.state.rev}`);
  assert(c.ring[c.ring.length - 1].trigger === 'C6', 'trigger 应 C6');
});

test('C7 点删除：DETAIL → OVERLAY_DELETE 确认拦截（P3 的 UI 半）；编辑目标保持', () => {
  const c = createPoolCore();
  c.openBySwipe();
  c.selectDetail({ id: 'examprov', isNew: false });
  c.askDelete('examprov');
  assert(c.state.inner === 'OVERLAY_DELETE' && c.state.overlay?.id === 'examprov', JSON.stringify(c.state.overlay));
  assert(c.state.editing?.id === 'examprov', '进罩层不得丢编辑目标');
  assert(c.ring[c.ring.length - 1].trigger === 'C7', 'trigger 应 C7');
});

test('C8 确认删除成功：OVERLAY_DELETE → DETAIL+目标清空（自动选首条效果补位）；409 不删不转换', () => {
  const c = createPoolCore();
  c.openBySwipe();
  c.selectDetail({ id: 'examprov', isNew: false });
  c.askDelete('examprov');
  c.deleteDone();
  assert(c.state.inner === 'DETAIL' && c.state.overlay === null && c.state.editing === null,
    `inner=${c.state.inner} 目标应清（补位=PoolApp 效果腿）`);
  assert(c.ring[c.ring.length - 1].trigger === 'C8', 'trigger 应 C8');
  // 409 分支：罩层保持（不转换），ring 记 from==to 一拍
  c.selectDetail({ id: 'examprov', isNew: false });
  c.askDelete('examprov');
  const before = c.ring.length;
  c.deleteDenied();
  assert(c.state.inner === 'OVERLAY_DELETE' && c.state.overlay?.id === 'examprov', '409 必须留在罩层');
  const rec = c.ring[c.ring.length - 1];
  assert(c.ring.length === before + 1 && rec.trigger === 'C8'
    && rec.from.inner === 'OVERLAY_DELETE' && rec.to.inner === 'OVERLAY_DELETE', '409 应记 from==to 一拍');
});

test('C9 罩层取消/点空白：回 DETAIL 原状零副作用', () => {
  const c = createPoolCore();
  c.openBySwipe();
  c.askDelete('a');
  c.overlayCancel();
  assert(c.state.inner === 'DETAIL' && c.state.overlay === null, `inner=${c.state.inner}`);
  c.selectDetail({ id: 'a', isNew: false });
  c.askDelete('a');
  c.overlayCancel();
  assert(c.state.inner === 'DETAIL' && c.state.editing?.id === 'a', '罩层取消必须回 DETAIL 原状且目标保真');
  assert(c.ring[c.ring.length - 1].trigger === 'C9', 'trigger 应 C9');
});

test('C10/C11/C13 原状保持：激活/推送/重连 refetch 不动页面机与池页机', () => {
  const c = createPoolCore();
  c.openBySwipe();
  for (const [trigger, fn] of [
    ['C10', () => c.activateDone()],
    ['C11', () => c.pushArrived()],
    ['C13', () => c.envResync()],
  ] as const) {
    const before = c.ring.length;
    fn();
    const rec = c.ring[c.ring.length - 1];
    assert(c.state.page === 'POOL_OPEN' && c.state.inner === 'DETAIL', `${trigger} 必须原状保持`);
    assert(c.ring.length === before + 1 && rec.trigger === trigger
      && rec.from.page === rec.to.page && rec.from.inner === rec.to.inner,
      `${trigger} 应记 from==to 一拍`);
  }
});

test('C12 标题栏入口路由（拍板⑯）：POOL_CLOSED → POOL_OPEN+DETAIL 直达对应池', () => {
  const c = createPoolCore();
  c.openRoute('prompt');
  assert(c.state.page === 'POOL_OPEN' && c.state.pool === 'prompt' && c.state.inner === 'DETAIL',
    `pool=${c.state.pool}`);
  assert(c.ring[c.ring.length - 1].trigger === 'C12', 'trigger 应 C12');
  c.close();
  c.openRoute('session');
  assert(c.state.pool === 'session' && c.state.page === 'POOL_OPEN', '二次路由应直达 session');
});

test('P6 词汇表强制：清单外状态名/触发器 transition 即抛（机检锚点）', () => {
  const c = createPoolCore();
  let msg = '';
  try { c.transition('C99' as never, { page: 'POOL_OPEN' }); } catch (e) { msg = (e as Error).message; }
  assert(msg.includes('触发器'), `野触发器应抛，实际：${msg || '未抛'}`);
  msg = '';
  try { c.transition('C1', { page: 'SOMEWHERE' as never }); } catch (e) { msg = (e as Error).message; }
  assert(msg.includes('页面机'), `野页面名应抛，实际：${msg || '未抛'}`);
  msg = '';
  try { c.transition('C1', { inner: 'MODAL' as never }); } catch (e) { msg = (e as Error).message; }
  assert(msg.includes('池页机'), `野池页名应抛，实际：${msg || '未抛'}`);
});

test('观测环：≥50 拍环形缓冲 + 全程状态名 ⊆ 枚举（B9 的 L4 腿）', () => {
  const c = createPoolCore();
  for (let i = 0; i < 60; i++) {
    c.openBySwipe();
    c.selectDetail({ id: `x${i}`, isNew: false });
    c.cancelEdit();
    c.close();
  }
  assert(c.ring.length >= 50 && c.ring.length <= 80, `环长=${c.ring.length}（≥50 拍契约）`);
  for (const rec of c.ring) {
    assert((POOL_PAGE_VOCAB as readonly string[]).includes(rec.from.page)
      && (POOL_PAGE_VOCAB as readonly string[]).includes(rec.to.page)
      && (POOL_INNER_VOCAB as readonly string[]).includes(rec.from.inner)
      && (POOL_INNER_VOCAB as readonly string[]).includes(rec.to.inner)
      && (POOL_TRIGGER_VOCAB as readonly string[]).includes(rec.trigger),
      `环内出现清单外词汇：${JSON.stringify(rec)}`);
  }
});
