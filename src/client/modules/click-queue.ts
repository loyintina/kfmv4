/**
 * click-queue.ts — 点击事件队列
 *
 * 纯数据结构 + 入队/出队原语。
 * 消费逻辑（光标判断、动画触发）在 tree-render.ts 的 processClickQueue 中。
 *
 * 设计原则:
 * - 只有入队操作是公开的（外部只管往里扔点击）
 * - 出队/清空/判空由 tree-render.ts 的 processClickQueue 独占消费
 * - 不依赖任何渲染器或状态模块
 */

export interface ClickEvent {
  offsetX: number;
  offsetY: number;
}

const _queue: ClickEvent[] = [];

export function enqueue(e: ClickEvent): void {
  _queue.push(e);
}

export function dequeue(): ClickEvent | undefined {
  return _queue.shift();
}

export function clear(): void {
  _queue.length = 0;
}

export function isEmpty(): boolean {
  return _queue.length === 0;
}

export function peek(): ClickEvent | undefined {
  return _queue[0];
}
