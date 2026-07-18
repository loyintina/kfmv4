import { parentPort } from "node:worker_threads";
import { WorkerCore } from "./tab-worker.ts";
if (!parentPort) throw new Error("tab-worker-entry: missing parentPort");
const port = parentPort;
const transport = {
  send(msg) {
    port.postMessage(msg);
  },
  onMessage(handler) {
    const wrap = (message) => handler(message);
    port.on("message", wrap);
    return () => port.off("message", wrap);
  },
  close() {
    port.close();
  }
};
new WorkerCore(transport);
