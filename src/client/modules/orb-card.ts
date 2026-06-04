/**
 * KFM v4 - AI 对话浮卡（orb-card 插件）
 *
 * 统一浮卡引擎的配置示例。
 * 浮卡引擎管理状态机、拖拽和 BR 光球。
 * 插件通过 brOrbSize: 36 将 BR 光球从 10px 放大到 36px。
 *
 * 心法 9：聊天渲染代码从旧 orb.ts 原样复制（git show HEAD~6:src/client/modules/orb.ts）
 */

import { createFloatingCard } from './floating-card.js';
import { wsChannel } from './ws-channel.js';
import { Registry } from './ui-registry.js';
import { layoutLines } from '../engine/text-layout/index.js';
import { currentTheme as theme } from './theme.js';

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

  /** renderChatContent — 从旧 orb.ts 原样复制，仅将 panelEl/contentArea 改为参数 */
  function renderChatContent(contentEl: HTMLElement): void {
    const innerWidth = contentEl.clientWidth - 24;
    if (innerWidth < 50) return;

    let html = '';
    for (const msg of chatMessages) {
      const isUser = msg.role === 'user';
      const bgColor = isUser
        ? `linear-gradient(${theme.surface.bgLight},${theme.surface.bgLight}) padding-box,${theme.aiChat.bubbleSelfGradient} border-box`
        : `linear-gradient(rgba(10,15,30,0.88),rgba(10,15,30,0.88)) padding-box,${theme.aiChat.panelBorderGradient} border-box`;
      const borderStyle = 'border:1px solid transparent;border-left-width:3px;';
      const align = isUser ? 'flex-end' : 'flex-start';
      const label = isUser ? '你' : '蔚然';
      const labelColor = isUser ? theme.aiChat.bubbleLabelSelf : theme.aiChat.bubbleLabelAI;
      const boxShadow = isUser ? theme.aiChat.bubbleSelfShadow : theme.aiChat.bubbleAIShadow;

      const font = '13px sans-serif';
      const lineHeight = 20;
      try {
        const lines = layoutLines(msg.text, font, innerWidth - 24, lineHeight);
        const textHtml = lines.map(l => `<span style="display:block">${escapeHtml(l.text)}</span>`).join('');
        html += `
          <div style="display:flex;justify-content:${align};margin-bottom:8px">
            <div style="max-width:${innerWidth - 8}px;padding:6px 12px;background:${bgColor};${borderStyle}border-radius:8px;box-shadow:${boxShadow}">
              <div style="font-size:10px;color:${labelColor};margin-bottom:2px;font-weight:600">${label}</div>
              <div style="font-family:sans-serif;font-size:13px;line-height:${lineHeight}px;color:${theme.aiChat.bubbleText}">${textHtml}</div>
            </div>
          </div>`;
      } catch {
        html += `
          <div style="display:flex;justify-content:${align};margin-bottom:8px">
            <div style="max-width:85%;padding:6px 12px;background:${bgColor};${borderStyle}border-radius:8px;box-shadow:${boxShadow}">
              <div style="font-size:10px;color:${labelColor};margin-bottom:2px;font-weight:600">${label}</div>
              <div style="font-size:13px;color:${theme.aiChat.bubbleText}">${escapeHtml(msg.text)}</div>
            </div>
          </div>`;
      }
    }
    contentEl.innerHTML = html;
    contentEl.scrollTop = contentEl.scrollHeight;
  }

  createFloatingCard({
    id: 'orb',
    name: 'AI 对话',
    // 紧缩态 0×0：卡片体不可见。BR 光球通过 rightOff=-12 延伸到卡片外。
    compactWidth: 0,
    compactHeight: 0,
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
    keepOrbFixed: true,
    // 初始位置：BR 光球出现在右下角 (right:24, bottom:140)
    initialPosition: { right: 36, bottom: 152 },
    onPreExpand(el) {
      // 展开动画开始前设置面板样式（复刻旧 orb.ts createPanel 的视觉）
      el.style.padding = '1px';
      el.style.border = '1px solid transparent';
      el.style.borderLeftWidth = '3px';
      el.style.borderRadius = '12px';
      el.style.background = `linear-gradient(${theme.surface.bg},${theme.surface.bg}) padding-box, ${theme.aiChat.panelBorderGradient} border-box`;
      el.style.boxShadow = theme.aiChat.panelShadow;
    },
    onActivate(contentEl) {
      orbVisible = false;
      renderChatContent(contentEl);
    },
    onDeactivate() {
      orbVisible = true;
    },
    onCreate(el) {
      el.dataset.registryId = 'orb';
      // 紧缩态：隐藏卡片体
      el.style.padding = '0';
      el.style.border = 'none';
      el.style.borderRadius = '0';
      el.style.background = 'none';
      el.style.boxShadow = 'none';

      // BR 光球样式 — 原样复制自旧 .light-orb CSS
      const orb = el.querySelector('.floating-br-orb') as HTMLElement;
      if (orb) {
        const glow = orb.firstElementChild as HTMLElement | null;
        if (glow) {
          glow.style.background = 'radial-gradient(circle at 30% 30%, rgba(124, 58, 237, 0.9), rgba(124, 58, 237, 0.4), transparent 70%)';
          glow.style.boxShadow = '0 0 16px 6px rgba(124, 58, 237, 0.5), 0 0 32px 12px rgba(124, 58, 237, 0.3)';
        }
        orb.style.cursor = 'grab';
        orb.style.touchAction = 'none';
      }
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
