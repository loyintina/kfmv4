/** 侧栏固定（pin）逻辑：侧栏钉住时按层级缩进偏移。 */

/** 钉住面板在第 level 层时的水平偏移（px），每层 8px */
export function sidebarPinOffset(level: number): number {
  return level * 8;
}
