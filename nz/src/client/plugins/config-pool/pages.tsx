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
 *   （prompt 池 2026-09-07 随 AI 配置面瘦身退役——双区文件对象等 git 历史
 *    cac0da5e 可考；角色数据留盘）
 *   session  详情=title 改名 + 会话列表（§3.4）
 *
 * 激活双态 UI（P2）：✓ 激活标只随激活总账走；编辑任何条目不动 ✓。
 * 草稿语义：详情区改动是本地草稿，保存才落盘（C5）；取消=rev++ 重挂回存
 * 档值（C6）；新建草稿取消=回落选中首条。删除=服务性破坏操作，仍走确认
 * 罩层（C7-C9）；草稿内移除文件引用不确认（取消即可整体撤销）。
 * 皮内零硬编码颜色/阴影/圆角/时长字面量（P8，全走 --kfm-* token）。
 */
import { createElement, useEffect, useState } from 'react';
import type { PoolLink, PoolEntry, ActiveLedger, ReliedBy } from './pool-link.js';
import { SelectMenu } from '../../ui/select-menu.js';

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
      flex: '1 1 50%', minHeight: 0, margin: '8px 10px 0', padding: '10px',
      display: 'flex', flexDirection: 'column', gap: '8px',
      background: 'var(--kfm-surface)', border: '1px solid var(--kfm-line)', borderRadius: 'var(--kfm-radius-lg)',
      boxSizing: 'border-box',
    },
  },
  createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 } },
    createElement('div', { style: { fontSize: '12.5px', color: 'var(--kfm-ink-2)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, title),
  ),
  select
    ? createElement(SelectMenu, { 'data-x': 'detail', value: select.value, options: select.options, onChange: select.onChange })
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
  loading ? null : createElement('div', { 'data-pool-config-actions': '1', style: { display: 'flex', gap: '8px', flexShrink: 0 } },
    newMode ? null : createElement('button', {
      'data-pool-new': '1', type: 'button', onClick: onNew,
      style: {
        flex: 1, padding: '6px 0', fontSize: '12px', cursor: 'pointer',
        borderRadius: 'var(--kfm-radius-sm)', border: '1px solid var(--kfm-line)',
        background: 'none', color: 'var(--kfm-ink-2)',
      },
    }, '新建'),
    createElement('button', {
      'data-pool-save': '1', type: 'button', onClick: (e: React.MouseEvent) => { e.stopPropagation(); onSave(); },
      style: {
        flex: 1, padding: '6px 0', fontSize: '12px', cursor: 'pointer',
        borderRadius: 'var(--kfm-radius-sm)', border: '1px solid var(--kfm-ink)',
        background: 'var(--kfm-ink)', color: 'var(--kfm-page)',
      },
    }, '保存'),
    createElement('button', {
      'data-pool-cancel': '1', type: 'button', onClick: onCancel,
      style: {
        flex: 1, padding: '6px 0', fontSize: '12px', cursor: 'pointer',
        borderRadius: 'var(--kfm-radius-sm)', border: '1px solid var(--kfm-line)',
        background: 'none', color: 'var(--kfm-ink-2)',
      },
    }, '取消'),
  ));
}

/** 下池列表骨架（选择制 1:1：与详情区各占一半——flex-basis 对齐保证严格对分） */
function PoolZone(props: { children: React.ReactNode }): React.ReactElement {
  return createElement('div', {
    'data-pool-zone': '1',
    style: { flex: '1 1 50%', minHeight: 0, overflowY: 'auto', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '6px', boxSizing: 'border-box' },
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
  createElement('div', {
    'data-pool-row-actions': '1',
    style: { display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 },
  }, children),
  );
}

function CheckMark(): React.ReactElement {
  // 「当前」徽章（老卡同款：渐变/accent 底小圆角标）
  return createElement('span', {
    'data-pool-check': '1',
    style: {
      fontSize: '10px', color: 'var(--kfm-page)', flexShrink: 0,
      background: 'var(--kfm-accent)', borderRadius: 'var(--kfm-radius-sm)', padding: '1px 5px',
    },
  }, '当前');
}

/** 行尾红 × 删除钮（老卡同款：60% 红；确认走 OVERLAY_DELETE） */
function DeleteX(props: { id: string; onDelete(): void }): React.ReactElement {
  const { id, onDelete } = props;
  return createElement('span', {
    'data-pool-delete': id,
    onClick: (e: { stopPropagation(): void }) => {
      e.stopPropagation(); // 行点击=切换编辑目标；删 × 不许冒泡改写机态（B5a 实锤）
      onDelete();
    },
    title: '删除',
    style: {
      color: 'var(--kfm-red)', opacity: 0.6, cursor: 'pointer',
      fontSize: '15px', lineHeight: 1, padding: '2px 5px', flexShrink: 0,
    },
  }, '×');
}

// ========== 基本池（§3.1 只读聚合变体） ==========

function BasicView(props: ViewProps): React.ReactElement {
  const { link, entries, bump } = props;
  const slotValue = (e: PoolEntry): string => {
    if (e.id === 'provider') return `${e.providerId || '（空）'} · ${e.modelId || '（空）'}`;
    if (e.id === 'role') return String(e.roleFile || '（空）');
    return String(e.sessionId || '（空）');
  };
  const gotoPool: Record<string, string> = { provider: 'provider', session: 'session' };
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
        createElement(DeleteX, {
          id: String(e.id),
          onDelete: () => { link.core.askDelete(String(e.id)); bump(); },
        }),
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
        createElement(DeleteX, {
          id: String(e.id),
          onDelete: () => { link.core.askDelete(String(e.id)); bump(); },
        }),
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
  if (pool === 'session') return createElement(SessionView, props);
  return PoolZone({ children: [] });
}
