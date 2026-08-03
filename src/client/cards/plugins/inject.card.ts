/**
 * inject.card.ts — 注入包池卡
 *
 * 展示 .kfmv4/injects/*.md（行为预设注入包）——「池里有什么」，
 * 供配置卡下拉引用。支持：列表（名称+摘要）、点选查看/编辑内容、
 * 新建、删除。注入包 = 拼进会话首条消息的行为规范文本（会话参数组的
 * 可选字段，见 config.card.ts 的 injectFile）。
 */

import { registerCardType, type CardContentHandler } from '../../modules/card-registry.js';
import { buildCardLayout } from '../../modules/floating-card.js';
import { log } from '../../modules/logger.js';
import { showConfirm } from '../../modules/confirm-dialog.js';

const INJECTS_PATH = '.kfmv4/injects';

const API_BASE = (() => {
  const base = window.location.pathname.replace(/\/+$/, '');
  return base + '/api/';
})();

async function readFile(path: string): Promise<string | null> {
  try {
    const res = await fetch(API_BASE + 'files/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    });
    const data = await res.json();
    return data.content || null;
  } catch (e) { log('[inject] 读取失败: ' + (e instanceof Error ? e.message : String(e))); return null; }
}

async function writeFile(path: string, content: string): Promise<void> {
  try {
    await fetch(API_BASE + 'files/write', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, content }),
    });
  } catch (e) { log('[inject] 写入失败: ' + (e instanceof Error ? e.message : String(e))); }
}

async function listDir(dir: string): Promise<string[]> {
  try {
    const res = await fetch(API_BASE + 'files/list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: dir }),
    });
    const data = await res.json();
    return (data.items || []).map((f: { name: string }) => f.name);
  } catch (e) { log('[inject] 列出失败: ' + (e instanceof Error ? e.message : String(e))); return []; }
}

async function deleteFile(path: string): Promise<void> {
  await fetch(API_BASE + 'files/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  }).catch((e) => { log('[inject] 删除失败: ' + (e instanceof Error ? e.message : String(e))); });
}

function inputStyle(): string {
  return 'font-size:var(--card-font-size,11px);padding:0.35em 0.7em;border-radius:6px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.85);outline:none;flex:1;min-width:0';
}

function btnStyle(accent: string): string {
  return `padding:0.3em 0.8em;border-radius:6px;font-size:var(--card-font-size,10px);font-weight:600;cursor:pointer;user-select:none;border:1px solid ${accent}40;color:${accent};background:transparent;flex:1;text-align:center`;
}

function mkRow(label: string): { row: HTMLElement; wrap: HTMLElement } {
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;align-items:center;margin-bottom:6px';
  const lbl = document.createElement('div');
  lbl.style.cssText = 'font-size:var(--card-font-size,10px);color:rgba(255,255,255,0.5);flex-shrink:0;margin-right:8px;width:52px';
  lbl.textContent = label;
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex:1;min-width:0';
  row.appendChild(lbl);
  row.appendChild(wrap);
  return { row, wrap };
}

function createInjectHandler(meta: Record<string, unknown>): CardContentHandler {
  let files: string[] = [];
  let selected = '';

  return {
    async activate(contentEl, card) {
      const c1 = card?.accents?.color1 || '#ffb347';
      const c2 = card?.accents?.color2 || '#ff6b6b';
      const { bodyEl } = buildCardLayout(contentEl, '注入包池', c1, c2);
      bodyEl.style.cssText = 'flex:1;display:flex;flex-direction:column;gap:8px;padding:0 10px;overflow-y:auto;touch-action:pan-y';

      // 名称行（新建用）
      const { row: nameRow, wrap: nameWrap } = mkRow('名称');
      const nameInput = document.createElement('input');
      nameInput.style.cssText = inputStyle();
      nameInput.placeholder = '注入包名称（存为 .kfmv4/injects/<名>.md）';
      nameWrap.appendChild(nameInput);
      bodyEl.appendChild(nameRow);

      // 内容编辑区
      const { row: contentRow, wrap: contentWrap } = mkRow('内容');
      const contentArea = document.createElement('textarea');
      contentArea.style.cssText = inputStyle() + ';min-height:120px;resize:vertical;font-family:monospace';
      contentArea.placeholder = '注入包内容：拼进会话首条消息前的行为规范';
      contentWrap.appendChild(contentArea);
      bodyEl.appendChild(contentRow);

      // 按钮
      const btnRow = document.createElement('div');
      btnRow.style.cssText = 'display:flex;gap:6px;margin-bottom:8px;flex-shrink:0';
      const saveBtn = document.createElement('button');
      saveBtn.style.cssText = btnStyle(c1);
      saveBtn.textContent = '保存';
      const delBtn = document.createElement('button');
      delBtn.style.cssText = btnStyle('#ff6b6b');
      delBtn.textContent = '删除';
      const refreshBtn = document.createElement('button');
      refreshBtn.style.cssText = btnStyle(c2);
      refreshBtn.textContent = '刷新';
      btnRow.appendChild(saveBtn);
      btnRow.appendChild(delBtn);
      btnRow.appendChild(refreshBtn);
      bodyEl.appendChild(btnRow);

      // 池列表
      const poolTitle = document.createElement('div');
      poolTitle.style.cssText = 'font-size:var(--card-font-size,11px);font-weight:700;color:rgba(255,255,255,0.85);margin-bottom:6px';
      poolTitle.textContent = '注入包池（.kfmv4/injects/）';
      bodyEl.appendChild(poolTitle);
      const listEl = document.createElement('div');
      listEl.style.cssText = 'flex-shrink:0';
      bodyEl.appendChild(listEl);

      async function load(): Promise<void> {
        files = (await listDir(INJECTS_PATH)).filter(f => f.endsWith('.md')).sort();
        render();
      }

      async function select(name: string): Promise<void> {
        selected = name;
        const content = await readFile(`${INJECTS_PATH}/${name}.md`);
        nameInput.value = name.replace(/\.md$/, '');
        contentArea.value = content || '';
        render();
      }

      function render(): void {
        listEl.innerHTML = '';
        if (files.length === 0) {
          const empty = document.createElement('div');
          empty.style.cssText = 'font-size:var(--card-font-size,11px);color:rgba(255,255,255,0.5);text-align:center;padding:10px 0';
          empty.textContent = '暂无注入包——新建一个（如复制 evidence-discipline）';
          listEl.appendChild(empty);
          return;
        }
        for (const f of files) {
          const name = f.replace(/\.md$/, '');
          const item = document.createElement('div');
          item.style.cssText = `padding:6px 8px;margin-bottom:4px;border-radius:6px;cursor:pointer;border:1px solid transparent;border-left-width:3px;background:rgba(255,255,255,0.03);transition:all 0.15s`;
          if (name === selected) item.style.borderColor = c1;
          item.textContent = name;
          item.onclick = () => select(name);
          listEl.appendChild(item);
        }
      }

      saveBtn.onclick = async () => {
        const name = nameInput.value.trim();
        if (!name) { alert('请输入注入包名称'); return; }
        // 重命名/新建：若当前 selected 存在且名称变了 → 删旧写新（简化为写新文件）
        await writeFile(`${INJECTS_PATH}/${name}.md`, contentArea.value);
        selected = name;
        await load();
      };

      delBtn.onclick = async () => {
        if (!selected) { alert('先选择一个注入包'); return; }
        const ok = await showConfirm({
          title: '删除注入包',
          message: `确定删除「${selected}」？`,
          accent: c1,
          accent2: c2,
          confirmText: '删除',
          cancelText: '取消',
        });
        if (ok) {
          await deleteFile(`${INJECTS_PATH}/${selected}.md`);
          selected = '';
          nameInput.value = '';
          contentArea.value = '';
          await load();
        }
      };

      refreshBtn.onclick = () => { if (selected) select(selected); else load(); };

      await load();
    },

    deactivate(contentEl) {
      contentEl.innerHTML = '';
    },
  };
}

registerCardType({
  typeId: 'inject',
  icon: '\uD83D\uDCE6',
  name: '注入包',
  description: '注入包池管理（行为预设，供配置卡引用）',
  kind: 'tool',
  createHandler: createInjectHandler,
});
