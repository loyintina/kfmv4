/**
 * omp/read.ts — 读文件工具（Node.js fs.promises）
 *
 * 大小路由：
 *   < 100KB  → 正常全读（原行为）
 *   >= 100KB → 自动采样输出（前 30 行 + 文件信息）
 *   指定 raw=true 或 :行号 选择器 → 跳过采样，用户明确要求
 */
import { readFile, access, stat, open } from 'fs/promises';
import type { KfmTool, ToolResult } from '../types.js';

const SAFE_LIMIT = 100 * 1024;   // 100KB — 安全全读阈值
const HEAD_BYTES = 4096;          // 采样时只读前 4KB
const SAMPLE_HEAD_LINES = 30;     // 采样输出行数

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export const ompReadTool: KfmTool = {
  name: 'read',
  description: '读取文件内容。自动对 <100KB 全读，>100KB 采样输出。传 raw=true 或 :行号 选择器跳过采样。',
  category: 'omp',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: '文件路径，支持 :行号 选择器（如 src/index.ts:50-100）' },
      raw: { type: 'boolean', description: '设为 true 跳过采样，全量读取' },
    },
    required: ['path'],
  },
  async execute(params): Promise<ToolResult> {
    let rawPath = params.path as string;
    const raw = !!params.raw;

    // 解析行选择器（path:行号 或 path:起始-结束）
    let selector: string | null = null;
    const colonIdx = rawPath.lastIndexOf(':');
    if (colonIdx > 1 && !rawPath.startsWith('/:')) {
      const potential = rawPath.slice(colonIdx + 1);
      if (/^\d+(-?\d*)?$/.test(potential)) {
        selector = potential;
        rawPath = rawPath.slice(0, colonIdx);
      }
    }

    // 检查文件存在性
    try {
      await access(rawPath);
    } catch {
      return { content: [{ type: 'text', text: `文件不存在: ${rawPath}` }], isError: true };
    }

    // 获取文件大小
    let fileSize = 0;
    try {
      fileSize = (await stat(rawPath)).size;
    } catch { /* 非致命，继续 */ }

    // ─────── 大小路由 ───────
    // 条件：小文件 或 用户明确要求全量
    const skipSampling = raw || selector !== null || fileSize < SAFE_LIMIT;

    try {
      if (skipSampling) {
        // 路径 A：全量读取
        let content = await readFile(rawPath, 'utf8');
        if (!raw && content.length > SAFE_LIMIT) {
          content = content.slice(0, SAFE_LIMIT)
            + `\n\n--- 文件较大 (${fmtSize(fileSize)})，仅显示前 ${fmtSize(SAFE_LIMIT)} ---`
            + '\n--- 传 raw=true 读取完整内容，或用 :行号 选择范围 ---';
        }
        if (selector) {
          const [start, end] = selector.split('-').map(Number);
          const lines = content.split('\n');
          const s = Math.max(1, start || 1) - 1;
          const e = end ? Math.min(lines.length, end) : lines.length;
          content = lines.slice(s, e).join('\n');
        }
        return { content: [{ type: 'text', text: content }] };
      }

      // 路径 B：采样模式（只读文件头部 4KB，不全文加载）
      const fd = await open(rawPath, 'r');
      try {
        const buf = Buffer.alloc(HEAD_BYTES);
        const { bytesRead } = await fd.read(buf, 0, HEAD_BYTES, 0);
        const headText = buf.toString('utf8', 0, bytesRead);
        const headLines = headText.split('\n').slice(0, SAMPLE_HEAD_LINES);

        const output = [
          `📄 ${rawPath}`,
          `大小: ${fmtSize(fileSize)}`,
          `类型: 文本，超过安全读取阈值 (${fmtSize(SAFE_LIMIT)})`,
          '',
          `采样 (前 ${SAMPLE_HEAD_LINES} 行):`,
          '---',
          ...headLines,
          '---',
          '',
          `文件较大，自动降级为采样。如需读取完整内容：`,
          `  • 传 raw=true 强制全量读取`,
          `  • 用 :行号 选择范围（如 :1-50）`,
        ].join('\n');

        return { content: [{ type: 'text', text: output }] };
      } finally {
        await fd.close();
      }
    } catch (e) {
      return { content: [{ type: 'text', text: `读取失败: ${e instanceof Error ? e.message : '未知错误'}` }], isError: true };
    }
  },
};
