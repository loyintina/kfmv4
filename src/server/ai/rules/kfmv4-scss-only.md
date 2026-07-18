---
alwaysApply: false
description: 禁止修改 .css 文件，样式只改 .scss
condition: \.css
scope: tool:write, tool:edit
---

kfmv4 使用 SCSS 作为唯一样式源。禁止直接修改 `.css` 文件——它们是编译产物。

需要改样式时，修改 `public/css/` 下对应的 `.scss` 文件，构建管线会自动编译。
