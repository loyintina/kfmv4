export function renderTextPreview(el: HTMLElement, content: string, fileName: string): void {
  el.style.flexDirection = 'column';
  el.style.overflowY = 'hidden';
  el.innerHTML = '';

  // 标题
  const header = document.createElement('div');
  header.style.cssText = 'padding:6px 0 4px;font-size:11px;font-weight:600;color:rgba(0,212,255,0.7);flex-shrink:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
  header.textContent = fileName;

  // 分隔线
  const line = document.createElement('div');
  const c1 = el.style.getPropertyValue('--card-accent1') || '#00d4ff';
  const c2 = el.style.getPropertyValue('--card-accent2') || '#7c3aed';
  line.style.cssText = 'height:1px;flex-shrink:0;background:linear-gradient(90deg,' + c1 + ',' + c2 + ')';

  // 正文区
  const body = document.createElement('div');
  body.style.cssText = 'flex:1;overflow-x:hidden;overflow-y:auto;padding:6px 0 0;font:11px monospace;white-space:pre-wrap;word-break:break-word;color:#e0e0e0';
  body.textContent = content || '\uFF08\u7A7A\u6587\u4EF6\uFF09';

  el.appendChild(header);
  el.appendChild(line);
  el.appendChild(body);
}
