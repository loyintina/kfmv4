/**
 * 探针夹具的假变异物料：find 锚点嵌着过期的 check 计数（实 2 写 1）。
 * sync-counts 已把本文件纳入回写面（BAR-SYNCCOUNTS-02），--check-only 应报漂移。
 * replace 是故意错数（变异物料本体），sync-counts 只许动 find 行。
 */
export const MUTATIONS = [
  {
    id: 'M01', level: 'L1', sem: 'SEM001', file: 'README.md', expect: 'report',
    find: '**1 个 check-* 脚本 + 1 个回归测试**',
    replace: '**0 个 check-* 脚本 + 1 个回归测试**',
    tasks: [],
  },
];
