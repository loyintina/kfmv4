/**
 * bus.ts — pool/changed 广播总线（设计清单 §1.6）
 *
 * 9.0 契约：serial+bail 顺序短路、池数据唯一管理者发出。nz 落地：
 *   - 唯一发出点 = 池数据层路由族（route.ts）——CRUD/激活**写盘成功后**
 *     才 emit（先落盘后广播，落盘即事实）；
 *   - 唯一消费者 = ws-bridge（/ws/term 多路复用，{t:'pool-changed',pool,id,op}
 *     帧），client 各池页收到 → refetch 校准（服务器唯一真源，P7）；
 *   - v0 不承诺：跨进程文件监听（kfmv4 侧改池文件 nz 不感知——仲裁②登记）；
 *     serial+bail 的「bail」消费语义 v0 无消费者，本总线即接口位。
 */

export type PoolChangedOp = 'created' | 'updated' | 'deleted' | 'activated';

export interface PoolChangedEvent {
  pool: string;
  id: string;
  op: PoolChangedOp;
}

const subs = new Set<(ev: PoolChangedEvent) => void>();

/** 订阅广播（ws-bridge 挂载时注册）；返回退订函数 */
export function onPoolChanged(fn: (ev: PoolChangedEvent) => void): () => void {
  subs.add(fn);
  return () => { subs.delete(fn); };
}

/** 路由层落盘成功后调用（池数据层=唯一管理者，插件/client 禁自造事件） */
export function emitPoolChanged(ev: PoolChangedEvent): void {
  for (const fn of subs) {
    try { fn(ev); } catch { /* 单订阅者炸不挡其他订阅者（广播不逆天） */ }
  }
}
