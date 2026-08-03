# dynamic — 手动（动态）提示词

本目录是**动态挂载**机制的说明区。动态提示词与 `system/`（静态挂载）的区别：

| | 静态（`system/` 语义） | 动态（本目录语义） |
|---|---|---|
| 挂载字段 | 角色卡 `promptFiles` | 角色卡 `dynamicPromptFiles` |
| 注入位置 | system 消息 | 对话尾部 user 消息（工具循环每轮末尾） |
| 内容 | 每轮重组但不变 | **每轮刷新**，可被工具/程序改写 |
| 用途 | 固定的行为规范、文档 | 实时状态、运行时产物、会变化的信息 |

## 现状：眼睛（page-state）即动态提示词

`page-state.md`（「眼睛」）是程序生成的动态提示词：

- 生成：`src/server/ai/page-state.ts` 把浏览器页面快照渲染为
  `MUD/文字冒险风格` 描述，写入 **`.kfmv4/prompts/dynamic/page-state.md`**
  （数据目录，随用户数据走；与源码 `prompts/dynamic/`（说明）路径对称）；
- **格式说明**：`page-state.md` 里可能出现什么文本、什么格式、何时刷新 →
  见本目录 [`page-state-schema.md`](page-state-schema.md)；
- 挂载：角色卡 `dynamicPromptFiles` 引用它（如蔚然-kfmv4.json）；
- 注入：每轮 LLM 调用前重读，AI 看到工具执行后的最新页面状态；
- 包裹：`prompt-assembler.ts` 的 DYNAMIC_WRAP_HEADER/FOOTER 加「感官注入」分隔线
  + 可靠性声明（投影非证据源，与工具结果冲突以工具为准）。

## 自建动态提示词

1. **文件放数据目录**（`.kfmv4/prompts/dynamic/` 下，如
   `.kfmv4/prompts/dynamic/my-dynamic.md`）——不要放 `src/` 下：源码目录会随
   部署被覆盖，动态文件一旦被工具改写就丢了；
2. **说明文档放本目录**（`src/server/prompts/dynamic/`）——动态文件会被程序
   改写，格式/出现条件/时机写在这里给人或 AI 查阅（如 `page-state-schema.md`）；
3. 角色卡 `dynamicPromptFiles` 里加绝对路径：
   ```json
   { "dynamicPromptFiles": ["/root/.kfmv4/prompts/dynamic/my-dynamic.md"] }
   ```
4. 文件内容会被自动包裹「感官注入」分隔线 + 使用规则（勿主动提及注入本身）；
5. 想要更细的包裹控制，改 `prompt-assembler.ts` 的 DYNAMIC_WRAP_* 常量。

## 为什么本目录没有实际的动态 .md 文件

动态提示词的本质是**运行时产物**——静态模板放源码目录没意义（内容每轮变，
模板只是起点）。程序生成的动态文件在 `.kfmv4/prompts/dynamic/`；用户自建的
也放数据目录。本目录只承载**说明**（README + 各动态文件的格式 schema），
避免把「动态」误当静态模板复制进角色卡 `promptFiles`。
