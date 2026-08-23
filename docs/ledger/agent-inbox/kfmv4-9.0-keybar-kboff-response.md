# 2026-08-23 · 9.0 · ?kbOff 代字已落地：keybar 底=vv底−kbOff，?debug 标命中

> 日期: 2026-08-23
> 致: 评审
> 流型: 链条
> 预期表态方: 评审（落地核对）+ 用户（Via 真机调值）
> 收敛判据: 用户 Via 链接加 ?kbOff=<值> 真机逐帧调到位（下排不盖），最终值回函；kboff 命中+逐帧不盖即收口
> 回: kfmv4-9.0-keybar-kboff-report.md
> 回函通知: psh
> 状态: 已回（2026-08-23 9.0：?kbOff 已落 @ 02739919，球在用户 Via 调值）

## 一、落地（02739919）

1. **解析**：`?kbOff=<px>` URL 代字（URLSearchParams 取值，有限正数才生效，否则=0）；
2. **修正**：`keybar.updateBottom()` 栏底定位 = `vv.offsetTop + vv.height − KEYBAR_H − kbOff`——栏上移 kbOff 像素落到真实键盘顶；**无参数=0，现状不改**（其他浏览器/默认不受影响）；
3. **?debug 标命中**：`reportViewport` 新增 `kboff` 字段——0=未命中，非 0 即走了适配分支（真机确认没测旧包/没进错分支）。

实现位置：`nz/src/client/term/keybar.ts`（KeybarHooks.bottomOffset + updateBottom 修正）、`nz/src/client/plugins/term/index.ts`（解析+透传+kboff 上报）。

## 二、验证基线

build/typecheck/84 单测全绿；smoke PASS；点击 E2E 17/17 绿；bundle v=f7151ede（哈希缓存破坏，真机强刷即新包）。

## 三、验收口径（球在用户）

Via 书签/链接改成 `http://<机器IP>:8023/?debug&kbOff=42`（先试 42，不凑效试 40/44），强刷后弹键盘：

- **kboff=42** 出现在 ?debug 上报 = 分支命中；
- 逐帧看：keybar 两排不被键盘盖，即调到位的值。

最终值回函后收口：双轨色条/brt/brb/fx/vm 等专症字段随症拆（kboff 字段保留与否随评审裁决——它是常驻代字的命中标记，建议留）。

## 备注

完全同意"用户可调代字比硬编码品牌死值稳健"——kbOff 是用户手里的标尺。终端容器行列仍按 vv 全量算（42px≈2 行可能落在被盖区），若真机验收发现光标行被盖再议容器同扣，本轮按信口径只动 keybar。

——9.0 · 2026-08-23
