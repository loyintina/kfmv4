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
 * v1 留白：输入只认 可打印字符/Enter/Backspace/Tab/方向键（手机 IME 与
 * 组合键映射留 input 小插件）。
 */
import { Context } from 'cordis';
import { registerCardType } from '../../card-types.js';
import { createContainer } from '../../host.js';
import { loadTermCoreShared, type TermCoreGlue, type TermCoreHandle } from '../../term-core.js';
import { TermShell } from '../../term/shell.js';
import { TermWsBridge } from '../../term/bridge.js';

const COLS = 80;
const ROWS = 24;

interface TermCardInstance {
  cardId: string;
  sessionId: string | null;
  core: TermCoreHandle;
  shell: TermShell;
  cols: number;
  rows: number;
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

  // 真机诊断（闪烁排查期常驻，收口移除）：角标直读计数，手机无控制台也能看。
  // vp=可视区事件 rz=落地的行列变更 f=渲染帧 rp=重排行（每字应 ≈1 帧 1 行）
  const dbg = { viewportEvents: 0, resizesApplied: 0 };
  const badge = createContainer(ctx, { kind: 'overlay', slot: 'term-debug', owner: 'term', reuse: true });
  badge.el.style.cssText = 'position:fixed;right:4px;bottom:4px;z-index:400;pointer-events:none;'
    + 'font:10px monospace;color:#888;background:rgba(0,0,0,.5);padding:2px 4px;';
  const dbgTimer = setInterval(() => {
    let frames = 0, rows = 0;
    for (const inst of instances.values()) {
      frames += inst.shell.stats.frames;
      rows += inst.shell.stats.rowsPainted;
    }
    badge.el.textContent = `vp${dbg.viewportEvents} rz${dbg.resizesApplied} f${frames} rp${rows}`;
  }, 500);
  ctx.effect(() => () => clearInterval(dbgTimer));

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
        inst.shell.renderFrame();
      }
    },
    onExit(id, code) {
      for (const inst of instances.values()) {
        if (inst.sessionId !== id) continue;
        inst.core.feed(new TextEncoder().encode(`\r\n[进程已退出 code=${code}]\r\n`));
        inst.shell.renderFrame();
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
      // 容器=全屏视口。v1 口径 DOM 只画当前屏（回退历史未渲染上屏），
      // 没有可滚内容——overflow:hidden 杜绝「能滚动一部分」的错觉；
      // scrollback 渲染小步落地时改回 auto。
      container.el.style.cssText = 'position:absolute;inset:0;overflow:hidden;';
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
      const measure = () => cellW > 0 && cellH > 0 ? {
        cols: Math.max(20, Math.floor(container.el.clientWidth / cellW)),
        rows: Math.max(5, Math.floor(container.el.clientHeight / cellH)),
      } : { cols: COLS, rows: ROWS };
      const size = measure();
      const core = new g.TermCore(size.cols, size.rows, 1000);
      // 壳必须画在内层元素上——TermShell 构造函数会重写根元素的 cssText，
      // 直接传 container.el 会把容器的 inset:0 全屏定位冲掉（半屏+无法
      // 滚动的实测教训）。容器=全屏滚动视口，termEl=壳画布。
      const termEl = document.createElement('div');
      container.el.appendChild(termEl);
      const shell = new TermShell(core, termEl, { cols: size.cols, rows: size.rows });
      const card: TermCardInstance = { cardId, sessionId: null, core, shell, cols: size.cols, rows: size.rows };
      instances.set(cardId, card);

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
        const text = e.data || kb.value;
        kb.value = '';
        justCommitted = text;
        if (text && card.sessionId) {
          bridge.input(card.sessionId, text.replace(/\n/g, '\r'));
        }
      });
      container.el.addEventListener('click', () => kb.focus());
      kb.addEventListener('keydown', (e) => {
        if (composing || e.isComposing) return; // 合成中按键归输入法
        const bytes = keyToBytes(e);
        if (bytes && card.sessionId) {
          e.preventDefault();
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
        // 手机软键盘产出的文本整段取走后清空诱饵
        const text = kb.value;
        kb.value = '';
        if (text && card.sessionId) {
          bridge.input(card.sessionId, text.replace(/\n/g, '\r'));
        }
      });

      // 键盘跟随 + 尺寸跟随：软键盘弹起 → 可视区变矮（resizes-content）
      // → 重测行列 → 核/壳/PTY 三方同步 resize，再滚到底让光标行露出。
      // iOS 不认 interactive-widget 时 visualViewport resize 照样触发兜底。
      const followBottom = () => {
        container.el.scrollTop = container.el.scrollHeight;
      };
      // 真机诊断计数（守视/控制台也可 eval __kfmNzTermDebug 直读）
      (window as unknown as Record<string, unknown>).__kfmNzTermDebug = dbg;
      const onViewportResize = () => {
        dbg.viewportEvents++;
        followBottom();
        // 尺寸变更防抖（Termux 纪律：布局稳定才改尺寸）：IME 候选栏每敲
        // 一字都伸缩可视高（实测 vp 每字 +1）——高度跟随与行列变更都等
        // 150ms 稳定后才动，否则容器高度每字跳一下=肉眼可见的闪烁。
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          // 键盘吞最后一行的根治：浏览器不认 resizes-content 时（部分国产
          // 浏览器/webview）键盘直接盖在页面上——手动把容器高度压到可视高，
          // 用 JS 模拟 resizes-content。阈值 40px 防动态工具栏抖动误判。
          const vv2 = window.visualViewport;
          if (vv2) {
            container.el.style.height =
              vv2.height < window.innerHeight - 40 ? `${vv2.height}px` : '';
          }
          const s = measure();
          if (s.cols !== card.cols || s.rows !== card.rows) {
            dbg.resizesApplied++;
            card.cols = s.cols;
            card.rows = s.rows;
            card.core.resize(s.cols, s.rows);
            card.shell.resize(s.rows);
            if (card.sessionId) bridge.resize(card.sessionId, s.cols, s.rows);
          }
          followBottom();
        }, 150);
      };
      let resizeTimer: ReturnType<typeof setTimeout> | undefined;
      window.visualViewport?.addEventListener('resize', onViewportResize);
      const unmountFollow = () => {
        clearTimeout(resizeTimer);
        window.visualViewport?.removeEventListener('resize', onViewportResize);
      };
      ctx.effect(() => unmountFollow);

      const sessionId = await bridge.open({ command: opts.command, cols: card.cols, rows: card.rows });
      card.sessionId = sessionId;
      shell.renderFrame();
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
