/**
 * cards/registry.ts — 卡片插件注册中心
 *
 * 导入所有 plugins/*.card.ts 文件。
 * 每个文件在 import 时通过 registerCardType() 自注册。
 *
 * 加新卡：在 plugins/ 下新建 *.card.ts 文件，
 * 导出 createHandler 并调用 registerCardType()，
 * 然后在这里加一行 import。
 */

import './plugins/debug.card.js';
import './plugins/terminal.card.js';
import './plugins/tmux.card.js';
import './plugins/file.card.js';
import './plugins/api.card.js';
import './plugins/session.card.js';
import './plugins/config.card.js';
import './plugins/paradigm.card.js';
import './plugins/role.card.js';
import './plugins/tools.card.js';
