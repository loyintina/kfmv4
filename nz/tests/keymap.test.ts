/**
 * tests/keymap.test.ts — 按键栏 keymap/keybar 纯逻辑 A 档考题（8.8.3b）
 *
 * 语义基准 = NA keymap.rs/keybar.rs（两线同源，键序/映射逐格对齐）。
 *
 * 变异抽检靶子（本文件指定）：
 *   ①方向键 ?1h 时发 CSI（ESC [ A）而非 SS3（ESC O A）→ 两向钉红；
 *   ②粘滞 take 读走不清零（联动不灭）→ 「一次性粘滞」钉红；
 *   ③Ctrl 映射漏 & 0x1f 或多字符也转 → 「控制字节」钉红；
 *   ④键序错位（↑↓ 不同列 / Enter 不在下排末位）→ 「键表序」钉红。
 */
import { test, group, assert } from './runner.ts';
import { mapText, keySeq } from '../src/client/term/keymap.ts';
import { KEYS, MOD_ALT, MOD_CTRL, MOD_SHIFT, ModifierState } from '../src/client/term/keybar.ts';

group('keymap（按键映射纯逻辑，NA 同源）');

test('Ctrl+ASCII → 控制字节（Ctrl+C=\\x03 的命根）', () => {
  assert(mapText(true, false, false, 'c') === '\x03', 'Ctrl+c 应为 \\x03');
  assert(mapText(true, false, false, 'C') === '\x03', 'Ctrl+C 大小写同映射');
  assert(mapText(true, true, false, 'c') === '\x1b\x03', 'Ctrl+Alt 同按：ESC 前置 + 控制字节');
});

test('Ctrl 优先于 Shift；多字符（中文落字）不转控制字节', () => {
  assert(mapText(true, false, true, 'c') === '\x03', 'Ctrl+Shift+c 仍 \\x03');
  assert(mapText(true, false, false, '中文') === '中文', '多字符原样过');
  assert(mapText(true, false, false, '中') === '中', '非 ASCII 单字符不转');
  assert(mapText(true, false, false, '') === '', '空串原样');
});

test('Alt+X = ESC x（Meta 惯例，多字符也前置）', () => {
  assert(mapText(false, true, false, 'x') === '\x1bx', 'Alt+x 应为 ESC x');
  assert(mapText(false, true, false, '中文') === '\x1b中文', 'Alt+多字符 = ESC + 原文');
});

test('Shift：单字母大写，非字母原样', () => {
  assert(mapText(false, false, true, 'a') === 'A', 'Shift+a 应大写');
  assert(mapText(false, false, true, '1') === '1', 'Shift+数字原样（键盘自己管符号）');
  assert(mapText(false, false, false, 'a') === 'a', '无修饰原样');
});

test('keySeq：方向键/Home/End 吃 app_cursor 模式位（?1h → SS3，否则 CSI）', () => {
  assert(keySeq('up', false) === '\x1b[A', '普通模式 ↑ = CSI A');
  assert(keySeq('up', true) === '\x1bOA', '应用光标模式 ↑ = SS3 A');
  assert(keySeq('down', false) === '\x1b[B' && keySeq('down', true) === '\x1bOB', '↓ 两模式');
  assert(keySeq('left', false) === '\x1b[D' && keySeq('left', true) === '\x1bOD', '← 两模式');
  assert(keySeq('right', false) === '\x1b[C' && keySeq('right', true) === '\x1bOC', '→ 两模式');
  assert(keySeq('home', false) === '\x1b[H' && keySeq('home', true) === '\x1bOH', 'Home 两模式');
  assert(keySeq('end', false) === '\x1b[F' && keySeq('end', true) === '\x1bOF', 'End 两模式');
});

test('keySeq：定值键不随模式变', () => {
  assert(keySeq('esc', false) === '\x1b' && keySeq('esc', true) === '\x1b', 'ESC');
  assert(keySeq('tab', false) === '\t', 'TAB');
  assert(keySeq('enter', false) === '\r', 'ENTER');
  assert(keySeq('backspace', false) === '\x7f', 'Backspace=DEL');
  assert(keySeq('pgup', false) === '\x1b[5~' && keySeq('pgdn', true) === '\x1b[6~', 'PgUp/PgDn');
});

group('keybar（键表序 + 一次性粘滞）');

test('键表序与 NA KEYS 逐格对齐（两排七列，↑↓ 同列第 5 列）', () => {
  const labels = KEYS.map((row) => row.map((k) => k.label));
  assert(labels.length === 2 && labels.every((r) => r.length === 7), '两排七列');
  assert(labels[0].join(',') === 'ESC,ALT,HOME,PGUP,↑,PGDN,SHIFT', `上排序 ${labels[0]}`);
  assert(labels[1].join(',') === 'TAB,CTRL,END,←,↓,→,ENTER', `下排序 ${labels[1]}`);
  assert(KEYS[0][4].direct === 'up' && KEYS[1][4].direct === 'down', '↑↓ 严格同列');
  assert(KEYS[0][1].mod === MOD_ALT && KEYS[1][1].mod === MOD_CTRL && KEYS[0][6].mod === MOD_SHIFT,
    '三修饰键位（ALT 上 2 / CTRL 下 2 / SHIFT 上 7）');
});

test('修饰键一次性粘滞：toggle 点亮，take 读走清零', () => {
  const m = new ModifierState();
  assert(m.peek() === 0, '初始无粘滞');
  assert(m.toggle(MOD_CTRL) === MOD_CTRL && m.peek() === MOD_CTRL, 'toggle 点亮');
  assert(m.take() === MOD_CTRL, 'take 读走');
  assert(m.peek() === 0, 'take 后清零（联动一次自动灭）');
  m.toggle(MOD_CTRL); m.toggle(MOD_ALT);
  assert(m.take() === (MOD_CTRL | MOD_ALT), '组合粘滞一次读走');
  assert(m.peek() === 0, '组合也清零');
  m.toggle(MOD_SHIFT); m.toggle(MOD_SHIFT);
  assert(m.peek() === 0, '再点同键=取消');
});
