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

/** 终端字体栈 = NA 同款（2026-08-26 用户拍板，nz-font-adapt-review；
 *  NaMain 主（用户商业字体，ASCII/Latin；私有勿提交，见 index.html
 *  @font-face 注释），NaCJK（FusionPixelMono12-gb2312）兜 CJK/终端
 *  符号/powerline——像素等宽 CJK 字形贴格，顺带治真机 ranger 中文
 *  行上移（系统 CJK fallback 基线/光栅化差，原栈尾 Noto/PingFang
 *  那条路退役）。字宽几何纪律：probe 量字格（term/index.ts）与
 *  壳渲染必须用同一栈——度量同源，换字体后 cell 自动从实际渲染字体取。 */
export const TERM_FONT_STACK =
  `'NaMain', 'NaCJK', ui-monospace, Menlo, Consolas, monospace`;

/**
 * 宽字符区间表（有序不重叠，isWide 二分查）——真终端纪律：宽字必须
 * 裁进固定 2 格，不许按字形自然宽度推进（格网光标按 col×cellW 放，
 * 浏览器按自然宽度画 = 光标漂移真凶）。
 *
 * 单源 = rio-vt 核实测宽度（2026-08-31：全 BMP + 1F000-1FAFF 逐字符
 * 扫面 + 20000-3FFFD 抽点，对拍脚本 scripts/verify-wide-table.mjs）。
 * 修正 v1 粗正则两类错：
 *  ① 核宽壳漏——emoji 默认文本呈现区（26A1 ⚡ 等 66 字符）+ A960-A97C
 *     + FE10-FE6B + 1F004-1F265：⚡ 走自然文本只占 1 格而核给 2 格，
 *     其后整行左移 1 格 = 用户实拍「光标右移半格」真凶；
 *  ② 壳宽核窄——302A-302D/3099-309A 核 0 宽合并符（走自然文本由浏览
 *     器正确叠到基字上）、1F321 等非 emoji 呈现符（核 1 格）。
 * rio-vt 换版须重跑 verify-wide-table.mjs 对拍重核本表。
 */
const WIDE_RANGES: readonly (readonly [number, number])[] = [
  [0x1100, 0x115f], [0x231a, 0x231b], [0x2329, 0x232a], [0x23e9, 0x23ec],
  [0x23f0, 0x23f0], [0x23f3, 0x23f3], [0x25fd, 0x25fe], [0x2614, 0x2615],
  [0x2630, 0x2637], [0x2648, 0x2653], [0x267f, 0x267f], [0x268a, 0x268f],
  [0x2693, 0x2693], [0x26a1, 0x26a1], [0x26aa, 0x26ab], [0x26bd, 0x26be],
  [0x26c4, 0x26c5], [0x26ce, 0x26ce], [0x26d4, 0x26d4], [0x26ea, 0x26ea],
  [0x26f2, 0x26f3], [0x26f5, 0x26f5], [0x26fa, 0x26fa], [0x26fd, 0x26fd],
  [0x2705, 0x2705], [0x270a, 0x270b], [0x2728, 0x2728], [0x274c, 0x274c],
  [0x274e, 0x274e], [0x2753, 0x2755], [0x2757, 0x2757], [0x2795, 0x2797],
  [0x27b0, 0x27b0], [0x27bf, 0x27bf], [0x2b1b, 0x2b1c], [0x2b50, 0x2b50],
  [0x2b55, 0x2b55], [0x2e80, 0x2e99], [0x2e9b, 0x2ef3], [0x2f00, 0x2fd5],
  [0x2ff0, 0x2fff], [0x3000, 0x3029], [0x3030, 0x303e], [0x3041, 0x3096], [0x309b, 0x30ff],
  [0x3105, 0x312f], [0x3131, 0x318e], [0x3190, 0x31e5], [0x31ef, 0x321e],
  [0x3220, 0x3247], [0x3250, 0xa48c], [0xa490, 0xa4c6], [0xa960, 0xa97c],
  [0xac00, 0xd7a3], [0xf900, 0xfaff], [0xfe10, 0xfe19], [0xfe30, 0xfe4f],
  [0xfe50, 0xfe52], [0xfe54, 0xfe66], [0xfe68, 0xfe6b], [0xff01, 0xff60],
  [0xffe0, 0xffe6],
  [0x1f004, 0x1f004], [0x1f0cf, 0x1f0cf], [0x1f18e, 0x1f18e],
  [0x1f191, 0x1f19a], [0x1f200, 0x1f202], [0x1f210, 0x1f23b],
  [0x1f240, 0x1f248], [0x1f250, 0x1f251], [0x1f260, 0x1f265],
  [0x1f300, 0x1f320], [0x1f32d, 0x1f335], [0x1f337, 0x1f37c],
  [0x1f37e, 0x1f393], [0x1f3a0, 0x1f3ca], [0x1f3cf, 0x1f3d3],
  [0x1f3e0, 0x1f3f0], [0x1f3f4, 0x1f3f4], [0x1f3f8, 0x1f3fa], [0x1f400, 0x1f43e],
  [0x1f440, 0x1f440], [0x1f442, 0x1f4fc], [0x1f4ff, 0x1f53d],
  [0x1f54b, 0x1f54e], [0x1f550, 0x1f567], [0x1f57a, 0x1f57a],
  [0x1f595, 0x1f596], [0x1f5a4, 0x1f5a4], [0x1f5fb, 0x1f64f],
  [0x1f680, 0x1f6c5], [0x1f6cc, 0x1f6cc], [0x1f6d0, 0x1f6d2],
  [0x1f6d5, 0x1f6d8], [0x1f6dc, 0x1f6df], [0x1f6eb, 0x1f6ec],
  [0x1f6f4, 0x1f6fc], [0x1f7e0, 0x1f7eb], [0x1f7f0, 0x1f7f0],
  [0x1f90c, 0x1f93a], [0x1f93c, 0x1f945], [0x1f947, 0x1f9ff],
  [0x1fa70, 0x1fa7c], [0x1fa80, 0x1fa8a], [0x1fa8e, 0x1fac6],
  [0x1fac8, 0x1fac8], [0x1facd, 0x1fadc], [0x1fadf, 0x1faea],
  [0x1faef, 0x1faf8], [0x20000, 0x3fffd],
];

/** 码点是否宽字符（2 格）。WIDE_RANGES 有序不重叠，二分。 */
function isWide(cp: number): boolean {
  let lo = 0;
  let hi = WIDE_RANGES.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const [a, b] = WIDE_RANGES[mid];
    if (cp < a) hi = mid - 1;
    else if (cp > b) lo = mid + 1;
    else return true;
  }
  return false;
}

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
  /** CJK 墨迹顶对齐补偿 px（measure() 量出；宽字 span 下移量，见 measure 注释） */
  private cjkDrop = 0;
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
  }  constructor(
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
    // CJK 墨迹顶对齐补偿（2026-08-26 ranger-cjk-baseline-fix-review）：
    // 中英同基线（真机 cjk-probe spanH=16.25/shift=0 已证行盒无恙），但
    // CJK 字形按 em 方设计、ink 顶比 Latin 高 1-2px、更满格——「中文行
    // 上移」真凶=字形墨迹几何差，换字体治不了（FusionPixel 同症）。用
    // canvas 同栈量两侧 actualBoundingBoxAscent，差值=宽字 span 的下移
    // 量（appendTextCells 里 position:relative;top 挪视觉、不动布局、
    // 不碰行高亮背景）。clamp 0-3 防异常字体度量带飞。
    const cv = document.createElement('canvas').getContext('2d');
    if (cv) {
      cv.font = `${this.opts.fontSize ?? 13}px ${TERM_FONT_STACK}`;
      const ascA = cv.measureText('A').actualBoundingBoxAscent;
      const ascC = cv.measureText('中').actualBoundingBoxAscent;
      this.cjkDrop = Math.max(0, Math.min(3, +(ascC - ascA).toFixed(2)));
    }
  }

  /** 字格缓存作废（字体晚到自适应，2026-08-24 真机图A 列截断修复）：
   *  主字体若在首量后才加载完（fonts.load 提前 resolve 的浏览器），
   *  渲染字宽突变而缓存不刷 = 列算多截断。调用后下一帧重量（cjkDrop
   *  同随重量——字体落地后墨迹 ascent 才真）。 */
  invalidateMetrics() {
    this.cellW = 0;
    this.cellH = 0;
    this.cjkDrop = 0;
  }

  /** 往容器里填文本：宽字符逐个裁进 2×cellW 固定格（inline-block 裁切），
   * 窄字符走自然文本。cellW 未量出时退化为纯文本（首帧前不裁）。 */
  private appendTextCells(parent: HTMLElement, text: string) {
    if (this.cellW <= 0 || ![...text].some((ch) => isWide(ch.codePointAt(0)!))) {
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
      if (isWide(ch.codePointAt(0)!)) {
        flush();
        const w = document.createElement('span');
        // position:relative+top=cjkDrop：CJK 墨迹顶比 Latin 高 1-2px
        // （字形 em 方设计，非行盒问题），整盒下移对齐英文 ink 顶；
        // 挪视觉不动布局，行高亮背景（外层样式 span）不受影响。
        w.style.cssText = `display:inline-block;width:${2 * this.cellW}px;overflow:hidden;white-space:pre;`
          + (this.cjkDrop > 0 ? `position:relative;top:${this.cjkDrop}px;` : '');
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

  /** 当前可视屏纯文本（实验台 P0 读屏钩子，nz-device-agent-p0-review）：
   * 取壳实际渲染的屏幕行 div（塌尾 display:none 行不计）——与渲染态
   * 同源、不建副本。语义=终端「屏幕格网」（行模式=塌尾后可见行、
   * ALT=TUI 整屏），不含 scrollback 历史区；历史/格网结构后补并列
   * 钩子（ScreenGrid/ScreenAt）覆盖。 */
  screenText(): string {
    const out: string[] = [];
    for (const d of this.rowDivs) {
      if (d.style.display !== 'none') out.push(d.textContent ?? '');
    }
    return out.join('\n');
  }

  /** 画布重画眼（2026-08-28 用户拍板，仿 na shot 离屏光栅化思路）：
   * Android 后台 WebView 合成器不产帧，CDP captureScreenshot 必超时；
   * 但 2D canvas 软件光栅化在 CPU 侧、不经过合成器，后台照常出图。
   * 把当前可视区 DOM（历史块+屏幕行>样式段>宽字叶段、光标块）逐元素
   * 按 getBoundingClientRect 重画进 canvas 返 dataURL——颜色/几何/
   * cjkDrop 位移与真实渲染态同源。重画非合成器实拍：抗锯齿级细节、
   * 下划线等装饰不保真，够定位「画了什么/在哪/什么色」。 */
  canvasShot(viewport: HTMLElement, scale = 2): string {
    let vp = viewport.getBoundingClientRect();
    if (vp.width < 10 || vp.height < 10) {
      // 后台塌视口退化路径（真机实测：App 后台 innerWidth/innerHeight=0，
      // 视口驱动的 scrollEl 量出 0×0，但内容驱动的行 rect 仍是真值）。
      // 退化为全内容幅面：原点=壳容器左上，宽=列数×字格，高=历史块+可见行。
      const er = this.el.getBoundingClientRect();
      const vis = this.rowDivs.filter((d) => d.style.display !== 'none').length;
      const w = Math.max(1, Math.round(this.opts.cols * (this.cellW || 8)));
      const h = Math.max(1, Math.round(this.historyDiv.offsetHeight + vis * (this.cellH || 16)));
      vp = { left: er.left, top: er.top, right: er.left + w, bottom: er.top + h, width: w, height: h } as DOMRect;
    }
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(vp.width * scale));
    c.height = Math.max(1, Math.round(vp.height * scale));
    const g = c.getContext('2d');
    if (!g) return '';
    g.scale(scale, scale);
    g.fillStyle = TERM_BG;
    g.fillRect(0, 0, vp.width, vp.height);
    g.textBaseline = 'middle';
    const paint = (text: string, r: DOMRect, css: CSSStyleDeclaration) => {
      const bg = css.backgroundColor;
      if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
        g.fillStyle = bg;
        g.fillRect(r.left - vp.left, r.top - vp.top, r.width, r.height);
      }
      if (!text.trim()) return;
      g.font = css.font;
      g.fillStyle = css.color;
      g.fillText(text, r.left - vp.left, r.top - vp.top + r.height / 2);
    };
    const range = document.createRange();
    const walk = (node: Node, css: CSSStyleDeclaration) => {
      if (node.nodeType === 3) {
        range.selectNodeContents(node);
        paint(node.textContent ?? '', range.getBoundingClientRect(), css);
        return;
      }
      const elN = node as HTMLElement;
      const elCss = getComputedStyle(elN);
      if (elN.children.length === 0) {
        paint(elN.textContent ?? '', elN.getBoundingClientRect(), elCss);
        return;
      }
      for (const ch of elN.childNodes) walk(ch, elCss);
    };
    const rows: HTMLElement[] = [
      ...(Array.from(this.historyDiv.children) as HTMLElement[]),
      ...this.rowDivs,
    ];
    for (const row of rows) {
      if (row.style.display === 'none') continue;
      const rr = row.getBoundingClientRect();
      if (rr.height === 0 || rr.bottom < vp.top || rr.top > vp.bottom) continue;
      for (const n of row.childNodes) walk(n, getComputedStyle(row));
    }
    // 光标块（display:none 时 rect 全 0 自动跳过）
    const cr = this.cursorEl.getBoundingClientRect();
    if (cr.height > 0 && cr.bottom >= vp.top && cr.top <= vp.bottom) {
      paint('', cr, getComputedStyle(this.cursorEl));
    }
    return c.toDataURL('image/png');
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

  /** 客户端像素坐标 → 屏幕格网 0 基 {col,row}（SGR 鼠标上报换算用）。
   * 行模式滚进历史区/越出屏幕格网时 null（历史行不属格网，不上报）；
   * ALT 态 historyDiv 隐藏（offsetHeight=0），整屏即格网。 */
  cellAtPoint(clientX: number, clientY: number): { col: number; row: number } | null {
    if (this.cellW <= 0 || this.cellH <= 0) return null;
    const r = this.el.getBoundingClientRect();
    const col = Math.floor((clientX - r.left) / this.cellW);
    const row = Math.floor((clientY - r.top - this.historyDiv.offsetHeight) / this.cellH);
    if (col < 0 || col >= this.opts.cols || row < 0 || row >= this.opts.rows) return null;
    return { col, row };
  }
}
