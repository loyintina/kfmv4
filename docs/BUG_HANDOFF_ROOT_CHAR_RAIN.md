# Bug 交接：根目录展开无字符雨动画

> 接手者：你需要在手机浏览器上打开 kfmv4 并查看控制台日志。

## 症状

- 展开根目录（`/root`）文件夹：盒子正常展开，toggle 正常旋转，但**看不到字符散落动画**
- 展开任意第二层子目录（如 `/root/src`）：**字符雨正常可见**
- 此 bug 在 collapseSubs 清除重构前就已存在，不是近期引入的

## 关键代码位置

| 文件 | 行号 | 作用 |
|------|------|------|
| `src/client/modules/tree-render.ts` | ~640 | `doExpand`：读取 `_fullHeight`，决定是否创建 overlay |
| `src/client/modules/tree-render.ts` | ~710 | `doExpand`：调用 `_setupExpandOverlays` + `animateCharRain` |
| `src/client/modules/tree-render.ts` | ~1000 | `_ensureMetaFromExpandedState`：设置 `_fullHeight` |
| `src/client/modules/char-rain.ts` | ~50 | `animateCharRain` 入口：收集 rows，检查 `rows.length` |

## 调试步骤

**第一步：加临时日志。** 在以下三处加 `console.log`：

### 1. `tree-render.ts` — `doExpand` 中，overlay 创建之前（约第 710 行）

在 `const pack = _setupExpandOverlays(...)` 之前加：

```typescript
console.log('[DEBUG-RAIN] doExpand path=', hitData.path, 'fullHeight=', fullHeight, 'container.children=', container.children.length);
```

### 2. `tree-render.ts` — `doExpand` 中，`animateCharRain` 调用之前（约第 713 行）

在 `animateCharRain(...)` 之前加：

```typescript
console.log('[DEBUG-RAIN] about to call animateCharRain, rowTargetYs=', rowTargetYs);
```

### 3. `char-rain.ts` — `animateCharRain` 入口（约第 50 行）

在 `const rows = container.children.filter(...)` 之后加：

```typescript
console.log('[DEBUG-RAIN] animateCharRain called, container.id=', container.id, 'rows.length=', rows.length, 'rowTargetYs=', rowTargetYs);
```

**第二步：在手机上测试。**

1. 打开 kfmv4，打开浏览器控制台
2. 展开根目录 → 看日志输出
3. 展开一个子目录 → 看日志输出
4. 对比两组的 `fullHeight`、`container.children.length`、`rows.length`、`rowTargetYs`

## 期望看到的对比

| 字段 | 根目录（异常） | 子目录（正常） |
|------|--------------|--------------|
| `fullHeight` | ? | ? |
| `container.children.length` | ? | ? |
| `rows.length` | ? | ? |
| `rowTargetYs` | ? | ? |
| char rain 是否被调用 | ? | ? |

## 可能的原因方向

1. **`fullHeight === 0`** → `doExpand` 提前返回，根本不创建 overlay 和 char rain。检查 `_ensureMetaFromExpandedState` 是否正确设置了根容器的 `_fullHeight`。

2. **`fullHeight > 0` 但 `rowTargetYs` 为空** → overlay 创建了但行 overlay 的 `_targetY` 没正确设置。

3. **char rain 被调用了但 `rows.length === 0`** → overlay 容器的 children 没有 `title-*` 或 `file-*` 前缀的行。

4. **char rain 跑了但字符不可见** → 字符 Box 被渲染在 overlay 容器内，但被其他元素遮盖或裁剪。根容器的 overlay 可能继承了一些特殊属性。

## 架构上下文

- 根目录比较特殊：`buildSidebarTree` 始终把整棵树包在 `expanded-/root` 容器内，无论 `/root` 是否在 `expandedPaths` 中
- 根容器的 `depth = 0`，不设 `kfmStyle` 边框（`buildExpanded` 中 `if (depth > 0)` 守卫）
- 根容器在 `tree-model.ts` 的 `buildExpanded` 第 5 行创建，`overflow: 'hidden'`

## 上一次相关修改

commit `1c171f4` "展开无字符雨 + 折叠文字提前消失" 加了 GSAP `onUpdate` 调用 `setRoot`，并清理了折叠动画的行 Y 冲突。但根目录无字符雨的问题在修之前就存在，修之后仍存在。
