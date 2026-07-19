/**
 * confirm-dialog.ts — 可复用的自定义确认对话框
 *
 * 提供统一的确认对话框样式，可在所有卡片中复用。
 * 边框使用卡片双色渐变（c1→c2），与其他卡片视觉一致。
 *
 * 用法：
 *   import { showConfirm } from '../../modules/confirm-dialog.js';
 *
 *   const confirmed = await showConfirm({
 *     title: '删除配置',
 *     message: '确定删除配置「主会话」？',
 *     accent: '#00d4ff',
 *     accent2: '#7c3aed',
 *     confirmText: '删除',
 *     cancelText: '取消',
 *   });
 *
 *   if (confirmed) { // 执行删除 }
 */

import { Z } from './z-index-layers.js';

export interface ConfirmOptions {
  title: string;
  message: string;
  accent?: string;
  accent2?: string;
  confirmText?: string;
  cancelText?: string;
}

export function showConfirm(options: ConfirmOptions): Promise<boolean> {
  const {
    title,
    message,
    accent = '#00d4ff',
    accent2 = '#7c3aed',
    confirmText = '确定',
    cancelText = '取消',
  } = options;

  return new Promise<boolean>((resolve) => {

    // 创建遮罩层
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(4px);
      z-index: ${Z.MODAL_DIALOG};
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.2s;
    `;

    // 创建对话框 — 双色渐变边框（c1→c2）
    const dialog = document.createElement('div');
    dialog.style.cssText = `
      background: linear-gradient(rgba(20, 16, 32, 0.98), rgba(20, 16, 32, 0.98)) padding-box,
        linear-gradient(135deg, ${accent} 30%, ${accent2} 70%) border-box;
      border: 1px solid transparent;
      border-left-width: 3px;
      border-radius: 12px;
      padding: 20px 24px;
      min-width: 280px;
      max-width: 360px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
      transform: scale(0.9);
      transition: transform 0.2s;
    `;

    // 标题
    const titleEl = document.createElement('div');
    titleEl.style.cssText = `
      font-size: 14px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.9);
      margin-bottom: 12px;
    `;
    titleEl.textContent = title;

    // 消息
    const messageEl = document.createElement('div');
    messageEl.style.cssText = `
      font-size: 13px;
      color: rgba(255, 255, 255, 0.7);
      line-height: 1.5;
      margin-bottom: 20px;
    `;
    messageEl.textContent = message;

    // 按钮容器
    const buttonsEl = document.createElement('div');
    buttonsEl.style.cssText = `
      display: flex;
      gap: 10px;
      justify-content: flex-end;
    `;

    // 取消按钮
    const cancelBtn = document.createElement('button');
    cancelBtn.style.cssText = `
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      border: 1px solid rgba(255, 255, 255, 0.15);
      background: rgba(255, 255, 255, 0.06);
      color: rgba(255, 255, 255, 0.7);
      transition: all 0.15s;
    `;
    cancelBtn.textContent = cancelText;
    cancelBtn.onmouseenter = () => {
      cancelBtn.style.background = 'rgba(255, 255, 255, 0.1)';
      cancelBtn.style.color = 'rgba(255, 255, 255, 0.9)';
    };
    cancelBtn.onmouseleave = () => {
      cancelBtn.style.background = 'rgba(255, 255, 255, 0.06)';
      cancelBtn.style.color = 'rgba(255, 255, 255, 0.7)';
    };

    // 确认按钮
    const confirmBtn = document.createElement('button');
    confirmBtn.style.cssText = `
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      border: 1px solid ${accent}60;
      background: ${accent}20;
      color: ${accent};
      transition: all 0.15s;
    `;
    confirmBtn.textContent = confirmText;
    confirmBtn.onmouseenter = () => {
      confirmBtn.style.background = `${accent}30`;
      confirmBtn.style.borderColor = `${accent}80`;
    };
    confirmBtn.onmouseleave = () => {
      confirmBtn.style.background = `${accent}20`;
      confirmBtn.style.borderColor = `${accent}60`;
    };

    const close = (result: boolean) => {
      document.removeEventListener('keydown', onKeyDown);
      overlay.style.opacity = '0';
      dialog.style.transform = 'scale(0.9)';
      setTimeout(() => {
        overlay.remove();
        resolve(result);
      }, 200);
    };

    // 事件绑定
    cancelBtn.onclick = () => close(false);
    confirmBtn.onclick = () => close(true);
    overlay.onclick = (e) => {
      if (e.target === overlay) close(false);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(false);
      if (e.key === 'Enter') close(true);
    };
    document.addEventListener('keydown', onKeyDown);

    // 组装
    buttonsEl.appendChild(cancelBtn);
    buttonsEl.appendChild(confirmBtn);
    dialog.appendChild(titleEl);
    dialog.appendChild(messageEl);
    dialog.appendChild(buttonsEl);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    // 动画
    requestAnimationFrame(() => {
      overlay.style.opacity = '1';
      dialog.style.transform = 'scale(1)';
    });
  });
}
