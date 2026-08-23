/**
 * src/client/term/shell.ts — 终端渲染壳（8.8.2②，选型 C：行级 DOM）。
 *
 * 职责：把 wasm 解析核（TermCore）的记账本画到屏幕上。一行一个 div，
 * 行内同样式连续段一个 span。行文本带缓存——哪行变了才重排哪行。
 * 复制/选择手柄/系统放大镜 = 浏览器原生（字是真 DOM 文字），零自研。
 *
 * 取数协议（render_frame，wasm 侧注释为准）：行间 '\n'；每行
 * `{text}\x1f{runs}`，runs = `start,fg,bg,attrs;` 重复；start 是
 * **UTF-8 字节下标**（CJK 3 字节，JS 侧须按字节切而非 UTF-16 下标）。
 * 属性字母串 b/i/u/s/v/d/h：bold/italic/underline/strikeout/inverse/dim/hidden。
 */
import type { TermCoreHandle } from '../term-core.js';
import { tokenToCss, TERM_FG, TERM_BG } from './palette.js';

/**
 * 宽字符（EAW Wide/Fullwidth + 常用 emoji 区间）——真终端纪律：宽字
 * 必须裁进固定 2 格，不许按字形自然宽度推进（IME 黑匣子定位：格网
 * 光标按 col×cellW 放，浏览器却按自然宽度画 CJK ≈2.4 格/字，每字
 * 累积偏 0.4 格 = 光标漂移真凶）。v1 区间覆盖常用 CJK/全角/emoji，
 * 生僻区间漏判留宽字符表完善小步。
 */
const WIDE_CHAR = /[\u1100-\u115F\u2E80-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE30-\uFE4F\uFF00-\uFF60\uFFE0-\uFFE6\u{1F300}-\u{1FAFF}\u{20000}-\u{3FFFD}]/u;

export interface TermShellOpts {
  cols: number;
  rows: number;
  fontSize?: number; // px，默认 13
}

export class TermShell {
  private rowDivs: HTMLDivElement[] = [];
  private rowCache: string[] = [];
  private cursorEl: HTMLDivElement;
  private cellW = 0;
  private cellH = 0;
  private enc = new TextEncoder();
  private dec = new TextDecoder();
  /** 渲染健康统计（?debug 骨架常驻字段源：frames/rowsPainted/scrolls——
   * scrolls = nearest 兜底实际滚动次数；rp/sc 突增 = 重绘或滚动挤兑） */
  readonly stats = { frames: 0, rowsPainted: 0, scrolls: 0 };

  /** 字格尺寸（评审光标漂移探针取证用；measure() 跑过后才有真值，未量为 0） */
  get metrics(): { cellW: number; cellH: number } {
    return { cellW: this.cellW, cellH: this.cellH };
  }

  constructor(
    private core: TermCoreHandle,
    private el: HTMLElement,
    private opts: TermShellOpts,
  ) {
    const fs = opts.fontSize ?? 13;
    el.classList.add('nz-term');
    el.style.cssText =
      `position:relative;background:${TERM_BG};color:${TERM_FG};` +
      `font:${fs}px/1.25 ui-monospace,Menlo,Consolas,monospace;` +
      `user-select:text;-webkit-user-select:text;overflow:hidden;`;
    for (let i = 0; i < opts.rows; i++) {
      const d = document.createElement('div');
      d.style.cssText = 'white-space:pre;height:1.25em;';
      el.appendChild(d);
      this.rowDivs.push(d);
      this.rowCache.push('');
    }
    this.cursorEl = document.createElement('div');
    this.cursorEl.style.cssText =
      `position:absolute;background:${TERM_FG};opacity:0.7;pointer-events:none;display:none;`;
    el.appendChild(this.cursorEl);
  }

  /** 换核（重连 tail 回放前重建网格）：清行缓存强制全量重排。 */
  setCore(core: TermCoreHandle) {
    this.core = core;
    this.rowCache = this.rowCache.map(() => '');
  }

  /** 改行数（容器可视高度变化时）：增删行 div，行缓存同步伸缩并重排。 */
  resize(rows: number) {
    if (rows === this.opts.rows) return;
    while (this.rowDivs.length < rows) {
      const d = document.createElement('div');
      d.style.cssText = 'white-space:pre;height:1.25em;';
      this.el.insertBefore(d, this.cursorEl);
      this.rowDivs.push(d);
      this.rowCache.push('');
    }
    while (this.rowDivs.length > rows) {
      this.rowDivs.pop()!.remove();
      this.rowCache.pop();
    }
    this.opts.rows = rows;
    this.renderFrame();
  }

  /** 量一个字符格的像素尺寸（等宽字体，测一次缓存）。 */
  private measure() {
    if (this.cellW > 0) return;
    const probe = document.createElement('span');
    probe.textContent = '0'.repeat(10);
    probe.style.cssText = 'visibility:hidden;white-space:pre;';
    this.rowDivs[0].appendChild(probe);
    this.cellW = probe.getBoundingClientRect().width / 10;
    this.cellH = this.rowDivs[0].getBoundingClientRect().height;
    probe.remove();
  }

  /** 往容器里填文本：宽字符逐个裁进 2×cellW 固定格（inline-block 裁切），
   * 窄字符走自然文本。cellW 未量出时退化为纯文本（首帧前不裁）。 */
  private appendTextCells(parent: HTMLElement, text: string) {
    if (this.cellW <= 0 || !WIDE_CHAR.test(text)) {
      parent.appendChild(document.createTextNode(text));
      return;
    }
    let buf = '';
    const flush = () => {
      if (buf) {
        parent.appendChild(document.createTextNode(buf));
        buf = '';
      }
    };
    for (const ch of text) {
      if (WIDE_CHAR.test(ch)) {
        flush();
        const w = document.createElement('span');
        w.style.cssText = `display:inline-block;width:${2 * this.cellW}px;overflow:hidden;white-space:pre;`;
        w.textContent = ch;
        parent.appendChild(w);
      } else {
        buf += ch;
      }
    }
    flush();
  }

  /** 把一行 text+runs 渲染进 row div。runs 的 start 是字节下标。 */
  private renderRow(div: HTMLDivElement, line: string) {
    const sep = line.indexOf('\x1f');
    const text = sep < 0 ? line : line.slice(0, sep);
    const runsRaw = sep < 0 ? '' : line.slice(sep + 1);
    const bytes = this.enc.encode(text);
    div.textContent = '';
    // 解析样式边界：start,fg,bg,attrs;（空样式 = 回到默认的边界）
    const runs: { start: number; style: string | null }[] = [];
    for (const item of runsRaw.split(';')) {
      if (!item) continue;
      const [start, fg = '', bg = '', attrs = ''] = item.split(',');
      runs.push({
        start: Number(start),
        style: fg === '' && bg === '' && attrs === '' ? null : `${fg},${bg},${attrs}`,
      });
    }
    const appendSeg = (from: number, to: number, style: string | null) => {
      if (to <= from) return;
      const seg = this.dec.decode(bytes.subarray(from, to));
      if (!seg) return;
      if (style === null) {
        this.appendTextCells(div, seg);
        return;
      }
      const [fg, bg, attrs] = style.split(',');
      const span = document.createElement('span');
      const inverse = attrs.includes('v');
      const fgCss = tokenToCss(fg, 'fg');
      const bgCss = tokenToCss(bg, 'bg');
      // inverse：fg/bg 互换（默认色也参与换）
      const effFg = inverse ? (bgCss ?? TERM_BG) : fgCss;
      const effBg = inverse ? (fgCss ?? TERM_FG) : bgCss;
      if (effFg) span.style.color = effFg;
      if (effBg) span.style.background = effBg;
      if (attrs.includes('b')) span.style.fontWeight = 'bold';
      if (attrs.includes('i')) span.style.fontStyle = 'italic';
      const deco = [attrs.includes('u') ? 'underline' : '', attrs.includes('s') ? 'line-through' : '']
        .filter(Boolean).join(' ');
      if (deco) span.style.textDecoration = deco;
      if (attrs.includes('d')) span.style.opacity = '0.6';
      if (attrs.includes('h')) span.style.visibility = 'hidden';
      this.appendTextCells(span, seg);
      div.appendChild(span);
    };
    let cursor = 0;
    for (let i = 0; i < runs.length; i++) {
      if (runs[i].start > cursor) appendSeg(cursor, runs[i].start, null);
      const end = i + 1 < runs.length ? runs[i + 1].start : bytes.length;
      appendSeg(runs[i].start, end, runs[i].style);
      cursor = end;
    }
    if (cursor < bytes.length) appendSeg(cursor, bytes.length, null);
  }

  /** 取一帧新账，只重排有变的行；再摆光标。 */
  renderFrame() {
    this.measure();
    this.stats.frames++;
    const frame = this.core.render_frame();
    const lines = frame.split('\n');
    for (let i = 0; i < this.opts.rows; i++) {
      const line = lines[i] ?? '\x1f';
      if (line === this.rowCache[i]) continue;
      this.rowCache[i] = line;
      this.stats.rowsPainted++;
      this.renderRow(this.rowDivs[i], line);
    }
    // 光标：packed row<<16|col；row 可能为负（历史区）则不画。
    // 可见性跟核走（DECTCEM ?25l 隐藏）：TUI 自绘反色块当光标时壳光标
    // 必须跟着藏，否则灰鬼影与反色块并排 = 双光标（真机 cb 实锤）。
    const cur = this.core.cursor();
    const row = cur >>> 16;
    const col = cur & 0xffff;
    if (row < this.opts.rows && this.cellW > 0 && this.core.cursor_visible()) {
      this.cursorEl.style.display = 'block';
      this.cursorEl.style.left = `${col * this.cellW}px`;
      this.cursorEl.style.top = `${row * this.cellH}px`;
      this.cursorEl.style.width = `${this.cellW}px`;
      this.cursorEl.style.height = `${this.cellH}px`;
      // 光标跟随：只滚最近的可滚动祖先（容器），不碰页面——scrollIntoView
      // 会把所有可滚祖先（含背景 boot 页）一起滚（实测：每敲一字全页从头
      // 往下滚、闪烁）。nearest 语义手写：光标已在视野内就一动不动。
      const parent = this.el.parentElement;
      if (parent) {
        const top = row * this.cellH;
        if (top < parent.scrollTop) {
          parent.scrollTop = top;
          this.stats.scrolls++;
        } else if (top + this.cellH > parent.scrollTop + parent.clientHeight) {
          parent.scrollTop = top + this.cellH - parent.clientHeight;
          this.stats.scrolls++;
        }
      }
    } else {
      this.cursorEl.style.display = 'none';
    }
  }
}
