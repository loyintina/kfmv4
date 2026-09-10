import './runner.ts';
import './fs-api.test.ts';
import { runAll } from './runner.ts';
console.log('[solo] imports 完成，runAll 开始');
setTimeout(() => { console.log('[solo] 看门狗 20s 触发——runAll 未完成'); process.exit(9); }, 20000);
await runAll();
console.log('[solo] runAll 完成');
