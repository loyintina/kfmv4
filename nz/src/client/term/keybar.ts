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
 */
import { keySeq, type KeyId } from './keymap.js';

/** 栏高（CSS px，两排）：终端容器底部要预留这么高（见 term 插件装配） */
export const KEYBAR_H = 84;

/** 修饰键位掩码（与 NA MOD_CTRL/ALT/SHIFT 同值） */
export const MOD_CTRL = 1;
export const MOD_ALT = 2;
export const MOD_SHIFT = 4;

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
 * 装按键栏：parent = 条带容器（调用方摆好位置/高度——两区模型起栏在
 * 容器流内，bottom 钉输入行上方）；本函数把两排七列铺满 parent。
 * 容器生灭随宿主（父容器摘=子树同摘）。
 */
export function mountKeybar(parent: HTMLElement, hooks: KeybarHooks): KeybarHandle {
  const mods = new ModifierState();
  const bar = document.createElement('div');
  bar.className = 'kfm-term-keybar';
  bar.style.cssText = 'position:absolute;inset:0;'
    + 'display:grid;grid-template-rows:1fr 1fr;grid-template-columns:repeat(7,1fr);'
    + 'gap:2px;padding:2px;background:#1a1a20;box-sizing:border-box;'
    + 'user-select:none;-webkit-user-select:none;touch-action:none;';

  const modButtons = new Map<number, HTMLElement>();
  for (const row of KEYS) {
    for (const def of row) {
      const b = document.createElement('div');
      b.textContent = def.label;
      b.style.cssText = 'display:flex;align-items:center;justify-content:center;'
        + 'font:12px/1 ui-monospace,Menlo,Consolas,monospace;color:#c8c8d4;'
        + 'background:#26262e;border-radius:6px;min-width:0;';
      const onPress = (e: Event) => {
        // 拦默认行为保焦点：焦点离开诱饵 textarea = 软键盘收摊
        e.preventDefault();
        if (def.mod) {
          mods.toggle(def.mod);
          handle.syncMods();
        } else if (def.direct) {
          const seq = keySeq(def.direct, hooks.appCursor());
          if (seq) hooks.send(seq);
        }
      };
      // pointerdown 按下即触发（Termux 手感）；preventDefault 后 click 不发，
      // 不重复挂 click。touchstart 的默认滚动由 touch-action:none 拦。
      b.addEventListener('pointerdown', onPress);
      // 点按钮 ≠ 点终端：click 冒泡到容器会触发「聚焦 IME 诱饵」→ 手机
      // 软键盘被召唤（2026-08-24 两痛点①，button-ime-tui-overflow-review）。
      // pointerdown 的 preventDefault 拦不住 click 派发（实测穿透），
      // 在按钮上把 click 冒泡断掉——点按钮=发按键字节，不激活 IME。
      b.addEventListener('click', (e) => e.stopPropagation());
      if (def.mod) modButtons.set(def.mod, b);
      bar.appendChild(b);
    }
  }
  // 原生召唤防线（2026-08-31 真机实锤，dbg-keybar-ime-summon）：Chromium
  // 安卓的 ShowImeIfNeeded——tap 结束只要焦点元素可编辑就召回 IME，不管
  // 点在页面哪里。诱饵 textarea 永久持焦（IME 输入靠它），于是点键栏也
  // 被原生层弹键盘——JS 层的 click stopPropagation（防 JS 召唤）拦不住
  // 原生召唤。preventDefault touchstart 取消整个 tap 手势的默认行为
  // （含 ShowImeIfNeeded）；挂在 bar 上冒泡全覆盖——按钮+缝隙通吃。
  // 按键由 pointerdown 触发（按下即发），防 touchstart 不伤按键逻辑。
  bar.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
  // 缝隙兜底：点在按钮间隙的 click 会冒泡到终端容器→kb.focus()→JS 召唤。
  bar.addEventListener('click', (e) => e.stopPropagation());
  parent.appendChild(bar);

  const handle: KeybarHandle = {
    el: bar,
    mods,
    updateBottom() {
      // 无操作（两区模型：栏在容器流内钉输入行上方，键盘弹起随容器底
      // 同步上浮——不再需要按 vv 重算）。历史见 keybar-float 五轮讨伐。
    },
    syncMods() {
      const bits = mods.peek();
      for (const [bit, el] of modButtons) {
        const on = (bits & bit) !== 0;
        el.style.background = on ? '#3d5a99' : '#26262e';
        el.style.color = on ? '#ffffff' : '#c8c8d4';
      }
    },
  };
  handle.updateBottom();
  return handle;
}
