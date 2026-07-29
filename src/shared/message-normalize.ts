/**
 * message-normalize.ts — 消息块归一化（纯函数，BAR-ORB-EMPTY-01）
 *
 * 背景：某些模型/端点把**最终回复**全写进 reasoning_content、content 留空
 * （todo工具测试会话尸检：#579/#593/#656 的完整交付报告埋在 reasoning 里）。
 * 这类消息 text=='' && reasoning 非空——显示成「已思考+无回复」，进 API 载荷
 * 则成空 assistant（严格端点 kimi 400，BAR-PROVIDER-02 已在边界过滤）。
 *
 * 归位规则（仅适用于**正常结束**的消息；取消残留的半截思考不归位——
 * 那是真实历史，且取消路径有独立的 [已取消] 标注消息）：
 *   text 空且 reasoning 非空 → reasoning 提升为 text，reasoning 清空。
 * 读时归一化（加载历史）与写时归位（message_stop）共用本函数，会话文件不改写。
 */

export interface NormalizableBlock {
  type: string;
  text?: string;
  reasoning?: string;
}

export function promoteReasoningBlocks<T extends NormalizableBlock>(blocks: T[]): T[] {
  for (const b of blocks) {
    if (b?.type === 'text' && !(b.text || '').length && (b.reasoning || '').length) {
      b.text = b.reasoning as string;
      b.reasoning = '';
    }
  }
  return blocks;
}
