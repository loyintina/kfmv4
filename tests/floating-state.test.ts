/**
 * tests/floating-state.test.ts — floating-card 状态机纯逻辑测试
 */

import { nextFloatingCardState } from '../src/client/modules/floating-shared.js';
import { test, group } from './runner.js';

group('floating-card state machine');

// launch → active
test('launching + launchComplete → active', () => {
  if (nextFloatingCardState('launching', 'launchComplete') !== 'active') throw new Error('expected active');
});

// expand/collapse cycle
test('compact + expand → expanding', () => {
  if (nextFloatingCardState('compact', 'expand') !== 'expanding') throw new Error('expected expanding');
});
test('expanding + expandComplete → active', () => {
  if (nextFloatingCardState('expanding', 'expandComplete') !== 'active') throw new Error('expected active');
});
test('active + collapse → collapsing', () => {
  if (nextFloatingCardState('active', 'collapse') !== 'collapsing') throw new Error('expected collapsing');
});
test('collapsing + collapseComplete → compact', () => {
  if (nextFloatingCardState('collapsing', 'collapseComplete') !== 'compact') throw new Error('expected compact');
});

// edit cycle
test('active + longPress → editing', () => {
  if (nextFloatingCardState('active', 'longPress') !== 'editing') throw new Error('expected editing');
});
test('compact + longPress → compact (no-op)', () => {
  if (nextFloatingCardState('compact', 'longPress') !== 'compact') throw new Error('expected compact');
});
test('editing + release → active', () => {
  if (nextFloatingCardState('editing', 'release') !== 'active') throw new Error('expected active');
});

// fullscreen
test('active + enterFullscreen → fullscreen', () => {
  if (nextFloatingCardState('active', 'enterFullscreen') !== 'fullscreen') throw new Error('expected fullscreen');
});
test('fullscreen + exitFullscreen → active', () => {
  if (nextFloatingCardState('fullscreen', 'exitFullscreen') !== 'active') throw new Error('expected active');
});
test('editing + enterFullscreen → editing (no-op)', () => {
  if (nextFloatingCardState('editing', 'enterFullscreen') !== 'editing') throw new Error('expected editing');
});

// dismiss
test('active + dismiss → dismissing', () => {
  if (nextFloatingCardState('active', 'dismiss') !== 'dismissing') throw new Error('expected dismissing');
});
test('dismissing + dismiss → dismissing (idempotent)', () => {
  if (nextFloatingCardState('dismissing', 'dismiss') !== 'dismissing') throw new Error('expected dismissing');
});

// no-ops
test('collapsing + expand → collapsing (no-op)', () => {
  if (nextFloatingCardState('collapsing', 'expand') !== 'collapsing') throw new Error('expected collapsing');
});
test('unknown action → no-op', () => {
  if (nextFloatingCardState('active', 'unknown' as any) !== 'active') throw new Error('expected active');
});
