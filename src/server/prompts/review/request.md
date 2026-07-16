# 代码审查请求

## 审查模式

{{mode}}

## 变更文件（{{len files}} 个文件，+{{totalAdded}}/-{{totalRemoved}} 行）

{{#if files.length}}
{{#table files headers="文件|+/-|类型"}}
{{path}} | +{{linesAdded}}/-{{linesRemoved}} | {{ext}}
{{/table}}
{{else}}
无待审查文件。
{{/if}}

## 分发指南

按文件局部性分组，例如：
- 同一目录/模块 → 同一个审查者
- 相关功能 → 同一个审查者
- 测试文件与其实现文件 → 同一个审查者

## 审查者指令

审查者必须：
1. 只关注分配的文件
2. 使用下方的 diff 区块（勿重新运行 git diff）
3. 理解代码上下文
4. 结论使用具体的文件和行号引用

## Diff

<diff>
{{rawDiff}}
</diff>

{{#if additionalInstructions}}
## 补充指令

{{additionalInstructions}}
{{/if}}
