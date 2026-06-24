import { getFileCategory } from './file-type.js';
import { renderBinaryInfo } from './binary-fallback.js';
import { API } from '../state.js';

function _fileName(p: string): string {
  return p.replace(/\\/g, '/').split('/').pop() || p;
}

const BTN_STYLE = 'font-size:10px;padding:2px 8px;border-radius:6px;cursor:pointer;border:1px solid rgba(0,212,255,0.2);background:transparent;color:rgba(0,212,255,0.55);transition:all 0.15s';
const BTN_ACTIVE = 'background:rgba(0,212,255,0.15);color:rgba(0,212,255,0.9);border-color:rgba(0,212,255,0.5)';

export function createFileHandler(filePath: string): { activate: (el: HTMLElement) => void; deactivate: (el: HTMLElement) => void } {
  const name = _fileName(filePath);
  const cat = getFileCategory(filePath);
  const editable = cat === 'text' || cat === 'code' || cat === 'markdown';
  let _rawContent = '';
  let _mode: 'preview' | 'edit' = 'preview';
  let _header: HTMLElement;
  let _previewBtn: HTMLElement | null = null;
  let _editBtn: HTMLElement | null = null;
  let _body: HTMLElement;
  let _saveBtn: HTMLElement | null = null;

  function _renderToolbar() {
    if (!_previewBtn || !_editBtn) return;
    if (_mode === 'preview') {
      _previewBtn.style.cssText = BTN_STYLE + BTN_ACTIVE;
      _editBtn.style.cssText = BTN_STYLE;
    } else {
      _previewBtn.style.cssText = BTN_STYLE;
      _editBtn.style.cssText = BTN_STYLE + BTN_ACTIVE;
    }
  }

  function _renderPreview() {
    if (cat === 'markdown') {
      import('marked').then(m => {
        const html = m.marked.parse(_rawContent) as string;
        _body.innerHTML = '<div style="font-size:13px;line-height:1.7;color:#e0e0e0;padding:6px 0;overflow-wrap:break-word">' + html + '</div>';
      });
    } else {
      _body.innerHTML = '';
      const pre = document.createElement('pre');
      pre.style.cssText = 'margin:0;padding:6px 0 0;font:11px monospace;white-space:pre-wrap;word-break:break-word;color:#e0e0e0';
      pre.textContent = _rawContent || '\uFF08\u7A7A\u6587\u4EF6\uFF09';
      _body.appendChild(pre);
    }
  }

  function _renderEdit() {
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
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
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
        _previewBtn.style.cssText = BTN_STYLE + BTN_ACTIVE;
        _previewBtn.addEventListener('click', () => {
          if (_mode === 'preview') return;
          _mode = 'preview';
          _renderToolbar();
          _renderPreview();
        });

        _editBtn = document.createElement('button');
        _editBtn.textContent = '\u7F16\u8F91';
        _editBtn.style.cssText = BTN_STYLE;
        _editBtn.addEventListener('click', () => {
          if (_mode === 'edit') return;
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
      line.style.cssText = 'height:1px;flex-shrink:0;background:linear-gradient(90deg,rgba(0,212,255,0.4),rgba(124,58,237,0.3))';

      // 正文区
      _body = document.createElement('div');
      _body.style.cssText = 'flex:1;overflow-x:hidden;overflow-y:auto;position:relative';

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
