---
status: superseded
superseded_by: docs/design/WORKBENCH_SPEC.md
archived_at: 2026-06-26
---

# 卡片工作台 Phase 4 — 文件渲染器（实施完成）

> 本文是 `WORKBENCH_SPEC.md` §11 Phase 4 的详细实施记录。
> Phase 4 A–F 已在 v6.9.1 完成，4G（反向新建文件）推迟到 Phase I。

---

## 实施概览

Phase 4 为文件浮卡实现了按文件类型分发的多渲染器系统，覆盖文本编辑、代码高亮、Markdown 预览、数学公式、流程图、图片预览等场景。

### 完成的子任务

| 子任务 | 内容 | 版本 |
|--------|------|------|
| 4A | 基础设施：类型路由表 + `CardContentHandler` 工厂 (`handler-factory.ts`) | v6.7.0 |
| 4B | 文本/代码预览+编辑：textarea + save API (`POST /api/files/write`) | v6.7.0 |
| 4C | 富媒体 + 二进制：图片查看器 / 文件元信息展示 | v6.7.0 |
| 4D | highlight.js 代码高亮 + 复制按钮 + 复选框自定义样式 | v6.8.0 |
| 4E | KaTeX 数学公式 + Mermaid 流程图 (CDN 动态加载) | v6.9.1 |
| 4F | 图片预览 (`<img>` 渲染 + `GET /api/files/media` 端点) | v6.9.1 |
| **4G** | **反向新建文件** | **⏸️ 推迟到 Phase I** |

---

## 架构要点

### `handler-factory.ts` — 核心工厂

```typescript
createFileHandler(filePath, accent?)
  → { activate: (el: HTMLElement) => void; deactivate: (el: HTMLElement) => void }
```

内部维护 `_mode: 'preview' | 'edit'` 状态变量，`_renderPreview()` / `_renderEdit()` 按模式切换内容。

### 模式切换 UI

```
标题栏 ┌──────────────────────────────────────┐
        │  文件名.md              [👁 预览] [✏️ 编辑] │
分隔线 ──────────────────────────────────────
正文区 │  _body (flex:1, overflow:auto)         │
        │  预览态 → 渲染 Markdown                  │
        │  编辑态 → <textarea> 原文编辑             │
       └──────────────────────────────────────┘
```

- 预览/编辑按钮互斥高亮，继承卡片的 `color2` accent 色
- 编辑态 `Ctrl+Enter` 保存，保存后自动切回预览态
- 滚动位置在模式切换间同步

### 文件类型路由

| 类型 | 预览模式 | 编辑模式 |
|------|---------|---------|
| Markdown | marked 渲染 + KaTeX 数学公式 + Mermaid 图表 | textarea |
| 代码 | highlight.js 语法高亮 | textarea |
| 纯文本 | `<pre>` 等宽显示 | textarea |
| 图片 | `<img>` 自适应居中 | 同预览 |
| 二进制 | 文件名 + 大小 + 类型 info | 同预览 |

### KaTeX / Mermaid CDN 加载

沿用动态 `<script>` 注入模式（`math-diagram.ts:57`）：
- KaTeX: `https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js`
- Mermaid: `https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js`
- `build.mjs` 客户端 `external: ['katex', 'mermaid']`
- `check-as-any.mjs` 白名单登记 `window.katex` / `window.mermaid`
- `katex-css.ts` 内置完整 KaTeX CSS (~23KB)

### 复选框交互

Markdown 正文中的 `- [x]` 复选框：
- CSS 完全自定义样式（`appearance:none` + 内联 SVG 对勾）
- 点击同步 `_rawContent` 源文本（正则替换 `[x]` ↔ `[ ]`）
- 自动保存到文件

### 相关文件

| 文件 | 职责 |
|------|------|
| `src/client/modules/renderers/handler-factory.ts` | 文件处理器工厂 (291 行) |
| `src/client/modules/renderers/math-diagram.ts` | KaTeX + Mermaid 预处理/后处理 |
| `src/client/modules/renderers/katex-css.ts` | 完整 KaTeX CSS (23KB) |
| `src/client/modules/renderers/code-highlight.ts` | highlight.js 高亮 + 复制按钮 |
| `src/client/modules/renderers/md-extensions.ts` | Markdown 扩展预处理 |
| `src/client/modules/renderers/file-type.ts` | 文件类型映射 |
| `src/client/modules/renderers/binary-fallback.ts` | 二进制文件信息展示 |
| `src/server/index.ts` | `GET /api/files/media` + `POST /api/files/write` |

---

## 推迟：4G 反向新建文件

> **推迟理由**（2026-06-25）：文件树内"新建文件夹/新建文件"已覆盖日常需求。反向从卡片堆新建文件需要模板系统支撑，适合与 Phase I（卡片插件系统）一起实施。
>
> 设计方向已记录在 `WORKBENCH_SPEC.md` §11 Phase 4G。

---

## 备注

- Phase 4 A–F 实施共产生 ~360 行新代码（含修改）
- 首次运行 `npm run check` 确认 `katex-css.ts` 超过 2000 字符行，`check-docs.mjs` 提示拆分
- `marked` 库使用动态 `import()` 按需加载（不进 bundle）
- 所有触控事件通过 GestureRegistry 注册，无逃逸
