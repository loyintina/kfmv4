export type { TextBlock, ToolBlock, RuleWarningBlock, ContentBlock, ChatMessage } from './messages.js';
export type { StreamEvent } from './events.js';
export { createClientIdxMapper } from './block-idx.js';
export { applyEvent, reduceEvents, type ReduceContext } from './reducer.js';
