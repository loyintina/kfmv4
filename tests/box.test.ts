import { test, group } from './runner.js';
import { Box } from '../src/client/engine/v2/box.js';
import assert from 'assert';

group('Box core');

test('default construction', () => {
  const b = new Box();
  assert.strictEqual(b.type, 'container');
  assert.strictEqual(b.x, 0);
  assert.strictEqual(b.y, 0);
  assert.strictEqual(b.width, 100);
  assert.strictEqual(b.height, 40);
  assert.strictEqual(b.visible, true);
  assert.strictEqual(b.opacity, 1);
  assert.strictEqual(b.interactive, false);
  assert.strictEqual(b.disabled, false);
  assert.strictEqual(b.children.length, 0);
  assert.strictEqual(b.parent, null);
  assert.ok(b.id.startsWith('box_'));
});

test('construction with options', () => {
  const b = new Box({ id: 'test1', x: 10, y: 20, width: 200, height: 80, type: 'button' });
  assert.strictEqual(b.id, 'test1');
  assert.strictEqual(b.x, 10);
  assert.strictEqual(b.y, 20);
  assert.strictEqual(b.width, 200);
  assert.strictEqual(b.height, 80);
  assert.strictEqual(b.type, 'button');
  assert.strictEqual(b.interactive, true); // button defaults to interactive
});

test('padding and margin defaults to zero', () => {
  const b = new Box();
  assert.strictEqual(b.padding.top, 0);
  assert.strictEqual(b.padding.right, 0);
  assert.strictEqual(b.padding.bottom, 0);
  assert.strictEqual(b.padding.left, 0);
  assert.strictEqual(b.margin.top, 0);
  assert.strictEqual(b.margin.right, 0);
  assert.strictEqual(b.margin.bottom, 0);
  assert.strictEqual(b.margin.left, 0);
});

test('contentRect accounts for padding', () => {
  const b = new Box({ width: 200, height: 100, padding: { top: 10, right: 15, bottom: 10, left: 15 } });
  const cr = b.contentRect;
  assert.strictEqual(cr.x, 15);
  assert.strictEqual(cr.y, 10);
  assert.strictEqual(cr.width, 170);
  assert.strictEqual(cr.height, 80);
});

group('Box tree');

test('addChild sets parent and appends', () => {
  const parent = new Box({ id: 'p' });
  const child = new Box({ id: 'c' });
  parent.addChild(child);
  assert.strictEqual(child.parent, parent);
  assert.strictEqual(parent.children.length, 1);
  assert.strictEqual(parent.children[0], child);
});

test('addChild returns this for chaining', () => {
  const parent = new Box({ id: 'p' });
  const child = new Box({ id: 'c' });
  const ret = parent.addChild(child);
  assert.strictEqual(ret, parent);
});

test('removeChild clears parent', () => {
  const parent = new Box({ id: 'p' });
  const child = new Box({ id: 'c' });
  parent.addChild(child);
  parent.removeChild(child);
  assert.strictEqual(child.parent, null);
  assert.strictEqual(parent.children.length, 0);
});

test('removeChild on non-child is no-op', () => {
  const parent = new Box({ id: 'p' });
  const child = new Box({ id: 'c' });
  parent.removeChild(child); // should not throw
  assert.strictEqual(parent.children.length, 0);
});

test('find deep first match', () => {
  const root = new Box({ id: 'root' });
  const a = new Box({ id: 'a' }); root.addChild(a);
  const b = new Box({ id: 'b' }); a.addChild(b);
  const c = new Box({ id: 'c' }); b.addChild(c);
  const found = root.find(box => box.id === 'c');
  assert.strictEqual(found, c);
});

test('find returns null when no match', () => {
  const root = new Box({ id: 'root' });
  const a = new Box({ id: 'a' }); root.addChild(a);
  assert.strictEqual(root.find(box => box.id === 'z'), null);
});

test('find matches root itself', () => {
  const root = new Box({ id: 'root' });
  assert.strictEqual(root.find(box => box.id === 'root'), root);
});

test('flatten collects all descendants', () => {
  const root = new Box({ id: 'r' });
  const a = new Box({ id: 'a' }); root.addChild(a);
  const b = new Box({ id: 'b' }); root.addChild(b);
  const ba = new Box({ id: 'ba' }); b.addChild(ba);
  const flat = root.flatten();
  assert.strictEqual(flat.length, 4);
  assert.deepStrictEqual(flat.map(n => n.id), ['r', 'a', 'b', 'ba']);
});

test('children via constructor set parent', () => {
  const child = new Box({ id: 'c' });
  const parent = new Box({ id: 'p', children: [child] });
  assert.strictEqual(child.parent, parent);
  assert.strictEqual(parent.children.length, 1);
});

group('Box geometry');
test('getAbsolutePosition reflects parent chain offsets', () => {
  const parent = new Box({ x: 100, y: 50, padding: { top: 10, left: 20 } });
  const child = new Box({ x: 5, y: 5 });
  parent.addChild(child);
  const pos = child.getAbsolutePosition();
  assert.strictEqual(pos.x, 125); // 100 + 20 + 5
  assert.strictEqual(pos.y, 65);  // 50 + 10 + 5
});

test('getBounds includes transform', () => {
  const b = new Box({ x: 10, y: 20, width: 100, height: 50 });
  b.transform.scale = 2;
  b.transform.translateX = 5;
  b.transform.translateY = 3;
  const bounds = b.getBounds();
  assert.strictEqual(bounds.x, 15);
  assert.strictEqual(bounds.y, 23);
  assert.strictEqual(bounds.width, 200);
  assert.strictEqual(bounds.height, 100);
});

test('containsPoint inside bounds', () => {
  const b = new Box({ x: 0, y: 0, width: 100, height: 100 });
  assert.ok(b.containsPoint(50, 50));
  assert.ok(!b.containsPoint(101, 50));
  assert.ok(!b.containsPoint(50, -1));
});

group('Box events');

test('on registers handler, emit calls it', () => {
  const b = new Box({ id: 'e' });
  let called = false;
  b.on('click', (data) => { called = true; assert.strictEqual(data.box, b); });
  b.emit('click', 10, 20);
  assert.ok(called);
});

test('off removes handler', () => {
  const b = new Box({ id: 'e' });
  let count = 0;
  const fn = () => { count++; };
  b.on('click', fn);
  b.off('click');
  b.emit('click', 0, 0);
  assert.strictEqual(count, 0);
});

test('emit unknown event does nothing', () => {
  const b = new Box({ id: 'e' });
  // Should not throw
  b.emit('click', 0, 0);
});

group('Box state');

test('setState changes state', () => {
  const b = new Box();
  assert.strictEqual(b.state, 'normal');
  b.setState('hover');
  assert.strictEqual(b.state, 'hover');
});

test('setState no-op when same state', () => {
  const b = new Box();
  b.setState('normal'); // should not change
  assert.strictEqual(b.state, 'normal');
});

test('getStateStyle returns state styles', () => {
  const b = new Box({
    stateStyles: {
      hover: { backgroundColor: '#fff' },
      normal: { backgroundColor: '#000' },
    },
  });
  b.setState('hover');
  assert.deepStrictEqual(b.getStateStyle(), { backgroundColor: '#fff' });
});

group('Box serialize');

test('serialize round-trips core fields', () => {
  const a = new Box({ id: 'ser1', x: 5, y: 10, width: 150, height: 60, type: 'list-item', visible: false, opacity: 0.5 });
  const s = a.serialize();
  assert.strictEqual(s.id, 'ser1');
  assert.strictEqual(s.x, 5);
  assert.strictEqual(s.y, 10);
  assert.strictEqual(s.width, 150);
  assert.strictEqual(s.height, 60);
  assert.strictEqual(s.type, 'list-item');
  assert.strictEqual(s.visible, false);
  assert.strictEqual(s.opacity, 0.5);
});

test('clone produces independent tree', () => {
  const root = new Box({ id: 'r' });
  root.addChild(new Box({ id: 'a' }));
  root.addChild(new Box({ id: 'b' }));

  const clone = root.clone();
  // clone regenerates all IDs (serialize then id: undefined)
  assert.ok(clone.id.startsWith('box_'));
  // Tree structure preserved: 2 children, correct parent links
  assert.strictEqual(clone.children.length, 2);
  assert.strictEqual(clone.children[0].parent, clone);
  assert.strictEqual(clone.children[1].parent, clone);
  // Children are independent copies (different references)
  assert.notStrictEqual(clone.children[0], root.children[0]);
  assert.notStrictEqual(clone.children[1], root.children[1]);
  // clone modifies do not affect original
  clone.children[0].x = 999;
  assert.strictEqual(root.children[0].x, 0);
});

group('Box animation');

test('tickAnimations progresses properties', () => {
  const b = new Box({ width: 100 });
  const t0 = performance.now();
  b.animate('width', 200, 100, 'linear');
  const active = b.tickAnimations(t0 + 50);
  assert.ok(active);
  // Tick uses startTime from animate(), which may drift ±1ms from t0
  assert.ok(b.width > 140 && b.width < 160, `width=${b.width} not ~150`);
});

test('tickAnimations completes at duration', () => {
  const b = new Box({ opacity: 1 });
  const t0 = performance.now();
  b.animate('opacity', 0, 100, 'linear');
  // Use 10x duration to guarantee we're past it
  const active = b.tickAnimations(t0 + 1000);
  assert.ok(!active);
  assert.strictEqual(b.opacity, 0);
});

test('tickAnimations calls onComplete', () => {
  const b = new Box({ width: 100 });
  const t0 = performance.now();
  let done = false;
  b.animate('width', 200, 100, 'linear', () => { done = true; });
  b.tickAnimations(t0 + 1000);
  assert.ok(done);
});

test('tickAnimations cascades to children', () => {
  const parent = new Box({ width: 100 });
  const child = new Box({ width: 50 });
  parent.addChild(child);
  const t0 = performance.now();
  child.animate('width', 100, 100, 'linear');
  parent.tickAnimations(t0 + 50);
  assert.ok(child.width > 45 && child.width < 80, `child.width=${child.width} not ~75`);
});

group('Box scroll');

test('getContentSize for empty container', () => {
  const b = new Box({ width: 200, height: 100 });
  const cs = b.getContentSize();
  assert.strictEqual(cs.width, 0);
  assert.strictEqual(cs.height, 0);
});

test('getContentSize from children', () => {
  const b = new Box();
  b.addChild(new Box({ x: 0, y: 0, width: 150, height: 50 }));
  b.addChild(new Box({ x: 0, y: 60, width: 100, height: 40 }));
  const cs = b.getContentSize();
  assert.strictEqual(cs.width, 150);
  assert.strictEqual(cs.height, 100);
});

test('clampScroll clamps to content bounds', () => {
  const b = new Box({ width: 100, height: 100, scrollable: true, scrollDirection: 'vertical' });
  b.addChild(new Box({ x: 0, y: 0, width: 100, height: 300 }));
  b.scrollY = 500; // beyond max
  b.clampScroll();
  // maxY = 300 - 100 = 200
  assert.strictEqual(b.scrollY, 200);
});
