// 夹具：空压缩器注册表——fake_tool 已注册但无登记条目
export interface CompactorEntry { exempt?: string }
export const COMPACTOR_REGISTRY: Record<string, CompactorEntry> = {};
export const COMPACTOR_NAMES: string[] = Object.keys(COMPACTOR_REGISTRY);
