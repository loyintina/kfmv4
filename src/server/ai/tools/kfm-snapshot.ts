/**
 * kfm-snapshot 工具
 *
 * 获取 kfmv4 页面完整状态（所有卡片、元素、能力）
 * 包装现有的 WebSocket snapshot 功能
 */

import type { KfmTool, ToolResult } from './types.js';

export const kfmSnapshotTool: KfmTool = {
  name: 'kfm-snapshot',
  description: '获取 kfmv4 页面完整状态（所有卡片、元素、能力）。用于了解当前页面布局和各卡片状态。',
  category: 'kfmv4',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },

  async execute(_params, ctx): Promise<ToolResult> {
    const snapshot = ctx.wsServer.getLatestSnapshot();

    if (!snapshot) {
      return {
        content: [{
          type: 'text',
          text: '页面状态不可用。请确保浏览器已打开 kfmv4 页面且 WebSocket 已连接。'
        }],
        isError: true,
      };
    }

    // 格式化输出
    const formatted = formatSnapshot(snapshot as unknown as Record<string, unknown>);
    return {
      content: [{ type: 'text', text: formatted }],
      details: { timestamp: snapshot.timestamp },
    };
  },
};

/** 格式化 snapshot 为可读文本 */
function formatSnapshot(snapshot: Record<string, unknown>): string {
  const lines: string[] = [];
  const elements = snapshot.elements as Array<Record<string, unknown>> | undefined;
  const capabilities = snapshot.capabilities as Array<Record<string, unknown>> | undefined;

  lines.push('# kfmv4 页面状态');
  lines.push(`时间: ${new Date(snapshot.timestamp as number).toLocaleString()}`);
  lines.push('');

  // 元素列表
  if (elements && elements.length > 0) {
    lines.push(`## 元素 (${elements.length})`);
    for (const el of elements) {
      const id = el.id || 'unknown';
      const type = el.type || 'unknown';
      const state = el.state || 'unknown';
      lines.push(`- ${id}: ${type} [${state}]`);
    }
    lines.push('');
  }

  // 能力列表
  if (capabilities && capabilities.length > 0) {
    lines.push(`## 能力 (${capabilities.length})`);
    for (const cap of capabilities) {
      const id = cap.id || 'unknown';
      const name = cap.name || id;
      lines.push(`- ${id}: ${name}`);
    }
    lines.push('');
  }

  // 统计
  lines.push('## 统计');
  lines.push(`- 元素数量: ${elements?.length || 0}`);
  lines.push(`- 能力数量: ${capabilities?.length || 0}`);

  return lines.join('\n');
}
