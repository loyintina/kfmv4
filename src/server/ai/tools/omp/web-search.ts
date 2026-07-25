/**
 * omp/web-search.ts — 网页搜索工具（Bing，无需 API key）
 *
 * 通过 cn.bing.com 搜索，解析结果页面返回标题+链接+摘要。
 * 国内服务器可直连，无需代理。
 */
import type { KfmTool, ToolResult } from '../types.js';

const BING_URL = 'https://cn.bing.com/search';
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36';

function decodeHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/&#(\d+);/g, (_, c) => String.fromCharCode(Number(c)))
    .replace(/&#x([0-9a-f]+);/gi, (_, c) => String.fromCharCode(Number.parseInt(c, 16)))
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ').trim();
}

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

function parseBingResults(html: string): SearchResult[] {
  const results: SearchResult[] = [];
  // 每个结果在 <h2> 里有 <a href="url">title</a>，后面跟 <p>snippet</p>
  const h2Re = /<h2[^>]*>([\s\S]*?)<\/h2>/g;
  let match: RegExpExecArray | null;
  while ((match = h2Re.exec(html)) !== null) {
    const aMatch = /href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/.exec(match[1]);
    if (!aMatch) continue;
    const url = aMatch[1];
    const title = decodeHtml(aMatch[2]);
    if (!title || !url.startsWith('http')) continue;
    // 找 h2 后面的 <p> 作为摘要
    const rest = html.slice(match.index + match[0].length, match.index + match[0].length + 500);
    const pMatch = /<p[^>]*>([\s\S]*?)<\/p>/.exec(rest);
    const snippet = pMatch ? decodeHtml(pMatch[1]).slice(0, 200) : '';
    results.push({ title, url, snippet });
  }
  return results;
}

async function searchBing(query: string, numResults = 10): Promise<SearchResult[]> {
  const url = `${BING_URL}?q=${encodeURIComponent(query)}&count=${numResults}`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    },
    signal: AbortSignal.timeout(10_000),
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`Bing HTTP ${response.status}`);
  const parsed = parseBingResults(body);
  // 去重
  const seen = new Set<string>();
  const results: SearchResult[] = [];
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
  description: '搜索互联网内容。基于 Bing，无需 API key。',
  category: 'omp',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: '搜索关键词' },
      numResults: { type: 'number', description: '返回结果数量，默认 10' },
    },
    required: ['query'],
  },
  async execute(params): Promise<ToolResult> {
    const query = params.query as string;
    if (!query) return { content: [{ type: 'text', text: '缺少 query 参数' }], isError: true };
    try {
      const numResults = Math.min(Math.max(1, (params.numResults as number) || 10), 20);
      const results = await searchBing(query, numResults);
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
      return { content: [{ type: 'text', text: `搜索失败: ${e instanceof Error ? e.message : '未知错误'}` }], isError: true };
    }
  },
};
