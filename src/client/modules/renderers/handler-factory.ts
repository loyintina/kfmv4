import { getFileCategory } from './file-type.js';
import { renderTextPreview } from './text-preview.js';
import { renderBinaryInfo } from './binary-fallback.js';
import { API } from '../state.js';

export function createFileHandler(filePath: string): { activate: (el: HTMLElement) => void; deactivate: (el: HTMLElement) => void } {
  return {
    async activate(contentEl: HTMLElement) {
      try {
        const res = await fetch(API + '/files/read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: filePath }),
        });
        const data = await res.json();
        if (data.content !== undefined && data.content !== null) {
          renderTextPreview(contentEl, data.content);
        } else {
          renderBinaryInfo(contentEl, filePath, data.size);
        }
      } catch {
        renderBinaryInfo(contentEl, filePath);
      }
    },
    deactivate(el: HTMLElement) {
      el.innerHTML = '';
    },
  };
}
