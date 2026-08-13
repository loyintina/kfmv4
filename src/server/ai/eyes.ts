/**
 * eyes.ts — 「眼睛」动态文件生成器（MD 语义外壳 + YAML 数据内核）
 *
 * 2026-08-11 重构：替代 page-state.ts 的手拼 MD 三段式——按 docs/active/眼睛与手.md
 * 的「三、动态眼睛文件 YAML 格式」模板生成。MD 标题提供语义引导，YAML 块提供
 * 精确数据。数据源：obs.ts 聚合（余额/信箱/待办/系统/脉搏/执勤/权限/角色/星轨）
 * + 浏览器快照（文件树/光球/卡片堆）。
 *
 * 写入 .kfmv4/agents/prompts/dynamic/eyes.md——角色卡列进 dynamicPromptFiles 即获得
 * 「眼睛」。触发时机：工具调用后 + 收到快照（同 refreshPageState）。
 *
 * 2026-08-12 新增「当前视口」段（标定坐标系之后）：客户端 viewport-visibility
 * 矩形减法实测遮挡，full/partial 列出（partial 带可见比例+遮挡者），hidden
 * 只留一行汇总——修「全屏卡盖住中央页面，AI 仍以为待办可见」的手眼错位。
 */
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { dump } from 'js-yaml';
import { KFM_DATA_DIR, sanitizePath, getActiveRoot } from '../path-utils.js';
import type { WsServer } from '../ws-server.js';
import {
  fetchDeepseekBalance, collectSys,
} from '../routes/obs.js';

export const EYES_PATH = join(KFM_DATA_DIR, 'agents', 'prompts', 'dynamic', 'eyes.md');

/** 从快照提取 viewport（无则默认手机竖屏） */
function viewportOf(snap: unknown): { width: number; height: number } {
  const vp = (snap as Record<string, unknown>)?.['viewport'] as { width?: number; height?: number } | undefined;
  return { width: Math.round(vp?.width || 384), height: Math.round(vp?.height || 853) };
}

/** 遮挡判断：文件树可见（快照 file-tree 有展开）或焦点卡全屏 → 中央面板省略 */
function isHudHidden(snap: unknown): boolean {
  const content = (snap as Record<string, unknown>)?.['content'] as Array<Record<string, unknown>> | undefined;
  for (const c of content || []) {
    if (c?.['type'] === 'file-tree' && String(c?.['summary'] || '').includes('展开')) return true;
    if (c?.['type'] === 'card-content') {
      // 焦点卡全屏时 card-content summary 带"全屏"标记（简化：存在 card-content 即视为可能遮挡）
    }
  }
  return false;
}

/** 从快照提取文件树展开状态（content 层 file-tree 的 detail 优先，summary 回退） */
function treeOf(snap: unknown): { root: string; expanded: string[]; selected: string; cursorPath: string; visible: boolean; scrollY: number; visibleH: number; visiblePaths: string[] } {
  const content = (snap as Record<string, unknown>)?.['content'] as Array<Record<string, unknown>> | undefined;
  let root = '/root', expanded: string[] = [], selected = '', cursorPath = '', visible = false, scrollY = 0, visibleH = 618, visiblePaths: string[] = [];
  for (const c of content || []) {
    if (c?.['type'] === 'file-tree') {
      const detail = c?.['detail'] as Record<string, unknown> | undefined;
      if (detail && typeof detail === 'object') {
        if (typeof detail['root'] === 'string' && detail['root']) root = detail['root'];
        if (Array.isArray(detail['expanded'])) {
          expanded = detail['expanded'].filter((x): x is string => typeof x === 'string');
        }
        if (typeof detail['selected'] === 'string') selected = detail['selected'];
        if (typeof detail['cursorPath'] === 'string') cursorPath = detail['cursorPath'];
        visible = detail['visible'] === true;
        if (typeof detail['scrollY'] === 'number') scrollY = detail['scrollY'];
        if (typeof detail['visibleH'] === 'number') visibleH = detail['visibleH'];
        if (Array.isArray(detail['visiblePaths'])) {
          visiblePaths = detail['visiblePaths'].filter((x): x is string => typeof x === 'string');
        }
      }
      const summary = String(c?.['summary'] || '');
      if (summary.includes('展开') || summary.includes('根目录')) visible = true;
      if (!expanded.length) {
        const ex = summary.match(/展开: (.*?)(?:\s+\+\d+项)?$/);
        if (ex) expanded = ex[1].split(',').map(x => x.trim()).filter(Boolean);
      }
    }
  }
  return { root, expanded, selected, cursorPath, visible, scrollY, visibleH, visiblePaths };
}

/**
 * 用 fs 重建文件树全量可见项（含隐藏 . 项——树加载器 showHidden:true）。
 * 设计意图（眼睛与手.md 二-文件树）：展开目录递归列出子项、折叠目录单行带
 * 直接子项数（含隐藏项）、文件单行；深度优先编号；光标 = UI 光标所在行
 * （cursorPath，点击目录也移动），selected 回退。
 * 懒加载只缓存展开过的目录，折叠目录子项数客户端拿不到 → 服务端直接读盘。
 */
function buildTreeItems(root: string, expanded: string[], cursorPath: string, selected: string, maxItems = 400): { items: unknown[]; truncated: boolean } {
  const expandedSet = new Set(expanded);
  const items: unknown[] = [];
  let truncated = false;
  const cursor = cursorPath || selected;   // UI 光标优先，selectedFile 回退

  function readDir(dir: string): { name: string; path: string; isDir: boolean }[] {
    try {
      return readdirSync(dir, { withFileTypes: true })
        .filter(d => d.isDirectory() || d.isFile())
        .map(d => ({ name: d.name, path: `${dir}/${d.name}`, isDir: d.isDirectory() }))
        .sort((a, b) => a.isDir !== b.isDir ? (a.isDir ? -1 : 1) : a.name.localeCompare(b.name));
    } catch {
      return [];
    }
  }

  function countChildren(dir: string): number {
    try {
      return readdirSync(dir).length;
    } catch {
      return 0;
    }
  }

  function walk(dir: string, depth: number): void {
    if (items.length >= maxItems) { truncated = true; return; }
    const children = readDir(dir);
    for (const child of children) {
      if (items.length >= maxItems) { truncated = true; return; }
      if (child.isDir) {
        const isExpanded = expandedSet.has(child.path);
        const entry: Record<string, unknown> = {
          depth, state: isExpanded ? 'expanded' : 'collapsed', path: child.path,
        };
        if (!isExpanded) entry.count = countChildren(child.path);
        if (child.path === cursor) entry.cursor = true;
        items.push(entry);
        if (isExpanded) walk(child.path, depth + 1);
      } else {
        const entry: Record<string, unknown> = { depth, state: 'file', path: child.path };
        if (child.path === cursor) entry.cursor = true;
        items.push(entry);
      }
    }
  }

  if (items.length < maxItems) walk(root, 1);  // 根的直接子项 depth=1（根自身 depth=0 由调用方输出）
  return { items, truncated };
}

/** 从快照提取卡片堆（content 层 card-content 的 detail 优先，summary 回退） */
function cardsOf(snap: unknown): { count: number; focus: number; title: string; visible: boolean; list: string[] } {
  const content = (snap as Record<string, unknown>)?.['content'] as Array<Record<string, unknown>> | undefined;
  let count = 0, focus = 0, title = '', visible = false, list: string[] = [];
  for (const c of content || []) {
    if (c?.['type'] === 'card-content') {
      const detail = c?.['detail'] as Record<string, unknown> | undefined;
      if (detail && typeof detail === 'object') {
        if (typeof detail['count'] === 'number') count = detail['count'];
        if (typeof detail['focus'] === 'number') focus = detail['focus'];
        if (typeof detail['visible'] === 'boolean') visible = detail['visible'];
        if (Array.isArray(detail['list'])) list = detail['list'].filter((x): x is string => typeof x === 'string');
      }
      const summary = String(c?.['summary'] || '');
      const m = summary.match(/\[(\d+)\/(\d+)\]\s*(\S+)/);
      if (m && focus === 0) { focus = Number(m[1]); count = Number(m[2]); title = m[3]; }
      if (!title) title = (summary.match(/\]\s*(\S+)/) || [])[1] || '';
    }
  }
  return { count, focus, title, visible, list };
}

/** 从快照提取光球状态（elements 层） */
function orbOf(snap: unknown): { state: string; panel: string } {
  const els = (snap as Record<string, unknown>)?.['elements'] as Array<Record<string, unknown>> | undefined;
  let state = 'collapsed', panel = 'closed';
  for (const e of els || []) {
    const label = String(e?.['label'] || e?.['id'] || '');
    const st = String(e?.['state'] || '');
    if (label.includes('光球')) state = st === 'expanded' ? 'expanded' : 'collapsed';
    if (label.includes('AI 对话面板')) panel = st === 'open' ? 'open' : 'closed';
  }
  return { state, panel };
}

/** 读会话尾 N 条（对话摘要——工具块显示 工具名+命令要点，不抓 AI 思考文本） */
function readRecentDialog(sessionId: string, n: number): Array<Record<string, string>> {
  try {
    const d = JSON.parse(readFileSync(join(KFM_DATA_DIR, 'sessions', `${sessionId}.json`), 'utf-8'));
    const msgs = (d.messages || []).slice(-n);
    return msgs.map((m: { role: string; content?: Array<Record<string, unknown>> }) => {
      let text = '', tool = '', toolSummary = '';
      for (const b of (m.content || [])) {
        if (b?.type === 'text') text += String(b.text || '');
        else if (b?.type === 'tool') {
          tool = String(b.name || '');
          // 工具摘要 = 命令/输入要点（如 bash 的命令、read 的路径），不抓 AI 思考文本
          const input = (b.input as Record<string, unknown> | undefined) ?? {};
          const cmd = typeof input['command'] === 'string' ? input['command'] : '';
          const p = typeof input['path'] === 'string' ? input['path'] : '';
          const q = typeof input['query'] === 'string' ? input['query'] : '';
          toolSummary = (cmd || p || q || tool).replace(/\s+/g, ' ').slice(0, 60);
        }
      }
      text = text.trim().replace(/\s+/g, ' ').slice(0, 50);
      if (tool) return { role: '工具调用', tool, summary: toolSummary };
      return { role: m.role === 'user' ? '洛' : m.role === 'ai' ? 'ai' : m.role, text };
    });
  } catch { return []; }
}

/** 读 active.json（角色/会话/provider/model 当前值） */
function readActiveJson(): Record<string, string> {
  try {
    return JSON.parse(readFileSync(join(KFM_DATA_DIR, 'active.json'), 'utf-8'));
  } catch { return {}; }
}

/**
 * 生成眼睛文件（MD+YAML）。失败时写占位，不抛——眼睛不阻断工具循环。
 */
export async function genEyes(wsServer: WsServer): Promise<void> {
  try {
    const snap = wsServer.getLatestSnapshot();
    const vp = viewportOf(snap);
    const hudHidden = false; // 2026-08-11 洛拍板：先全量输出，遮挡省略后续再做
    const tree = treeOf(snap);
    const cards = cardsOf(snap);
    const orb = orbOf(snap);
    const activeRaw = readActiveJson();   // 顶框 provider + 光球面板 role/session/provider/model 共用
    const now = new Date();

    const L: string[] = [];
    L.push('# 当前页面状态（快照）\n');
    L.push('> 本节由系统在每次工具调用后自动刷新，反映你的操作对页面的实际影响。\n');
    L.push(`> 屏幕：${vp.width} × ${vp.height} · 绝对像素 · 原点左上(0,0) · 生成于 ${now.toISOString()}\n`);

    // ===== 标定坐标系 =====
    L.push('## 标定坐标系');
    L.push('```yaml');
    L.push(dump({ coords: { origin: { x: 0, y: 0 }, bottomRight: { x: vp.width, y: vp.height }, unit: 'px' } }).trimEnd());
    L.push('```\n');

    // 坐标：快照 coords 实时量取（浏览器 getBoundingClientRect）——2026-08-11
    const snapCoords = (snap as unknown as Record<string, unknown>)?.['coords'] as Record<string, { x?: number; y?: number; w?: number; h?: number }> | undefined; // escape-ok: 快照 coords 是 PageDescription 可选字段，运行时可能缺失，属受控读取
    const rectOf = (k: string, fb: [number, number, number, number]): { a: number[]; b: number[] } => {
      const r = snapCoords?.[k];
      if (r && r.x !== undefined && r.y !== undefined && r.w !== undefined && r.h !== undefined) {
        return { a: [Math.round(r.x), Math.round(r.y)], b: [Math.round(r.x + r.w), Math.round(r.y + r.h)] };
      }
      const [x1, y1, x2, y2] = fb;
      return { a: [x1, y1], b: [x2, y2] };
    };

    // ===== 当前视口（此刻真正露在屏幕上的——矩形减法遮挡实测，2026-08-12 立项） =====
    // 用户拍板：full/partial 列出（partial 带可见比例+遮挡者），hidden 不列、
    // 只留一行汇总（AI 需知它们还在、只是看不见）。旧客户端无 viewportVisibility → 整段省略。
    // 边界：全屏卡只标「全屏卡」不带卡名——浮卡未接 Registry，快照拿不到标题（v2 再议）。
    const vis = (snap as Record<string, unknown> | null)?.['viewportVisibility'] as Array<{ id: string; cover: string; visiblePct: number; coveredBy: string[] }> | undefined;
    if (vis && vis.length > 0) {
      const VIS_LABEL: Record<string, string> = {
        'hud.top': '顶框', 'hud.inbox': '信箱', 'hud.starmap': '星轨', 'hud.sys': '系统',
        'hud.pulse': '脉搏', 'hud.duty': '执勤', 'hud.stack': '待办', 'hud.roles': '角色框',
        'hud.perms': '权限', 'tree': '文件树', 'cards': '卡片堆', 'orb': '光球', 'orb.panel': '光球面板',
        'card.fullscreen': '全屏卡',
      };
      const labelOf = (id: string): string => VIS_LABEL[id] || id;
      const coordsOf = (id: string): { a: number[]; b: number[] } | undefined => {
        const r = snapCoords?.[id];
        if (r && r.x !== undefined && r.y !== undefined && r.w !== undefined && r.h !== undefined && r.w > 0 && r.h > 0) {
          return { a: [Math.round(r.x), Math.round(r.y)], b: [Math.round(r.x + r.w), Math.round(r.y + r.h)] };
        }
        return undefined;
      };
      L.push('## 当前视口（此刻真正露在屏幕上的区域——遮挡已实测；完全遮挡的不列出，见 hidden 行）');
      L.push('```yaml');
      const rows = vis.filter(v => v.cover !== 'hidden').map(v => {
        const row: Record<string, unknown> = { region: labelOf(v.id) };
        const co = coordsOf(v.id);
        if (co) row.coords = co;
        row.cover = v.cover;
        if (v.cover === 'partial') {
          row.visiblePct = v.visiblePct;
          row.coveredBy = v.coveredBy.map(labelOf);
        }
        return row;
      });
      const hiddenRows = vis.filter(v => v.cover === 'hidden')
        .map(v => ({ region: labelOf(v.id), coveredBy: v.coveredBy.map(labelOf) }));
      const visObj: Record<string, unknown> = { viewport: rows };
      if (hiddenRows.length > 0) visObj.hidden = hiddenRows;
      L.push(dump(visObj).trimEnd());
      L.push('```\n');
    }

    // ===== 中央面板（遮挡时省略）=====
    // 2026-08-13 用户定稿：九格全删，回归网格线——顶栏 = provider + 系统三格 + 余额；
    // 信箱/星轨/脉搏/执勤/待办/角色框/权限 UI 删除，数据源路标保留在下方注释。
    if (!hudHidden) {
      const [balance, sys] = await Promise.all([
        fetchDeepseekBalance().catch(() => null),
        Promise.resolve(collectSys()),
      ]);

      const FALLBACK: Record<string, [number, number, number, number]> = {
        top: [6, 14, 378, 76],
      };
      const c = (k: string) => rectOf(`hud.${k}`, FALLBACK[k]);
      // 中央页面收拢为一个同级整体段（与文件树/光球面板/卡片堆平级），
      // 各面板为段内 ### 子条目——2026-08-11 用户拍板组织结构统一
      L.push('## 中央页面');
      const cc = (k: string, obj: unknown) => { L.push(`### ${k}`); L.push('```yaml'); L.push(dump(obj).trimEnd()); L.push('```\n'); };

      const balText = balance && 'total' in balance ? `¥${balance.total}` : '（不可用）';
      // 顶栏 = provider + 系统三格 + 余额（2026-08-13 用户定稿：九格 UI 删除，中央页面还给网格线）。
      // 徽标/手锚定在顶栏下方（obs-hud.ts 内部处理，非坐标信息）。
      cc('顶栏', {
        coords: c('top'),
        provider: activeRaw.providerId || 'deepseek',
        balance: balText,
        disk: sys.metrics.find(x => x.label === '硬盘')?.value,
        mem: sys.metrics.find(x => x.label === '内存')?.value,
        load: sys.metrics.find(x => x.label === '负载')?.value,
        source: 'DeepSeek API balance 实时查询（providers.json 取 apiKey）+ ledger/sys-metrics.json',
      });
      // 已删除格子的数据源路标（UI 删除，AI 如需查仍可直读文件）：
      // 信箱待裁决 → docs/ledger/semantic-chain-inbox.md（collectAuditPending 总量）
      // 星轨 → sessions/*.json（collectArchive）
      // 脉搏 → ledger/agent-calls.jsonl + ledger/tool-exec.jsonl（collectPulse）
      // 执勤 → ledger/check-failures.jsonl（cron 状态）
      // 待办 → docs/active/stack.yaml（parseStack）
      // 角色框 → agents/roles/*.json + active.json（collectRoles）
      // 权限 → ledger/permission-audit.jsonl（collectPerms）
    }

    // ===== 文件树（始终——手操作清单）=====
    L.push('## 文件树（全量——即使 UI 隐藏，手操作清单）');
    L.push('```yaml');
    const treeObj: Record<string, unknown> = { visible: tree.visible, items: [] };
    const items: unknown[] = [];
    // 根目录项（depth 0，恒展开）；root 越出 activeRoot 时整树回退为展开路径链
    const rootPath = tree.root === '~' ? getActiveRoot() : tree.root;
    const safeRoot = sanitizePath(rootPath);
    const displayRoot = safeRoot || rootPath;   // '~'/'.' 显示为解析后的绝对路径
    const treeCursor = tree.cursorPath || tree.selected;   // UI 光标优先，selectedFile 回退
    items.push({ id: 1, depth: 0, state: 'expanded', path: displayRoot, cursor: treeCursor === displayRoot ? true : undefined });
    if (safeRoot) {
      // 服务端 fs 重建全量 DFS 树（含隐藏项/折叠计数）——2026-08-11
      const expandedInRoot = tree.expanded.filter(p => p === displayRoot || p.startsWith(displayRoot + '/'));
      const { items: treeItems, truncated } = buildTreeItems(safeRoot, expandedInRoot, tree.cursorPath, tree.selected);
      if (truncated) treeObj.truncated = true;
      if (treeItems.length > 0) {
        // 重编号：根 = 1，后续 DFS 连续
        let id = 1;
        for (const t of treeItems) {
          id += 1;
          items.push({ ...(t as Record<string, unknown>), id });
        }
      }
    } else {
      // root 越界（如 activeRoot 已切换）：安全回退——只列展开路径链
      tree.expanded.slice(0, 6).forEach((p, i) => items.push({ id: i + 2, depth: 1, state: 'expanded', path: p }));
      treeObj.fallback = 'root 越出 activeRoot，仅列展开路径';
    }
    treeObj.items = items;
    // 文件树坐标：快照 coords['tree']（.sidebar 实时量取），缺失回退设计文档实测值
    const treeRect = snapCoords?.['tree'];
    if (treeRect && treeRect.x !== undefined && treeRect.y !== undefined && treeRect.w !== undefined && treeRect.h !== undefined) {
      treeObj.coords = { a: [Math.round(treeRect.x), Math.round(treeRect.y)], b: [Math.round(treeRect.x + treeRect.w), Math.round(treeRect.y + treeRect.h)] };
    } else {
      treeObj.coords = { a: [0, 0], b: [288, 769] };   // 384×853 实测 2026-08-10（设计文档 (二)1.(1)）
    }
    // 可见范围：优先用客户端上报的精确可见行路径映射 id（行高动态，渲染端
    // _rowIndex 按绝对 Y 判断最准）；缺失（旧浏览器）回退 scrollY/26 估算
    const pathToId = new Map<string, number>();
    for (const it of items) pathToId.set((it as { path: string }).path, (it as { id: number }).id);
    const vpIds = tree.visiblePaths.map(p => pathToId.get(p)).filter((v): v is number => v !== undefined);
    if (vpIds.length > 0) {
      treeObj.viewport = { from: Math.min(...vpIds), to: Math.max(...vpIds) };
    } else {
      const ROW_H = 26;
      treeObj.viewport = {
        from: Math.min(items.length, Math.max(1, Math.floor(tree.scrollY / ROW_H) + 1)),
        to: Math.min(items.length, Math.ceil((tree.scrollY + tree.visibleH) / ROW_H)),
      };
    }
    // 光标：UI 光标/选中项匹配项（buildTreeItems 内已标 cursor:true）；无则输出 null
    const cursorItem = items.find(i => (i as { cursor?: boolean }).cursor);
    treeObj.cursor = cursorItem ? (cursorItem as { id: number }).id : null;
    treeObj.multi = 'none';
    treeObj.source = 'snapshot detail（expanded 全量 + 光标 + 精确可见行）+ fs 重建（含隐藏项/折叠计数）';
    L.push(dump(treeObj).trimEnd());
    L.push('```\n');

    // ===== 光球面板（始终——含会话上下文 + 最近 3 条对话）=====
    const dialog = readRecentDialog(activeRaw.sessionId || '', 3);
    L.push('## 光球面板');
    L.push('```yaml');
    // 光球位置动态量取（快照 coords['orb'] = .light-orb rect），缺失回退 384×853 实测
    const orbRect = snapCoords?.['orb'];
    const orbPos = orbRect && orbRect.x !== undefined && orbRect.y !== undefined && orbRect.w !== undefined && orbRect.h !== undefined
      ? { x: Math.round(orbRect.x), y: Math.round(orbRect.y), w: Math.round(orbRect.w), h: Math.round(orbRect.h) }
      : { x: 324, y: 677, w: 36, h: 36 };
    // 面板坐标：快照 coords['orb.panel']（.orb-panel rect），缺失回退设计文档实测
    const panelRect = snapCoords?.['orb.panel'];
    const panelCoords = panelRect && panelRect.x !== undefined && panelRect.y !== undefined && panelRect.w !== undefined && panelRect.h !== undefined
      ? { a: [Math.round(panelRect.x), Math.round(panelRect.y)], b: [Math.round(panelRect.x + panelRect.w), Math.round(panelRect.y + panelRect.h)] }
      : { a: [42, 345], b: [342, 695] };
    const panelObj: Record<string, unknown> = {
      orb: { state: orb.state, position: orbPos },
      panel: {
        state: orb.panel,
        coords: panelCoords,
        role: activeRaw.roleFile || '',
        session: activeRaw.sessionId || '',
        provider: activeRaw.providerId || '',
        model: activeRaw.modelId || '',
        dialog,
        source: 'active.json + sessions/<id>.json',
      },
    };
    L.push(dump(panelObj).trimEnd());
    L.push('```\n');

    // ===== 卡片堆（始终——手操作清单）=====
    L.push('## 卡片堆（全量——即使 UI 隐藏，手操作清单）');
    L.push('```yaml');
    // 卡片堆坐标：快照 coords['cards']（.stack-card rect 实时量取/视口推算），
    // 缺失回退 384 屏推算值（right:0 + cardWidth 155，top = 853×0.12）
    const cardsRect = snapCoords?.['cards'];
    const cardsCoords = cardsRect && cardsRect.x !== undefined && cardsRect.y !== undefined && cardsRect.w !== undefined && cardsRect.h !== undefined
      ? { a: [Math.round(cardsRect.x), Math.round(cardsRect.y)], b: [Math.round(cardsRect.x + cardsRect.w), Math.round(cardsRect.y + cardsRect.h)] }
      : { a: [229, 102], b: [384, 170] };   // 384×853 推算（right:0 首卡 155 宽）
    const cardsObj: Record<string, unknown> = { visible: cards.visible, coords: cardsCoords, count: cards.count, focus: cards.focus };
    if (cards.list.length > 0) cardsObj.list = cards.list;
    else if (cards.title) cardsObj.list = [cards.title];
    cardsObj.source = '卡注册表 registry.ts + card-stack 聚焦序号';
    L.push(dump(cardsObj).trimEnd());
    L.push('```');

    writeFileSync(EYES_PATH, L.join('\n') + '\n', 'utf-8');
  } catch (e) {
    console.error('[eyes] 生成失败:', e instanceof Error ? e.message : e);
    try { writeFileSync(EYES_PATH, `# 当前页面状态（快照）\n\n> 暂无页面快照（浏览器未连接或生成失败）。\n`, 'utf-8'); } catch { /* 写占位失败不致命 */ }
  }
}
