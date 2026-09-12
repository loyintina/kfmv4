# 浮窗挤画终修通报：kimi 输出刷屏案（格网错位定罪 + scaleX 挤画落地）

> 日期: 2026-09-12
> 致: 主会话，评审，kfm-na
> 流型: 线程
> 预期表态方: 无（na 参考：若其本地渲染层有同构「自量列数 vs 管道列数」分裂，同病同修）
> 收敛判据: 用户知悉刷屏根因与修法；真机像素验收（L3）待壳 CDP 隧道回连后补录
> 回: 用户报「kimicode 输出内容时浮窗刷屏往上反复刷状态等待条」
> 状态: 通报完毕（2026-09-12 nz：代码+考卷+构建落地，L1/L2 全绿，L3 挂账）

**致**: 用户 + 评审 + na
**来源**: nz 9.0 线
**提交**: 挤画终修（term/browser/shell 三件 + 考卷转正 v4 + TASK §0.9 入账）
**时间**: 2026-09-12

---

## 1. 现象与根因

**现象**（用户真机）：浏览器模式浮窗里，kimicode 一输出，「状态等待条」反复往上刷，输出内容看不了。

**根因**：格网错位。e17c8e5b（窄闪终修）只做了「浮窗管道按主格网（73 列）拉起」半件事，浮窗渲染卡仍按自身容器宽度量列（~54 列）；该提交信息声称的「浮窗渲染壳按格网自动压缩绘制（73→52 列挤画）」**在代码里不存在**（`git show e17c8e5b` 定罪：实改仅 22 行）。tmux 按 73 列几何发整屏重绘（含 kimi 状态条逐帧刷新），54 列核把满宽行折行、光标定位全错——每帧重绘留残行并顶升内容=刷屏。

**L2 铁证**：`tmux list-clients -t dsh` → 主终端+浮窗两条客户端管道均 73×47，会话窗 73×46（window-size largest）。

## 2. 修法（六件）

1. `__kfmNzTermBind(id, grid?)` 格网收编：绑定时卡片格网=拉起时管道格网，tail 回放按收编后行列重建；主终端 tmux-tabs 不传 grid，零变化。
2. 壳 scaleX 挤画：termEl 保持自然宽（cols×cellW），`transform: scaleX` 压进浮窗宽；sy 恒 1，滚动语义不碰。`paintScale` 判卷字段入 `__kfmNzTermScroll`。
3. 浮窗冻结自测量重排：checkDrift / scheduleResize / RO 的格网自愈只跟管道（折叠 <100px 冻结保留）。
4. 坐标反缩放：placeKb 横坐标 × paintScale；shell.cellAtPoint 挤压态从 rect.width 反推视觉字宽（SGR 鼠标上报不飘）。
5. `shell.resize` 升 `(cols, rows)` 双参：opts.cols 必须跟，cellAtPoint 边界与 canvasShot 宽不吃旧值。
6. 浮窗管道池带格网账；onEnter 懒补统一走主格网（原 innerWidth 自算列数是错位又一来源，退役）。

## 3. 验证（观测手段声明）

- **L1 考卷**（Playwright 真 bundle + 真 tmux 隔离实例）：float-grid-mismatch-repro v4 全绿——A 页 73×46 收编 paintScale=0.7507、屏面搅动 11 行次/6s；**修复前同负载错位页=211 行次/6s**（A/B 分离定罪卷宗在考卷 git 历史）。browser-organ 11/11（⑦d 零注入合同含）、term-boundary 9/9、npm test 233 绿。
- **观测教训（三连假阴性换来的）**：tmux 客户端帧带 `?1049h` 进 ALT 屏，histLen 恒 0 是设计内——histLen/scrollHeight 判卷双盲，刷屏唯一有效指纹=屏面搅动度（churn）。
- **L2**：考卷内嵌 `capture-pane` 服务端互证（负载真进 pane）；修复纯客户端渲染层，服务端账零改动。
- **L3 真机像素**：挂账。壳 CDP 隧道（8031）闪断未回连，待用户把壳 app 弄到前台/重进一次即补真机截图+真 kimi 负载搅动采样。

## 4. 运维事故入账（同日）

排障中 curl 误打中继**控制口**（8028/8031 是 DIAL 线控协议，非 HTTP），顶掉 APK 控制信道并致旧中继进程僵死（accept 后事件不醒、CLOSE-WAIT 堆积、strace 见 epoll 无唤醒）。已按原参重启（8029/8030/8031）。**教训：中继三口只有 client 口可 HTTP 探，控制/桥口禁碰**。已入 nz/TASK.md §0.9。

---

（nz 9.0 线 · 挤画=「拉起尺寸一致」的第二条腿，两腿齐了浮窗渲染才算闭环）
