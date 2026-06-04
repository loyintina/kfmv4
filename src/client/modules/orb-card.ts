/**
 * KFM v4 - AI 对话浮卡（orb-card 插件）
 *
 * 统一浮卡引擎的配置示例。
 * 浮卡引擎管理状态机、拖拽和 BR 光球。
 * 插件通过 brOrbSize: 36 将 BR 光球从 10px 放大到 36px。
 */

import { createFloatingCard } from './floating-card.js';
import { wsChannel } from './ws-channel.js';
import { Registry } from './ui-registry.js';

interface ChatMessage {
  role: 'user' | 'ai';
  text: string;
}

export function initOrbCard(): void {
  const chatMessages: ChatMessage[] = [
    { role: 'ai', text: '你好，我是蔚然。有什么可以帮你的吗？' },
    { role: 'user', text: '帮我分析一下当前的目录结构' },
    { role: 'ai', text: '好的，正在分析目录结构。当前目录下共有 12 个文件夹和 8 个文件。' },
  ];

  let orbVisible = true;

  function renderChat(contentEl: HTMLElement): void {
    const w = contentEl.clientWidth - 24;
    if (w < 50) return;
    let html = '';
    for (const msg of chatMessages) {
      const isUser = msg.role === 'user';
      const align = isUser ? 'flex-end' : 'flex-start';
      const label = isUser ? '你' : '蔚然';
      const bg = isUser
        ? 'linear-gradient(rgba(124,58,237,0.15),rgba(124,58,237,0.15)) padding-box,linear-gradient(135deg,#7c3aed,#00d4ff) border-box'
        : 'linear-gradient(rgba(10,15,30,0.88),rgba(10,15,30,0.88)) padding-box,linear-gradient(135deg,#7c3aed,#00d4ff) border-box';
      html += `
        <div style="display:flex;justify-content:${align};margin-bottom:8px;width:100%">
          <div style="max-width:${w - 8}px;padding:6px 12px;background:${bg};border:1px solid transparent;border-left-width:3px;border-radius:8px">
            <div style="font-size:10px;color:${isUser ? '#7c3aed' : '#00d4ff'};margin-bottom:2px;font-weight:600">${label}</div>
            <div style="font-size:13px;color:rgba(224,224,224,0.9)">${escapeHtml(msg.text)}</div>
          </div>
        </div>`;
    }
    contentEl.innerHTML = html;
    contentEl.scrollTop = contentEl.scrollHeight;
  }

  createFloatingCard({
    id: 'orb',
    name: 'AI 对话',

    compactWidth: 36,
    compactHeight: 36,
    activeWidth: 300,
    activeHeight: 350,
    minWidth: 120,
    minHeight: 100,

    cornerTL: false,
    cornerTR: false,
    cornerBL: false,

    alwaysOnTop: true,
    inputBarAvoid: true,
    accentColor: '#7c3aed',
    brOrbSize: 36,

    // 初始位置：使 36px 光球出现在屏幕右下角 (right:24, bottom:140)
    // 卡片 36px，BR 光球在卡片内 left: -12（因为 rightOff=12）
    // 计算：initialPosition.right = 24 - 12 = 12
    initialPosition: { right: 12, bottom: 140 },

    onActivate(contentEl) {
      orbVisible = false;
      contentEl.style.cssText = 'position:absolute;inset:0;display:flex;flex-direction:column;box-sizing:border-box;padding:8px;overflow:hidden';
      renderChat(contentEl);
    },
    onDeactivate() {
      orbVisible = true;
    },
    onCreate(el) {
      el.dataset.registryId = 'orb';
      // 隐藏卡片体背景（卡片只是状态容器）
      el.style.background = 'none';
      el.style.borderRadius = '0';
      el.style.padding = '0';
      el.style.border = 'none';
    },

    registryElement: {
      id: 'orb',
      type: 'panel',
      label: 'AI 对话面板',
      description: 'AI 聊天对话面板',
      state: 'compact',
      enabled: true,
      effect: '点击右下角光球展开对话面板，可拖动和缩放',
      source: 'orb-card.ts',
    },
  });

  // 注册内容层生成器
  Registry.registerContentGenerator('orb-chat', () => ({
    id: 'orb-chat',
    type: 'text-output',
    summary: chatMessages.length > 0
      ? `最后一条消息: ${chatMessages[chatMessages.length - 1].role === 'user' ? '我' : 'AI'}说「${chatMessages[chatMessages.length - 1].text.slice(0, 40)}${chatMessages[chatMessages.length - 1].text.length > 40 ? '…' : ''}」`
      : '暂无对话历史',
  }));

  // 兼容旧命令
  wsChannel.onCommand('expand-orb', () => { if (!orbVisible) (document.querySelector('.floating-br-orb') as HTMLElement)?.click(); });
  wsChannel.onCommand('collapse-orb', () => { if (orbVisible) (document.querySelector('.floating-br-orb') as HTMLElement)?.click(); });
  wsChannel.onCommand('toggle-orb', () => { (document.querySelector('.floating-br-orb') as HTMLElement)?.click(); });
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
