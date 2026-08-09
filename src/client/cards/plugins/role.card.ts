/**
 * role.card.ts — AI 角色管理卡
 *
 * 管理 AI 角色配置文件（人设、性格、偏好）。
 * 类似 API 卡结构：顶部选择器 + 编辑表单 + 池列表。
 * 数据存储于 .kfmv4/agents/roles/ 文件夹。
 */

import { registerCardType, type CardContentHandler } from '../../modules/card-registry.js';
import { buildCardLayout } from '../../modules/floating-card.js';
import { log } from '../../modules/logger.js';
import { createCustomSelect, type CustomSelect } from '../../modules/custom-select.js';
import { showConfirm } from '../../modules/confirm-dialog.js';
import { selectFilesForPrompt } from '../../modules/tree-swipe.js';
import { loadFileTree } from '../../modules/tree-loader.js';
import { KFMState } from '../../modules/state.js';
import { innerCardStyle, inputStyle, btnStyle, mkRow } from '../card-ui.js';

interface Role {
  id: string;
  name: string;
  promptFiles: string[];
  dynamicPromptFiles: string[];
  createdAt: string;
  updatedAt: string;
}

const ROLES_PATH = '.kfmv4/agents/roles';
const ACTIVE_ROLE_PATH = '.kfmv4/active.json';

// ====== API 基础 ======

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
  } catch (e) { log('[Role] readFile 操作失败: ' + (e instanceof Error ? e.message : String(e))); return null; }
}

async function writeFile(path: string, content: string): Promise<void> {
  try {
    await fetch(API_BASE + 'files/write', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, content }),
    });
  } catch (e) { log('[Role] writeFile error:', e); }
}

async function deleteFile(path: string): Promise<void> {
  try {
    await fetch(API_BASE + 'files/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    });
  } catch (e) { log('[Role] deleteFile error:', e); }
}

async function renameFile(oldPath: string, newName: string): Promise<void> {
  try {
    const res = await fetch(API_BASE + 'files/rename', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: oldPath, newName }),
    });
    const data = await res.json();
    if (!data.success) {
      log('[Role] renameFile 失败: ' + (data.error || 'unknown') + ' | ' + oldPath + ' → ' + newName);
    }
  } catch (e) { log('[Role] renameFile 异常: ' + (e instanceof Error ? e.message : String(e))); }
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
  } catch (e) { log('[Role] listDir 操作失败: ' + (e instanceof Error ? e.message : String(e))); return []; }
}

async function loadRoles(): Promise<Role[]> {
  const files = await listDir(ROLES_PATH);
  const roles: Role[] = [];
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const name = file.slice(0, -5);
    const content = await readFile(`${ROLES_PATH}/${file}`);
    let promptFiles: string[] = [];
    let dynamicPromptFiles: string[] = [];
    let createdAt = '';
    let updatedAt = '';
    if (content) {
      try {
        const data = JSON.parse(content);
        promptFiles = data.promptFiles || [];
        dynamicPromptFiles = data.dynamicPromptFiles || [];
        createdAt = data.createdAt || '';
        updatedAt = data.updatedAt || '';
      } catch (e) { log('[Role] loadRoles JSON 解析失败 (' + name + '): ' + (e instanceof Error ? e.message : String(e))); }
    }
    roles.push({ id: name, name, promptFiles, dynamicPromptFiles, createdAt, updatedAt });
  }
  roles.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return roles;
}



// ====== 文本色系（遵循 §10.2.1 规范） ======

const TXT_TITLE = 'rgba(255,255,255,0.85)';
const TXT_SUB = 'rgba(255,255,255,0.5)';

// ====== DOM 辅助 ======

// ====== 卡片处理器 ======

function createRoleHandler(meta: Record<string, unknown>): CardContentHandler {
  let roles: Role[] = [];
  let currentRoleId = '';
  // 当前激活角色（active.json roleFile）——面板切角色时 kfm-role-change 更新；编辑器
  // 语义的 currentRoleId 与其独立（2026-08-09 断点修复：卡侧激活标记）
  let activeRoleFile = '';
  let editingRole: Role | null = null;
  let roleSelect: CustomSelect | null = null;
  let _onRoleChange: ((e: Event) => void) | null = null;
  let _nameInput: HTMLInputElement | null = null;

  function getCurrentRole(): Role | null {
    return roles.find(r => r.id === currentRoleId) || null;
  }

  function _roleFileName(role: Role): string {
    return role.name + '.json';
  }

  async function saveRole(role: Role, oldName?: string): Promise<void> {
    const newFile = _roleFileName(role);
    if (oldName) {
      const oldFile = _roleFileName({ ...role, name: oldName });
      if (oldFile !== newFile) {
        await renameFile(`${ROLES_PATH}/${oldFile}`, newFile);
      }
    }
    await writeFile(`${ROLES_PATH}/${newFile}`, JSON.stringify(role, null, 2));
    loadFileTree(KFMState.currentRoot);
  }

  async function deleteRole(id: string): Promise<void> {
    const role = roles.find(r => r.id === id);
    if (!role) return;
    await deleteFile(`${ROLES_PATH}/${_roleFileName(role)}`);
    roles = roles.filter(r => r.id !== id);
    loadFileTree(KFMState.currentRoot);
  }

  let _c1 = '#00d4ff';
  let _c2 = '#7c3aed';
  let _renderPromptFiles: (() => void) | null = null;
  function fillEditor(role: Role | null): void {
    editingRole = role;
    const nameInput = _nameInput;
    if (!nameInput) return;
    
    if (role) {
      nameInput.value = role.name;
    } else {
      nameInput.value = '';
    }
    // 委托给 renderPromptFiles
    _renderPromptFiles?.();
  }

  function renderPoolList(listEl: HTMLElement, c1: string, c2: string): void {
    listEl.innerHTML = '';

    if (roles.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'font-size:var(--card-font-size,11px);color:' + TXT_SUB + ';text-align:center;padding:10px 0';
      empty.textContent = '暂无角色';
      listEl.appendChild(empty);
      return;
    }

    for (const role of roles) {
      const item = document.createElement('div');
      item.style.cssText = 'padding:6px 8px;margin-bottom:4px;border-radius:6px;cursor:pointer;border:1px solid transparent;border-left-width:3px;background:rgba(255,255,255,0.03);transition:all 0.15s;position:relative';

      if (role.id === currentRoleId) {
        item.style.background = 'linear-gradient(rgba(10,10,15,0.92),rgba(10,10,15,0.92)) padding-box,linear-gradient(135deg,' + c1 + ' 30%,' + c2 + ' 70%) border-box';
        item.style.borderColor = 'transparent';
      }

      const titleRow = document.createElement('div');
      titleRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between';
      
      const title = document.createElement('div');
      title.style.cssText = 'font-size:var(--card-font-size,11px);color:' + TXT_TITLE + ';font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1';
      title.textContent = role.name;
      // 当前激活角色标记（active.json roleFile）——面板切角色经 kfm-role-change 更新
      if (role.id === activeRoleFile) {
        const act = document.createElement('span');
        act.textContent = '当前';
        act.style.cssText = 'font-size:var(--card-font-size,9px);color:#000;background:linear-gradient(135deg,' + c1 + ',' + c2 + ');border-radius:3px;padding:0 4px;margin-left:6px;flex-shrink:0';
        title.appendChild(act);
      }
      
      const delBtn = document.createElement('span');
      delBtn.textContent = '\u2715';
      delBtn.style.cssText = 'position:absolute;right:8px;top:50%;transform:translateY(-50%);font-size:12px;color:rgba(255,100,100,0.6);cursor:pointer';
      delBtn.textContent = '\u2715';
      delBtn.onmouseenter = () => { delBtn.style.color = 'rgba(255,100,100,1)'; };
      delBtn.onmouseleave = () => { delBtn.style.color = 'rgba(255,100,100,0.6)'; };
      delBtn.onclick = async (e: MouseEvent) => {
        e.stopPropagation();
        const confirmed = await showConfirm({
          title: '删除角色',
          message: '\u786E\u5B9A\u5220\u9664\u89D2\u8272\u300C' + role.name + '\u300D\uFF1F',
          accent: c1,
          accent2: c2,
          confirmText: '\u5220\u9664',
          cancelText: '\u53D6\u6D88',
        });
        if (confirmed) {
          await deleteRole(role.id);
          if (currentRoleId === role.id) {
            currentRoleId = roles[0]?.id || '';
            fillEditor(getCurrentRole());
          }
          renderPoolList(listEl, c1, c2);
          roleSelect?.updateItems(roles.map(r => ({ label: r.name, value: r.id })), currentRoleId);
        }
      };
      
      titleRow.appendChild(title);
      titleRow.appendChild(delBtn);
      
      const metaRow = document.createElement('div');
      metaRow.style.cssText = 'display:flex;gap:8px;font-size:var(--card-font-size,9px);color:' + TXT_SUB + '';
      
      const desc = document.createElement('span');
      const sCount = role.promptFiles?.length || 0;
      const dCount = role.dynamicPromptFiles?.length || 0;
      const parts: string[] = [];
      if (sCount > 0) parts.push(sCount + ' 个静态');
      if (dCount > 0) parts.push(dCount + ' 个动态');
      desc.textContent = parts.length > 0 ? parts.join(' + ') : '无提示词';
      
      metaRow.appendChild(desc);
      
      item.appendChild(titleRow);
      item.appendChild(metaRow);
      
      item.onmouseenter = () => {
        if (role.id !== currentRoleId) {
          item.style.background = 'rgba(255,255,255,0.06)';
        }
      };
      item.onmouseleave = () => {
        if (role.id !== currentRoleId) {
          item.style.background = 'rgba(255,255,255,0.03)';
        }
      };
      item.onclick = () => {
        currentRoleId = role.id;
        fillEditor(role);
        renderPoolList(listEl, c1, c2);
        roleSelect?.updateItems(roles.map(r => ({ label: r.name, value: r.id })), currentRoleId);
      };
      
      listEl.appendChild(item);
    }
  }

  return {
    async activate(contentEl, card, reason) {
      const c1 = card?.accents?.color1 || '#00d4ff';
      const c2 = card?.accents?.color2 || '#7c3aed';
      _c1 = c1;
      _c2 = c2;
      const { bodyEl } = buildCardLayout(contentEl, '\u89D2\u8272\u7BA1\u7406', c1, c2);
      
      bodyEl.style.cssText = 'flex:1;display:flex;flex-direction:column;gap:8px;padding:0 10px;overflow-y:auto;touch-action:pan-y';
      
      // 加载角色列表，聚焦第一个
      roles = await loadRoles();
      currentRoleId = roles[0]?.id || '';
      // 当前激活角色（active.json roleFile）——池列表标记用，独立于编辑目标
      try {
        const raw = await readFile(ACTIVE_ROLE_PATH);
        if (raw) { const j = JSON.parse(raw); activeRoleFile = j.roleFile || ''; }
      } catch (e) { activeRoleFile = ''; }
      
      // 如果没有默认角色，创建内置默认角色
      if (roles.length === 0) {
        const defaultRole: Role = {
          id: '\u9ED8\u8BA4\u52A9\u624B',
          name: '\u9ED8\u8BA4\u52A9\u624B',
          promptFiles: [],
          dynamicPromptFiles: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        roles.push(defaultRole);
        await saveRole(defaultRole);
        currentRoleId = defaultRole.id;
      }
      
      // 编辑表单（内卡样式）
      const formSection = document.createElement('div');
      formSection.style.cssText = innerCardStyle(c1, c2) + ';margin-top:6px;display:flex;flex-direction:column;flex:1 1 50%;min-height:0';
      
      // 顶部选择器（在卡片内部）
      const { row: roleRow, wrap: roleWrap } = mkRow('\u89D2\u8272');
      roleSelect = createCustomSelect({
        accent: c1,
        placeholder: '\u9009\u62E9\u89D2\u8272',
        minWidth: 100,
        onSelect: (id) => {
          currentRoleId = id;
          fillEditor(getCurrentRole());
          renderPoolList(poolListEl, c1, c2);
        },
      });
      const formScroll = document.createElement('div');
      formScroll.style.cssText = 'flex:1;overflow-y:auto;min-height:0;touch-action:pan-y';
      roleWrap.appendChild(roleSelect.element);
      formScroll.appendChild(roleRow);
      
      // 角色名
      const { row: nameRow, wrap: nameWrap } = mkRow('名称');
      _nameInput = document.createElement('input');
      _nameInput.style.cssText = inputStyle();
      _nameInput.placeholder = '角色名称';
      nameWrap.appendChild(_nameInput);
      formScroll.appendChild(nameRow);
      
      // ====== 双栏提示词文件（静态 + 动态） ======

      const staticLabel = document.createElement('div');
      staticLabel.style.cssText = 'font-size:var(--card-font-size,10px);color:' + TXT_SUB + ';margin-top:6px;margin-bottom:4px';
      staticLabel.textContent = '静态提示词';

      const staticFilesEl = document.createElement('div');
      staticFilesEl.style.cssText = 'display:flex;flex-direction:column;gap:7px;min-height:20px;border-radius:8px;padding:2px;transition:outline 0.15s';

      const dynamicLabel = document.createElement('div');
      dynamicLabel.style.cssText = 'font-size:var(--card-font-size,10px);color:' + c2 + ';margin-top:10px;margin-bottom:4px';
      dynamicLabel.textContent = '动态反馈（每轮工具调用后刷新）';

      const dynamicFilesEl = document.createElement('div');
      dynamicFilesEl.style.cssText = 'display:flex;flex-direction:column;gap:7px;min-height:20px;border-radius:8px;padding:2px;transition:outline 0.15s';

      function _pathDisplay(filePath: string): string {
        return filePath;
      }

      // 跨栏拖拽状态
      let dragCard: HTMLElement | null = null;
      let dragStartY = 0;
      let dragOffY = 0;
      let dragSource: 'static' | 'dynamic' = 'static';
      let dragOrigIdx = -1;
      let dragOverTarget: 'static' | 'dynamic' | null = null;

      function highlightDropZone(target: 'static' | 'dynamic' | null): void {
        const accent = c1 + '60';
        staticFilesEl.style.outline = target === 'static' ? '2px dashed ' + accent : 'none';
        dynamicFilesEl.style.outline = target === 'dynamic' ? '2px dashed ' + c2 + '60' : 'none';
      }

      function onPointerMove(e: PointerEvent): void {
        if (!dragCard) return;
        dragOffY = e.clientY - dragStartY;
        dragCard.style.transform = 'scale(1.04) translateY(' + dragOffY + 'px)';

        // 检测是否越过另一栏
        const otherEl = dragSource === 'static' ? dynamicFilesEl : staticFilesEl;
        const otherZone = dragSource === 'static' ? 'dynamic' : 'static';
        const rect = otherEl.getBoundingClientRect();
        if (e.clientY >= rect.top - 10 && e.clientY <= rect.bottom + 10) {
          if (dragOverTarget !== otherZone) { dragOverTarget = otherZone; highlightDropZone(otherZone); }
        } else {
          // 同栏排序
          if (dragOverTarget !== null) { dragOverTarget = null; highlightDropZone(null); }
          const container = dragSource === 'static' ? staticFilesEl : dynamicFilesEl;
          const cards = Array.from(container.children).filter(c => c !== dragCard) as HTMLElement[];
          const cardH = dragCard.offsetHeight + 7;
          const targetIdx = Math.max(0, Math.min(cards.length,
            Math.round((dragOrigIdx * cardH + dragOffY) / cardH)));
          cards.forEach((c, i) => {
            const shouldShift =
              (dragOrigIdx < targetIdx && i >= dragOrigIdx && i < targetIdx) ||
              (dragOrigIdx > targetIdx && i >= targetIdx && i < dragOrigIdx);
            if (shouldShift) {
              const dir = dragOrigIdx < targetIdx ? -cardH : cardH;
              c.style.transition = 'transform 0.15s';
              c.style.transform = 'translateY(' + dir + 'px)';
            } else {
              c.style.transition = 'transform 0.15s';
              c.style.transform = '';
            }
          });
        }
      }

      function onPointerUp(e: PointerEvent): void {
        if (!dragCard) return;
        (e.target as HTMLElement)?.releasePointerCapture?.(e.pointerId);

        dragCard.style.transition = 'transform 0.25s cubic-bezier(0.34,1.56,0.64,1)';
        dragCard.style.transform = 'scale(1)';
        dragCard.style.boxShadow = '';
        dragCard.style.zIndex = '';
        dragCard.style.cursor = '';
        highlightDropZone(null);

        const container = dragSource === 'static' ? staticFilesEl : dynamicFilesEl;
        const cards = Array.from(container.children) as HTMLElement[];
        cards.forEach(c => { c.style.transform = ''; c.style.transition = ''; c.style.zIndex = ''; c.style.boxShadow = ''; });

        const role = editingRole;
        if (!role) { dragCard = null; return; }

        if (dragOverTarget && dragOverTarget !== dragSource) {
          // 跨栏移动
          const srcArr = dragSource === 'static' ? role.promptFiles : role.dynamicPromptFiles;
          const dstArr = dragOverTarget === 'static' ? role.promptFiles : role.dynamicPromptFiles;
          const [moved] = srcArr.splice(dragOrigIdx, 1);
          dstArr.push(moved);
          saveRole(role).then(() => _renderPromptFiles?.());
        } else {
          // 同栏排序
          const cardH = dragCard.offsetHeight + 7;
          const targetIdx = Math.max(0, Math.min(cards.length - 1,
            Math.round((dragOrigIdx * cardH + dragOffY) / cardH)));
          if (targetIdx !== dragOrigIdx) {
            const files = dragSource === 'static' ? role.promptFiles : role.dynamicPromptFiles;
            const [moved] = files.splice(dragOrigIdx, 1);
            files.splice(targetIdx, 0, moved);
            saveRole(role).then(() => _renderPromptFiles?.());
          }
        }

        dragCard = null;
        dragOverTarget = null;
      }

      function createFileCard(filePath: string, origIdx: number, source: 'static' | 'dynamic', c1: string, c2: string): HTMLElement {
        const card = document.createElement('div');
        card.style.cssText = 'border-radius:8px;padding:1px;padding-left:3px;margin-bottom:7px;' +
          'background:linear-gradient(135deg,' + c1 + ' 30%,' + c2 + ' 70%);' +
          'transition:transform 0.15s';

        const inner = document.createElement('div');
        inner.style.cssText = 'display:flex;align-items:stretch;border-radius:6px;height:78px;overflow:hidden;' +
          'background:linear-gradient(rgba(10,10,15,0.94),rgba(10,10,15,0.94))';

        // 拖拽柄
        const handle = document.createElement('div');
        handle.style.cssText = 'display:flex;align-items:stretch;' +
          'width:24px;flex-shrink:0;cursor:grab;user-select:none;padding:4px 3px 4px 4px;touch-action:none';
        handle.addEventListener('pointerdown', (e: PointerEvent) => {
          handle.setPointerCapture(e.pointerId);
          dragCard = card;
          dragStartY = e.clientY;
          dragOrigIdx = origIdx;
          dragOffY = 0;
          dragSource = source;
          card.style.transition = 'transform 0.12s ease-out';
          card.style.transform = 'scale(1.04)';
          card.style.boxShadow = '0 8px 32px rgba(0,0,0,0.55),0 0 0 1px ' + c1 + '30';
          card.style.zIndex = '10'; // zindex-ok: 拖拽项在兄弟列表内抬升，局部 stacking 非全局层
          card.style.cursor = 'grabbing';
        });
        handle.addEventListener('pointermove', onPointerMove);
        handle.addEventListener('pointerup', onPointerUp);
        handle.addEventListener('pointercancel', onPointerUp);

        const handleCard = document.createElement('div');
        handleCard.style.cssText = 'display:flex;align-items:center;justify-content:center;flex:1;' +
          'border-radius:4px;' +
          'background:linear-gradient(rgba(12,12,18,0.92),rgba(12,12,18,0.92)) padding-box,' +
          'linear-gradient(180deg,' + c2 + ' 30%,' + c1 + ' 70%) border-box;' +
          'border:1px solid transparent;border-top-width:3px;pointer-events:none';
        const dots = document.createElement('div');
        dots.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:3px;padding:2px 0';
        for (let i = 0; i < 14; i++) {
          const dot = document.createElement('span');
          dot.style.cssText = 'width:3px;height:3px;border-radius:50%;background:' + c1 + ';opacity:0.6;display:block;margin:auto';
          dots.appendChild(dot);
        }
        handleCard.appendChild(dots);
        handle.appendChild(handleCard);

        // 内容区
        const body = document.createElement('div');
        body.style.cssText = 'flex:1;padding:3px 10px 8px 10px;min-width:0;overflow:hidden;' +
          'display:flex;flex-direction:column';
        const pathEl = document.createElement('div');
        pathEl.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex-shrink:0;direction:rtl';
        const pathSpan = document.createElement('span');
        pathSpan.style.cssText = 'font-size:var(--card-font-size,11px);font-weight:600;' +
          'color:' + TXT_TITLE + ';direction:ltr;unicode-bidi:plaintext';
        pathSpan.textContent = _pathDisplay(filePath);
        pathEl.appendChild(pathSpan);
        const previewEl = document.createElement('div');
        previewEl.style.cssText = 'font-size:var(--card-font-size,9px);color:' + TXT_SUB + ';' +
          'line-height:1.4;margin-top:2px;overflow:hidden;flex:1';

        readFile(filePath).then(content => {
          if (content) {
            const preview = content.trimStart().split('\n').slice(0, 20).join('\n');
            previewEl.textContent = preview || '(空文件)';
          } else {
            previewEl.textContent = '(无法读取)';
          }
        }).catch(() => { previewEl.textContent = '(无法读取)'; });

        body.appendChild(pathEl);
        body.appendChild(previewEl);

        const removeBtn = document.createElement('div');
        removeBtn.style.cssText = 'display:flex;align-items:flex-start;padding:3px 5px 0 0;flex-shrink:0;' +
          'font-size:10px;color:rgba(255,100,100,0.5);cursor:pointer';
        removeBtn.textContent = '\u2715';
        removeBtn.onclick = async (e: MouseEvent) => {
          e.stopPropagation();
          if (!editingRole) return;
          if (source === 'static') {
            editingRole.promptFiles = editingRole.promptFiles.filter(f => f !== filePath);
          } else {
            editingRole.dynamicPromptFiles = editingRole.dynamicPromptFiles.filter(f => f !== filePath);
          }
          await saveRole(editingRole);
          _renderPromptFiles?.();
        };

        inner.appendChild(handle);
        inner.appendChild(body);
        inner.appendChild(removeBtn);
        card.appendChild(inner);
        return card;
      }

      function renderPromptFiles(): void {
        staticFilesEl.innerHTML = '';
        dynamicFilesEl.innerHTML = '';
        const role = getCurrentRole();
        if (!role) return;

        for (let i = 0; i < (role.promptFiles || []).length; i++) {
          staticFilesEl.appendChild(createFileCard(role.promptFiles[i], i, 'static', c1, c2));
        }
        for (let i = 0; i < (role.dynamicPromptFiles || []).length; i++) {
          dynamicFilesEl.appendChild(createFileCard(role.dynamicPromptFiles[i], i, 'dynamic', c1, c2));
        }
      }

      // 静态栏添加按钮
      const addStaticBtn = document.createElement('div');
      addStaticBtn.style.cssText = 'border-radius:8px;padding:1px;padding-left:3px;margin-bottom:7px;' +
        'background:linear-gradient(135deg,' + c1 + ' 30%,' + c2 + ' 70%);cursor:pointer';
      const addStaticInner = document.createElement('div');
      addStaticInner.style.cssText = 'display:flex;align-items:center;justify-content:center;' +
        'border-radius:6px;min-height:32px;' +
        'background:linear-gradient(rgba(10,10,15,0.94),rgba(10,10,15,0.94))';
      addStaticInner.innerHTML = '<span style="font-size:20px;color:' + c1 + ';opacity:0.5;line-height:1">+</span>';
      addStaticBtn.appendChild(addStaticInner);
      addStaticBtn.onclick = () => {
        const role = getCurrentRole();
        if (!role) return;
        selectFilesForPrompt(
          (paths) => {
            if (!editingRole) return;
            const existing = new Set([...(editingRole.promptFiles || []), ...(editingRole.dynamicPromptFiles || [])]);
            for (const p of paths) {
              if (!existing.has(p)) editingRole.promptFiles.push(p);
            }
            saveRole(editingRole).then(() => {
              _renderPromptFiles?.();
              renderPoolList(poolListEl, c1, c2);
            });
          },
          c1, c2
        );
      };

      // 动态栏添加按钮
      const addDynamicBtn = document.createElement('div');
      addDynamicBtn.style.cssText = 'border-radius:8px;padding:1px;padding-left:3px;margin-bottom:7px;' +
        'background:linear-gradient(135deg,' + c2 + ' 30%,' + c1 + ' 70%);cursor:pointer';
      const addDynamicInner = document.createElement('div');
      addDynamicInner.style.cssText = 'display:flex;align-items:center;justify-content:center;' +
        'border-radius:6px;min-height:32px;' +
        'background:linear-gradient(rgba(10,10,15,0.94),rgba(10,10,15,0.94))';
      addDynamicInner.innerHTML = '<span style="font-size:20px;color:' + c2 + ';opacity:0.5;line-height:1">+</span>';
      addDynamicBtn.appendChild(addDynamicInner);
      addDynamicBtn.onclick = () => {
        const role = getCurrentRole();
        if (!role) return;
        selectFilesForPrompt(
          (paths) => {
            if (!editingRole) return;
            const existing = new Set([...(editingRole.promptFiles || []), ...(editingRole.dynamicPromptFiles || [])]);
            for (const p of paths) {
              if (!existing.has(p)) editingRole.dynamicPromptFiles.push(p);
            }
            saveRole(editingRole).then(() => {
              _renderPromptFiles?.();
              renderPoolList(poolListEl, c1, c2);
            });
          },
          c1, c2
        );
      };

      formScroll.appendChild(staticLabel);
      formScroll.appendChild(staticFilesEl);
      formScroll.appendChild(addStaticBtn);
      formScroll.appendChild(dynamicLabel);
      formScroll.appendChild(dynamicFilesEl);
      formScroll.appendChild(addDynamicBtn);
      _renderPromptFiles = renderPromptFiles;
      renderPromptFiles();

      // 操作按钮（在 formSection 内部）
      const btnRow = document.createElement('div');
      btnRow.style.cssText = 'display:flex;gap:6px;margin-top:8px;flex-shrink:0';

      const saveBtn = document.createElement('button');
      saveBtn.style.cssText = btnStyle(c1);
      saveBtn.textContent = '\u4FDD\u5B58';
      saveBtn.onclick = async () => {
        if (!editingRole) return;
        const name = _nameInput?.value.trim() || '';
        if (!name) { return; }
        const oldName = editingRole.name;
        const oldId = editingRole.id;
        editingRole.name = name;
        editingRole.id = name;
        editingRole.updatedAt = new Date().toISOString();
        await saveRole(editingRole, oldName);
        roles = roles.map(r => r.id === oldId ? editingRole! : r);
        if (currentRoleId === oldId) currentRoleId = name;
        saveBtn.textContent = '\u2713 \u5DF2\u4FDD\u5B58';
        saveBtn.style.color = 'rgba(0,212,80,0.9)';
        saveBtn.style.borderColor = 'rgba(0,212,80,0.4)';
        setTimeout(() => {
          saveBtn.textContent = '\u4FDD\u5B58';
          saveBtn.style.color = c1;
          saveBtn.style.borderColor = c1 + '40';
        }, 1500);
      };

      const newBtn = document.createElement('button');
      newBtn.style.cssText = btnStyle(c2);
      newBtn.textContent = '\u65B0\u5EFA';
      newBtn.onclick = async () => {
        const newRole: Role = { id: '\u65B0\u89D2\u8272', name: '\u65B0\u89D2\u8272', promptFiles: [], dynamicPromptFiles: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        roles.unshift(newRole);
        await saveRole(newRole);
        currentRoleId = newRole.id;
        fillEditor(newRole);
      };

      btnRow.appendChild(saveBtn);
      btnRow.appendChild(newBtn);
      formSection.appendChild(formScroll);
      formSection.appendChild(btnRow);

      bodyEl.appendChild(formSection);

      // 池列表（内卡样式）
      const poolCard = document.createElement('div');
      poolCard.style.cssText = innerCardStyle(c1, c2) + ';flex:1 1 50%;min-height:0;overflow-y:auto';
      
      const poolTitle = document.createElement('div');
      poolTitle.style.cssText = 'font-size:var(--card-font-size,11px);font-weight:700;color:' + TXT_TITLE + ';margin-bottom:6px';
      poolTitle.textContent = '\u89D2\u8272\u6C60';
      poolCard.appendChild(poolTitle);
      
      const poolListEl = document.createElement('div');
      poolListEl.style.cssText = 'flex-shrink:0';
      poolCard.appendChild(poolListEl);
      bodyEl.appendChild(poolCard);
      
      // 初始化
      roleSelect.updateItems(roles.map(r => ({ label: r.name, value: r.id })), currentRoleId);
      fillEditor(getCurrentRole());
      renderPoolList(poolListEl, c1, c2);

      // 监听面板/外部切角色（kfm-role-change）→ 更新激活标记并重绘池
      if (_onRoleChange) window.removeEventListener('kfm-role-change', _onRoleChange);
      _onRoleChange = (e: Event) => {
        const roleId = (e as CustomEvent).detail?.roleId;
        if (!roleId) return;
        activeRoleFile = roleId;
        renderPoolList(poolListEl, c1, c2);
      };
      window.addEventListener('kfm-role-change', _onRoleChange);
    },

    deactivate(contentEl) {
      if (_onRoleChange) {
        window.removeEventListener('kfm-role-change', _onRoleChange);
        _onRoleChange = null;
      }
      roleSelect?.destroy();
      roleSelect = null;
      contentEl.innerHTML = '';
    },
  };
}

registerCardType({
  typeId: 'role',
  icon: '\uD83C\uDFAD',
  name: '\u89D2\u8272',
  description: 'AI \u89D2\u8272\u7BA1\u7406',
  kind: 'tool',
  createHandler: createRoleHandler,
});
