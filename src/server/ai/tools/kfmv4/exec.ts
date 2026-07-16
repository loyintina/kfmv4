/**
 * kfmv4/exec.ts — 命令执行工具
 *
 * 通过 pi-natives executeShell 直调 Rust 执行引擎，无需 Bun 子进程。
 */
import type { KfmTool, ToolResult } from '../types.js';
import { executeShell } from '../omp/native.js';

export const kfmExecTool: KfmTool = {
  name: 'kfm-exec',
  description: '在项目目录执行命令。用于运行构建检查、测试、git 等。支持超时。',
  category: 'kfmv4',
  parameters: {
    type: 'object',
    properties: {
      command: { type: 'string', description: '要执行的命令' },
      timeout: { type: 'number', description: '超时秒数，默认 30，最大 300' },
      cwd: { type: 'string', description: '工作目录，默认 /root/kfmv4' },
    },
    required: ['command'],
  },
  async execute(params, ctx): Promise<ToolResult> {
    const command = params.command as string;
    const timeoutSec = Math.min(Math.max(1, (params.timeout as number) || 30), 300);
    const cwd = (params.cwd as string) || ctx.cwd;
    if (!command) return { content: [{ type: 'text', text: '缺少 command 参数' }], isError: true };
    try {
      const result = await executeShell({ command, cwd, timeoutMs: timeoutSec * 1000 });
      const exitCode = result.exitCode;
      const ok = !result.cancelled && !result.timedOut && (exitCode === 0 || exitCode === undefined);
      return {
        content: [{ type: 'text', text: ok ? '(命令执行成功)' : `(退出码: ${exitCode ?? 'N/A'}, 取消: ${result.cancelled}, 超时: ${result.timedOut})` }],
        isError: result.cancelled || result.timedOut || (exitCode !== undefined && exitCode !== 0),
      };
    } catch (e) {
      return { content: [{ type: 'text', text: `命令执行失败: ${e instanceof Error ? e.message : '未知错误'}` }], isError: true };
    }
  },
};
