import type { KfmTool } from './types.js';
import { fakeTool } from './fake.js';

const tools = new Map<string, KfmTool>();
tools.set(fakeTool.name, fakeTool);

export function getToolDefinitions() {
  return Array.from(tools.values()).map(t => ({
    name: t.name,
    description: t.description,
    category: t.category,
    parameters: t.parameters,
  }));
}
