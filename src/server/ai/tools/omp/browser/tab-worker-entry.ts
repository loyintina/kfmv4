/**
 * tab-worker-entry.ts — Worker 线程入口
 *
 * 移植自 omp browser/tab-worker-entry.ts。
 * 使用 node:worker_threads 代替 Bun Worker API。
 */

import { parentPort } from 'node:worker_threads';
import type { Transport, WorkerInbound, WorkerOutbound } from './tab-protocol.js';
import { WorkerCore } from './tab-worker.js';

if (!parentPort) throw new Error('tab-worker-entry: missing parentPort');

const port = parentPort;

const transport: Transport = {
  send(msg) {
    port.postMessage(msg);
  },
  onMessage(handler) {
    const wrap = (message: unknown): void => handler(message as WorkerOutbound | WorkerInbound);
    port.on('message', wrap);
    return () => port.off('message', wrap);
  },
  close() {
    port.close();
  },
};

new WorkerCore(transport);
