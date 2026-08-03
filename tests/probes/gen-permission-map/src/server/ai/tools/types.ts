/** 夹具：KfmTool 最小接口 */
export interface KfmTool {
  name: string;
  description: string;
  category: string;
  parameters: {
    type: string;
    properties: Record<string, { type?: string; description?: string; enum?: string[] }>;
    required?: string[];
  };
}
