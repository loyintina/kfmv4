import { test, group } from './runner.js';
import assert from 'assert';
import { applyFlexLayout } from '../src/client/engine/v2/flex.js';
import { findBoxById } from '../src/client/modules/canvas-utils.js';
import { Box } from '../src/client/engine/v2/box.js';

group('canvas-utils (pure)');

test('findBoxById finds direct child', () => {
  const root = new Box({ id: 'root' });
  const child = new Box({ id: 'target' });
  root.addChild(child);
  root.addChild(new Box({ id: 'other' }));
  assert(findBoxById(root, 'target') === child);
});

test('findBoxById finds nested grandchild', () => {
  const root = new Box({ id: 'root' });
  const parent = new Box({ id: 'mid' });
  const target = new Box({ id: 'deep' });
  parent.addChild(target);
  root.addChild(parent);
  assert(findBoxById(root, 'deep') === target);
});

test('findBoxById returns null for missing id', () => {
  const root = new Box({ id: 'root' });
  root.addChild(new Box({ id: 'a' }));
  assert(findBoxById(root, 'zzz') === null);
});

test('findBoxById empty tree returns null', () => {
  const root = new Box({ id: 'root' });
  assert(findBoxById(root, 'anything') === null);
});

group('flex');

test('row direction stacks children horizontally', () => {
  const parent = new Box({ id: 'flex', width: 300, height: 100, layout: { flexDirection: 'row' } });
  parent.addChild(new Box({ id: 'a', width: 50, height: 50 }));
  parent.addChild(new Box({ id: 'b', width: 70, height: 50 }));
  applyFlexLayout(parent);
  assert(parent.children[0].x === 0);
  assert(parent.children[1].x === 50); // after first child
  assert(parent.children[0].y === 0);
});

test('column direction stacks children vertically', () => {
  const parent = new Box({ id: 'flex', width: 300, height: 200, layout: { flexDirection: 'column' } });
  parent.addChild(new Box({ id: 'a', width: 100, height: 40, layoutItem: { flex: 0, minWidth: 0, minHeight: 0 } }));
  parent.addChild(new Box({ id: 'b', width: 100, height: 60, layoutItem: { flex: 0, minWidth: 0, minHeight: 0 } }));
  applyFlexLayout(parent);
  assert(parent.children[0].y === 0);
  assert(parent.children[1].y === 40);
});

test('gap adds spacing between children', () => {
  const parent = new Box({ id: 'flex', width: 300, height: 100, layout: { flexDirection: 'row', gap: 8 } });
  parent.addChild(new Box({ id: 'a', width: 50, height: 50 }));
  parent.addChild(new Box({ id: 'b', width: 50, height: 50 }));
  applyFlexLayout(parent);
  assert(parent.children[1].x === 58); // 50 + 8
});

test('justifyContent center centers children', () => {
  const parent = new Box({ id: 'flex', width: 300, height: 100, layout: { flexDirection: 'row', justifyContent: 'center' } });
  parent.addChild(new Box({ id: 'a', width: 50, height: 50 }));
  applyFlexLayout(parent);
  // total children width = 50, free space = 250, offset = 125
  assert(parent.children[0].x === 125);
});

test('flex grow distributes remaining space', () => {
  const parent = new Box({ id: 'flex', width: 200, height: 100, layout: { flexDirection: 'row' } });
  parent.addChild(new Box({ id: 'a', width: 0, height: 50, layoutItem: { flex: 1, minWidth: 0, minHeight: 0 } }));
  parent.addChild(new Box({ id: 'b', width: 0, height: 50, layoutItem: { flex: 2, minWidth: 0, minHeight: 0 } }));
  applyFlexLayout(parent);
  assert(parent.children[0].width > 0);
  assert(parent.children[1].width > 0);
  assert(parent.children[0].width + parent.children[1].width === 200);
  // flex 1 vs flex 2 should be roughly 1:2 ratio
  assert(Math.abs(parent.children[0].width * 2 - parent.children[1].width) < 5);
});
