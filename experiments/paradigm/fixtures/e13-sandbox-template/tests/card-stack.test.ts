import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CardStack } from '../src/client/card-stack.ts';

test('召唤卡片进堆', () => {
  const stack = new CardStack();
  assert.equal(stack.summon('收件箱'), null);
  assert.equal(stack.list().length, 1);
  assert.equal(stack.list()[0].title, '收件箱');
});

test('解散整张卡片堆', () => {
  const stack = new CardStack();
  stack.summon('甲');
  stack.summon('乙');
  stack.dismissAll();
  assert.equal(stack.list().length, 0);
});
