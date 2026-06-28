/**
 * terminal-renderer.ts — Phase 8: Canvas 终端渲染器
 *
 * 格子模型 + ANSI/VT 解析 + 光标动画 + 渲染循环。
 * 不依赖 xterm.js，复用项目 Canvas 2D 引擎基础设施。
 *
 * 设计文档：docs/design/TERMINAL_CARD_SPEC.md
 */

import { currentTheme } from './theme.js';

// ========== 步骤 0：字体测量 ==========

const FONT = '9px monospace';

interface FontMetrics {
  cellW: number;
  cellH: number;
}

let _metrics: FontMetrics | null = null;

export function measureFontMetrics(): FontMetrics {
  if (_metrics) return _metrics;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  ctx.font = FONT;
  const cellW = ctx.measureText('A').width;
  const m = ctx.measureText('Ag');
  const cellH = Math.abs(m.actualBoundingBoxAscent) + Math.abs(m.actualBoundingBoxDescent);
  _metrics = { cellW, cellH };
  return _metrics;
}

export function getFontMetrics(): FontMetrics {
  if (!_metrics) return measureFontMetrics();
  return _metrics;
}

// ========== 步骤 1：格子模型 + Canvas 挂载 ==========

interface Cell {
  char: string;
  fg: string;
  bg: string;
  bold: boolean;
}

const DEFAULT_FG = currentTheme.canvas.text;   // '#e0e0e0'
const DEFAULT_BG = currentTheme.canvas.bg;     // '#0a0a0f'

// ========== 步骤 4：ANSI 颜色表 + SGR ==========

const ANSI_COLORS = [
  '#1a1a2e', '#f07178', '#50a880', '#b4aa50', // 0-3: 黑 红 绿 黄
  '#5088c8', '#9650c8', '#00d4ff', '#e0e0e0', // 4-7: 蓝 品 青 白
];
const ANSI_BRIGHT = [
  '#4a4a5e', '#f78c6c', '#6cdf9c', '#ffd54f', // 8-15: 亮色
  '#82aaff', '#c792ea', '#89ddff', '#ffffff',
];

// ========== 步骤 8：256 色调色板 ==========

const XTERM_256: string[] = [...ANSI_COLORS, ...ANSI_BRIGHT];
// 16-231: 6×6×6 RGB 立方体
for (let r = 0; r < 6; r++)
  for (let g = 0; g < 6; g++)
    for (let b = 0; b < 6; b++)
      XTERM_256.push('#' + [r ? (r * 40 + 55).toString(16) : '00',
                              g ? (g * 40 + 55).toString(16) : '00',
                              b ? (b * 40 + 55).toString(16) : '00'].map(s => s.length === 1 ? '0' + s : s).join(''));
// 232-255: 灰度
for (let g = 0; g < 24; g++)
  XTERM_256.push('#' + (g * 10 + 8).toString(16).padStart(2, '0').repeat(3));

// ========== 全角字符检测 ==========

function _isFullWidth(ch: string): boolean {
  const c = ch.charCodeAt(0);
  return c >= 0x1100 && (
    c <= 0x115F ||
    c === 0x2329 || c === 0x232A ||
    (c >= 0x2E80 && c <= 0xA4CF) ||
    (c >= 0xAC00 && c <= 0xD7A3) ||
    (c >= 0xF900 && c <= 0xFAFF) ||
    (c >= 0xFE10 && c <= 0xFE19) ||
    (c >= 0xFE30 && c <= 0xFE6F) ||
    (c >= 0xFF01 && c <= 0xFF60) ||
    (c >= 0xFFE0 && c <= 0xFFE6) ||
    (c >= 0x20000 && c <= 0x3FFFF)
  );
}

export class TerminalRenderer {
  private _canvas: HTMLCanvasElement | null = null;
  private _ctx: CanvasRenderingContext2D | null = null;
  private _cells: Cell[][] = [];
  private _cols = 0;
  private _rows = 0;
  private _cellW = 0;
  private _cellH = 0;
  private _dpr = 1;
  private _containerW = 0;
  private _containerH = 0;
  private _cursorR = 0;
  private _cursorC = 0;
  private _accent = currentTheme.canvas.accent;
  private _curFg = DEFAULT_FG;
  private _curBg = DEFAULT_BG;
  private _curBold = false;
  private _escBuf = '';
  private _inEsc = false;
  private _savedR = 0;
  private _savedC = 0;
  private _cursorHidden = false;
  private _altMode = false;
  private _mainCells: Cell[][] = [];
  private _mainCursorR = 0;
  private _mainCursorC = 0;
  private _mainSavedR = 0;
  private _mainSavedC = 0;
  private _scrollback: Cell[][] = [];
  private _scrollOffset = 0;
  private _onInput: ((data: string) => void) | null = null;
  private _onResize: ((cols: number, rows: number) => void) | null = null;
  private _status = 'init';

  /** 在容器内创建 canvas 并初始化 */
  mount(containerEl: HTMLElement): void {
    const metrics = getFontMetrics();
    this._cellW = metrics.cellW;
    this._cellH = metrics.cellH;
    this._dpr = window.devicePixelRatio || 1;

    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'display:block;width:100%;height:100%';
    canvas.className = 'terminal-canvas';
    containerEl.appendChild(canvas);
    this._canvas = canvas;
    this._ctx = canvas.getContext('2d')!;

    // 键盘输入：隐藏 textarea（触发手机虚拟键盘）
    const hiddenInput = document.createElement('textarea');
    hiddenInput.style.cssText = 'position:absolute;opacity:0;width:0;height:0;border:0;padding:0;resize:none;overflow:hidden';
    containerEl.appendChild(hiddenInput);
    canvas.addEventListener('click', () => hiddenInput.focus());

    // 滚动缓冲：滚轮
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

    // 推迟到下一帧：浏览器需要完成 DOM 布局后才能读到正确的 clientRect
    requestAnimationFrame(() => {
      this._layout();
      if (this._cols > 0 && this._rows > 0) {
        this.write('> ');
      } else {
        requestAnimationFrame(() => this._layout());
      }
    });

    // 尺寸自适应：卡片 resize 时重建网格 + 通知 PTY
    const observer = new ResizeObserver(() => {
      this._layout();
      if (this._onResize) this._onResize(this._cols, this._rows);
    });
    observer.observe(containerEl);
  }

  /** 重算 cols/rows 并重建网格 */
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
    const oldCells = this._cells;
    const oldCols = this._cols;
    const oldRows = this._rows;
    const isFirst = oldRows === 0;

    this._cols = newCols;
    this._rows = newRows;

    // 建新网格，保留旧内容
    const cells: Cell[][] = [];
    for (let r = 0; r < newRows; r++) {
      const row: Cell[] = [];
      for (let c = 0; c < newCols; c++) {
        if (r < oldRows && c < oldCols) {
          row.push(oldCells[r][c]);
        } else {
          row.push({ char: ' ', fg: DEFAULT_FG, bg: DEFAULT_BG, bold: false });
        }
      }
      cells.push(row);
    }
    this._cells = cells;
    if (isFirst) { this._cursorR = 0; this._cursorC = 0; }
    this._render();
  }

  /** 网格尺寸 */
  get cols(): number { return this._cols; }
  get rows(): number { return this._rows; }

  /** 往终端写入文本，处理 \n \r \b + ANSI 转义 */
  write(text: string): void {
    if (this._cols <= 0 || this._rows <= 0) return;
    this._scrollOffset = 0;  // 新数据到达，回到底部
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];

      // ANSI 转义状态机
      if (this._inEsc) {
        if (ch === '\x1b') { this._escBuf = ''; continue; }
        if (ch === '[') continue;  // 跳过 CSI 引导符
        if (ch === '?') continue;  // 跳过 DEC 前缀
        // CSI 终结符
        if ((ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z')) {
          this._handleCsi(ch, this._escBuf);
          this._inEsc = false;
          this._escBuf = '';
          continue;
        }
        this._escBuf += ch;
        continue;
      }
      if (ch === '\x1b') { this._inEsc = true; this._escBuf = ''; continue; }

      if (ch === '\r') { this._cursorC = 0; continue; }
      if (ch === '\n') {
        this._cursorR++; this._cursorC = 0;
        if (this._cursorR >= this._rows) { this._scrollUp(); this._cursorR = this._rows - 1; }
        continue;
      }
      if (ch === '\b') { if (this._cursorC > 0) this._cursorC--; continue; }

      // 可打印字符 — 继承当前 SGR 状态
      if (this._cursorR < this._rows && this._cursorC < this._cols) {
        const wide = _isFullWidth(ch);
        const cell = this._cells[this._cursorR][this._cursorC];
        cell.char = ch;
        cell.fg = this._curFg;
        cell.bg = this._curBg;
        cell.bold = this._curBold;
        // 全角字符占 2 格：第二格标记为空，两遍渲染保证背景先画
        if (wide && this._cursorC + 1 < this._cols) {
          const next = this._cells[this._cursorR][this._cursorC + 1];
          next.char = '';
          next.fg = this._curFg;
          next.bg = this._curBg;
        }
        this._cursorC += wide ? 2 : 1;
      } else {
        this._cursorC++;
      }
      if (this._cursorC >= this._cols) {
        this._cursorC = 0; this._cursorR++;
        if (this._cursorR >= this._rows) { this._scrollUp(); this._cursorR = this._rows - 1; }
      }
    }
    this._render();
  }

  /** SGR 参数应用 */
  private _applySgr(params: string): void {
    if (!params) { this._curFg = DEFAULT_FG; this._curBg = DEFAULT_BG; this._curBold = false; return; }
    const nums = params.split(';');
    for (let i = 0; i < nums.length; i++) {
      const n = parseInt(nums[i], 10);
      if (isNaN(n)) continue;
      if (n === 0) { this._curFg = DEFAULT_FG; this._curBg = DEFAULT_BG; this._curBold = false; continue; }
      if (n === 1) { this._curBold = true; continue; }
      // 256 色前景: 38;5;N
      if (n === 38 && nums[i + 1] === '5') { const c = parseInt(nums[i + 2], 10); if (c >= 0 && c < 256) this._curFg = XTERM_256[c]; i += 2; continue; }
      // 256 色背景: 48;5;N
      if (n === 48 && nums[i + 1] === '5') { const c = parseInt(nums[i + 2], 10); if (c >= 0 && c < 256) this._curBg = XTERM_256[c]; i += 2; continue; }
      if (n >= 30 && n <= 37) { const idx = n - 30; this._curFg = this._curBold ? ANSI_BRIGHT[idx] : ANSI_COLORS[idx]; continue; }
      if (n >= 40 && n <= 47) { this._curBg = ANSI_COLORS[n - 40]; continue; }
      if (n >= 90 && n <= 97) { this._curFg = ANSI_BRIGHT[n - 90]; continue; }
      if (n >= 100 && n <= 107) { this._curBg = ANSI_BRIGHT[n - 100]; continue; }
    }
  }

  /** CSI 序列分发 */
  private _handleCsi(term: string, buf: string): void {
    const n = buf ? parseInt(buf.split(';')[0], 10) || 1 : 1;
    switch (term) {
      case 'm': this._applySgr(buf); break;
      case 'h': if (buf === '1049') { this._enterAltScreen(); } else if (buf === '25') { this._cursorHidden = false; } break;
      case 'l': if (buf === '1049') { this._exitAltScreen(); } else if (buf === '25') { this._cursorHidden = true; } break;
      case 'A': this._cursorR = Math.max(0, this._cursorR - n); break;
      case 'B': this._cursorR = Math.min(this._rows - 1, this._cursorR + n); break;
      case 'C': this._cursorC = Math.min(this._cols - 1, this._cursorC + n); break;
      case 'D': this._cursorC = Math.max(0, this._cursorC - n); break;
      case 'H': {
        const parts = buf ? buf.split(';') : [];
        const row = parseInt(parts[0], 10) || 1;
        const col = parseInt(parts[1], 10) || 1;
        this._cursorR = Math.min(this._rows - 1, Math.max(0, row - 1));
        this._cursorC = Math.min(this._cols - 1, Math.max(0, col - 1));
        break;
      }
      case 'J': if (n === 2) { for (let r = 0; r < this._rows; r++) for (let c = 0; c < this._cols; c++) { this._cells[r][c].char = ' '; this._cells[r][c].fg = DEFAULT_FG; this._cells[r][c].bg = DEFAULT_BG; } } break;
      case 'K': {
        const start = n === 2 ? 0 : this._cursorC;
        const end = n === 1 ? (this._cursorC + 1) : this._cols;
        for (let c = start; c < end && c < this._cols; c++) { this._cells[this._cursorR][c].char = ' '; this._cells[this._cursorR][c].fg = DEFAULT_FG; this._cells[this._cursorR][c].bg = DEFAULT_BG; }
        break;
      }
      case 's': this._savedR = this._cursorR; this._savedC = this._cursorC; break;
      case 'u': this._cursorR = this._savedR; this._cursorC = this._savedC; break;
    }
  }

  /** 进入交替屏幕 */
  private _enterAltScreen(): void {
    if (this._altMode) return;
    this._altMode = true;
    this._mainCells = this._cells;
    this._mainCursorR = this._cursorR;
    this._mainCursorC = this._cursorC;
    this._mainSavedR = this._savedR;
    this._mainSavedC = this._savedC;
    // 清屏为新网格
    const cells: Cell[][] = [];
    for (let r = 0; r < this._rows; r++) {
      const row: Cell[] = [];
      for (let c = 0; c < this._cols; c++) row.push({ char: ' ', fg: DEFAULT_FG, bg: DEFAULT_BG, bold: false });
      cells.push(row);
    }
    this._cells = cells;
    this._cursorR = 0; this._cursorC = 0;
  }

  /** 退出交替屏幕 */
  private _exitAltScreen(): void {
    if (!this._altMode) return;
    this._altMode = false;
    this._cells = this._mainCells;
    this._cursorR = this._mainCursorR;
    this._cursorC = this._mainCursorC;
    this._savedR = this._mainSavedR;
    this._savedC = this._mainSavedC;
    this._mainCells = [];
  }

  /** 滚屏：上移一行，顶部行存入滚动缓冲 */
  private _scrollUp(): void {
    this._scrollback.push(this._cells[0]);
    for (let r = 1; r < this._rows; r++) {
      this._cells[r - 1] = this._cells[r];
    }
    const empty: Cell[] = [];
    for (let c = 0; c < this._cols; c++) {
      empty.push({ char: ' ', fg: DEFAULT_FG, bg: DEFAULT_BG, bold: false });
    }
    this._cells[this._rows - 1] = empty;
  }

  /** 按总行索引取行（合并 _scrollback + _cells） */
  private _getRow(totalIdx: number): Cell[] | null {
    if (totalIdx < 0) return null;
    const sbLen = this._scrollback.length;
    if (totalIdx < sbLen) return this._scrollback[totalIdx];
    const cellIdx = totalIdx - sbLen;
    return cellIdx < this._rows ? this._cells[cellIdx] : null;
  }

  /** 销毁渲染器 */
  dispose(): void {
    if (this._canvas) {
      this._canvas.remove();
      this._canvas = null;
      this._ctx = null;
    }
    this._cells = [];
  }

  /** 设置光标色（跟随卡片 accent） */
  setAccent(color: string): void { this._accent = color; }

  /** 滚动缓冲区（deltaPx=像素，正=上滚历史，负=回底部） */
  scrollBy(deltaPx: number): void {
    const rows = Math.round(deltaPx / this._cellH);
    const maxOff = this._scrollback.length;
    this._scrollOffset = Math.max(0, Math.min(maxOff, this._scrollOffset + rows));
    this._render();
  }

  /** 注册键盘输入回调（Phase 8.6: WebSocket 桥接用） */
  onInput(fn: ((data: string) => void) | null): void { this._onInput = fn; }

  /** 注册尺寸变化回调（Phase 8.7: PTY resize 用） */
  onResize(fn: ((cols: number, rows: number) => void) | null): void { this._onResize = fn; }

  /** 设置状态提示（右下角显示） */
  setStatus(s: string): void { this._status = s; this._render(); }

  /** 绘制网格到 canvas */
  private _render(): void {
    if (!this._ctx) return;
    const ctx = this._ctx;
    const cw = this._cellW;
    const ch = this._cellH;
    const topPad = 4;

    // 全画布填充背景
    ctx.fillStyle = DEFAULT_BG;
    ctx.fillRect(0, 0, this._containerW, this._containerH);

    ctx.font = FONT;
    ctx.textBaseline = 'middle';

    // 合并渲染：_scrollback + _cells，按 _scrollOffset 偏移
    const totalRows = this._scrollback.length + this._rows;
    const visibleStart = Math.max(0, totalRows - this._rows - this._scrollOffset);

    // 第一遍：所有背景
    for (let vr = 0; vr < this._rows; vr++) {
      const row = this._getRow(visibleStart + vr);
      if (!row) continue;
      for (let c = 0; c < this._cols; c++) {
        const cell = row[c];
        if (!cell || cell.bg === DEFAULT_BG) continue;
        ctx.fillStyle = cell.bg;
        ctx.fillRect(c * cw, topPad + vr * ch, cw, ch);
      }
    }
    // 第二遍：所有文字
    for (let vr = 0; vr < this._rows; vr++) {
      const row = this._getRow(visibleStart + vr);
      if (!row) continue;
      for (let c = 0; c < this._cols; c++) {
        const cell = row[c];
        if (!cell || cell.char === ' ' || cell.char === '') continue;
        ctx.fillStyle = cell.fg;
        const wide = _isFullWidth(cell.char);
        const yOff = wide ? 1 : 0;
        const xOff = wide ? 1 : 0;
        ctx.fillText(cell.char, c * cw + xOff, topPad + (vr + 0.5) * ch + yOff);
      }
    }

    // 光标（常亮，受 ?25h/l 控制）
    if (!this._cursorHidden && this._cursorR < this._rows && this._cursorC < this._cols) {
      ctx.fillStyle = this._accent;
      ctx.fillRect(this._cursorC * cw, topPad + this._cursorR * ch, cw, ch);
    }

    // 状态（右下角）
    ctx.fillStyle = 'rgba(0,212,255,0.3)';
    ctx.font = '7px monospace';
    const sw = ctx.measureText(this._status).width;
    ctx.fillText(this._status, this._containerW - sw - 2, this._containerH - 2);
  }

  /** 步骤 1 验证：画棋盘格确认布局 */
  testRender(): void {
    if (!this._ctx || !this._canvas) return;
    const ctx = this._ctx;
    const cw = this._cellW;
    const ch = this._cellH;

    // 背景
    ctx.fillStyle = DEFAULT_BG;
    ctx.fillRect(0, 0, this._containerW, this._containerH);

    // 棋盘格
    for (let r = 0; r < this._rows; r++) {
      for (let c = 0; c < this._cols; c++) {
        if ((r + c) % 2 === 0) continue;
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(c * cw, r * ch, cw, ch);
      }
    }

    // 四角标记
    ctx.font = FONT;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#00d4ff';
    ctx.fillText('\u250C', 0, ch * 0.5);
    ctx.fillText('\u2510', (this._cols - 1) * cw, ch * 0.5);
    ctx.fillText('\u2514', 0, (this._rows - 0.5) * ch);
    ctx.fillText('\u2518', (this._cols - 1) * cw, (this._rows - 0.5) * ch);

    // 尺寸标注
    const info = this._cols + '\xd7' + this._rows + '  cw=' + cw.toFixed(1) + ' ch=' + ch.toFixed(1);
    ctx.fillStyle = 'rgba(0,212,255,0.4)';
    ctx.font = '9px monospace';
    ctx.fillText(info, 4, this._containerH - 6);
  }
}
