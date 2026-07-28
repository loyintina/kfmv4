> 这是什么：Browser 工具（omp 移植）架构与踩坑记录。
> 别的去哪找：AI 工具总览 → contract.md；移植时间线 → ../../ledger/history.md。

# Browser 工具细节（2026-07-18 自 omp 移植）

## 架构

```
browser.ts (KfmTool 入口: open/run/close) → tab-supervisor.ts (node:worker_threads)
  → [worker] tab-worker.ts WorkerCore (puppeteer) → CDP → Chromium (headless)
```

cmux 路径已删除（附着真实 Chrome 用，kfmv4 不需要）。

## #踩坑（改 browser 工具前必读）

1. **stealth patches 破坏 page.evaluate()（🔴）**：`applyStealthPatches` patch 了
   `Function.prototype.toString`，worker 线程序列化函数得空字符串。
   解法：headless 跳过 stealth。**通则：修改 JS 全局原型的注入脚本都可能破坏
   依赖序列化的工具。**
2. **Node 22 strip-only 不支持 TS 参数属性**：`constructor(readonly x)` 在
   tsx worker 里炸。写法：普通属性 + 构造器内赋值。
3. **tsx worker execArgv 冲突**：必须过滤 `--eval`。最终方案：esbuild 预编译
   `tab-worker-entry.js`，worker 直接加载 .js，不走 tsx loader。
4. **Promise.withResolvers 是 ES2024**：项目 target ES2022，用内联 res/rej 模式。
5. **@mozilla/readability / linkedom 无依赖**：用 regex 标签剥离 + article/main
   提取，对 AI 消费足够。

## 文件依赖图

```
browser.ts → tab-supervisor.ts ├→ launch.ts ├→ tab-worker-entry.js(编译后)
  → tab-worker.ts ├→ aria/aria-snapshot.ts ├→ readable.ts ├→ run-cancellation.ts
  └→ tab-protocol.ts(类型)        └→ ../../types.ts(ToolError/ToolAbortError)
```
