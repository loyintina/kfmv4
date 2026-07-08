/**
 * tmux.card.ts — tmux 窗口管理卡（04 号卡片）
 *
 * 连接到 tmux 会话的终端管理界面。
 * 注册为 'card04' 类型，显示在卡片堆中。
 */

import { registerCardType } from '../../modules/card-registry.js';
import { createTmuxCardHandler } from '../../modules/tmux-card.js';

registerCardType({
  typeId: 'card04',
  icon: '\u25A3',
  name: 'tmux',
  description: 'tmux\u7A97\u53E3\u7BA1\u7406',
  kind: 'tool',
  createHandler: () => createTmuxCardHandler(),
});
