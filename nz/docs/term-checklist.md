# 终端功能对照表（8.8.2 收口核对，2026-08-23）

> 8.8.2 验收项「终端功能对照表全绿」的对账面：每行 = 一项功能 + 验证依据 +
> 状态。验证依据分三级：自动化（tests/ 考题、smoke）、守视（headless 实拍/
> eval）、真机（用户手机实测，C 档数字收口）。**真机专属症状以真机数字收口，
> headless 只配「待真机对账」**（真机取证纪律，test-methods/index.md）。

## 连接家族（8.8.1）

| 功能 | 验证依据 | 状态 |
|------|---------|------|
| open（开 PTY 会话） | tests/term-connection.test.ts | ✅ 自动化 |
| input（输入转发） | 同上 + 真机 IME 三轮实测 | ✅ 自动化+真机 |
| resize（行列同步） | 同上 + 真机软键盘弹落实测 | ✅ 自动化+真机 |
| close / 进程退出通知 | tests（onExit 路径） | ✅ 自动化 |
| 重连 tail 回放（重建网格再喂，防花屏） | tests/ws-bridge.test.ts + 真机强刷实测 | ✅ 自动化+真机 |
| 僵尸会话 list 口径 + open 挂权限判定 | 8.8.2 开工先补项，tests/server.test.ts | ✅ 自动化 |

## 渲染壳（8.8.2 主体）

| 功能 | 验证依据 | 状态 |
|------|---------|------|
| 行级 DOM 渲染（一行一 div，变才重排） | tests + M3 基线 term-fresh.png | ✅ 自动化+守视 |
| 样式段 runs（fg/bg/attrs，字节下标切分） | tests + M3 基线 term-sgr-cjk.png（绿字/蓝粗实拍） | ✅ 自动化+守视 |
| 宽字符裁 2 格（EAW W/F + emoji，inline-block 裁切） | 真机中文长句光标贴末字（IME 讨伐①根治）+ term-sgr-cjk.png 混排对齐 | ✅ 真机收口 |
| inverse 反显（fg/bg 互换，含默认色参与） | M3 基线 + tmux 反色块真机可见 | ✅ 守视+真机 |
| 光标块定位（col×cellW / row×cellH） | IME 讨伐①自验（col=42 → x=328.8px=字形右缘）+ 真机 | ✅ 真机收口 |
| 光标藏显传导（DECTCEM ?25h/?25l，cursor_visible） | 守视实测：?25l→vis=false、?25h→vis=true + 真机 tmux 单光标 | ✅ 守视+真机收口 |

## 输入路径（8.8.2，IME 讨伐产出）

| 功能 | 验证依据 | 状态 |
|------|---------|------|
| 桌面 keydown→字节（可打印/Enter/Backspace/Tab/方向键/Home/End/Ctrl+字母） | tests + 守视合成事件 | ✅ 自动化+守视 |
| 手机 IME input 分支（整段取走清空诱饵） | 真机小鹤音形黑匣子 168 条（纯 input 分支实锤） | ✅ 真机收口 |
| composition 纪律 v2（中间态不转发、上屏只认 e.data、吞补发） | 真机中文实测两轮 | ✅ 真机收口 |
| 诱饵钉光标格（placeKb，断滚动拔河）+ focus preventScroll | 守视实测 kbLeft=col×cellW 像素级 + 真机英文快打不闪 | ✅ 守视+真机收口 |

## 尺寸与滚动（8.8.2，IME 讨伐产出）

| 功能 | 验证依据 | 状态 |
|------|---------|------|
| 实测定行列（探针量字格 × 容器可视面积） | 真机多屏实测 | ✅ 真机 |
| visualViewport 防抖（150ms 行列变更 + 容器压高同块） | 真机软键盘弹落实测（守视 DEBOUNCE-OK 回归） | ✅ 守视+真机 |
| 键盘吞末行根治（容器压可视高，阈值 40px 防工具栏抖动） | 真机实测 | ✅ 真机 |
| nearest 滚动兜底（被遮才滚，不碰页面/背景）+ 无滚底 | 真机英文快打 sc 走平（拔河断） | ✅ 真机收口 |
| 终端全屏期锁背景页滚动 | 真机实测（闪烁根因之一已除） | ✅ 真机 |

## 诊断基建（复盘裁决①新口径）

| 功能 | 验证依据 | 状态 |
|------|---------|------|
| ?debug 骨架常驻（sendBeacon 管道 + 字段注册点 + /debug/ime-log 端点） | 守视 ?debug 合成事件落 /tmp/nz-ime-events.log | ✅ 守视 |
| 通用健康字段（f/rp/sc/rz 逐事件同流） | 同上（beacon 记录原件在信 kfmv4-9.0-debug-statefields-response） | ✅ 守视 |
| IME 专症字段（col/cv/cb）+ 角标 + 两 window 探针 | **已随症收口移除**（本收口动作） | ✅ 已移除 |

## 按键栏（8.8.3b）

| 功能 | 验证依据 | 状态 |
|------|---------|------|
| 两排七列键序照 NA KEYS（上 Esc/Alt/Home/PgUp/↑/PgDn/Shift，下 Tab/Ctrl/End/←/↓/→/Enter） | tests/keymap.test.ts 键表序题 + 守视实拍 | ✅ A+守视 |
| 粘滞修饰一次性（toggle 点亮 / 落字 take 清零灭灯） | 考题 + 守视真链（Ctrl→c=^C，提示符 5→6，灯自灭） | ✅ A+B |
| Ctrl+ASCII→控制字节 / Alt=ESC x / 多字符不转 | tests/keymap.test.ts | ✅ A |
| 方向键/Home/End 按 app_cursor 翻 SS3/CSI（核 `app_cursor()` 新暴露） | cargo test `app_cursor_tracks_decckm` + keymap 两模式题 | ✅ A（核钉+映射题） |
| 栏随软键盘上浮（贴可视区底，vv resize/scroll 双追） | 真机待测 | 🔄 待真机 |
| 按压不抢焦点（pointerdown preventDefault，软键盘不收摊） | 守视真链（按压前后 activeElement=诱饵） | ✅ B |

## 已知留白（非缺口，排期在后续小步）

- 组合键映射全集（F1-F12 等）：input 小插件/后续小步；
- scrollback 历史渲染上屏：立项 **8.8.3c**（2026-08-23 用户拍板，体验对齐 8.x）；
- 考卷全集差分（NA 在役序列 vs rio-vt）：**8.8.5 闭环前置硬门**，并行轨。
