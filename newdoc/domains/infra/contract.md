> 这是什么：构建管线、测试体系、检查脚本。
> 别的去哪找：测试方法论 → ../../guides/testing.md；服务端运行时 → ../server/。

# infra 域契约

## 构建（build.mjs）

- client：esbuild IIFE bundle + minify；`?v=` 缓存指纹（immutable 缓存头）。
- server：ESM bundle——**external 列表是生死线**（CJS 包打进去启动即崩）。
- 样式：`sass base.scss → base.css`（check 链内自动编译）。

## 检查管线（npm run check，20 脚本，顺序固定）

`check-uncommitted`（>3 未提交即中断，首位）→ versions → checks → doc-coverage →
sass → css-wiring → tool-compaction → anim → as-any → card-meta → registry → zindex →
console → docs → consistency → active-stack → code-doc-refs → workflow-integrity → cards → contract-freshness →
test-patterns → tsc。

## 硬规则

1. **新 check 一律 hard fail**——warning 对 agent 等于不存在。
2. **新增工具/卡片/模块必须过对应双向核对 check**（tool-compaction/cards/registry），
   不登记 = 构建中断。
3. **新增服务端依赖同步 build.mjs external 列表**。
4. **禁止 (as any)**（自 INVARIANTS §四.2）：新建代码零逃逸，check-as-any 扫描，
   新增逃逸构建中断；确因类型定义缺失必须 ① check-as-any WHITELIST 登记（注释原因）
   ② 代码行加 `// P2:` 备注根因。

## #陷阱

1. **改 `.css` 前查 `.scss` 源**——直接改 .css 会被下次 sass 编译覆盖。
   案例：2026-07-06 全屏卡 touch-action 被覆盖。
2. **esbuild nullish-coalescing 降级**：源码大量 `??`，TS 编译需确保正确降级。
3. **GSAP mock 时序**：`tl.call(cb)` 同步执行回调，改变动画时序——测试不用墙钟计时器。
4. **测试计数同步**：改测试数后跑 check 自动回写文档计数（check-test-patterns 验证模式完整性）。

## 文件清单

`build.mjs` `check-*.mjs`（20 个，仓库根）`tests/`（regression.test.ts + smoke/）
`public/css/`（scss 源）`package.json`（check 链定义）
测试分层与纪律 → ../../guides/testing.md
