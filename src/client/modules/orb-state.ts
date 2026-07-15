/**
 * orb-state.ts — orb 状态机纯逻辑（零依赖，可脱离浏览器测试）
 *
 * 从 orb.ts 拆分出类型定义和状态转换函数。
 * orb.ts 导入本文件，本文件不导入任何项目模块。
 */

export type OrbState = 'collapsed' | 'expanded' | 'editing';

/** 纯状态转换 — 不涉及 DOM/GSAP/Registry */
export function nextOrbState(current: OrbState, action: 'toggle' | 'longPress' | 'release'): OrbState {
  if (action === 'longPress' && current === 'expanded') return 'editing';
  if (action === 'release' && current === 'editing') return 'expanded';
  if (action === 'toggle') return current === 'collapsed' ? 'expanded' : 'collapsed';
  return current;
}
