import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_TREE_DEPTH, MAX_STACK_CARDS, SIDEBAR_WIDTH } from '../src/config/limits.ts';

// 不变量约束（不断言具体取值——配置调整不应炸测试）
test('限制配置为正整数', () => {
  assert.ok(Number.isInteger(MAX_TREE_DEPTH) && MAX_TREE_DEPTH > 0);
  assert.ok(Number.isInteger(MAX_STACK_CARDS) && MAX_STACK_CARDS > 0);
  assert.ok(Number.isInteger(SIDEBAR_WIDTH) && SIDEBAR_WIDTH > 0);
});

test('树深度不超过物理上限 16 层', () => {
  assert.ok(MAX_TREE_DEPTH <= 16);
});
