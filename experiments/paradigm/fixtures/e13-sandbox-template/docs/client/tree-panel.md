# 文件树面板

- **所属工作流**：浏览
- **代码位置**：`src/config/limits.ts`（`MAX_TREE_DEPTH`）

文件树卡片按层级展开，最大展开深度由 `MAX_TREE_DEPTH` 配置控制。
深度上限是产品决策：再深的层级改用搜索而非逐层展开。
