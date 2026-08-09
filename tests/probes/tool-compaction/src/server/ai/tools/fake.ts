import type { KfmTool } from './types.js';

export const fakeTool: KfmTool = {
  name: 'fake_tool',
  description: '夹具假工具',
  category: 'test',
  parameters: {
    type: 'object',
    properties: {
      alpha: { type: 'string', description: '参数 A' },
      beta: { type: 'number', description: '参数 B' },
    },
    required: ['alpha'],
  },
};
