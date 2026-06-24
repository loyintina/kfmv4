/**
 * code-highlight.ts — 代码块语法高亮 + 复制按钮 + 语言标签
 *
 * 用法：在 marked 渲染完成后调用 highlightAll(parent) 即可。
 */

import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import bash from 'highlight.js/lib/languages/bash';
import json from 'highlight.js/lib/languages/json';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import scss from 'highlight.js/lib/languages/scss';
import sql from 'highlight.js/lib/languages/sql';
import yaml from 'highlight.js/lib/languages/yaml';
import markdown from 'highlight.js/lib/languages/markdown';
import rust from 'highlight.js/lib/languages/rust';
import go from 'highlight.js/lib/languages/go';
import java from 'highlight.js/lib/languages/java';
import c from 'highlight.js/lib/languages/c';
import cpp from 'highlight.js/lib/languages/cpp';
import shell from 'highlight.js/lib/languages/shell';

hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('js', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('ts', typescript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('py', python);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('sh', bash);
hljs.registerLanguage('zsh', shell);
hljs.registerLanguage('json', json);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('css', css);
hljs.registerLanguage('scss', scss);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('yml', yaml);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('md', markdown);
hljs.registerLanguage('rust', rust);
hljs.registerLanguage('rs', rust);
hljs.registerLanguage('go', go);
hljs.registerLanguage('java', java);
hljs.registerLanguage('c', c);
hljs.registerLanguage('cpp', cpp);

const COPY_ICON = '\uD83D\uDCCB';
const CHECK_ICON = '\u2713';

function _getLangFromClass(el: HTMLElement): string {
  const cls = el.className || '';
  const m = cls.match(/language-(\w+)/);
  return m ? m[1] : '';
}

export function highlightAll(parent: HTMLElement): void {
  const blocks = parent.querySelectorAll<HTMLElement>('pre code');
  blocks.forEach(block => {
    const lang = _getLangFromClass(block);
    if (lang) {
      try { hljs.highlightElement(block as HTMLElement); } catch { /* 语言未注册则跳过 */ }
    }
    // 语言标签 + 复制按钮
    const pre = block.parentElement;
    if (!pre || pre.classList.contains('hljs-applied')) return;
    pre.classList.add('hljs-applied');
    pre.style.position = 'relative';

    // 语言标签
    if (lang) {
      const tag = document.createElement('span');
      tag.textContent = lang;
      tag.style.cssText = 'position:absolute;top:4px;left:10px;font-size:9px;text-transform:uppercase;color:rgba(0,212,255,0.45);pointer-events:none;font-family:system-ui,sans-serif';
      pre.appendChild(tag);
    }

    // 复制按钮
    const btn = document.createElement('button');
    btn.textContent = COPY_ICON;
    btn.style.cssText = 'position:absolute;top:4px;right:4px;font-size:11px;padding:2px 8px;border-radius:4px;cursor:pointer;border:1px solid rgba(255,255,255,0.12);background:rgba(0,0,0,0.35);color:rgba(255,255,255,0.55)';
    btn.addEventListener('click', () => {
      navigator.clipboard.writeText(block.textContent || '').catch(() => {});
      btn.textContent = CHECK_ICON;
      btn.style.color = 'rgba(74,222,128,0.9)';
      btn.style.borderColor = 'rgba(74,222,128,0.3)';
      setTimeout(() => {
        btn.textContent = COPY_ICON;
        btn.style.color = 'rgba(255,255,255,0.55)';
        btn.style.borderColor = 'rgba(255,255,255,0.12)';
      }, 2000);
    });
    pre.appendChild(btn);
  });
}
