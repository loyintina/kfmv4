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

const FONT = '11px monospace';

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
  private _cursorVisible = true;
  private _blinkTimer: ReturnType<typeof setInterval> | null = null;

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
        this.write('hello\r\nworld\r\n> ');
        this._startBlink();
      } else {
        requestAnimationFrame(() => {
          this._layout();
          if (this._cols > 0 && this._rows > 0) {
            this.write('hello\r\nworld\r\n> ');
            this._startBlink();
          }
        });
      }
    });
  }

  /** 重算 cols/rows 并重建网格 */
  private _layout(): void {
    if (!this._canvas || !this._ctx) return;
    const rect = this._canvas.getBoundingClientRect();
    this._containerW = rect.width;
    this._containerH = rect.height;
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

  /** 往终端写入文本，处理 \n \r \b */
  write(text: string): void {
    if (this._cols <= 0 || this._rows <= 0) return;
    this._cursorVisible = true;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '\r') {
        this._cursorC = 0;
        continue;
      }
      if (ch === '\n') {
        this._cursorR++;
        this._cursorC = 0;
        if (this._cursorR >= this._rows) {
          // 滚屏：上移一行
          for (let r = 1; r < this._rows; r++) {
            this._cells[r - 1] = this._cells[r];
          }
          // 新空行
          const empty: Cell[] = [];
          for (let c = 0; c < this._cols; c++) {
            empty.push({ char: ' ', fg: DEFAULT_FG, bg: DEFAULT_BG, bold: false });
          }
          this._cells[this._rows - 1] = empty;
          this._cursorR = this._rows - 1;
        }
        continue;
      }
      if (ch === '\b') {
        if (this._cursorC > 0) this._cursorC--;
        continue;
      }
      // 可打印字符
      if (this._cursorR < this._rows && this._cursorC < this._cols) {
        this._cells[this._cursorR][this._cursorC].char = ch;
      }
      this._cursorC++;
      if (this._cursorC >= this._cols) {
        this._cursorC = 0;
        this._cursorR++;
        if (this._cursorR >= this._rows) {
          for (let r = 1; r < this._rows; r++) {
            this._cells[r - 1] = this._cells[r];
          }
          const empty: Cell[] = [];
          for (let c = 0; c < this._cols; c++) {
            empty.push({ char: ' ', fg: DEFAULT_FG, bg: DEFAULT_BG, bold: false });
          }
          this._cells[this._rows - 1] = empty;
          this._cursorR = this._rows - 1;
        }
      }
    }
    this._render();
  }

  /** 启动光标闪烁定时器 */
  private _startBlink(): void {
    if (this._blinkTimer) return;
    this._blinkTimer = setInterval(() => {
      this._cursorVisible = !this._cursorVisible;
      this._render();
    }, 530);
  }

  /** 销毁渲染器 */
  dispose(): void {
    if (this._blinkTimer) {
      clearInterval(this._blinkTimer);
      this._blinkTimer = null;
    }
    if (this._canvas) {
      this._canvas.remove();
      this._canvas = null;
      this._ctx = null;
    }
    this._cells = [];
  }

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

    for (let r = 0; r < this._rows; r++) {
      const row = this._cells[r];
      for (let c = 0; c < this._cols; c++) {
        const cell = row[c];
        if (cell.bg !== DEFAULT_BG) {
          ctx.fillStyle = cell.bg;
          ctx.fillRect(c * cw, topPad + r * ch, cw, ch);
        }
        if (cell.char === ' ') continue;
        ctx.fillStyle = cell.fg;
        ctx.fillText(cell.char, c * cw, topPad + (r + 0.5) * ch);
      }
    }

    // 光标
    if (this._cursorVisible && this._cursorR < this._rows && this._cursorC < this._cols) {
      ctx.fillStyle = currentTheme.canvas.accent;
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
