/**
 * pages.tsx — 四池页皮（React 组件；设计清单 §三「上配置下池」页内布局）
 *
 *   basic    只读聚合变体：上区=三激活槽位行（值+失效标注位），下区=「前往
 *            更换」路由到对应池页（池框架内部能力，走 C3 转换形状）；数据=
 *            /pool/basic 投影 + /pool/active（§3.1）
 *   provider 表单（id/name/baseUrl/apiKey 代字回填占位/models 清单行编辑）
 *            + 列表（✓激活标/编辑=点行/删除/设为激活）+ model 行级下钻
 *            （增删+行级设为激活——与 picker 二级路由同构同数据源，§3.2）
 *   prompt   role schema 表单（name + promptFiles/dynamicPromptFiles 有序
 *            手填路径行，增删/上下移排序——仲裁⑧）+ 列表+激活标（§3.3）
 *   session  壳表单（title 改名）+ 会话列表（title/updatedAt/激活标）+新建
 *            +删除+设为激活；messages 恒空不渲染不写（仲裁①，P5）（§3.4）
 *
 * 激活双态 UI（P2）：✓ 激活标只随激活总账走；编辑任何条目不动 ✓。
 * 皮内零硬编码颜色/阴影/圆角/时长字面量（P8，全走 --kfm-* token）。
 */
import { createElement, useState } from 'react';
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

/** 手填路径行（有序清单：增删/上下移排序——仲裁⑧；文件树挑选留接口位等 8.10） */
function OrderedPathRows(props: {
  title: string; dataField: string; rows: string[];
  onChange(rows: string[]): void;
}): React.ReactElement {
  const { title, dataField, rows, onChange } = props;
  const [draft, setDraft] = useState('');
  const move = (i: number, d: -1 | 1): void => {
    const next = [...rows];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px' } },
    createElement('div', { style: { fontSize: '11px', color: 'var(--kfm-ink-3)' } }, title),
    rows.map((p, i) => createElement('div', {
      key: `${p}:${i}`, 'data-pool-path-row': p,
      style: { display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--kfm-ink)' },
    },
    createElement('span', {
      style: { flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
    }, p),
    createElement('span', { style: { fontSize: '10px', color: 'var(--kfm-ink-3)', flexShrink: 0 } }, `#${i + 1}`),
    createElement(Btn, { onClick: () => move(i, -1) }, '↑'),
    createElement(Btn, { onClick: () => move(i, 1) }, '↓'),
    createElement(Btn, { danger: true, onClick: () => onChange(rows.filter((_, k) => k !== i)) }, '×'),
    )),
    createElement('div', { style: { display: 'flex', gap: '4px' } },
      createElement('div', { style: { flex: 1 } },
        createElement(TextField, {
          'data-x': dataField, value: draft, placeholder: '手填路径（如 prompts/system.md）',
          onChange: setDraft,
          onCommit: () => { if (draft.trim()) { onChange([...rows, draft.trim()]); setDraft(''); } },
        })),
      createElement(Btn, {
        primary: true,
        onClick: () => { if (draft.trim()) { onChange([...rows, draft.trim()]); setDraft(''); } },
      }, '加路径'),
    ),
  );
}

/** 上配置区骨架：EDITING 载表单，BROWSE 出预览/新建位（§四 池页机两态） */
function ConfigZone(props: {
  editing: boolean; title: string; error: string | null;
  onSave(): void; onCancel(): void; children?: React.ReactNode;
}): React.ReactElement {
  const { editing, title, error, onSave, onCancel, children } = props;
  if (!editing) return createElement('div', null);
  return createElement('div', {
    'data-pool-config': '1',
    style: {
      flexShrink: 0, margin: '8px 10px 0', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px',
      background: 'var(--kfm-surface)', border: '1px solid var(--kfm-line)', borderRadius: 'var(--kfm-radius-lg)',
    },
  },
  createElement('div', { style: { fontSize: '12.5px', color: 'var(--kfm-ink-2)' } }, title),
  children,
  error !== null
    ? createElement('div', { 'data-pool-form-error': '1', style: { fontSize: '11.5px', color: 'var(--kfm-red)' } }, error)
    : null,
  createElement('div', { style: { display: 'flex', gap: '8px', justifyContent: 'flex-end' } },
    createElement(Btn, { 'data-x': undefined, onClick: onCancel }, '取消'),
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

const newBtn = (onClick: () => void): React.ReactElement => createElement('button', {
  'data-pool-new': '1', type: 'button', onClick,
  style: {
    flexShrink: 0, alignSelf: 'flex-start', margin: '8px 10px 0', padding: '4px 12px', fontSize: '12px',
    cursor: 'pointer', borderRadius: 'var(--kfm-radius-sm)', border: '1px dashed var(--kfm-line-strong)',
    background: 'none', color: 'var(--kfm-ink-2)',
  },
}, '＋ 新建');

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

// ========== provider-model 池（§3.2） ==========

function ProviderView(props: ViewProps): React.ReactElement {
  const { link, entries, active, formError, setFormError, bump } = props;
  const editing = link.core.state.editing;
  const current = editing && !editing.isNew ? entries.find((e) => e.id === editing.id) ?? null : null;
  const provAlive = entries.find((e) => e.id === active.providerId || e.name === active.providerId) ?? null;

  const save = async (entry: PoolEntry, isNew: boolean): Promise<void> => {
    const r = await link.save('provider', entry, isNew); // C5：成功 core 转 BROWSE；败=人话回表单不转换
    if (!r.ok) setFormError(r.error ?? '保存失败');
    bump();
  };
  const activateModel = (provId: string, model: string): void => {
    void link.activate({ providerId: provId, modelId: model }).then(() => bump());
  };

  let form: React.ReactElement | null = null;
  if (editing) {
    form = createElement(ProviderForm, {
      key: `${editing.pool}:${editing.id ?? '__new__'}`,
      entry: current, isNew: editing.isNew,
      error: formError,
      onSave: save, onActivateModel: activateModel,
      onCancel: () => { link.core.cancelEdit(); setFormError(null); bump(); },
    });
  }
  return createElement('div', { style: { display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 } },
    form ?? newBtn(() => { link.core.beginEdit({ id: null, isNew: true }); bump(); }),
    PoolZone({
      children: entries.map((e) => {
        const models = Array.isArray(e.models) ? (e.models as string[]).map(String) : [];
        const isActive = provAlive?.id === e.id;
        return createElement(ListRow, {
          key: String(e.id),
          'data-x': `provider:${e.id}`,
          active: isActive,
          title: String(e.name ?? e.id),
          sub: `${e.id} · ${models.length} models`,
          onClickRow: () => { link.core.beginEdit({ id: String(e.id), isNew: false }); bump(); },
        },
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

const ProviderForm = (props: {
  entry: PoolEntry | null; isNew: boolean; error: string | null;
  onSave(entry: PoolEntry, isNew: boolean): Promise<void>;
  onActivateModel(provId: string, model: string): void;
  onCancel(): void;
}): React.ReactElement => {
  const { entry, isNew, error, onSave, onActivateModel, onCancel } = props;
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
  return createElement(ConfigZone, {
    editing: true,
    title: isNew ? '新建 Provider' : `编辑 Provider：${entry?.id ?? ''}`,
    error,
    onSave: () => { void onSave({ id, name, baseUrl, apiKey, models }, isNew); },
    onCancel,
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
        createElement('div', { style: { fontSize: '11px', color: 'var(--kfm-ink-3)' } }, 'models（点行内「激活」=二元组激活，与 picker 二级同构）'),
        models.map((m) => createElement('div', {
          key: m, 'data-pool-model-row': m,
          style: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--kfm-ink)' },
        },
        createElement('span', { style: { flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, m),
        !isNew && savedModels.includes(m)
          ? createElement(Btn, { primary: true, onClick: () => onActivateModel(String(entry!.id), m) }, '激活')
          : null,
        createElement(Btn, { danger: true, onClick: () => setModels(models.filter((x) => x !== m)) }, '×'),
        )),
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

// ========== agent-prompt 池（§3.3） ==========

function PromptView(props: ViewProps): React.ReactElement {
  const { link, entries, active, formError, setFormError, bump } = props;
  const editing = link.core.state.editing;
  const current = editing && !editing.isNew ? entries.find((e) => e.id === editing.id) ?? null : null;
  const save = async (entry: PoolEntry, isNew: boolean): Promise<void> => {
    const r = await link.save('prompt', entry, isNew);
    if (!r.ok) setFormError(r.error ?? '保存失败');
    bump();
  };
  return createElement('div', { style: { display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 } },
    editing
      ? createElement(PromptForm, {
          key: `${editing.pool}:${editing.id ?? '__new__'}`,
          entry: current, isNew: editing.isNew, error: formError,
          onSave: save,
          onCancel: () => { link.core.cancelEdit(); setFormError(null); bump(); },
        })
      : newBtn(() => { link.core.beginEdit({ id: null, isNew: true }); bump(); }),
    createElement('div', {
      style: { flexShrink: 0, margin: '6px 10px 0', fontSize: '10.5px', color: 'var(--kfm-ink-3)' },
    }, '激活角色 A2b 装配线起生效（v0 被记住）'),
    PoolZone({
      children: entries.map((e) => createElement(ListRow, {
        key: String(e.id),
        'data-x': `prompt:${e.id}`,
        active: active.roleFile === e.id,
        title: String(e.name ?? e.id),
        sub: `${e.id} · files=${(e.promptFiles as string[] | undefined)?.length ?? 0}`,
        onClickRow: () => { link.core.beginEdit({ id: String(e.id), isNew: false }); bump(); },
      },
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
      )),
    }),
  );
}

const PromptForm = (props: {
  entry: PoolEntry | null; isNew: boolean; error: string | null;
  onSave(entry: PoolEntry, isNew: boolean): Promise<void>;
  onCancel(): void;
}): React.ReactElement => {
  const { entry, isNew, error, onSave, onCancel } = props;
  const [id, setId] = useState(entry ? String(entry.id) : '');
  const [name, setName] = useState(entry ? String(entry.name ?? '') : '');
  const [files, setFiles] = useState<string[]>(entry && Array.isArray(entry.promptFiles) ? (entry.promptFiles as string[]).map(String) : []);
  const [dynFiles, setDynFiles] = useState<string[]>(entry && Array.isArray(entry.dynamicPromptFiles) ? (entry.dynamicPromptFiles as string[]).map(String) : []);
  return createElement(ConfigZone, {
    editing: true,
    title: isNew ? '新建角色（id=文件名裸名，可中文）' : `编辑角色：${entry?.id ?? ''}`,
    error,
    onSave: () => { void onSave({ id, name, promptFiles: files, dynamicPromptFiles: dynFiles }, isNew); },
    onCancel,
    children: [
      createElement('div', { key: 'row1', style: { display: 'flex', gap: '6px' } },
        createElement('div', { style: { width: '40%' } },
          createElement(TextField, { 'data-x': 'id', value: id, disabled: !isNew, placeholder: 'id（文件名裸名）', onChange: setId })),
        createElement('div', { style: { flex: 1 } },
          createElement(TextField, { 'data-x': 'name', value: name, placeholder: '角色名', onChange: setName })),
      ),
      createElement(OrderedPathRows, { title: 'promptFiles（有序，拼接按此序——A2b 装配线）', dataField: 'file-add', rows: files, onChange: setFiles }),
      createElement(OrderedPathRows, { title: 'dynamicPromptFiles（眼睛挂载点，投影联动 A2b）', dataField: 'dynfile-add', rows: dynFiles, onChange: setDynFiles }),
    ],
  });
};

// ========== session 池（§3.4 v0 壳） ==========

function SessionView(props: ViewProps): React.ReactElement {
  const { link, entries, active, formError, setFormError, bump } = props;
  const editing = link.core.state.editing;
  const current = editing && !editing.isNew ? entries.find((e) => e.id === editing.id) ?? null : null;
  const save = async (entry: PoolEntry, isNew: boolean): Promise<void> => {
    const r = await link.save('session', entry, isNew);
    if (!r.ok) setFormError(r.error ?? '保存失败');
    bump();
  };
  return createElement('div', { style: { display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 } },
    editing
      ? createElement(SessionForm, {
          key: `${editing.pool}:${editing.id ?? '__new__'}`,
          entry: current, isNew: editing.isNew, error: formError,
          onSave: save,
          onCancel: () => { link.core.cancelEdit(); setFormError(null); bump(); },
        })
      : newBtn(() => { link.core.beginEdit({ id: null, isNew: true }); bump(); }),
    createElement('div', {
      style: { flexShrink: 0, margin: '6px 10px 0', fontSize: '10.5px', color: 'var(--kfm-ink-3)' },
    }, 'v0=壳管理：messages 恒空（消息落盘 A3/session-store lineage，仲裁①）'),
    PoolZone({
      children: entries.map((e) => {
        const dangling = Array.isArray(e.dangling) && (e.dangling as string[]).length > 0;
        return createElement(ListRow, {
          key: String(e.id),
          'data-x': `session:${e.id}`,
          active: active.sessionId === e.id,
          title: String(e.title ?? e.id),
          sub: `${e.id}${e.updatedAt ? ` · ${String(e.updatedAt).slice(0, 19).replace('T', ' ')}` : ''}`,
          dangling,
          onClickRow: () => { link.core.beginEdit({ id: String(e.id), isNew: false }); bump(); },
        },
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

const SessionForm = (props: {
  entry: PoolEntry | null; isNew: boolean; error: string | null;
  onSave(entry: PoolEntry, isNew: boolean): Promise<void>;
  onCancel(): void;
}): React.ReactElement => {
  const { entry, isNew, error, onSave, onCancel } = props;
  const [title, setTitle] = useState(isNew ? '' : String(entry?.title ?? ''));
  return createElement(ConfigZone, {
    editing: true,
    title: isNew ? '新建空会话（壳）' : `改名：${entry?.id ?? ''}`,
    error,
    onSave: () => { void onSave(isNew ? { id: title, title } : { id: String(entry?.id), title }, isNew); },
    onCancel,
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
  if (pool === 'basic') return BasicView(props);
  if (pool === 'provider') return ProviderView(props);
  if (pool === 'prompt') return PromptView(props);
  if (pool === 'session') return SessionView(props);
  return PoolZone({ children: [] });
}
