/**
 * terminal-renderer-v2.ts — Phase 9: Row-with-Runs 终端渲染器（04 号卡）
 *
 * 模型：ScreenRow（chars + marks + isContinuation）为唯一真相源。
 * 不为格子模型打补丁。resize 时合并 continuation 行 → 重折，属性全程不丢。
 */

import { currentTheme } from './theme.js';
import { log } from './logger.js';
import { measureFontMetrics, getFontMetrics } from './terminal-renderer.js';

// ========== 字体测量 ==========

const FONT = '9px monospace';

// ========== 类型定义 ==========

interface TextAttrs {
  fg: string;
  bg: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  reverse: boolean;
  strikethrough: boolean;
  dim: boolean;
}

interface ScreenRow {
  chars: string[];
  marks: MarkPos[];
  isContinuation: boolean;
}

interface MarkPos {
  pos: number;
  attrs: TextAttrs;
}

const DEFAULT_ATTRS: TextAttrs = {
  fg: '',
  bg: '',
  bold: false,
  italic: false,
  underline: false,
  reverse: false,
  strikethrough: false,
  dim: false,
};

function _cloneAttrs(a: TextAttrs): TextAttrs {
  return { fg: a.fg, bg: a.bg, bold: a.bold, italic: a.italic, underline: a.underline, reverse: a.reverse, strikethrough: a.strikethrough, dim: a.dim };
}

function _attrsEq(a: TextAttrs, b: TextAttrs): boolean {
  return a.fg === b.fg && a.bg === b.bg && a.bold === b.bold && a.italic === b.italic &&
    a.underline === b.underline && a.reverse === b.reverse && a.strikethrough === b.strikethrough && a.dim === b.dim;
}

function _defaultFg(): string { return currentTheme.canvas.text; }
function _defaultBg(): string { return currentTheme.canvas.bg; }

// ========== ANSI 颜色表 ==========

const ANSI_16: string[] = [
  '#1a1a2e', '#f07178', '#50a880', '#b4aa50',
  '#5088c8', '#9650c8', '#00d4ff', '#e0e0e0',
];
const ANSI_BRIGHT: string[] = [
  '#4a4a5e', '#f78c6c', '#6cdf9c', '#ffd54f',
  '#82aaff', '#c792ea', '#89ddff', '#ffffff',
];

const XTERM_256: string[] = [...ANSI_16, ...ANSI_BRIGHT];
for (let r = 0; r < 6; r++)
  for (let g = 0; g < 6; g++)
    for (let b = 0; b < 6; b++)
      XTERM_256.push('#' + [r ? (r * 40 + 55).toString(16) : '00',
                              g ? (g * 40 + 55).toString(16) : '00',
                              b ? (b * 40 + 55).toString(16) : '00'].map(s => s.length === 1 ? '0' + s : s).join(''));
for (let g = 0; g < 24; g++)
  XTERM_256.push('#' + (g * 10 + 8).toString(16).padStart(2, '0').repeat(3));

// ========== 全角字符 ==========

function _isFullWidth(ch: string): boolean {
  const c = ch.charCodeAt(0);
  return c >= 0x1100 && (
    c <= 0x115F || c === 0x2329 || c === 0x232A ||
    (c >= 0x2E80 && c <= 0xA4CF) || (c >= 0xAC00 && c <= 0xD7A3) ||
    (c >= 0xF900 && c <= 0xFAFF) || (c >= 0xFE10 && c <= 0xFE19) ||
    (c >= 0xFE30 && c <= 0xFE6F) || (c >= 0xFF01 && c <= 0xFF60) ||
    (c >= 0xFFE0 && c <= 0xFFE6) || (c >= 0x20000 && c <= 0x3FFFF)
  );
}

// ========== 渲染器类 ==========

export class LineRenderer {
  private _canvas: HTMLCanvasElement | null = null;
  private _ctx: CanvasRenderingContext2D | null = null;
  private _cellW = 0;
  private _cellH = 0;
  private _dpr = 1;
  private _containerW = 0;
  private _containerH = 0;
  private _cols = 0;
  private _rows = 0;

  // 真相源
  private _screen: ScreenRow[] = [];
  private _scrollback: ScreenRow[] = [];
  private _altScreen: ScreenRow[] = [];
  private _altCursorR = 0;
  private _altCursorC = 0;
  private _altAttrs: TextAttrs = _cloneAttrs(DEFAULT_ATTRS);
  private _altMode = false;

  // 光标 & 状态
  private _cursorR = 0;
  private _cursorC = 0;
  private _curAttrs: TextAttrs = _cloneAttrs(DEFAULT_ATTRS);
  private _cursorHidden = false;
  private _autoWrap = true;
  private _scrollTop = 0;
  private _scrollBottom = 0; // 0 = no region
  private _accent = currentTheme.canvas.accent;

  // ANSI
  private _escBuf = '';
  private _inEsc = false;
  private _decMode = false;   // CSI ? 前缀
  private _savedR = 0;
  private _savedC = 0;
  private _savedAttrs: TextAttrs = _cloneAttrs(DEFAULT_ATTRS);

  // 滚动
  private _scrollOffset = 0;
  private _scrollBaseline = 0;
  private _scrollVelocity = 0;
  private _flingRaf: number = 0;
  private _lastRawY = 0;

  // 回调
  private _onInput: ((data: string) => void) | null = null;
  private _onResize: ((cols: number, rows: number) => void) | null = null;
  private _status = 'init';

  // ========== mount / dispose ==========

  mount(containerEl: HTMLElement): void {
    const m = getFontMetrics();
    this._cellW = m.cellW;
    this._cellH = m.cellH;
    this._dpr = window.devicePixelRatio || 1;

    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none';
    canvas.className = 'terminal-canvas-v2';
    containerEl.appendChild(canvas);
    this._canvas = canvas;
    this._ctx = canvas.getContext('2d')!;

    const hiddenInput = document.createElement('textarea');
    hiddenInput.style.cssText = 'position:absolute;opacity:0;width:0;height:0;border:0;padding:0;resize:none;overflow:hidden';
    containerEl.appendChild(hiddenInput);
    canvas.addEventListener('click', () => hiddenInput.focus());

    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.scrollBy(e.deltaY);
    }, { passive: false });

    hiddenInput.addEventListener('keydown', (e) => {
      if (!this._onInput) return;
      if (e.key === 'Enter') { e.preventDefault(); hiddenInput.value = ''; this._onInput('\r'); return; }
      if (e.key === 'Backspace') { e.preventDefault(); this._onInput('\b'); return; }
      if (e.key === 'Tab') { e.preventDefault(); this._onInput('\t'); return; }
      if (e.key === 'Escape') { e.preventDefault(); this._onInput('\x1b'); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); this._onInput('\x1b[A'); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); this._onInput('\x1b[B'); return; }
      if (e.key === 'ArrowRight') { e.preventDefault(); this._onInput('\x1b[C'); return; }
      if (e.key === 'ArrowLeft') { e.preventDefault(); this._onInput('\x1b[D'); return; }
      if (e.ctrlKey && e.key.length === 1) {
        e.preventDefault();
        this._onInput(String.fromCharCode(e.key.toLowerCase().charCodeAt(0) - 96));
        return;
      }
    });
    hiddenInput.addEventListener('input', () => {
      if (!this._onInput || !hiddenInput.value) return;
      this._onInput(hiddenInput.value);
      hiddenInput.value = '';
    });

    requestAnimationFrame(() => {
      this._layout();
      if (this._cols > 0 && this._rows > 0) {
        this._ensureRows();
        this.write('> ');
      } else {
        requestAnimationFrame(() => this._layout());
      }
    });

    const observer = new ResizeObserver(() => {
      this._layout();
      if (this._onResize) this._onResize(this._cols, this._rows);
    });
    observer.observe(containerEl);
  }

  dispose(): void {
    if (this._canvas) { this._canvas.remove(); this._canvas = null; this._ctx = null; }
    this._screen = [];
    this._scrollback = [];
  }

  get cols(): number { return this._cols; }
  get rows(): number { return this._rows; }
  setAccent(color: string): void { this._accent = color; }
  onInput(fn: ((data: string) => void) | null): void { this._onInput = fn; }
  onResize(fn: ((cols: number, rows: number) => void) | null): void { this._onResize = fn; }
  setStatus(s: string): void { this._status = s; this._render(); }

  // ========== 行操作 ==========

  private _ensureRows(): void {
    while (this._screen.length < this._rows) {
      this._screen.push({ chars: [], marks: [], isContinuation: false });
    }
  }

  private _newRow(): ScreenRow {
    return { chars: [], marks: [], isContinuation: false };
  }

  private _cloneRow(r: ScreenRow): ScreenRow {
    return { chars: [...r.chars], marks: r.marks.map(m => ({ pos: m.pos, attrs: _cloneAttrs(m.attrs) })), isContinuation: r.isContinuation };
  }

  private _cloneScreen(rows: ScreenRow[]): ScreenRow[] {
    return rows.map(r => this._cloneRow(r));
  }

  /** 获取 col 处的属性：找到最后一个 pos ≤ col 的 mark */
  private _attrsAt(row: ScreenRow, col: number): TextAttrs {
    let a = this._curAttrs;
    if (row.marks.length === 0) { a.fg = _defaultFg(); a.bg = _defaultBg(); return a; }
    for (let i = row.marks.length - 1; i >= 0; i--) {
      if (row.marks[i].pos <= col) return row.marks[i].attrs;
    }
    a.fg = _defaultFg(); a.bg = _defaultBg(); return a;
  }

  /** 确保行长度 ≥ col+1，不足用空格补齐，继承当前属性 */
  private _padRow(row: ScreenRow, col: number): void {
    if (row.chars.length <= col) {
      this._addMark(row, row.chars.length);
      while (row.chars.length <= col) row.chars.push(' ');
    }
  }

  /** 添加属性标记（去重：不添加相同属性的连续标记） */
  private _addMark(row: ScreenRow, pos: number): void {
    const attrs = _cloneAttrs(this._curAttrs);
    if (row.marks.length > 0) {
      const last = row.marks[row.marks.length - 1];
      if (last.pos <= pos && _attrsEq(last.attrs, attrs)) return;
    }
    if (row.marks.length === 0 && _attrsEq(DEFAULT_ATTRS, attrs)) return;
    row.marks.push({ pos, attrs });
  }

  private _scrollUp(): void {
    if (this._screen.length > 0) {
      this._scrollback.push(this._cloneRow(this._screen[0]));
    }
    for (let r = 1; r < this._rows; r++) {
      this._screen[r - 1] = this._screen[r] || this._newRow();
    }
    this._screen[this._rows - 1] = this._newRow();
  }

  private _scrollDown(): void {
    for (let r = this._rows - 1; r > 0; r--) {
      this._screen[r] = this._screen[r - 1] || this._newRow();
    }
    this._screen[0] = this._newRow();
  }

  // ========== ANSI 解析 ==========

  private _handleSgr(params: number[]): void {
    if (params.length === 0) params = [0];
    for (let i = 0; i < params.length; i++) {
      const p = params[i];
      if (p === 0) {
        this._curAttrs = _cloneAttrs(DEFAULT_ATTRS);
        this._curAttrs.fg = _defaultFg();
        this._curAttrs.bg = _defaultBg();
      } else if (p === 1) { this._curAttrs.bold = true; }
      else if (p === 2) { this._curAttrs.dim = true; }
      else if (p === 3) { this._curAttrs.italic = true; }
      else if (p === 4) { this._curAttrs.underline = true; }
      else if (p === 7) { this._curAttrs.reverse = true; }
      else if (p === 9) { this._curAttrs.strikethrough = true; }
      else if (p >= 30 && p <= 37) { this._curAttrs.fg = ANSI_16[p - 30]; }
      else if (p >= 40 && p <= 47) { this._curAttrs.bg = ANSI_16[p - 40]; }
      else if (p >= 90 && p <= 97) { this._curAttrs.fg = ANSI_BRIGHT[p - 90]; }
      else if (p >= 100 && p <= 107) { this._curAttrs.bg = ANSI_BRIGHT[p - 100]; }
      else if (p === 38 && i + 1 < params.length) {
        i++;
        if (params[i] === 5 && i + 1 < params.length) { i++; this._curAttrs.fg = XTERM_256[params[i]] || _defaultFg(); }
        else if (params[i] === 2 && i + 3 < params.length) { i++; const r = params[i++], g = params[i++], b = params[i]; this._curAttrs.fg = `rgb(${r},${g},${b})`; }
        else { break; }
      }
      else if (p === 48 && i + 1 < params.length) {
        i++;
        if (params[i] === 5 && i + 1 < params.length) { i++; this._curAttrs.bg = XTERM_256[params[i]] || _defaultBg(); }
        else if (params[i] === 2 && i + 3 < params.length) { i++; const r = params[i++], g = params[i++], b = params[i]; this._curAttrs.bg = `rgb(${r},${g},${b})`; }
        else { break; }
      }
    }
  }

  private _handleCsi(ch: string, buf: string): void {
    const parts = buf.split(';').map(Number.isNaN as unknown as (n: string) => number);
    const nums = buf.length === 0 ? [] : buf.split(';').map(Number);
    const p0 = nums.length > 0 ? nums[0] : 0;
    const p1 = nums.length > 1 ? nums[1] : 0;

    switch (ch) {
      case 'A': this._cursorR = Math.max(0, this._cursorR - (p0 || 1)); break;
      case 'B': { const max = this._scrollBottom > 0 ? this._scrollBottom - 1 : this._rows - 1; this._cursorR = Math.min(max, this._cursorR + (p0 || 1)); break; }
      case 'C': this._cursorC = Math.min(this._cols - 1, this._cursorC + (p0 || 1)); break;
      case 'D': this._cursorC = Math.max(0, this._cursorC - (p0 || 1)); break;
      case 'H': case 'f':
        this._cursorR = Math.min(this._rows - 1, Math.max(0, (p0 || 1) - 1));
        this._cursorC = Math.min(this._cols - 1, Math.max(0, (p1 || 1) - 1));
        break;
      case 'd': this._cursorR = Math.min(this._rows - 1, Math.max(0, (p0 || 1) - 1)); break;
      case 'G': this._cursorC = Math.min(this._cols - 1, Math.max(0, (p0 || 1) - 1)); break;
      case 'E': this._cursorR = Math.min(this._rows - 1, this._cursorR + (p0 || 1)); this._cursorC = 0; break;
      case 'F': this._cursorR = Math.max(0, this._cursorR - (p0 || 1)); this._cursorC = 0; break;
      case 's':
        this._savedR = this._cursorR;
        this._savedC = this._cursorC;
        this._savedAttrs = _cloneAttrs(this._curAttrs);
        break;
      case 'u':
        this._cursorR = this._savedR;
        this._cursorC = this._savedC;
        break;
      case 'J': {
        const top = this._scrollTop;
        const bot = this._scrollBottom > 0 ? this._scrollBottom : this._rows;
        if (p0 === 0) { this._eraseRange(this._cursorR, this._cursorC, bot - 1, this._cols - 1, top, bot); }
        else if (p0 === 1) { this._eraseRange(top, 0, this._cursorR, this._cursorC, top, bot); }
        else if (p0 === 2 || p0 === 3) { this._eraseRange(top, 0, bot - 1, this._cols - 1, top, bot); }
        break;
      }
      case 'K':
        if (p0 === 0) { this._eraseInRow(this._cursorR, this._cursorC, this._cols - 1); }
        else if (p0 === 1) { this._eraseInRow(this._cursorR, 0, this._cursorC); }
        else if (p0 === 2) { this._eraseInRow(this._cursorR, 0, this._cols - 1); }
        break;
      case 'X': {
        this._ensureRows();
        const row = this._screen[this._cursorR];
        const n = Math.max(1, p0);
        this._padRow(row, this._cursorC + n - 1);
        for (let c = this._cursorC; c < this._cursorC + n && c < this._cols; c++) row.chars[c] = ' ';
        break;
      }
      case 'L': this._insertLines(Math.max(1, p0)); break;
      case 'M': this._deleteLines(Math.max(1, p0)); break;
      case '@': this._insertChars(Math.max(1, p0)); break;
      case 'P': this._deleteChars(Math.max(1, p0)); break;
      case 'S': {
        const n = Math.max(1, p0);
        const top = this._scrollTop;
        const bot = this._scrollBottom > 0 ? this._scrollBottom : this._rows;
        for (let i = 0; i < n && top + n <= bot; i++) {
          for (let r = bot - 1; r > top; r--) this._screen[r] = this._screen[r - 1] || this._newRow();
          this._screen[top] = this._newRow();
        }
        break;
      }
      case 'T': {
        const n = Math.max(1, p0);
        const top = this._scrollTop;
        const bot = this._scrollBottom > 0 ? this._scrollBottom : this._rows;
        for (let i = 0; i < n && bot - n >= top; i++) {
          for (let r = top; r < bot - 1; r++) this._screen[r] = this._screen[r + 1] || this._newRow();
          this._screen[bot - 1] = this._newRow();
        }
        break;
      }
      case 'r':
        this._scrollTop = Math.max(0, (p0 || 1) - 1);
        this._scrollBottom = p1 > 0 ? p1 : 0;
        this._cursorR = this._scrollTop;
        this._cursorC = 0;
        break;
    }
  }

  private _handleDecSet(ch: string): void {
    const val = this._escBuf;
    if (val === '25') { if (ch === 'h') this._cursorHidden = false; else if (ch === 'l') this._cursorHidden = true; }
    else if (val === '7') { if (ch === 'h') this._autoWrap = true; else if (ch === 'l') this._autoWrap = false; }
    else if (val === '1049') {
      if (ch === 'h') {
        this._altScreen = this._cloneScreen(this._screen);
        this._altCursorR = this._cursorR;
        this._altCursorC = this._cursorC;
        this._altAttrs = _cloneAttrs(this._curAttrs);
        this._screen = [];
        this._ensureRows();
        this._cursorR = 0; this._cursorC = 0;
        this._altMode = true;
      } else if (ch === 'l' && this._altMode) {
        this._screen = this._altScreen;
        this._cursorR = this._altCursorR;
        this._cursorC = this._altCursorC;
        this._curAttrs = this._altAttrs;
        this._altScreen = [];
        this._altMode = false;
      }
    }
    else if (val === '2004') { /* bracketed paste — 忽略 v1 */ }
  }

  private _eraseRange(r1: number, c1: number, r2: number, c2: number, top: number, bot: number): void {
    const sr = Math.max(top, r1);
    const er = Math.min(bot - 1, r2);
    this._ensureRows();
    for (let r = sr; r <= er; r++) {
      const sc = r === r1 ? Math.max(c1, 0) : 0;
      const ec = r === r2 ? Math.min(c2, this._cols - 1) : this._cols - 1;
      this._eraseInRow(r, sc, ec);
    }
  }

  private _eraseInRow(r: number, c1: number, c2: number): void {
    this._ensureRows();
    const row = this._screen[r];
    if (!row) return;
    this._padRow(row, c2);
    for (let c = c1; c <= c2 && c < this._cols; c++) row.chars[c] = ' ';
  }

  private _insertLines(n: number): void {
    const top = this._cursorR;
    const bot = this._scrollBottom > 0 ? this._scrollBottom : this._rows;
    this._ensureRows();
    for (let i = 0; i < n && bot - n >= top; i++) {
      for (let r = bot - 1; r > top; r--) this._screen[r] = this._screen[r - 1] || this._newRow();
      this._screen[top] = this._newRow();
    }
  }

  private _deleteLines(n: number): void {
    const top = this._cursorR;
    const bot = this._scrollBottom > 0 ? this._scrollBottom : this._rows;
    this._ensureRows();
    for (let i = 0; i < n && top + n <= bot; i++) {
      for (let r = top; r < bot - 1; r++) this._screen[r] = this._screen[r + 1] || this._newRow();
      this._screen[bot - 1] = this._newRow();
    }
  }

  private _insertChars(n: number): void {
    this._ensureRows();
    const row = this._screen[this._cursorR];
    this._padRow(row, this._cols - 1);
    for (let c = this._cols - 1; c >= this._cursorC + n; c--) row.chars[c] = row.chars[c - n] || ' ';
    for (let c = this._cursorC; c < this._cursorC + n && c < this._cols; c++) row.chars[c] = ' ';
  }

  private _deleteChars(n: number): void {
    this._ensureRows();
    const row = this._screen[this._cursorR];
    this._padRow(row, this._cols - 1);
    for (let c = this._cursorC; c < this._cols - n; c++) row.chars[c] = row.chars[c + n] || ' ';
    for (let c = this._cols - n; c < this._cols; c++) row.chars[c] = ' ';
  }

  // ========== write ==========

  write(text: string): void {
    if (this._cols <= 0 || this._rows <= 0) return;
    this._scrollOffset = 0;
    this._ensureRows();

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];

      if (this._inEsc) {
        if (ch === '\x1b') { this._escBuf = ''; this._decMode = false; continue; }
        if (ch === '[') continue;
        if (ch === '?') { this._decMode = true; continue; }
        if ((ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z')) {
          if (this._decMode && (ch === 'h' || ch === 'l')) {
            this._handleDecSet(ch);
          } else {
            this._handleCsi(ch, this._escBuf);
          }
          this._inEsc = false;
          this._escBuf = '';
          this._decMode = false;
          continue;
        }
        this._escBuf += ch;
        continue;
      }
      if (ch === '\x1b') { this._inEsc = true; this._escBuf = ''; this._decMode = false; continue; }

      if (ch === '\r') { this._cursorC = 0; continue; }
      if (ch === '\n') {
        this._screen[this._cursorR].isContinuation = false;
        this._cursorR++; this._cursorC = 0;
        const bot = this._scrollBottom > 0 ? this._scrollBottom : this._rows;
        if (this._cursorR >= bot) {
          if (this._scrollBottom > 0) {
            for (let r = this._scrollTop; r < this._scrollBottom - 1; r++) this._screen[r] = this._screen[r + 1] || this._newRow();
            this._screen[this._scrollBottom - 1] = this._newRow();
          } else {
            this._scrollUp();
          }
          this._cursorR = bot - 1;
        }
        continue;
      }
      if (ch === '\b') { if (this._cursorC > 0) this._cursorC--; continue; }
      if (ch === '\t') {
        this._cursorC = (Math.floor(this._cursorC / 8) + 1) * 8;
        if (this._cursorC >= this._cols) this._cursorC = 0;
        continue;
      }

      // 可打印字符
      if (this._cursorR < this._rows && this._cursorC < this._cols) {
        const wide = _isFullWidth(ch);
        const row = this._screen[this._cursorR];
        this._padRow(row, this._cursorC);
        row.chars[this._cursorC] = ch;
        this._addMark(row, this._cursorC);
        if (wide && this._cursorC + 1 < this._cols) {
          this._padRow(row, this._cursorC + 1);
          row.chars[this._cursorC + 1] = '';
        }
        this._cursorC += wide ? 2 : 1;
      } else {
        this._cursorC++;
      }

      // 自动换行
      if (this._cursorC >= this._cols) {
        if (this._autoWrap) {
          this._cursorC = 0;
          const oldRow = this._screen[this._cursorR];
          this._cursorR++;
          this._ensureRows();
          this._screen[this._cursorR].isContinuation = true;
          if (this._cursorR >= this._rows) {
            this._scrollUp();
            this._cursorR = this._rows - 1;
          }
        } else {
          this._cursorC = this._cols - 1;
        }
      }
    }
  }

  // ========== layout（resize 合并重折）==========

  private _layout(): void {
    if (!this._canvas || !this._ctx) return;
    this._containerW = this._canvas.clientWidth;
    this._containerH = this._canvas.clientHeight;
    if (this._containerW <= 0 || this._containerH <= 0) return;

    this._canvas.width = this._containerW * this._dpr;
    this._canvas.height = this._containerH * this._dpr;
    this._ctx.setTransform(this._dpr, 0, 0, this._dpr, 0, 0);

    const newCols = Math.floor(this._containerW / this._cellW);
    const newRows = Math.floor(this._containerH / this._cellH);
    const oldCols = this._cols;
    const oldRows = this._rows;

    if (newCols <= 0 || newRows <= 0) return;

    this._cols = newCols;
    this._rows = newRows;

    if (oldCols > 0 && oldRows > 0 && (oldCols !== newCols || oldRows !== newRows)) {
      this._reflow(oldCols);
    }

    this._ensureRows();
    this._scrollOffset = 0;
    this._scrollBaseline = 0;

    if (oldRows === 0) { this._cursorR = 0; this._cursorC = 0; }
    this._render();
  }

  /** 合并 continuation 行 → 按新列宽重折 */
  private _reflow(oldCols: number): void {
    // 1. 合并 scrollback + screen 中所有行
    const allRows = [...this._scrollback, ...this._screen];

    // 2. 合并 continuation 行
    const merged: { chars: string[]; marks: MarkPos[] }[] = [];
    let curChars: string[] = [];
    let curMarks: MarkPos[] = [];
    for (const row of allRows) {
      // 合并行内容（保留属性边界）
      const offset = curChars.length;
      for (const m of row.marks) {
        curMarks.push({ pos: offset + m.pos, attrs: _cloneAttrs(m.attrs) });
      }
      for (const ch of row.chars) {
        curChars.push(ch || ' ');
      }
      if (!row.isContinuation) {
        merged.push({ chars: curChars, marks: curMarks });
        curChars = [];
        curMarks = [];
      }
    }
    if (curChars.length > 0) merged.push({ chars: curChars, marks: curMarks });

    // 3. 按新列宽重折
    const newScreen: ScreenRow[] = [];
    const newScrollback: ScreenRow[] = [];

    for (const line of merged) {
      let pos = 0;
      let firstRow = true;
      while (pos < line.chars.length) {
        const row: ScreenRow = { chars: [], marks: [], isContinuation: !firstRow };
        const segEnd = Math.min(pos + this._cols, line.chars.length);
        for (let c = pos; c < segEnd; c++) {
          row.chars.push(line.chars[c]);
        }
        // 复制这一段内的 marks（调整偏移）
        for (const m of line.marks) {
          if (m.pos >= pos && m.pos < segEnd) {
            row.marks.push({ pos: m.pos - pos, attrs: _cloneAttrs(m.attrs) });
          }
        }
        if (newScreen.length < this._rows) {
          newScreen.push(row);
        } else {
          newScrollback.push(row);
        }
        pos = segEnd;
        firstRow = false;
      }
    }

    this._screen = newScreen;
    this._scrollback = newScrollback;

    // 光标定位到最后
    let lastR = this._screen.length;
    for (let r = this._screen.length - 1; r >= 0; r--) {
      if (this._screen[r].chars.length > 0) { lastR = r; break; }
    }
    this._cursorR = Math.min(lastR, this._rows - 1);
    this._cursorC = this._screen[this._cursorR] ? Math.min(this._screen[this._cursorR].chars.length, this._cols - 1) : 0;
  }

  // ========== 渲染 ==========

  private _render(): void {
    if (!this._ctx) return;
    const ctx = this._ctx;
    const cw = this._cellW;
    const ch = this._cellH;
    const topPad = 4;
    const fgDef = _defaultFg();
    const bgDef = _defaultBg();

    ctx.fillStyle = bgDef;
    ctx.fillRect(0, 0, this._containerW, this._containerH);

    const totalRows = this._scrollback.length + this._screen.length;
    const baseOff = Math.floor(this._scrollOffset);
    const visibleStart = Math.max(0, totalRows - this._rows - baseOff);
    const pixelOff = (this._scrollOffset - baseOff) * ch;

    ctx.save();
    ctx.font = FONT;
    ctx.textBaseline = 'middle';
    ctx.translate(0, -pixelOff);

    const renderRows = this._rows + 1;

    // 第一遍：背景
    for (let vr = 0; vr < renderRows; vr++) {
      const rowIdx = visibleStart + vr;
      const row = rowIdx < this._scrollback.length ? this._scrollback[rowIdx] : this._screen[rowIdx - this._scrollback.length];
      if (!row || row.chars.length === 0) continue;
      const py = topPad + vr * ch;
      this._renderBg(ctx, row, cw, py, ch, bgDef);
    }

    // 第二遍：文字
    for (let vr = 0; vr < renderRows; vr++) {
      const rowIdx = visibleStart + vr;
      const row = rowIdx < this._scrollback.length ? this._scrollback[rowIdx] : this._screen[rowIdx - this._scrollback.length];
      if (!row || row.chars.length === 0) continue;
      const py = topPad + vr * ch;
      this._renderText(ctx, row, cw, py, ch);
    }

    ctx.restore();

    // 光标
    if (!this._cursorHidden && this._scrollOffset < 0.5 && this._cursorR < this._rows && this._cursorC < this._cols) {
      ctx.fillStyle = this._accent;
      ctx.fillRect(this._cursorC * cw, topPad + this._cursorR * ch, cw, ch);
    }

    // 状态
    ctx.fillStyle = 'rgba(0,212,255,0.3)';
    ctx.font = '7px monospace';
    const sw = ctx.measureText(this._status).width;
    ctx.fillText(this._status, this._containerW - sw - 2, this._containerH - 2);
  }

  /** 渲染一行的背景（从 marks 分段画） */
  private _renderBg(ctx: CanvasRenderingContext2D, row: ScreenRow, cw: number, py: number, ch: number, bgDef: string): void {
    if (row.marks.length === 0) return;
    const maxCol = Math.min(row.chars.length, this._cols);

    let segStart = 0;
    let curBg = bgDef;
    let mi = 0;

    while (segStart < maxCol) {
      // 找下一个 mark
      while (mi < row.marks.length && row.marks[mi].pos <= segStart) {
        curBg = row.marks[mi].attrs.bg || bgDef;
        if (curBg === bgDef) curBg = bgDef;
        mi++;
      }
      let segEnd = maxCol;
      if (mi < row.marks.length) {
        segEnd = Math.min(row.marks[mi].pos, maxCol);
      }
      if (curBg && curBg !== bgDef) {
        ctx.fillStyle = curBg;
        ctx.fillRect(segStart * cw, py, (segEnd - segStart) * cw, ch);
      }
      segStart = segEnd;
    }
  }

  /** 渲染一行的文字（从 marks 分段画，含 bold/italic/underline/strikethrough/dim/reverse） */
  private _renderText(ctx: CanvasRenderingContext2D, row: ScreenRow, cw: number, py: number, ch: number): void {
    const fgDef = _defaultFg();
    const maxCol = Math.min(row.chars.length, this._cols);
    if (row.marks.length === 0) {
      // 没有 marks，全部用默认属性
      const text = row.chars.slice(0, maxCol).join('');
      if (text.trim().length > 0) {
        ctx.fillStyle = fgDef;
        ctx.font = FONT;
        ctx.fillText(text, 0, py + ch * 0.5);
      }
      return;
    }

    let segStart = 0;
    let curAttrs: TextAttrs = _cloneAttrs(DEFAULT_ATTRS);
    curAttrs.fg = fgDef;
    let mi = 0;

    while (segStart < maxCol) {
      while (mi < row.marks.length && row.marks[mi].pos <= segStart) {
        curAttrs = row.marks[mi].attrs;
        mi++;
      }
      let segEnd = maxCol;
      if (mi < row.marks.length) {
        segEnd = Math.min(row.marks[mi].pos, maxCol);
      }
      const text = row.chars.slice(segStart, segEnd).join('').replace(/\x00/g, '');
      if (text.trim().length > 0 || (text.length > 0 && segEnd - segStart > 0)) {
        const fg = curAttrs.reverse ? (curAttrs.bg || _defaultBg()) : (curAttrs.fg || fgDef);
        ctx.fillStyle = curAttrs.dim ? _dimColor(fg) : fg;
        let fontStyle = FONT;
        if (curAttrs.bold) fontStyle = 'bold ' + fontStyle;
        if (curAttrs.italic) fontStyle = 'italic ' + fontStyle;
        ctx.font = fontStyle;
        const x = segStart * cw;
        const yOff = curAttrs.bold ? 0 : 0;
        ctx.fillText(text, x, py + ch * 0.5 + yOff);
        // underline
        if (curAttrs.underline) {
          ctx.strokeStyle = ctx.fillStyle as string;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x, py + ch - 2);
          ctx.lineTo(x + (segEnd - segStart) * cw, py + ch - 2);
          ctx.stroke();
        }
        // strikethrough
        if (curAttrs.strikethrough) {
          ctx.strokeStyle = ctx.fillStyle as string;
          ctx.lineWidth = 1;
          const midY = py + ch * 0.5;
          ctx.beginPath();
          ctx.moveTo(x, midY);
          ctx.lineTo(x + (segEnd - segStart) * cw, midY);
          ctx.stroke();
        }
      }
      segStart = segEnd;
    }
  }

  // ========== 滚动 ==========

  scrollBy(deltaPx: number): void {
    this._scrollBaseline = this._scrollOffset;
    this._scrollOffset += deltaPx / this._cellH;
    this._scrollOffset = Math.max(0, Math.min(this._scrollback.length, this._scrollOffset));
    this._render();
  }

  touchScrollStart(rawY: number): void {
    if (this._flingRaf) { cancelAnimationFrame(this._flingRaf); this._flingRaf = 0; }
    this._scrollBaseline = this._scrollOffset;
    this._scrollVelocity = 0;
    this._lastRawY = rawY;
  }

  touchScrollMove(rawY: number, startY: number): void {
    const deltaPx = rawY - startY;
    const frameDy = this._lastRawY - rawY;
    this._lastRawY = rawY;
    if (frameDy !== 0) this._scrollVelocity = frameDy / 16;
    this._scrollOffset = this._scrollBaseline + deltaPx / this._cellH;
    this._scrollOffset = Math.min(this._scrollback.length, this._scrollOffset);
    this._render();
  }

  startFling(): void {
    if (Math.abs(this._scrollVelocity) < 0.5) {
      if (this._scrollOffset < 0) { this._scrollOffset = 0; this._render(); }
      return;
    }
    if (this._flingRaf) return;
    const step = () => {
      this._scrollVelocity *= 0.96;
      if (Math.abs(this._scrollVelocity) < 0.3) {
        this._flingRaf = 0;
        if (this._scrollOffset < 0) { this._scrollOffset = 0; this._render(); }
        return;
      }
      this.scrollBy(this._scrollVelocity);
      this._flingRaf = requestAnimationFrame(step);
    };
    this._flingRaf = requestAnimationFrame(step);
  }
}

function _dimColor(hex: string): string {
  if (!hex || hex.length < 4) return hex;
  if (hex.startsWith('rgb')) {
    const m = hex.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (m) return `rgb(${Math.floor(+m[1]*0.5)},${Math.floor(+m[2]*0.5)},${Math.floor(+m[3]*0.5)})`;
    return hex;
  }
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return '#' + [Math.floor(r * 0.5).toString(16).padStart(2, '0'),
                Math.floor(g * 0.5).toString(16).padStart(2, '0'),
                Math.floor(b * 0.5).toString(16).padStart(2, '0')].join('');
}
