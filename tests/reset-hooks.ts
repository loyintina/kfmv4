// ==========================================================================
// tests/reset-hooks.ts — 跨测试共享状态的隔离重置
//
// 导入本模块即注册 beforeEach 钩子（副作用）。任何用 reset:true 的测试
// （回归钉子默认开启）运行前，会依次重置这些全局单例，消除测试间污染。
//
// 设计见 docs/design/REGRESSION_TESTING_SYSTEM.md 步骤 0：
//   测试隔离 = 每个测试前重置 KFMState / cardRegistry / gestures。
// ==========================================================================

import { beforeEach } from './harness.js';
import { KFMState } from '../src/client/modules/state.js';
import { cardRegistry } from '../src/client/modules/card-registry.js';
import { gestures } from '../src/client/modules/gesture-registry.js';

// ---- KFMState：清文件系统 / 展开态 / 选中 / 视口 ----
beforeEach(() => {
  KFMState.files = {};
  KFMState.expandedPaths = {};
  KFMState.selectedFile = '';
  KFMState.showHidden = false;
  KFMState.sidebarOpen = false;
  KFMState.viewport = { scrollTop: 0, scrollLeft: 0 };
});

// ---- cardRegistry：销毁所有卡片实例，清焦点 ----
beforeEach(() => {
  for (const inst of cardRegistry.getAll()) {
    cardRegistry.destroyInstance(inst.instanceId);
  }
});

// ---- gestures：注销所有手势处理器 ----
// GestureRegistry 无公开的「清空全部」方法，逐个 unregister 已注册处理器。
beforeEach(() => {
  const g = gestures as unknown as { _handlers?: Array<{ id: string }> };
  if (Array.isArray(g._handlers)) {
    for (const h of [...g._handlers]) gestures.unregister(h.id);
  }
});
