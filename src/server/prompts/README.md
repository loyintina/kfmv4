# prompts 目录语义（加文件前先读这里）

`src/server/prompts/` 下按**生效方式**分三个目录，别放错：

| 目录 | 语义 | 生效方式 | 举例 |
|------|------|---------|------|
| `tools/` | 工具使用文档 | **自动**——全部注入 system（作为「可用工具」段） | `read.md`、`bash.md` |
| `global/` | 全局预设提示词 | **自动**——目录下所有 md 注入静态 system 段，全部会话强制，**独立于角色卡** | `evidence-discipline.md`（证据纪律） |
| `system/` | 挂载型提示词 | **手动**——角色卡 `promptFiles` 列出才生效（见 `.kfmv4/roles/*.json`） | `base.md`（工程架构师职业卡，由蔚然-kfmv4 卡挂载） |

## 判断放哪

- 想让**所有会话**（无论挂什么角色卡）都收到 → 放 `global/`。注意：它不会被
  `prompts/system/` 的挂载机制管，**不要**再把它加进角色卡 `promptFiles`，否则重复注入。
- 想让**特定角色**才收到 → 放 `system/`（或任意路径），并在角色卡 `promptFiles`
  里声明。
- 工具的能力/参数/规则说明 → 放 `tools/`（文件名 = 工具名）。

## 全局预设的约定

`global/` 下每个 md 是一段独立约束，建议：

1. 标题用「# 规则名（适用对象）」；正文用**命令式硬规则**（「禁止/必须」），
   参考 `evidence-discipline.md` 的措辞强度；
2. 别把临时想法放这里——全局预设对每个会话都生效，是最高优先级行为约束，
   进 `global/` 前先在普通会话里验证过效果；
3. 文件按字母序注入（`readdirSync` 排序），跨文件不要依赖顺序。

## 实现位置

- `tools/`、`global/`：`src/server/ai/chat.ts`（loadToolDocs / globalPrompts）
- `system/` 挂载：`src/server/ai/prompt-assembler.ts`（assembleRoleSystemPrompt）
