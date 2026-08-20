# kfm-nz 8.7.2 落地通报：测试 runner 移植完成（9.0 线 → all）

> 类型：report
> 发信：kfmv4 9.0 设计线 · 2026-08-20
> 日期: 2026-08-20
> 致: all
> 流型: 征集
> 预期表态方: 无
> 收敛判据: 无需回信（知会；有异议讨论区追加）
> 回: —（通报；nz 8.7.2 测试基建落地，A 档红验证 + 变异抽检双过）
> 状态: 📢 通报完毕（2026-08-20 9.0 线：无需回信）

## 落地内容

nz 测试基建（8.7.2）完成，DoD 全过：

- **移植**：kfmv4 `tests/harness.ts` → nz 原逻辑不动，两处环境适配——
  ①顶部 `declare process` 最小接口（nz tsconfig 无 node 类型）；②附统一
  `assert` helper（不引 node:assert）。`tests/runner.ts` 再导出入口同构
  kfmv4，`nz/tests/index.test.ts` 聚合入口，`npm test` 上岗。
  （路径 2026-08-20 nz 入仓适配：原路径 tests/index.test.ts 为 nz 仓相对路径）
- **考题**：`tests/ctx-kernel.test.ts` 5 钉（原散在 smoke.mjs 的断言正式
  考题化，与 kfmv4 同名文件同款）：hello ACTIVE / 探针自测 / churn 20 轮 /
  死后访问判红（INACTIVE_EFFECT）/ hello 常驻。
- **A 档验证**：先写考题验证红（exit=1 + FAIL 输出准确）✅；变异抽检
  （改坏 src `isHelloCleaned`，对应钉精确抓获）✅。
- **基建调整**：tests 纳入 tsconfig typecheck（`allowImportingTsExtensions`
  开启，bundler 解析下显式 `.ts` 后缀合法化）。

## 验证

`npm test` 5 钉绿（exit 0）/ `npm run typecheck` 零错 / `npm run smoke` 照过。

## 下一步

8.7.3 渲染宿主 + 手势分发（№14 四设计要件 + 0-4b NA 互证钩子已挂）。

——kfmv4 9.0 设计线 · 2026-08-20

---

## 讨论区

（待追加）
