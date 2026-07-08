/**
 * terminal.card.ts — 终端卡（03 号卡片）
 *
 * xterm.js 集成终端，支持全屏、双指缩放、滚动手势。
 * 注册为 'card03' 类型，显示在卡片堆中。
 */

import { registerCardType } from '../../modules/card-registry.js';
import { createTerminal04Handler } from '../../modules/terminal-card-04.js';

registerCardType({
  typeId: 'card03',
  icon: '>',
  name: '\u7EC8\u7AEF',
  description: '',
  kind: 'tool',
  createHandler: createTerminal04Handler,
});
