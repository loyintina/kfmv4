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
import { TermShell } from '../../term/shell.js';
import { TermWsBridge } from '../../term/bridge.js';
import { mapText } from '../../term/keymap.js';
import { KEYBAR_H, MOD_ALT, MOD_CTRL, MOD_SHIFT, mountKeybar } from '../../term/keybar.js';
import { TERM_BG } from '../../term/palette.js';

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
  /** 帧后同步 ALT_SCREEN 模式位（两区模型：TUI 整屏 ↔ 行模式布局翻转） */
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
      // 容器=全屏视口（两区模型 2026-08-24 用户拍板，fixed-input-row-review）：
      // 内部绝对分区——scrollEl 滚动区（历史/输出，overflow:auto 真滚动，
      // 8.8.3c 状态机）+ barStrip 按键栏（流内，钉输入行上方）+ inputRowEl
      // 固定输入行（光标行剥出恒钉底，根治「正在打的命令行被输出顶出视野」
      // ——?kbOff 的碰巧掩盖退役）。按键栏/输入行回流内 = 8.x aux-bar 存活
      // 模式，钉 vv 的条带定位复杂度结构性蒸发。容器自身 overflow:hidden。
      container.el.style.cssText = 'position:absolute;left:0;right:0;top:0;bottom:0;overflow:hidden;';
      // ?kbOff=<px> 代字（keybar-kboff-report，用户拍板）：个别浏览器
      // （Via 有栏+键盘态）vv.height 多报 ~42px——容器高按 vv−kbOff 收，
      // 整组底部 UI（输入行+按键栏）随之上移；无参数=0 现状不改。
      const kbOffParam = Number(new URLSearchParams(location.search).get('kbOff'));
      const kbOff = Number.isFinite(kbOffParam) && kbOffParam > 0 ? Math.round(kbOffParam) : 0;
      // 出生即钉 vv（不等首个 vv 事件，判尺结论：vv 是唯一真尺）——有栏
      // 无键盘态布局底≠可视底，bottom 布局锚会把终端下部藏进 chrome 后；
      // top+height 显式钉上后 bottom 锚自然失效（over-constrained 时
      // bottom 被忽略），后续 vv 事件走同一钉法。
      // 过渡帧定位修法（keybar-float-transition-report①）：钉 vv 移出
      // 防抖——键盘弹起是动画，vv 逐帧变，容器等 150ms 防抖才追 =
      // 那几帧底部 UI 被盖的闪帧真凶。样式改写很便宜，布局一变当拍就钉；
      // 贵的重测行列+核 resize 仍留防抖（动画期不 thrash）。
      const pinToVv = () => {
        const vv0 = window.visualViewport;
        if (!vv0) return;
        container.el.style.top = `${vv0.offsetTop}px`;
        container.el.style.height = `${Math.max(80, vv0.height - kbOff)}px`;
      };
      pinToVv();
      // 终端卡全屏期间锁死背景页滚动（boot 页比屏幕高，不锁会和终端抢
      // 滚动、被 scrollIntoView 类行为带着跑——实测闪烁根因之一）
      const prevBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      ctx.effect(() => () => { document.body.style.overflow = prevBodyOverflow; });
      // 实测定尺寸（写死 80×24 时代结束）：先用与壳同字体的探针量字格，
      // 再按容器可视面积算行列——手机有多宽终端就有多少列，不再裁字。
      const probe = document.createElement('div');
      probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;'
        + 'font:13px/1.25 ui-monospace,Menlo,Consolas,monospace;';
      probe.textContent = '0'.repeat(20);
      container.el.appendChild(probe);
      const cellW = probe.getBoundingClientRect().width / 20;
      const cellH = probe.getBoundingClientRect().height;
      probe.remove();
      // 两区布局（行高量出后一次性落位）：
      //   scrollEl  滚动区 top:0 bottom:按键栏+输入行（overflow:auto）
      //   barStrip  按键栏 bottom:输入行高 height:KEYBAR_H（流内钉输入行上方）
      //   inputRowEl 固定输入行 bottom:0 height:行高（光标行剥出恒钉底）
      const inputRowH = Math.max(10, Math.round(cellH));
      const scrollEl = document.createElement('div');
      scrollEl.style.cssText = `position:absolute;left:0;right:0;top:0;bottom:${KEYBAR_H + inputRowH}px;overflow:auto;`;
      container.el.appendChild(scrollEl);
      const inputRowEl = document.createElement('div');
      inputRowEl.style.cssText = `position:absolute;left:0;right:0;bottom:0;height:${inputRowH}px;`
        + `background:${TERM_BG};overflow:hidden;`;
      container.el.appendChild(inputRowEl);
      // ALT_SCREEN 模式位（TUI 整屏）：帧后发现翻转才换布局——输入行隐藏、
      // 滚动区吃下它的高度（行列数不变：行模式多出的那 1 行正是输入行）。
      let altMode = false;
      const measure = () => cellW > 0 && cellH > 0 ? {
        cols: Math.max(20, Math.floor(container.el.clientWidth / cellW)),
        // 行模式：滚动区行数+1 输入行；ALT：滚动区全量（高度已涨一行高，
        // floor 后正好同行数——两种模式行列恒定，切模式不触发 PTY resize）
        rows: Math.max(5, Math.floor(scrollEl.clientHeight / cellH) + (altMode ? 0 : 1)),
      } : { cols: COLS, rows: ROWS };
      const size = measure();
      const core = new g.TermCore(size.cols, size.rows, 1000);
      // 壳必须画在内层元素上——TermShell 构造函数会重写根元素的 cssText，
      // 直接传 scrollEl 会把滚动区定位冲掉（半屏+无法滚动的实测教训）。
      // scrollEl=滚动视口，termEl=壳画布（历史块+屏幕行），inputRowEl=输入行。
      const termEl = document.createElement('div');
      scrollEl.appendChild(termEl);
      const shell = new TermShell(core, termEl, { cols: size.cols, rows: size.rows, inputRowEl });
      const card: TermCardInstance = {
        cardId, sessionId: null, core, shell, cols: size.cols, rows: size.rows,
        placeKb: () => {}, atBottom: true, followOutput: () => {}, inputToBottom: () => {},
        syncAlt: () => {},
      };
      instances.set(cardId, card);
      card.syncAlt = () => {
        const altNow = card.core.alt_screen();
        if (altNow === altMode) return;
        altMode = altNow;
        inputRowEl.style.display = altNow ? 'none' : '';
        scrollEl.style.bottom = altNow ? `${KEYBAR_H}px` : `${KEYBAR_H + inputRowH}px`;
        card.placeKb();
      };

      // 8.8.3c scrollback 集中状态机（standard-scrollback-8.8.3c 纪律，
      // 散写必翻车）：atBottom 初始 true；新输出仅 true 才跟底（follow
      // Output 挂桥回调）；滚动事件双向翻转；输入（打字/按键栏/IME 落
      // 字）= true + 立即回底；IME 合成中不回底（落字才走 inputToBottom）。
      // 两区模型下滚动对象=scrollEl（输入行恒钉底不参与滚动）。
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
      // 判卷/取证钩子契约（standard-scrollback 三节 + fixed-input-row
      // 四节）：v1 单卡口径，多卡并存时后开的覆盖——多卡改造小步再按
      // cardId 分键。
      (window as unknown as Record<string, unknown>).__kfmNzTermScroll = () => ({
        scrollTop: scrollEl.scrollTop,
        scrollHeight: scrollEl.scrollHeight,
        clientHeight: scrollEl.clientHeight,
        isAtBottom: card.atBottom,
        getContainer: () => scrollEl,
      });
      // 固定输入行 rect 钩子（两区模型判卷核心：bottom 恒≈视口底）
      (window as unknown as Record<string, unknown>).__kfmNzTermInputRow = () => {
        const r = inputRowEl.getBoundingClientRect();
        const cr = container.el.getBoundingClientRect();
        return {
          top: r.top, bottom: r.bottom, height: r.height,
          isAtBottom: !altMode && Math.abs(r.bottom - cr.bottom) < 2,
        };
      };

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
      // 两区模型：行模式光标在固定输入行（诱饵钉输入行上）；ALT 整屏
      // 光标在滚动区（钉光标格原式）。
      card.placeKb = () => {
        const cur = card.core.cursor();
        const m = shell.metrics;
        if (m.cellW <= 0 || m.cellH <= 0) return;
        kb.style.left = `${(cur & 0xffff) * m.cellW}px`;
        kb.style.top = card.core.alt_screen()
          ? `${(cur >>> 16) * m.cellH}px`
          : `${inputRowEl.offsetTop}px`;
      };

      // 8.8.3b 按键栏（仿 Termux，纪律见 keybar.ts 头注释）：两区模型起
      // 改为容器流内条带（钉输入行上方）——回到 8.x aux-bar 流内存活
      // 模式，键盘弹起随容器钉 vv 同步上浮，条带自身不再追 vv（判尺/
      // 过渡帧/双基准打架那套随布局重构退役）。生灭随容器（owner 死
      // 容器摘=子树同摘）。pointer-events:auto 防层根 none 拦截。
      const barStripEl = document.createElement('div');
      barStripEl.style.cssText = `position:absolute;left:0;right:0;bottom:${inputRowH}px;height:${KEYBAR_H}px;pointer-events:auto;`;
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
      // kboff 保留：?kbOff 是常驻代字，命中标记便于真机确认走没走对分支。
      const reportViewport = (type: string) => {
        postDebug?.({ type, kboff: kbOff });
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
      const onViewportResize = () => {
        dbg.viewportEvents++;
        // 容器同拍钉 vv（transition-report①：防抖后跳=过渡闪帧真凶）；
        // 按键栏/输入行在容器流内，容器底动=整组底部 UI 同步上浮
        pinToVv();
        // 视口事件随 IME 事件同流落日志（评审五节建议）
        reportViewport('viewport');
        // 不滚！resize 时无条件滚到底是「每字抖几行」的真凶（黑匣子坐实：
        // 滚动内容存在时 resize→重滚=挤兑）。光标真被遮住时由
        // shell.renderFrame 的 nearest 滚动兜底（能不滚就不滚）。
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          // 钉 vv 已在事件当拍完成（见上 pinToVv），防抖里只剩贵的部分：
          // 重测行列 → 核/壳/PTY 三方同步 resize。钉法口径：容器顶=
          // vv.offsetTop、高=vv.height−kbOff，全程不以 innerHeight 为基准
          // ——chrome 显示时两者差 1-2px 的真机实锤不再适用；chrome 显隐/
          // 键盘弹收容器都恰好占满可视区。
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
      window.visualViewport?.addEventListener('resize', onViewportResize);
      // 地址栏/动态工具栏伸缩走 scroll 不走 resize（offsetTop 变）——容器钉 vv 同追
      const onViewportScroll = () => {
        pinToVv();
        reportViewport('viewport-scroll');
      };
      window.visualViewport?.addEventListener('scroll', onViewportScroll);
      const unmountFollow = () => {
        clearTimeout(resizeTimer);
        window.visualViewport?.removeEventListener('resize', onViewportResize);
        window.visualViewport?.removeEventListener('scroll', onViewportScroll);
      };
      ctx.effect(() => unmountFollow);

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
