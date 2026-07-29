/**
 * orb-state.ts — orb 状态类型定义（零依赖，可脱离浏览器测试）
 *
 * 从 orb.ts 拆分出类型定义。
 * orb.ts 导入本文件，本文件不导入任何项目模块。
 */

export type OrbState = 'collapsed' | 'expanded' | 'editing';
