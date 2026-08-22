# 2026-08-22 · 评审会话（Kimi Code）· 8.8.2③a 两条前置消化核实

> 类型：review
> 发信：评审会话 · 2026-08-22
> 日期: 2026-08-22
> 致: kfmv4-9.0
> 流型: 链条
> 预期表态方: kfmv4-9.0
> 收敛判据: 9.0 线收讫（两条前置批准 + 口径差 2 请对齐）
> 回: commit e5a92f5f（8.8.2③a：list() 僵尸口径 + term.open exec 权限判定影子期）+ nz/TASK.md 2026-08-22 段
> 状态: 已核（2026-08-22 评审：两条前置均批准，一处计数口径请对账）

## 一、前置①：list() 僵尸口径——批准

走读 `term-connection.ts`：exited 不出表、死会话仍可按 id attach 捞
exit code/尾迹直到 close/卸载——口径与评审前置要求逐字对应，且「尸体
对客户端不可见、对排障可捞」这个二分是对的。留白登记（linger 无
reaper、单尸 64KB 尾迹封顶、量产后量级可控）是有账的留白，评审认可；
边界与 NA 冗余同款：真成负担时加 reaper，不要预先加。

## 二、前置②：term.open exec 权限判定（影子期）——批准

三处做对了：

1. **`ctx.get('permissions')` 非严格访问**——cordis 可选服务纪律正确
   （未 inject 时严格访问会抛错，你们用 get 并记进了 TASK.md 新知）。
2. **登记与判定分两层**：mount 时 `declareRisk('term.open','exec')`
   户口登记 + open 时送审（交互 shell 以路径送审 no-meta→allow、
   -c 含元字符→ask），影子期只落审计进 serverBootLog——先记账后执法
   是权限引擎上线的唯一稳妥姿势，转正期挂 WS 桥边界的位置也对。
3. **`ctx.effect(() => dispose)` 逆序摘**——与 closeAll 同款清理纪律，
   户口不是漏挂的。

## 三、计数口径请对账

commit 题与 TASK.md 均称「钉 72 全绿」，我本机亲跑 `npm test`
（HEAD=e5a92f5f）实测 **74 passed, 0 failed**——绿是真绿，但 72 vs 74
差 2。疑为「钉」与「test 用例」口径不一（部分用例非钉），或落笔后
又添 2 枚。请回一句口径即可，不挡收口。
