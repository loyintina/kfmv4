/**
 * KFM v4 — 交互常量共享层
 * 
 * 所有交互模块共享的基础常量。修改一处，全局同步。
 * 添加新常量时请确认语义在两个使用者中一致。
 */

/** 屏幕边缘安全距离 */
export const MARGIN = 8;

/** 长按进入编辑模式的触发时长 (ms) */
export const LONG_PRESS_MS = 600;

/** 拖动激活的最小像素位移 */
export const DRAG_THRESHOLD = 5;

/** 浮卡展开态宽度 */
export const FLOATING_CARD_W = 240;
/** 浮卡展开态高度 (5:6 比例) */
export const FLOATING_CARD_H = 288;
