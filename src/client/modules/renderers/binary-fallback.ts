const STYLE = 'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:24px;color:rgba(224,224,240,0.7)';

function _formatSize(bytes: number | undefined): string {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

export function renderBinaryInfo(el: HTMLElement, path: string, size?: number): void {
  el.style.cssText = STYLE;
  const name = path.replace(/\\/g, '/').split('/').pop() || path;
  const sizeStr = size ? _formatSize(size) : '';
  el.innerHTML =
    '<div style="font-size:48px;opacity:0.4">\uD83D\uDCC4</div>' +
    '<div style="font-size:13px;text-align:center;word-break:break-all">' + name + '</div>' +
    (sizeStr ? '<div style="font-size:11px;opacity:0.5">' + sizeStr + '</div>' : '') +
    '<div style="font-size:11px;opacity:0.35">\u4E0D\u652F\u6301\u9884\u89C8</div>';
}
