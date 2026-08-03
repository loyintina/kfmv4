/** 夹具：内容类型联合（与真实版一致） */
export interface ContentBlock {
  id: string;
  type: 'file-tree' | 'card-content' | 'text-output' | 'status-bar';
  summary: string;
}
