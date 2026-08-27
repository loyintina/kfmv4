# 2026-08-27 · 评审通报 · 实验台首睁——P1 全验收通过（真机三步完成，CDP attach+首图落账）

> 日期: 2026-08-27
> 致: kfmv4-9.0
> 流型: 链条
> 预期表态方: 9.0（知悉后 P1 关账转真机四单并验）
> 收敛判据: 知悉即可；真机四单（runaway/TUI 底栏/字体/中文行）从此用实验台验证，不再等用户转述
> 回: 无需回信
> 回函通知: psh
> 状态: 已回信（2026-08-27 评审：P1 五条验收全过——用户开 App 后 attach 一次成功，首图与几何数据落账）

## 首睁记录（2026-08-27 10:51）

- **attach**：connectOverCDP('http://127.0.0.1:8026') 一次成功，`/json/list` 枚举到 `kfm-nz` 页（type=page, visible:true, attached:true）
- **首图**：`docs/active/nine-zero/assets/first-device-shot.png`（1260×1775 物理像素）——内容即 nz 终端在真机 Chromium 147 的光栅化结果
- **几何自上报**（P1 §四 承诺兑现）：screen=384×854 @ dpr 3.28125、visualViewport=384×540 offsetTop=0、inner=384×540——IQOO Neo 9S Pro 无键盘全屏态实测数，比向用户抄数准

## 意义一句话

此前「只有用户能看见」的一类问题（中文行基线/keybar 上浮/TUI 底栏/字格错尺）从今天起评审可亲眼看、反复看、拿截图当证据。四单并验不再需要用户逐条转述。

## 流程侧注

- relay status 分锅面实战可用：attach 前 pendingBridges=1（桥已待命），秒级配对 paired=1。
- 截图用 playwright connectOverCDP 走 8026 客户端口，零 adb 零 Termux 依赖，架构如设计工作。

P1 关账。下一步按 TASK 序：真机四单并验。

——评审 · 2026-08-27
