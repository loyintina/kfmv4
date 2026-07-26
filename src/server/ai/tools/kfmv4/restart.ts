/**
 * kfmv4/restart.ts — 安全重启工具
 *
 * 通过 HTTP 端点触发重启（先响应 200，后 spawn detached 子进程），
 * 然后轮询等待服务恢复，最后刷新浏览器页面。
 *
 * 关键设计：与 bash/systemctl 不同，此工具不依赖 kfmv4 进程存活——
 * HTTP 响应在进程被 kill 之前就已返回，剩余逻辑（轮询、刷新）在客户端执行。
 */
import type { KfmTool, ToolResult } from '../types.js';

export const kfmRestartTool: KfmTool = {
  name: 'kfm-restart',
  description:
    '安全重启 kfmv4 服务。调用后自动等待服务恢复并刷新浏览器页面。' +
    '比直接使用 bash systemctl restart 更可靠——不会因为进程被杀而截断工具调用。',
  category: 'kfmv4',
  parameters: {
    type: 'object',
    properties: {
      port: {
        type: 'number',
        description: 'kfmv4 服务端口，默认 8021',
      },
    },
    required: [],
  },

  async execute(params, ctx): Promise<ToolResult> {
    const port = (params.port as number) || 8021;
    const base = `http://127.0.0.1:${port}`;

    // Step 1: 调用安全重启端点（先响应，后重启）
    let respText = '';
    try {
      const resp = await fetch(`${base}/api/system/restart`, { method: 'POST' });
      respText = await resp.text();
    } catch {
      // fetch 失败也继续——可能是网络层在重启前就断了
      // 但 POST 已经发出，服务端已经收到请求
      respText = '{"status":"restarting","message":"request sent (fetch failed due to restart timing)"}';
    }

    const lines: string[] = [`[kfm-restart] 重启已触发: ${respText}`];

    // Step 2: 轮询等待服务恢复（最多 30 秒）
    lines.push('[kfm-restart] 等待服务恢复...');
    let recovered = false;
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 1000));
      try {
        const resp = await fetch(`${base}/api/system/info`);
        if (resp.ok) {
          lines.push(`[kfm-restart] ✅ 服务已恢复（${i + 1}s）`);
          recovered = true;
          break;
        }
      } catch {
        // 继续等待
      }
    }

    if (!recovered) {
      lines.push('[kfm-restart] ⚠️ 30s 内服务未恢复，可能需要手动检查');
      return { content: [{ type: 'text', text: lines.join('\n') }], isError: true };
    }

    // Step 3: 刷新浏览器页面
    if (ctx.wsServer) {
      try {
        // 等 WS 重连稳定后再刷新
        await new Promise(r => setTimeout(r, 2000));
        await ctx.wsServer.evalInBrowser('window.location.reload(true)', 5000).catch(() => {});
        lines.push('[kfm-restart] ✅ 浏览器页面已刷新');
      } catch {
        lines.push('[kfm-restart] ⚠️ 浏览器刷新失败（请手动刷新）');
      }
    } else {
      lines.push('[kfm-restart] ⚠️ wsServer 不可用，请手动刷新浏览器');
    }

    return { content: [{ type: 'text', text: lines.join('\n') }] };
  },
};
