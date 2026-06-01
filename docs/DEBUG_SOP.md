# KFM v4 调试标准操作规程（SOP）

> 遇到视觉效果不符合预期时，先按此流程排查，不要跳步去改 CSS 值。
> 本文档是标准操作流程，不是隐性契约。隐性契约见 `BUG_AUDIT_REGISTRY.md` 第一章。
> 根因案例库见 `BUG_AUDIT_REGISTRY.md` 第二章。

---

## CSS/视觉 Bug 排查三步法

### 第一步：CSS 解析检查

- 在浏览器 DevTools 检查 `document.styleSheets`：争议规则是否存在于 `cssRules` 中？
- 如果规则不存在 → **CSS 语法错误**：检查该规则前最近一条未闭合的 `{`/`(`/`[`
- 如果规则存在但计算样式不匹配 → 检查 **CSS 优先级**（是否有更高优先级的规则覆盖）
- 如果规则存在且优先级正确 → 检查 **选择器是否匹配**（className 拼写、空格/伪类/specificity）

### 第二步：工具编辑安全

- `edit` 工具替换行范围时，检查替换的最后一行是否包含了 `}`/`;`/`)` 等闭合字符
- 如果替换范围外的下一行恰好是结束括号 → 修改替换范围将其纳入
- 如果替换 CSS 块 → 始终在替换内容末尾显式写 `}`，即使原范围外也有

### 第三步：浏览器二次确认

- 修改后强制无缓存刷新（DevTools Network 勾选 Disable cache，或 URL 加 `?v=timestamp`）
- 用 `getComputedStyle(el)` 验证争议属性的**计算值**
- 不要只看 Elements 面板的 Styles 区——它有时显示的是级联规则而不是实际生效值

---

## 动画/交互 Bug 排查路径

（待补充——当前参考 `BUG_AUDIT_REGISTRY.md` 第二章根因案例库）

---

## 关联文档

| 文档 | 用途 |
|------|------|
| `BUG_AUDIT_REGISTRY.md` | 隐性契约 + 根因案例库 |
| `KFM_V4_INVARIANTS.md` | 修改代码前的自查清单 |
| `HANDOFF_AUDIT.md` | 项目交接与待办总览 |
