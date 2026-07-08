/**
 * cards/types.ts — 卡片插件系统公开接口
 *
 * 全部类型重新导出自 card-registry.ts（单一事实来源）。
 * 插件开发者只需从这里 import，无需关心内部模块路径。
 *
 * 使用示例：
 *   import type { CardTypeDef, CardContentHandler } from '../types.js';
 */

export type {
  CardTypeDef,
  CardContentHandler,
  CardInstance,
} from '../modules/card-registry.js';
