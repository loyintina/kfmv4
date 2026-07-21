import { getFileCategory } from './file-type.js';
import { renderBinaryInfo } from './binary-fallback.js';
import { preprocessMd, MARKED_OPTS } from './md-extensions.js';
import { highlightAll } from './code-highlight.js';
import { type MathData, renderMath, renderMermaid } from './math-diagram.js';
import { MD_CSS } from './md-css.js';
import { marked } from 'marked';
import { API } from '../state.js';
import { type CardInstance } from '../card-registry.js';

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

export function createFileHandler(meta: Record<string, unknown>): { activate: (contentEl: HTMLElement, card: CardInstance, reason: 'init' | 'compact') => void | Promise<void>; deactivate: (contentEl: HTMLElement, _card: CardInstance, reason: string) => void } {
  const filePath = meta.filePath as string;
  const _accent = (meta.accent as string) || '#00d4ff';
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
  let _saveTimer: ReturnType<typeof setTimeout> | undefined;
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


  function _renderPreview() {
    if (cat === 'markdown') {
      _body.innerHTML = '';
      const style = document.createElement('style');
      style.textContent = MD_CSS;
      _body.appendChild(style);
      (async () => {
        const mathData: MathData = { display: [], inline: [] };
        const processed = preprocessMd(_rawContent, mathData);
        const html = marked.parse(processed, MARKED_OPTS) as string;
        _body.style.setProperty('--card-accent', _toRgba(_accent, 0.7));
        const mdDiv = document.createElement('div');
        mdDiv.className = 'md-body';
        mdDiv.innerHTML = html;
        _body.appendChild(mdDiv);
        highlightAll(mdDiv);
        await renderMath(mdDiv, mathData);
        await renderMermaid(mdDiv, _accent);
        const cbs = mdDiv.querySelectorAll<HTMLInputElement>('input[type=checkbox]');
        cbs.forEach(cb => {
          cb.removeAttribute('disabled');
          cb.addEventListener('click', () => {
            const checked = cb.checked;
            const idx = Array.from(cbs).indexOf(cb);
            let n = 0;
            _rawContent = _rawContent.replace(/^(\s*-\s+)\[([ xX])\]/gm, (m, prefix) => {
              if (n === idx) { n++; return prefix + '[' + (checked ? 'x' : ' ') + ']'; }
              n++; return m;
            });
            _doSave(_rawContent);
          });
        });
        if (_scrollRatio > 0) {
          _body.scrollTop = _scrollRatio * (_body.scrollHeight - _body.clientHeight);
        }
      })();
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
      pre.style.cssText = 'margin:0;padding:6px 0 0;font:var(--card-font-size,11px) monospace;white-space:pre-wrap;word-break:break-word;color:#e0e0e0';
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
    ta.style.cssText = 'position:absolute;inset:0;padding:6px 0 0;font:var(--card-font-size,11px) monospace;white-space:pre-wrap;word-break:break-word;color:#e0e0e0;background:transparent;border:none;outline:none;resize:none';
    ta.value = _rawContent;

    // 自动保存：输入时防抖（500ms），失焦时立即保存
    ta.addEventListener('input', () => {
      if (_saveTimer !== undefined) clearTimeout(_saveTimer);
      _saveTimer = setTimeout(() => {
        if (ta.value !== _rawContent) _doSave(ta.value);
      }, 500);
    });
    ta.addEventListener('blur', () => {
      if (_saveTimer !== undefined) clearTimeout(_saveTimer);
      if (ta.value !== _rawContent) _doSave(ta.value);
    });
    // ctrl+enter 立即保存（同时清除防抖）
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (_saveTimer !== undefined) clearTimeout(_saveTimer);
        _doSave(ta.value);
      }
    });
    _body.appendChild(ta);
    const pos = Math.round(_rawContent.length * Math.min(_scrollRatio, 1));
    ta.focus();
    ta.setSelectionRange(pos, pos);
  }

  // 静默保存：只持久化，不切换模式、不重渲染（否则会毁掉正在编辑的 textarea + 关输入法）
  async function _doSave(newContent: string) {
    try {
      await fetch(API + '/files/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath, content: newContent }),
      });
      _rawContent = newContent;
    } catch { /* swallow */ }
  }

  // 保存并切到预览（供预览按钮/失焦等显式退出编辑时用）
  async function _saveAndPreview(newContent: string) {
    await _doSave(newContent);
    _mode = 'preview';
    _renderToolbar();
    _renderPreview();
  }

  return {
    async activate(contentEl: HTMLElement, card: CardInstance, _reason: 'init' | 'compact') {
      contentEl.innerHTML = '';

      // 加载并应用存储的字号偏好
      const storedFontSize = localStorage.getItem('kfm-fontsize-file');
      if (storedFontSize) {
        try {
          const parsed = JSON.parse(storedFontSize);
          if (typeof parsed.fontSize === 'number') {
            contentEl.style.setProperty('--card-font-size', parsed.fontSize + 'px');
          }
        } catch { /* ignore */ }
      }

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
          const ta = _body.firstElementChild as HTMLTextAreaElement | null;
          // 保存编辑区滚动位置
          if (ta?.tagName === 'TEXTAREA') {
            _scrollRatio = ta.scrollTop / Math.max(1, ta.scrollHeight - ta.clientHeight);
          }
          // 切预览前刷掉待保存的防抖，落盘当前内容
          if (_saveTimer !== undefined) { clearTimeout(_saveTimer); _saveTimer = undefined; }
          const val = ta?.tagName === 'TEXTAREA' ? ta.value : _rawContent;
          if (val !== _rawContent) { _saveAndPreview(val); return; }
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

      // 分隔线 — 从 CardInstance 取双色
      const line = document.createElement('div');
      const lc1 = card?.accents?.color1 || _accent;
      const lc2 = card?.accents?.color2 || _accent;
      line.style.cssText = 'height:1px;flex-shrink:0;background:linear-gradient(90deg,' + lc1 + ',' + lc2 + ')';

      // 正文区
      _body = document.createElement('div');
      _body.style.cssText = 'flex:1;overflow:auto;position:relative;padding-top:4px';

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
          renderBinaryInfo(contentEl, filePath, data.size, card?.accents?.color1, card?.accents?.color2);
        }
      } catch {
        renderBinaryInfo(contentEl, filePath, undefined, card?.accents?.color1, card?.accents?.color2);
      }
    },
    deactivate(el: HTMLElement, _card: CardInstance, _reason: string) {
      // 关闭卡片前保存未提交的更改
      if (_saveTimer !== undefined) clearTimeout(_saveTimer);
      _saveTimer = undefined;
      el.innerHTML = '';
    },
  };
}
