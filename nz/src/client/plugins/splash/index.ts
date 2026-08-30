/**
 * src/client/plugins/splash/index.ts — 开屏插件包（「静态资源动画本体 +
 * Cordis 生命周期壳」分层首例，2026-08-30 用户拍板「落地 + 做成插件，
 * 未来改这个可以直接覆盖」）。
 *
 * 分层：
 *   动画本体 = public/splash-core.js（唯一真源，splash-demo.html 同源；
 *   服务器对本文件单独 no-cache——覆盖后刷新即新版，不动 bundle.js）。
 *   本壳只管：DOM 挂载（容器走 host，owner 死自动摘）/ 本体脚本注入 /
 *   唤醒通道（开机自播+首帧收口、?splash 参数、__kfmNzSplash CDP 口、
 *   click 关闭）/ ctx 服务。
 *   未来换动画：①覆盖 splash-core.js ②config.src 指到别的本体——壳不改。
 *
 * 降级：本体脚本加载失败 → 壳注入兜底 CSS，覆层仍可 show 静态徽标帧
 * （st-cyan 呼吸），不白屏不阻断。
 *
 * bundle 规矩（沿 eyes 首例）：一个文件夹一个包，本文件唯一入口。
 */
import { Context } from 'cordis';
import { createContainer } from '../../host.js';

declare module 'cordis' {
  interface Context {
    /** 开屏服务：唤醒/关闭/版本查询 */
    splash: SplashService;
  }
}

interface SplashHandle {
  show(opts?: { introMs?: number }): boolean;
  hide(): boolean;
  /** v15 首帧收口：没扫完=跳到扫完帧定帧后退场；已扫完=短停留退场 */
  complete(): boolean;
  render(t: number): void;
  isRunning(): boolean;
  VERSION: string;
}

interface SplashCoreFactory {
  VERSION: string;
  create(refs: {
    splash: HTMLElement; art: HTMLElement;
    beamO: HTMLElement; beamO2: HTMLElement; beamI: HTMLElement;
  }): SplashHandle;
}

declare global {
  interface Window {
    NzSplashCore?: SplashCoreFactory;
    /** CDP 通道（不导航不杀终端会话）：true 唤醒 / false 关闭，返回 running */
    __kfmNzSplash?: (on: boolean) => boolean;
  }
}

export interface SplashBundleConfig {
  /** 动画本体 URL（缺省 ./splash-core.js；换动画=覆盖文件或指别的 src） */
  src?: string;
}

export interface SplashService {
  /** 本体就绪后唤醒（幂等重入=从头播）；本体缺失=静态兜底帧唤醒 */
  show(): Promise<boolean>;
  hide(): boolean;
  isRunning(): boolean;
  /** 本体版本（未加载/加载失败=null） */
  version(): string | null;
}

/** 静态兜底帧（JS 本体挂掉时也有一帧徽标+呼吸——v12 起纪律） */
const FALLBACK_ART = `    █
   █ █
  █   █
 █     █
█   █   █
 █     █
  █   █
   █ █
    █`;

/** 兜底 CSS：仅定位+静态帧呼吸（正常路径完整 CSS 由 splash-core.js 注入） */
const FALLBACK_CSS =
  '#nz-splash{position:fixed;inset:0;background:#05070f;display:none;' +
  'align-items:center;justify-content:center;transition:opacity .3s ease;' +
  'cursor:pointer;z-index:400}' +
  '#nz-splash.on{display:flex}' +
  '#nz-splash.out{opacity:0;pointer-events:none}' +
  '#nz-splash pre{margin:0;font-family:monospace;font-size:18px;' +
  'line-height:20px;white-space:pre;user-select:none;text-align:center}' +
  '#nz-splash .st-cyan{color:#56b6f0;animation:nzPulseFb 1.6s ease-in-out infinite}' +
  '@keyframes nzPulseFb{0%,100%{opacity:1}50%{opacity:.45}}';

export function applySplashBundle(ctx: Context, config: SplashBundleConfig = {}): void {
  // ?v=15：一次性越狱——v14f 时代服务器缓存头 bug 把 splash-core.js 错发成
  // immutable 一年，已中毒的 WebView/Via 缓存对裸 URL 永不再验证；带新查询
  // 串=新缓存键。此后服务器 no-cache 已修对，覆盖文件刷新即新版。
  const src = config.src ?? './splash-core.js?v=15';

  // ---- 主/影分流（plugtest 实测钉出来的纪律）----
  // main.ts 在 root 直挂后，cordis 全局 store 已有 'splash' 服务 + host 户口
  // 已有 'splash:splash' 容器——验房师再 apply 时：provide 必撞
  // （"service splash has been registered at <root>"）、同 slot 建容器会
  // 触发 host 防重下沉把真覆层摘了。故非主挂载=影子实例：换 slot 全生命
  // 周期照跑（DOM/脚本/handle/装卸残留都可量），但不抢全局口不抢户口。
  const primary = !ctx.reflect.get('splash', false);

  // ---- DOM 挂载：容器走 host（overlay 层，owner 死自动摘）----
  const container = createContainer(ctx, {
    kind: 'overlay', slot: primary ? 'splash' : 'splash-shadow', owner: 'splash',
  });
  const el = container.el;
  if (primary) el.id = 'nz-splash';
  el.innerHTML =
    '<div class="beam beam-outer"></div><div class="beam beam-outer"></div>' +
    '<div class="beam beam-inner"></div>' +
    '<pre><span class="st-cyan">' + FALLBACK_ART + '</span></pre>';

  // ---- 本体脚本注入（异步；失败走兜底）----
  let handle: SplashHandle | null = null;
  let failed = false;
  let running = false;
  const ready: Promise<boolean> = new Promise((resolve) => {
    // 已存在（重复 apply/热重）直接用
    if (window.NzSplashCore) { resolve(true); return; }
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve(!!window.NzSplashCore);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  }).then((ok) => {
    if (ok && window.NzSplashCore) {
      const kids = el.children;
      handle = window.NzSplashCore.create({
        splash: el,
        art: el.querySelector('pre') as HTMLElement,
        beamO: kids[0] as HTMLElement,
        beamO2: kids[1] as HTMLElement,
        beamI: kids[2] as HTMLElement,
      });
      return true;
    }
    // 兜底：注入最小 CSS，覆层只展示静态徽标帧
    failed = true;
    const st = document.createElement('style');
    st.textContent = FALLBACK_CSS;
    document.head.appendChild(st);
    return false;
  });

  function showFb(): boolean {
    el.classList.remove('out');
    el.classList.add('on');
    running = true;
    return running;
  }
  function hideFb(): boolean {
    running = false;
    el.classList.add('out');
    setTimeout(() => el.classList.remove('on'), 320);
    return running;
  }

  const service: SplashService = {
    async show() {
      await ready;
      if (handle) { running = handle.show(); return running; }
      return showFb();
    },
    hide() {
      if (handle) { running = handle.hide(); return running; }
      if (failed) return hideFb();
      running = false;
      return running;
    },
    isRunning: () => running,
    version: () => (handle ? handle.VERSION : null),
  };
  if (primary) ctx.provide('splash', service);

  // click 关闭（本体 handle 内部也挂了一份 click→hide，双挂幂等无害：
  // 本体那份管动画停表，这份管兜底路径与 running 账本）
  el.addEventListener('click', () => { void service.hide(); });

  // ---- 唤醒通道（仅主挂载）：?splash 参数 + __kfmNzSplash CDP 口 ----
  const splashParam = /[?&]splash([=&]|$)/.test(location.search);
  if (primary) {
    window.__kfmNzSplash = (on: boolean): boolean => {
      if (on) { void service.show(); return true; }
      return service.hide();
    };
    if (splashParam) void service.show();
  }

  // ---- 开机自播（2026-08-30 用户拍板：开机动画进开机链，三线速度按
  // 预测就绪时长重新定，动画结束正好扫完）----
  // 编排：localStorage 存上次「开屏→首帧」实测时长做本次预测（无记录=
  // 首次安装=冷启动 ~11.7s，08-28 探针实测），introMs 传给本体等比缩放
  // 编排骨架；term 插件 first-frame 事件到达=实际就绪→complete() 收口
  // （预测偏差由时间平移吸收）+ 实测回写 localStorage（下次更准）。
  // ?splash=只看动画（不挂收口）；?nosplash=本次不开开屏。
  if (primary && !splashParam && !/[?&]nosplash([=&]|$)/.test(location.search)) {
    const LS_KEY = 'nz-splash-intro-ms';
    const DEFAULT_INTRO = 11000;
    const clampMs = (v: number): number => Math.min(20000, Math.max(400, Math.round(v)));
    let predicted = DEFAULT_INTRO;
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) predicted = clampMs(parseFloat(raw));
    } catch { /* 隐私模式无 localStorage，用默认 */ }
    const shownAt = performance.now();
    showFb(); // 立即盖屏（静态帧）；本体就绪后换动画从 t=0 起播
    void ready.then((ok) => {
      if (ok && handle) running = handle.show({ introMs: predicted });
    });
    const onMark = (ev: Event): void => {
      if ((ev as CustomEvent).detail !== 'first-frame') return;
      window.removeEventListener('nz-term-mark', onMark);
      clearTimeout(watchdog);
      try { localStorage.setItem(LS_KEY, String(clampMs(performance.now() - shownAt))); } catch { /* 记账失败不挡 */ }
      // 本体可能还没加载完（首帧比 splash-core.js 快=冷启动带宽被字体/
      // wasm 挤占的极端时序）——等 ready 再 complete，顺序保证在 boot
      // show 之后（同 promise 先注册先跑）；兜底帧路径短停留即退
      if (handle) { handle.complete(); return; }
      void ready.then((ok) => {
        if (ok && handle) { handle.complete(); return; }
        setTimeout(() => { if (failed) hideFb(); }, 300);
      });
    };
    // 看门狗：终端 OPEN FAIL/卡死不得让开屏永远盖屏
    const watchdog = setTimeout(() => {
      window.removeEventListener('nz-term-mark', onMark);
      if (handle) handle.complete(); else if (failed) hideFb();
    }, Math.max(predicted * 3, 30000));
    window.addEventListener('nz-term-mark', onMark);
    ctx.effect(() => () => {
      window.removeEventListener('nz-term-mark', onMark);
      clearTimeout(watchdog);
    });
  }

  // ---- 卸载清场（plugtest 量残留：DOM 容器 host 白送；全局口只有主挂载
  // 能收——影子实例 dispose 不得动主挂载的全局与本体单例）----
  ctx.effect(() => () => {
    service.hide();
    if (primary) {
      delete window.__kfmNzSplash;
      delete window.NzSplashCore;
    }
  });
}
