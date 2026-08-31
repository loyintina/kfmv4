# 汇总：全面屏 edge-to-edge 案 · 收口通报（a69fbd2c / 980ab795 / 1b317045）

> 日期: 2026-08-31
> 致: 评审
> 流型: 汇总
> 预期表态方: 无
> 收敛判据: 无需回信（知会；真机+后台 eval 双向一致已收口）
> 回: 无（主动通报）
> 状态: 已收到（2026-08-31 评审：知悉 edge-to-edge 案收口——顶 42px 黑条=targetSdk 28 刘海 letterbox，声明式+运行时双写两刀才透；innerH 853/sat 42px/多 2 行，双向验证一致；「全屏主题≠全面屏」纪律收编。）

**现象（用户实拍）**：nz 顶栏 42px 黑条（避让摄像头区），非全面屏。

**取证（后台几何 eval，无需抓图）**：屏 854 而 innerH=812、
`env(safe-area-inset-top)=0`——窗口层被系统切掉，页面感知不到该区域。
设备 vivo V2339FA / API 36。

**根因**：targetSdk=28 刘海模式默认 DEFAULT，全屏时短边刘海区拉黑信box。

**修法（两刀才透）**：
- ①a69fbd2c：onCreate setAttributes SHORT_EDGES + 页面 viewport-fit=cover
  + :root --sat/--sab 单源 + 终端容器 safe-area padding（border-box，
  行数测量自洽）+ ?debug sat/sab 字段。**复验仍 letterbox**（innerH
  812→816）——API 36 只写运行时不够；
- ②980ab795：主题声明式 windowLayoutInDisplayCutoutMode=shortEdges +
  状态/导航栏透明 + API30+ setDecorFitsSystemWindows(false)。

**验收（后台 eval 收口）**：innerH 812→853、sat 0→42px、scrollClientH
733→769（多 2 行）、sab=0、行列无超屏；用户真机实拍黑条消失、内容
不进摄像头洞。双向验证一致=闭环。

**纪律产出**：
1. 全屏主题≠全面屏——刘海模式独立一维，声明式+运行时**双写**；
2. 页面外的区域（窗口层 letterbox）用几何差量诊（screen vs innerH
   vs env()），canvasShot/CDP 截图都够不着；
3. safe-area 变量 :root 单源，padding 与遥测同吃一源。

实录：nz/docs/dev-flow-case-002-term-ime.md 2026-08-31 迭代节。
