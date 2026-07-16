/**
 * custom-select.ts — 可复用的自定义下拉框组件
 *
 * 提供统一的下拉框样式和行为，可在所有卡片中复用。
 * 样式基于 API 卡的下拉框实现。
 *
 * 用法：
 *   import { createCustomSelect } from '../../modules/custom-select.js';
 *
 *   const select = createCustomSelect({
 *     accent: '#00d4ff',
 *     placeholder: '请选择',
 *     onSelect: (value) => { log('selected:', value); },
 *   });
 *
 *   // 更新选项
 *   select.updateItems([
 *     { label: '选项1', value: '1' },
 *     { label: '选项2', value: '2' },
 *   ], '1');
 *
 *   // 添加到 DOM
 *   parent.appendChild(select.element);
 */

export interface SelectItem {
  label: string;
  value: string;
}

export interface CustomSelectOptions {
  accent: string;
  accent2?: string;
  placeholder?: string;
  onSelect: (value: string) => void;
  minWidth?: number;
  maxWidth?: number;
  direction?: 'up' | 'down';
  /** 下拉面板底部的额外元素（如"新建"按钮） */
  footerElement?: HTMLElement;
}

export interface CustomSelect {
  element: HTMLElement;
  trigger: HTMLElement;
  triggerText: HTMLElement;
  panel: HTMLElement;
  updateItems: (items: SelectItem[], selected: string) => void;
  getValue: () => string;
  setValue: (value: string) => void;
  destroy: () => void;
}

export function createCustomSelect(options: CustomSelectOptions): CustomSelect {
  const {
    accent,
    accent2,
    placeholder = '—',
    onSelect,
    minWidth = 80,
    maxWidth = 200,
    direction = 'down',
    footerElement,
  } = options;
  let items: SelectItem[] = [];
  let selectedValue = '';
  let panelOpen = false;

  // 主容器
  const element = document.createElement('div');
  element.style.cssText = 'position:relative;display:inline-flex;min-width:0';

  // 触发器
  const trigger = document.createElement('div');
  const hasGradient = accent2 && accent2 !== accent;
  const triggerBg = hasGradient
    ? `background:linear-gradient(rgba(10,10,15,0.92),rgba(10,10,15,0.92)) padding-box,linear-gradient(135deg,${accent2} 30%,${accent} 70%) border-box;border:1px solid transparent;border-left-width:2px`
    : `border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.06)`;
  trigger.style.cssText = `
    display:flex;
    align-items:center;
    justify-content:space-between;
    padding:0.3em 0.6em;
    border-radius:6px;
    font-size:var(--card-font-size,11px);
    cursor:pointer;
    ${triggerBg};
    color:rgba(255,255,255,0.85);
    user-select:none;
    min-width:${minWidth}px;
    max-width:${maxWidth}px;
    gap:4px;
  `;

  const triggerText = document.createElement('span');
  triggerText.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1';
  triggerText.textContent = placeholder;

  const arrow = document.createElement('span');
  arrow.style.cssText = 'font-size:var(--card-font-size,10px);opacity:0.6;flex-shrink:0;margin-left:4px';
  arrow.textContent = '▼';

  trigger.appendChild(triggerText);
  trigger.appendChild(arrow);

  // 下拉面板
  const panel = document.createElement('div');
  panel.style.cssText = `
    position:fixed;
    z-index:9999;
    display:none;
    border-radius:8px;
    padding:4px;
    background:rgba(20,16,32,0.96);
    backdrop-filter:blur(16px);
    border:1px solid rgba(255,255,255,0.1);
    overflow:hidden;
    min-width:${minWidth}px;
    max-height:200px;
    overflow-y:auto;
  `;

  // 打开面板
  const openPanel = () => {
    panel.innerHTML = '';
    items.forEach(item => {
      const el = document.createElement('div');
      const isSelected = item.value === selectedValue;
      el.style.cssText = `
        padding:5px 8px;
        border-radius:4px;
        font-size:var(--card-font-size,11px);
        cursor:pointer;
        display:flex;
        align-items:center;
        justify-content:space-between;
        color:${isSelected ? accent : 'rgba(255,255,255,0.8)'};
      `;
      el.onmouseenter = () => { el.style.background = 'rgba(255,255,255,0.06)'; };
      el.onmouseleave = () => { el.style.background = ''; };

      const label = document.createElement('span');
      label.textContent = item.label;
      el.appendChild(label);

      if (isSelected) {
        const check = document.createElement('span');
        check.textContent = '✓';
        check.style.cssText = `font-size:var(--card-font-size,9px);color:${accent}`;
        el.appendChild(check);
      }

      el.onclick = (ev: PointerEvent) => {
        ev.stopPropagation();
        selectedValue = item.value;
        triggerText.textContent = item.label;
        onSelect(item.value);
        closePanel();
      };

      panel.appendChild(el);
    });

    // 底部额外元素（如"新建"按钮）
    if (footerElement) {
      panel.appendChild(footerElement);
    }

    // 定位面板（根据方向）
    const r = trigger.getBoundingClientRect();
    panel.style.left = r.left + 'px';
    panel.style.minWidth = Math.max(r.width, minWidth) + 'px';
    if (direction === 'up') {
      panel.style.bottom = (window.innerHeight - r.top) + 'px';
      panel.style.top = 'auto';
    } else {
      panel.style.top = r.bottom + 'px';
      panel.style.bottom = 'auto';
    }
    panel.style.display = 'block';
    panelOpen = true;
  };

  // 关闭面板
  const closePanel = () => {
    panel.style.display = 'none';
    panelOpen = false;
  };

  // 点击触发器
  trigger.onclick = (e: PointerEvent) => {
    e.stopPropagation();
    panelOpen ? closePanel() : openPanel();
  };

  // 点击外部关闭
  const onPointerDown = (e: PointerEvent) => {
    if (panelOpen && !panel.contains(e.target as Node) && !trigger.contains(e.target as Node)) {
      closePanel();
    }
  };
  document.addEventListener('pointerdown', onPointerDown);

  // 组装（panel 附加到 body 以避免 position:fixed 被 relative 容器影响）
  element.appendChild(trigger);
  document.body.appendChild(panel);

  // 更新选项
  const updateItems = (newItems: SelectItem[], selected: string) => {
    items = newItems;
    selectedValue = selected;
    const found = items.find(i => i.value === selected);
    triggerText.textContent = found?.label || placeholder;
  };

  // 获取当前值
  const getValue = () => selectedValue;

  // 设置值
  const setValue = (value: string) => {
    selectedValue = value;
    const found = items.find(i => i.value === value);
    triggerText.textContent = found?.label || placeholder;
  };

  // 销毁
  const destroy = () => {
    document.removeEventListener('pointerdown', onPointerDown);
    panel.remove();
    element.remove();
  };

  return {
    element,
    trigger,
    triggerText,
    panel,
    updateItems,
    getValue,
    setValue,
    destroy,
  };
}
