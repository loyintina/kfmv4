/**
 * src/client/term/KeybarApp.tsx — keybar React 皮（迁皮件；行为层规格
 * docs/keybar-v3-state-machine.md，骨=term/keybar.ts 纯逻辑原样保留）。
 *
 * 单向数据流（清单 §三/P6）：ModifierState 是唯一真源，点亮外观=bits 的
 * 纯渲染结果——useSyncExternalStore 直读 mods.peek()（外部 store 标准
 * 接法），皮内零 useState 镜像修饰键状态；骨改 bits → handle.syncMods()
 * → notify → 按 bits 重渲染。
 *
 * DOM 契约（考卷依赖，不许变）：栏根 .kfm-term-keybar，14 个按钮=直接 div
 * 子节点、textContent=KEYS label（.kfm-term-keybar div + hasText 选）。
 *
 * IME 四层防线一个 Listener 不丢（清单 P3，语义逐行照抄旧皮）：
 *   ①按钮 pointerdown preventDefault 保焦点，按下即发不等抬手
 *   ②按钮 click stopPropagation（pointerdown 的 preventDefault 拦不住
 *     click 派发，实测穿透；断掉冒泡=点按钮不激活 IME）
 *   ③栏 touchstart preventDefault {passive:false}——Chromium 安卓
 *     ShowImeIfNeeded 是原生层召回，JS click 防线拦不住；挂 bar 冒泡
 *     全覆盖（按钮+缝隙通吃）。必须原生 listener：React 根 listener 对
 *     touchstart 是 passive，preventDefault 会被吞（考卷⑤钉盯）
 *   ④栏 click stopPropagation 缝隙兜底
 * 全部 listener 走原生 addEventListener（与旧皮 1:1），useEffect cleanup
 * 摘除+清重复定时器（K8）；reactMount unmount 兜摘 DOM。
 *
 * 样式（P5）：颜色/圆角/字体全走 tokens.css keybar 专用段
 * （[data-kfm-keybar]/[data-kfm-key][data-armed] 选择器）；栏底/键面
 * background=transparent（0903 用户拍板：融进终端黑画布，点亮时
 * --kfm-key-on-bg 色块浮现）。grid/gap 2px/padding 2px/user-select/
 * touch-action/字号等结构样式留皮内 inline（P5 只管颜色字体圆角时长）。
 *
 * 观测钩（清单 §三）：window.__kfmNzKeybar() 报
 *   { mods: {ctrl,alt,shift}, repeat: {up,down,left,right}, history }
 * history=40 拍环形缓冲 {t, kind:'press'|'release'|'take'|'toggle', key, mods}；
 * 状态词汇只用清单枚举 OFF/ARMED/IDLE/HELD/REPEATING。
 */
import { useCallback, useEffect, useRef, useSyncExternalStore, type ReactElement } from 'react';
import {
  KEYS, MOD_ALT, MOD_CTRL, MOD_SHIFT, ModifierState,
  REPEAT_DELAY_MS, REPEAT_INTERVAL_MS, REPEAT_KEYS,
  type KeybarHandle, type KeybarHooks, type KeyDef,
} from './keybar.js';
import { keySeq, type KeyId } from './keymap.js';
import { reactMount } from '../kernel/react-adapter.js';

/** 键表拍平（行优先=旧皮 appendChild 顺序；渲染顺序=DOM 顺序的契约） */
const FLAT_KEYS: KeyDef[] = KEYS.flat();

type RepeatState = 'IDLE' | 'HELD' | 'REPEATING';
type HistoryKind = 'press' | 'release' | 'take' | 'toggle';
interface HistoryEntry { t: number; kind: HistoryKind; key: string; mods: number }

export interface KeybarSkinProps {
  hooks: KeybarHooks;
  mods: ModifierState;
  /** 装配递出的同步口：皮把「按 bits 重渲染」的 notify 填进来（方案 A 适配） */
  api: { sync: () => void };
}

export function KeybarApp(props: KeybarSkinProps): ReactElement {
  const { hooks, mods, api } = props;
  const barRef = useRef<HTMLDivElement | null>(null);
  const btnRefs = useRef<Array<HTMLDivElement | null>>([]);
  const ringRef = useRef<HistoryEntry[]>([]);
  const repeatRef = useRef<Record<string, RepeatState>>({ up: 'IDLE', down: 'IDLE', left: 'IDLE', right: 'IDLE' });
  /** 上一拍已知 bits（take 检测用：非零→零且非本皮 toggle=term 层 take 落字） */
  const lastBitsRef = useRef(0);
  const listenersRef = useRef(new Set<() => void>());

  const pushRing = (rec: HistoryEntry): void => {
    const ring = ringRef.current;
    ring.push(rec);
    if (ring.length > 40) ring.shift();
  };
  /** 骨改 bits 后的统一出口：补记 take 拍 + 通知订阅者按 bits 重渲染 */
  const notify = (): void => {
    const b = mods.peek();
    if (lastBitsRef.current !== 0 && b === 0) {
      pushRing({ t: Date.now(), kind: 'take', key: '*', mods: 0 });
    }
    lastBitsRef.current = b;
    for (const cb of listenersRef.current) cb();
  };

  // 单向数据流：bits 直读 ModifierState（唯一真源），订阅=syncMods 通道
  const subscribe = useCallback((cb: () => void) => {
    const set = listenersRef.current;
    set.add(cb);
    return () => { set.delete(cb); };
  }, []);
  const bits = useSyncExternalStore(subscribe, () => mods.peek());

  useEffect(() => { api.sync = notify; });

  // 事件层（原生 listener，与旧皮 1:1；挂载一次，卸载全摘+清定时器=K8）
  useEffect(() => {
    const cleanups: Array<() => void> = [];
    const on = (el: HTMLElement, type: string, fn: EventListener, opts?: AddEventListenerOptions): void => {
      el.addEventListener(type, fn, opts);
      cleanups.push(() => el.removeEventListener(type, fn, opts));
    };
    FLAT_KEYS.forEach((def, i) => {
      const b = btnRefs.current[i];
      if (!b) return;
      const onPress = (e: Event): void => {
        // 防线①：拦默认行为保焦点——焦点离开诱饵 textarea = 软键盘收摊
        e.preventDefault();
        if (def.mod) {
          const nb = mods.toggle(def.mod);
          pushRing({ t: Date.now(), kind: 'toggle', key: def.label, mods: nb });
          lastBitsRef.current = nb; // 本皮 toggle 不算 take
          notify(); // 旧皮 handle.syncMods() 同款：toggle 后立刷点亮
        } else if (def.direct) {
          pushRing({ t: Date.now(), kind: 'press', key: def.direct, mods: mods.peek() });
          const seq = keySeq(def.direct, hooks.appCursor());
          if (seq) hooks.send(seq);
        }
      };
      // pointerdown 按下即触发（Termux 手感）；preventDefault 后 click 不发，
      // 不重复挂 click。touchstart 的默认滚动由 touch-action:none 拦。
      on(b, 'pointerdown', onPress);
      // 长按重复（仅方向键，REPEAT_KEYS）：按下已发一次，按住
      // REPEAT_DELAY_MS 后每 REPEAT_INTERVAL_MS 重发；抬手/取消/滑出即停。
      // appCursor 每次实时读（重复期间对端可能翻 ?1h）。
      if (def.direct && REPEAT_KEYS.has(def.direct)) {
        const direct: KeyId = def.direct;
        let delay: number | undefined;
        let tick: number | undefined;
        const fire = (): void => {
          const seq = keySeq(direct, hooks.appCursor());
          if (seq) hooks.send(seq);
        };
        const stop = (): void => {
          if (delay !== undefined) { clearTimeout(delay); delay = undefined; }
          if (tick !== undefined) { clearInterval(tick); tick = undefined; }
          if (repeatRef.current[direct] !== 'IDLE') {
            repeatRef.current[direct] = 'IDLE';
            pushRing({ t: Date.now(), kind: 'release', key: direct, mods: mods.peek() });
          }
        };
        on(b, 'pointerdown', () => {
          stop(); // 防御：同一按钮异常重复按下不叠定时器（先清再设）
          repeatRef.current[direct] = 'HELD';
          delay = window.setTimeout(() => {
            repeatRef.current[direct] = 'REPEATING';
            tick = window.setInterval(fire, REPEAT_INTERVAL_MS);
          }, REPEAT_DELAY_MS);
        });
        on(b, 'pointerup', stop);
        on(b, 'pointercancel', stop);
        on(b, 'pointerleave', stop);
        cleanups.push(stop); // K8：卸载清残留定时器
      }
      // 防线②：点按钮 ≠ 点终端——click 冒泡到容器会触发「聚焦 IME 诱饵」
      // → 手机软键盘被召唤；在按钮上把 click 冒泡断掉。
      on(b, 'click', (e) => e.stopPropagation());
    });
    const bar = barRef.current;
    if (bar) {
      // 防线③：原生召唤防线（dbg-keybar-ime-summon）——preventDefault
      // touchstart 取消整个 tap 手势默认行为（含 ShowImeIfNeeded）；
      // {passive:false} 必需，passive listener 的 preventDefault 被吞。
      on(bar, 'touchstart', (e) => e.preventDefault(), { passive: false });
      // 防线④：缝隙兜底——点在按钮间隙的 click 会冒泡到终端容器→kb.focus()。
      on(bar, 'click', (e) => e.stopPropagation());
    }
    return () => { for (const fn of cleanups) fn(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hooks/mods 装配期定死
  }, []);

  // 观测钩（清单 §三）：mods/repeat 实时直读真源，history 环形缓冲快照
  useEffect(() => {
    const win = window as unknown as Record<string, unknown>;
    win.__kfmNzKeybar = () => ({
      mods: {
        ctrl: (mods.peek() & MOD_CTRL) !== 0,
        alt: (mods.peek() & MOD_ALT) !== 0,
        shift: (mods.peek() & MOD_SHIFT) !== 0,
      },
      repeat: { ...repeatRef.current },
      history: [...ringRef.current],
    });
    return () => { delete win.__kfmNzKeybar; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mods 装配期定死
  }, []);

  return (
    <div ref={barRef} className="kfm-term-keybar" data-kfm-keybar="1"
      style={{
        position: 'absolute', inset: 0, display: 'grid',
        gridTemplateRows: '1fr 1fr', gridTemplateColumns: 'repeat(7,1fr)',
        gap: '2px', padding: '2px', boxSizing: 'border-box',
        userSelect: 'none', WebkitUserSelect: 'none', touchAction: 'none',
      }}>
      {FLAT_KEYS.map((def, i) => (
        <div key={def.label}
          ref={(el) => { btnRefs.current[i] = el; }}
          data-kfm-key={def.direct ?? def.label}
          {...(def.mod && (bits & def.mod) !== 0 ? { 'data-armed': '1' } : {})}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '12px', lineHeight: 1, minWidth: 0,
          }}>
          {def.label}
        </div>
      ))}
    </div>
  );
}

/**
 * 装按键栏（装配方案 A：reactMount 桥接，KeybarHandle 形状不变——term 层
 * 调用点零改动）。parent=条带容器（调用方摆好位置/高度）；container 生灭
 * 随宿主，附 unmount 供宿主 effect 钩摘 React 根（K8）。
 */
export function mountKeybar(parent: HTMLElement, hooks: KeybarHooks): KeybarHandle & { unmount: () => void } {
  const mods = new ModifierState();
  const api = { sync: () => {} };
  const { unmount } = reactMount(KeybarApp, parent, { hooks, mods, api } as unknown as Record<string, unknown>);
  return {
    // 栏根元素（React 首渲染后存在；lazy 取——首渲染是异步调度）
    get el() { return parent.querySelector('.kfm-term-keybar') as HTMLElement; },
    mods,
    updateBottom() {
      // 无操作（两区模型：栏在容器流内钉输入行上方——形状保留，调用方兼容）
    },
    syncMods() { api.sync(); },
    unmount,
  };
}
