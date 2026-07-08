import { test, group } from './runner.js';
import { Box } from '../src/client/engine/v2/box.js';
import { DEFAULT_BOX_STYLE, PRESETS, resolveStyle, getCornerAction, getNeighbor, type BoxStyle } from '../src/client/engine/v2/StyleConfig.js';
import { Renderer } from '../src/client/engine/v2/renderer.js';
import { applyFlexLayout } from '../src/client/engine/v2/flex.js';
import assert from 'assert';

group('StyleConfig');

test('DEFAULT_BOX_STYLE is immutable shape', () => {
  assert(typeof DEFAULT_BOX_STYLE.borderWidth === 'number');
  assert(DEFAULT_BOX_STYLE.background === 'glass');
  assert(DEFAULT_BOX_STYLE.border.left === 'emphasis');
});

test('resolveStyle default preset returns DEFAULT_BOX_STYLE', () => {
  const s = resolveStyle('default');
  assert(s.borderWidth === DEFAULT_BOX_STYLE.borderWidth);
  assert(s.background === DEFAULT_BOX_STYLE.background);
});

test('resolveStyle nonexistent preset falls back to DEFAULT', () => {
  const s = resolveStyle('nonexistent-template');
  assert(s.borderWidth === DEFAULT_BOX_STYLE.borderWidth);
});

test('resolveStyle all-emphasis preset overrides border', () => {
  const s = resolveStyle('all-emphasis');
  assert(s.border.top === 'emphasis');
  assert(s.border.bottom === 'emphasis');
  assert(s.border.left === 'emphasis');
  assert(s.border.right === 'emphasis');
});

test('resolveStyle with overrides merges correctly', () => {
  const s = resolveStyle('default', { borderWidth: 5, background: 'solid', backgroundFill: '#fff' });
  assert(s.borderWidth === 5);
  assert(s.background === 'solid');
  assert(s.backgroundFill === '#fff');
  // untouched fields keep defaults
  assert(s.cornerRadius === DEFAULT_BOX_STYLE.cornerRadius);
});

test('resolveStyle override border partial merge', () => {
  const s = resolveStyle('all-emphasis', { border: { top: 'hidden', left: 'hidden' } });
  assert(s.border.top === 'hidden');
  assert(s.border.left === 'hidden');
  assert(s.border.bottom === 'emphasis');  // not overridden
  assert(s.border.right === 'emphasis');   // not overridden
});

test('PRESETS has expected entries', () => {
  assert('all-emphasis' in PRESETS);
  assert('all-hidden' in PRESETS);
  assert('left-emphasis-rest-hidden' in PRESETS);
  assert('left-bottom-normal' in PRESETS);
  assert('bottom-right-normal' in PRESETS);
  assert('left-right-emphasis' in PRESETS);
  assert('default' in PRESETS);
});

test('getCornerAction hidden-hidden gives none', () => {
  const a = getCornerAction('hidden', 'hidden');
  assert(a.type === 'none');
});

test('getCornerAction emphasis-emphasis gives gradient-merge', () => {
  const a = getCornerAction('emphasis', 'emphasis');
  assert(a.type === 'gradient-merge');
});

test('getCornerAction normal-normal gives small-corner', () => {
  const a = getCornerAction('normal', 'normal');
  assert(a.type === 'small-corner');
});

test('getCornerAction emphasis-hidden gives taper-to-zero', () => {
  const a = getCornerAction('emphasis', 'hidden');
  assert(a.type === 'taper-to-zero');
});

test('getNeighbor returns clockwise sides', () => {
  const border = { top: 'hidden' as const, right: 'hidden' as const, bottom: 'hidden' as const, left: 'hidden' as const };
  assert(getNeighbor(border, 'top', 'start') === 'left');
  assert(getNeighbor(border, 'top', 'end') === 'right');
  assert(getNeighbor(border, 'right', 'start') === 'top');
  assert(getNeighbor(border, 'right', 'end') === 'bottom');
  assert(getNeighbor(border, 'bottom', 'start') === 'right');
  assert(getNeighbor(border, 'bottom', 'end') === 'left');
  assert(getNeighbor(border, 'left', 'start') === 'bottom');
  assert(getNeighbor(border, 'left', 'end') === 'top');
});

group('Renderer');

/** 创建测试用的 Canvas 元素 */
function makeTestCanvas(width = 800, height = 600): HTMLCanvasElement {
  const c = document.createElement('canvas') as HTMLCanvasElement;
  c.width = width;
  c.height = height;
  // Mock 的 clientWidth/clientHeight 读取 style.width/height
  c.style.width = width + 'px';
  c.style.height = height + 'px';
  c.clientWidth = width;
  c.clientHeight = height;
  c.offsetWidth = width;
  c.offsetHeight = height;
  return c;
}

test('constructor creates Renderer with canvas', () => {
  const canvas = makeTestCanvas(400, 300);
  const r = new Renderer(canvas, { backgroundColor: '#0a0a0f' });
  assert(r.canvas === canvas, 'canvas reference should match');
  assert(r.ctx !== null, 'should have 2d context');
  assert(r.width === 400, `width should be 400, got ${r.width}`);
  assert(r.height === 300, `height should be 300, got ${r.height}`);
  assert(r.backgroundColor === '#0a0a0f', 'backgroundColor should match');
});

test('setRoot/getRoot round-trips a Box tree', () => {
  const canvas = makeTestCanvas();
  const r = new Renderer(canvas);
  const root = new Box({ id: 'root', width: 800, height: 600 });
  const child = new Box({ id: 'child', x: 10, y: 20, width: 100, height: 50 });
  root.addChild(child);
  r.setRoot(root);
  assert(r.getRoot() === root, 'getRoot should return the same root');
  assert(r.getRoot()?.find(b => b.id === 'child') === child, 'should find child via root');
});

test('setOverlayRoot does not affect main root', () => {
  const canvas = makeTestCanvas();
  const r = new Renderer(canvas);
  const mainRoot = new Box({ id: 'main', width: 800, height: 600 });
  const overlayRoot = new Box({ id: 'overlay', width: 800, height: 600 });
  mainRoot.addChild(new Box({ id: 'main-child' }));
  overlayRoot.addChild(new Box({ id: 'overlay-child' }));
  r.setRoot(mainRoot);
  r.setOverlayRoot(overlayRoot);
  assert(r.getRoot()?.find(b => b.id === 'main-child') !== null, 'main tree should have main-child');
  assert(r.getRoot()?.find(b => b.id === 'overlay-child') === null, 'main tree should NOT have overlay-child');
  assert(overlayRoot.find(b => b.id === 'overlay-child') !== null, 'overlay tree should have overlay-child');
});

test('hitTest returns correct box at coordinates', () => {
  const canvas = makeTestCanvas();
  const r = new Renderer(canvas);
  const root = new Box({ id: 'root', width: 800, height: 600, interactive: true });
  const target = new Box({ id: 'target', x: 100, y: 50, width: 200, height: 80, interactive: true });
  root.addChild(target);
  r.setRoot(root);
  // 命中
  const hit1 = r.hitTest(150, 70);
  assert(hit1 === target, `should hit target at (150,70), got ${hit1?.id}`);
  // 未命中（x 超出 target 范围）
  const hit2 = r.hitTest(50, 70);
  assert(hit2 === null || hit2?.id === 'root', `should NOT hit target at (50,70), got ${hit2?.id}`);
  // 未命中（y 超出 target 范围）
  const hit3 = r.hitTest(150, 200);
  assert(hit3 === null || hit3?.id === 'root', `should NOT hit target at (150,200), got ${hit3?.id}`);
});

test('hitTest returns interactive boxes only', () => {
  const canvas = makeTestCanvas();
  const r = new Renderer(canvas);
  const root = new Box({ id: 'root', width: 800, height: 600, interactive: true });
  const nonInteractive = new Box({ id: 'non-int', x: 10, y: 10, width: 100, height: 50, interactive: false });
  const interactive = new Box({ id: 'int', x: 10, y: 10, width: 100, height: 50, interactive: true });
  root.addChild(nonInteractive);
  root.addChild(interactive);
  r.setRoot(root);
  const hit = r.hitTest(30, 30);
  assert(hit === interactive, `should hit interactive box, got ${hit?.id}`);
});

test('hitTest respects visible and opacity', () => {
  const canvas = makeTestCanvas();
  const r = new Renderer(canvas);
  const root = new Box({ id: 'root', width: 800, height: 600, interactive: true });
  const visibleBox = new Box({ id: 'visible', x: 10, y: 10, width: 100, height: 50, visible: true, interactive: true });
  const invisibleBox = new Box({ id: 'invisible', x: 10, y: 10, width: 100, height: 50, visible: false, interactive: true });
  root.addChild(visibleBox);
  root.addChild(invisibleBox);
  r.setRoot(root);
  const hit = r.hitTest(30, 30);
  assert(hit === visibleBox, `should hit visible box, got ${hit?.id}`);
});

test('stop cleans up animation frame', () => {
  const canvas = makeTestCanvas();
  const r = new Renderer(canvas);
  r.setRoot(new Box({ id: 'root', interactive: true }));
  r.stop(); // 未 start 时 stop 是安全 no-op
  assert(r.isRunning === false, 'should not be running');
});

test('setRoot with null clears root', () => {
  const canvas = makeTestCanvas();
  const r = new Renderer(canvas);
  r.setRoot(new Box({ id: 'tmp' }));
  assert(r.getRoot() !== null, 'root should exist');
  r.setRoot(null);
  assert(r.getRoot() === null, 'root should be null after setRoot(null)');
});

test('multiple resize calls are safe', () => {
  const canvas = makeTestCanvas();
  const r = new Renderer(canvas);
  r.resize();
  r.resize();
  r.resize(); // should not throw
  assert(r.width > 0, 'width should remain valid');
});
