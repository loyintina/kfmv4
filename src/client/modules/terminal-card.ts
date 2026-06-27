/**
 * terminal-card.ts — Phase 8: 03 号终端卡 ContentHandler
 *
 * 组装 Canvas 终端渲染器 + 卡片 DOM。
 *
 * 设计文档：docs/design/TERMINAL_CARD_SPEC.md
 */

import { TerminalRenderer } from './terminal-renderer.js';

let _terminalCounter = 0;

export function createTerminalHandler(): {
  activate: (contentEl: HTMLElement) => void;
  deactivate: (contentEl: HTMLElement) => void;
} {
  _terminalCounter++;
  const terminalName = '终端 ' + _terminalCounter;
  let _renderer: TerminalRenderer | null = null;

  return {
    activate(contentEl) {
      contentEl.innerHTML = '';

      // wrapper
      const wrap = document.createElement('div');
      wrap.style.cssText = 'position:absolute;inset:0;display:flex;flex-direction:column;padding:0 10px';

      // 标题栏
      const header = document.createElement('div');
      header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:6px 0 4px;flex-shrink:0';
      const label = document.createElement('div');
      label.style.cssText = 'font-size:11px;font-weight:600;color:rgba(255,255,255,0.85)';
      label.textContent = '> ' + terminalName;
      header.appendChild(label);
      wrap.appendChild(header);

      // 分隔线
      const line = document.createElement('div');
      line.style.cssText = 'height:1px;flex-shrink:0;background:linear-gradient(90deg,rgba(0,212,255,0.4),rgba(124,58,237,0.3))';
      wrap.appendChild(line);

      // Canvas 容器
      const canvasContainer = document.createElement('div');
      canvasContainer.style.cssText = 'flex:1;overflow:hidden;border-radius:0 0 6px 6px';
      wrap.appendChild(canvasContainer);

      contentEl.appendChild(wrap);

      // 初始化渲染器
      _renderer = new TerminalRenderer();
      _renderer.mount(canvasContainer);
      _renderer.testRender();
    },

    deactivate(contentEl) {
      _renderer = null;
      contentEl.innerHTML = '';
    },
  };
}
