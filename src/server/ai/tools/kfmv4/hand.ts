/**
 * kfmv4/hand.ts — AI 的手：移动手到指定坐标（v8.6.0 手 首个语义工具）
 *
 * 功能：输入视口坐标 (x, y) → 服务端校验坐标在视口内 → ws 命令 hand-move
 * 广播给浏览器 → 客户端紫色意志核移动到该坐标（卫星弹性跟随），1.5s 后
 * 自动回归待机轨道。坐标出视口则报错拒绝。
 *
 * 坐标基准：浏览器视口绝对像素（原点左上 0,0，右下 = viewport 宽高）。
 * 校验数据源：ws-server 最新浏览器快照的 viewport 字段（实时量取）。
 */

import type { WsServer } from '../../../ws-server.js';
import type { KfmTool, ToolResult, ToolContext } from '../types.js';

/** 从最新快照取视口（无快照/未连接 → null） */
function viewportOf(wsServer: WsServer): { width: number; height: number } | null {
  const snap = wsServer.getLatestSnapshot() as { viewport?: { width?: number; height?: number } } | null;
  if (!snap?.viewport || typeof snap.viewport.width !== 'number' || typeof snap.viewport.height !== 'number') {
    return null;
  }
  return { width: snap.viewport.width, height: snap.viewport.height };
}

export const kfmHandMoveTool: KfmTool = {
  name: 'kfm-hand-move',
  description:
    '移动「AI 的手」到浏览器视口的指定坐标。紫色意志核会移动到该位置（卫星弹性跟随），' +
    '1.5 秒后自动回归待机轨道。坐标必须是视口内绝对像素（原点左上 0,0），' +
    '超出视口则报错。执行后可用眼睛文件（eyes.md）的 coords 对照校验。',
  category: 'kfmv4',
  parameters: {
    type: 'object',
    properties: {
      x: {
        type: 'number',
        description: '目标 x 坐标（视口绝对像素，0 = 最左）',
      },
      y: {
        type: 'number',
        description: '目标 y 坐标（视口绝对像素，0 = 最顶）',
      },
    },
    required: ['x', 'y'],
  },

  async execute(params, ctx: ToolContext): Promise<ToolResult> {
    const x = Number(params.x);
    const y = Number(params.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return {
        content: [{ type: 'text', text: `[kfm-hand-move] 坐标必须是数字：x=${params.x} y=${params.y}` }],
        isError: true,
      };
    }

    // 视口校验：坐标必须落在当前真实视口内
    const vp = viewportOf(ctx.wsServer);
    if (!vp) {
      return {
        content: [{ type: 'text', text: '[kfm-hand-move] 无浏览器快照（浏览器未连接），无法校验坐标。请先等待页面连接。' }],
        isError: true,
      };
    }
    if (x < 0 || y < 0 || x > vp.width || y > vp.height) {
      return {
        content: [{
          type: 'text',
          text: `[kfm-hand-move] 坐标 (${Math.round(x)}, ${Math.round(y)}) 超出视口 ${vp.width}×${vp.height}（原点左上）。` +
            `请用眼睛文件的「标定坐标系」或 coords 确认目标在屏幕内。`,
        }],
        isError: true,
      };
    }

    // 广播移动命令（客户端 hand.ts 监听 hand-move）
    ctx.wsServer.sendCommand('hand-move', { x: Math.round(x), y: Math.round(y) });

    return {
      content: [{
        type: 'text',
        text: `[kfm-hand-move] 手已移动到 (${Math.round(x)}, ${Math.round(y)})，1.5s 后回归待机轨道。`,
      }],
    };
  },
};
