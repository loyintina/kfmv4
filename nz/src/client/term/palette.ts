/**
 * src/client/term/palette.ts — 终端颜色 token → CSS 颜色。
 *
 * token 词汇表与考卷 dump.rs / wasm render_frame 同源：
 *   Foreground / Background / Black..White / BrightBlack..BrightWhite /
 *   idx{N}（xterm 256 色表）/ rgb{六位 hex}。
 * 一张表管两边，永不鸡同鸭讲。
 */

/** 16 色表（NA 同款精修板，kfm-na/src/termview.rs ANSI_16 逐值对齐
 *  ——2026-08-24 评审信 palette-font-na-review：xterm classic 刺眼
 *  （黄 #cdcd00/蓝 #0000ee），换 NA 板：黄=VGA 棕、蓝=品牌正蓝
 *  #3B82F6（原 VGA #0000AA 黑底不可读）。两线同源，观感一致。 */
const NAMED_HEX: Record<string, string> = {
  Black: '#000000', Red: '#AA0000', Green: '#00AA00', Yellow: '#AA5500',
  Blue: '#3B82F6', Magenta: '#AA00AA', Cyan: '#00AAAA', White: '#AAAAAA',
  BrightBlack: '#555555', BrightRed: '#FF5555', BrightGreen: '#55FF55',
  BrightYellow: '#FFFF55', BrightBlue: '#60A5FA', BrightMagenta: '#FF55FF',
  BrightCyan: '#55FFFF', BrightWhite: '#FFFFFF',
};

/** 主题默认色（NA DEFAULT_FG/DEFAULT_BG 对齐：白字黑底——渲染壳主题化时收编）。 */
export const TERM_FG = '#ffffff';
export const TERM_BG = '#000000';

/** idx{N} → hex：0-15 查 16 色表，16-231 是 6×6×6 立方，232-255 灰阶。 */
function indexedHex(n: number): string {
  const table = Object.values(NAMED_HEX);
  if (n < 16) return table[n];
  if (n < 232) {
    const v = n - 16;
    const lvl = (i: number) => (i === 0 ? 0 : 55 + i * 40);
    const r = lvl(Math.floor(v / 36)), g = lvl(Math.floor((v % 36) / 6)), b = lvl(v % 6);
    return `#${[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
  }
  const g = 8 + (n - 232) * 10;
  return `#${g.toString(16).padStart(2, '0').repeat(3)}`;
}

/** bold→亮色映射（bold-is-bright，2026-09-03 用户拍板，两线首次定义
 *  bold 语义，term-contract 已登记）：bold 不画粗、改亮一档。
 *  因果：NaMain/NaCJK 都只有 400 单字重，Chromium 合成加粗把像素 CJK
 *  糊成 2px 毛边、中文难认——bold 的视觉强调改走 ECMA-48 惯例的亮色。
 *  只作用于前景 token（bold 从不染背景）：
 *    索引色 0-7（含 Black..White 命名与 idx0-7）→ bright 8-15；
 *    默认前景 Foreground → 亮白 BrightWhite；
 *    已是 bright（90-97 / idx8-15 / Bright*）→ 不变；
 *    256 色（idx16-255）/ RGB 直设色 → 不变。
 *  纯函数，A 档单测直钉（tests/palette-bold-bright.test.ts）。 */
export function boldBrightToken(token: string): string {
  if (token === 'Foreground') return 'BrightWhite';
  if (token in NAMED_HEX) return token.startsWith('Bright') ? token : `Bright${token}`;
  const idx = /^idx(\d+)$/.exec(token);
  if (idx) {
    const n = Number(idx[1]);
    if (n < 8) return `idx${n + 8}`;
  }
  return token; // idx8-255 / rgb / 未知：不变
}

/** token → CSS 颜色；null = 用默认（Foreground/Background 走主题默认）。 */
export function tokenToCss(token: string, kind: 'fg' | 'bg'): string | null {
  if (token === 'Foreground' || token === 'Background') return null;
  if (token in NAMED_HEX) return NAMED_HEX[token];
  const idx = /^idx(\d+)$/.exec(token);
  if (idx) return indexedHex(Number(idx[1]));
  const rgb = /^rgb([0-9a-f]{6})$/i.exec(token);
  if (rgb) return `#${rgb[1]}`;
  return kind === 'fg' ? null : null; // 未知 token 落默认（考卷词汇表内不应发生）
}
