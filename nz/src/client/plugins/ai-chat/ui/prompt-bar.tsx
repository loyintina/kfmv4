/**
 * ui/prompt-bar.tsx — 输入栏皮（BeautifulUI prompt-bar.tsx 裁剪重写，§3.1
 * 裁剪表）：借 composer 外壳（边框聚焦态/圆角/发送钮配色）+ 自动长高
 * textarea 方案（scrollHeight 定高，min 28/max 100）；裁 glimm 彩虹扫光/
 * AUTO_STEPS 自动表演/@ 数据源菜单// 命令菜单/听写钮/expanded 双栏 grid
 * （手机窄屏直接竖排：textarea 一行 + 控制行）。model picker 保留极简版
 * （§八③：数据源 GET /ai/providers，只出 id/name/models，含 echo 条目）。
 *
 * 菜单机词汇（§3.3，P9 唯一真源）：CLOSED ↔ MODEL_OPEN。
 * P2：WAITING/STREAMING 中发送钮恒为停止钮（A8 入口）。
 */
import { createElement, useLayoutEffect, useRef, useState } from 'react';
import type { ProvidersInfo, RunPhase } from '../chat-link.js';

/** 菜单机词汇（§3.3） */
export type MenuState = 'CLOSED' | 'MODEL_OPEN';

export interface PromptBarProps {
  phase: RunPhase;
  menu: MenuState;
  selection: { provider: string; model: string };
  providersInfo: ProvidersInfo | null;
  onMenu(next: MenuState): void;
  onSelect(provider: string, model: string): void;
  onSend(text: string): void;
  onStop(): void;
}

const MIN_H = 28;
const MAX_H = 100;

function SendIcon(): React.ReactElement {
  return createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.4, strokeLinecap: 'round', strokeLinejoin: 'round' },
    createElement('path', { d: 'M12 19V5M5 12l7-7 7 7' }));
}
function StopIcon(): React.ReactElement {
  return createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'currentColor' },
    createElement('rect', { x: 5, y: 5, width: 14, height: 14, rx: 2 }));
}

export function PromptBar(props: PromptBarProps): React.ReactElement {
  const { phase, menu, selection, providersInfo, onMenu, onSelect, onSend, onStop } = props;
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 自动长高（借 prompt-bar.tsx 方案：height 归零量 scrollHeight，min/max 夹取）
  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.style.height = '0px';
    const contentHeight = input.scrollHeight;
    input.style.height = `${Math.min(Math.max(contentHeight, MIN_H), MAX_H)}px`;
    input.style.overflowY = contentHeight > MAX_H ? 'auto' : 'hidden';
  }, [draft]);

  const busy = phase !== 'IDLE';
  const canSend = !busy && draft.trim().length > 0;
  const send = (): void => {
    if (!canSend) return;
    onSend(draft.trim());
    setDraft('');
  };

  // picker 行：provider × model 平铺（含 echo 条目——断网开发从 picker 可达）
  const rows: Array<{ provider: string; name: string; model: string }> = [];
  for (const p of providersInfo?.providers ?? []) {
    for (const m of p.models) rows.push({ provider: p.id, name: p.name, model: m });
  }

  const modelMenu = menu === 'MODEL_OPEN'
    ? createElement('div', {
        'data-aichat-model-menu': '1',
        style: {
          position: 'absolute', right: 0, bottom: '100%', marginBottom: '8px', zIndex: 10,
          width: '240px', maxHeight: '45vh', overflowY: 'auto',
          background: 'var(--kfm-surface)', borderRadius: 'var(--kfm-radius-lg)',
          boxShadow: 'var(--kfm-shadow-raised)', padding: '4px',
        },
      },
      rows.length === 0
        ? createElement('div', { style: { padding: '8px 10px', fontSize: '12px', color: 'var(--kfm-ink-3)' } }, '加载 provider 列表…')
        : rows.map((r) => {
            const current = r.provider === selection.provider && r.model === selection.model;
            return createElement('button', {
              key: `${r.provider}::${r.model}`,
              'data-aichat-model-row': `${r.provider}::${r.model}`,
              type: 'button',
              onClick: () => { onSelect(r.provider, r.model); onMenu('CLOSED'); inputRef.current?.focus(); },
              style: {
                display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
                padding: '6px 8px', border: 'none', background: 'none', cursor: 'pointer',
                borderRadius: 'var(--kfm-radius-sm)', textAlign: 'left',
              },
            },
            createElement('span', {
              style: { flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '12.5px', color: 'var(--kfm-ink)' },
            }, `${r.name} · ${r.model}`),
            current
              ? createElement('svg', { width: 13, height: 13, viewBox: '0 0 24 24', fill: 'none', stroke: 'var(--kfm-accent-ink)', strokeWidth: 2.5, strokeLinecap: 'round', strokeLinejoin: 'round' },
                  createElement('path', { d: 'M20 6L9 17l-5-5' }))
              : null,
            );
          }),
      )
    : null;

  return createElement('div', {
    style: { position: 'relative', flexShrink: 0, padding: '6px 10px calc(10px + var(--sab, 0px))' },
  },
  modelMenu,
  createElement('div', {
    'data-aichat-composer': '1',
    style: {
      display: 'flex', flexDirection: 'column', gap: '6px',
      border: '1px solid var(--kfm-aichat-line)', borderRadius: 'var(--kfm-radius-xl)',
      background: 'var(--kfm-surface)', boxShadow: 'var(--kfm-shadow-card)',
      padding: '8px 10px',
    },
  },
  createElement('textarea', {
    'data-aichat-input': '1',
    ref: inputRef,
    rows: 1,
    value: draft,
    placeholder: busy ? '回复生成中…' : '发消息给 AI…',
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => setDraft(e.target.value),
    onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Escape' && menu === 'MODEL_OPEN') { onMenu('CLOSED'); return; } // A10
      // Enter 发送（Shift+Enter 换行；IME 组词中 Enter 不发送——CJK 教训同款守卫）
      if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault();
        send();
      }
    },
    style: {
      width: '100%', minHeight: `${MIN_H}px`, resize: 'none', border: 'none', outline: 'none',
      background: 'transparent', color: 'var(--kfm-ink)', fontSize: '13px', lineHeight: '18px',
      padding: '5px 4px', overflowWrap: 'anywhere', fontFamily: 'inherit',
    },
  }),
  createElement('div', {
    style: { display: 'flex', alignItems: 'center', gap: '4px' },
  },
  // model picker 钮（菜单机 CLOSED ↔ MODEL_OPEN）
  createElement('button', {
    'data-aichat-model-btn': '1',
    type: 'button',
    onClick: () => onMenu(menu === 'MODEL_OPEN' ? 'CLOSED' : 'MODEL_OPEN'),
    style: {
      display: 'flex', alignItems: 'center', gap: '4px', height: '28px', padding: '0 8px',
      border: 'none', background: 'none', cursor: 'pointer', borderRadius: 'var(--kfm-radius-md)',
      fontSize: '12px', color: 'var(--kfm-ink-2)', maxWidth: '70vw',
    },
  },
  createElement('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
    selection.provider ? `${selection.provider} · ${selection.model}` : '选择模型'),
  createElement('svg', { width: 11, height: 11, viewBox: '0 0 24 24', fill: 'none', stroke: 'var(--kfm-ink-3)', strokeWidth: 2.4, strokeLinecap: 'round', strokeLinejoin: 'round' },
    createElement('path', { d: 'M6 9l6 6 6-6' })),
  ),
  createElement('div', { style: { flex: 1 } }),
  // 发送/停止钮（P2：流式期间恒为停止钮——A8 入口；借 prompt-bar.tsx 发送钮配色）
  createElement('button', {
    'data-aichat-send': '1',
    'data-aichat-send-mode': busy ? 'stop' : 'send',
    type: 'button',
    disabled: !busy && !canSend,
    onClick: () => { if (busy) onStop(); else send(); },
    style: {
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      width: '28px', height: '28px', border: 'none', borderRadius: 'var(--kfm-radius-md)',
      cursor: busy || canSend ? 'pointer' : 'default',
      background: busy ? 'var(--kfm-red)' : canSend ? 'var(--kfm-ink)' : 'var(--kfm-line-strong)',
      color: busy || canSend ? 'var(--kfm-surface)' : 'var(--kfm-ink-2)',
    },
  }, busy ? createElement(StopIcon) : createElement(SendIcon)),
  ),
  ),
  );
}
