# prompts 目录语义（加文件前先读这里）

`src/server/prompts/` 下按**生效方式**分三类，别放错：

| 目录 | 类别 | 生效方式 | 内容 |
|------|------|---------|------|
| `global/` | 预设（自动） | **自动注入**——顶层 `*.md` 进静态 system 段，全部会话强制，独立于角色卡 | `evidence-discipline.md`（证据纪律） |
| `global/tools/` | 工具文档（自动） | **自动注入**——作为「可用工具」段（文件名 = 工具名） | `read.md`、`bash.md` 等 15 个 |
| `system/` | 手动（静态） | **角色卡 `promptFiles` 挂载**——每轮重组但内容不变，挂哪个角色卡就进哪个会话 | `base.md`（工程架构师职业卡，由蔚然-kfmv4 卡挂载） |
| `dynamic/` | 手动（动态） | **角色卡 `dynamicPromptFiles` 挂载**——每轮刷新注入对话尾部（user 消息），内容可被工具改写 | 见 `dynamic/README.md`（眼睛 page-state 即此类，运行时生成于 `.kfmv4/`） |

## 判断放哪

1. 想让**所有会话**（无论挂什么角色卡）都收到、且不是工具说明 → 放 `global/`
   顶层。**不要**再把它加进角色卡 `promptFiles`，否则重复注入。
2. 工具的能力/参数/规则说明 → 放 `global/tools/`（文件名 = 工具名，自动进
   「可用工具」段）。
3. 想让**特定角色**收到、内容固定不变 → 放 `system/`（或任意路径），角色卡
   `promptFiles` 声明。
4. 想让**特定角色**收到、内容**每轮刷新**（实时状态、可被工具改写的文件）→
   走 `dynamic/` 机制（角色卡 `dynamicPromptFiles`），详见 `dynamic/README.md`。

## 全局预设（global/ 顶层）的约定

1. 标题用「# 规则名（适用对象）」；正文用**命令式硬规则**（「禁止/必须」），
   参考 `evidence-discipline.md` 的措辞强度；
2. 别把临时想法放这里——全局预设对每个会话都生效，是最高优先级行为约束，
   进 `global/` 前先在普通会话里验证过效果；
3. 文件按字母序注入（`readdirSync` 排序），需要置顶的用数字前缀
   （如 `00-evidence-discipline.md`）。

## 实现位置

- `global/` 顶层与 `global/tools/`：`src/server/ai/chat.ts`
  （globalPrompts / loadToolDocs，readdirSync 不递归，两层互不干扰）
- `system/` 静态挂载：`src/server/ai/prompt-assembler.ts`（assembleRoleSystemPrompt）
- `dynamic/` 动态挂载：`src/server/ai/prompt-assembler.ts`（assembleDynamicPrompt）
