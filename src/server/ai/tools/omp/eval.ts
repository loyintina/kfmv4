/**
 * omp/eval.ts — 代码执行工具（探测本地 Python/Node/Ruby）
 */
import { execFile } from 'child_process';
import { promisify } from 'util';
import { writeFile, mkdir, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import type { KfmTool, ToolResult } from '../types.js';

const execFileAsync = promisify(execFile);

async function which(cmd: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('which', [cmd]);
    return stdout.trim() || null;
  } catch { return null; }
}

export const ompEvalTool: KfmTool = {
  name: 'eval',
  description: '运行 Python/JavaScript/Ruby 代码片段。需要本机安装对应语言解释器。',
  category: 'omp',
  parameters: {
    type: 'object',
    properties: {
      language: { type: 'string', enum: ['py', 'js', 'rb'], description: 'py（Python）、js（JavaScript/Node）、rb（Ruby）' },
      code: { type: 'string', description: '要执行的代码' },
      timeout: { type: 'number', description: '超时秒数，默认 30' },
    },
    required: ['language', 'code'],
  },
  async execute(params): Promise<ToolResult> {
    const language = params.language as string;
    const code = params.code as string;
    const timeoutSec = (params.timeout as number) || 30;
    const tmpDir = join(tmpdir(), 'kfm-eval');
    let runtime: string;
    let ext: string;
    if (language === 'py') { runtime = await which('python3') || await which('python') || ''; ext = 'py'; }
    else if (language === 'js') { runtime = await which('node') || ''; ext = 'js'; }
    else if (language === 'rb') { runtime = await which('ruby') || ''; ext = 'rb'; }
    else return { content: [{ type: 'text', text: `不支持的语言: ${language}` }], isError: true };
    if (!runtime) return { content: [{ type: 'text', text: `${language === 'py' ? 'Python' : language === 'js' ? 'Node.js' : 'Ruby'} 未安装` }], isError: true };
    try {
      await mkdir(tmpDir, { recursive: true });
      const f = join(tmpDir, `eval.${ext}`);
      await writeFile(f, code, 'utf8');
      const { stdout, stderr } = await execFileAsync(runtime, [f], { timeout: timeoutSec * 1000, maxBuffer: 1024 * 1024 });
      await unlink(f).catch(() => {});
      const out = (stdout + (stderr ? '\n(stderr)\n' + stderr : '')).trim() || '(无输出)';
      return { content: [{ type: 'text', text: out }] };
    } catch (e: unknown) {
      const err = e as { killed?: boolean; stderr?: string; message?: string };
      if (err.killed) return { content: [{ type: 'text', text: `执行超时 (${timeoutSec}s)` }], isError: true };
      return { content: [{ type: 'text', text: `执行失败: ${err.stderr || err.message || '未知错误'}` }], isError: true };
    }
  },
};
