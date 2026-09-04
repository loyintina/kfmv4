/**
 * 工具块索引映射器 — BAR-106 核心逻辑。
 *
 * provider 的 tc.index → 客户端连续块索引：text 恒占 0，工具块从 1 起按首见顺序
 * 连续递增。必须连续——Claude 等 provider 的 tc.index 可能不从 0 起（如 1），若直接
 * 用 idx+1 会在客户端 content 数组留下 undefined 空洞，.filter(b=>b.type) 读空洞即崩。
 * 同一 providerIdx 多次映射返回同一 clientIdx（幂等）。
 *
 * 双端共享：服务端 streamChat 用它映射 yield 的 index，客户端 reducer 用它验证
 * 事件索引连续性。v8 协议层核心——消除双端实现漂移。
 */

export function createClientIdxMapper(): { clientIdx: (providerIdx: number) => number } {
  const toolBlockIdx = new Map<number, number>();
  let nextToolBlock = 1;
  return {
    clientIdx(providerIdx: number): number {
      let ci = toolBlockIdx.get(providerIdx);
      if (ci === undefined) { ci = nextToolBlock++; toolBlockIdx.set(providerIdx, ci); }
      return ci;
    },
  };
}
