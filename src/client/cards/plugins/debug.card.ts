/**
 * debug.card.ts — 日志管理卡
 *
 * 显示 KFM 调试日志，支持复制和清空。
 * 注册为 'debug' 类型，显示在卡片堆中。
 */

import { registerCardType, type CardContentHandler } from '../../modules/card-registry.js';
import { getLogs, clearLogs, copyLogs, onLog } from '../../modules/logger.js';

// ========== 日志卡状态（仅为日志卡私有） ==========

const _activeSubs = new WeakMap<HTMLElement, () => void>();

// ========== 内容处理器工厂 ==========

function createDebugHandler(_meta: Record<string, unknown>): CardContentHandler {
  return {
    activate(contentEl, _card, _reason) {
      contentEl.innerHTML = '';

      // 加载并应用存储的字号偏好
      const storedFontSize = localStorage.getItem('kfm-fontsize-debug');
      if (storedFontSize) {
        try {
          const parsed = JSON.parse(storedFontSize);
          if (typeof parsed.fontSize === 'number') {
            contentEl.style.setProperty('--card-font-size', parsed.fontSize + 'px');
          }
        } catch { /* ignore */ }
      }

      const wrap = document.createElement('div');
      wrap.style.cssText = 'position:absolute;inset:0;display:flex;flex-direction:column;padding:0 10px';

      // 标题栏
      const header = document.createElement('div');
      header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:6px 0 4px;flex-shrink:0';

      const title = document.createElement('div');
      title.style.cssText = 'font-size:11px;font-weight:600;color:rgba(255,255,255,0.85)';
      title.textContent = '\u8C03\u8BD5\u65E5\u5FD7';
      header.appendChild(title);

      const btnWrap = document.createElement('div');
      btnWrap.style.cssText = 'display:flex;gap:6px;flex-shrink:0;margin-left:8px';

      const copyBtn = document.createElement('button');
      copyBtn.textContent = '\u590D\u5236';
      copyBtn.style.cssText = 'font-size:10px;padding:2px 8px;border-radius:6px;cursor:pointer;border:1px solid rgba(0,212,255,0.3);background:transparent;color:rgba(255,255,255,0.75)';
      copyBtn.addEventListener('click', () => {
        copyLogs();
        copyBtn.textContent = '\u2713';
        copyBtn.style.cssText = 'font-size:10px;padding:2px 8px;border-radius:6px;cursor:pointer;border:1px solid rgba(74,222,128,0.3);background:transparent;color:rgba(74,222,128,0.9)';
        setTimeout(() => {
          copyBtn.textContent = '\u590D\u5236';
          copyBtn.style.cssText = 'font-size:10px;padding:2px 8px;border-radius:6px;cursor:pointer;border:1px solid rgba(0,212,255,0.3);background:transparent;color:rgba(255,255,255,0.75)';
        }, 2000);
      });
      btnWrap.appendChild(copyBtn);

      const clearBtn = document.createElement('button');
      clearBtn.textContent = '\u6E05\u7A7A';
      clearBtn.style.cssText = 'font-size:10px;padding:2px 8px;border-radius:6px;cursor:pointer;border:1px solid rgba(0,212,255,0.3);background:transparent;color:rgba(255,255,255,0.75)';
      clearBtn.addEventListener('click', clearLogs);
      btnWrap.appendChild(clearBtn);

      header.appendChild(btnWrap);
      wrap.appendChild(header);

      // 分隔线
      const line = document.createElement('div');
      const c1 = _card?.accents?.color1 || '#00d4ff';
      const c2 = _card?.accents?.color2 || '#7c3aed';
      line.style.cssText = 'height:1px;flex-shrink:0;background:linear-gradient(90deg,' + c1 + ',' + c2 + ')';
      wrap.appendChild(line);

      // 日志区
      const logArea = document.createElement('div');
      logArea.style.cssText = 'flex:1;overflow-y:auto;font-family:monospace;font-size:var(--card-font-size,10px);color:rgba(224,224,224,0.8);white-space:pre-wrap;word-break:break-all;padding:4px 0';
      wrap.appendChild(logArea);

      contentEl.appendChild(wrap);

      const refresh = () => {
        const logs = getLogs();
        logArea.textContent = logs.length > 0 ? logs.join('\n') : '\uFF08\u7A7A\uFF09';
        logArea.scrollTop = logArea.scrollHeight;
      };
      refresh();
      _activeSubs.set(contentEl, onLog(refresh));
    },
    deactivate(contentEl, _card, _reason) {
      const unsub = _activeSubs.get(contentEl);
      if (unsub) { unsub(); _activeSubs.delete(contentEl); }
      contentEl.innerHTML = '';
    },
  };
}

// ========== 注册 ==========

registerCardType({
  typeId: 'debug',
  icon: '\uD83D\uDD27',
  name: '\u65E5\u5FD7\u7BA1\u7406',
  description: '',
  kind: 'tool',
  createHandler: createDebugHandler,
});
