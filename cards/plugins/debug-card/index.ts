/**
 * debug-card — 日志管理卡片
 *
 * 展开后显示日志面板。日志由 logger.ts 统一收集，本卡片只负责渲染。
 * 当前日志为空（所有 debugLog 已清除），只等将来接入。
 */
import { getLogs, clearLogs, copyLogs, onLog } from './logger.js';

export const id = 'debug';
export const name = '日志管理';
export const icon = '\uD83D\uDD27';
export const accentColor = '#00c8a0';
export const defaultWidth = 280;
export const defaultHeight = 200;

/** 在 contentEl 中构建日志面板 DOM */
export function renderContent(contentEl: HTMLElement): void {
  contentEl.style.cssText = [
    'position:absolute', 'inset:0',
    'display:flex', 'flex-direction:column',
    'padding:4px',
    'box-sizing:border-box',
  ].join(';');

  // 日志区域
  const logArea = document.createElement('div');
  logArea.style.cssText = [
    'flex:1', 'overflow-y:auto',
    'font-family:monospace', 'font-size:10px',
    'color:rgba(224,224,224,0.8)',
    'white-space:pre-wrap', 'word-break:break-all',
    'padding:4px', 'background:rgba(0,0,0,0.2)',
    'border-radius:6px', 'margin-bottom:4px',
  ].join(';');
  logArea.className = 'debug-card-log-area';
  contentEl.appendChild(logArea);

  // 按钮栏
  const btnBar = document.createElement('div');
  btnBar.style.cssText = 'display:flex;gap:6px;justify-content:flex-end';
  contentEl.appendChild(btnBar);

  const clearBtn = _makeBtn('清空');
  clearBtn.addEventListener('click', clearLogs);
  btnBar.appendChild(clearBtn);

  const copyBtn = _makeBtn('复制');
  copyBtn.addEventListener('click', copyLogs);
  btnBar.appendChild(copyBtn);

  // 初始渲染
  _refresh(logArea);

  // 订阅实时更新
  const unsub = onLog(() => _refresh(logArea));
  // 卡片销毁时取消订阅
  contentEl.dataset.unsubKey = String((window as any).__debugUnsubCounter = ((window as any).__debugUnsubCounter || 0) + 1);
  (contentEl as any)._unsubLog = unsub;
}

function _refresh(logArea: HTMLElement): void {
  const logs = getLogs();
  logArea.textContent = logs.length > 0 ? logs.join('\n') : '(空)';
  logArea.scrollTop = logArea.scrollHeight;
}

function _makeBtn(text: string): HTMLElement {
  const btn = document.createElement('button');
  btn.textContent = text;
  btn.style.cssText = [
    'padding:2px 10px', 'font-size:10px',
    'border:1px solid rgba(255,255,255,0.15)',
    'border-radius:4px', 'background:rgba(255,255,255,0.05)',
    'color:rgba(224,224,224,0.8)', 'cursor:pointer',
  ].join(';');
  return btn;
}
