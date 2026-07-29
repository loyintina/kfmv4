> 这是什么：ADR-003——v8.1 前端优化三项评估后放弃的决策。
> 别的去哪找：版本线 → ../ledger/history.md；优化钉 → ../ledger/bugs.md（BAR-CARD-BLUR/LEAK/ENGINE/BUILD 串）。

# ADR-003：v8.1 前端优化三项评估后放弃

- 状态：已决定（2026-07-28 随 HANDBOOK 迁移立档）
- 背景：v8.1 第二批前端优化盘点，按收益排序实施，三项评估后放弃。

## 决定与理由

1. **xterm 懒加载 — 放弃**。IIFE 单文件不支持 code splitting，需改 ESM 输出，
   成本大于收益。
2. **Canvas dirty-flag — 推迟**。引擎级改造，留待专项，不混入批次优化。
3. **B3 transition 收敛 — 放弃**。视觉回归无法离线验证，风险不可控。

## 复启条件

- xterm：构建改 ESM 输出之日重估。
- dirty-flag：引擎层专项立项时。
- B3：浏览器级视觉断言可用时（见 vision.md 未来方向·质量工程）。
