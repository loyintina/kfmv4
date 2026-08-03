# page-state.md 格式说明（眼睛动态文件）

> 本文档描述**动态提示词文件** `page-state.md` 的内容形态——AI（或人）在
> 挂载该动态文件前，先读本文档了解里面会出现什么、什么格式、何时刷新。
> 文件本体由程序生成，**不要手动编辑**；格式演进以 `src/server/ai/page-state.ts`
> 为准，本文档同步维护。

## 是什么

「眼睛」——kfmv4 面板浏览器页面的实时状态投影，MUD/文字冒险风格的「房间描述」。
它回答 AI 三个问题：**你在哪 / 你能看到什么 / 你能做什么**。

## 位置与刷新时机

- **位置**：`.kfmv4/prompts/dynamic/page-state.md`（数据目录，随用户数据走；
  与源码 `src/server/prompts/dynamic/`（说明文档）路径对称）
- **刷新**：每次工具调用后由 `page-state.ts` 的 `refreshPageState()` 重写
  （读取 wsServer 的浏览器页面快照渲染）
- **注入**：角色卡 `dynamicPromptFiles` 引用 → 每轮 LLM 调用前 `assembleDynamicPrompt`
  重读，注入对话尾部 user 消息（包裹「感官注入」分隔线 + 使用规则）
- **不出现的情况**：角色卡没在 `dynamicPromptFiles` 里列它 → 不注入（零影响）；
  服务启动但浏览器没连上 wsServer → 快照为空时渲染为「当前无页面状态」之类占位

## 格式（三段式）

```
# 当前页面状态

> 本节由系统在每次工具调用后自动刷新，反映你的操作对页面的实际影响。

## 你能看到什么
- **text-output**：最后一条消息: <最近一条聊天消息的截断文本>
- **card-content**：卡片堆: [当前/总数] <焦点卡标题>
- **file-tree**：根目录: <cwd> | 展开: <展开的目录/文件路径列表，超量 +N项>

## 当前页面元素
- **<标签>**（<type>） [<state>] — 操作后：<点击/输入的效果描述>
  （每个可交互元素一行，含 type/state/effect 三要素）

## 你能做什么
（当前无额外可调用能力）   ← 或列出可用能力清单
```

### 可能出现的关键文本形态

| 形态 | 说明 | 示例 |
|------|------|------|
| 元素类型 | button / text-input / panel / icon / floating-button | `光球（floating-button）` |
| 状态标签 | `[closed] [hidden] [active] [collapsed] [expanded]` | `侧栏开关（button） [closed]` |
| 操作效果 | 固定句式「操作后：<结果>」 | `操作后：点击切换侧栏打开/关闭状态` |
| 元素标签 | 中文描述名（侧栏开关/光球/AI 输入栏/文件树…） | `AI 输入栏（text-input） [hidden]` |
| 能力清单 | 「你能做什么」段（工具循环可用操作） | `（当前无额外可调用能力）` |

### 内容会随什么变化

- 用户在浏览器里的实际操作（开侧栏/展开文件树/点卡片）→ 元素 state、file-tree 展开变化
- AI 自己的工具操作（open-sidebar/select-file 等远程命令）→ 操作后效果写回
- 聊天进行 → text-output 变成最后一条消息

## 使用注意（与 evidence-discipline 呼应）

1. **投影可能滞后或不完整**——它是页面快照的渲染，不是证据源；
2. 涉及文件内容/状态/计数的断言，**以工具读取的实际结果为准**，不拿眼睛内容当依据；
3. 感官与工具结果冲突时，以工具结果为准（注入 wrap 已声明，AI 应遵守）；
4. 不要主动提及「我看到/眼睛察觉到」——信息直接取用即可（wrap 使用规则）。

## 挂载方式（角色卡）

```json
{ "dynamicPromptFiles": ["/root/.kfmv4/prompts/dynamic/page-state.md"] }
```

自建其他动态提示词：文件放 `.kfmv4/prompts/dynamic/` 下（或其他数据目录），
角色卡 `dynamicPromptFiles` 引用；说明文档放 `src/server/prompts/dynamic/`。
