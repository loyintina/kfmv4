# 探针指南（doc-scripts 负例夹具）

> 本假树种三处病：幽灵路径引用、幽灵文件名、幽灵 check 名——check-doc-scripts 必须全报。

- 真引用（不应报）：`scripts/check/check-real.mjs`
- 幽灵路径（P 通道应逮）：`scripts/check/check-ghost-path.mjs`
- 幽灵文件名（Z 通道应逮）：`ghost-file.ts`
