/**
 * readable.ts — HTML → 可读文本提取
 *
 * 简化版，不依赖 @mozilla/readability 或 linkedom。
 * 使用 regex 基础的 HTML tag 剥离 + 结构化提取。
 * 对 AI 消费足够用。
 */

export type ReadableFormat = 'text' | 'markdown';

export interface ReadableResult {
  url: string;
  title?: string;
  byline?: string;
  excerpt?: string;
  contentLength: number;
  text?: string;
  markdown?: string;
}

/** Trim to non-empty string or undefined. */
function normalize(text: string | null | undefined): string | undefined {
  const trimmed = text?.trim();
  return trimmed || undefined;
}

/**
 * 基础 HTML → 文本转换：strip tags，保留结构。
 */
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<h[1-6][^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/** 从 HTML 中提取 title */
function extractTitle(html: string): string | undefined {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? normalize(m[1]) : undefined;
}

/** 从 HTML 中提取 <meta name="description"> */
function extractDescription(html: string): string | undefined {
  const m = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([\s\S]*?)["']/i);
  return m ? normalize(m[1]) : undefined;
}

/** 从 HTML 中提取主要文本内容（跳过 script/style/nav） */
function extractMainContent(html: string): string {
  // 尝试找 <article> 或 <main> 内容
  const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  if (articleMatch) return htmlToText(articleMatch[1]);

  const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  if (mainMatch) return htmlToText(mainMatch[1]);

  // 回退：提取 <body> 内容
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) return htmlToText(bodyMatch[1]);

  // 最后回退：全文 strip
  return htmlToText(html);
}

/**
 * 从原始 HTML 提取可读内容。
 * 简化实现，不依赖 Readability/linkedom。
 */
export function extractReadableFromHtml(
  html: string,
  url: string,
  format: ReadableFormat,
): ReadableResult | null {
  const title = extractTitle(html);
  const description = extractDescription(html);
  const mainText = extractMainContent(html);

  if (!mainText || mainText.length < 50) return null;

  const text = mainText;
  const contentLength = text.length;
  const excerpt = description ?? text.slice(0, 240);

  if (format === 'markdown') {
    // 简单的 markdown：保留基本结构
    const markdown = text
      .replace(/\n\n+/g, '\n\n')
      .trim();
    return { url, title, excerpt, contentLength, markdown };
  }

  return { url, title, excerpt, contentLength, text };
}
