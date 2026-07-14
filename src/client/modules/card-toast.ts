/**
 * card-toast.ts — 卡片风格的轻量提示
 *
 * 替代原生 alert/confirm，用于非阻塞提示。
 * 样式与卡片内卡一致（渐变边框 + 暗色背景）。
 *
 * 用法：
 *   import { showCardToast } from '../../modules/card-toast.js';
 *   showCardToast('只支持文本/代码/Markdown 文件', '#00d4ff');
 */

import { currentTheme as theme } from './theme.js';

export function showCardToast(message: string, accent: string = '#00d4ff'): void {
  const toast = document.createElement('div');
  toast.style.cssText = [
    'position:fixed',
    'bottom:80px',
    'left:50%',
    'transform:translateX(-50%) translateY(20px)',
    'padding:10px 18px',
    'border-radius:10px',
    'font-size:12px',
    'color:rgba(255,255,255,0.85)',
    'background:linear-gradient(rgba(16,12,24,0.95),rgba(16,12,24,0.95)) padding-box,' +
      'linear-gradient(135deg,' + accent + '40,' + accent + '20) border-box',
    'border:1px solid transparent',
    'border-left-width:3px',
    'box-shadow:0 4px 16px rgba(0,0,0,0.4)',
    'z-index:11000',
    'pointer-events:none',
    'opacity:0',
    'transition:opacity 0.25s, transform 0.25s',
    'white-space:nowrap',
  ].join(';');
  toast.textContent = message;
  document.body.appendChild(toast);

  // 动画入场
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';
  });

  // 2 秒后消失
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(20px)';
    setTimeout(() => { toast.remove(); }, 300);
  }, 2000);
}
