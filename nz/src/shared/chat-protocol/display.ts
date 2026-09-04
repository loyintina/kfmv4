/**
 * display.ts — 显示层投影规则（纯函数，reducer 数据不动）。
 *
 * reasoning 归位 R3（na 风险清单 R3 / kfmv4 陷阱 10，设计 §1.2）：
 *   - text 空且 reasoning 非空 → reasoning 归位为正文显示（relocated=true，
 *     显示层灰一档以示思考性质）；
 *   - text 非空 → 正文显示 text，reasoning 由调用方收进「思考」折叠区。
 * 归位只发生在显示层：reducer 的 block.text / block.reasoning 始终分字段存，
 * 本函数不修改传入 block。
 */

import type { TextBlock } from './messages.js';

export interface DisplayBody {
  /** 正文区应显示的文本（归位后）。 */
  text: string;
  /** 是否发生了归位（true = 显示的是思考链，应灰一档渲染）。 */
  relocated: boolean;
  /** text 非空时的思考链（折叠区内容）；归位时为空串（已并入正文）。 */
  reasoning: string;
}

export function displayBody(block: TextBlock): DisplayBody {
  const text = block.text || '';
  const reasoning = block.reasoning || '';
  if (text === '' && reasoning !== '') {
    return { text: reasoning, relocated: true, reasoning: '' };
  }
  return { text, relocated: false, reasoning };
}
