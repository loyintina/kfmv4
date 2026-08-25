/**
 * src/client/plugins/term/index.ts — 终端卡插件包（№1 卡，8.8.2③c）。
 *
 * 整条链在此合龙：WS 桥（bridge.ts）↔ 解析核（term-core wasm）↔
 * 渲染壳（term/shell.ts 行级 DOM）↔ 卡片户口（cardTypes broker 注册
 * 'term' 卡型）↔ 容器（host.createContainer，owner 死自动摘）。
 *
 * bundle 规矩（沿 eyes 首例）：一个文件夹一个包，本文件唯一入口。
 *
 * 会话-网格绑定语义（重连不花屏的关键）：
 *   重连 tail 回放 ≠ 增量输出——tail 是「从头算起的快照尾迹」，喂给已有
 *   网格会重复。故 replay 帧先**重建 TermCore**（新网格）再喂 tail，
 *   后续实时帧续在同一颗核上。
 *
 * 尺寸：实测字格 × 容器可视面积定行列（80×24 写死时代已结束），
 * visualViewport resize 时核/壳/PTY 三方同步。
 *
 * 8.8.3b 按键栏：仿 Termux 两排七列（term/keybar.ts + keymap.ts 纯逻辑），
 * 修饰键一次性粘滞，方向键/Home/End 按 core.app_cursor() 实时翻
 * SS3/CSI；栏随软键盘上浮，终端容器底部常驻预留 KEYBAR_H。
 *
 * v1 留白：IME 组合键之外的全集映射（F1-F12 等）留 input 小插件。
 */
import { Context } from 'cordis';
import { registerCardType } from '../../card-types.js';
import { createContainer } from '../../host.js';
import { loadTermCoreShared, type TermCoreGlue, type TermCoreHandle } from '../../term-core.js';
import { TermShell, TERM_FONT_STACK } from '../../term/shell.js';
import { TermWsBridge } from '../../term/bridge.js';
import { mapText } from '../../term/keymap.js';
import { KEYBAR_H, MOD_ALT, MOD_CTRL, MOD_SHIFT, mountKeybar } from '../../term/keybar.js';

const COLS = 80;
const ROWS = 24;

interface TermCardInstance {
  cardId: string;
  sessionId: string | null;
  core: TermCoreHandle;
  shell: TermShell;
  cols: number;
  rows: number;
  /** 诱饵 textarea 钉到光标格（桥回调里帧后调用；定义见 open 内注释） */
  placeKb: () => void;
  /** 8.8.3c 集中状态机：视口是否在底（跟底判定唯一真源） */
  atBottom: boolean;
  /** 新输出落地后调用：仅 atBottom 才跟底（上滑中不拽回） */
  followOutput: () => void;
  /** 输入即回底（打字/按键栏/IME 落字）：atBottom=true + 立即滚到底 */
  inputToBottom: () => void;
  /** 帧后同步 ALT_SCREEN 模式位（TUI 整屏 ↔ 行模式：按键栏收/放 +
   *  滚动区占满/让位 + 行列重测——2026-08-24 两痛点② TUI 挤占修复） */
  syncAlt: () => void;
}

export interface TermCardService {
  /** 开一张终端卡（command 空 = 交互 shell）；回卡片 id */
  open(opts?: { command?: string }): Promise<string>;
}

declare module 'cordis' {
  interface Context {
    /** 终端卡服务（№1 卡插件包提供） */
    termCards: TermCardService;
  }
}

/** 键 → PTY 字节（v1 最小集；组合键/IME 留 input 小插件） */
function keyToBytes(e: KeyboardEvent): string | null {
  if (e.ctrlKey && e.key.length === 1) {
    const c = e.key.toLowerCase();
    if (c >= 'a' && c <= 'z') return String.fromCharCode(c.charCodeAt(0) & 0x1f);
    return null;
  }
  switch (e.key) {
    case 'Enter': return '\r';
    case 'Backspace': return '\x7f';
    case 'Tab': return '\t';
    case 'Escape': return '\x1b';
    case 'ArrowUp': return '\x1b[A';
    case 'ArrowDown': return '\x1b[B';
    case 'ArrowRight': return '\x1b[C';
    case 'ArrowLeft': return '\x1b[D';
    case 'Home': return '\x1b[H';
    case 'End': return '\x1b[F';
    default:
      return e.key.length === 1 && !e.metaKey && !e.altKey ? e.key : null;
  }
}

export function applyTermBundle(ctx: Context): void {
  registerCardType(ctx, { id: 'term', name: '终端' });

  const instances = new Map<string, TermCardInstance>();
  let seq = 0;
  let gluePromise: Promise<TermCoreGlue> | null = null;
  const glue = () => (gluePromise ??= loadTermCoreShared());

  // 渲染健康计数（?debug 骨架常驻字段的源头，平时零上报）：vp=可视区事件
  // rz=落地的行列变更。f/rp/sc 在 shell.stats。诊断角标已随 IME 收口移除
  // （2026-08-23 复盘裁决①：骨架常驻、专症字段随症收口、角标移除）。
  const dbg = { viewportEvents: 0, resizesApplied: 0 };

  const bridge = new TermWsBridge(`${location.origin.replace(/^http/, 'ws')}/ws/term`, {
    onOutput(id, data, replay) {
      for (const inst of instances.values()) {
        if (inst.sessionId !== id) continue;
        if (replay && glueCtor) {
          // 重连 tail：先换新网格再喂（快照尾迹≠增量，喂旧网格会花屏）
          inst.core.free();
          inst.core = new glueCtor(inst.cols, inst.rows, 1000);
          inst.shell.setCore(inst.core);
        }
        inst.core.feed(new TextEncoder().encode(data));
        inst.syncAlt();
        inst.shell.renderFrame();
        inst.placeKb();
        inst.followOutput();
      }
    },
    onExit(id, code) {
      for (const inst of instances.values()) {
        if (inst.sessionId !== id) continue;
        inst.core.feed(new TextEncoder().encode(`\r\n[进程已退出 code=${code}]\r\n`));
        inst.syncAlt();
        inst.shell.renderFrame();
        inst.placeKb();
        inst.followOutput();
      }
    },
  });

  const service: TermCardService = {
    async open(opts = {}) {
      const g = await glue();
      glueCtor = g.TermCore; // replay 重建核用
      const cardId = `term-${++seq}`;
      const inst = ctx.cardTypes.createInstance('term');
      const container = createContainer(ctx, {
        kind: 'layout',
        slot: cardId,
        owner: 'term',
      });
      // 容器=全屏卡身（2026-08-25 两拍：先搬 8.0 全屏卡片机制
      // fullscreen-card-port-review，再经评审扰动实验修正锚点
      // card-visual-viewport-anchor-review——fixed inset:0 锚的是布局视口
      // innerHeight，地址栏 chrome 覆盖布局视口不缩它（resizes-content 只管
      // 键盘）：真机有栏态 innerH=915 而 vvH=855，ranger 仍超屏被裁）：
      //   ①尺寸锚=视觉视口真可见区：top=vv.offsetTop、height=vv.height
      //     （8.0 卡高=barTop−2、输入栏用 vv.height 锚视觉视口的同款边界；
      //     vv 事件当拍即钉不防抖——防抖后跳=过渡闪帧真凶）。vv 多报旧顾虑
      //     保留硬裁剪兜底：超出的部分裁掉，裁的不是「该看到的部分」的前提
      //     是卡身先锚对。无 vv API 时 height:100% 贴布局视口兜底。
      //   ②卡身 overflow:hidden 硬裁剪——内容物理画不出卡外（8.0 卡体
      //     flex:1+overflow:hidden 同款）。
      //   ③行数对卡身量（measure 读 scrollEl.clientHeight，卡身限高后
      //     rows×cellH 恒 ≤ 真可见区）。
      // 内部绝对分区不变：scrollEl 终端本体（flex 列底锚）+ barStrip 垫底。
      container.el.style.cssText = 'position:fixed;left:0;right:0;top:0;height:100%;overflow:hidden;';
      // 终端卡全屏期间锁死背景页滚动（boot 页比屏幕高，不锁会和终端抢
      // 滚动、被 scrollIntoView 类行为带着跑——实测闪烁根因之一）
      const prevBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      ctx.effect(() => () => { document.body.style.overflow = prevBodyOverflow; });
      // 钉视觉视口（锚真可见区）：卡身 top/height 随 vv 走。初次即钉，
      // 让下面 measure() 读到的 scrollEl.clientHeight 就是真可见区高度。
      const pinToVv = () => {
        const vv = window.visualViewport;
        if (!vv) return; // 无 vv API：height:100% 贴布局视口兜底
        container.el.style.top = `${vv.offsetTop}px`;
        container.el.style.height = `${vv.height}px`;
      };
      pinToVv();
      // 实测定尺寸（写死 80×24 时代结束）：先用与壳同字体的探针量字格，
      // 再按容器可视面积算行列——手机有多宽终端就有多少列，不再裁字。
      // 探针字体栈=壳渲染栈（TERM_FONT_STACK 同源——换字体后度量自动跟
      // 实际渲染字体，字宽几何不回退的根基）。
      // 字体就绪门：@font-face 异步加载——不等就量会拿到 fallback 字宽，
      // 字体落地后渲染字宽突变而 cell 缓存不刷 = 光标/裁切错位。显式
      // load 打头字体（失败不挡路：回落系统 mono，几何仍自洽）。
      try {
        await document.fonts.load(`13px 'JetBrainsMonoNL NFM'`, '0');
      } catch { /* 字体 404/受限 → fallback 栈，度量与渲染仍同源 */ }
      let cellW = 0;
      let cellH = 0;
      const measureCell = () => {
        const probe = document.createElement('div');
        probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;'
          + `font:13px/1.25 ${TERM_FONT_STACK};`;
        probe.textContent = '0'.repeat(20);
        container.el.appendChild(probe);
        cellW = probe.getBoundingClientRect().width / 20;
        cellH = probe.getBoundingClientRect().height;
        probe.remove();
      };
      measureCell();
      // 单区布局（行高量出后一次性落位）：
      //   scrollEl  终端本体 top:0 bottom:按键栏（overflow:auto + flex 列
      //             底锚——壳画布 margin-top:auto：内容不满屏时推底=空屏
      //             提示符在底行；超屏时 margin 归零正常滚动。flex 容器内
      //             画布必须 flex:none 防 shrink 压缩）
      //   barStrip  按键栏 bottom:0 height:KEYBAR_H（垫底）
      const scrollEl = document.createElement('div');
      scrollEl.style.cssText = `position:absolute;left:0;right:0;top:0;bottom:${KEYBAR_H}px;`
        + 'overflow:auto;display:flex;flex-direction:column;';
      container.el.appendChild(scrollEl);
      // 实测定尺寸（写死 80×24 时代结束）：先用与壳同字体的探针量字格，
      // 再按容器可视面积算行列——手机有多宽终端就有多少列，不再裁字。
      const measure = () => cellW > 0 && cellH > 0 ? {
        cols: Math.max(20, Math.floor(container.el.clientWidth / cellW)),
        rows: Math.max(5, Math.floor(scrollEl.clientHeight / cellH)),
      } : { cols: COLS, rows: ROWS };
      const size = measure();
      const core = new g.TermCore(size.cols, size.rows, 1000);
      // 壳必须画在内层元素上——TermShell 构造函数会重写根元素的 cssText，
      // 直接传 scrollEl 会把滚动区定位冲掉（半屏+无法滚动的实测教训）。
      // scrollEl=滚动视口（flex 列底锚），termEl=壳画布（历史块+屏幕行）。
      const termEl = document.createElement('div');
      scrollEl.appendChild(termEl);
      const shell = new TermShell(core, termEl, { cols: size.cols, rows: size.rows });
      // 底锚定两件套（构造后补——构造函数会重写 cssText，属性级补设不冲）
      termEl.style.marginTop = 'auto';
      termEl.style.flex = 'none';
      const card: TermCardInstance = {
        cardId, sessionId: null, core, shell, cols: size.cols, rows: size.rows,
        placeKb: () => {}, atBottom: true, followOutput: () => {}, inputToBottom: () => {},
        syncAlt: () => {},
      };
      instances.set(cardId, card);

      // 8.8.3c scrollback 集中状态机（standard-scrollback-8.8.3c 纪律，
      // 散写必翻车）：atBottom 初始 true；新输出仅 true 才跟底（follow
      // Output 挂桥回调）；滚动事件双向翻转；输入（打字/按键栏/IME 落
      // 字）= true + 立即回底；IME 合成中不回底（落字才走 inputToBottom）。
      // 单区模型滚动对象=scrollEl（终端本体，历史+屏幕行同一连续区）。
      card.followOutput = () => {
        if (card.atBottom) scrollEl.scrollTop = scrollEl.scrollHeight;
      };
      card.inputToBottom = () => {
        card.atBottom = true;
        shell.autoScroll = true;
        scrollEl.scrollTop = scrollEl.scrollHeight;
      };
      scrollEl.addEventListener('scroll', () => {
        card.atBottom = scrollEl.scrollTop + scrollEl.clientHeight
          >= scrollEl.scrollHeight - 5;
        shell.autoScroll = card.atBottom; // 上滑中光标 nearest 兜底歇火
      });
      // 判卷/取证钩子契约（standard-scrollback 三节 + bottom-anchor
      // 考卷）：v1 单卡口径，多卡并存时后开的覆盖——多卡改造小步再按
      // cardId 分键。两区模型的 __kfmNzTermInputRow 随单区回退退役
      // （2026-08-24 拍板：无独立输入行，光标格 rect 走 .nz-term-cursor）。
      (window as unknown as Record<string, unknown>).__kfmNzTermScroll = () => ({
        scrollTop: scrollEl.scrollTop,
        scrollHeight: scrollEl.scrollHeight,
        clientHeight: scrollEl.clientHeight,
        isAtBottom: card.atBottom,
        getContainer: () => scrollEl,
      });

      // 软键盘入口（xterm 同款隐藏 textarea 诱饵）：移动浏览器只在可编辑
      // 元素聚焦时弹软键盘，div+tabIndex 没用。点卡片 → 聚焦诱饵；桌面
      // 按键走 keydown，手机 IME/软键盘走 input 事件（不按 keydown 规矩来）。
      const kb = document.createElement('textarea');
      kb.className = 'kfm-term-kb';
      kb.setAttribute('autocapitalize', 'off');
      kb.setAttribute('autocomplete', 'off');
      kb.setAttribute('autocorrect', 'off');
      kb.setAttribute('spellcheck', 'false');
      kb.setAttribute('aria-label', '终端输入');
      kb.style.cssText = 'position:absolute;left:0;top:0;width:1px;height:1px;'
        + 'opacity:0;padding:0;border:none;outline:none;resize:none;background:transparent;color:transparent;';
      container.el.appendChild(kb);

      // 诱饵跟随光标（xterm 同款纪律）：移动浏览器每次 input 都会把聚焦
      // 元素滚进视野——钉死在 0,0 时浏览器把容器 scrollTop 拽回 0，
      // renderFrame 的 nearest 兜底又滚回去 = 每敲一字一次滚动拔河
      // （真机黑匣子实锤：sc 每键 +1、rp 暴涨、整屏从上到下闪）。让诱饵
      // 钉在光标格上：浏览器想滚去的位置正好就是我们要的位置，拔河消失；
      // 副作用是 IME 候选窗跟着光标走（xterm 同款，顺带改善）。
      // 单区模型：光标行在滚动区流内，诱饵钉光标格的**可视**位置
      // （termEl 内纵坐标 − 当前滚动量；kb 挂容器下，scrollEl 顶=0 故
      // 坐标系直通）。atBottom 时光标恒在底可视区，浏览器「滚进视野」
      // 发现已在视野 = 不滚，拔河消失；IME 候选窗跟光标走（顺带改善）。
      card.placeKb = () => {
        const off = shell.cursorOffset();
        if (!off) return;
        kb.style.left = `${off.x}px`;
        kb.style.top = `${off.y - scrollEl.scrollTop}px`;
      };

      // 8.8.3b 按键栏（仿 Termux，纪律见 keybar.ts 头注释）：容器流内
      // 条带（垫底拇指区，bottom:0）——8.x aux-bar 流内存活模式，键盘弹
      // 起随容器钉 vv 同步上浮，条带自身不再追 vv（判尺/过渡帧/双基准
      // 打架那套随布局重构退役）。生灭随容器（owner 死容器摘=子树同摘）。
      // pointer-events:auto 防层根 none 拦截。
      const barStripEl = document.createElement('div');
      barStripEl.style.cssText = `position:absolute;left:0;right:0;bottom:0;height:${KEYBAR_H}px;pointer-events:auto;`;
      container.el.appendChild(barStripEl);
      const keybar = mountKeybar(barStripEl, {
        send: (bytes) => { if (card.sessionId) { card.inputToBottom(); bridge.input(card.sessionId, bytes); } },
        appCursor: () => card.core.app_cursor(),
      });
      // 一次性粘滞联动：落字前读走修饰位（有则 mapText 变换 + 灭灯）
      const takeMods = (text: string): string => {
        const bits = keybar.mods.take();
        if (!bits) return text;
        keybar.syncMods();
        return mapText((bits & MOD_CTRL) !== 0, (bits & MOD_ALT) !== 0, (bits & MOD_SHIFT) !== 0, text);
      };

      // ?debug 诊断骨架（常备基建，复盘裁决①：管道+字段注册点常驻，专症
      // 字段随症收口——IME 专用 col/cv/cb 已随三症全解移除，保留通用渲染
      // 健康字段 f/rp/sc/rz；角标已移除）：URL 带 ?debug 时把 composition
      // 四事件 + input 的 e.data/isComposing/输入框残影值逐条 sendBeacon
      // 到服务端落 /tmp 日志。真实 IME 事件序列 headless 模拟不出，只能
      // 真机抓。本块必须注册在业务监听**之前**——否则读到的 kb.value 是
      // 业务清空后的残影，序列失真。
      const debugIme = /[?&]debug([=&]|$)/.test(location.search);
      const postDebug = debugIme
        ? (rec: Record<string, unknown>) => {
            try {
              // 通用渲染健康字段（专症字段的注册点——新症状要加字段在这里加）：
              //   f/rp/sc = 帧数/重排行/兜底滚动累计（突增=重绘或滚动挤兑）；
              //   rz = 已落地行列变更。
              navigator.sendBeacon('/debug/ime-log', JSON.stringify({
                t: Date.now(), ...rec,
                f: shell.stats.frames, rp: shell.stats.rowsPainted, sc: shell.stats.scrolls,
                rz: dbg.resizesApplied,
              }) + '\n');
            } catch { /* 诊断通道不挡主流程 */ }
          }
        : null;
      if (postDebug) {
        for (const type of ['compositionstart', 'compositionupdate', 'compositionend', 'input'] as const) {
          kb.addEventListener(type, (e) => {
            const ie = e as InputEvent;
            postDebug({ type, data: ie.data ?? null, composing: ie.isComposing ?? false, v: kb.value });
          });
        }
        // keydown 同流落日志（桌面/部分 IME 的字符走这条路，取证少不了它）
        kb.addEventListener('keydown', (e) => {
          postDebug({ type: 'keydown', data: e.key, composing: e.isComposing, v: kb.value });
        });
      }

      // 视口事件出口（?debug 骨架的字段注册点——新症状要加字段在这里加）。
      // keybar 上浮被盖症已收口（2026-08-24：判尺结论 vm=vv 真尺；Via 有栏
      // +键盘态 vv 多报 ~42px 属浏览器硬限制，用户拍板接受现状，?kbOff
      // 代字转常驻调节入口）——专症字段（ih/vh/ot/dch/kbb/kbc/brt/brb/
      // fx/vm）与双轨校准色条（probeFx/probeVv）已随症拆除（复盘裁决①）。
      // kboff 字段随 ?kbOff 代字一并退役（2026-08-25 全屏卡身移植：容器
      // 改 fixed 锚真实可视区，不信 vv 数值后 kbOff 无作用点）。
      // 专症字段（随症收口，button-ime-tui-overflow-review 二节排查用）：
      // rows/cols/cellH/cellW/ch——TUI 超屏真机取证（cellH 度量竞态 vs
      // vv 可视区差两方向定位行数是否偏多）。
      const reportViewport = (type: string) => {
        postDebug?.({
          type,
          rows: card.rows, cols: card.cols,
          cellH: shell.metrics.cellH, cellW: shell.metrics.cellW,
          ch: scrollEl.clientHeight,
        });
      };
      // 必须挂在 click 而非 pointerdown/mousedown：按下事件的默认行为会
      // 把焦点抢走放回 body（聚焦被覆盖），且 preventDefault 会杀死原生
      // 选中复制。click 在抬手后触发，聚焦不被抢、选中不受影响；移动端的
      // 「用户手势内 focus() 才弹键盘」规矩也认 click。
      // IME 合成纪律 v2（中文实测两轮教训）：
      // ①中间态不转发不打断，上屏才发；②合成结束只认 e.data（此刻输入框
      // 里可能是拼音残影不是汉字）；③部分浏览器 compositionend 后还补发
      // 一条同内容 input——记下刚上屏的文本，补发来了直接吞掉防二次发送。
      let composing = false;
      let justCommitted = '';
      kb.addEventListener('compositionstart', () => { composing = true; kb.value = ''; });
      kb.addEventListener('compositionend', (e) => {
        composing = false;
        let text = e.data || kb.value;
        kb.value = '';
        if (text) text = takeMods(text); // 粘滞修饰：上屏落字读走清零
        justCommitted = text;
        if (text && card.sessionId) {
          card.inputToBottom(); // IME 落字才回底（合成中不回底）
          bridge.input(card.sessionId, text.replace(/\n/g, '\r'));
        }
      });
      container.el.addEventListener('click', () => kb.focus({ preventScroll: true }));
      kb.addEventListener('keydown', (e) => {
        if (composing || e.isComposing) return; // 合成中按键归输入法
        let bytes = keyToBytes(e);
        if (bytes) bytes = takeMods(bytes); // 粘滞修饰（按键栏 Ctrl/Alt/Shift）
        if (bytes && card.sessionId) {
          e.preventDefault();
          card.inputToBottom(); // 打字回底
          bridge.input(card.sessionId, bytes);
        }
      });
      kb.addEventListener('input', (e) => {
        const ie = e as InputEvent;
        if (composing || ie.isComposing) return; // 中间态不发
        if (justCommitted && ie.data === justCommitted) {
          justCommitted = ''; // 上屏补发，吞掉
          kb.value = '';
          return;
        }
        justCommitted = '';
        // 手机软键盘产出的文本整段取走后清空诱饵（粘滞修饰同路读走）
        let text = kb.value;
        kb.value = '';
        if (text) text = takeMods(text);
        if (text && card.sessionId) {
          card.inputToBottom(); // 打字回底
          bridge.input(card.sessionId, text.replace(/\n/g, '\r'));
        }
      });

      // 尺寸跟随：软键盘弹起 → 可视区变矮（resizes-content）→ 防抖后
      // 重测行列 → 核/壳/PTY 三方同步 resize。光标露出由 shell 的
      // nearest 滚动兜底（光标被遮才滚），不做无条件滚到底。
      // （__kfmNzTermDebug/__kfmNzTermCursor 两探针已随 IME 收口移除——
      // 复盘裁决①：专症字段随症收口，?debug beacon 骨架保留。）
      // 防抖重测块（贵的部分）：视口事件与 ALT 翻转（keybar 收/放改变
      // scrollEl 高度）共用——钉 vv 在事件当拍（pinToVv），这里只跑
      // 重测+三方同步。
      const scheduleResize = () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          // 行数对卡身量：scrollEl.clientHeight 源自 vv 锚定的卡身（已被
          // 真可见区限高 + overflow:hidden 硬裁剪），rows×cellH 恒
          // ≤ 真可见区——chrome 显隐/键盘弹收都物理画不出卡外。
          const s = measure();
          if (s.cols !== card.cols || s.rows !== card.rows) {
            dbg.resizesApplied++;
            card.cols = s.cols;
            card.rows = s.rows;
            card.core.resize(s.cols, s.rows);
            card.shell.resize(s.rows); // 内部 renderFrame → 光标 nearest 兜底
            card.placeKb();
            if (card.sessionId) bridge.resize(card.sessionId, s.cols, s.rows);
          }
        }, 150);
      };
      let resizeTimer: ReturnType<typeof setTimeout> | undefined;
      const onViewportResize = () => {
        dbg.viewportEvents++;
        // 卡身同拍钉 vv（transition-report①：防抖后跳=过渡闪帧真凶）；
        // 按键栏在容器流内，卡身底动=整组底部 UI 同步上浮
        pinToVv();
        // 视口事件随 IME 事件同流落日志（评审五节建议）
        reportViewport('viewport');
        // 不滚！resize 时无条件滚到底是「每字抖几行」的真凶（黑匣子坐实：
        // 滚动内容存在时 resize→重滚=挤兑）。光标真被遮住时由
        // shell.renderFrame 的 nearest 滚动兜底（能不滚就不滚）。
        scheduleResize();
      };
      window.visualViewport?.addEventListener('resize', onViewportResize);
      // 地址栏/动态工具栏伸缩走 scroll 不走 resize（offsetTop/height 变）——
      // 卡身同拍钉 vv 追真可见区（扰动实验实锤：布局视口不随地址栏缩，
      // 只有 vv 是真边界）；可视高变了行列必须同缩（真机图B：顶栏带出→
      // 可视区变小→htop 底行切半，button-ime-tui-overflow-review 真机证据）
      const onViewportScroll = () => {
        pinToVv();
        reportViewport('viewport-scroll');
        scheduleResize();
      };
      window.visualViewport?.addEventListener('scroll', onViewportScroll);
      // 字体晚到自适应（真机图A 列截断修复）：fonts.load 在个别浏览器
      // 可能提前 resolve/不可信——loadingdone/loadingerror 兜底重量字格，
      // 字宽变了才动作：壳度量缓存作废 + 行列重测三方同步（cols 跟实际
      // 渲染字宽走，htop 帮助栏右侧不再截断）。首载完成也会触发一次，
      // 字格不变=无动作（幂等）。
      const onFontsSettled = () => {
        const w0 = cellW, h0 = cellH;
        measureCell();
        if (Math.abs(cellW - w0) > 0.01 || Math.abs(cellH - h0) > 0.01) {
          shell.invalidateMetrics();
          scheduleResize();
        }
      };
      document.fonts?.addEventListener('loadingdone', onFontsSettled);
      document.fonts?.addEventListener('loadingerror', onFontsSettled);
      const unmountFollow = () => {
        clearTimeout(resizeTimer);
        window.visualViewport?.removeEventListener('resize', onViewportResize);
        window.visualViewport?.removeEventListener('scroll', onViewportScroll);
        document.fonts?.removeEventListener('loadingdone', onFontsSettled);
        document.fonts?.removeEventListener('loadingerror', onFontsSettled);
      };
      ctx.effect(() => unmountFollow);

      // ALT_SCREEN 翻转（2026-08-24 两痛点②，button-ime-tui-overflow-review）：
      // TUI 整屏应用（htop/ranger/vim）应收起按键栏占满终端可视区——常驻
      // keybar 会把 TUI 挤进 container−84（TUI 底行贴在按键栏上方=挤占
      // 实锤）。行模式翻转回来按键栏放回原位。scrollEl 高度变 → 行列变 →
      // 走 scheduleResize 三方同步（TUI 会适配新尺寸，真终端窗口变更同款
      // 语义）。帧后发现翻转才切，不翻不动。
      let altMode = false;
      card.syncAlt = () => {
        const altNow = card.core.alt_screen();
        if (altNow === altMode) return;
        altMode = altNow;
        barStripEl.style.display = altNow ? 'none' : '';
        scrollEl.style.bottom = altNow ? '0px' : `${KEYBAR_H}px`;
        // TUI 填满不滚、行模式可回翻（fullscreen-card-port-review 三节③：
        // ALT 内容物理画不出卡外，overflow:hidden 防 TUI 溢出撑出滚动条）
        scrollEl.style.overflow = altNow ? 'hidden' : 'auto';
        scheduleResize();
      };

      const sessionId = await bridge.open({ command: opts.command, cols: card.cols, rows: card.rows });
      card.sessionId = sessionId;
      card.syncAlt();
      shell.renderFrame();
      card.placeKb();
      return inst.id;
    },
  };

  ctx.provide('termCards', service);
  bridge.connect();
  ctx.effect(() => () => {
    bridge.stop();
    for (const inst of instances.values()) inst.core.free();
    instances.clear();
  });
}

/** replay 重建核用的构造器（open 时从 glue 记下） */
let glueCtor: TermCoreGlue['TermCore'] | null = null;
