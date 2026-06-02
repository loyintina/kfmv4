/**
 * KFM v4 — AI Tools 层
 *
 * 将浏览器端的 UI Element Registry snapshot 包装为服务端可调用的端点。
 * 职责：
 *   1. GET /api/ui/snapshot — 返回当前页面的完整描述（通过 WebSocket 获取实时数据）
 *   2. POST /api/ui/snapshot/push — 客户端推送 snapshot（WebSocket 的后备通道）
 *   3. GET /api/ui/element/:id — 查询单个元素的实时状态
 *   4. GET /api/capabilities — 返回所有已注册的能力列表
 *   5. GET /api/ui/schema — 返回 registry snapshot 的 JSON Schema
 *   6. POST /api/ui/command — AI agent 通过此端点向浏览器端发送操作指令
 *
 * 设计参见 docs/UI_ELEMENT_REGISTRY_SPEC.md §S 和 docs/notes/WEBSOCKET_CHANNEL_PROPOSAL.md
 */

import { Router } from 'express';
import { WsServer } from './ws-server.js';
import { capabilityExecutor } from './capability-executor.js';

// 内存缓存：当 WebSocket 未连接时，作为 fallback 存储 POST 推送的 snapshot
let _cachedSnapshot: Record<string, unknown> | null = null;
let _cachedCapabilities: unknown[] | null = null;

export function setupAiTools(router: Router, wsServer: WsServer): void {
  /**
   * GET /api/ui/snapshot
   *
   * 返回 AI 视角的当前页面描述。
   * 优先从 WebSocket 获取实时数据，fallback 到内存缓存。
   */
  router.get('/ui/snapshot', (_req, res) => {
    // 优先从 WebSocket 取实时数据
    const liveSnapshot = wsServer.getLatestSnapshot();
    if (liveSnapshot) {
      res.json({
        source: 'websocket',
        ...liveSnapshot,
      });
      return;
    }

    // fallback: 内存缓存（POST 推送的数据）
    if (_cachedSnapshot) {
      res.json({
        source: 'cache',
        ..._cachedSnapshot,
      });
      return;
    }

    // 无可用的实时数据
    res.json({
      source: 'none',
      status: 'unavailable',
      note: '浏览器端未连接。请确保页面已打开，WebSocket 已连接。',
      help: '可通过 POST /api/ui/snapshot/push 手动推送 snapshot，或打开浏览器页面建立 WebSocket 连接。',
    });
  });

  /**
   * POST /api/ui/snapshot/push
   *
   * 客户端（浏览器端 Registry）将当前 snapshot 推送到服务端。
   * 当 WebSocket 不可用时作为后备通道。
   * AI agent 通过此端点获取最新的页面描述。
   *
   * Body: PageDescription (JSON)
   */
  router.post('/ui/snapshot/push', (req, res) => {
    const snapshot = req.body;
    if (!snapshot || !snapshot.timestamp) {
      res.status(400).json({ error: '无效的 snapshot 数据，需要包含 timestamp' });
      return;
    }
    // 存入内存缓存
    _cachedSnapshot = snapshot;
    res.json({
      status: 'ok',
      received: {
        elementsCount: snapshot.elements?.length || 0,
        contentCount: snapshot.content?.length || 0,
        capabilitiesCount: snapshot.capabilities?.length || 0,
        timestamp: snapshot.timestamp,
      },
    });
  });

  /**
   * GET /api/ui/element/:id
   *
   * 查询单个交互元素的实时状态（从最新 snapshot 中提取）。
   */
  router.get('/ui/element/:id', (req, res) => {
    const id = req.params.id;
    const snapshot = wsServer.getLatestSnapshot() || _cachedSnapshot;
    if (!snapshot || !Array.isArray(snapshot.elements)) {
      res.status(404).json({ error: '没有可用的 snapshot 数据', id });
      return;
    }
    const element = snapshot.elements.find((el: any) => el.id === id);
    if (!element) {
      res.status(404).json({ error: '元素未找到', id });
      return;
    }
    res.json(element);
  });

  /**
   * GET /api/capabilities
   *
   * 返回所有已注册的能力列表。
   * 优先从 WebSocket 获取实时数据，fallback 到静态清单。
   */
  router.get('/capabilities', (_req, res) => {
    // 优先从 WebSocket 取实时数据
    const liveCaps = wsServer.getLatestCapabilities();
    if (liveCaps && liveCaps.length > 0) {
      res.json({
        source: 'websocket',
        capabilities: liveCaps,
      });
      return;
    }

    // fallback: 内存缓存
    if (_cachedCapabilities && _cachedCapabilities.length > 0) {
      res.json({
        source: 'cache',
        capabilities: _cachedCapabilities,
      });
      return;
    }

    // 静态清单（entry 与 capability-executor.ts 保持一致）
    res.json({
      source: 'static',
      capabilities: [
        {
          id: 'file-search',
          name: '文件搜索',
          description: '在当前目录下搜索文件名匹配的文件',
          parameters: [{ name: 'pattern', type: 'string' }],
          entry: 'capability-executor:file-search',
        },
        {
          id: 'file-read',
          name: '读取文件',
          description: '读取指定路径的文件内容',
          parameters: [{ name: 'path', type: 'string' }],
          entry: 'capability-executor:file-read',
        },
        {
          id: 'file-write',
          name: '写入文件',
          description: '写入内容到指定路径的文件（可追加）',
          parameters: [
            { name: 'path', type: 'string' },
            { name: 'content', type: 'string' },
            { name: 'append', type: 'boolean' },
          ],
          entry: 'capability-executor:file-write',
        },
      ],
    });
  });

  /**
   * POST /api/ui/command
   *
   * AI agent 通过此端点向浏览器端发送操作指令。
   * 指令通过 WebSocket 转发到浏览器端执行。
   *
   * Body: { action: string, params: Record<string, unknown> }
   */
  router.post('/ui/command', (req, res) => {
    const { action, params } = req.body;
    if (!action) {
      res.status(400).json({ error: '缺少 action 字段' });
      return;
    }
    if (wsServer.connectionCount === 0) {
      res.status(503).json({ error: '浏览器端未连接，无法发送指令', action });
      return;
    }
    wsServer.sendCommand(action, params || {});
    res.json({
      status: 'sent',
      action,
      params: params || {},
      connectedClients: wsServer.connectionCount,
    });
  });

  /**
   * GET /api/ui/schema
   *
   * 返回 Registry snapshot 的 JSON Schema，供 AI 理解数据结构。
   */
  router.get('/ui/schema', (_req, res) => {
    res.json({
      PageDescription: {
        type: 'object',
        properties: {
          elements: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', description: '全局唯一标识' },
                type: { type: 'string', enum: ['button', 'text-input', 'floating-button', 'floating-card', 'panel', 'icon'] },
                label: { type: 'string', description: '人类可读的名称' },
                description: { type: 'string', description: '简短描述' },
                state: { type: 'string', description: '当前状态' },
                enabled: { type: 'boolean' },
                effect: { type: 'string', description: '操作此元素后的预期效果' },
                source: { type: 'string', description: '定义该元素的模块' },
              },
            },
          },
          content: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                type: { type: 'string', enum: ['file-tree', 'card-content', 'text-output', 'status-bar'] },
                summary: { type: 'string', description: '信息摘要' },
              },
            },
          },
          capabilities: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                description: { type: 'string' },
                parameters: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, type: { type: 'string' } } } },
                entry: { type: 'string', description: '调用入口' },
              },
            },
          },
          timestamp: { type: 'number', description: 'snapshot 生成时间戳' },
        },
      },
    });
  });

  /**
   * POST /api/capabilities/execute
   *
   * 执行一个能力（通过 Capability Executor）。
   * AI agent 通过此端点调用注册的能力，实现实际的文件操作。
   *
   * Body: { capabilityId: string, params: Record<string, unknown> }
   */
  router.post('/capabilities/execute', async (req, res) => {
    const { capabilityId, params } = req.body;
    if (!capabilityId) {
      res.status(400).json({ error: '缺少 capabilityId 字段' });
      return;
    }
    const result = await capabilityExecutor.execute(capabilityId, params || {});
    res.json(result);
  });

  /**
   * GET /api/capabilities/executor
   *
   * 返回 Capability Executor 支持的能力定义列表。
   * 与 /api/capabilities 的区别：后者返回浏览器端注册的动态清单，
   * 此端点返回服务端实际可执行的能力列表。
   */
  router.get('/capabilities/executor', (_req, res) => {
    res.json({
      capabilities: capabilityExecutor.listCapabilities(),
    });
  });

  /**
   * GET /api/ws/status
   *
   * 返回 WebSocket 连接状态（调试用）。
   */
  router.get('/ws/status', (_req, res) => {
    res.json({
      connected: wsServer.connectionCount > 0,
      clients: wsServer.connectionCount,
      hasSnapshot: wsServer.getLatestSnapshot() !== null,
      hasCapabilities: wsServer.getLatestCapabilities() !== null,
    });
  });
}
