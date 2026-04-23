/**
 * KFM v4 - 文件树加载与渲染
 */
import { API, expandedPaths, showHidden, selectedFile, setExpandedPaths, setSelectedFile } from './app.js';

const heightCache: Record<string, number> = {};
const newAnimThreshold = 5;
const newAnimChildCount = 4;

interface TreeItem {
  name: string;
  isDir: boolean;
  isLink: boolean;
  path: string;
}

function shouldUseNewAnim(depth: number, childCount: number): boolean {
  return depth >= newAnimThreshold && childCount > newAnimChildCount;
}

// 加载文件列表
async function loadTree(path = ''): Promise<TreeItem[]> {
  let targetPath = path || '/root';
  if (targetPath.startsWith('~')) targetPath = '/root' + (targetPath.length > 1 ? targetPath.slice(1) : '');

  try {
    const res = await fetch(API + '/files/list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: targetPath, showHidden }),
    });
    const data = await res.json();
    if (data.error) return [];
    return data.items.map((item: any) => ({
      name: item.name,
      isDir: item.isDir,
      isLink: false,
      path: item.path,
    }));
  } catch (e) {
    console.error('loadTree error:', e);
    return [];
  }
}

// 渲染文件树
export async function renderTree(container: HTMLElement = document.getElementById('fileTree')!, path = '', depth = 0): Promise<void> {
  let savedPath: string | null = null;
  if (depth === 0) {
    const savedSelected = document.querySelector('.tree-item.selected') as HTMLElement | null;
    savedPath = savedSelected?.dataset?.path || null;
    (window as any).resetCursorHighlight?.();
    container.innerHTML = '<div class="loading-pulse"><div class="pulse-row"></div><div class="pulse-row"></div><div class="pulse-row"></div></div>';
  }

  const items = await loadTree(path);
  container.innerHTML = '';
  const frag = document.createDocumentFragment();

  for (const item of items) {
    const div = document.createElement('div');
    div.className = 'tree-item';
    div.dataset.path = item.path;

    const row = document.createElement('div');
    row.className = 'tree-row';

    const toggle = document.createElement('span');
    toggle.className = 'tree-toggle' + (expandedPaths[item.path] ? ' expanded' : '');
    if (!item.isDir) toggle.classList.add('hidden');

    const name = document.createElement('span');
    name.className = 'tree-name' + (item.isLink ? ' link' : '');
    name.textContent = item.name + (item.isLink ? ' →' : '');

    row.append(toggle, name);
    div.appendChild(row);

    const wrap = document.createElement('div');
    wrap.className = 'tree-children-wrap';
    const maxDepth = 6;
    const depthRatio = Math.min(depth / maxDepth, 1);
    const opacity = 0.15 + depthRatio * 0.85;
    wrap.style.borderColor = `rgba(124,58,237,${opacity})`;

    const inner = document.createElement('div');
    const bgTop = `rgba(124,58,237,${0.01 + depthRatio * 0.1})`;
    const bgBot = `rgba(124,58,237,${0.06 + depthRatio * 0.25})`;
    inner.style.background = `linear-gradient(to bottom,${bgTop},${bgBot})`;

    const childrenWrap = document.createElement('div');
    if (expandedPaths[item.path]) {
      wrap.classList.add('open');
      toggle.classList.add('expanded');
    }
    wrap.appendChild(inner);
    inner.appendChild(childrenWrap);
    div.appendChild(wrap);
    frag.appendChild(div);

    // 预加载已展开的子目录
    if (expandedPaths[item.path] && item.isDir) renderTree(childrenWrap, item.path, depth + 1);

    // 点击事件
    row.addEventListener('click', async (e) => {
      const isCurrentlySelected = div.classList.contains('selected');

      if (isCurrentlySelected) {
        if (item.isDir) {
          const isOpen = wrap.classList.contains('open');
          if (!isOpen && !childrenWrap.querySelector('.tree-item')) {
            await renderTree(childrenWrap, item.path, depth + 1);
          }
          wrap.classList.toggle('open');
          toggle.classList.toggle('expanded');
          const newPaths = { ...expandedPaths };
          newPaths[item.path] = !isOpen;
          setExpandedPaths(newPaths);
          localStorage.setItem('expandedPaths', JSON.stringify(newPaths));

          // 叠叠乐动画
          const doBounce = (el: HTMLElement, dir: boolean, delay: number) => {
            setTimeout(() => {
              const offset = dir ? -10 : 10;
              const rebound = dir ? 2 : -2;
              el.style.transition = 'transform .3s cubic-bezier(.34,1.56,.64,1)';
              el.style.transform = `translateY(${offset}px)`;
              setTimeout(() => { el.style.transform = `translateY(${rebound}px)`; }, 320);
              setTimeout(() => { el.style.transform = ''; el.style.transition = ''; }, 450);
            }, delay);
          };
          if (isOpen) {
            doBounce(div, true, 0);
            let sibling = div.nextElementSibling; let i = 1;
            while (sibling) { if (sibling.classList.contains('tree-item')) { doBounce(sibling as HTMLElement, true, (i - 1) * 20); i++; } sibling = sibling.nextElementSibling; }
          } else {
            doBounce(div, false, 0);
            let sibling = div.nextElementSibling; let i = 1;
            while (sibling) { if (sibling.classList.contains('tree-item')) { doBounce(sibling as HTMLElement, false, (i - 1) * 20); i++; } sibling = sibling.nextElementSibling; }
          }
          let sc = 0;
          { let s: Element | null = div.nextElementSibling; while (s) { if (s.classList.contains('tree-item')) sc++; s = s.nextElementSibling; } }
          (window as any).syncCursorDuringBounce?.(sc);
        }
      } else {
        const prevSelected = document.querySelector('.tree-item.selected');
        if (prevSelected) prevSelected.classList.remove('selected');
        div.classList.add('selected');
        setSelectedFile(item.path);
        window.selectedFile = item.path;
        (window as any).updateCursorHighlight?.();
        (window as any).updateSidebarPath?.(div);
        if (!(window as any).isInConstraintZone?.(div)) {
          (window as any).scrollAndCenterCursor?.(div);
        }
      }
      e.stopPropagation();
    });
  }

  container.appendChild(frag);

  if (depth === 0 && savedPath) {
    const newItem = document.querySelector(`.tree-item[data-path="${savedPath}"]`);
    if (newItem) {
      newItem.classList.add('selected');
      (window as any).updateCursorHighlight?.(true);
    }
  }
}

export function refreshTree(): void { renderTree(); }

// 显示/隐藏
export function toggleHidden(): void {
  const v = !showHidden;
  (window as any).showHidden = v;
  setShowHidden(v);
  document.getElementById('toggleHiddenBtn')?.classList.toggle('active', v);
  renderTree();
}

export function initTree(): void {
  window.renderTree = renderTree;
  window.refreshTree = refreshTree;
  window.toggleHidden = toggleHidden;
  renderTree();
  setInterval(() => { /* cache save */ }, 30000);
}
