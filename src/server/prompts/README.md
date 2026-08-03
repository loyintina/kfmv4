# prompts 目录语义（加文件前先读这里）

`src/server/prompts/` 下按**生效方式**分三类，别放错：

| 目录 | 类别 | 生效方式 | 举例 |
|------|------|---------|------|
| `global/` | 预设（自动） | **自动注入**——目录下所有 md 进静态 system 段，全部会话强制，独立于角色卡 | `evidence-discipline.md`（证据纪律） |
| `system/` | 手动（静态） | **角色卡 `promptFiles` 挂载**——每轮重组但内容不变，挂哪个角色卡就进哪个会话 | `base.md`（工程架构师职业卡，由蔚然-kfmv4 卡挂载） |
| `dynamic/` | 手动（动态） | **角色卡 `dynamicPromptFiles` 挂载**——每轮刷新注入对话尾部（user 消息），内容可被工具改写 | 见 `dynamic/README.md`（眼睛 page-state 即此类，运行时生成于 `.kfmv4/`） |

> `tools/` 是第四类：工具使用文档，自动注入（作为「可用工具」段），见下。

## 判断放哪

1. 想让**所有会话**（无论挂什么角色卡）都收到 → 放 `global/`。
   **不要**再把它加进角色卡 `promptFiles`，否则重复注入。
2. 想让**特定角色**收到、内容固定不变 → 放 `system/`（或任意路径），角色卡
   `promptFiles` 声明。
3. 想让**特定角色**收到、内容**每轮刷新**（如实时状态、可被工具改写的文件）→
   走 `dynamic/` 机制（角色卡 `dynamicPromptFiles`），详见 `dynamic/README.md`。
4. 工具的能力/参数/规则说明 → 放 `tools/`（文件名 = 工具名）。

## 全局预设（global/）的约定

1. 标题用「# 规则名（适用对象）」；正文用**命令式硬规则**（「禁止/必须」），
   参考 `evidence-discipline.md` 的措辞强度；
2. 别把临时想法放这里——全局预设对每个会话都生效，是最高优先级行为约束，
   进 `global/` 前先在普通会话里验证过效果；
3. 文件按字母序注入（`readdirSync` 排序），跨文件不要依赖顺序。

## 实现位置

- `tools/`、`global/`：`src/server/ai/chat.ts`（loadToolDocs / globalPrompts）
- `system/` 静态挂载：`src/server/ai/prompt-assembler.ts`（assembleRoleSystemPrompt）
- `dynamic/` 动态挂载：`src/server/ai/prompt-assembler.ts`（assembleDynamicPrompt）
