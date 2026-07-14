/**
 * kfm-exec-wrapper.ts
 *
 * 使用 Bun 执行 omp 的 bash 工具
 * 供 ts-node 服务端通过子进程调用
 */

import { executeBash } from '@oh-my-pi/pi-coding-agent/exec/bash-executor';

const command = process.argv[2];
const cwd = process.argv[3] || '/root/kfmv4';
const timeout = parseInt(process.argv[4] || '30') * 1000;

if (!command) {
  console.error('Usage: bun run kfm-exec-wrapper.ts <command> [cwd] [timeout]');
  process.exit(1);
}

try {
  const result = await executeBash(command, { cwd, timeout });
  
  // 输出 JSON 结果
  console.log(JSON.stringify({
    output: result.output,
    exitCode: result.exitCode,
    truncated: result.truncated,
    totalLines: result.totalLines,
    totalBytes: result.totalBytes,
  }));
} catch (error) {
  console.error(JSON.stringify({
    error: error instanceof Error ? error.message : 'Unknown error',
  }));
  process.exit(1);
}
