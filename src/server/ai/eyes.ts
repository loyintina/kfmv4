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
 */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { dump } from 'js-yaml';
import { KFM_DATA_DIR } from '../path-utils.js';
import type { WsServer } from '../ws-server.js';
import {
  fetchDeepseekBalance, parseInbox, parseStack, collectSys,
  collectArchive, collectPulse, collectPerms, collectRoles,
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

/** 从快照提取文件树展开状态（content 层 file-tree） */
function treeOf(snap: unknown): { root: string; expanded: string[]; visible: boolean } {
  const content = (snap as Record<string, unknown>)?.['content'] as Array<Record<string, unknown>> | undefined;
  let root = '/root', expanded: string[] = [], visible = false;
  for (const c of content || []) {
    if (c?.['type'] === 'file-tree') {
      const summary = String(c?.['summary'] || '');
      const m = summary.match(/根目录: (\S+)/);
      if (m) root = m[1];
      const ex = summary.match(/展开: (.*?)(?:\s+\+\d+项)?$/);
      if (ex) expanded = ex[1].split(',').map(x => x.trim()).filter(Boolean);
      visible = summary.includes('展开');
    }
  }
  return { root, expanded, visible };
}

/** 从快照提取卡片堆（content 层 card-content） */
function cardsOf(snap: unknown): { count: number; focus: number; title: string } {
  const content = (snap as Record<string, unknown>)?.['content'] as Array<Record<string, unknown>> | undefined;
  for (const c of content || []) {
    if (c?.['type'] === 'card-content') {
      const summary = String(c?.['summary'] || '');
      const m = summary.match(/\[(\d+)\/(\d+)\]\s*(\S+)/);
      if (m) return { focus: Number(m[1]), count: Number(m[2]), title: m[3] };
    }
  }
  return { count: 0, focus: 0, title: '' };
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

/** 读会话尾 N 条（对话摘要——工具块只留名+要点） */
function readRecentDialog(sessionId: string, n: number): Array<Record<string, string>> {
  try {
    const d = JSON.parse(readFileSync(join(KFM_DATA_DIR, 'sessions', `${sessionId}.json`), 'utf-8'));
    const msgs = (d.messages || []).slice(-n);
    return msgs.map((m: { role: string; content?: Array<Record<string, unknown>> }) => {
      let text = '', tool = '';
      for (const b of (m.content || [])) {
        if (b?.type === 'text') text += String(b.text || '');
        else if (b?.type === 'tool') tool = String(b.name || '');
      }
      text = text.trim().replace(/\s+/g, ' ').slice(0, 50);
      if (tool) return { role: 'ai', tool, summary: text };
      return { role: m.role === 'user' ? '洛' : 'ai', text };
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

    // ===== 中央面板（遮挡时省略）=====
    if (!hudHidden) {
      const [balance, inbox, stack, sys, archive, pulse, perms, roles] = await Promise.all([
        fetchDeepseekBalance().catch(() => null),
        Promise.resolve(parseInbox()),
        Promise.resolve(parseStack()),
        Promise.resolve(collectSys()),
        Promise.resolve(collectArchive()),
        Promise.resolve(collectPulse()),
        Promise.resolve(collectPerms()),
        Promise.resolve(collectRoles()),
      ]);

      // 坐标：快照 coords 实时量取（浏览器 getBoundingClientRect）——2026-08-11
      const snapCoords = (snap as unknown as Record<string, unknown>)?.['coords'] as Record<string, { x?: number; y?: number; w?: number; h?: number }> | undefined; // escape-ok: 快照 coords 是 PageDescription 可选字段，运行时可能缺失，属受控读取
      const FALLBACK: Record<string, [number, number, number, number]> = {
        top: [6, 14, 378, 76], inbox: [6, 86, 166, 269], starmap: [178, 86, 378, 228],
        sys: [6, 279, 104, 566], pulse: [178, 238, 378, 387], duty: [114, 397, 378, 510],
        stack: [178, 520, 378, 738], roles: [6, 576, 168, 738], perms: [6, 748, 378, 784],
      };
      const c = (k: string) => {
        const r = snapCoords?.[`hud.${k}`];
        if (r && r.x !== undefined && r.y !== undefined && r.w !== undefined && r.h !== undefined) {
          return { a: [Math.round(r.x), Math.round(r.y)], b: [Math.round(r.x + r.w), Math.round(r.y + r.h)] };
        }
        const [x1, y1, x2, y2] = FALLBACK[k];
        return { a: [x1, y1], b: [x2, y2] };
      };
      const cc = (k: string, obj: unknown) => { L.push(`## 中央页面 · ${k}`); L.push('```yaml'); L.push(dump(obj).trimEnd()); L.push('```\n'); };

      const balText = balance && 'total' in balance ? `¥${balance.total}` : '（不可用）';
      cc('顶框', { coords: c('top'), provider: 'deepseek', balance: balText, time: now.toLocaleTimeString('zh-CN', { hour12: false }), source: 'providers.json + ledger/sys-metrics.json' });
      const pendingN = inbox.filter(x => x.type === 'warn').length; // 待裁决 = warn 类型条数
      cc('信箱', { coords: c('inbox'), pending: pendingN, latest: inbox.find(x => x.type === 'warn')?.text || '（无待裁决）', source: 'docs/ledger/semantic-chain-inbox.md' });
      cc('星轨', { coords: c('starmap'), sessions: archive.sessions, total: `Σ${(archive.totalTokens / 1024 / 1024).toFixed(1)}M`, source: 'sessions/*.json' });
      cc('系统', { coords: c('sys'), disk: sys.metrics.find(x => x.label === '硬盘')?.value, mem: sys.metrics.find(x => x.label === '内存')?.value, load: sys.metrics.find(x => x.label === '负载')?.value, proc: sys.metrics.find(x => x.label === '进程')?.value, source: 'ledger/sys-metrics.json' });
      cc('脉搏', { coords: c('pulse'), llm: `${pulse.llm.calls}次 ${pulse.llm.okRate}%`, tools: `${pulse.tools.calls}次 失败${pulse.tools.fails}`, source: 'ledger/agent-calls.jsonl + ledger/tool-exec.jsonl' });
      const cronMap: Record<string, string> = {};
      for (const cr of sys.cron) cronMap[cr.name] = cr.status;
      cc('执勤', { coords: c('duty'), sync: cronMap['sync'] || '?', clean: cronMap['clean'] || '?', chain: cronMap['chain'] || '?', bench: cronMap['bench'] || '?', entry: cronMap['entry'] || '?', agg: cronMap['agg'] || '?', push: cronMap['push'] || '?', retain: cronMap['retain'] || '?', source: 'ledger/check-failures.jsonl' });
      cc('待办', { coords: c('stack'), todo: stack.counts.todo, done: stack.counts.done, items: stack.entries.filter(e => e.status === 'todo').slice(0, 3).map(e => `#${e.n} ${e.title}`), source: 'docs/active/stack.yaml' });
      cc('角色框', { coords: c('roles'), count: roles.totalRoles, files: roles.totalFiles, active: roles.activeRoleId, source: 'agents/roles/*.json + active.json' });
      cc('权限', { coords: c('perms'), allow: perms.allow, ask: perms.ask, deny: perms.deny, breach: `${perms.breakRate}%`, source: 'ledger/permission-audit.jsonl' });
    }

    // ===== 文件树（始终——手操作清单）=====
    L.push('## 文件树（全量——即使 UI 隐藏，手操作清单）');
    L.push('```yaml');
    const treeObj: Record<string, unknown> = { visible: tree.visible, items: [] };
    const items: unknown[] = [];
    items.push({ id: 1, depth: 0, state: 'expanded', path: tree.root });
    tree.expanded.slice(0, 6).forEach((p, i) => items.push({ id: i + 2, depth: 1, state: 'expanded', path: p }));
    if (items.length === 1) items.push({ id: 2, depth: 0, state: 'file', path: `${tree.root}/reasonix.toml`, cursor: true });
    treeObj.items = items;
    treeObj.viewport = { from: 1, to: items.length };
    treeObj.cursor = 1;
    treeObj.multi = 'none';
    treeObj.source = 'tree-model / state（文件树状态）';
    L.push(dump(treeObj).trimEnd());
    L.push('```\n');

    // ===== 光球面板（始终——含会话上下文 + 最近 3 条对话）=====
    const activeRaw = readActiveJson();
    const dialog = readRecentDialog(activeRaw.sessionId || '', 3);
    L.push('## 光球面板');
    L.push('```yaml');
    const panelObj: Record<string, unknown> = {
      orb: { state: orb.state, position: { x: 324, y: 677 } },
      panel: {
        state: orb.panel,
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
    const cardsObj: Record<string, unknown> = { visible: false, count: cards.count, focus: cards.focus };
    if (cards.count > 0) cardsObj.title = cards.title;
    cardsObj.source = '卡注册表 registry.ts + card-stack 聚焦序号';
    L.push(dump(cardsObj).trimEnd());
    L.push('```');

    writeFileSync(EYES_PATH, L.join('\n') + '\n', 'utf-8');
  } catch (e) {
    console.error('[eyes] 生成失败:', e instanceof Error ? e.message : e);
    try { writeFileSync(EYES_PATH, `# 当前页面状态（快照）\n\n> 暂无页面快照（浏览器未连接或生成失败）。\n`, 'utf-8'); } catch { /* 写占位失败不致命 */ }
  }
}
