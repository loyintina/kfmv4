const STYLE = 'font:11px monospace;white-space:pre-wrap;word-break:break-word;padding:8px;overflow-y:auto;color:#e0e0e0';

export function renderTextPreview(el: HTMLElement, content: string): void {
  el.style.cssText = STYLE;
  el.textContent = content || '\uFF08\u7A7A\u6587\u4EF6\uFF09';
}
