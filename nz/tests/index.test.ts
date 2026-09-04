/**
 * tests/index.test.ts — nz 测试聚合入口（npm test）
 *
 * 各考题文件以副作用注册 test()，本入口统一 runAll()。
 * 新考题文件在此追加一行 import。
 */
import './ctx-kernel.test.ts';
import './host.test.ts';
import './gesture.test.ts';
import './card-types.test.ts';
import './permission.test.ts';
import './plugtest.test.ts';
import './eyes.test.ts';
import './server.test.ts';
import './term-connection.test.ts';
import './tmux-connection.test.ts';
import './ws-bridge.test.ts';
import './bridge-heartbeat.test.ts';
import './term-core-shared.test.ts';
import './keymap.test.ts';
import './cdp-relay.test.ts';
import './palette-bold-bright.test.ts';
import './ai-sse-parser.test.ts';
import './ai-translator.test.ts';
import './ai-providers.test.ts';
import './ai-reducer.test.ts';
import './ai-projection.test.ts';
import './ai-server.test.ts';
import { runAll } from './runner.ts';

await runAll();
