/**
 * color-utils.ts — 颜色工具函数
 *
 * 从 tree-swipe.ts 拆分。纯函数，零模块状态。
 */

export const HUE_BLUE = 220;
export const HUE_PURPLE = 265;
const HUE_RANGE = 15;
const SAT = 62;
const LIT = 55;

export function rgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return 'rgba(' + ((n >> 16) & 0xFF) + ',' + ((n >> 8) & 0xFF) + ',' + (n & 0xFF) + ',' + alpha + ')';
}

export function hslToHex(h: number, s: number, l: number): string {
  h /= 360; s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    const c = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * Math.max(0, Math.min(1, c)));
  };
  return '#' + [f(0), f(8), f(4)].map(v => v.toString(16).padStart(2, '0')).join('');
}

export function cardAccent(isDir: boolean, h1?: number, h2?: number, s?: number, l?: number): { color1: string; color2: string; off1: number; off2: number } {
  const base1 = h1 ?? HUE_BLUE;
  const base2 = h2 ?? HUE_PURPLE;
  const sat = s ?? SAT;
  const lit = l ?? LIT;
  const off1 = (Math.random() - 0.5) * HUE_RANGE * 2;
  const off2 = (Math.random() - 0.5) * HUE_RANGE * 2;
  if (isDir) {
    return { color1: hslToHex(base2 + off2, sat, lit), color2: hslToHex(base1 + off1, sat, lit), off1, off2 };
  }
  return { color1: hslToHex(base1 + off1, sat, lit), color2: hslToHex(base2 + off2, sat, lit), off1, off2 };
}

export function pathBasename(path: string): string {
  const parts = path.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || path;
}
