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

  /** 在容器内创建 canvas 并初始化 */
  mount(containerEl: HTMLElement): void {
    const metrics = getFontMetrics();
    this._cellW = metrics.cellW;
    this._cellH = metrics.cellH;
    this._dpr = window.devicePixelRatio || 1;

    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'display:block;width:100%;height:100%';
    containerEl.appendChild(canvas);
    this._canvas = canvas;
    this._ctx = canvas.getContext('2d')!;

    // 推迟到下一帧：浏览器需要完成 DOM 布局后才能读到正确的 clientRect
    requestAnimationFrame(() => {
      this._layout();
      if (this._cols > 0 && this._rows > 0) {
        this.write('\x1b[31m红色\x1b[0m 正常\r\n');
        this.write('\x1b[1;32m粗体绿\x1b[0m\r\n');
        this.write('\x1b[44m\x1b[37m白字蓝底\x1b[0m\r\n');
        this.write('> ');
      } else {
        requestAnimationFrame(() => {
          this._layout();
          if (this._cols > 0 && this._rows > 0) {
            this.write('\x1b[31m红色\x1b[0m 正常\r\n');
        this.write('\x1b[1;32m粗体绿\x1b[0m\r\n');
        this.write('\x1b[44m\x1b[37m白字蓝底\x1b[0m\r\n');
        this.write('> ');
          }
        });
      }
    });
  }

  /** 重算 cols/rows 并重建网格 */
  private _layout(): void {
    if (!this._canvas || !this._ctx) return;
    // clientWidth/Height 不受 CSS transform 影响，getBoundingClientRect 会
    this._containerW = this._canvas.clientWidth;
    this._containerH = this._canvas.clientHeight;
    if (this._containerW <= 0 || this._containerH <= 0) return;

    // DPR 处理
    this._canvas.width = this._containerW * this._dpr;
    this._canvas.height = this._containerH * this._dpr;
    this._ctx.setTransform(this._dpr, 0, 0, this._dpr, 0, 0);

    // 算行列
    this._cols = Math.floor(this._containerW / this._cellW);
    this._rows = Math.floor(this._containerH / this._cellH);

    // 建网格
    this._cells = [];
    for (let r = 0; r < this._rows; r++) {
      const row: Cell[] = [];
      for (let c = 0; c < this._cols; c++) {
        row.push({ char: ' ', fg: DEFAULT_FG, bg: DEFAULT_BG, bold: false });
      }
      this._cells.push(row);
    }
    this._cursorR = 0;
    this._cursorC = 0;
  }

  /** 网格尺寸 */
  get cols(): number { return this._cols; }
  get rows(): number { return this._rows; }

  /** 往终端写入文本，处理 \n \r \b + ANSI 转义 */
  write(text: string): void {
    if (this._cols <= 0 || this._rows <= 0) return;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];

      // ANSI 转义状态机
      if (this._inEsc) {
        if (ch === '\x1b') { this._escBuf = ''; continue; }
        if (ch === '[') continue;  // 跳过 CSI 引导符
        // CSI 终结符
        if ((ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z')) {
          if (ch === 'm') this._applySgr(this._escBuf);
          // 其他 CSI 终结符（H/A/B/C/D/J/K 等）→ 步骤 5 实现
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
    for (const s of nums) {
      const n = parseInt(s, 10);
      if (isNaN(n)) continue;
      if (n === 0) { this._curFg = DEFAULT_FG; this._curBg = DEFAULT_BG; this._curBold = false; continue; }
      if (n === 1) { this._curBold = true; continue; }
      if (n >= 30 && n <= 37) { const idx = n - 30; this._curFg = this._curBold ? ANSI_BRIGHT[idx] : ANSI_COLORS[idx]; continue; }
      if (n >= 40 && n <= 47) { this._curBg = ANSI_COLORS[n - 40]; continue; }
      if (n >= 90 && n <= 97) { this._curFg = ANSI_BRIGHT[n - 90]; continue; }
      if (n >= 100 && n <= 107) { this._curBg = ANSI_BRIGHT[n - 100]; continue; }
    }
  }

  /** 滚屏：上移一行 */
  private _scrollUp(): void {
    for (let r = 1; r < this._rows; r++) {
      this._cells[r - 1] = this._cells[r];
    }
    const empty: Cell[] = [];
    for (let c = 0; c < this._cols; c++) {
      empty.push({ char: ' ', fg: DEFAULT_FG, bg: DEFAULT_BG, bold: false });
    }
    this._cells[this._rows - 1] = empty;
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

    // 第一遍：所有背景（先画，防 CJK 第二格 fillRect 覆盖字符右半）
    for (let r = 0; r < this._rows; r++) {
      const row = this._cells[r];
      for (let c = 0; c < this._cols; c++) {
        const cell = row[c];
        if (cell.bg !== DEFAULT_BG) {
          ctx.fillStyle = cell.bg;
          ctx.fillRect(c * cw, topPad + r * ch, cw, ch);
        }
      }
    }
    // 第二遍：所有文字（画在背景上方）
    for (let r = 0; r < this._rows; r++) {
      const row = this._cells[r];
      for (let c = 0; c < this._cols; c++) {
        const cell = row[c];
        if (cell.char === ' ' || cell.char === '') continue;
        ctx.fillStyle = cell.fg;
        const wide = _isFullWidth(cell.char);
        const yOff = wide ? 1 : 0;
        const xOff = wide ? 1 : 0;
        ctx.fillText(cell.char, c * cw + xOff, topPad + (r + 0.5) * ch + yOff);
      }
    }

    // 光标（常亮）
    if (this._cursorR < this._rows && this._cursorC < this._cols) {
      ctx.fillStyle = this._accent;
      ctx.fillRect(this._cursorC * cw, topPad + this._cursorR * ch, cw, ch);
    }
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
