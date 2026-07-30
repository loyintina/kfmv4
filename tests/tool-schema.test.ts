// ==========================================================================
// tests/tool-schema.test.ts — 工具 schema Gemini 兼容性回归钉子（BAR-PROVIDER-03）
//
// bug：gemini-3.1-pro（聚光端点）面板发消息 400——
//   `tools[0].function_declarations[10].properties[todos].items: missing field`
// todo 工具的 todos 参数声明了 type:'array' 却没有 items。OpenAI 系端点
// 宽松容忍缺省 items，Gemini function_declarations 严格校验直接拒收整次请求
// （不是单工具不可用，是整轮对话 400）。
//
// 契约：所有注册工具的 parameters schema 中，任何 type:'array' 的节点
// 必须带 items（递归检查 properties/items 嵌套层）。
//
// revert 验证：本钉子先于修复验证——把 todo.ts 的 items 删掉即红。
// ==========================================================================

import assert from 'assert';
import { group, regression } from './runner.js';
import { getAllTools } from '../src/server/ai/tools/index.js';

group('tools — schema Gemini 兼容（BAR-PROVIDER-03）');

// 递归收集 schema 中所有 type:'array' 且缺 items 的节点路径
function findArraysWithoutItems(node: unknown, path: string, out: string[]): void {
  if (!node || typeof node !== 'object') return;
  const obj = node as Record<string, unknown>;
  if (obj.type === 'array' && !obj.items) out.push(path || '(root)');
  for (const [key, value] of Object.entries(obj)) {
    if (value && typeof value === 'object') {
      findArraysWithoutItems(value, path ? `${path}.${key}` : key, out);
    }
  }
}

regression('BAR-PROVIDER-03', 'tool-schema-items', '所有工具 schema 的 array 节点必须带 items（Gemini 硬性要求）', () => {
  const tools = getAllTools();
  assert.ok(tools.length > 0, '工具注册表为空');
  const violations: string[] = [];
  for (const tool of tools) {
    const found: string[] = [];
    findArraysWithoutItems(tool.parameters, '', found);
    for (const p of found) violations.push(`${tool.name}:${p}`);
  }
  assert.deepStrictEqual(violations, [], `以下 array 参数缺 items（Gemini 会 400 拒收整次请求）: ${violations.join(', ')}`);
});

regression('BAR-PROVIDER-03', 'todo-items-shape', 'todo 的 items 描述任务项结构（content 必填）', () => {
  const todo = getAllTools().find(t => t.name === 'todo');
  assert.ok(todo, 'todo 工具未注册');
  const todos = (todo.parameters as { properties?: { todos?: { items?: { required?: string[] } } } })
    .properties?.todos?.items;
  assert.ok(todos, 'todo.todos 缺 items');
  assert.ok(todos.required?.includes('content'), 'todo items.required 应含 content');
});
