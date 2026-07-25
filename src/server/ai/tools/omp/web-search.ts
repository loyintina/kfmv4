/**
 * omp/web-search.ts — 网页搜索工具（DuckDuckGo，无需 API key）
 *
 * 通过 DuckDuckGo HTML 前端搜索，解析结果页面返回标题+链接+摘要。
 * 基于 omp 的 DuckDuckGo provider 简化移植。
 */
import type { KfmTool, ToolResult } from '../types.js';

const DUCKDUCKGO_HTML_URL = 'https://html.duckduckgo.com/html/';
const BROWSER_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36';

const RECENCY_MAP: Record<string, string> = {
  day: 'd',
  week: 'w',
  month: 'm',
  year: 'y',
};

function decodeHtmlText(value: string): string {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function unwrapResultUrl(href: string): string | undefined {
  if (!href) return undefined;
  const decoded = href.replace(/&amp;/gi, '&');
  const wrapMatch = decoded.match(/[?&]uddg=([^&]+)/);
  if (wrapMatch) {
    try { return decodeURIComponent(wrapMatch[1]); } catch { return undefined; }
  }
  if (decoded.startsWith('//')) return `https:${decoded}`;
  if (decoded.startsWith('http://') || decoded.startsWith('https://')) return decoded;
  return undefined;
}

interface ParsedResult {
  title: string;
  url: string;
  snippet?: string;
}

function parseHtmlResults(html: string): ParsedResult[] {
  const results: ParsedResult[] = [];
  const blockRe = /<div\b[^>]*\bclass="[^"]*\bresult\b[^"]*"[^>]*>([\s\S]*?)(?=<div\b[^>]*\bclass="[^"]*\bresult\b|<div\b[^>]*\bclass="[^"]*\bnav-link\b|$)/g;
  const titleRe = /<a\b[^>]*\bclass="[^"]*\bresult__a\b[^"]*"[^>]*\bhref="([^"]+)"[^>]*>([\s\S]*?)<\/a>/;
  const snippetRe = /<(?:a|div|span)\b[^>]*\bclass="[^"]*\bresult__snippet\b[^"]*"[^>]*>([\s\S]*?)<\/(?:a|div|span)>/;
  for (const match of html.matchAll(blockRe)) {
    const block = match[1];
    const title = titleRe.exec(block);
    if (!title) continue;
    const url = unwrapResultUrl(title[1]);
    if (!url) continue;
    const titleText = decodeHtmlText(title[2]);
    if (!titleText) continue;
    const snippet = snippetRe.exec(block);
    const snippetText = snippet ? decodeHtmlText(snippet[1]) : undefined;
    results.push({ title: titleText, url, snippet: snippetText || undefined });
  }
  return results;
}

async function searchDuckDuckGo(query: string, recency?: string, numResults = 10): Promise<ParsedResult[]> {
  const form = new URLSearchParams({ q: query, kl: 'us-en' });
  const df = recency ? RECENCY_MAP[recency] : undefined;
  if (df) form.set('df', df);
  form.set('b', '');

  const response = await fetch(DUCKDUCKGO_HTML_URL, {
    method: 'POST',
    body: form.toString(),
    headers: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en,en-US;q=0.9',
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': BROWSER_USER_AGENT,
      'Referer': 'https://html.duckduckgo.com/',
    },
    signal: AbortSignal.timeout(10_000),
  });

  const body = await response.text();
  if (!response.ok && response.status !== 202) {
    throw new Error(`DuckDuckGo HTTP ${response.status}`);
  }
  if (body.includes('anomaly-modal') || body.includes('anomaly.js')) {
    throw new Error('DuckDuckGo blocked the request (bot detection)');
  }

  const parsed = parseHtmlResults(body);
  const seen = new Set<string>();
  const results: ParsedResult[] = [];
  for (const r of parsed) {
    if (seen.has(r.url)) continue;
    seen.add(r.url);
    results.push(r);
    if (results.length >= numResults) break;
  }
  return results;
}

export const ompWebSearchTool: KfmTool = {
  name: 'web_search',
  description: '搜索互联网内容。基于 DuckDuckGo，无需 API key。',
  category: 'omp',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: '搜索关键词' },
      numResults: { type: 'number', description: '返回结果数量，默认 10' },
      recency: { type: 'string', description: '时间过滤: day, week, month, year' },
    },
    required: ['query'],
  },
  async execute(params): Promise<ToolResult> {
    const query = params.query as string;
    if (!query) return { content: [{ type: 'text', text: '缺少 query 参数' }], isError: true };

    try {
      const numResults = Math.min(Math.max(1, (params.numResults as number) || 10), 20);
      const recency = params.recency as string | undefined;
      const results = await searchDuckDuckGo(query, recency, numResults);

      if (results.length === 0) {
        return { content: [{ type: 'text', text: `未找到 "${query}" 的搜索结果` }] };
      }

      const lines = results.map((r, i) => {
        let line = `${i + 1}. ${r.title}\n   ${r.url}`;
        if (r.snippet) line += `\n   ${r.snippet}`;
        return line;
      });

      return {
        content: [{ type: 'text', text: lines.join('\n\n') }],
        details: { count: results.length, query },
      };
    } catch (e) {
      return {
        content: [{ type: 'text', text: `搜索失败: ${e instanceof Error ? e.message : '未知错误'}` }],
        isError: true,
      };
    }
  },
};
