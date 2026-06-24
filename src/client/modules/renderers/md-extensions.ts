/**
 * md-extensions.ts — marked 自定义扩展 + 预处理
 *
 * 为 KFM 浮卡内的 md 预览提供 Obsidian 风格支持：
 *   - callout（[!info] [!warning] [!danger] [!todo]）
 *   - 高亮文本（==text== → <mark>）
 *   - 任务列表（- [ ] / - [x] — marked GFM 原生支持）
 *   - wikilinks（[[path]] → 样式化文本）
 *   - 代码 token 着色（CSS-only 关键字/字符串/注释）
 */

import { type MathData, preprocessMath } from './math-diagram.js';

/** Obsidian callout 预处理：> [!type] ... → 样式化 div */
function _preprocessCallouts(md: string): string {
  // 匹配形如: > [!info] Title\n> Content (Content 以 > 开头或结束于空行)
  return md.replace(/^>\s*\[!(\w+)\]\s*(.*?)\n((?:>.*\n?)*)/gm, (_, type, title, body) => {
    const icons: Record<string, string> = { info: '\u2139\uFE0F', warning: '\u26A0\uFE0F', danger: '\u274C', todo: '\u2705', note: '\uD83D\uDCDD', tip: '\uD83D\uDCA1', question: '\u2753', success: '\u2705', failure: '\u274C', example: '\uD83D\uDCCB' };
    const icon = icons[type.toLowerCase()] || '';
    const titleText = title.trim() || type.charAt(0).toUpperCase() + type.slice(1);
    const contentLines = body.replace(/^>\s?/gm, '').trim();
    return '<div class="callout callout-' + type.toLowerCase() + '"><div class="callout-header">' + icon + ' <strong>' + titleText + '</strong></div><div class="callout-body">\n' + contentLines + '\n</div></div>\n\n';
  });
}

/** 高亮预处理：==text== → <mark>text</mark> */
function _preprocessHighlight(md: string): string {
  return md.replace(/==(.+?)==/g, '<mark>$1</mark>');
}

/** wikilink 预处理：[[path]] 或 [[path|label]] → 样式化 span */
function _preprocessWikilinks(md: string): string {
  return md.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, path, label) => {
    const display = label || path.replace(/\\/g, '/').split('/').pop() || path;
    return '<span class="wikilink">' + display + '</span>';
  });
}

/** 综合预处理：math → callout → highlight → wikilinks */
export function preprocessMd(md: string, mathData?: MathData): string {
  let result = md;
  if (mathData) result = preprocessMath(result, mathData);
  result = _preprocessCallouts(result);
  result = _preprocessHighlight(result);
  result = _preprocessWikilinks(result);
  return result;
}
