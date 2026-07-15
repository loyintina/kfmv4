/**
 * tests/orb-state.test.ts — orb 状态机纯逻辑测试
 */

import { nextOrbState } from '../src/client/modules/orb-state.js';
import { test, group } from './runner.js';

group('orb state machine');

test('collapsed + toggle → expanded', () => {
  if (nextOrbState('collapsed', 'toggle') !== 'expanded') throw new Error('expected expanded');
});

test('expanded + toggle → collapsed', () => {
  if (nextOrbState('expanded', 'toggle') !== 'collapsed') throw new Error('expected collapsed');
});

test('editing + toggle → collapsed', () => {
  if (nextOrbState('editing', 'toggle') !== 'collapsed') throw new Error('expected collapsed');
});

test('expanded + longPress → editing', () => {
  if (nextOrbState('expanded', 'longPress') !== 'editing') throw new Error('expected editing');
});

test('collapsed + longPress → collapsed (no-op)', () => {
  if (nextOrbState('collapsed', 'longPress') !== 'collapsed') throw new Error('expected collapsed');
});

test('editing + release → expanded', () => {
  if (nextOrbState('editing', 'release') !== 'expanded') throw new Error('expected expanded');
});

test('expanded + release → expanded (no-op)', () => {
  if (nextOrbState('expanded', 'release') !== 'expanded') throw new Error('expected expanded');
});

test('unknown action → no-op', () => {
  if (nextOrbState('expanded', 'unknown' as any) !== 'expanded') throw new Error('expected expanded');
});
