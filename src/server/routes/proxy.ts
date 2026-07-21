/**
 * routes/proxy.ts — CORS 代理端点
 *
 * 从 server/index.ts 拆分。将客户端 AI API 请求转发到已配置的 Provider，
 * 支持流式（SSE pipe）和非流式（JSON）两种模式。
 */

import type { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { KFM_DATA_DIR } from '../path-utils.js';

export function setupProxyRoutes(router: Router): void {
  router.post('/proxy/fetch', async (req, res) => {
    try {
      const { url, method, headers, body } = req.body;
      if (!url) { res.json({ error: '缺少 url 参数' }); return; }

      // 仅允许转发到已配置 Provider 的 baseUrl。
      // 安全：用 URL.origin 精确比对，而非 startsWith 前缀匹配——
      // 否则 "https://api.deepseek.com.attacker.example" 会通过
      // startsWith("https://api.deepseek.com") 校验，把带 API key 的请求
      // 转发到攻击者域名。同时要求请求路径落在 baseUrl 的路径前缀内。
      try {
        const providers: Array<{ baseUrl: string }> = JSON.parse(
          fs.readFileSync(path.join(KFM_DATA_DIR, 'providers.json'), 'utf-8')
        );
        let target: URL;
        try { target = new URL(url); }
        catch { res.status(400).json({ error: '无效的 url' }); return; }
        const allowed = providers.some(p => {
          let base: URL;
          try { base = new URL(p.baseUrl); } catch { return false; }
          if (base.origin !== target.origin) return false;
          // 路径前缀在 "/" 边界上匹配，避免 /v1 匹配到 /v1abc
          const basePath = base.pathname.replace(/\/$/, '');
          return target.pathname === basePath || target.pathname.startsWith(basePath + '/');
        });
        if (!allowed) { res.status(403).json({ error: '不允许的请求地址' }); return; }
      } catch {
        res.status(403).json({ error: '未配置 Provider' });
        return;
      }

      let reqBody = body;
      let isStream = false;
      if (typeof reqBody === 'object' && reqBody?.stream) {
        isStream = true;
        reqBody = { ...reqBody };
        delete reqBody.stream;
      }

      if (isStream) {
        const response = await fetch(url, {
          method: method || 'POST',
          headers: { 'Content-Type': 'application/json', ...headers },
          body: JSON.stringify({ ...reqBody, stream: true }),
        });
        if (!response.ok) { res.json({ status: response.status, ok: false, error: '上游请求失败' }); return; }
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        const nodeReader = response.body!.getReader();
        const decoder = new TextDecoder();
        function pump(): void {
          nodeReader.read().then((result) => {
            if (result.done) { res.end(); return; }
            res.write(decoder.decode(result.value, { stream: true }));
            const httpRes = res as unknown as { flush?(): void };
            httpRes.flush?.();
            pump();
          }).catch(() => res.end());
        }
        pump();
      } else if (method === 'GET') {
        const response = await fetch(url, { headers });
        const data = await response.json();
        res.json({ status: response.status, ok: response.ok, data });
      } else {
        const response = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json', ...headers },
          body: typeof reqBody === 'string' ? reqBody : JSON.stringify(reqBody),
        });
        const data = await response.json();
        res.json({ status: response.status, ok: response.ok, data });
      }
    } catch (e: any) {
      res.json({ error: e.message || '代理请求失败', status: 0, ok: false });
    }
  });
}
