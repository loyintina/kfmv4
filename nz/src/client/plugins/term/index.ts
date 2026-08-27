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
/**
 * scrollback 历史行数（审计漂移#1 终裁 kfmv4-audit-term-parity-final-
 * verdict：各钉各的——na 10000 长日志场景，nz 钉 1000）。理由：nz 每行
 * 历史 = DOM div+span 节点，千行即千级节点挂在手机 WebView 渲染树，
 * 内存/重排成本随行数线性涨；na 是 GPU 网格渲染，成本结构不同——数量级
 * 差异是平台成本本征，非随手不同。1000 行 ≈ 33 屏翻史深度，手机单手够用。
 * 单源：TermCore 三处实例化全引此处（grep 散写字面量 1000 应零命中）。
 */
const SCROLLBACK_LINES = 1000;

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
  /** 帧后同步 ALT_SCREEN 模式位（TUI ↔ 行模式：scrollTop 清零 +
   *  overflow 切换 + 行列重测；按键栏两态都钉视口底不藏——
   *  2026-08-26 用户拍板 TUI 底部要求，tui-keybar-bottom-review） */
  syncAlt: () => void;
  checkDrift: () => void;
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

  /** 热更续命账（sessionStorage 键）：页面 reload 后 attach 回上一世会话 */
  const SS_KEY = 'nzTermLastSession';
  /** onSessionDead 自愈（服务端重启→重连 attach 全灭）：摘账 + 防循环
   *  reload 一次。5s 内已自愈过则只摘账不刷（防服务端反复横跳转圈）。 */
  const onSessionDead = (reason: string): void => {
    try {
      sessionStorage.removeItem(SS_KEY);
      const last = Number(sessionStorage.getItem('nzTermDeadReload') ?? 0);
      if (Date.now() - last > 5000) {
        sessionStorage.setItem('nzTermDeadReload', String(Date.now()));
        console.warn('[term] 会话死透（' + reason + '），自愈 reload');
        location.reload();
      }
    } catch { /* sessionStorage 不可用就 nothing */ }
  };

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
          inst.core = new glueCtor(inst.cols, inst.rows, SCROLLBACK_LINES);
          inst.shell.setCore(inst.core);
        }
        inst.core.feed(new TextEncoder().encode(data));
        inst.syncAlt();
        inst.checkDrift();
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
        inst.checkDrift();
        inst.shell.renderFrame();
        inst.placeKb();
        inst.followOutput();
      }
    },
    onSessionDead,
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
      // 同值跳过：pinToVv 被帧级/空闲巡查高频调用，值没变就别写 style
      // （避免无意义的 style recalc 失效）。
      let pinnedTop = -1, pinnedH = -1;
      const pinToVv = () => {
        const vv = window.visualViewport;
        if (!vv) return; // 无 vv API：height:100% 贴布局视口兜底
        const top = vv.offsetTop, h = vv.height;
        if (top === pinnedTop && h === pinnedH) return;
        pinnedTop = top; pinnedH = h;
        container.el.style.top = `${top}px`;
        container.el.style.height = `${h}px`;
      };
      pinToVv();
      // 实测定尺寸（写死 80×24 时代结束）：先用与壳同字体的探针量字格，
      // 再按容器可视面积算行列——手机有多宽终端就有多少列，不再裁字。
      // 探针字体栈=壳渲染栈（TERM_FONT_STACK 同源——换字体后度量自动跟
      // 实际渲染字体，字宽几何不回退的根基）。
      // 字体就绪门：@font-face 异步加载——不等就量会拿到 fallback 字宽，
      // 字体落地后渲染字宽突变而 cell 缓存不刷 = 光标/裁切错位。显式
      // load 两个打头字体（主+CJK 各一——几何两边都吃；失败不挡路：
      // 回落系统 mono，几何仍自洽）。
      try {
        await Promise.all([
          document.fonts.load(`13px 'NaMain'`, '0'),
          document.fonts.load(`13px 'NaCJK'`, '中'),
        ]);
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
      // 字格单源（2026-08-26 runaway 定位，ranger-runaway-rows-growth-review）：
      // 行列计算必须和渲染用同一把尺——壳 metrics 量自真实渲染行（首帧后
      // 即有真值）；闭包探针只在 open/字体事件时量，真机可卡停在字体落地
      // 前的旧值（遥测只见壳的 16.25、不见闭包值=观测盲区，本轮遥测补
      // mCellH/mCellW/rawH/src 四字段）。首量时壳未出生，先吃探针值。
      let liveShell: TermShell | null = null;
      const metricNow = () => {
        const sm = liveShell?.metrics;
        return sm && sm.cellH > 0 && sm.cellW > 0 ? sm : { cellW, cellH };
      };
      const measure = () => {
        const m = metricNow();
        return m.cellW > 0 && m.cellH > 0 ? {
          cols: Math.max(20, Math.floor(container.el.clientWidth / m.cellW)),
          rows: Math.max(5, Math.floor(scrollEl.clientHeight / m.cellH)),
          mCellW: m.cellW, mCellH: m.cellH, rawH: scrollEl.clientHeight,
        } : { cols: COLS, rows: ROWS, mCellW: m.cellW, mCellH: m.cellH, rawH: scrollEl.clientHeight };
      };
      const size = measure();
      const core = new g.TermCore(size.cols, size.rows, SCROLLBACK_LINES);
      // 壳必须画在内层元素上——TermShell 构造函数会重写根元素的 cssText，
      // 直接传 scrollEl 会把滚动区定位冲掉（半屏+无法滚动的实测教训）。
      // scrollEl=滚动视口（flex 列底锚），termEl=壳画布（历史块+屏幕行）。
      const termEl = document.createElement('div');
      scrollEl.appendChild(termEl);
      const shell = new TermShell(core, termEl, { cols: size.cols, rows: size.rows });
      liveShell = shell; // 字格单源：此后 measure/checkDrift 吃壳渲染尺
      // 底锚定两件套（构造后补——构造函数会重写 cssText，属性级补设不冲）
      termEl.style.marginTop = 'auto';
      termEl.style.flex = 'none';
      const card: TermCardInstance = {
        cardId, sessionId: null, core, shell, cols: size.cols, rows: size.rows,
        placeKb: () => {}, atBottom: true, followOutput: () => {}, inputToBottom: () => {},
        syncAlt: () => {}, checkDrift: () => {},
      };
      instances.set(cardId, card);

      // 8.8.3c scrollback 集中状态机（standard-scrollback-8.8.3c 纪律，
      // 散写必翻车）：atBottom 初始 true；新输出仅 true 才跟底（follow
      // Output 挂桥回调）；滚动事件双向翻转；输入（打字/按键栏/IME 落
      // 字）= true + 立即回底；IME 合成中不回底（落字才走 inputToBottom）。
      // 单区模型滚动对象=scrollEl（终端本体，历史+屏幕行同一连续区）。
      card.followOutput = () => {
        if (card.core.alt_screen()) return; // ALT 禁滚（runaway 修复：TUI 无 scrollback）
        if (card.atBottom) scrollEl.scrollTop = scrollEl.scrollHeight;
      };
      card.inputToBottom = () => {
        if (card.core.alt_screen()) return; // ALT 禁滚：回底会推 scrollTop
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
      //
      // 前台观测闸（2026-08-27 用户拍板）：用户前台使用时判卷钩子一律
      // 拒绝——前台使用权归用户，观测/注入只允许 App 后台，或取证会话
      // 显式授权（URL ?observe=1，用户知情才带）。自愈 reload 不闸
      // （保命路径非观测）；?debug 遥测不闸（被动、用户显式开）。诚实
      // 边界：CDP 引擎级 evaluate/截图闸不住（debug 口本质，保留给
      // 实验台+评审抽查权），本闸挡的是「经钩子的观测/操作」。
      const observeAllowed = (): boolean => /[?&]observe=1/.test(location.search);
      const foregroundGate = (): string | null => {
        if (document.visibilityState !== 'visible') return null; // 后台=观测自由
        if (observeAllowed()) return null;                       // 取证会话显式授权
        if (navigator.webdriver === true) return null;           // headless 考卷
        return 'REJECTED-FOREGROUND（用户前台，观测被闸；取证请带 ?observe=1）';
      };
      (window as unknown as Record<string, unknown>).__kfmNzTermScroll = () => ({
        scrollTop: scrollEl.scrollTop,
        scrollHeight: scrollEl.scrollHeight,
        clientHeight: scrollEl.clientHeight,
        isAtBottom: card.atBottom,
        rows: card.rows, // RO 自愈钉要断言行列落地（ranger-rows-not-shrink）
        cols: card.cols,
        // 压帽考卷字段（审计终裁漂移#1：SCROLLBACK_LINES=1000 三件套之
        // 考题件）——历史封顶与挤出计数，断言「灌超量后历史恒=钉值」
        histLen: core.history_len(),
        evicted: core.lines_evicted(),
        // C4 对照题取数口：壳渲染尺（宽 span 断言用）
        cellW: shell.metrics.cellW,
        cellH: shell.metrics.cellH,
        getContainer: () => scrollEl,
      });
      // 会话续命判卷钩子（热更闭环考卷用，并列扩展不碰既有语义）：
      // sessionId 本体 + 是否续命attach（screen 钩同源，无副本）
      (window as unknown as Record<string, unknown>).__kfmNzTermSession = () => ({
        sessionId: foregroundGate() ?? card.sessionId,
      });
      // C4 同串同宽判卷钩子（term-contract C4 对照题）：核光标列 x
      // （cursor() 打包=(row<<16)|col，列在低 16 位）+ 直喂核入口——
      // 判卷专用：直接 feed 绕开 shell 回显（zsh ZLE 对 PUA 字符的
      // 转义回显会污染「串宽度」测量，实测 E0B0 被画成 4 列），
      // 只绕 shell 不绕核管线，C4 断的正是核网格推进语义
      (window as unknown as Record<string, unknown>).__kfmNzCursorX = () =>
        foregroundGate() ?? (card.core.cursor() & 0xffff);
      (window as unknown as Record<string, unknown>).__kfmNzTermCoreFeed = (s: string) => {
        const rej = foregroundGate();
        if (rej) return rej;
        card.core.feed(new TextEncoder().encode(s));
        return card.core.cursor() & 0xffff;
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

      // 实验台 P0 可编程钩子（2026-08-26 nz-device-agent-p0-review，用户
      // 拍板最高优先；§0.5 P0「能动手」前提）：
      //   __kfmNzTermInject(str) = 注入输入走**现有输入管线**——
      //     takeMods（粘滞修饰同路读走）+ inputToBottom（落字才回底）
      //     + bridge.input（\n→\r，\r=回车），与 kb/IME 上屏同一语义，
      //     不绕过任何输入纪律；
      //   __kfmNzTermScreen() = 读当前可视屏纯文本——壳 screenText()
      //     取实际渲染态（塌尾行不计），与 __kfmNzTermScroll 同源不建副本。
      // 可并列扩展铁律：后补 InjectKey({key,ctrl})/InjectRaw(bytes)/
      // ScreenGrid()/ScreenAt(r,c) 按同款模式并列加（window.__kfmNzTerm*
      // 命名、读同一状态/管线），不改动这版。
      const win = window as unknown as Record<string, unknown>;
      win.__kfmNzTermInject = (str: string) => {
        const rej = foregroundGate();
        if (rej) return rej;
        if (!str || !card.sessionId) return;
        const text = takeMods(str);
        if (!text) return;
        card.inputToBottom(); // 注入=落字：回底纪律同 kb/IME
        bridge.input(card.sessionId, text.replace(/\n/g, '\r'));
      };
      win.__kfmNzTermScreen = () => foregroundGate() ?? shell.screenText();

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
      // 自观测基建 Stage①（2026-08-26，self-observation-telemetry-review）：
      // 几何遥测全字段——真实设备自报实际状态，agent 直读落盘日志判定
      // 「竖溢/横溢/卡身错/vv 错/布局≠视觉」，黑盒诊断不再靠模拟/转述。
      // 字段分组：视口（vvOffsetTop/vvHeight/innerH）、卡身（cardTop/cardH/
      // cardBottom）、滚动区（scrollTop/scrollH/scrollClientH/scrollRectTop/
      // Bottom）、行列（rows/cols/cellH/cellW）、派生（layoutMinusVisual=
      // innerH−vvHeight=地址栏/键盘占位；overflowBeyondVisible=scrollH−
      // scrollClientH=可滚余量）。原 ch 字段并入 scrollClientH（同值正名）。
      const reportViewport = (type: string, extra: Record<string, unknown> = {}) => {
        if (!postDebug) return;
        const vv = window.visualViewport;
        const cardRect = container.el.getBoundingClientRect();
        const scrollRect = scrollEl.getBoundingClientRect();
        postDebug({
          type, ...extra,
          vvOffsetTop: vv?.offsetTop ?? null, vvHeight: vv?.height ?? null,
          innerH: window.innerHeight,
          cardTop: cardRect.top, cardH: cardRect.height, cardBottom: cardRect.bottom,
          scrollTop: scrollEl.scrollTop, scrollH: scrollEl.scrollHeight,
          scrollClientH: scrollEl.clientHeight,
          scrollRectTop: scrollRect.top, scrollRectBottom: scrollRect.bottom,
          rows: card.rows, cols: card.cols,
          cellH: shell.metrics.cellH, cellW: shell.metrics.cellW,
          layoutMinusVisual: vv ? window.innerHeight - vv.height : null,
          overflowBeyondVisible: scrollEl.scrollHeight - scrollEl.clientHeight,
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
      const scheduleResize = (src = '') => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          // 钉-量同拍（2026-08-26 真机 ranger alt-enter rows=38 瞬态错量，
          // ranger-alt-enter-rows-measure-review）：先钉到当前 vv 再量——
          // 键盘/地址栏动画期 vv 会尖峰，pin 落在量之后会量到瞬态高。
          pinToVv();
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
            // 重测落地后补报一条：让读日志的 agent 看到「事件→行列落地」的
            // 完整闭环（viewport 记录里的 rows 是事件当拍的旧值）。
            // runaway 定位补：src=触发源、rawH/mCellH/mCellW=量测现场
            // （量了什么高度、用了哪把尺）——观测盲区随症封口。
            reportViewport('resized', { src, rawH: s.rawH, mCellH: s.mCellH, mCellW: s.mCellW });
          }
        }, 150);
      };
      let resizeTimer: ReturnType<typeof setTimeout> | undefined;
      // 自愈观测（2026-08-26 真机 ranger rows 未缩定位，
      // ranger-rows-not-shrink-review）：vv 事件与字体事件在个别浏览器
      // （Via 地址栏伸缩/字体缓存秒载）可能整组不送达——卡身钉对了而
      // rows 卡在旧值的真机实锤。ResizeObserver 直接盯 scrollEl 几何，
      // 布局落定后必触发，事件送不达也不卡 rows；与 vv/ALT/字体三路同走
      // scheduleResize 防抖块（重复触发幂等：行列没变就是 no-op）。
      const scrollRO = new ResizeObserver(() => scheduleResize('ro'));
      scrollRO.observe(scrollEl);
      // 帧级漂移自检（同上 ranger 瞬态错量修复的最后防线）：每次输出帧
      // 校验 rows/cols 与当前几何一致——瞬态尖峰错量若逃过所有事件路径
      // （落定无事件/RO 净零不触发），下一两帧内必被这里纠回。幂等：
      // 一致即 no-op；不一致走 scheduleResize 防抖块（钉-量同拍）。
      card.checkDrift = () => {
        if (!card.sessionId) return;
        // 先钉到 live vv：vv 事件不送达时 visualViewport.height 仍是当前
        // 真值（属性直读不依赖事件）——输出帧驱动下卡身总会收敛到真可见区
        pinToVv();
        const m = metricNow(); // 字格单源：与 measure 同一把壳渲染尺
        if (m.cellW <= 0 || m.cellH <= 0) return;
        const wantRows = Math.max(5, Math.floor(scrollEl.clientHeight / m.cellH));
        const wantCols = Math.max(20, Math.floor(container.el.clientWidth / m.cellW));
        if (wantRows !== card.rows || wantCols !== card.cols) scheduleResize('drift');
      };
      // 空闲巡查（2026-08-26 checkdrift-idle-gap-review：checkDrift 原仅
      // onOutput/onExit 触发=PTY 输出门控——ranger 空闲无输出 + vv 事件不
      // 送达 = 永不自愈，正是真机「落定近 2 秒无事件」的残留洞）。500ms
      // 低频兜底：幂等（一致即 no-op），恒成本≈直读一次 vv 属性+两次几何
      // 读；checkDrift 只发现不一致、量算仍归 scheduleResize 防抖块。
      const driftTimer = setInterval(() => card.checkDrift(), 500);
      const onViewportResize = () => {
        dbg.viewportEvents++;
        // 卡身同拍钉 vv（transition-report①：防抖后跳=过渡闪帧真凶）；
        // 按键栏在容器流内，卡身底动=整组底部 UI 同步上浮
        pinToVv();
        // 视口事件随 IME 事件同流落日志（评审五节建议）
        reportViewport('viewport');
        // 不滚！resize 时无条件滚到底是「每字抖几行」的真凶（黑匣子坐实：
        // 滚动内容存在时 resize→重滚=挤兑）。光标真被遮住时由
        // shell.renderFrame 的 nearest 滚动兜底（能不滚就不滚；ALT 态
        // 兜底在壳内禁用——TUI 无 scrollback，滚=病）。
        scheduleResize('viewport');
      };
      window.visualViewport?.addEventListener('resize', onViewportResize);
      // 地址栏/动态工具栏伸缩走 scroll 不走 resize（offsetTop/height 变）——
      // 卡身同拍钉 vv 追真可见区（扰动实验实锤：布局视口不随地址栏缩，
      // 只有 vv 是真边界）；可视高变了行列必须同缩（真机图B：顶栏带出→
      // 可视区变小→htop 底行切半，button-ime-tui-overflow-review 真机证据）
      const onViewportScroll = () => {
        pinToVv();
        reportViewport('viewport-scroll');
        scheduleResize('vv-scroll');
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
          scheduleResize('fonts');
        }
      };
      document.fonts?.addEventListener('loadingdone', onFontsSettled);
      document.fonts?.addEventListener('loadingerror', onFontsSettled);
      // 字体事件整组不送达的兜底（Via 缓存秒载可能不发 loadingdone，且
      // fonts.load 可能提前 resolve 量到 fallback 字格）——开后 1s/3s
      // 幂等复量：字格没变就是 no-op，变了才作废缓存+重测行列。
      const fontsRetry1 = setTimeout(onFontsSettled, 1000);
      const fontsRetry2 = setTimeout(onFontsSettled, 3000);
      const unmountFollow = () => {
        clearTimeout(resizeTimer);
        clearTimeout(fontsRetry1);
        clearTimeout(fontsRetry2);
        clearInterval(driftTimer);
        scrollRO.disconnect();
        window.visualViewport?.removeEventListener('resize', onViewportResize);
        window.visualViewport?.removeEventListener('scroll', onViewportScroll);
        document.fonts?.removeEventListener('loadingdone', onFontsSettled);
        document.fonts?.removeEventListener('loadingerror', onFontsSettled);
      };
      ctx.effect(() => unmountFollow);

      // ALT_SCREEN 翻转：TUI（htop/ranger/vim）与行模式的布局差异只剩
      // overflow（TUI 禁滚硬裁剪、行模式可回翻）——按键栏两态都在流内
      // 垫底可见、scrollEl bottom 恒 KEYBAR_H（2026-08-26 用户拍板 TUI
      // 底部要求：TUI 窗口=视口−键栏高，键栏按钮恒在视口底端，
      // tui-keybar-bottom-review；推翻 2026-08-24 两痛点②的藏键栏占满
      // 方案——那套让 TUI 里发不了 Ctrl/方向键）。行列重测走
      // scheduleResize 三方同步（TUI 会适配新尺寸，真终端窗口变更同款
      // 语义）。帧后发现翻转才切，不翻不动。
      let altMode = false;
      card.syncAlt = () => {
        const altNow = card.core.alt_screen();
        if (altNow === altMode) return;
        altMode = altNow;
        // ALT 进入时清行模式残留的程序化滚动：行模式 scrollTop 可能>0，
        // ALT 下禁滚后这值会残留成"超屏几帧"的起点（runaway 实锤其一）。
        if (altNow) scrollEl.scrollTop = 0;
        // TUI 填满（视口−键栏高）不滚、行模式可回翻（fullscreen-card-port
        // 三节③：ALT 内容物理画不出卡外，overflow:hidden 防 TUI 溢出撑
        // 出滚动条；三路禁滚治程序化赋值，与此正交）
        scrollEl.style.overflow = altNow ? 'hidden' : 'auto';
        scheduleResize();
        reportViewport(altNow ? 'alt-enter' : 'alt-exit'); // TUI 翻转=超屏诊断关键事件
      };

      // 热更续命（2026-08-27 用户拍板重走 na 热更路子）：页面 reload 后
      // sessionStorage 里有上一世会话 id → attach 回去（tail 回放补屏，
      // 「增加功能热重载而会话不断」的关键件）；attach 失败（服务端重启
      // 过，会话已死）→ 摘账重开新会话（自愈，不 reload 防循环）。
      let sessionId: string | null = null;
      const saved = opts.command ? null : sessionStorage.getItem(SS_KEY);
      if (saved) {
        sessionStorage.removeItem(SS_KEY); // 先摘：成败都不留旧账（成功会重写）
        // 预置 sessionId：attach 的 tail 回放按 inst.sessionId 匹配实例，
        // 不预置则回放帧找不到主人（时序坑）
        card.sessionId = saved;
        if (await bridge.attachSession(saved)) {
          sessionId = saved;
        } else {
          card.sessionId = null;
          console.warn('[term] 续命 attach 失败（服务端重启过？），开新会话');
        }
      }
      if (!sessionId) sessionId = await bridge.open({ command: opts.command, cols: card.cols, rows: card.rows });
      try { sessionStorage.setItem(SS_KEY, sessionId); } catch { /* 隐私模式等，热更退化为断线重开 */ }
      card.sessionId = sessionId;
      card.syncAlt();
      shell.renderFrame();
      card.placeKb();
      // 开页即报（Stage①：真实设备开 ?debug 页即自报基线几何，agent 直读）
      reportViewport('open');
      // CJK 基线探针（2026-08-26 随症字段，ranger-cjk-baseline-review；
      // 症收口后拆除）：真机 ranger 中文行内容上移几 px，headless 复现
      // 不出（shift=0）——疑犯=宽字 span 的 inline-block+overflow:hidden
      // 触发「baseline=盒底边」CSS 规则，真机 CJK fallback 字体的行盒
      // 更高时整盒上移。本探针复刻壳渲染结构量真值：spanTop−rowTop
      // （shift，0=正常/负=上移 px 数）、spanH（>16.25=CJK 行盒撑高实
      // 锤）、canvas 墨迹盒 asc/desc。等字体就绪再量（主字体晚到竞态）。
      if (postDebug) {
        const cjkProbe = () => {
          try {
            const cv = document.createElement('canvas').getContext('2d');
            if (!cv) return;
            cv.font = `13px ${TERM_FONT_STACK}`;
            const m = (t: string) => {
              const x = cv.measureText(t);
              return { a: +x.actualBoundingBoxAscent.toFixed(2), d: +x.actualBoundingBoxDescent.toFixed(2), w: +x.width.toFixed(2) };
            };
            const { cellW, cellH } = shell.metrics;
            const host = document.createElement('div');
            host.style.cssText = `position:absolute;left:-9999px;top:0;font:13px/1.25 ${TERM_FONT_STACK};`;
            container.el.appendChild(host);
            const row = document.createElement('div');
            row.style.cssText = 'white-space:pre;height:1.25em;';
            row.textContent = 'A';
            const sp = document.createElement('span');
            // 与 shell.appendTextCells 宽字 span 同款样式（复刻被测对象）
            sp.style.cssText = `display:inline-block;width:${2 * cellW}px;overflow:hidden;white-space:pre;`;
            sp.textContent = '中';
            row.appendChild(sp);
            host.appendChild(row);
            const rr = row.getBoundingClientRect(), sr = sp.getBoundingClientRect();
            postDebug({
              type: 'cjk-probe',
              cellW: +cellW.toFixed(2), cellH: +cellH.toFixed(2),
              inkA: m('A'), inkZhong: m('中'),
              spanW: 2 * cellW, zhongNaturalW: m('中').w,
              rowH: +rr.height.toFixed(2),
              spanH: +sr.height.toFixed(2),
              shift: +(sr.top - rr.top).toFixed(2), // 0=对齐；负=span 上移 px
              mainLoaded: document.fonts.check(`13px 'NaMain'`, 'A'),
              cjkLoaded: document.fonts.check(`13px 'NaCJK'`, '中'),
            });
            host.remove();
          } catch { /* 探针不挡主流程 */ }
        };
        Promise.race([document.fonts?.ready ?? Promise.resolve(), new Promise(r => setTimeout(r, 3000))])
          .then(() => setTimeout(cjkProbe, 100));
      }
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
