/**
 * src/client/term/palette.ts — 终端颜色 token → CSS 颜色。
 *
 * token 词汇表与考卷 dump.rs / wasm render_frame 同源：
 *   Foreground / Background / Black..White / BrightBlack..BrightWhite /
 *   idx{N}（xterm 256 色表）/ rgb{六位 hex}。
 * 一张表管两边，永不鸡同鸭讲。
 */

/** 16 色表（xterm 标准值）。 */
const NAMED_HEX: Record<string, string> = {
  Black: '#000000', Red: '#cd0000', Green: '#00cd00', Yellow: '#cdcd00',
  Blue: '#0000ee', Magenta: '#cd00cd', Cyan: '#00cdcd', White: '#e5e5e5',
  BrightBlack: '#7f7f7f', BrightRed: '#ff0000', BrightGreen: '#00ff00',
  BrightYellow: '#ffff00', BrightBlue: '#5c5cff', BrightMagenta: '#ff00ff',
  BrightCyan: '#00ffff', BrightWhite: '#ffffff',
};

/** 主题默认色（nz 终端底色/字色——渲染壳主题化时收编）。 */
export const TERM_FG = '#e5e5e5';
export const TERM_BG = '#0a0a0f';

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
