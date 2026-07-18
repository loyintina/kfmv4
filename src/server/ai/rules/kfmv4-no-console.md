---
alwaysApply: false
description: 禁止使用 console.log，改用 log() 函数
condition: console\.(log|warn|error|debug|info)
scope: tool:write, tool:edit, tool:browser_eval
---

kfmv4 有统一的日志系统。在客户端代码中禁止使用 `console.log/warn/error` 等。

使用方式：
```typescript
import { log } from './logger.js';
log('[模块名] 日志内容');
```

构建管线的 `check-console.mjs` 会在 build 时强制检查，违规会中断构建。
