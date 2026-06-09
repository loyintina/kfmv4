---
status: completed
archived_at: 2026-06-02
---
# BR 光球类型守卫修复交接文档

> **紧急度**：P1（编译通过，但运行时存在 `!` 非空断言绕过编译器，有潜在崩
> 溃风险）
> **编写**：2026-05-24，基于 v4.1.0（commit `3054f02`）
> **接收方**：接手此问题的 agent

---

## 一、问题描述

`FloatingCardItem` 接口中 `tlOrb`、`trOrb`、`blOrb`、`brOrb` 的类型改为
了 `HTMLElement | null`（因为紧凑态时它们的确为 null）。

但拖拽函数 `_enterFloatingEditMode`、`_startFloatingDrag` 和
`_handleFloatingDragMove` 中直接以 `.brOrb.style` / `.brOrb.getBoundingClientRect()` 
形式访问这些属性，TypeScript 严格模式报错。临时用 `!` 断
言绕过了编译器。

## 二、问题的根因

在 `!` 断言之前，没有在运行时检查 `brOrb` / `trOrb` / `blOrb` 是否为 null。
这些拖拽函数只在 `active` 或 `editing` 态下被调用（此时光球已创建），但编
译器无法验证这个运行时约束。

## 三、修复方法

将所有 `!` 断言替换为**显式空值守卫 + 局部变量**：

### 替换 1：`_enterFloatingEditMode`（约第 452-455 行）

**当前代码：**
```typescript
const brRect = item.brOrb!.getBoundingClientRect();
```

**替换为：**
```typescript
const brEl = item.brOrb;
if (!brEl) return;
const brRect = brEl.getBoundingClientRect();
```

### 替换 2：`_startFloatingDrag`（约第 493-495 行）

**当前代码：**
```typescript
const brRect = item.brOrb!.getBoundingClientRect();
```

**替换为：**
```typescript
const brEl = item.brOrb;
if (!brEl) return;
const brRect = brEl.getBoundingClientRect();
```

### 替换 3：`_handleFloatingDragMove` — editing 分支（约第 532-550 行）

**当前代码：**
```typescript
if (_dragItem.state === 'editing') {
    const minOrbAbsX = ...
    ...
    _dragItem.trOrb!.style.left = newRightX + 'px';
    _dragItem.blOrb!.style.top = newBottomY + 'px';
    _dragItem.brOrb!.style.left = newRightX + 'px';
    _dragItem.brOrb!.style.top = newBottomY + 'px';
```

**替换为：**
```typescript
if (_dragItem.state === 'editing') {
    const tr = _dragItem.trOrb;
    const bl = _dragItem.blOrb;
    const br = _dragItem.brOrb;
    if (!tr || !bl || !br) return;
    const minOrbAbsX = ...
    ...
    tr.style.left = newRightX + 'px';
    bl.style.top = newBottomY + 'px';
    br.style.left = newRightX + 'px';
    br.style.top = newBottomY + 'px';
```

### 替换 4：`_handleFloatingDragMove` — 普通拖拽分支（约第 568-576 行）

**当前代码：**
```typescript
    const newRightX = newW - rOff - cSize;
    const newBottomY = newH - bOff - cSize;
    _dragItem.trOrb!.style.left = newRightX + 'px';
    _dragItem.blOrb!.style.top = newBottomY + 'px';
    _dragItem.brOrb!.style.left = newRightX + 'px';
    _dragItem.brOrb!.style.top = newBottomY + 'px';
  }
}

function _endFloatingDrag
```

**替换为：**
```typescript
    const tr2 = _dragItem.trOrb;
    const bl2 = _dragItem.blOrb;
    const br2 = _dragItem.brOrb;
    if (!tr2 || !bl2 || !br2) return;
    const newRightX = newW - rOff - cSize;
    const newBottomY = newH - bOff - cSize;
    tr2.style.left = newRightX + 'px';
    bl2.style.top = newBottomY + 'px';
    br2.style.left = newRightX + 'px';
    br2.style.top = newBottomY + 'px';
  }
}

function _endFloatingDrag
```

## 四、验证

```bash
cd /root/kfmv4
npm run build   # 类型检查零错误
```

## 五、注意事项

1. 这四个替换是相互独立的，没有依赖关系。可以按任意顺序执行。
2. 每个替换的 `old` 字符串可以用上面提供的代码块直接匹配。
3. 执行完所有替换后，在文件内全局搜索 `\.brOrb!`、`\.trOrb!`、`\.blOrb!`
，确认没有残留。
4. 文本编辑器可以直接用上述代码块做查找替换。用 sed 的话注意转义特
殊字符。

