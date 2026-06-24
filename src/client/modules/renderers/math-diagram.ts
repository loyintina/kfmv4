/**
 * math-diagram.ts — KaTeX 数学公式 + Mermaid 图表渲染
 *
 * 两个库通过 CDN <script> 动态加载（不进 esbuild bundle）。
 *
 * 用法：
 *   const data: MathData = { display: [], inline: [] };
 *   const md = preprocessMath(rawMd, data);
 *   // ... marked.parse(md) ...
 *   await renderMath(el, data);
 *   await renderMermaid(el, accent);
 */

export interface MathData {
  display: string[];
  inline: string[];
}

function _loadScript(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = url;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('script load failed: ' + url));
    document.head.appendChild(s);
  });
}

// ========== 预处理 ==========

export function preprocessMath(md: string, data: MathData): string {
  const codeBlocks: string[] = [];
  let result = md.replace(/```[\s\S]*?```/g, (match) => {
    codeBlocks.push(match);
    return '\x00CODE' + (codeBlocks.length - 1) + '\x00';
  });

  result = result.replace(/(?<!\\)\$\$([\s\S]+?)(?<!\\)\$\$/g, (_, expr) => {
    data.display.push(expr.trim());
    return '<div class="katex-display" data-katex="' + (data.display.length - 1) + '"></div>';
  });

  result = result.replace(/(?<!\\)\$([^$\n]+?)(?<!\\)\$/g, (_, expr) => {
    data.inline.push(expr.trim());
    return '<span class="katex-inline" data-katex="' + (data.inline.length - 1) + '"></span>';
  });

  for (let i = codeBlocks.length - 1; i >= 0; i--) {
    result = result.replace('\x00CODE' + i + '\x00', codeBlocks[i]);
  }
  return result;
}

// ========== KaTeX ==========

let _katexLoaded = false;
const KATEX_CDN = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js';

export async function renderMath(el: HTMLElement, data: MathData): Promise<void> {
  if (data.display.length === 0 && data.inline.length === 0) return;

  try {
    if (!_katexLoaded) {
      await _loadScript(KATEX_CDN);
      _katexLoaded = true;
    }
    const katex = (window as any).katex;
    if (!katex) return;

    for (const div of el.querySelectorAll<HTMLElement>('.katex-display')) {
      const idx = parseInt(div.dataset.katex || '');
      if (isNaN(idx) || !data.display[idx]) continue;
      try {
        div.innerHTML = katex.renderToString(data.display[idx], { displayMode: true, throwOnError: false });
      } catch { div.textContent = data.display[idx]; }
    }

    for (const span of el.querySelectorAll<HTMLElement>('.katex-inline')) {
      const idx = parseInt(span.dataset.katex || '');
      if (isNaN(idx) || !data.inline[idx]) continue;
      try {
        span.innerHTML = katex.renderToString(data.inline[idx], { displayMode: false, throwOnError: false });
      } catch { span.textContent = data.inline[idx]; }
    }
  } catch { /* KaTeX 加载失败，原样显示 */ }
}

// ========== Mermaid ==========

let _mermaidLoaded = false;
const MERMAID_CDN = 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js';

export async function renderMermaid(el: HTMLElement, accent: string): Promise<void> {
  const blocks = el.querySelectorAll<HTMLPreElement>('pre:has(code[class*="language-mermaid"])');
  if (blocks.length === 0) return;

  try {
    if (!_mermaidLoaded) {
      await _loadScript(MERMAID_CDN);
      _mermaidLoaded = true;
    }
    const mermaid = (window as any).mermaid;
    if (!mermaid) return;

    // accent hex → RGB → 生成多级透明度变体
    const h = accent.replace('#', '');
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    const ac = (a: number) => 'rgba(' + r + ',' + g + ',' + b + ',' + a.toFixed(2) + ')';

    mermaid.initialize({
      startOnLoad: false,
      theme: 'base',
      themeVariables: {
        background:           'transparent',
        mainBkg:              ac(0.08),
        secondBkg:            ac(0.12),
        tertiaryBkg:          ac(0.05),
        primaryColor:         accent,
        secondaryColor:       ac(0.15),
        tertiaryColor:        ac(0.10),
        primaryTextColor:     '#ffffff',
        secondaryTextColor:   '#e0e0e0',
        tertiaryTextColor:    '#c0c0c0',
        primaryBorderColor:   ac(0.40),
        secondaryBorderColor: ac(0.25),
        tertiaryBorderColor:  ac(0.15),
        nodeBorder:           ac(0.40),
        nodeTextColor:        '#ffffff',
        lineColor:            accent,
        signalColor:          accent,
        edgeLabelBackground:  ac(0.15),
        fontSize:             '12px',
        fontFamily:           'system-ui, sans-serif',
      },
    });

    let id = 0;
    for (const pre of blocks) {
      const code = pre.querySelector('code');
      const text = code?.textContent || '';
      try {
        const { svg } = await mermaid.render('mermaid-' + (id++), text);
        const div = document.createElement('div');
        div.className = 'mermaid-container';
        div.innerHTML = svg;
        pre.replaceWith(div);
      } catch { /* 单图渲染失败 */ }
    }
  } catch { /* Mermaid 加载失败 */ }
}
