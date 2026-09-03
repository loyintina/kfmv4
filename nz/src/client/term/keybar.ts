/**
 * src/client/term/keybar.ts — 仿 Termux 快捷键行（8.8.3b，keybar UI）
 *
 * 布局/纪律照 NA keybar.rs 定稿（/root/kfm-na/src/keybar.rs）：
 *   上排: [Esc] [Alt] [Home] [PgUp] [ ↑ ] [PgDn] [Shift]
 *   下排: [Tab] [Ctrl] [End]  [ ← ] [ ↓ ] [ → ]  [Enter]
 * ↑↓ 严格同列（第 5 列），方向十字 ←↓→ 在下排 4/5/6 列（右手惯用）。
 *
 * 四条纪律：
 * ① 修饰键一次性粘滞（Termux 同款）：toggle 点亮，下一次落字时 take 读走
 *    清零（联动一次自动灭）；映射逻辑在 keymap.ts（纯逻辑，A 档有题）。
 * ③ 栏随软键盘上浮：钉 visual viewport（top = vv.offsetTop + vv.height
 *    - 栏高），栏底沿精确贴可视底——不以 innerHeight 为基准（chrome 显示
 *    时两者差 1-2px，底边必被盖，8.8.3b 真机数字实锤）；键盘弹起栏跟着
 *    上浮（NA 16777485 实拍教训：画死在屏底会被弹起的键盘盖住）。
 * ④ 键位序按 KEYS 表（与 NA KEYS 逐格对齐，键序有考题盯）。
 * 浏览器侧特有一条：按键**不得抢焦点**——焦点离开诱饵 textarea 软键盘就
 * 收（pointerdown preventDefault 拦默认焦点转移，按下即触发不等抬手）。
 *
 * 2026-09-03 迁皮（清单 docs/keybar-v3-state-machine.md）：DOM 生成与样式
 * 已迁 React 皮（term/KeybarApp.tsx，装配方案 A），本文件只留骨——KEYS
 * 键表/MOD 位值/ModifierState/REPEAT 常量/KEYBAR_H/接口形状，纯逻辑原样。
 */
import type { KeyId } from './keymap.js';

/** 栏高（CSS px，两排）：终端容器底部要预留这么高（见 term 插件装配） */
export const KEYBAR_H = 84;

/** 修饰键位掩码（与 NA MOD_CTRL/ALT/SHIFT 同值） */
export const MOD_CTRL = 1;
export const MOD_ALT = 2;
export const MOD_SHIFT = 4;

/** 可长按重复的直发键（2026-09-03 用户拍板：方向键长按循环发送，
 *  在输入文字内部快速跳转）。仅方向键——ESC/ENTER/HOME 等重复无意义
 *  且有副作用。手感：按下即发一次，按住 400ms 起每 65ms 重复
 *  （≈15 字/秒，与桌面终端键重复节奏同档）。 */
export const REPEAT_KEYS = new Set<KeyId>(['up', 'down', 'left', 'right']);
export const REPEAT_DELAY_MS = 400;
export const REPEAT_INTERVAL_MS = 65;

export interface KeyDef {
  label: string;
  /** 直接键：发 keySeq(id, appCursor)；修饰键：翻粘滞位 */
  direct?: KeyId;
  mod?: number;
}

/** 键表：[行][列]，行 0 = 上排（与 NA KEYS 逐格对齐，键序有题盯） */
export const KEYS: KeyDef[][] = [
  [
    { label: 'ESC', direct: 'esc' },
    { label: 'ALT', mod: MOD_ALT },
    { label: 'HOME', direct: 'home' },
    { label: 'PGUP', direct: 'pgup' },
    { label: '↑', direct: 'up' },
    { label: 'PGDN', direct: 'pgdn' },
    { label: 'SHIFT', mod: MOD_SHIFT },
  ],
  [
    { label: 'TAB', direct: 'tab' },
    { label: 'CTRL', mod: MOD_CTRL },
    { label: 'END', direct: 'end' },
    { label: '←', direct: 'left' },
    { label: '↓', direct: 'down' },
    { label: '→', direct: 'right' },
    { label: 'ENTER', direct: 'enter' },
  ],
];

/** 修饰键粘滞状态（一次性粘滞语义的载体；TS 单线程，无需原子量） */
export class ModifierState {
  private bits = 0;
  /** 当前粘滞位掩码（0 = 无） */
  peek(): number { return this.bits; }
  /** 翻粘滞位（Modifier 键点按），返回新状态 */
  toggle(bit: number): number { this.bits ^= bit; return this.bits; }
  /** 读走并清零（一次性粘滞：落字时调用，联动一次自动灭） */
  take(): number { const b = this.bits; this.bits = 0; return b; }
}

export interface KeybarHooks {
  /** 直接键发序列（实现里实时读 core.app_cursor() 翻 SS3/CSI） */
  send(bytes: string): void;
  /** 实时读对端应用光标模式（?1h） */
  appCursor(): boolean;
}

export interface KeybarHandle {
  readonly el: HTMLElement;
  readonly mods: ModifierState;
  /** 布局从命（两区模型 2026-08-24：栏改容器流内、钉输入行上方，不再
   * 追 vv——判尺/过渡帧/双基准那套随布局重构退役）。方法形状保留，
   * 调用方兼容；现为无操作。 */
  updateBottom(): void;
  /** 同步修饰键点亮外观（take 清零后由调用方触发一次） */
  syncMods(): void;
}

/**
 * DOM 皮已迁 React：mountKeybar 现由 term/KeybarApp.tsx 提供（reactMount
 * 桥接，装配方案 A），返回同款 KeybarHandle。IME 四层防线 listener 语义、
 * 方向键长按重复机时序逐行随皮迁移，参数全引本文件常量。
 */
