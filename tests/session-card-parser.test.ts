import { strict as assert } from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';
import { regression, group } from './harness.js';

group('session.card 解析唯一生产者（BAR-COMPACT-L4-01f）');

// 契约：会话卡加载会话列表必须消费共享 parseSessionItem（session-client.ts），
// 不得内联复制一份解析逻辑。曾 bug：session.card.ts 的 loadSessions 内联复制了
// sessions/list 的解析（含 tokenCount/fullTokenCount 提取），漏了 compactToken——
// 三数字 b 透传断链。根因是「同一数据两个解析器」违反心法 16（唯一生产者）。
// 钉法：静态断言 session.card.ts 源码消费 parseSessionItem 且不含内联解析块。
regression('BAR-COMPACT-L4-01f', 'floating-card', 'session.card.ts loadSessions 用共享 parseSessionItem（无内联重复解析）', () => {
  const src = readFileSync(
    join(process.cwd(), 'src/client/cards/plugins/session.card.ts'), 'utf-8');

  // 必须消费共享解析器
  assert.ok(src.includes('parseSessionItem'),
    'session.card.ts 必须 import 并调用 parseSessionItem（共享解析器）');
  assert.ok(/import\s*\{[^}]*parseSessionItem[^}]*\}\s*from\s*['"].*session-client/.test(src),
    '必须从 session-client.js import parseSessionItem');

  // loadSessions 不得内联复制解析（双解析器违反唯一生产者——会漏字段、漂移）
  // 抓 loadSessions 函数体，断言它不含内联的字段提取（s['fullTokenCount']/s['compactToken']）
  const loadMatch = src.match(/async function loadSessions\(\)[\s\S]*?\n\}/);
  assert.ok(loadMatch, '应找到 loadSessions 函数');
  const loadBody = loadMatch![0];
  assert.ok(!loadBody.includes("s['fullTokenCount']") && !loadBody.includes("s['compactToken']"),
    'loadSessions 不得内联提取 token 字段（内联 = 双解析器，会漏 compactToken）');
  assert.ok(loadBody.includes('parseSessionItem('),
    'loadSessions 必须调用 parseSessionItem 解析');
});
