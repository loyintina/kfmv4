function _formatSize(bytes: number | undefined): string {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

export function renderBinaryInfo(el: HTMLElement, path: string, size?: number): void {
  el.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:absolute;inset:0;display:flex;flex-direction:column;padding:0 10px';

  const name = path.replace(/\\/g, '/').split('/').pop() || path;

  const header = document.createElement('div');
  header.style.cssText = 'padding:6px 0 4px;font-size:11px;font-weight:600;color:rgba(255,255,255,0.85);flex-shrink:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
  header.textContent = name;

  const line = document.createElement('div');
  line.style.cssText = 'height:1px;flex-shrink:0;background:linear-gradient(90deg,rgba(0,212,255,0.4),rgba(124,58,237,0.3))';

  const body = document.createElement('div');
  body.style.cssText = 'flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:20px;color:rgba(224,224,240,0.7)';
  body.innerHTML =
    '<div style="font-size:48px;opacity:0.4">\uD83D\uDCC4</div>' +
    '<div style="font-size:13px;text-align:center;word-break:break-all">' + name + '</div>' +
    (size ? '<div style="font-size:11px;opacity:0.5">' + _formatSize(size) + '</div>' : '') +
    '<div style="font-size:11px;opacity:0.35">\u4E0D\u652F\u6301\u9884\u89C8</div>';

  wrap.appendChild(header);
  wrap.appendChild(line);
  wrap.appendChild(body);
  el.appendChild(wrap);
}
