/**
 * kfm-exec 工具
 *
 * 在 kfmv4 项目目录执行命令
 * 使用 omp 的 bash 执行器（通过 Bun 子进程）
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import type { KfmTool, ToolResult } from './types.js';

const execFileAsync = promisify(execFile);

export const kfmExecTool: KfmTool = {
  name: 'kfm-exec',
  description: '在 kfmv4 项目目录执行命令。用于运行构建检查、测试、git 命令等。',
  category: 'kfmv4',
  parameters: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: '要执行的命令',
      },
      timeout: {
        type: 'number',
        description: '超时秒数，默认 30，最大 300',
      },
      cwd: {
        type: 'string',
        description: '工作目录，默认 /root/kfmv4',
      },
    },
    required: ['command'],
  },

  async execute(params, ctx, onUpdate): Promise<ToolResult> {
    const command = params.command as string;
    const timeout = Math.min(Math.max(1, (params.timeout as number) || 30), 300);
    const cwd = (params.cwd as string) || '/root/kfmv4';

    if (!command) {
      return {
        content: [{ type: 'text', text: '缺少 command 参数' }],
        isError: true,
      };
    }

    try {
      // 使用 Bun 子进程执行 omp 的 bash 工具
      const wrapperPath = new URL('../kfm-exec-wrapper.ts', import.meta.url).pathname;
      const { stdout, stderr } = await execFileAsync('/root/.npm-global/bin/bun', [
        'run',
        wrapperPath,
        command,
        cwd,
        timeout.toString(),
      ], {
        timeout: (timeout + 5) * 1000, // 额外 5 秒超时
        maxBuffer: 10 * 1024 * 1024, // 10MB
      });

      if (stderr) {
        return {
          content: [{ type: 'text', text: `错误: ${stderr}` }],
          isError: true,
        };
      }

      // 解析 JSON 结果
      const result = JSON.parse(stdout);
      
      return {
        content: [{ type: 'text', text: result.output || '(no output)' }],
        details: {
          exitCode: result.exitCode,
          wallTimeMs: result.totalBytes,
          truncated: result.truncated,
          totalLines: result.totalLines,
        },
        isError: result.exitCode !== undefined && result.exitCode !== 0,
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `命令执行失败: ${error instanceof Error ? error.message : '未知错误'}`,
        }],
        isError: true,
      };
    }
  },
};
