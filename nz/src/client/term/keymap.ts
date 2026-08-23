/**
 * src/client/term/keymap.ts — 按键映射纯逻辑（8.8.3b，A 档，无 DOM）
 *
 * 语义逐行移植 NA keymap.rs（/root/kfm-na/src/keymap.rs），两线同源：
 * ① mapText：粘滞修饰键（Ctrl/Alt/Shift，一次性粘滞由 keybar 管）× 落字
 *    文本的组合变换。kfmv4 卡片键盘的病根是 Ctrl+字母联动不上——根源是
 *    映射散在前端裸写没人判卷；这里每个组合有题盯着（tests/keymap.test.ts）。
 * ② keySeq：按键栏直接键 → 终端字节序列。方向键/Home/End 分普通模式与
 *    应用光标模式（对端开 ?1h 时要发 SS3 的 ESC O A，不是 CSI 的
 *    ESC [ A）——模式位由调用方按 core.app_cursor() 当下值传入。
 *
 * 与 NA 的差异仅在建模：Android 侧入参是键码 int，浏览器侧按键栏键是
 * 自带语义的 KeyId（键表在 keybar.ts，键序考题盯 ④纪律）。
 */

/** 按键栏直接键（浏览器侧语义 id，非 Android 键码） */
export type KeyId =
  | 'esc' | 'tab' | 'enter' | 'backspace'
  | 'up' | 'down' | 'left' | 'right'
  | 'home' | 'end' | 'pgup' | 'pgdn';

/**
 * 修饰键 × 文本 → 实际注入字节。
 * 优先级：Ctrl > Alt > Shift；多字符（中文候选落字）不转控制字节，原样过
 * （Alt 仍前置 ESC——NA 同款：Alt+多字符 = ESC + 原文）。
 */
export function mapText(ctrl: boolean, alt: boolean, shift: boolean, text: string): string {
  const chars = [...text];
  const single = chars.length === 1 ? chars[0] : null; // 空串或多字符：不转
  let out = '';
  if (alt) out += '\x1b'; // Meta 惯例：Alt+X = ESC x
  if (single !== null && ctrl && single >= '\x20' && single < '\x7f') {
    // Ctrl：ASCII 可打印 & 0x1f → 控制字节（Ctrl+C=\x03 的命根）；
    // 大小写同映射（c & 0x1f 与 C & 0x1f 同值），Ctrl 优先于 Shift
    return out + String.fromCharCode(single.charCodeAt(0) & 0x1f);
  }
  if (single !== null && shift && /^[a-z]$/i.test(single)) {
    return out + single.toUpperCase(); // Shift：单字母大写（非字母原样）
  }
  return out + text;
}

/**
 * 按键栏直接键 → 终端字节序列。appCursor = 对端开了应用光标模式（?1h）。
 * 未知键 → null（吞掉，不注入垃圾）。
 */
export function keySeq(id: KeyId, appCursor: boolean): string | null {
  switch (id) {
    case 'enter': return '\r';
    case 'backspace': return '\x7f';
    case 'esc': return '\x1b';
    case 'tab': return '\t';
    case 'pgup': return '\x1b[5~';
    case 'pgdn': return '\x1b[6~';
    // 方向键/Home/End：应用光标模式发 SS3，普通模式发 CSI
    case 'up': return appCursor ? '\x1bOA' : '\x1b[A';
    case 'down': return appCursor ? '\x1bOB' : '\x1b[B';
    case 'right': return appCursor ? '\x1bOC' : '\x1b[C';
    case 'left': return appCursor ? '\x1bOD' : '\x1b[D';
    case 'home': return appCursor ? '\x1bOH' : '\x1b[H';
    case 'end': return appCursor ? '\x1bOF' : '\x1b[F';
    default: return null;
  }
}
