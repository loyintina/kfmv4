/**
 * ui/prompt-bar.tsx — 输入栏皮（BeautifulUI prompt-bar.tsx 裁剪重写，§3.1
 * 裁剪表）：借 composer 外壳（边框聚焦态/圆角/发送钮配色）+ 自动长高
 * textarea 方案（scrollHeight 定高，min 28/max 100）；裁 glimm 彩虹扫光/
 * AUTO_STEPS 自动表演/@ 数据源菜单// 命令菜单/听写钮/expanded 双栏 grid
 * （手机窄屏直接竖排：textarea 一行 + 控制行）。model picker 保留极简版
 * （§八③：数据源 GET /ai/providers，只出 id/name/models，含 echo 条目）。
 *
 * 2026-09-04 拍板① composer 全局化 + 同日二拍换序：本件不再住 AI 页内，
 * 由 index.tsx 装配进全局钉底条（[data-kfm-aichat-bar]，钉**最底**贴软键盘
 * /视口底，keybar 钉其正上方）——两态常驻可发送。
 *
 * 菜单机词汇（§3.3，P9 唯一真源）：CLOSED ↔ MODEL_OPEN。
 * 2026-09-04 拍板⑫ picker 两级路由：一级=provider 列表（当前 provider
 * 带 ✓），点 provider 下钻二级=该 provider 的 model 列表（带返回钮，
 * 下钻不收起）；server 下发的默认模型恒可见——不在 models[] 里就合成
 * 常驻行置顶（标注「默认」，A2 观察项①销账：Kimi 无 kimi-k2.7-code
 * 但它是默认；拍板⑮后默认=智谱 glm-5.3-flash 在列表内不触发合成，
 * 合成机制保留防未来默认不在列表）；点定 model 才生效+收起（A10 语义）。
 * 下钻层级（drill）是 picker 内部 UI 态，不进菜单机词汇（P9 不加词）。
 * 2026-09-04 拍板⑭：composer 回车=换行不发送（textarea 自然换行，不
 * 拦截即 IME 守卫语义），发送唯一路径=发送按钮（流式期间仍是停止钮）。
 * P2：WAITING/STREAMING 中发送钮恒为停止钮（A8 入口）。
 */
import { createElement, useEffect, useLayoutEffect, useRef, useState } from 'react';
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
  // 拍板⑫：picker 下钻层级（null=一级 provider 列表；provider id=二级
  // model 列表）。picker 内部 UI 态，不进菜单机词汇（P9）；菜单关即复位
  const [drill, setDrill] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (menu === 'CLOSED') setDrill(null); }, [menu]);

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

  // picker 两级路由（拍板⑫）：一级 provider 列表 → 点 provider 下钻二级
  // model 列表（含 echo 条目——断网开发从 picker 可达）。行通用件：
  const providers = providersInfo?.providers ?? [];
  const def = providersInfo?.default ?? null;
  const rowStyle: Record<string, unknown> = {
    display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
    padding: '6px 8px', border: 'none', background: 'none', cursor: 'pointer',
    borderRadius: 'var(--kfm-radius-sm)', textAlign: 'left',
  };
  const rowTextStyle: Record<string, unknown> = {
    flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '12.5px', color: 'var(--kfm-ink)',
  };
  const checkMark = createElement('svg', { 'data-aichat-check': '1', width: 13, height: 13, viewBox: '0 0 24 24', fill: 'none', stroke: 'var(--kfm-accent-ink)', strokeWidth: 2.5, strokeLinecap: 'round', strokeLinejoin: 'round' },
    createElement('path', { d: 'M20 6L9 17l-5-5' }));

  // 一级：provider 列表（当前 provider 带 ✓；点击=下钻不收起——拍板⑫③）
  const level1 = providers.map((p) =>
    createElement('button', {
      key: p.id,
      'data-aichat-provider-row': p.id,
      type: 'button',
      onClick: () => setDrill(p.id),
      style: rowStyle,
    },
    createElement('span', { style: rowTextStyle }, p.name),
    createElement('span', { style: { fontSize: '11px', color: 'var(--kfm-ink-3)' } }, `${p.models.length}`),
    p.id === selection.provider ? checkMark : null,
    createElement('svg', { width: 11, height: 11, viewBox: '0 0 24 24', fill: 'none', stroke: 'var(--kfm-ink-3)', strokeWidth: 2.4, strokeLinecap: 'round', strokeLinejoin: 'round' },
      createElement('path', { d: 'M9 6l6 6-6 6' })),
    ));

  // 二级：该 provider 的 model 列表 + server 默认模型常驻行（拍板⑫②——
  // 默认模型不在 models[] 就合成置顶常驻行，标注「默认」，切走也能点回来；
  // A2 观察项①销账案例=Kimi 无 kimi-k2.7-code；拍板⑮后默认=智谱在列表
  // 内不触发合成，机制保留）。返回钮回一级（不收起）；点定 model 才生效
  // +收起（A10 语义沿用）
  const drillProv = drill ? providers.find((p) => p.id === drill) : undefined;
  const level2 = drillProv
    ? (() => {
        const isDefProv = !!def && def.provider === drillProv.id;
        const models = [...drillProv.models];
        if (isDefProv && def && !models.includes(def.model)) models.unshift(def.model);
        return [
          createElement('button', {
            key: '__back__',
            'data-aichat-picker-back': '1',
            type: 'button',
            onClick: () => setDrill(null),
            style: { ...rowStyle, color: 'var(--kfm-ink-2)' },
          },
          createElement('svg', { width: 11, height: 11, viewBox: '0 0 24 24', fill: 'none', stroke: 'var(--kfm-ink-3)', strokeWidth: 2.4, strokeLinecap: 'round', strokeLinejoin: 'round' },
            createElement('path', { d: 'M15 6l-6 6 6 6' })),
          createElement('span', { style: { ...rowTextStyle, fontSize: '12px', color: 'var(--kfm-ink-2)' } }, drillProv.name),
          ),
          ...models.map((m) => {
            const isDef = isDefProv && def !== null && m === def.model;
            const current = drillProv.id === selection.provider && m === selection.model;
            return createElement('button', {
              key: `${drillProv.id}::${m}`,
              'data-aichat-model-row': `${drillProv.id}::${m}`,
              'data-aichat-model-default': isDef ? '1' : null,
              type: 'button',
              onClick: () => { onSelect(drillProv.id, m); onMenu('CLOSED'); inputRef.current?.focus(); },
              style: rowStyle,
            },
            createElement('span', { style: rowTextStyle }, m),
            isDef
              ? createElement('span', {
                  style: {
                    fontSize: '10px', color: 'var(--kfm-ink-3)', border: '1px solid var(--kfm-line)',
                    borderRadius: 'var(--kfm-radius-sm)', padding: '0 4px', flexShrink: 0,
                  },
                }, '默认')
              : null,
            current ? checkMark : null,
            );
          }),
        ];
      })()
    : null;

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
      providers.length === 0
        ? createElement('div', { style: { padding: '8px 10px', fontSize: '12px', color: 'var(--kfm-ink-3)' } }, '加载 provider 列表…')
        : drill === null ? level1 : level2,
      )
    : null;

  return createElement('div', {
    // 全局钉底条内边距（sab 由下方 keybar 承担，本条不再叠安全区——拍板①装配）
    style: { position: 'relative', flexShrink: 0, padding: '6px 10px 10px' },
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
      // 拍板⑭（2026-09-04）：Enter=换行不发送——不拦截即 textarea 自然换行，
      // IME 组词中 Enter 确认组词也不被拦（不拦截即守卫语义保留）；发送
      // 唯一路径=发送按钮（「不然做发送按钮有什么用」）。终端 keybar 的
      // ENTER 发 \r 是终端逻辑，不在此文件。
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
