/**
 * kfm-logs 工具
 *
 * 读取 kfmv4 日志卡的内容
 * 通过 WebSocket 获取实时日志
 */

import type { KfmTool, ToolResult } from './types.js';

export const kfmLogsTool: KfmTool = {
  name: 'kfm-logs',
  description: '读取 kfmv4 日志卡的内容。用于查看运行日志、错误信息、调试输出。',
  parameters: {
    type: 'object',
    properties: {
      cardId: {
        type: 'string',
        description: '日志卡 ID，默认读取最新的日志卡',
      },
      lines: {
        type: 'number',
        description: '读取行数，默认 100，最大 1000',
      },
    },
    required: [],
  },

  async execute(params, ctx): Promise<ToolResult> {
    const cardId = params.cardId as string | undefined;
    const lines = Math.min(Math.max(1, (params.lines as number) || 100), 1000);

    try {
      // 通过 WebSocket 获取日志内容
      const logs = await getLogsFromWebSocket(ctx.wsServer, cardId, lines);

      if (!logs || logs.length === 0) {
        return {
          content: [{
            type: 'text',
            text: cardId
              ? `日志卡 "${cardId}" 没有内容或不存在。`
              : '没有找到日志卡。请确保页面上有日志卡且已产生日志。'
          }],
        };
      }

      return {
        content: [{
          type: 'text',
          text: logs.join('\n'),
        }],
        details: {
          cardId: cardId || 'latest',
          lineCount: logs.length,
        },
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `读取日志失败: ${error instanceof Error ? error.message : '未知错误'}`,
        }],
        isError: true,
      };
    }
  },
};

/** 从 WebSocket 获取日志内容 */
async function getLogsFromWebSocket(
  wsServer: import('../../ws-server.js').WsServer,
  cardId: string | undefined,
  lines: number
): Promise<string[]> {
  // 获取最新的 snapshot
  const snapshot = wsServer.getLatestSnapshot();
  if (!snapshot) {
    return [];
  }

  // 从 snapshot 中查找日志卡
  const elements = snapshot.elements as Array<Record<string, unknown>> | undefined;
  if (!elements) {
    return [];
  }

  // 查找日志类型的元素
  const logElements = elements.filter(el =>
    el.type === 'log' || el.type === 'terminal' || el.id?.toString().includes('log')
  );

  if (logElements.length === 0) {
    return [];
  }

  // 使用指定的 cardId 或最新的日志卡
  const targetLog = cardId
    ? logElements.find(el => el.id === cardId)
    : logElements[logElements.length - 1];

  if (!targetLog) {
    return [];
  }

  // 提取日志内容
  const content = targetLog.content || targetLog.output || targetLog.text;
  if (typeof content === 'string') {
    const logLines = content.split('\n');
    return logLines.slice(-lines);
  }

  if (Array.isArray(content)) {
    return content.slice(-lines).map(String);
  }

  return [];
}
