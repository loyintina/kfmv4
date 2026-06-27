/**
 * terminal-card.ts — Phase 8: 03 号终端卡 ContentHandler
 *
 * 组装 Canvas 终端渲染器。布局骨架由 buildCardLayout 提供。
 *
 * 设计文档：docs/design/TERMINAL_CARD_SPEC.md
 */

import { TerminalRenderer } from './terminal-renderer.js';
import { buildCardLayout } from './floating-card.js';

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
      const c1 = contentEl.style.getPropertyValue('--card-accent1') || '#00d4ff';
      const c2 = contentEl.style.getPropertyValue('--card-accent2') || '#7c3aed';
      const { bodyEl } = buildCardLayout(contentEl, '> ' + terminalName, c1, c2);

      _renderer = new TerminalRenderer();
      _renderer.setAccent(c1);
      _renderer.mount(bodyEl);
    },

    deactivate(contentEl) {
      if (_renderer) { _renderer.dispose(); _renderer = null; }
      contentEl.innerHTML = '';
    },
  };
}
