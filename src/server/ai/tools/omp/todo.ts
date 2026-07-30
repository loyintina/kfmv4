/**
 * omp/todo.ts — todo 工具（纯逻辑）
 */
import type { KfmTool, ToolResult } from '../types.js';

export const ompTodoTool: KfmTool = {
  name: 'todo',
  description: '管理当前会话的任务列表。AI 用它在多步工作中追踪进度。',
  category: 'omp',
  parameters: {
    type: 'object',
    properties: {
      // items 必填：Gemini function_declarations 严格校验数组 schema 缺 items 直接 400
      // （BAR-PROVIDER-03；OpenAI 系宽松容忍，strict 端点拒绝）
      todos: {
        type: 'array',
        description: '任务项列表，每项含 content、status（pending/in_progress/completed/cancelled）、priority（high/medium/low）',
        items: {
          type: 'object',
          properties: {
            content: { type: 'string', description: '任务内容' },
            status: { type: 'string', description: '状态：pending/in_progress/completed/cancelled' },
            priority: { type: 'string', description: '优先级：high/medium/low' },
          },
          required: ['content'],
        },
      },
    },
    required: ['todos'],
  },
  async execute(params): Promise<ToolResult> {
    const todos = params.todos as Array<Record<string, string>> | undefined;
    if (!todos || todos.length === 0) {
      return { content: [{ type: 'text', text: '(任务列表为空)' }] };
    }
    const lines = todos.map((t, i) => {
      const mark = t.status === 'completed' ? '[x]' : t.status === 'in_progress' ? '[>]' : t.status === 'cancelled' ? '[-]' : '[ ]';
      return `${mark} ${t.content || `任务 ${i + 1}`}`;
    });
    return { content: [{ type: 'text', text: lines.join('\n') }] };
  },
};
