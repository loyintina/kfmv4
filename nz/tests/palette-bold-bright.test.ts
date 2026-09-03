/**
 * tests/palette-bold-bright.test.ts — bold-is-bright 纯函数钉（2026-09-03
 * 用户拍板，两线首次定义 bold 语义，term-contract 已登记）
 *
 * 钉 palette.ts boldBrightToken 的映射表：
 *   bold + 索引色 0-7（命名/idx 两路）→ bright 8-15；
 *   bold + 默认前景（Foreground）→ 亮白 BrightWhite；
 *   已是 bright（Bright* / idx8-15）→ 不变（不二次提亮）；
 *   256 色（idx16-255）/ RGB 直设色 → 不变；
 *   bg token / 未知 token → 原样（bold 从不染背景）。
 * 并钉映射结果在 tokenToCss 里真有色值（不落 null 丢色）。
 */
import { test, assert } from './runner.ts';
import { boldBrightToken, tokenToCss } from '../src/client/term/palette.ts';

test('boldBrightToken：bold+索引色 0-7 → bright 8-15', () => {
  assert(boldBrightToken('Red') === 'BrightRed', `Red→${boldBrightToken('Red')}`);
  assert(boldBrightToken('Black') === 'BrightBlack', 'Black→BrightBlack（bold 黑=灰）');
  assert(boldBrightToken('White') === 'BrightWhite', 'White→BrightWhite');
  assert(boldBrightToken('idx1') === 'idx9', `idx1→${boldBrightToken('idx1')}`);
  assert(boldBrightToken('idx0') === 'idx8', 'idx0→idx8');
  assert(boldBrightToken('idx7') === 'idx15', 'idx7→idx15');
});

test('boldBrightToken：bold+默认前景 → 亮白', () => {
  assert(boldBrightToken('Foreground') === 'BrightWhite', `Foreground→${boldBrightToken('Foreground')}`);
});

test('boldBrightToken：已是 bright 不再变（亮蓝 12/94 两路）', () => {
  assert(boldBrightToken('BrightBlue') === 'BrightBlue', 'BrightBlue 不变');
  assert(boldBrightToken('idx12') === 'idx12', 'idx12（亮蓝）不变');
  assert(boldBrightToken('idx8') === 'idx8', 'idx8 不变');
  assert(boldBrightToken('idx15') === 'idx15', 'idx15 不变');
});

test('boldBrightToken：256 色 / RGB 直设色不受 bold 影响', () => {
  assert(boldBrightToken('idx16') === 'idx16', 'idx16 不变');
  assert(boldBrightToken('idx196') === 'idx196', 'idx196 不变');
  assert(boldBrightToken('idx255') === 'idx255', 'idx255 不变');
  assert(boldBrightToken('rgb3b82f6') === 'rgb3b82f6', 'rgb 不变');
});

test('boldBrightToken：非前景 token 原样（bold 不染背景/未知）', () => {
  assert(boldBrightToken('Background') === 'Background', 'Background 原样');
  assert(boldBrightToken('') === '', '空 token 原样');
});

test('boldBrightToken 映射结果全部能查色（不丢色）', () => {
  for (const t of ['Red', 'Foreground', 'idx1', 'idx7', 'Black']) {
    const css = tokenToCss(boldBrightToken(t), 'fg');
    assert(css !== null && /^#[0-9a-f]{6}$/i.test(css), `${t}→${boldBrightToken(t)} 查色失败：${css}`);
  }
  // 亮红=NA ANSI_16[9] #FF5555（两线同源钉）
  assert(tokenToCss(boldBrightToken('Red'), 'fg') === '#FF5555', '亮红必须=NA 同源 #FF5555');
  assert(tokenToCss(boldBrightToken('Foreground'), 'fg') === '#FFFFFF', '默认 fg bold 必须=亮白 #FFFFFF');
});
