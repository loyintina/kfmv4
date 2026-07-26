/**
 * kfmv4-views.ts — kfmv4 专属调试视图的 JS 注入脚本
 *
 * 这些脚本通过 browser_eval 注入到页面中执行，返回结构化数据。
 * 不另开 CDP 连接——复用 browser 工具已经打通的 puppeteer 通道。
 *
 * 5 个视图：
 *   renderer_snapshot   — Box 树完整结构快照
 *   animation_timeline  — GSAP 动画时间线透视
 *   gesture_trace       — 手势事件流追踪（最近 N 条事件）
 *   state_history       — KFMState notify() 变更日志
 *   card_lifecycle      — card-registry 卡片生命周期追踪
 */

export type Kfmv4ViewName =
  | 'renderer_snapshot'
  | 'animation_timeline'
  | 'gesture_trace'
  | 'state_history'
  | 'card_lifecycle';

export interface Kfmv4ViewResult {
  view: Kfmv4ViewName;
  data: unknown;
  error?: string;
}

// ========== JS 注入脚本 ==========

/** 获取渲染树快照 */
export const RENDERER_SNAPSHOT_SCRIPT = `
(function() {
  try {
    // 获取 L (RendererLifecycle) 单例
    const L = window.__L || window.L;
    if (!L || !L.renderer) return { view: 'renderer_snapshot', error: 'RendererLifecycle not found' };

    const renderer = L.renderer;
    const root = renderer._root;

    function snapshotBox(box, depth) {
      if (!box || depth > 50) return null;
      return {
        tag: box.tag || 'box',
        id: box.id || '',
        rect: box.rect ? { x: box.rect.x, y: box.rect.y, w: box.rect.width, h: box.rect.height } : null,
        visible: box.visible !== false,
        opacity: box.opacity ?? 1,
        children: box.children ? box.children.map(function(c) { return snapshotBox(c, depth + 1); }).filter(Boolean) : []
      };
    }

    return {
      view: 'renderer_snapshot',
      data: {
        root: root ? snapshotBox(root, 0) : null,
        boxCount: renderer._boxCount || 'N/A',
        canvasSize: renderer.canvas ? { w: renderer.canvas.width, h: renderer.canvas.height } : null,
        activeOverlays: Array.isArray(L._activeOverlays) ? L._activeOverlays.map(function(o) {
          return { tag: o.tag, id: o.id };
        }) : [],
        isAnimating: !!L.isAnimating
      }
    };
  } catch (e) { return { view: 'renderer_snapshot', error: e.message }; }
})()`;

/** 获取 GSAP 动画时间线 */
export const ANIMATION_TIMELINE_SCRIPT = `
(function() {
  try {
    const anim = window.__anim || window.anim;
    if (!anim) return { view: 'animation_timeline', error: 'animation-registry not found' };

    var timelines = [];
    var allTweens = [];

    // GSAP 暴露全局 _gsScope 或 gsap
    var gsap = window.gsap || window.GreenSockGlobals;
    if (gsap && gsap.globalTimeline) {
      function walk(tl, label) {
        if (!tl || !tl.getChildren) return;
        var children = tl.getChildren(false);
        if (children.length === 0) return;
        var info = {
          label: label,
          children: children.length,
          active: tl.isActive ? tl.isActive() : 'N/A',
          progress: tl.progress ? tl.progress() : 'N/A',
          tweens: []
        };
        children.forEach(function(c) {
          if (c.isActive && c.isActive()) {
            info.tweens.push({
              target: c.targets ? c.targets().map(function(t) { return (t.tagName || t.id || t.className || 'element').toString().slice(0, 30); }) : [],
              vars: c.vars ? Object.keys(c.vars).slice(0, 10).join(',') : ''
            });
            allTweens.push(c);
          }
        });
        if (info.tweens.length > 0) timelines.push(info);
      }
      walk(gsap.globalTimeline, 'global');
    }

    // 从 animation-registry 获取 scoped timelines
    if (anim._timelines) {
      Object.keys(anim._timelines).forEach(function(key) {
        walk(anim._timelines[key], key);
      });
    }

    return {
      view: 'animation_timeline',
      data: {
        activeTweens: allTweens.length,
        timelines: timelines,
        animRegistryScope: anim._scope || 'N/A'
      }
    };
  } catch (e) { return { view: 'animation_timeline', error: e.message }; }
})()`;

/** 获取近期手势事件流 */
export const GESTURE_TRACE_SCRIPT = `
(function() {
  try {
    var gr = window.__gestureRegistry || window.GestureRegistry;
    if (!gr) return { view: 'gesture_trace', error: 'GestureRegistry not found' };

    return {
      view: 'gesture_trace',
      data: {
        activeGesture: gr._active ? {
          id: gr._active.id,
          type: gr._active.type,
          startPos: gr._active._startPos,
          lastPos: gr._active._lastPos
        } : null,
        registeredHandlers: (gr._handlers || []).map(function(h) {
          return { id: h.id, priority: h.priority, active: !!h._isActive };
        }).sort(function(a, b) { return b.priority - a.priority; }),
        recentEvents: gr._eventLog ? gr._eventLog.slice(-10) : []
      }
    };
  } catch (e) { return { view: 'gesture_trace', error: e.message }; }
})()`;

/** 获取 KFMState 变更历史 */
export const STATE_HISTORY_SCRIPT = `
(function() {
  try {
    var kfmState = window.KFMState;
    if (!kfmState) return { view: 'state_history', error: 'KFMState not found' };

    return {
      view: 'state_history',
      data: {
        currentState: {
          files: kfmState.files ? Object.keys(kfmState.files).length + ' entries' : 'N/A',
          sidebarOpen: !!kfmState.sidebarOpen,
          cardStackOpen: !!kfmState.cardStackOpen,
          activePath: kfmState.activePath || '',
          expandedPaths: kfmState.expandedPaths ? kfmState.expandedPaths.size + ' paths' : 'N/A'
        },
        subscribers: (kfmState._subscribers || []).map(function(s) {
          return { id: s.id || s.name || 'anonymous', active: !s.paused };
        }),
        notifyCount: kfmState._notifyCount || 'N/A'
      }
    };
  } catch (e) { return { view: 'state_history', error: e.message }; }
})()`;

/** 获取卡片生命周期 */
export const CARD_LIFECYCLE_SCRIPT = `
(function() {
  try {
    var cr = window.__cardRegistry || window.cardRegistry;
    if (!cr) return { view: 'card_lifecycle', error: 'card-registry not found' };

    var instances = [];
    if (cr._instances) {
      cr._instances.forEach(function(inst, id) {
        instances.push({
          id: id,
          type: inst.type || 'unknown',
          state: inst.state || 'unknown',
          createdAt: inst._createdAt || 'N/A'
        });
      });
    }

    return {
      view: 'card_lifecycle',
      data: {
        instanceCount: instances.length,
        instances: instances,
        activeCards: instances.filter(function(i) { return i.state === 'active'; }).length,
        stackedCards: instances.length
      }
    };
  } catch (e) { return { view: 'card_lifecycle', error: e.message }; }
})()`;

// ========== 视图名称映射 ==========

export const KFMV4_SCRIPT_MAP: Record<Kfmv4ViewName, string> = {
  renderer_snapshot: RENDERER_SNAPSHOT_SCRIPT,
  animation_timeline: ANIMATION_TIMELINE_SCRIPT,
  gesture_trace: GESTURE_TRACE_SCRIPT,
  state_history: STATE_HISTORY_SCRIPT,
  card_lifecycle: CARD_LIFECYCLE_SCRIPT,
};

/** 格式化渲染树快照为文本 */
export function formatRendererSnapshot(data: Record<string, unknown>): string {
  const lines: string[] = ['## 渲染树快照'];
  if (data.canvasSize) {
    const c = data.canvasSize as { w: number; h: number };
    lines.push(`Canvas: ${c.w}x${c.h}`);
  }
  lines.push(`Box 数量: ${data.boxCount}`);
  lines.push(`动画中: ${data.isAnimating ? '是' : '否'}`);
  const overlays = data.activeOverlays as Array<{ tag: string; id: string }> | undefined;
  if (overlays?.length) {
    lines.push(`活跃 Overlay: ${overlays.map(o => `${o.tag}#${o.id}`).join(', ')}`);
  }
  function walk(node: Record<string, unknown> | null, depth: number): void {
    if (!node || depth > 8) return;
    const indent = '  '.repeat(depth);
    const rect = node.rect as { x: number; y: number; w: number; h: number } | null;
    const pos = rect ? `(${rect.x},${rect.y} ${rect.w}×${rect.h})` : '';
    const vis = node.visible === false ? ' [hidden]' : '';
    lines.push(`${indent}📦 ${node.tag || 'box'} ${pos}${vis}`);
    const children = node.children as Array<Record<string, unknown>> | undefined;
    if (children) children.forEach(c => walk(c, depth + 1));
  }
  walk(data.root as Record<string, unknown> | null, 0);
  return lines.join('\n');
}

/** 格式化动画时间线为文本 */
export function formatAnimationTimeline(data: Record<string, unknown>): string {
  const lines: string[] = ['## 动画时间线'];
  lines.push(`活跃补间: ${data.activeTweens}`);
  lines.push(`scope: ${data.animRegistryScope || 'N/A'}`);
  const tls = data.timelines as Array<Record<string, unknown>> | undefined;
  if (tls?.length) {
    lines.push(`时间线 (${tls.length}):`);
    tls.forEach(tl => {
      lines.push(`  ${tl.label}: ${tl.active} / ${tl.children} children`);
      const tweens = tl.tweens as Array<Record<string, unknown>> | undefined;
      if (tweens) {
        tweens.forEach(t => {
          const targets = t.target as string[];
          lines.push(`    → ${targets?.join(', ') || 'unknown'} (${t.vars})`);
        });
      }
    });
  } else {
    lines.push('无活跃动画');
  }
  return lines.join('\n');
}

/** 格式化手势事件流为文本 */
export function formatGestureTrace(data: Record<string, unknown>): string {
  const lines: string[] = ['## 手势事件流'];
  const active = data.activeGesture as Record<string, unknown> | null;
  if (active) {
    lines.push(`当前手势: ${active.id} (type: ${active.type})`);
  } else {
    lines.push('无活跃手势');
  }
  const handlers = data.registeredHandlers as Array<Record<string, unknown>> | undefined;
  if (handlers) {
    lines.push(`已注册处理器 (${handlers.length}):`);
    handlers.forEach(h => {
      lines.push(`  ${h.priority}. ${h.id} ${h.active ? '(active)' : ''}`);
    });
  }
  return lines.join('\n');
}

/** 格式化状态变更日志为文本 */
export function formatStateHistory(data: Record<string, unknown>): string {
  const lines: string[] = ['## KFM 状态快照'];
  const cs = data.currentState as Record<string, unknown>;
  if (cs) {
    Object.keys(cs).forEach(k => {
      lines.push(`  ${k}: ${cs[k]}`);
    });
  }
  const subs = data.subscribers as Array<Record<string, unknown>> | undefined;
  if (subs) {
    lines.push(`订阅者 (${subs.length}):`);
    subs.forEach(s => {
      lines.push(`  ${s.id} ${s.active ? '✅ 活跃' : '⏸️ 暂停'}`);
    });
  }
  return lines.join('\n');
}

/** 格式化卡片生命周期为文本 */
export function formatCardLifecycle(data: Record<string, unknown>): string {
  const lines: string[] = ['## 卡片生命周期'];
  lines.push(`活跃卡片: ${data.activeCards || 0}`);
  lines.push(`总实例数: ${data.stackedCards || 0}`);
  const instances = data.instances as Array<Record<string, unknown>> | undefined;
  if (instances) {
    instances.forEach(i => {
      lines.push(`  📇 ${i.id}: ${i.type} (${i.state})`);
    });
  }
  return lines.join('\n');
}
