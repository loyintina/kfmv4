import { strict as assert } from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';
import { regression, group } from './harness.js';

group('doSend 实时查 compacts 接口（BAR-COMPACT-L4-01i）');

// 契约：doSend 的 L4 裁剪边界（compactCutIndex）必须实时从服务端 compacts 接口取，
// 不得依赖 sessionStore.list 快照（页面加载时的旧数据，compact 后不刷新 → 拿不到
// cutIndex → 发全量 297k → 超 256k 模型上限，用户实测 401「k3-256k supports only
// 256K context」）。
// 历史：曾读 window.__kfmLastCompact（只有读取点没有赋值点，从未生效）→ 改
// sessionStore.list（快照陈旧，仍发全量）→ 本次根治：fetch compacts 接口。
regression('BAR-COMPACT-L4-01i', 'orb-chat-run', 'doSend 实时查 compacts 接口取 cutIndex（不依赖 sessionStore.list 快照）', () => {
  const src = readFileSync(
    join(process.cwd(), 'src/client/modules/orb-chat-run.ts'), 'utf-8');

  // 必须实时查服务端 compacts 接口（真相源）
  assert.ok(src.includes("session/compacts/"),
    'doSend 必须 fetch session/compacts 接口实时取 cutIndex');
  assert.ok(/fetch\([^)]*session\/compacts\//.test(src),
    '必须用 fetch 调 session/compacts 接口');

  // 不得再依赖 sessionStore.list 快照拿 cutIndex（会陈旧 → 发全量 → 超限）
  const cutBlock = src.match(/L4 会话压缩[\s\S]*?lastCutIndex[\s\S]*?toOpenAiMessages/);
  assert.ok(cutBlock, '应能找到 L4 会话压缩代码块');
  assert.ok(!cutBlock![0].includes('sessionStore.list.find'),
    'L4 裁剪不得依赖 sessionStore.list.find（快照陈旧 → 发全量）');
});
