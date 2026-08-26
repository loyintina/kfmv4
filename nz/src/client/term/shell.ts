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

/** 终端字体栈（2026-08-24 palette-font-na-review，用户拍板换 Nerd Font
 *  不改共享 .zshrc）：捆绑 JetBrainsMonoNL NFM 打头——含 U+E0B0
 *  powerline 箭头（agnoster 提示符 `~` 两侧字形，系统 mono 栈没有 →
 *  曾渲染成错位色块）。CJK 必须不塌（中文核心场景）：NF 无中文字形，
 *  栈尾 Noto Sans CJK SC/PingFang SC/微软雅黑 fallback 兜住（浏览器按
 *  字符逐个 fallback）。字宽几何纪律：probe 量字格（term/index.ts）与
 *  壳渲染必须用同一栈——度量同源，换字体后 cell 自动从实际渲染字体取。 */
export const TERM_FONT_STACK =
  `'JetBrainsMonoNL NFM', ui-monospace, Menlo, Consolas, ` +
  `'Noto Sans CJK SC', 'PingFang SC', 'Microsoft YaHei', monospace`;

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
  /** 历史区 DOM 块（8.8.3c）：el 首子元素，滚出屏幕的行增量追加进来 */
  private historyDiv: HTMLDivElement;
  /** 已渲染历史块首行的绝对游标（=当时的 core.lines_evicted()） */
  private histEvicted = 0;
  /** 已渲染历史行数（historyDiv 子节点数应恒等于它） */
  private histCount = 0;
  private cellW = 0;
  private cellH = 0;
  private enc = new TextEncoder();
  private dec = new TextDecoder();
  /** 滚动主导权归插件集中状态机（8.8.3c 纪律）：false 时（用户上滑中）
   * 光标 nearest 兜底也歇火——否则新输出会把视口拽回底（跟底翻车态）。 */
  autoScroll = true;
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
      `font:${fs}px/1.25 ${TERM_FONT_STACK};` +
      `user-select:text;-webkit-user-select:text;overflow:hidden;`;
    this.historyDiv = document.createElement('div');
    el.appendChild(this.historyDiv);
    for (let i = 0; i < opts.rows; i++) {
      const d = document.createElement('div');
      d.style.cssText = 'white-space:pre;height:1.25em;';
      el.appendChild(d);
      this.rowDivs.push(d);
      this.rowCache.push('');
    }
    this.cursorEl = document.createElement('div');
    // class 名是判卷/取证锚点（bottom-anchor 考卷 ③ 直接 querySelector 量 rect）
    this.cursorEl.className = 'nz-term-cursor';
    this.cursorEl.style.cssText =
      `position:absolute;background:${TERM_FG};opacity:0.7;pointer-events:none;display:none;`;
    el.appendChild(this.cursorEl);
  }

  /** 换核（重连 tail 回放前重建网格）：清行缓存强制全量重排；历史块
   * 同清（新核 evicted 游标归零，旧增量失效）。 */
  setCore(core: TermCoreHandle) {
    this.core = core;
    this.rowCache = this.rowCache.map(() => '');
    this.historyDiv.textContent = '';
    this.histCount = 0;
    this.histEvicted = 0;
  }

  /** 改行数（容器可视高度变化时）：增删行 div，行缓存同步伸缩并重排。
   * resize 会让核对历史区重排（reflow）——本地增量游标失效，历史块
   * 整段重建（renderHistory 的 histCount=0 路径）。 */
  resize(rows: number) {
    if (rows === this.opts.rows) return;
    this.historyDiv.textContent = '';
    this.histCount = 0;
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

  /** 字格缓存作废（字体晚到自适应，2026-08-24 真机图A 列截断修复）：
   *  NF 字体若在首量后才加载完（fonts.load 提前 resolve 的浏览器），
   *  渲染字宽突变而缓存不刷 = 列算多截断。调用后下一帧重量。 */
  invalidateMetrics() {
    this.cellW = 0;
    this.cellH = 0;
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

  /** 历史区增量渲染（8.8.3c）：绝对游标对齐——evicted 涨=截断丢头，
   * 本地块与核区间完全错位（核重换/reflow 漏网）= 整段重建；正常路径
   * 只 append 新滚出的尾巴（history_frame(from, h)），每帧开销 ∝ 新行数。 */
  private renderHistory() {
    const ev = this.core.lines_evicted();
    const h = this.core.history_len();
    if (this.histCount > 0) {
      if (ev < this.histEvicted || ev > this.histEvicted + this.histCount) {
        // 本地块整体失效（核重换/replay）：整段重建
        this.historyDiv.textContent = '';
        this.histCount = 0;
        this.histEvicted = ev;
      } else if (ev > this.histEvicted) {
        // 截断丢头：从 DOM 顶摘 evicted 涨出来的行
        const d = Math.min(this.histCount, ev - this.histEvicted);
        for (let i = 0; i < d; i++) this.historyDiv.firstChild?.remove();
        this.histEvicted = ev;
        this.histCount -= d;
      }
    } else {
      this.histEvicted = ev;
    }
    // 本地块首行在核历史区的相对下标 + 已渲染数 = 待追加起点
    const from = (this.histEvicted - ev) + this.histCount;
    if (from >= h || from < 0) return;
    const frame = this.core.history_frame(from, h);
    for (const line of frame.split('\n')) {
      const d = document.createElement('div');
      d.style.cssText = 'white-space:pre;height:1.25em;';
      this.renderRow(d, line); // 协议同 render_frame：样式在历史区不掉
      this.historyDiv.appendChild(d);
      this.histCount++;
    }
  }

  /** 取一帧新账，只重排有变的行；再摆光标。
   * 单区底锚定（2026-08-24 用户拍板回退两区，single-zone-bottom-anchor-review）：
   * 历史+屏幕行同一个连续滚动区，无独立输入行。行模式**塌尾空行**——
   * 只渲染到 max(光标行, 最后非空行)，尾空行 display:none；配合容器
   * flex 底锚（termEl margin-top:auto）：空屏时提示符/光标贴视口底行
   * （上方留白，像内容已充满屏幕），内容增长从底往上顶，超屏后真滚动。
   * ALT_SCREEN（TUI 整屏）不塌行：全屏行列恒定，布局归 TUI 自己。 */
  renderFrame() {
    this.measure();
    this.stats.frames++;
    const alt = this.core.alt_screen();
    this.historyDiv.style.display = alt ? 'none' : '';
    if (!alt) this.renderHistory();
    const frame = this.core.render_frame();
    const lines = frame.split('\n');
    // 光标：packed row<<16|col；row 可能为负（历史区，packed 后 65535+
    // 被 row<rows 判定天然排除）则不画。可见性跟核走（DECTCEM ?25l 隐
    // 藏）：TUI 自绘反色块当光标时壳光标必须跟着藏，否则灰鬼影与反色
    // 块并排 = 双光标（真机 cb 实锤）。
    const cur = this.core.cursor();
    const row = cur >>> 16;
    const col = cur & 0xffff;
    const rowInGrid = row < this.opts.rows;
    // 塌尾空行边界：光标行与最后非空行的较大者（行模式才塌；ALT 全量）
    let lastRow = this.opts.rows - 1;
    if (!alt) {
      let last = -1;
      for (let i = 0; i < this.opts.rows; i++) {
        const l = lines[i] ?? '';
        const sep = l.indexOf('\x1f');
        if ((sep < 0 ? l : l.slice(0, sep)).trim() !== '') last = i;
      }
      lastRow = Math.max(last, rowInGrid ? row : 0);
    }
    for (let i = 0; i < this.opts.rows; i++) {
      const line = lines[i] ?? '\x1f';
      if (line !== this.rowCache[i]) {
        this.rowCache[i] = line;
        this.stats.rowsPainted++;
        this.renderRow(this.rowDivs[i], line);
      }
      const disp = !alt && i > lastRow ? 'none' : '';
      if (this.rowDivs[i].style.display !== disp) this.rowDivs[i].style.display = disp;
    }
    // 光标统一进滚动区（行模式/ALT 同式；历史块 display:none 时
    // offsetHeight=0，ALT 纵坐标天然正确）。光标跟随：只滚最近的可滚
    // 动祖先（容器），不碰页面——scrollIntoView 会把所有可滚祖先（含
    // 背景 boot 页）一起滚（实测：每敲一字全页从头往下滚、闪烁）。
    // nearest 语义手写：光标已在视野内就一动不动。autoScroll=false
    // （用户上滑中）兜底歇火。
    const showCursor = this.cellW > 0 && this.core.cursor_visible() && rowInGrid;
    if (this.cursorEl.parentElement !== this.el) this.el.appendChild(this.cursorEl);
    if (showCursor) {
      this.cursorEl.style.display = 'block';
      this.cursorEl.style.left = `${col * this.cellW}px`;
      this.cursorEl.style.top = `${this.historyDiv.offsetHeight + row * this.cellH}px`;
      this.cursorEl.style.width = `${this.cellW}px`;
      this.cursorEl.style.height = `${this.cellH}px`;
      const parent = this.el.parentElement;
      // ALT（TUI 整屏）禁滚：全屏行列恒定，TUI 自绘铺满，壳不得替它挪
      // 视口——游标越界兜底滚动在 ALT 下就是 scrollTop 失控增长的来源
      // （真机 runaway：0→72→89→137）。
      if (parent && this.autoScroll && !alt) {
        const top = this.historyDiv.offsetHeight + row * this.cellH;
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

  /** 光标格在 termEl 内的像素坐标（placeKb 诱饵钉光标格用）；
   * 光标越界/未量字格时 null。 */
  cursorOffset(): { x: number; y: number } | null {
    if (this.cellW <= 0) return null;
    const cur = this.core.cursor();
    const row = cur >>> 16;
    if (row >= this.opts.rows) return null;
    return {
      x: (cur & 0xffff) * this.cellW,
      y: this.historyDiv.offsetHeight + row * this.cellH,
    };
  }
}
