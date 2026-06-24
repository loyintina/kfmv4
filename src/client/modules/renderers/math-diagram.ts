/**
 * math-diagram.ts — KaTeX 数学公式 + Mermaid 图表渲染
 *
 * 用法：
 *   const data: MathData = { display: [], inline: [] };
 *   const md = preprocessMath(rawMd, data);  // 预处理：提取公式，插占位符
 *   // ... marked.parse(md) ...
 *   await renderMath(el, data);              // 后处理：渲染 KaTeX
 *   await renderMermaid(el);                 // 后处理：渲染 Mermaid
 */

export interface MathData {
  display: string[];
  inline: string[];
}

/** 预处理：提取数学公式，替换为占位 HTML 元素 */
export function preprocessMath(md: string, data: MathData): string {
  // 保护代码块（避免匹配到代码块内的 $）
  const codeBlocks: string[] = [];
  let result = md.replace(/```[\s\S]*?```/g, (match) => {
    codeBlocks.push(match);
    return '\x00CODE' + (codeBlocks.length - 1) + '\x00';
  });

  // $$...$$ 显示公式
  result = result.replace(/(?<!\\)\$\$([\s\S]+?)(?<!\\)\$\$/g, (_, expr) => {
    data.display.push(expr.trim());
    return '<div class="katex-display" data-katex="' + (data.display.length - 1) + '"></div>';
  });

  // $...$ 行内公式
  result = result.replace(/(?<!\\)\$([^$\n]+?)(?<!\\)\$/g, (_, expr) => {
    data.inline.push(expr.trim());
    return '<span class="katex-inline" data-katex="' + (data.inline.length - 1) + '"></span>';
  });

  // 还原代码块
  for (let i = codeBlocks.length - 1; i >= 0; i--) {
    result = result.replace('\x00CODE' + i + '\x00', codeBlocks[i]);
  }

  return result;
}

let _katexReady = false;

/** 渲染 KaTeX 公式到占位元素 */
export async function renderMath(el: HTMLElement, data: MathData): Promise<void> {
  if (data.display.length === 0 && data.inline.length === 0) return;

  try {
    const katex = (await import('katex')).default;
    _katexReady = true;

    // 显示公式
    for (const div of el.querySelectorAll<HTMLElement>('.katex-display')) {
      const idx = parseInt(div.dataset.katex || '');
      if (isNaN(idx) || !data.display[idx]) continue;
      try {
        div.innerHTML = katex.renderToString(data.display[idx], { displayMode: true, throwOnError: false });
      } catch { div.textContent = data.display[idx]; }
    }

    // 行内公式
    for (const span of el.querySelectorAll<HTMLElement>('.katex-inline')) {
      const idx = parseInt(span.dataset.katex || '');
      if (isNaN(idx) || !data.inline[idx]) continue;
      try {
        span.innerHTML = katex.renderToString(data.inline[idx], { displayMode: false, throwOnError: false });
      } catch { span.textContent = data.inline[idx]; }
    }
  } catch { /* KaTeX 加载失败，原样显示 */ }
}

let _mermaidReady = false;

/** 渲染 Mermaid 图表：找到 language-mermaid 代码块，替换为 SVG */
export async function renderMermaid(el: HTMLElement): Promise<void> {
  const blocks = el.querySelectorAll<HTMLPreElement>('pre:has(code[class*="language-mermaid"])');
  if (blocks.length === 0) return;

  try {
    const mod = await import('mermaid');
    const mermaid = mod.default || mod;
    if (!_mermaidReady) {
      mermaid.initialize({ startOnLoad: false, theme: 'dark' });
      _mermaidReady = true;
    }

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
      } catch { /* 单图渲染失败，保留原代码块 */ }
    }
  } catch { /* Mermaid 加载失败，保留原代码块 */ }
}
