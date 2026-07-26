/**
 * kfmv4/restart.ts — 安全重启工具（v8 重写）
 *
 * v8 宪法第三条：服务端可死。工具只负责"触发 + 立即返回"，
 * 不做轮询、不做浏览器刷新——那些是架构的责任：
 *   - 写 restart-pending.json 标记（新进程启动后检测 → WS 广播 server-restarted）
 *   - POST /api/system/restart（先响应后 spawn detached systemctl）
 *   - 立即返回 tool_result（run-manager 的 flush 保障落盘先于进程死亡）
 *   - 客户端 WS 重连后收到 server-restarted → 冷恢复 → 自动 resume
 */
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { KFM_DATA_DIR } from '../../../path-utils.js';
import type { KfmTool, ToolResult } from '../types.js';

export const kfmRestartTool: KfmTool = {
  name: 'kfm-restart',
  description:
    '安全重启 kfmv4 服务。触发后立即返回，服务将在 ~5s 后恢复。' +
    '恢复后浏览器自动刷新，AI 对话自动继续（无需手动操作）。',
  category: 'kfmv4',
  parameters: {
    type: 'object',
    properties: {
      port: {
        type: 'number',
        description: 'kfmv4 服务端口，默认 8021',
      },
    },
    required: [],
  },

  async execute(params): Promise<ToolResult> {
    const port = (params.port as number) || 8021;
    const base = `http://127.0.0.1:${port}`;

    // Step 1: 写标记文件（新进程启动后检测 → 广播 server-restarted）
    try {
      mkdirSync(KFM_DATA_DIR, { recursive: true });
      writeFileSync(
        join(KFM_DATA_DIR, 'restart-pending.json'),
        JSON.stringify({ triggeredAt: new Date().toISOString(), pid: process.pid }),
        'utf-8',
      );
    } catch { /* 标记写失败不阻塞重启 */ }

    // Step 2: 触发重启（先响应 200，后 spawn detached systemctl）
    let respText = '';
    try {
      const resp = await fetch(`${base}/api/system/restart`, { method: 'POST' });
      respText = await resp.text();
    } catch {
      respText = '{"status":"restarting"}';
    }

    // Step 3: 立即返回（不轮询、不刷新——架构负责恢复）
    return {
      content: [{ type: 'text', text: `[kfm-restart] 重启已触发: ${respText}\n服务将在 ~5s 后恢复，届时对话自动继续。` }],
    };
  },
};
