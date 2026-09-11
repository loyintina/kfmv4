/**
 * src/client/plugins/file-tree/index.tsx — 文件树卡片插件（v1 判据稿 §三
 * 2026-09-10 签收版实施；状态机清单 = docs/file-tree-v1-design.md §3.2，
 * 契约 §7 机检锚点；实施定案见判据稿 §七 实施注记）。
 *
 * 形态与入口（§七 定案）：
 *   · 入口=@ 弹窗「浏览完整文件树…」行 → window 事件 kfm-nz-fstree-open
 *     （跨插件路由走 CustomEvent 词汇，kfm-nz-pool-open 同款）——v1 不绑
 *     左滑手势（PageSwipe:500 已归 config-pool，两插件同层抢裁决=竞态面）；
 *   · 树页=全屏抽屉 z44（与池页同档互斥态），底=composer 顶（借
 *     --kfm-aichat-composer-h 实测单源）；data-kfm-fstree-open 属性挂
 *     documentElement——tokens.css 据此藏 tmux 控件+输入栏/光球升 45 恒顶
 *     （池页同款机关，@ 回流要求 composer 恒可见可点）；× 钮/Esc 关闭
 *     （kfm-closing 换名播完才摘 DOM，ai-chat/池页同款收尾机关）；
 *   · 平面行虚拟化：行高恒 26px 自算窗口（可视区±屏高，不引库）；容器
 *     渐变/左强调边按行携带（同深度行共享色带+兄弟首尾圆角），容器级
 *     0fr→1fr 高度动画由行级 stagger 揭示替代（§3.3 实施注记）；
 *   · 懒加载：展开才 fetch /api/fs/list，children 缓存 per dir（fetchLog
 *     记账=「一目录只 fetch 一次」观测源）；展开/收起动画期 240/180ms
 *     全局锁（§3.2：锁只防视觉抖动，DOM+CSS transition 无竞态面）；
 *   · 点文件=预览浮层（/api/fs/read：binary 拒显+截断标注）。
 *   · 长按行（550ms，位移>10px 取消）=复制该行相对路径到剪贴板
 *     （2026-09-11 用户拍板）：Clipboard API→execCommand 三级链（WebView
 *     非 https 环境无 async Clipboard，execCommand 走用户手势同步执行），
 *     toast 回执+振动。长按消费掉该次 click（不触发预览/展开）。
 *   · 【2026-09-11 结项摘除】AI 系（ai-chat/config-pool）随结项卸载：
 *     @ 弹窗（寄生 composer）随之退役，树页入口=右滑手势（唯一）；
 *     「插入 @引用」按钮与 kfm-nz-aichat-insert 回流随之退役（翻案看
 *     git 643054dc 前史）。
 *
 * 结构纪律：机态全部住 mount 域闭包（config-pool 的 core 同款），组件
 * 函数体内只有 tick+listRef 两个 hooks——hooks 出组件即 Invalid hook
 * call（首版实锤：mount 即崩、树页整插件缺席，B 卷③钉红抓出）。
 *
 * 观测钩（公共契约）：__kfmNzFsTree() 同步报 {open,closing,expanded,
 *   loadedDirs,total,virtual{start,end},selected,fetches,fetchLog,lastError}。
 */
import { createElement, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Context } from 'cordis';
import type { UiPlugin, UiPluginHandle } from '../../kernel/ui-kernel.js';
import { GestureLayer, registerGesture } from '../../gesture.js';
import { fetchFsList, fetchFsRead, type FsEntry } from '../../fs/api.js';

/** 手势落点排除面（原 config-pool POOL_SWIPE_EXCLUDE 单继承——池页已随
 *  AI 系退役，横向手势让位对象：tmux 标签排/键栏/composer(已摘)/光球(已摘)） */
const FSTREE_SWIPE_EXCLUDE = [
  '[data-tmux-strip]', '[data-kfm-keybar]', '[data-kfm-aichat-bar]', '[data-kfm-aichat-orb]',
  '[data-aichat-model-menu]', '[data-aichat-config-menu]', '[data-pool-overlay]',
].join(',');

// ---------- §3.1 令牌表（na 照抄即同手感；参数文档化=规格本体） ----------

/** 缩进：递减增量表（index=深度），深层增量钳 2px（防深层目录出屏） */
const SHIFT_TABLE = [18, 16, 14, 12, 10, 9, 8, 7, 6, 5, 4, 3, 3, 2, 2, 2, 2, 2, 2, 2];
const shift = (d: number): number => SHIFT_TABLE[Math.min(d, SHIFT_TABLE.length - 1)];

/** 累计缩进：递减增量逐层相加（「向左错开的卡片」纵深），总量钳 160px */
const INDENT_CAP = 160;
const indentPx = (d: number): number => {
  let sum = 0;
  for (let i = 0; i < d; i++) sum += shift(i);
  return Math.min(sum, INDENT_CAP);
};

/** 逐层加深（嵌套叠加出纵深；深层更浓不是更淡）——§3.1 公式直译。
 *  2026-09-11 用户裁决：逐行渐变太花，行底改纯色平涂——纵深保留（α 仍
 *  随深度加深），α=原渐变顶底均值（0.05 + density·0.26），na 同步改。 */
const densityOf = (d: number): number => 1 - shift(d) / 18; // 浅≈0 → 深→0.89
const flatAlpha = (d: number): number => 0.05 + densityOf(d) * 0.26; // 行底纯色
const borderOp = (d: number): number => 0.3 + densityOf(d) * 0.5; // 左强调边框

const ROW_H = 26; // 行高恒定（虚拟化自算的基石）
const STAGGER_MS = 20; // 子行 stagger 步长
const STAGGER_MAX = 12; // stagger 上限行数（§3.3）
const STAGGER_WINDOW_MS = 600; // stagger 只在展开后短窗内挂（滚动补挂不重播）
const LOCK_EXPAND_MS = 240; // 展开动画锁（§3.2）
const LOCK_COLLAPSE_MS = 180; // 收起动画锁

interface TreeRow {
  path: string; // 相对路径（'' 为根，根不做行）
  name: string;
  depth: number;
  type: 'dir' | 'file';
  idx: number; // 兄弟序（stagger delay 用）
  first: boolean; // 兄弟首（容器块圆角顶）
  last: boolean; // 兄弟尾（容器块圆角底）
}

interface PreviewState {
  path: string;
  loading: boolean;
  binary?: boolean;
  truncated?: boolean;
  text?: string;
  error?: string;
}

/** 平面化：按缓存树 DFS 出行序（展开的目录其后紧跟其子层） */
function flatten(children: Map<string, FsEntry[]>, expanded: Set<string>): TreeRow[] {
  const rows: TreeRow[] = [];
  const walk = (dir: string, depth: number): void => {
    const entries = children.get(dir);
    if (!entries) return;
    entries.forEach((e, i) => {
      const childPath = dir === '' ? e.name : `${dir}/${e.name}`;
      rows.push({
        path: childPath, name: e.name, depth, type: e.type, idx: i,
        first: i === 0, last: i === entries.length - 1,
      });
      if (e.type === 'dir' && expanded.has(childPath)) walk(childPath, depth + 1);
    });
  };
  walk('', 0);
  return rows;
}

/** P9：收起动画的 JS 等待时长从 token 读（ai-chat/config-pool 同款） */
const readDurNormalMs = (): number => {
  const v = getComputedStyle(document.documentElement).getPropertyValue('--kfm-dur-normal').trim();
  const ms = /^([\d.]+)ms$/.exec(v);
  if (ms) return Number.parseFloat(ms[1]);
  const s = /^([\d.]+)s$/.exec(v);
  return s ? Number.parseFloat(s[1]) * 1000 : 250;
};

const LONG_PRESS_MS = 550; // 长按阈值（§七⑫）
const LONG_PRESS_SLOP = 10; // 位移超过即取消（滚动意图让路）

/** 剪贴板写入三级链（§七⑫ 长按复制）：①async Clipboard API（安全上下文
 *  才存在）②execCommand 回退——WebView 非 https 也能用，但须用户手势
 *  同步执行（长按抬指后的激活窗口内）。返回最终成败。 */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* 权限拒/非安全上下文 → 落执行令回退 */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:-999px;left:-999px;opacity:0;';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

export function createFileTreePlugin(ctx: Context): UiPlugin {
  return {
    id: 'file-tree',
    stateMachine: 'docs/file-tree-v1-design.md',
    mount(slot: HTMLElement): UiPluginHandle {
      // ---- 数据与机态（mount 域闭包；bump 驱动渲染——config-pool 同款） ----
      const children = new Map<string, FsEntry[]>();
      const expanded = new Set<string>();
      const expandedAt = new Map<string, number>(); // 目录→展开时刻（stagger 窗）
      const animated = new Set<string>(); // 已挂过 stagger 的行（不重播）
      const fetchLog: string[] = []; // 成功 fetch 过的目录（一目录一次观测源）
      const S = { open: false, closing: false, preview: null as PreviewState | null };
      let lastError: string | null = null;
      let lockUntil = 0;
      let bump: () => void = () => { /* React 未就绪前的早拍丢弃 */ };
      let closeTimer: ReturnType<typeof setTimeout> | null = null;
      const rowsFlat: { current: TreeRow[] } = { current: [] };
      const win: { current: { start: number; end: number } } = { current: { start: 0, end: 0 } };
      let listElBridge: () => HTMLDivElement | null = () => null; // TreeApp 渲染时接管
      const lastCopyBridge: { current: { path: string; ok: boolean } | null } = { current: null };

      const ensureDir = async (dir: string): Promise<void> => {
        if (children.has(dir)) return;
        try {
          const entries = await fetchFsList(dir);
          children.set(dir, entries);
          fetchLog.push(dir);
        } catch (e) {
          lastError = `list ${dir}: ${String(e)}`; // 失败不缓存：下次展开重试
        }
        bump();
      };

      const openPage = (): void => {
        if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
        S.closing = false;
        S.open = true;
        bump();
        void ensureDir(''); // 根层懒加载（重复 open 幂等——已缓存即零网络）
      };

      const closePage = (): void => {
        S.preview = null;
        S.open = false;
        S.closing = true;
        if (closeTimer) clearTimeout(closeTimer);
        closeTimer = setTimeout(() => { closeTimer = null; S.closing = false; bump(); }, readDurNormalMs());
        bump();
      };

      // ---- 入口路由（kfm-nz-fstree-open 事件；挂/摘同一具名引用，effect
      //      本体住 TreeApp——hooks 不出组件） ----
      const onOpenEvent = (): void => openPage();

      // ---- 右滑入口（2026-09-11 用户拍板；§七 注记 10）----
      // 手势核单次手势只锁一个 handler：本层 FileTree:700 压过 config-pool
      // 的 PageSwipe:500，条件互斥设计——
      //   池页开 → 不 claim（池页右滑返回归池页自理）；
      //   树开   → 全权：左滑=关（树页自左抽屉入，左滑推回）；右滑=零动作；
      //   双闭   → 右滑=开树；左滑=零动作（历史转发池页分支随 AI 系摘除退役）。
      // 阈值与池页同单：|dx|≥64 且 |dx|>2|dy|（垂直滚动自然落选）。
      const judgeFstreeSwipe = (dx: number, dy: number): 'left' | 'right' | null => {
        if (Math.abs(dx) < 64 || Math.abs(dx) <= 2 * Math.abs(dy)) return null;
        return dx > 0 ? 'right' : 'left';
      };
      registerGesture(ctx, {
        id: 'file-tree:page-swipe',
        layer: GestureLayer.FileTree,
        targetFilter: (target) => !target.closest(FSTREE_SWIPE_EXCLUDE),
        condition: () => S.open || !document.documentElement.hasAttribute('data-kfm-pool-open'),
        onEnd: (_e, dx, dy) => {
          const v = judgeFstreeSwipe(dx, dy);
          if (S.open) {
            if (v === 'left') closePage(); // 树页推回左抽屉
            return; // 右滑零动作；池页开态已被条件排除
          }
          if (document.documentElement.hasAttribute('data-kfm-pool-open')) return; // 条件外保险
          if (v === 'right') openPage();
          // 左滑零动作（池页转发分支随 AI 系摘除退役，2026-09-11）
        },
      });

      // ---- 交互 ----
      const toggle = (row: TreeRow): void => {
        const now = Date.now();
        if (now < lockUntil) return; // §3.2 动画锁：锁只防视觉抖动
        lockUntil = now + (expanded.has(row.path) ? LOCK_COLLAPSE_MS : LOCK_EXPAND_MS);
        if (expanded.has(row.path)) {
          expanded.delete(row.path);
        } else {
          expanded.add(row.path);
          expandedAt.set(row.path, now);
          void ensureDir(row.path); // 懒加载：展开才 fetch，children 缓存
        }
        bump();
      };

      const openPreview = (path: string): void => {
        S.preview = { path, loading: true };
        bump();
        void fetchFsRead(path)
          .then((r) => {
            if (S.preview && S.preview.path === path) {
              S.preview = { ...S.preview, loading: false, binary: r.binary, truncated: r.truncated, text: r.text };
              bump();
            }
          })
          .catch((e) => {
            if (S.preview && S.preview.path === path) {
              S.preview = { ...S.preview, loading: false, error: String(e) };
              bump();
            }
          });
      };

      // ---- 虚拟化窗口（§3.2：行高恒 26px 自算，可视区±屏高，不引库） ----
      const rafRef = { plain: 0 };
      const recalc = (): void => {
        const el = listElBridge();
        if (!el) return;
        const total = rowsFlat.current.length;
        const view = Math.max(1, Math.ceil(el.clientHeight / ROW_H));
        const start = Math.max(0, Math.floor(el.scrollTop / ROW_H) - view);
        const end = Math.min(total, Math.ceil((el.scrollTop + el.clientHeight) / ROW_H) + view);
        if (win.current.start !== start || win.current.end !== end) {
          win.current = { start, end };
          bump();
        }
      };
      const onScroll = (): void => {
        if (rafRef.plain) return;
        rafRef.plain = requestAnimationFrame(() => { rafRef.plain = 0; recalc(); });
      };

      function TreeApp(): React.ReactElement {
        const [tick, setTick] = useState(0);
        const listRef = useRef<HTMLDivElement | null>(null);
        // 长按复制（§七⑫）：单活跃按点账 + toast 回执
        const pressRef = useRef<{ timer: number | null; fired: boolean; x: number; y: number }>({ timer: null, fired: false, x: 0, y: 0 });
        const [toast, setToast] = useState<string | null>(null);
        const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
        bump = () => setTick((x) => x + 1);
        listElBridge = () => listRef.current;

        const showToast = (msg: string): void => {
          setToast(msg);
          if (toastTimer.current) clearTimeout(toastTimer.current);
          toastTimer.current = setTimeout(() => setToast(null), 1600);
        };
        const copyRow = (row: TreeRow): void => {
          void copyText(row.path).then((ok) => {
            lastCopyBridge.current = { path: row.path, ok };
            showToast(ok ? `已复制 ${row.path}` : '复制失败');
          });
          try { (navigator as unknown as { vibrate?: (p: number) => boolean }).vibrate?.(30); } catch { /* 无振动器不挡 */ }
        };
        const pressStart = (e: React.PointerEvent, row: TreeRow): void => {
          const p = pressRef.current;
          p.fired = false; p.x = e.clientX; p.y = e.clientY;
          if (p.timer) clearTimeout(p.timer);
          p.timer = window.setTimeout(() => { p.timer = null; p.fired = true; copyRow(row); }, LONG_PRESS_MS);
        };
        const pressMove = (e: React.PointerEvent): void => {
          const p = pressRef.current;
          if (p.timer !== null && (Math.abs(e.clientX - p.x) > LONG_PRESS_SLOP || Math.abs(e.clientY - p.y) > LONG_PRESS_SLOP)) {
            clearTimeout(p.timer); p.timer = null; // 滚动意图让路
          }
        };
        const pressEnd = (): void => {
          const p = pressRef.current;
          if (p.timer) { clearTimeout(p.timer); p.timer = null; }
        };

        const rows = useMemo(
          () => flatten(children, expanded),
          // eslint-disable-next-line react-hooks/exhaustive-deps
          [tick],
        );
        rowsFlat.current = rows;
        useLayoutEffect(() => { recalc(); }); // 行数变化/首挂后重算窗口

        // 收起动画中途重开（快速重开）：作废摘除定时器、回入场档
        useEffect(() => {
          if (S.open && S.closing) {
            if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
            S.closing = false;
            bump();
          }
        });

        // 层级规则（§七 定案）：树页开时 documentElement 挂
        // data-kfm-fstree-open——tokens.css 据此藏 tmux 控件+composer/光球
        // 升 45 恒顶。每渲染收敛（toggleAttribute 幂等）；卸载清属性
        useEffect(() => {
          document.documentElement.toggleAttribute('data-kfm-fstree-open', S.open);
        });
        useEffect(() => () => {
          document.documentElement.removeAttribute('data-kfm-fstree-open');
        }, []);

        // Esc 关闭（预览优先关；[] 挂一次，机态走 S 闭包实时读）
        useEffect(() => {
          const onKey = (e: KeyboardEvent): void => {
            if (e.key !== 'Escape' || !S.open) return;
            if (S.preview) { S.preview = null; bump(); }
            else closePage();
          };
          document.addEventListener('keydown', onKey);
          return () => document.removeEventListener('keydown', onKey);
          // eslint-disable-next-line react-hooks/exhaustive-deps
        }, []);

        // 入口路由：kfm-nz-fstree-open 事件（挂/摘同一 mount 域具名引用）
        useEffect(() => {
          window.addEventListener('kfm-nz-fstree-open', onOpenEvent);
          return () => window.removeEventListener('kfm-nz-fstree-open', onOpenEvent);
          // eslint-disable-next-line react-hooks/exhaustive-deps
        }, []);

        // stagger 判定（§3.3）：行父目录展开后短窗内首次渲染才挂类——
        // 虚拟化滚动补挂的行不重播动画；delay=兄弟序×20ms 上限 12 行
        const staggerOf = (row: TreeRow): string | null => {
          const slash = row.path.lastIndexOf('/');
          const parent = slash === -1 ? '' : row.path.slice(0, slash);
          const t0 = expandedAt.get(parent);
          if (!t0 || Date.now() - t0 >= STAGGER_WINDOW_MS) return null;
          if (animated.has(row.path)) return null;
          animated.add(row.path);
          return `${Math.min(row.idx, STAGGER_MAX - 1) * STAGGER_MS}ms`;
        };

        if (!S.open && !S.closing) return createElement('div');

        const preview = S.preview;
        const w = win.current;
        const slice = rows.slice(w.start, w.end);
        const rowEl = (row: TreeRow): React.ReactElement => {
          const expandedNow = row.type === 'dir' && expanded.has(row.path);
          const selected = preview?.path === row.path;
          const delay = staggerOf(row);
          return createElement('div', {
            key: row.path,
            'data-fstree-row': row.path,
            'data-fstree-type': row.type,
            className: delay !== null ? 'kfm-fstree-stagger' : undefined,
            onClick: () => {
              if (pressRef.current.fired) { pressRef.current.fired = false; return; } // 长按已消费：抑制 click
              if (row.type === 'dir') toggle(row); else openPreview(row.path);
            },
            onPointerDown: (e: React.PointerEvent) => pressStart(e, row),
            onPointerMove: pressMove,
            onPointerUp: pressEnd,
            onPointerCancel: pressEnd,
            style: {
              position: 'relative', height: `${ROW_H}px`, display: 'flex', alignItems: 'center', gap: '5px',
              paddingLeft: `${6 + indentPx(row.depth)}px`, paddingRight: '8px',
              cursor: 'pointer', overflow: 'hidden',
              // 容器块近似：同深度行共享色带，兄弟首尾圆角（§3.1）
              borderRadius: `${row.first ? 4 : 0}px ${row.first ? 4 : 0}px ${row.last ? 4 : 0}px ${row.last ? 4 : 0}px`,
              // 行底纯色（2026-09-11 用户裁决：逐行渐变太花）——纵深保留
              // （α 仍随深度逐层加深），α=原渐变顶底均值公式（§3.1 已同步）
              background: `rgba(255,255,255,${flatAlpha(row.depth).toFixed(3)})`,
              ...(delay !== null ? { animationDelay: delay } : {}),
            },
          },
          row.depth > 0
            ? createElement('span', {
                // 左强调边框：2px 圆角4，accent 系（§3.1）——span+opacity 表达
                // alpha，不依赖 color-mix（旧 WebView 兼容）
                style: {
                  position: 'absolute', left: 0, top: 0, bottom: 0, width: '2px',
                  borderRadius: '4px', background: 'var(--kfm-accent)', opacity: borderOp(row.depth),
                },
              })
            : null,
          selected
            ? createElement('span', {
                // 选中底：accent 15%（§3.1）——--kfm-accent-tint 等值 token
                style: { position: 'absolute', inset: 0, background: 'var(--kfm-accent-tint)', borderRadius: 'inherit', pointerEvents: 'none' },
              })
            : null,
          row.type === 'dir'
            ? createElement('span', {
                'data-fstree-tri': expandedNow ? '1' : '0',
                style: {
                  width: '9px', height: '9px', flexShrink: 0, display: 'flex', position: 'relative', zIndex: 1,
                  transition: 'transform 180ms', transform: expandedNow ? 'rotate(90deg)' : 'rotate(0deg)',
                  color: 'var(--kfm-ink-3)',
                },
              },
              createElement('svg', { width: 9, height: 9, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 3, strokeLinecap: 'round', strokeLinejoin: 'round' },
                createElement('path', { d: 'M9 6l6 6-6 6' })),
              )
            : createElement('span', { style: { width: '9px', flexShrink: 0 } }),
          createElement('span', {
            style: {
              flex: 1, minWidth: 0, position: 'relative', zIndex: 1,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              fontSize: '11px', fontFamily: 'var(--kfm-font-sans)',
              color: row.type === 'dir' ? 'var(--kfm-ink)' : 'var(--kfm-ink-2)',
            },
          }, row.name),
          );
        };

        return createElement('div', {
          'data-kfm-fstree': '1',
          className: S.closing ? 'kfm-closing' : '',
          style: {
            position: 'fixed', top: 0, left: 0, right: 0,
            bottom: 0, // AI 系摘除后 composer 不在场，页底=视口底（2026-09-11）
            zIndex: 44,
            background: 'var(--kfm-page)', color: 'var(--kfm-ink)',
            display: 'flex', flexDirection: 'column',
            fontFamily: 'var(--kfm-font-sans)',
          },
        },
        // 顶栏：标题 + × 钮（池页顶栏词汇）
        createElement('div', {
          'data-fstree-header': '1',
          style: {
            flexShrink: 0, display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 10px', borderBottom: '1px solid var(--kfm-line)',
          },
        },
        createElement('div', {
          style: {
            flex: 1, minWidth: 0, fontSize: '13px', color: 'var(--kfm-ink)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          },
        }, '文件树'),
        createElement('button', {
          'data-fstree-close': '1', type: 'button',
          onClick: () => closePage(),
          style: {
            flexShrink: 0, width: '30px', height: '30px', borderRadius: '50%',
            border: '1px solid var(--kfm-line)', background: 'var(--kfm-bar-bg)',
            color: 'var(--kfm-ink-2)', fontSize: '14px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          },
        }, '×'),
        ),
        // 平面行虚拟列表：上下 spacer 撑总高，只渲染可视窗 slice
        createElement('div', {
          'data-kfm-fstree-list': '1',
          ref: listRef,
          onScroll,
          style: { flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain' },
        },
        createElement('div', { style: { height: `${w.start * ROW_H}px` } }),
        slice.map(rowEl),
        createElement('div', { style: { height: `${Math.max(0, rows.length - w.end) * ROW_H}px` } }),
        ),
        // 预览浮层（§3.2：点文件=预览；binary 拒显+截断标注+插入引用）
        preview
          ? createElement('div', {
              'data-fstree-preview': '1',
              style: {
                position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '46vh',
                display: 'flex', flexDirection: 'column',
                background: 'var(--kfm-surface)', borderTop: '1px solid var(--kfm-line)',
                borderRadius: '12px 12px 0 0', boxShadow: 'var(--kfm-shadow-raised)', zIndex: 5,
              },
            },
            createElement('div', {
              style: {
                flexShrink: 0, display: 'flex', alignItems: 'center', gap: '6px',
                padding: '6px 10px', borderBottom: '1px solid var(--kfm-aichat-line)',
              },
            },
            createElement('div', {
              'data-fstree-preview-path': '1',
              style: {
                flex: 1, minWidth: 0, fontSize: '11.5px', color: 'var(--kfm-ink-2)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              },
            }, preview.path),
            createElement('button', {
              'data-fstree-preview-close': '1', type: 'button',
              onClick: () => { S.preview = null; bump(); },
              style: {
                flexShrink: 0, width: '24px', height: '24px', borderRadius: '50%',
                border: '1px solid var(--kfm-line)', background: 'var(--kfm-bar-bg)',
                color: 'var(--kfm-ink-2)', fontSize: '12px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              },
            }, '×'),
            ),
            createElement('div', {
              'data-fstree-preview-body': '1',
              style: {
                flex: 1, minHeight: 0, overflow: 'auto', padding: '8px 10px',
                fontSize: '11px', lineHeight: '16px', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
                fontFamily: 'var(--kfm-font-mono)', color: 'var(--kfm-ink)',
              },
            },
            preview.loading
              ? '读取中…'
              : preview.binary
                ? '（二进制文件，文本预览不可用）'
                : (preview.text ?? preview.error ?? '（空）'),
            ),
            createElement('div', {
              style: {
                flexShrink: 0, display: 'flex', alignItems: 'center', gap: '8px',
                padding: '6px 10px', borderTop: '1px solid var(--kfm-aichat-line)',
              },
            },
            createElement('span', { style: { flex: 1, fontSize: '10px', color: 'var(--kfm-ink-3)' } },
              preview.loading ? '' : preview.binary ? '二进制文件' : preview.truncated ? '内容已截断' : ''),
            ),
            )
          : null,
        // 复制回执 toast（§七⑫）：置底居中，1.6s 自灭
        toast
          ? createElement('div', {
              'data-fstree-toast': '1',
              style: {
                position: 'absolute', left: '50%', bottom: '18px', transform: 'translateX(-50%)',
                maxWidth: '86%', background: 'var(--kfm-surface)', border: '1px solid var(--kfm-line)',
                borderRadius: '999px', padding: '6px 14px', fontSize: '11.5px', color: 'var(--kfm-ink)',
                boxShadow: 'var(--kfm-shadow-raised)', zIndex: 6,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              },
            }, toast)
          : null,
        );
      }

      const root = createRoot(slot);
      root.render(createElement(TreeApp));
      // 判卷钩子（可观测性约束，公共契约）
      (window as unknown as Record<string, unknown>).__kfmNzFsTree = () => ({
        open: S.open, closing: S.closing,
        expanded: [...expanded],
        loadedDirs: children.size,
        total: rowsFlat.current.length,
        virtual: { ...win.current },
        selected: S.preview?.path ?? null,
        lastCopy: lastCopyBridge.current,
        fetches: fetchLog.length,
        fetchLog: [...fetchLog],
        lastError,
      });
      return {
        unmount: () => {
          window.removeEventListener('kfm-nz-fstree-open', onOpenEvent);
          if (closeTimer) clearTimeout(closeTimer);
          root.unmount();
          document.documentElement.removeAttribute('data-kfm-fstree-open');
          delete (window as unknown as Record<string, unknown>).__kfmNzFsTree;
        },
      };
    },
  };
}
