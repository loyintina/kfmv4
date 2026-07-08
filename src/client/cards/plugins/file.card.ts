/**
 * file.card.ts — 文件卡片
 *
 * 由左侧栏右滑文件行触发的临时卡片，显示文件内容预览。
 * 注册为 'file' 类型，由树形列表的滑动操作创建。
 */

import { registerCardType, getCardType } from '../../modules/card-registry.js';
import { createFileHandler } from '../../modules/renderers/handler-factory.js';

registerCardType({
  typeId: 'file',
  icon: '',
  name: '',
  description: '\u6587\u4EF6\u5361\u7247',
  kind: 'file',
  createHandler: (meta) => createFileHandler(meta),
});
