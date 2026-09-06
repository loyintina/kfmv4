/**
 * pages.tsx — 四池页皮（React 组件；设计清单 §三「上配置下池」页内布局）
 *
 *   2026-09-05 用户拍板（老 kfmv4 池卡信息组织复刻，修订①）：**选择制单态**
 *   ——上区=当前选中条目详情编辑**常驻**（点下区池行=切换编辑目标，无进出
 *   编辑态），下区=池路由。BROWSE/EDITING 两态退役（§四 修订①）。
 *
 *   basic    只读聚合变体：无详情区，槽位行+「前往更换」（§3.1）
 *   provider 详情=id/name/baseUrl/apiKey 代字/models 清单行编辑（model 行级
 *            激活与 picker 二级同构，§3.2）
 *   prompt   详情=name + **双区有序文件对象**（静态/动态两区，文件芯片=文件
 *            名+内容预览，拖柄区内排序+跨区移动，点芯片开全文对话框，加文
 *            件走 /pool/files 选择器——仲裁⑧「有序」语义不变，操作方式升级，
 *            手填路径行/上下移按钮退役）（§3.3 修订②）
 *   session  详情=title 改名 + 会话列表（§3.4）
 *
 * 激活双态 UI（P2）：✓ 激活标只随激活总账走；编辑任何条目不动 ✓。
 * 草稿语义：详情区改动是本地草稿，保存才落盘（C5）；取消=rev++ 重挂回存
 * 档值（C6）；新建草稿取消=回落选中首条。删除=服务性破坏操作，仍走确认
 * 罩层（C7-C9）；草稿内移除文件引用不确认（取消即可整体撤销）。
 * 皮内零硬编码颜色/阴影/圆角/时长字面量（P8，全走 --kfm-* token）。
 */
import { createElement, useEffect, useRef, useState } from 'react';
import type { PoolLink, PoolEntry, ActiveLedger, ReliedBy } from './pool-link.js';

export interface ViewProps {
  link: PoolLink;
  pool: string;
  entries: PoolEntry[];
  active: ActiveLedger;
  formError: string | null;
  setFormError(msg: string | null): void;
  bump(): void;
}

// ========== 共享小件 ==========

function Btn(props: {
  children?: React.ReactNode;
  onClick?: (e: { stopPropagation(): void }) => void;
  primary?: boolean;
  danger?: boolean;
  [k: string]: unknown;
}): React.ReactElement {
  const { children, onClick, primary, danger, ...rest } = props;
  return createElement('button', {
    type: 'button',
    onClick: (e: React.MouseEvent) => { e.stopPropagation(); onClick?.(e); },
    style: {
      flexShrink: 0, padding: '3px 8px', fontSize: '11px', cursor: 'pointer',
      borderRadius: 'var(--kfm-radius-sm)',
      border: `1px solid ${danger ? 'var(--kfm-red)' : primary ? 'var(--kfm-accent)' : 'var(--kfm-line)'}`,
      background: 'none',
      color: danger ? 'var(--kfm-red)' : primary ? 'var(--kfm-accent-ink)' : 'var(--kfm-ink-2)',
    },
    ...rest,
  }, children);
}

function TextField(props: {
  'data-x': string; value: string; placeholder?: string; disabled?: boolean;
  onChange(v: string): void; onCommit?(): void;
}): React.ReactElement {
  const { 'data-x': dx, value, placeholder, disabled, onChange, onCommit } = props;
  return createElement('input', {
    'data-pool-field': dx,
    value,
    placeholder,
    disabled,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value),
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') onCommit?.(); },
    style: {
      width: '100%', background: 'var(--kfm-field)', color: 'var(--kfm-ink)',
      border: '1px solid var(--kfm-line)', borderRadius: 'var(--kfm-radius-sm)',
      padding: '5px 8px', fontSize: '12.5px', outline: 'none',
    },
  });
}

/** 上详情区骨架（选择制：常驻载当前编辑目标；§四 修订①）
 *  固定区间：本区占上半（flex 1 1 50%），内容长→**区内滚动**（老角色卡
 *  formSection 同款），下池区独立滚——页面永不整体滚（用户 2026-09-06 拍板）。
 *  loading=目标未定（数据在途）：藏存/取消/新建钮防误存。
 *  select=顶端下拉栏（切换配置好的子池条目——老卡 createCustomSelect 同位） */
function DetailZone(props: {
  title: string; newMode: boolean; error: string | null;
  loading?: boolean;
  select?: { value: string; options: Array<{ value: string; label: string }>; onChange(v: string): void };
  onSave(): void; onCancel(): void; onNew(): void; children?: React.ReactNode;
}): React.ReactElement {
  const { title, newMode, error, loading, select, onSave, onCancel, onNew, children } = props;
  return createElement('div', {
    'data-pool-config': '1',
    style: {
      flex: '1 1 50%', minHeight: '160px', margin: '8px 10px 0', padding: '10px',
      display: 'flex', flexDirection: 'column', gap: '8px',
      background: 'var(--kfm-surface)', border: '1px solid var(--kfm-line)', borderRadius: 'var(--kfm-radius-lg)',
      overflow: 'hidden',
    },
  },
  createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 } },
    createElement('div', { style: { fontSize: '12.5px', color: 'var(--kfm-ink-2)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, title),
    newMode || loading ? null : createElement('button', {
      'data-pool-new': '1', type: 'button', onClick: onNew,
      style: {
        flexShrink: 0, padding: '2px 10px', fontSize: '11.5px', cursor: 'pointer',
        borderRadius: 'var(--kfm-radius-sm)', border: '1px dashed var(--kfm-line-strong)',
        background: 'none', color: 'var(--kfm-ink-2)',
      },
    }, '＋ 新建'),
  ),
  select
    ? createElement('select', {
        'data-pool-select': '1',
        value: select.value,
        onChange: (e: React.ChangeEvent<HTMLSelectElement>) => select.onChange(e.target.value),
        style: {
          flexShrink: 0, width: '100%', background: 'var(--kfm-field)', color: 'var(--kfm-ink)',
          border: '1px solid var(--kfm-line)', borderRadius: 'var(--kfm-radius-sm)',
          padding: '5px 8px', fontSize: '12.5px', outline: 'none',
        },
      },
      select.options.map((o) => createElement('option', { key: o.value, value: o.value }, o.label)),
      )
    : null,
  createElement('div', {
    'data-pool-config-scroll': '1',
    style: { flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' },
  },
  loading ? createElement('div', { style: { fontSize: '11.5px', color: 'var(--kfm-ink-3)' } }, '列表加载中…') : children,
  ),
  error !== null
    ? createElement('div', { 'data-pool-form-error': '1', style: { fontSize: '11.5px', color: 'var(--kfm-red)', flexShrink: 0 } }, error)
    : null,
  loading ? null : createElement('div', { style: { display: 'flex', gap: '8px', justifyContent: 'flex-end', flexShrink: 0 } },
    createElement(Btn, { 'data-x': undefined, 'data-pool-cancel': '1', onClick: onCancel }, '取消'),
    createElement('button', {
      'data-pool-save': '1', type: 'button', onClick: (e: React.MouseEvent) => { e.stopPropagation(); onSave(); },
      style: {
        padding: '3px 14px', fontSize: '12px', cursor: 'pointer',
        borderRadius: 'var(--kfm-radius-sm)', border: '1px solid var(--kfm-ink)',
        background: 'var(--kfm-ink)', color: 'var(--kfm-page)',
      },
    }, '保存'),
  ));
}

/** 下池列表骨架 */
function PoolZone(props: { children: React.ReactNode }): React.ReactElement {
  return createElement('div', {
    'data-pool-zone': '1',
    style: { flex: 1, minHeight: 0, overflowY: 'auto', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '6px' },
  }, props.children);
}

function ListRow(props: {
  'data-x': string; active?: boolean; title: string; sub?: string;
  dangling?: boolean; onClickRow?(): void; children?: React.ReactNode;
}): React.ReactElement {
  const { 'data-x': dx, active, title, sub, dangling, onClickRow, children } = props;
  const rowId = dx.includes(':') ? dx.slice(dx.indexOf(':') + 1) : dx;
  return createElement('div', {
    'data-pool-row': dx,
    ...(active ? { 'data-pool-active': rowId } : {}),
    onClick: () => onClickRow?.(),
    style: {
      display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 9px',
      background: 'var(--kfm-surface)', border: `1px solid ${active ? 'var(--kfm-accent)' : 'var(--kfm-line)'}`,
      borderRadius: 'var(--kfm-radius-md)', cursor: 'pointer',
    },
  },
  active ? createElement(CheckMark, null) : null,
  createElement('div', { style: { flex: 1, minWidth: 0 } },
    createElement('div', {
      style: { fontSize: '12.5px', color: 'var(--kfm-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
    }, title),
    sub
      ? createElement('div', { style: { fontSize: '10.5px', color: 'var(--kfm-ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, sub)
      : null,
  ),
  dangling ? createElement('span', {
    'data-pool-dangling': '1',
    style: {
      fontSize: '10px', color: 'var(--kfm-orange)', border: '1px solid var(--kfm-orange)',
      borderRadius: 'var(--kfm-radius-sm)', padding: '0 4px', flexShrink: 0,
    },
  }, '已失效') : null,
  children,
  );
}

function CheckMark(): React.ReactElement {
  return createElement('span', {
    'data-pool-check': '1',
    style: { color: 'var(--kfm-accent-ink)', fontSize: '13px', flexShrink: 0 },
  }, '✓');
}

// ========== prompt 双区文件对象（§3.3 修订②） ==========

/** 文件内容缓存（预览与全文共用；模块级——池页重挂不重拉） */
const fileContentCache = new Map<string, string>();

async function fetchFileContent(path: string): Promise<string | null> {
  if (fileContentCache.has(path)) return fileContentCache.get(path) ?? null;
  try {
    const r = await fetch(`/pool/files/content?path=${encodeURIComponent(path)}`);
    if (!r.ok) return null;
    const body = (await r.json()) as { content?: string };
    const content = typeof body.content === 'string' ? body.content : null;
    if (content !== null) fileContentCache.set(path, content);
    return content;
  } catch { return null; }
}

const previewOf = (content: string): string =>
  content.split('\n').slice(0, 2).map((l) => (l.length > 60 ? l.slice(0, 60) + '…' : l)).join('\n');

type ZoneId = 'static' | 'dyn';

/** 文件芯片：拖柄 + 文件名 + 内容预览两行（点芯片开全文对话框） */
function FileChip(props: {
  path: string; zone: ZoneId; index: number; preview: string | null;
  dragging: boolean; dy: number;
  onHandleDown(e: React.PointerEvent): void;
  onOpen(): void;
}): React.ReactElement {
  const { path, preview, dragging, dy, onHandleDown, onOpen } = props;
  return createElement('div', {
    'data-pool-file-chip': path,
    'data-pool-file-zone': props.zone,
    onClick: onOpen,
    style: {
      display: 'flex', alignItems: 'stretch', minHeight: '52px',
      border: '1px solid var(--kfm-line)', borderRadius: 'var(--kfm-radius-md)',
      background: 'var(--kfm-surface)', overflow: 'hidden', cursor: 'pointer',
      touchAction: 'none',
      ...(dragging ? {
        transform: `translateY(${dy}px) scale(1.02)`,
        borderColor: 'var(--kfm-accent)',
        boxShadow: 'var(--kfm-shadow-pop)',
        position: 'relative' as const, zIndex: 5,
      } : {}),
    },
  },
  // 拖柄（24px；pointer capture 自拖拽——老角色卡同款交互）
  createElement('div', {
    'data-pool-file-handle': path,
    onPointerDown: onHandleDown,
    title: '拖动排序/跨区移动',
    style: {
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      width: '26px', flexShrink: 0, cursor: 'grab', userSelect: 'none',
      color: 'var(--kfm-ink-3)', borderRight: '1px solid var(--kfm-line)',
      touchAction: 'none',
    },
  }, '≡'),
  createElement('div', { style: { flex: 1, minWidth: 0, padding: '5px 8px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '1px' } },
    createElement('div', {
      style: { fontSize: '12px', color: 'var(--kfm-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--kfm-font-mono, monospace)' },
    }, path),
    createElement('div', {
      style: {
        fontSize: '10px', color: 'var(--kfm-ink-3)', whiteSpace: 'pre-wrap', overflow: 'hidden',
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as never,
      },
    }, preview ?? '…'),
  ),
  );
}

/** 双区有序文件对象（静态/动态；拖柄排序+跨区移动——仲裁⑧有序语义不变） */
function DualZoneFiles(props: {
  files: string[]; dynFiles: string[];
  onChangeFiles(files: string[]): void;
  onChangeDynFiles(files: string[]): void;
  onOpenDialog(path: string, zone: ZoneId): void;
  onPick(zone: ZoneId): void;
}): React.ReactElement {
  const { files, dynFiles, onChangeFiles, onChangeDynFiles, onOpenDialog, onPick } = props;
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [drag, setDrag] = useState<{ zone: ZoneId; idx: number; dy: number } | null>(null);
  const [overZone, setOverZone] = useState<ZoneId | null>(null);
  const dragRef = useRef<{ zone: ZoneId; idx: number; startY: number; active: boolean } | null>(null);
  const staticRef = useRef<HTMLDivElement | null>(null);
  const dynRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef({ files, dynFiles });
  stateRef.current = { files, dynFiles };

  // 预览腿：路径集变化时补拉缺的（两行预览）
  useEffect(() => {
    const all = Array.from(new Set([...files, ...dynFiles]));
    for (const p of all) {
      if (previews[p] !== undefined) continue;
      const cached = fileContentCache.get(p);
      if (cached !== undefined) { setPreviews((s) => ({ ...s, [p]: previewOf(cached) })); continue; }
      void fetchFileContent(p).then((c) => {
        setPreviews((s) => ({ ...s, [p]: c === null ? '（读不到）' : previewOf(c) }));
      });
    }
  }, [files, dynFiles]);

  const arrOf = (zone: ZoneId): string[] => (zone === 'static' ? stateRef.current.files : stateRef.current.dynFiles);
  const commit = (zone: ZoneId, next: string[]): void => { (zone === 'static' ? onChangeFiles : onChangeDynFiles)(next); };
  const otherOf = (zone: ZoneId): ZoneId => (zone === 'static' ? 'dyn' : 'static');

  const zoneRect = (zone: ZoneId): DOMRect | null => {
    const el = zone === 'static' ? staticRef.current : dynRef.current;
    return el ? el.getBoundingClientRect() : null;
  };

  const onHandleDown = (zone: ZoneId, idx: number) => (e: React.PointerEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { zone, idx, startY: e.clientY, active: false };
  };
  const onHandleMove = (e: React.PointerEvent): void => {
    const d = dragRef.current;
    if (!d) return;
    const dy = e.clientY - d.startY;
    if (!d.active && Math.abs(dy) > 6) d.active = true;
    if (!d.active) return;
    setDrag({ zone: d.zone, idx: d.idx, dy });
    const other = otherOf(d.zone);
    const rect = zoneRect(other);
    setOverZone(rect && e.clientY >= rect.top && e.clientY <= rect.bottom ? other : null);
  };
  const onHandleUp = (e: React.PointerEvent): void => {
    const d = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    setOverZone(null);
    if (!d || !d.active) return;
    const dy = e.clientY - d.startY;
    const other = otherOf(d.zone);
    const rect = zoneRect(other);
    const cross = !!(rect && e.clientY >= rect.top && e.clientY <= rect.bottom);
    const arr = arrOf(d.zone);
    if (cross) {
      // 跨区移动：源区摘除 → 目标区尾部追加（老角色卡同语义）
      const moved = arr[d.idx];
      commit(d.zone, arr.filter((_, k) => k !== d.idx));
      commit(other, [...arrOf(other), moved]);
      return;
    }
    // 区内排序：位移按芯片实高折算目标序（老卡 offsetHeight+gap 同款）
    const zoneEl = d.zone === 'static' ? staticRef.current : dynRef.current;
    const chipEl = zoneEl?.querySelector('[data-pool-file-chip]') as HTMLElement | null;
    const cardH = (chipEl?.offsetHeight ?? 52) + 6;
    const targetIdx = Math.max(0, Math.min(arr.length - 1, Math.round((d.idx * cardH + dy) / cardH)));
    if (targetIdx !== d.idx) {
      const next = [...arr];
      const [moved] = next.splice(d.idx, 1);
      next.splice(targetIdx, 0, moved);
      commit(d.zone, next);
    }
  };

  const zone = (id: ZoneId, label: string, hint: string, rows: string[], ref: React.RefObject<HTMLDivElement | null>) =>
    createElement('div', { key: id, style: { display: 'flex', flexDirection: 'column', gap: '4px' } },
      createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '6px' } },
        createElement('div', { style: { fontSize: '11px', color: 'var(--kfm-ink-3)', flex: 1 } }, label),
        createElement(Btn, { 'data-pool-file-add': id, onClick: () => onPick(id) }, '＋加文件'),
      ),
      createElement('div', {
        ref,
        'data-pool-filezone': id,
        style: {
          display: 'flex', flexDirection: 'column', gap: '6px', minHeight: '20px', borderRadius: 'var(--kfm-radius-md)',
          transition: 'outline 0.15s', padding: '2px',
          outline: overZone === id ? '2px dashed var(--kfm-accent)' : '2px dashed transparent',
        },
      },
      rows.length === 0
        ? createElement('div', { style: { fontSize: '10.5px', color: 'var(--kfm-ink-3)', padding: '4px 2px' } }, '（空）')
        : null,
      rows.map((p, i) => createElement(FileChip, {
        key: `${p}:${i}`, path: p, zone: id, index: i,
        preview: previews[p] ?? null,
        dragging: drag?.zone === id && drag.idx === i,
        dy: drag?.zone === id && drag.idx === i ? drag.dy : 0,
        onHandleDown: onHandleDown(id, i),
        onOpen: () => onOpenDialog(p, id),
      })),
      ),
      createElement('div', { style: { fontSize: '10px', color: 'var(--kfm-ink-3)' } }, hint),
    );

  return createElement('div', { onPointerMove: onHandleMove, onPointerUp: onHandleUp, onPointerCancel: onHandleUp, style: { display: 'flex', flexDirection: 'column', gap: '10px' } },
    zone('static', '静态提示词（有序，拼接按此序）', '拖 ≡ 排序；拖入另一区=跨区移动；点芯片看全文', files, staticRef),
    zone('dyn', '动态反馈（每轮工具调用后刷新，A2b 眼睛挂载点）', '同上；顺序即注入顺序', dynFiles, dynRef),
  );
}

/** 文件全文对话框（只读 + 移除引用；移除的是草稿——取消可整体撤销，不确认） */
function FileDetailDialog(props: {
  path: string; zone: ZoneId;
  onRemove(): void; onClose(): void;
}): React.ReactElement {
  const { path, onRemove, onClose } = props;
  const [content, setContent] = useState<string | null>(fileContentCache.get(path) ?? null);
  const [truncated, setTruncated] = useState(false);
  useEffect(() => {
    let alive = true;
    void fetch(`/pool/files/content?path=${encodeURIComponent(path)}`)
      .then((r) => r.json())
      .then((b: { content?: string; truncated?: boolean }) => {
        if (!alive) return;
        if (typeof b.content === 'string') { fileContentCache.set(path, b.content); setContent(b.content); }
        setTruncated(!!b.truncated);
      })
      .catch(() => { if (alive) setContent(null); });
    return () => { alive = false; };
  }, [path]);
  return createElement('div', {
    'data-pool-file-dialog': '1',
    onClick: onClose,
    style: {
      position: 'absolute', inset: 0, zIndex: 12,
      background: 'var(--kfm-overlay-bg)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '48px',
    },
  }, createElement('div', {
    onClick: (e: React.MouseEvent) => e.stopPropagation(),
    style: {
      width: 'min(92vw, 560px)', maxHeight: '70vh', minHeight: '40vh', display: 'flex', flexDirection: 'column',
      background: 'var(--kfm-bar-bg)', border: '1px solid var(--kfm-line)', borderRadius: 'var(--kfm-radius-lg)', overflow: 'hidden',
    },
  },
  createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderBottom: '1px solid var(--kfm-line)', flexShrink: 0 } },
    createElement('div', { style: { flex: 1, minWidth: 0, fontSize: '12.5px', color: 'var(--kfm-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--kfm-font-mono, monospace)' } }, path),
    createElement(Btn, { 'data-pool-file-dialog-close': '1', onClick: onClose }, '×'),
  ),
  createElement('textarea', {
    'data-pool-file-content': '1',
    readOnly: true,
    value: content ?? '加载中…',
    style: {
      flex: 1, minHeight: 0, border: 'none', padding: '10px 12px', fontSize: '11.5px', lineHeight: 1.6,
      color: 'var(--kfm-ink)', background: 'transparent', resize: 'none', outline: 'none',
      fontFamily: 'var(--kfm-font-mono, monospace)', whiteSpace: 'pre', overflow: 'auto',
    },
  }),
  createElement('div', { style: { display: 'flex', gap: '10px', justifyContent: 'space-between', padding: '10px 12px', borderTop: '1px solid var(--kfm-line)', flexShrink: 0, alignItems: 'center' } },
    createElement('span', { style: { fontSize: '10px', color: 'var(--kfm-ink-3)' } },
      truncated ? '超 64KB 截断展示' : `（${props.zone === 'static' ? '静态区' : '动态区'}引用；移除只改草稿，保存落盘）`),
    createElement(Btn, { danger: true, 'data-pool-file-remove': '1', onClick: onRemove }, '移除引用'),
  )));
}

/** 文件选择器（/pool/files 平铺宇宙；已在任一区的置灰不可重选） */
function FilePickerOverlay(props: {
  existing: Set<string>;
  onPick(path: string): void; onClose(): void;
}): React.ReactElement {
  const { existing, onPick, onClose } = props;
  const [files, setFiles] = useState<string[] | null>(null);
  useEffect(() => {
    let alive = true;
    void fetch('/pool/files').then((r) => r.json()).then((b: { files?: string[] }) => {
      if (alive && Array.isArray(b.files)) setFiles(b.files.map(String));
    }).catch(() => { if (alive) setFiles([]); });
    return () => { alive = false; };
  }, []);
  return createElement('div', {
    'data-pool-file-picker': '1',
    onClick: onClose,
    style: {
      position: 'absolute', inset: 0, zIndex: 12,
      background: 'var(--kfm-overlay-bg)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '48px',
    },
  }, createElement('div', {
    onClick: (e: React.MouseEvent) => e.stopPropagation(),
    style: {
      width: 'min(92vw, 560px)', maxHeight: '70vh', display: 'flex', flexDirection: 'column',
      background: 'var(--kfm-bar-bg)', border: '1px solid var(--kfm-line)', borderRadius: 'var(--kfm-radius-lg)', overflow: 'hidden',
    },
  },
  createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderBottom: '1px solid var(--kfm-line)', flexShrink: 0 } },
    createElement('div', { style: { flex: 1, fontSize: '12.5px', color: 'var(--kfm-ink)' } }, '选择提示词文件（roles 目录平铺）'),
    createElement(Btn, { 'data-pool-file-picker-close': '1', onClick: onClose }, '×'),
  ),
  createElement('div', { style: { flex: 1, minHeight: 0, overflowY: 'auto', padding: '6px' } },
    files === null
      ? createElement('div', { style: { fontSize: '11.5px', color: 'var(--kfm-ink-3)', padding: '8px' } }, '加载中…')
      : files.length === 0
        ? createElement('div', { style: { fontSize: '11.5px', color: 'var(--kfm-ink-3)', padding: '8px' } }, 'roles 目录还没有文件——把 .md 放进 ~/.kfmv4/agents/ 再来')
        : files.map((p) => {
            const taken = existing.has(p);
            return createElement('div', {
              key: p,
              'data-pool-file-pick': p,
              onClick: taken ? undefined : () => onPick(p),
              style: {
                padding: '7px 9px', fontSize: '12px', cursor: taken ? 'default' : 'pointer',
                color: taken ? 'var(--kfm-ink-3)' : 'var(--kfm-ink)',
                opacity: taken ? 0.55 : 1,
                borderBottom: '1px solid var(--kfm-line)',
                fontFamily: 'var(--kfm-font-mono, monospace)',
                display: 'flex', justifyContent: 'space-between', gap: '8px',
              },
            },
            createElement('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, p),
            taken ? createElement('span', { style: { flexShrink: 0 } }, '已加') : null,
            );
          }),
  )));
}

// ========== 基本池（§3.1 只读聚合变体） ==========

function BasicView(props: ViewProps): React.ReactElement {
  const { link, entries, bump } = props;
  const slotValue = (e: PoolEntry): string => {
    if (e.id === 'provider') return `${e.providerId || '（空）'} · ${e.modelId || '（空）'}`;
    if (e.id === 'role') return String(e.roleFile || '（空）');
    return String(e.sessionId || '（空）');
  };
  const gotoPool: Record<string, string> = { provider: 'provider', role: 'prompt', session: 'session' };
  return createElement('div', { style: { display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 } },
    createElement('div', {
      style: { flexShrink: 0, margin: '8px 10px 0', fontSize: '11px', color: 'var(--kfm-ink-3)' },
    }, '激活总账（只读聚合）——各池激活项的切换入口；条目编辑去对应池页'),
    PoolZone({
      children: entries.map((e) => createElement('div', {
        key: String(e.id), 'data-pool-slot': String(e.id),
        style: {
          display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 10px',
          background: 'var(--kfm-surface)', border: '1px solid var(--kfm-line)',
          borderRadius: 'var(--kfm-radius-md)',
        },
      },
      createElement('div', { style: { flex: 1, minWidth: 0 } },
        createElement('div', { style: { fontSize: '12px', color: 'var(--kfm-ink-2)' } }, String(e.title)),
        createElement('div', {
          style: { fontSize: '12.5px', color: 'var(--kfm-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
        }, slotValue(e)),
      ),
      e.dangling ? createElement('span', {
        'data-pool-dangling': '1',
        style: {
          fontSize: '10px', color: 'var(--kfm-orange)', border: '1px solid var(--kfm-orange)',
          borderRadius: 'var(--kfm-radius-sm)', padding: '0 4px', flexShrink: 0,
        },
      }, '已失效') : null,
      createElement(Btn, {
        primary: true,
        'data-x': undefined,
        onClick: () => {
          const target = gotoPool[String(e.id)];
          if (target) { link.core.switchPool(target); bump(); } // 前往更换=C3 转换形状
        },
      }, '前往更换'),
      )),
    }),
  );
}

// ========== provider-model 池（§3.2；选择制详情常驻） ==========

function ProviderView(props: ViewProps): React.ReactElement {
  const { link, entries, active, formError, setFormError, bump } = props;
  const editing = link.core.state.editing;
  const rev = link.core.state.rev;
  const current = editing && !editing.isNew ? entries.find((e) => e.id === editing.id) ?? null : null;
  const provAlive = entries.find((e) => e.id === active.providerId || e.name === active.providerId) ?? null;

  const save = async (entry: PoolEntry, isNew: boolean): Promise<void> => {
    const r = await link.save('provider', entry, isNew); // C5：成功=编辑器保持载入该条目；败=人话回表单
    if (!r.ok) setFormError(r.error ?? '保存失败');
    else { setFormError(null); if (isNew) link.core.saveDone(String(entry.id)); }
    bump();
  };
  const activateModel = (provId: string, model: string): void => {
    void link.activate({ providerId: provId, modelId: model }).then(() => bump());
  };

  return createElement('div', { style: { display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 } },
    createElement(ProviderDetail, {
      key: `provider:${editing?.id ?? '__new__'}:${rev}:${editing?.isNew ? 'n' : 's'}`,
      entry: current, isNew: !!editing?.isNew, error: formError, loading: !editing,
      select: {
        value: !editing || editing.isNew ? '__new__' : String(editing.id),
        options: [{ value: '__new__', label: '＋ 新建…' }, ...entries.map((e) => ({ value: String(e.id), label: String(e.name ?? e.id) }))],
        onChange: (v: string) => {
          if (v === '__new__') link.core.selectDetail({ id: null, isNew: true });
          else link.core.selectDetail({ id: v, isNew: false });
          setFormError(null); bump();
        },
      },
      activeModel: provAlive?.id === current?.id || (!editing?.isNew && editing?.id && provAlive?.id === editing.id) ? active.modelId : null,
      onSave: save,
      onCancel: () => {
        link.core.cancelEdit();
        if (editing?.isNew && entries.length > 0) link.core.selectDetail({ id: String(entries[0].id), isNew: false }); // 新建草稿取消=回落首条
        setFormError(null); bump();
      },
      onNew: () => { link.core.selectDetail({ id: null, isNew: true }); setFormError(null); bump(); },
      onActivateModel: activateModel,
    }),
    PoolZone({
      children: entries.map((e) => {
        const models = Array.isArray(e.models) ? (e.models as string[]).map(String) : [];
        const isActive = provAlive?.id === e.id;
        const isSelected = !!editing && !editing.isNew && editing.id === String(e.id);
        return createElement(ListRow, {
          key: String(e.id),
          'data-x': `provider:${e.id}`,
          active: isActive,
          title: String(e.name ?? e.id),
          sub: `${e.id} · ${models.length} models`,
          onClickRow: () => { link.core.selectDetail({ id: String(e.id), isNew: false }); setFormError(null); bump(); },
        },
        isSelected ? createElement('span', { 'data-pool-selected': '1', style: { fontSize: '10px', color: 'var(--kfm-accent-ink)', border: '1px solid var(--kfm-accent)', borderRadius: 'var(--kfm-radius-sm)', padding: '0 4px', flexShrink: 0 } }, '编辑中') : null,
        createElement(Btn, {
          primary: !isActive,
          'data-pool-activate': String(e.id),
          onClick: () => { void link.activate({ providerId: String(e.id), modelId: models[0] ?? '' }).then(() => bump()); },
        }, '设为激活'),
        createElement(Btn, {
          danger: true,
          'data-pool-delete': String(e.id),
          onClick: () => { link.core.askDelete(String(e.id)); bump(); },
        }, '删除'),
        );
      }),
    }),
  );
}

const ProviderDetail = (props: {
  entry: PoolEntry | null; isNew: boolean; error: string | null; loading?: boolean;
  select?: { value: string; options: Array<{ value: string; label: string }>; onChange(v: string): void };
  activeModel?: string | null;
  onSave(entry: PoolEntry, isNew: boolean): Promise<void>;
  onActivateModel(provId: string, model: string): void;
  onCancel(): void; onNew(): void;
}): React.ReactElement => {
  const { entry, isNew, error, loading, select, activeModel, onSave, onActivateModel, onCancel, onNew } = props;
  const [id, setId] = useState(entry ? String(entry.id) : '');
  const [name, setName] = useState(entry ? String(entry.name ?? '') : '');
  const [baseUrl, setBaseUrl] = useState(entry ? String(entry.baseUrl ?? '') : '');
  const [apiKey, setApiKey] = useState('');
  const [models, setModels] = useState<string[]>(entry && Array.isArray(entry.models) ? (entry.models as string[]).map(String) : []);
  const [modelDraft, setModelDraft] = useState('');
  const savedModels = entry && Array.isArray(entry.models) ? (entry.models as string[]).map(String) : [];
  const addModel = (): void => {
    const m = modelDraft.trim();
    if (m && !models.includes(m)) setModels([...models, m]);
    setModelDraft('');
  };
  return createElement(DetailZone, {
    title: isNew ? '新建 Provider' : `详情：${entry?.id ?? ''}`,
    newMode: isNew, error, loading, select,
    onSave: () => { void onSave({ id, name, baseUrl, apiKey, models }, isNew); },
    onCancel, onNew,
    children: [
      createElement('div', { key: 'row1', style: { display: 'flex', gap: '6px' } },
        createElement('div', { style: { width: '32%' } },
          createElement(TextField, { 'data-x': 'id', value: id, disabled: !isNew, placeholder: 'id', onChange: setId })),
        createElement('div', { style: { flex: 1 } },
          createElement(TextField, { 'data-x': 'name', value: name, placeholder: '名称', onChange: setName })),
      ),
      createElement(TextField, { 'data-x': 'baseUrl', value: baseUrl, placeholder: 'Base URL', onChange: setBaseUrl }),
      createElement('div', null,
        createElement(TextField, {
          'data-x': 'apiKey', value: apiKey,
          placeholder: entry?.apiKey
            ? `已存代字 ${String(entry.apiKey)}（留空=未改）`
            : isNew ? 'API Key（明文保存即转代字）' : '留空=未改',
          onChange: setApiKey,
        }),
        createElement('div', { 'data-pool-keyhint': '1', style: { fontSize: '10.5px', color: 'var(--kfm-ink-3)', marginTop: '2px' } },
          entry?.apiKey
            ? `已存代字 ${String(entry.apiKey)} · 留空=未改`
            : '密钥明文只在保存瞬间落 .env（chmod 600），池文件只留 ${VAR} 代字'),
      ),
      createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px' } },
        createElement('div', { style: { fontSize: '11px', color: 'var(--kfm-ink-3)' } }, 'models（点标签=激活该模型；×=移除）'),
        createElement('div', { 'data-pool-model-tags': '1', style: { display: 'flex', flexWrap: 'wrap', gap: '4px' } },
          models.map((m) => {
            const activatable = !isNew && savedModels.includes(m) && !!entry;
            const isActive = activeModel === m;
            return createElement('span', {
              key: m, 'data-pool-model-tag': m,
              ...(isActive ? { 'data-pool-model-active': m } : {}),
              onClick: activatable ? () => onActivateModel(String(entry!.id), m) : undefined,
              style: {
                display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '2px 7px',
                borderRadius: 'var(--kfm-radius-sm)', fontSize: '11px', cursor: activatable ? 'pointer' : 'default',
                background: 'var(--kfm-chip-bg)', color: 'var(--kfm-ink)',
                border: `1px solid ${isActive ? 'var(--kfm-accent)' : 'var(--kfm-line)'}`,
              },
            },
            m,
            createElement('span', {
              onClick: (e: React.MouseEvent) => { e.stopPropagation(); setModels(models.filter((x) => x !== m)); },
              style: { cursor: 'pointer', opacity: 0.5, fontSize: '11px', padding: '0 1px' },
            }, '×'),
            );
          }),
        ),
        createElement('div', { style: { display: 'flex', gap: '4px' } },
          createElement('div', { style: { flex: 1 } },
            createElement(TextField, { 'data-x': 'model-add', value: modelDraft, placeholder: '新增 model 名', onChange: setModelDraft, onCommit: addModel })),
          createElement('button', {
            'data-pool-model-add-btn': '1', type: 'button', onClick: addModel,
            style: {
              padding: '3px 10px', fontSize: '11.5px', cursor: 'pointer',
              borderRadius: 'var(--kfm-radius-sm)', border: '1px solid var(--kfm-line)',
              background: 'none', color: 'var(--kfm-ink-2)',
            },
          }, '加 model'),
        ),
      ),
    ],
  });
};

// ========== agent-prompt 池（§3.3 修订②：双区文件对象） ==========

function PromptView(props: ViewProps): React.ReactElement {
  const { link, entries, active, formError, setFormError, bump } = props;
  const editing = link.core.state.editing;
  const rev = link.core.state.rev;
  const current = editing && !editing.isNew ? entries.find((e) => e.id === editing.id) ?? null : null;
  const save = async (entry: PoolEntry, isNew: boolean): Promise<void> => {
    const r = await link.save('prompt', entry, isNew);
    if (!r.ok) setFormError(r.error ?? '保存失败');
    else { setFormError(null); if (isNew) link.core.saveDone(String(entry.id)); }
    bump();
  };
  // 对话框/选择器态（草稿层之上的覆盖物；draftRef=详情草稿的取改口，移除引用走它）
  const [dialog, setDialog] = useState<{ path: string; zone: ZoneId } | null>(null);
  const [picker, setPicker] = useState<ZoneId | null>(null);
  const [draftApi, setDraftApi] = useState<{
    get(): { files: string[]; dynFiles: string[] };
    set(files: string[], dynFiles: string[]): void;
  } | null>(null);
  return createElement('div', { style: { display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 } },
    createElement(PromptDetail, {
      key: `prompt:${editing?.id ?? '__new__'}:${rev}:${editing?.isNew ? 'n' : 's'}`,
      entry: current, isNew: !!editing?.isNew, error: formError, loading: !editing,
      select: {
        value: !editing || editing.isNew ? '__new__' : String(editing.id),
        options: [{ value: '__new__', label: '＋ 新建…' }, ...entries.map((e) => ({ value: String(e.id), label: String(e.name ?? e.id) }))],
        onChange: (v: string) => {
          if (v === '__new__') link.core.selectDetail({ id: null, isNew: true });
          else link.core.selectDetail({ id: v, isNew: false });
          setFormError(null); bump();
        },
      },
      onSave: save,
      onCancel: () => {
        link.core.cancelEdit();
        if (editing?.isNew && entries.length > 0) link.core.selectDetail({ id: String(entries[0].id), isNew: false });
        setFormError(null); bump();
      },
      onNew: () => { link.core.selectDetail({ id: null, isNew: true }); setFormError(null); bump(); },
      onDraftRef: setDraftApi,
      onOpenDialog: (path, zone) => setDialog({ path, zone }),
      onPick: (zone) => setPicker(zone),
    }),
    createElement('div', {
      style: { flexShrink: 0, margin: '6px 10px 0', fontSize: '10.5px', color: 'var(--kfm-ink-3)' },
    }, '激活角色 A2b 装配线起生效（v0 被记住）'),
    PoolZone({
      children: entries.map((e) => {
        const fileCount = (e.promptFiles as string[] | undefined)?.length ?? 0;
        const dynCount = (e.dynamicPromptFiles as string[] | undefined)?.length ?? 0;
        const isSelected = !!editing && !editing.isNew && editing.id === String(e.id);
        return createElement(ListRow, {
          key: String(e.id),
          'data-x': `prompt:${e.id}`,
          active: active.roleFile === e.id,
          title: String(e.name ?? e.id),
          sub: `${e.id} · 静态${fileCount}+动态${dynCount}`,
          onClickRow: () => { link.core.selectDetail({ id: String(e.id), isNew: false }); setFormError(null); bump(); },
        },
        isSelected ? createElement('span', { 'data-pool-selected': '1', style: { fontSize: '10px', color: 'var(--kfm-accent-ink)', border: '1px solid var(--kfm-accent)', borderRadius: 'var(--kfm-radius-sm)', padding: '0 4px', flexShrink: 0 } }, '编辑中') : null,
        createElement(Btn, {
          primary: active.roleFile !== e.id,
          'data-pool-activate': String(e.id),
          onClick: () => { void link.activate({ roleFile: String(e.id) }).then(() => bump()); },
        }, '设为激活'),
        createElement(Btn, {
          danger: true,
          'data-pool-delete': String(e.id),
          onClick: () => { link.core.askDelete(String(e.id)); bump(); },
        }, '删除'),
        );
      }),
    }),
    dialog
      ? createElement(FileDetailDialog, {
          path: dialog.path, zone: dialog.zone,
          onRemove: () => {
            // 草稿层移除引用（不确认：取消即整体撤销）
            const d = draftApi?.get();
            if (d) {
              if (dialog.zone === 'static') { if (d.files.includes(dialog.path)) draftApi.set(d.files.filter((x) => x !== dialog.path), d.dynFiles); }
              else { if (d.dynFiles.includes(dialog.path)) draftApi.set(d.files, d.dynFiles.filter((x) => x !== dialog.path)); }
            }
            setDialog(null); bump();
          },
          onClose: () => setDialog(null),
        })
      : null,
    picker
      ? createElement(FilePickerOverlay, {
          // 已加判定读草稿态（未保存的新加也算占坑，防重复添加）
          existing: (() => {
            const d = draftApi?.get();
            const f = d ? d.files : (current?.promptFiles as string[] | undefined ?? []);
            const g = d ? d.dynFiles : (current?.dynamicPromptFiles as string[] | undefined ?? []);
            return new Set([...f, ...g]);
          })(),
          onPick: (p) => {
            const d = draftApi?.get();
            if (d) {
              if (picker === 'static') draftApi.set([...d.files, p], d.dynFiles);
              else draftApi.set(d.files, [...d.dynFiles, p]);
            }
            setPicker(null); bump();
          },
          onClose: () => setPicker(null),
        })
      : null,
  );
}

const PromptDetail = (props: {
  entry: PoolEntry | null; isNew: boolean; error: string | null; loading?: boolean;
  select?: { value: string; options: Array<{ value: string; label: string }>; onChange(v: string): void };
  onSave(entry: PoolEntry, isNew: boolean): Promise<void>;
  onCancel(): void; onNew(): void;
  onDraftRef(api: { get(): { files: string[]; dynFiles: string[] }; set(files: string[], dynFiles: string[]): void } | null): void;
  onOpenDialog(path: string, zone: ZoneId): void;
  onPick(zone: ZoneId): void;
}): React.ReactElement => {
  const { entry, isNew, error, loading, select, onSave, onCancel, onNew, onDraftRef, onOpenDialog, onPick } = props;
  const [id, setId] = useState(entry ? String(entry.id) : '');
  const [name, setName] = useState(entry ? String(entry.name ?? '') : '');
  const [files, setFiles] = useState<string[]>(entry && Array.isArray(entry.promptFiles) ? (entry.promptFiles as string[]).map(String) : []);
  const [dynFiles, setDynFiles] = useState<string[]>(entry && Array.isArray(entry.dynamicPromptFiles) ? (entry.dynamicPromptFiles as string[]).map(String) : []);
  const filesRef = useRef(files);
  const dynRef2 = useRef(dynFiles);
  filesRef.current = files; dynRef2.current = dynFiles;
  useEffect(() => {
    onDraftRef({
      get: () => ({ files: filesRef.current, dynFiles: dynRef2.current }),
      set: (f, d) => { setFiles([...f]); setDynFiles([...d]); },
    });
    return () => onDraftRef(null);
  }, [onDraftRef]);
  return createElement(DetailZone, {
    title: isNew ? '新建角色（id=文件名裸名，可中文）' : `详情：${entry?.id ?? ''}`,
    newMode: isNew, error, loading, select,
    onSave: () => { void onSave({ id, name, promptFiles: files, dynamicPromptFiles: dynFiles }, isNew); },
    onCancel, onNew,
    children: [
      createElement('div', { key: 'row1', style: { display: 'flex', gap: '6px' } },
        createElement('div', { style: { width: '40%' } },
          createElement(TextField, { 'data-x': 'id', value: id, disabled: !isNew, placeholder: 'id（文件名裸名）', onChange: setId })),
        createElement('div', { style: { flex: 1 } },
          createElement(TextField, { 'data-x': 'name', value: name, placeholder: '角色名', onChange: setName })),
      ),
      createElement(DualZoneFiles, {
        files, dynFiles,
        onChangeFiles: setFiles, onChangeDynFiles: setDynFiles,
        onOpenDialog, onPick,
      }),
    ],
  });
};

// ========== session 池（§3.4 v0 壳；选择制详情常驻） ==========

function SessionView(props: ViewProps): React.ReactElement {
  const { link, entries, active, formError, setFormError, bump } = props;
  const editing = link.core.state.editing;
  const rev = link.core.state.rev;
  const current = editing && !editing.isNew ? entries.find((e) => e.id === editing.id) ?? null : null;
  const save = async (entry: PoolEntry, isNew: boolean): Promise<void> => {
    const r = await link.save('session', entry, isNew);
    if (!r.ok) setFormError(r.error ?? '保存失败');
    else { setFormError(null); if (isNew) link.core.saveDone(String(entry.id)); }
    bump();
  };
  return createElement('div', { style: { display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 } },
    createElement(SessionDetail, {
      key: `session:${editing?.id ?? '__new__'}:${rev}:${editing?.isNew ? 'n' : 's'}`,
      entry: current, isNew: !!editing?.isNew, error: formError, loading: !editing,
      select: {
        value: !editing || editing.isNew ? '__new__' : String(editing.id),
        options: [{ value: '__new__', label: '＋ 新建…' }, ...entries.map((e) => ({ value: String(e.id), label: String(e.title ?? e.id) }))],
        onChange: (v: string) => {
          if (v === '__new__') link.core.selectDetail({ id: null, isNew: true });
          else link.core.selectDetail({ id: v, isNew: false });
          setFormError(null); bump();
        },
      },
      onSave: save,
      onCancel: () => {
        link.core.cancelEdit();
        if (editing?.isNew && entries.length > 0) link.core.selectDetail({ id: String(entries[0].id), isNew: false });
        setFormError(null); bump();
      },
      onNew: () => { link.core.selectDetail({ id: null, isNew: true }); setFormError(null); bump(); },
    }),
    createElement('div', {
      style: { flexShrink: 0, margin: '6px 10px 0', fontSize: '10.5px', color: 'var(--kfm-ink-3)' },
    }, 'v0=壳管理：messages 恒空（消息落盘 A3/session-store lineage，仲裁①）'),
    PoolZone({
      children: entries.map((e) => {
        const dangling = Array.isArray(e.dangling) && (e.dangling as string[]).length > 0;
        const isSelected = !!editing && !editing.isNew && editing.id === String(e.id);
        return createElement(ListRow, {
          key: String(e.id),
          'data-x': `session:${e.id}`,
          active: active.sessionId === e.id,
          title: String(e.title ?? e.id),
          sub: `${e.id}${e.updatedAt ? ` · ${String(e.updatedAt).slice(0, 19).replace('T', ' ')}` : ''}`,
          dangling,
          onClickRow: () => { link.core.selectDetail({ id: String(e.id), isNew: false }); setFormError(null); bump(); },
        },
        isSelected ? createElement('span', { 'data-pool-selected': '1', style: { fontSize: '10px', color: 'var(--kfm-accent-ink)', border: '1px solid var(--kfm-accent)', borderRadius: 'var(--kfm-radius-sm)', padding: '0 4px', flexShrink: 0 } }, '编辑中') : null,
        createElement(Btn, {
          primary: active.sessionId !== e.id,
          'data-pool-activate': String(e.id),
          onClick: () => { void link.activate({ sessionId: String(e.id) }).then(() => bump()); },
        }, '设为激活'),
        createElement(Btn, {
          danger: true,
          'data-pool-delete': String(e.id),
          onClick: () => { link.core.askDelete(String(e.id)); bump(); },
        }, '删除'),
        );
      }),
    }),
  );
}

const SessionDetail = (props: {
  entry: PoolEntry | null; isNew: boolean; error: string | null; loading?: boolean;
  select?: { value: string; options: Array<{ value: string; label: string }>; onChange(v: string): void };
  onSave(entry: PoolEntry, isNew: boolean): Promise<void>;
  onCancel(): void; onNew(): void;
}): React.ReactElement => {
  const { entry, isNew, error, loading, select, onSave, onCancel, onNew } = props;
  const [title, setTitle] = useState(isNew ? '' : String(entry?.title ?? ''));
  return createElement(DetailZone, {
    title: isNew ? '新建空会话（壳）' : `详情：${entry?.id ?? ''}`,
    newMode: isNew, error, loading, select,
    onSave: () => { void onSave(isNew ? { id: title, title } : { id: String(entry?.id), title }, isNew); },
    onCancel, onNew,
    children: [
      createElement(TextField, { key: 't', 'data-x': 'title', value: title, placeholder: '会话名', onChange: setTitle }),
    ],
  });
};

// ========== 删除确认罩层（C7/C8/C9；tmux OVERLAY 同款模式） ==========

export function DeleteOverlay(props: {
  pool: string; id: string; relied: { error: string; reliedBy: ReliedBy[] } | null;
  onConfirm(): void; onCancel(): void;
}): React.ReactElement {
  const { pool, id, relied, onConfirm, onCancel } = props;
  return createElement('div', {
    'data-pool-overlay': '1',
    onClick: onCancel, // C9：点罩层空白=取消
    style: {
      position: 'absolute', inset: 0, zIndex: 10,
      background: 'var(--kfm-overlay-bg)', backdropFilter: 'blur(14px)',
      WebkitBackdropFilter: 'blur(14px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
  }, createElement('div', {
    onClick: (e: React.MouseEvent) => e.stopPropagation(),
    'data-pool-overlay-card': '1',
    style: {
      width: 'min(78vw, 320px)', background: 'var(--kfm-bar-bg)', border: '1px solid var(--kfm-line)',
      borderRadius: 'var(--kfm-radius-lg)', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px',
    },
  },
  createElement('div', { style: { fontSize: '13px', color: 'var(--kfm-ink)' } }, `删除 ${pool} 池「${id}」？`),
  relied
    ? createElement('div', { 'data-pool-relied': '1', style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
        createElement('div', { style: { fontSize: '12px', color: 'var(--kfm-red)' } }, relied.error),
        relied.reliedBy.length > 0
          ? createElement('div', { style: { fontSize: '11.5px', color: 'var(--kfm-ink-2)' } }, '被谁用着：')
          : null,
        relied.reliedBy.map((r, i) => createElement('div', {
          key: i, style: { fontSize: '11.5px', color: 'var(--kfm-ink-2)', paddingLeft: '8px' },
        }, `· ${r.pool} 池「${r.id}」（字段 ${r.field}）`)),
      )
    : createElement('div', { style: { fontSize: '11.5px', color: 'var(--kfm-ink-3)' } }, '被引用或激活中的条目禁删（relied 守卫在服务器，这里只是确认）'),
  createElement('div', { style: { display: 'flex', gap: '10px', justifyContent: 'flex-end' } },
    createElement('button', {
      'data-pool-overlay-cancel': '1', type: 'button', onClick: onCancel,
      style: {
        padding: '6px 16px', fontSize: '13px', cursor: 'pointer', borderRadius: 0,
        border: '1px solid var(--kfm-line)', background: 'none', color: 'var(--kfm-ink-3)',
      },
    }, '取消'),
    createElement('button', {
      'data-pool-overlay-confirm': '1', type: 'button', onClick: onConfirm,
      style: {
        padding: '6px 16px', fontSize: '13px', cursor: 'pointer', borderRadius: 0,
        border: '1px solid var(--kfm-ink)', background: 'none', color: 'var(--kfm-ink)',
      },
    }, '确认'),
  )));
}

// ========== 池页视图分派 ==========

export function PoolPageView(props: ViewProps): React.ReactElement {
  const { pool } = props;
  // 修订① 后各视图自带 hooks（PromptView 的对话框/选择器态等）——必须以
  // 真组件分发（createElement），直调会把视图钩子记到本组件账上，切池即
  // React #310（hooks 数量前后不一致，B3 现场实锤）
  if (pool === 'basic') return createElement(BasicView, props);
  if (pool === 'provider') return createElement(ProviderView, props);
  if (pool === 'prompt') return createElement(PromptView, props);
  if (pool === 'session') return createElement(SessionView, props);
  return PoolZone({ children: [] });
}
