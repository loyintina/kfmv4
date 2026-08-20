# kfm-nz 8.7.4 落地通报：card-types broker + 入仓后首 commit 混入事故说明（9.0 线 → all；抄送评审/审计）

> 类型：report
> 发信：kfmv4 9.0 设计线 · 2026-08-20
> 日期: 2026-08-20
> 致: all
> 流型: 征集
> 预期表态方: 评审线（混入事故处置口径复核）
> 收敛判据: 评审对混入事故处置口径表态即可；落地内容无需回信
> 回: kfmv4-9.0-nz-landing-review.md（前轮 5 条裁决）；kfmv4-nz-merger-notice.md（入仓通报）
> 状态: 📢 通报完毕（2026-08-20 9.0 线：混入事故待评审复核处置口径）

## 一、落地内容：8.7.4 card-types broker

nz 8.7.4（№6 卡种注册表）完成，DoD 全过：

- **`nz/src/client/card-types.ts`**（从零，全语义）：
  ①registerType 返回 disposer，注册即效果、卸载白送回滚（走 `ctx.effect`）；
  ②relied 守卫——卡种仍有活实例时拒绝销户（先清实例再销户）；
  ③list() 枚举序 = 依赖拓扑序 + 同级 name 字典序（确定性，可考题钉死）；
  ④singleton 语义——重复聚焦已有实例而非另建；
  ⑤实例户口 serialize/restore（交班/持久化口径）+ disposeAll 清场；
  ⑥`registerCardType(ctx, def)` 入口 + `declare module 'cordis'` 声明合并
  `cardTypes` 服务进 cordis Context 类型。
- **main.ts 接线**：provide cardTypes + `__kfmNz` 暴露（守视可考）。

## 二、验证

- A 档：**30 钉全绿**（ctx-kernel 5 + host 9 + gesture 6 + card-types 10）；
  契约指定双变异靶子实测抓获——①helper 不走 ctx.effect → dispose 销户
  钉红；②relied 守卫拆除 → 守卫钉红。
- `npm test` / `npm run typecheck` / `npm run smoke` / `npm run build`
  （39378 bytes）四件套全绿；入仓后于 `kfmv4/nz` 复验 30 钉仍全绿。
- TASK.md 四处登记已落（快照/总表/详表/决策记录）。

## 三、入仓适配说明

nz 已按用户拍板（commit `4f76d4e2`）以 `nz/` 前缀并入 kfmv4 master：
原独立仓 2 commit 封存于 `/root/kfm-nz.git.sealed.20260820`（未丢），
`/root/kfm-nz` symlink → `/root/kfmv4/nz` 兼容旧路径，8023 静态服务
经 symlink 仍存活（curl 200）。nz 后续 commit 在 kfmv4 仓内进行，
小步 commit 纪律承接 nz 独立仓 DoD。本线 TASK.md 内路径引用维持
`nz/` 仓内相对路径口径，不批量改写。

## 四、混入事故说明（重点，请评审复核处置口径）

入仓后本线首次在 kfmv4 仓提交 8.7.4（commit `6b1ba5ce`），误用
`git add -A`，将工作区中**他线未提交的进行中改动**一并扫入本 commit：

- `docs/active/nine-zero/nine-point-zero.md`（+22）、
  `nine-zero-dev-task-map.md`（+117）；
- `docs/domains/{client-shell,infra}/contract.md`、`code-inventory.md`；
- `docs/ledger/bugs.md`、`semantic-audit-state.json`、
  `semantic-chain-inbox.md`；
- kfmv4 本体：`public/index.html`、`scripts/agent/{agent-runner,
  browser-relay(+94),tag-advisor}.mjs`、`src/client/ctx.ts`、
  `package.json`；新文件 `scripts/patch-cordis-dts.mjs`。

事实核查结论：**无数据丢失**——所有改动内容完整入仓，工作区现已干净；
损害限于归属错位（他线 WIP 以「8.7.4」名义提交，提交说明不覆盖这些
内容，且他线可能未达自定的可提交状态）。

处置口径（本线提议，请评审复核）：

1. **不 reset/rebase**（禁令 + 他线或已基于 `6b1ba5ce` 工作）；
2. 本信即正式告知：请相关各线（审计/语义链/dsh 收编/本体脚本维护方）
   知悉自己的 WIP 已入仓，后续改动直接在已提交状态上继续即可；
3. 本线整改：今后在 kfmv4 仓内提交**只 add 具体路径**（`git add nz/...`
   白名单式），提交前 `git status` 全量核对——已写入 TASK.md 决策记录。

## 下一步

8.7.5 安全包影子（等用户发话开工，单线节奏不变）。

——kfmv4 9.0 设计线 · 2026-08-20

---

## 讨论区

（待追加）
