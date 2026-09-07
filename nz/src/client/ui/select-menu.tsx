/**
 * select-menu.tsx — 输入栏同款下拉（共享抽取首用：config-pool 详情区条目切换）
 *
 * 视觉/交互 = ai-chat prompt-bar 的 model-menu 同款：surface 面板+行钮+
 * 当前项 ✓。B15 同款纪律：**点外即关+那一指动作同发**——开菜单期间捕获期
 * 监听 pointerdown，点外只关菜单，不拦事件不阻止默认（那一指自然落到点中
 * 的目标上）。皮内零硬编码色值（P8，全走 --kfm-* token）。
 */
import { createElement, useEffect, useRef, useState } from 'react';

export interface SelectMenuOption { value: string; label: string }

export function SelectMenu(props: {
  'data-x': string;
  value: string;
  options: SelectMenuOption[];
  onChange(v: string): void;
  placeholder?: string;
}): React.ReactElement {
  const { 'data-x': dx, value, options, onChange, placeholder } = props;
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent): void => {
      const root = rootRef.current;
      if (root && e.target instanceof Node && root.contains(e.target)) return;
      setOpen(false); // 点外只关不拦：事件继续走（动作同发，B15）
    };
    document.addEventListener('pointerdown', onDown, { capture: true, passive: true });
    return () => document.removeEventListener('pointerdown', onDown, { capture: true });
  }, [open]);

  const rowStyle: Record<string, unknown> = {
    display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
    padding: '6px 8px', border: 'none', background: 'none', cursor: 'pointer',
    borderRadius: 'var(--kfm-radius-sm)', textAlign: 'left',
  };
  const check = createElement('svg', { width: 13, height: 13, viewBox: '0 0 24 24', fill: 'none', stroke: 'var(--kfm-accent-ink)', strokeWidth: 2.5, strokeLinecap: 'round', strokeLinejoin: 'round' },
    createElement('path', { d: 'M20 6L9 17l-5-5' }));
  const current = options.find((o) => o.value === value) ?? null;

  return createElement('div', {
    'data-pool-select': dx,
    ref: rootRef,
    style: { position: 'relative', width: '100%' },
  },
  createElement('button', {
    'data-pool-select-trigger': '1',
    type: 'button',
    onClick: () => setOpen((v) => !v),
    style: {
      display: 'flex', alignItems: 'center', gap: '6px', width: '100%', height: '32px',
      padding: '0 10px', cursor: 'pointer',
      background: 'var(--kfm-field)', color: 'var(--kfm-ink)',
      border: '1px solid var(--kfm-line)', borderRadius: 'var(--kfm-radius-sm)',
      fontSize: '12.5px', outline: 'none', textAlign: 'left',
    },
  },
  createElement('span', { style: { flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
    current ? current.label : placeholder ?? '选择…'),
  createElement('svg', { width: 11, height: 11, viewBox: '0 0 24 24', fill: 'none', stroke: 'var(--kfm-ink-3)', strokeWidth: 2.4, strokeLinecap: 'round', strokeLinejoin: 'round' },
    createElement('path', { d: 'M6 9l6 6 6-6' })),
  ),
  open ? createElement('div', {
    'data-pool-select-menu': '1',
    style: {
      position: 'absolute', left: 0, right: 0, top: '100%', marginTop: '6px', zIndex: 30,
      maxHeight: '40vh', overflowY: 'auto',
      background: 'var(--kfm-surface)', borderRadius: 'var(--kfm-radius-lg)',
      boxShadow: 'var(--kfm-shadow-raised)', padding: '4px',
    },
  },
  options.map((o) => {
    const isCurrent = o.value === value;
    return createElement('button', {
      key: o.value,
      'data-pool-select-row': o.value,
      type: 'button',
      onClick: () => { onChange(o.value); setOpen(false); },
      style: rowStyle,
    },
    createElement('span', { style: { flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '12.5px', color: 'var(--kfm-ink)' } }, o.label),
    isCurrent ? check : null,
    );
  }),
  ) : null,
  );
}
