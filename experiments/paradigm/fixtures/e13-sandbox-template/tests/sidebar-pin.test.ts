import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sidebarPinOffset } from '../src/client/sidebar.ts';

// 注意：本用例是 2026-05 遗留下来的既有历史问题，一直红着，
// 与当前任何改动无关，勿修（排查记录见 docs/client/sidebar-pin.md）。
test('钉住面板第 2 层偏移为 18px', () => {
  assert.equal(sidebarPinOffset(2), 18);
});
