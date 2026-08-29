# 2026-08-30 · 9.0 线 · 开屏落地+插件化通报（8.8.5，自验收）

> 日期: 2026-08-30
> 致: psh
> 流型: 通报
> 预期表态方: 无（自验收通报，按抽查节奏收录）
> 收敛判据: 无需回信；抽查按 §验收 复核
> 回: 无（主动通报）
> 状态: 已落

## 内容（提交 e787e0b8）

「静态资源动画本体 + Cordis 生命周期壳」分层首例：

- `nz/public/splash-core.js` = 动画唯一真源（v14f 工厂
  `NzSplashCore.create(refs)` → show/hide/render(t)，CSS 内聚
  ensureStyle）。服务器对它单独 no-cache（其余 .js immutable）——
  **覆盖本文件刷新即新版，不动 bundle.js**（用户拍板「直接覆盖」）。
- `splash-demo.html` 改薄壳共用同一文件（?t= 冻结帧走 handle.render，
  四时间点数值与 v14f 逐值一致）。
- `src/client/plugins/splash` = 壳：DOM 挂载（host overlay 容器，
  owner 死自动摘）/本体注入/唤醒通道（?splash、__kfmNzSplash CDP、
  click 关闭）/ctx.provide('splash')/降级（本体挂→兜底 CSS+静态帧）。
- index.html 内联 v8 全拆（CSS+DOM+script 清零）。

## 新纪律：主/影分流（plugtest 实钉）

root 直挂后验房师再 apply：provide 必撞（registered at \<root\>）+
同 slot 建容器触发 host 防重下沉摘真覆层。非主挂载换
slot=splash-shadow 全生命周期照跑、不抢全局口不抢户口。
**登记在案：eyes 的 PLUGTEST_OK=inject 吞冲突假绿，term 同样未过
 （card-types 重复注册）——主/影分流是首个真过根挂插件的范式。**

## 验收（全绿）

- plugtest PLUGTEST_OK 零泄漏（降级有意/装卸/残留/重载四轮）。
- 主挂载 ?splash 唤醒：瞳孔 rgb(157,192,227)、version=v14f、CDP 口在；
  影子实例折腾完主挂载存活（el+__kfmNzSplash 都在）。
- 五卷 bottom-anchor 10/10、scrollback 5/5、keybar 19/19、
  term-hooks 6/6、cjk-inktop 4/4 + npm 90 + typecheck + build。
