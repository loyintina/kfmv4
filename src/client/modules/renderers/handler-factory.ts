import { getFileCategory } from './file-type.js';
import { renderBinaryInfo } from './binary-fallback.js';
import { preprocessMd } from './md-extensions.js';
import { highlightAll } from './code-highlight.js';
import { type MathData, renderMath, renderMermaid } from './math-diagram.js';
import { KATEX_CSS } from './katex-css.js';
import { API } from '../state.js';

function _fileName(p: string): string {
  return p.replace(/\\/g, '/').split('/').pop() || p;
}

function _toRgba(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
}

function _btnStyle(accent: string): string {
  return 'font-size:10px;padding:2px 8px;border-radius:6px;cursor:pointer;border:1px solid ' + _toRgba(accent, 0.3) + ';background:transparent;color:rgba(255,255,255,0.75);transition:all 0.15s';
}

function _btnActive(accent: string): string {
  return 'background:' + _toRgba(accent, 0.15) + ';color:rgba(255,255,255,0.95);border-color:' + _toRgba(accent, 0.5);
}

export function createFileHandler(filePath: string, accent?: string): { activate: (el: HTMLElement) => void; deactivate: (el: HTMLElement) => void } {
  const _accent = accent || '#00d4ff';
  const name = _fileName(filePath);
  const cat = getFileCategory(filePath);
  const editable = cat === 'text' || cat === 'code' || cat === 'markdown';
  let _rawContent = '';
  let _mode: 'preview' | 'edit' = 'preview';
  let _scrollRatio = 0;
  let _header: HTMLElement;
  let _previewBtn: HTMLElement | null = null;
  let _editBtn: HTMLElement | null = null;
  let _body: HTMLElement;
  let _saveBtn: HTMLElement | null = null;

  function _renderToolbar() {
    if (!_previewBtn || !_editBtn) return;
    if (_mode === 'preview') {
      _previewBtn.style.cssText = _btnStyle(_accent) + _btnActive(_accent);
      _editBtn.style.cssText = _btnStyle(_accent);
    } else {
      _previewBtn.style.cssText = _btnStyle(_accent);
      _editBtn.style.cssText = _btnStyle(_accent) + _btnActive(_accent);
    }
  }

  const _mdCSS = [
    '.md-body{font-size:13px;line-height:1.7;color:#e0e0e0;padding:6px 0;overflow-wrap:break-word;overflow-x:auto}',
    '.md-body h1,.md-body h2,.md-body h3{margin:14px 0 4px;font-weight:600}',
    '.md-body h1{font-size:15px}.md-body h2{font-size:13px}.md-body h3{font-size:12px}',
    '.md-body h4,.md-body h5,.md-body h6{font-size:11px;margin:8px 0 2px;font-weight:600}',
    '.md-body p{margin:4px 0}',
    '.md-body ul,.md-body ol{padding-left:20px;margin:4px 0;list-style-position:outside}',
    '.md-body ul{list-style-type:disc}.md-body ul ul{list-style-type:circle}.md-body ul ul ul{list-style-type:square}',
    '.md-body ol{list-style-type:decimal}.md-body ol ol{list-style-type:lower-alpha}',
    '.md-body li{margin:2px 0}',
    '.md-body li::marker{color:var(--card-accent)}',
    '.md-body input[type=checkbox]{-webkit-appearance:none;appearance:none;width:14px;height:14px;border:2px solid var(--card-accent);border-radius:3px;vertical-align:middle;margin-right:6px;cursor:pointer;transition:all 0.15s;position:relative;top:2px;pointer-events:auto}',
    '.md-body input[type=checkbox]:checked{background:var(--card-accent);background-image:url("data:image/svg+xml,%3Csvg viewBox=%270 0 12 12%27 xmlns=%27http://www.w3.org/2000/svg%27%3E%3Cpath d=%27M2 6l3 3 5-5%27 stroke=%27white%27 stroke-width=%272%27 fill=%27none%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27/%3E%3C/svg%3E");background-size:10px;background-position:center;background-repeat:no-repeat}',
    '.md-body blockquote{border-left:2px solid rgba(0,212,255,0.3);padding:4px 10px;margin:8px 0;opacity:0.88;background:rgba(0,212,255,0.04);border-radius:0 4px 4px 0}',
    '.md-body hr{border:none;border-top:1px solid var(--card-accent);margin:14px 0}',
    '.md-body table{border-collapse:collapse;width:100%;margin:8px 0;font-size:11px;overflow-x:auto;display:block}',
    '.md-body thead,.md-body tbody{display:table;width:100%}',
    '.md-body th,.md-body td{border:1px solid rgba(255,255,255,0.15);padding:4px 8px;text-align:left}',
    '.md-body th{background:rgba(0,212,255,0.1);font-weight:600;border-bottom-width:2px}',
    '.md-body tr:nth-child(even){background:rgba(255,255,255,0.03)}',
    '.md-body code{background:rgba(0,0,0,0.25);padding:1px 5px;border-radius:4px;font-size:10px;font-family:monospace}',
    '.md-body pre{padding:24px 10px 8px;background:rgba(0,0,0,0.28);border-radius:6px;overflow-x:auto;margin:8px 0;font-size:10px;line-height:1.5;border:1px solid rgba(255,255,255,0.06)}',
    '.md-body pre code{background:none;padding:0;border-radius:0;font-size:10px}',
    '.md-body a{color:rgba(0,212,255,0.85);text-decoration:none}',
    '.md-body img{max-width:100%;border-radius:6px}',
    '.md-body mark{background:rgba(255,235,59,0.25);color:#fff;padding:0 2px;border-radius:2px}',
    '.md-body .wikilink{color:rgba(0,212,255,0.75);font-weight:500;text-decoration:underline;text-decoration-style:dotted;text-underline-offset:3px}',
    '.callout{border-radius:6px;padding:6px 12px;margin:8px 0;font-size:12px;line-height:1.6}',
    '.callout-header{font-size:12px;font-weight:600;margin-bottom:2px}',
    '.callout-body{font-size:11px;opacity:0.9}',
    '.callout-info{background:rgba(0,212,255,0.08);border:1px solid rgba(0,212,255,0.2)}.callout-info .callout-header{color:rgba(0,212,255,0.85)}',
    '.callout-warning{background:rgba(255,193,7,0.08);border:1px solid rgba(255,193,7,0.2)}.callout-warning .callout-header{color:rgba(255,193,7,0.85)}',
    '.callout-danger{background:rgba(244,67,54,0.08);border:1px solid rgba(244,67,54,0.2)}.callout-danger .callout-header{color:rgba(244,67,54,0.85)}',
    '.callout-todo{background:rgba(156,39,176,0.08);border:1px solid rgba(156,39,176,0.2)}.callout-todo .callout-header{color:rgba(156,39,176,0.85)}',
    '.callout-note{background:rgba(76,175,80,0.08);border:1px solid rgba(76,175,80,0.2)}.callout-note .callout-header{color:rgba(76,175,80,0.85)}',
    '.callout-tip{background:rgba(0,188,212,0.08);border:1px solid rgba(0,188,212,0.2)}.callout-tip .callout-header{color:rgba(0,188,212,0.85)}',
    '.callout-question{background:rgba(255,152,0,0.08);border:1px solid rgba(255,152,0,0.2)}.callout-question .callout-header{color:rgba(255,152,0,0.85)}',
    '.callout-success{background:rgba(76,175,80,0.08);border:1px solid rgba(76,175,80,0.2)}.callout-success .callout-header{color:rgba(76,175,80,0.85)}',
    KATEX_CSS,
    '.mermaid-container{display:flex;justify-content:center;margin:12px 0;overflow-x:auto}.mermaid-container svg{max-width:100%}',
    '.mermaid-container svg .label{color:#e0e0e0!important}.mermaid-container svg .edgeLabel{background:rgba(10,10,15,0.85)!important}',
    '.hljs-keyword{color:#c792ea}.hljs-string{color:#ecc48d}.hljs-comment{color:#546e7a;font-style:italic}.hljs-number{color:#f78c6c}.hljs-title{color:#82aaff}.hljs-type{color:#ffcb6b}.hljs-attr{color:#c792ea}.hljs-built_in{color:#ffcb6b}.hljs-literal{color:#f78c6c}.hljs-function .hljs-title{color:#82aaff}.hljs-params{color:#a6accd}.hljs-meta{color:#89ddff}.hljs-tag{color:#f07178}.hljs-name{color:#f07178}.hljs-attribute{color:#c792ea}.hljs-selector-class{color:#ffcb6b}.hljs-selector-tag{color:#f07178}.hljs-addition{color:#c3e88d}.hljs-deletion{color:#f07178}',
  ].join('');

  function _renderPreview() {
    if (cat === 'markdown') {
      _body.innerHTML = '';
      const style = document.createElement('style');
      style.textContent = _mdCSS;
      _body.appendChild(style);

      import('marked').then(async m => {
        const mathData: MathData = { display: [], inline: [] };
        const processed = preprocessMd(_rawContent, mathData);
        const html = m.marked.parse(processed, { gfm: true, breaks: true }) as string;
        _body.style.setProperty('--card-accent', _toRgba(_accent, 0.7));
        const mdDiv = document.createElement('div');
        mdDiv.className = 'md-body';
        mdDiv.innerHTML = html;
        _body.appendChild(mdDiv);
        // 代码高亮 + 复制按钮
        highlightAll(mdDiv);
        // KaTeX 数学公式 + Mermaid 图表
        await renderMath(mdDiv, mathData);
        await renderMermaid(mdDiv, _accent);
        // 复选框点击交互
        const cbs = mdDiv.querySelectorAll<HTMLInputElement>('input[type=checkbox]');
        cbs.forEach(cb => {
          cb.removeAttribute('disabled');
          cb.addEventListener('click', () => {
            const checked = cb.checked;
            // 同步到 _rawContent：- [ ] ↔ - [x]
            const idx = Array.from(cbs).indexOf(cb);
            let n = 0;
            _rawContent = _rawContent.replace(/^(\s*-\s+)\[([ xX])\]/gm, (m, prefix) => {
              if (n === idx) { n++; return prefix + '[' + (checked ? 'x' : ' ') + ']'; }
              n++; return m;
            });
            _doSave(_rawContent);
          });
        });
        // 滚动同步
        if (_scrollRatio > 0) {
          _body.scrollTop = _scrollRatio * (_body.scrollHeight - _body.clientHeight);
        }
      });
    } else if (cat === 'image') {
      _body.innerHTML = '';
      const div = document.createElement('div');
      div.style.cssText = 'display:flex;align-items:center;justify-content:center;width:100%;height:100%;overflow:auto';
      const img = document.createElement('img');
      img.src = API + '/files/media?path=' + encodeURIComponent(filePath);
      img.style.cssText = 'max-width:100%;max-height:100%;object-fit:contain;border-radius:6px';
      img.alt = name;
      div.appendChild(img);
      _body.appendChild(div);
    } else {
      _body.innerHTML = '';
      const pre = document.createElement('pre');
      pre.style.cssText = 'margin:0;padding:6px 0 0;font:11px monospace;white-space:pre-wrap;word-break:break-word;color:#e0e0e0';
      pre.textContent = _rawContent || '\uFF08\u7A7A\u6587\u4EF6\uFF09';
      _body.appendChild(pre);
    }
  }

  function _renderEdit() {
    if (cat === 'image') {
      _body.innerHTML = '';
      const div = document.createElement('div');
      div.style.cssText = 'display:flex;align-items:center;justify-content:center;width:100%;height:100%;overflow:auto';
      const img = document.createElement('img');
      img.src = API + '/files/media?path=' + encodeURIComponent(filePath);
      img.style.cssText = 'max-width:100%;max-height:100%;object-fit:contain;border-radius:6px';
      img.alt = name;
      div.appendChild(img);
      _body.appendChild(div);
      return;
    }
    _body.innerHTML = '';
    const ta = document.createElement('textarea');
    ta.style.cssText = 'position:absolute;inset:0;padding:6px 0 0;font:11px monospace;white-space:pre-wrap;word-break:break-word;color:#e0e0e0;background:transparent;border:none;outline:none;resize:none';
    ta.value = _rawContent;
    // ctrl+enter 保存
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        _doSave(ta.value);
      }
    });
    _body.appendChild(ta);
    const pos = Math.round(_rawContent.length * Math.min(_scrollRatio, 1));
    ta.focus();
    ta.setSelectionRange(pos, pos);
  }

  async function _doSave(newContent: string) {
    try {
      await fetch(API + '/files/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath, content: newContent }),
      });
      _rawContent = newContent;
    } catch { /* swallow */ }
    _mode = 'preview';
    _renderToolbar();
    _renderPreview();
  }

  return {
    async activate(contentEl: HTMLElement) {
      contentEl.innerHTML = '';

      // wrapper：独立 flex column，不受浮卡 contentEl 的 cssText 覆盖
      const wrap = document.createElement('div');
      wrap.style.cssText = 'position:absolute;inset:0;display:flex;flex-direction:column;padding:0 10px';

      // 标题栏
      _header = document.createElement('div');
      _header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:6px 0 4px;flex-shrink:0';

      const label = document.createElement('div');
      label.style.cssText = 'font-size:11px;font-weight:600;color:rgba(255,255,255,0.85);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0';
      label.textContent = name;
      _header.appendChild(label);

      if (editable) {
        const btnWrap = document.createElement('div');
        btnWrap.style.cssText = 'display:flex;gap:6px;flex-shrink:0;margin-left:8px';

        _previewBtn = document.createElement('button');
        _previewBtn.textContent = '\u9884\u89C8';
        _previewBtn.style.cssText = _btnStyle(_accent) + _btnActive(_accent);
        _previewBtn.addEventListener('click', () => {
          if (_mode === 'preview') return;
          // 保存编辑区滚动位置
          const ta = _body.firstElementChild;
          if (ta?.tagName === 'TEXTAREA') {
            _scrollRatio = ta.scrollTop / Math.max(1, ta.scrollHeight - ta.clientHeight);
          }
          _mode = 'preview';
          _renderToolbar();
          _renderPreview();
        });

        _editBtn = document.createElement('button');
        _editBtn.textContent = '\u7F16\u8F91';
        _editBtn.style.cssText = _btnStyle(_accent);
        _editBtn.addEventListener('click', () => {
          if (_mode === 'edit') return;
          const sh = _body.scrollHeight - _body.clientHeight;
          _scrollRatio = sh > 0 ? _body.scrollTop / sh : 0;
          _mode = 'edit';
          _renderToolbar();
          _renderEdit();
        });

        btnWrap.appendChild(_previewBtn);
        btnWrap.appendChild(_editBtn);
        _header.appendChild(btnWrap);
      }

      // 分隔线
      const line = document.createElement('div');
      const lc1 = contentEl.dataset.cardAccent1!;
      const lc2 = contentEl.dataset.cardAccent2!;
      line.style.cssText = 'height:1px;flex-shrink:0;background:linear-gradient(90deg,' + lc1 + ',' + lc2 + ')';

      // 正文区
      _body = document.createElement('div');
      _body.style.cssText = 'flex:1;overflow:auto;position:relative';

      wrap.appendChild(_header);
      wrap.appendChild(line);
      wrap.appendChild(_body);
      contentEl.appendChild(wrap);

      // 读文件内容
      try {
        const res = await fetch(API + '/files/read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: filePath }),
        });
        const data = await res.json();
        if (data.content !== undefined && data.content !== null) {
          _rawContent = data.content;
          _renderPreview();
        } else {
          renderBinaryInfo(contentEl, filePath, data.size);
        }
      } catch {
        renderBinaryInfo(contentEl, filePath);
      }
    },
    deactivate(el: HTMLElement) {
      el.innerHTML = '';
    },
  };
}
