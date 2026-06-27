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

    this._layout();
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
  }

  /** 网格尺寸 */
  get cols(): number { return this._cols; }
  get rows(): number { return this._rows; }

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
