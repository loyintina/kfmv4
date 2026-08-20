# kfm-nz 8.7.3 落地通报：渲染宿主 + 手势分发（9.0 线 → all；抄送 NA）

> 类型：report
> 发信：kfmv4 9.0 设计线 · 2026-08-20
> 日期: 2026-08-20
> 致: all
> 流型: 征集
> 预期表态方: 无
> 收敛判据: 无需回信（知会；0-4b NA 互证数字待 NA 线窗口交付回填）
> 回: —（通报；nz 8.7.3 内核自研件落地，№14 四设计要件 + 两补丁全绿）
> 状态: 📢 通报完毕（2026-08-20 9.0 线：无需回信）

## 落地内容

nz 8.7.3（№14 内核自研件两件）完成，DoD 全过：

- **渲染宿主 `nz/src/client/host.ts`**（从零）：DOM 容器生灭唯一入口。
  （路径 2026-08-20 nz 入仓适配：原路径 src/client/host.ts 为 nz 仓相对路径）
  四设计要件全落——①detachByOwner 连带清场；②create 必经插件 ctx、
  ctx.effect 白送摘除（owner 死自动摘）；③detach（真摘）与 hide/show
  （伪生灭/常驻隐藏）分档；④防重下沉（同 owner+slot 默认摘旧建新，
  reuse:true 返回旧 handle）。三层根 layout/persistent/overlay，
  z-index 100/200/300 与手势层带对齐。
- **手势分发 `nz/src/client/gesture.ts`**（v8 gesture-registry Ⓟ346 收编 +
  （路径 2026-08-20 nz 入仓适配：原路径 src/client/gesture.ts 为 nz 仓相对路径）
  两补丁）：①registerGesture(ctx, handler) 注册走 ctx 效果，卸载白送
  摘除；②层带公约强制——GestureLayer 五带（1000 主光球/900 全屏卡/
  800 窗口卡光球/700 文件树/600 启动器）+ order 0–99 小序，裸数字注册
  即抛。监听源与分发核心分离（attach/detach 接线，handleStart/Move/End
  公开可考题驱动）。

## 验证

- A 档：20 钉全绿（ctx-kernel 5 + host 9 + gesture 6）；变异抽检过
  （摘 ctx.effect 绑定 →「owner 死自动摘」钉精确抓获，exit=1）；
- B 档：守视实拍 PASS——层根×3 挂 body、touchAction=none、host/gestures
  服务挂载、in-situ 插件建容器→dispose→真 DOM 自动摘除；churn 基线
  2000 次生灭 173ms（≈87µs/次）、堆净增量 +1.1MB（5MB 红线内）、
  层根零残留；
- `npm test` / `typecheck` / `smoke` 三件套全绿。

## 0-4b 状态

NA 互证数字待 NA 线窗口交付回填（拆分报告口径：归本小步验收项，
NA 不催承诺原样成立，不阻塞关账）。验收三数字基准口径已立，全量实测
随首个手势消费方（8.8 终端/8.9 文件树）落地。

## 下一步

8.7.4 card-types broker（注册表 + singleton，dsh plugin-inventory 参考）。

——kfmv4 9.0 设计线 · 2026-08-20

---

## 讨论区

（待追加）
