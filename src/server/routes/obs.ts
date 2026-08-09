/**
 * routes/obs.ts — 观测台数据端点（8.5 史官制度 · HUD，2026-08-05 立项）
 *
 * /api/obs/hud：聚合 HUD 面板数据。骨架版：deepseek 官方余额（实时拉取）+ 服务器时间；
 * 其余数据面（调用统计/运行任务/信箱/cron/系统状态等）按设计分框预留，后续逐栏填充。
 *
 * 余额数据源：GET https://api.deepseek.com/user/balance（官方开放平台唯一账户接口，
 * 返回 is_available + balance_infos[]：total/granted/topped_up 分解）。
 * 「实时更新」= 每次请求直接拉官方（不缓存）——余额接口免费且轻量，30s 级轮询无压力。
 *
 * /test 校准页 + /api/obs/viewport 回传（2026-08-06，守视基建）：手机浏览器开
 * /kfmv4/test（经 nginx /kfmv4/ 整段代理直达，无需新增映射规则）→ 页面自动量
 * innerWidth/innerHeight/devicePixelRatio POST 回 /api/obs/viewport → 存
 * ~/.kfmv4/browser-relay/viewport.json，scripts/agent/browser-relay.mjs 下次开
 * 标签即按真机视口渲染。挂 8021 常驻服务而非 daemon 自身：daemon 闲置会退，
 * 校准页须随时可开。
 */
import type { Router } from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execSync } from 'child_process';
import { load as yamlLoad } from 'js-yaml';
import { resolveKey } from '../env-store.js';
import { KFM_DATA_DIR, PROJECT_ROOT } from '../path-utils.js';

const DEEPSEEK_BALANCE_URL = 'https://api.deepseek.com/user/balance';
// 余额缓存：deepseek /user/balance 接口免费轻量（无 chat 接口的并发压力），
// 5s 一次外部请求 = 17280 次/天，强度很低（2026-08-06 用户定稿 5s 轮询）。
const BALANCE_CACHE_MS = 5_000;

interface BalanceOk {
  total: string;
  granted: string;
  toppedUp: string;
  isAvailable: boolean;
  fetchedAt: string;
}
interface BalanceErr {
  error: string;
}
type Balance = BalanceOk | BalanceErr;

let balanceCache: { data: Balance; ts: number } | null = null;

async function fetchDeepseekBalance(): Promise<Balance> {
  if (balanceCache && Date.now() - balanceCache.ts < BALANCE_CACHE_MS) {
    return balanceCache.data;
  }
  try {
    const provs = JSON.parse(fs.readFileSync(path.join(KFM_DATA_DIR, 'providers.json'), 'utf-8'));
    const ds = (provs as Array<{ id: string; apiKey: string }>).find(p => p.id === 'deepseek');
    if (!ds) return { error: 'providers.json 无 deepseek 条目' };
    const key = resolveKey(ds.apiKey);
    if (!key.value) return { error: `deepseek apiKey 未解析（缺 ${key.missingVar || '值'}）` };
    const res = await fetch(DEEPSEEK_BALANCE_URL, {
      headers: { Authorization: `Bearer ${key.value}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { error: `balance HTTP ${res.status}` };
    const j = await res.json() as { is_available?: boolean; balance_infos?: Array<Record<string, unknown>> };
    const info = j.balance_infos?.[0] ?? {};
    const data: Balance = {
      total: String(info.total_balance ?? '?'),
      granted: String(info.granted_balance ?? '0'),
      toppedUp: String(info.topped_up_balance ?? '0'),
      isAvailable: !!j.is_available,
      fetchedAt: new Date().toISOString(),
    };
    balanceCache = { data, ts: Date.now() };
    return data;
  } catch (e) {
    return { error: e instanceof Error ? e.message.slice(0, 80) : String(e) };
  }
}

export function setupObsRoutes(router: Router): void {
  router.get('/obs/hud', async (_req, res) => {
    const balance = await fetchDeepseekBalance();
    res.json({ balance, inbox: parseInbox(), stack: parseStack(), sys: collectSys(), archive: collectArchive(), pulse: collectPulse(), patrol: collectPatrol(), tokens: collectTokens(), perms: collectPerms(), roles: collectRoles(), serverTime: new Date().toISOString() });
  });

  // 守视视口校准回传：/test 页 POST 真机实测视口 → 存 viewport.json（browser-relay 读）
  router.post('/obs/viewport', (req, res) => {
    const b = req.body || {};
    const w = Math.round(Number(b.width)), h = Math.round(Number(b.height)), d = Number(b.deviceScaleFactor) || 2;
    if (!(w >= 100 && w <= 2000 && h >= 100 && h <= 4000 && d > 0 && d <= 5)) {
      res.status(400).json({ ok: false, error: '视口数值不合理' });
      return;
    }
    const viewport = { width: w, height: h, deviceScaleFactor: d, userAgent: String(b.userAgent || ''), updatedAt: new Date().toISOString() };
    const dir = path.join(KFM_DATA_DIR, 'browser-relay');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'viewport.json'), JSON.stringify(viewport, null, 2));
    res.json({ ok: true, viewport });
  });
}

// 校准页挂在 app 上（非 /api 路由）：GET /test 与 /kfmv4/test 均可达——
// 后者经 nginx /kfmv4/ 代理供手机外网访问。页面用相对路径 POST api/obs/viewport，
// 两种前缀下都解析到已挂载的 /obs/viewport 端点。
const CALIBRATE_HTML = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>守视校准</title><body style="font:16px/2 monospace;background:#111;color:#eee;padding:24px">
<h3>守视 · 视口校准</h3><div id="m">测量中…</div>
<script>
const v = { width: window.innerWidth, height: window.innerHeight, deviceScaleFactor: window.devicePixelRatio, userAgent: navigator.userAgent };
fetch('api/obs/viewport', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(v) }).then(r => r.json()).then(r => {
  document.getElementById('m').textContent = r.ok
    ? '已记录：' + r.viewport.width + '×' + r.viewport.height + ' @' + r.viewport.deviceScaleFactor + 'x（守视新开标签页生效）'
    : '记录失败：' + r.error;
});
</script>`;

export function setupObsPages(app: { get: (p: string, h: (_req: unknown, res: { type: (t: string) => { send: (s: string) => void } }) => void) => void }): void {
  const handler = (_req: unknown, res: { type: (t: string) => { send: (s: string) => void } }) => res.type('html').send(CALIBRATE_HTML);
  app.get('/test', handler);
  app.get('/kfmv4/test', handler);
}

// ========== 信箱解析（semantic-chain-inbox.md，ledger 层账本·只追加） ==========
// 每行：`- YYYY-MM-DD [HH:MM] <标记> <内容>`——标记家族：⚠️ 待裁决 / ✅ 干净 /
// 💀 崩溃 / 📊 观测统计 / 其他中性。单一出处：现场读文件，不缓存副本（语义生成原则）。
// 最新在前（按 date+time 排序，非文件行序）。

interface InboxEntry {
  date: string;
  time: string;
  type: 'warn' | 'ok' | 'dead' | 'stat' | 'other';
  text: string;
}

const INBOX_PATH = path.join(PROJECT_ROOT, 'docs', 'ledger', 'semantic-chain-inbox.md');
const INBOX_LINE_RE = /^-?\s*(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})?\s*(⚠️|✅|💀|📊)?\s*(.*)$/;

function inboxTypeOf(mark: string | undefined): InboxEntry['type'] {
  switch (mark) {
    case '⚠️': return 'warn';
    case '✅': return 'ok';
    case '💀': return 'dead';
    case '📊': return 'stat';
    default: return 'other';
  }
}

function parseInbox(): InboxEntry[] {
  try {
    const text = fs.readFileSync(INBOX_PATH, 'utf-8');
    const entries: InboxEntry[] = [];
    for (const line of text.split('\n')) {
      if (line.trim().startsWith('#')) continue; // 头部注释
      const m = line.match(INBOX_LINE_RE);
      if (!m) continue;
      const [, date, time = '', mark, body] = m;
      entries.push({ date, time, type: inboxTypeOf(mark), text: body.trim() });
    }
    // 按时间倒序（最新在前）——不能靠文件物理行序：多臂并行追加，写入顺序≠时间顺序
    // （2026-08-07 实测：体检臂后写的 08-06 条目压过巡逻臂的 08-07，首条高亮错位）
    return entries.sort((a, b) => `${b.date} ${b.time || '00:00'}`.localeCompare(`${a.date} ${a.time || '00:00'}`));
  } catch {
    return [];
  }
}

// ========== 待办解析（stack.yaml 工作栈，2026-08-06 用户拍板：废 STACK.md，yaml 单一出处） ==========
// 状态从散文标记升级为字段（check-stack-status R0 机械把关 schema）——「无标记黑户」
// 从构造上不存在。面板渲染全状态：todo/hold 全亮在前，done 渐淡殿后（用户问过
// 「19 条为什么只显示 3 条」——藏起 done 是旧设计的诚实性缺陷）。
// 单一出处：现场读文件，不缓存副本。

interface StackEntry {
  n: number;
  status: 'done' | 'todo' | 'hold';
  title: string;
  created: string;
  note: string;
  detail: string;
}

const STACK_PATH = path.join(PROJECT_ROOT, 'docs', 'active', 'stack.yaml');

function parseStack(): { entries: StackEntry[]; counts: { todo: number; hold: number; done: number } } {
  const counts = { todo: 0, hold: 0, done: 0 };
  try {
    const doc = yamlLoad(fs.readFileSync(STACK_PATH, 'utf-8')) as { entries?: Array<Record<string, unknown>> };
    const all = Array.isArray(doc?.entries) ? doc.entries : [];
    const entries: StackEntry[] = [];
    for (const e of all) {
      const status = String(e.status) as StackEntry['status'];
      if (status !== 'done' && status !== 'todo' && status !== 'hold') continue;
      counts[status]++;
      entries.push({
        n: Number(e.id),
        status,
        title: String(e.title ?? ''),
        created: String(e.created ?? ''),
        note: String(e.note ?? ''),
        detail: [String(e.title ?? ''), typeof e.detail === 'string' ? e.detail : ''].filter(Boolean).join('\n'),
      });
    }
    // todo/hold 在前（活跃优先），done 殿后；各组内按 id 序
    entries.sort((a, b) => (a.status === 'done' ? 1 : 0) - (b.status === 'done' ? 1 : 0) || a.n - b.n);
    return { entries, counts };
  } catch {
    return { entries: [], counts };
  }
}

// ========== SYS 监控面板采集（2026-08-06 用户定稿 v3：信箱下方的完整监控面板） ==========
// 三段：系统四指标（硬盘/内存/负载/进程 RSS，带 5s 采样历史柱状图）+ 监听端口两列
// （端口号 | 进程名，ss -tlnp 现场解析）+ cron 清单（crontab 现场解析 → 逐脚本
// 成败标记表末位对比判状态，见 CRON_MARKERS）。
// 历史：独立 setInterval 5s 采样（不靠请求驱动——没人看面板时历史也在积累；
// 2026-08-07 从 30s 加密到 5s：客户端柱状图缓动速度=柱宽/采样间隔，30s 慢到肉眼
// 不可见，5s 才能看到持续流动），环形 40 点（≈3 分钟窗），落 ~/.kfmv4/ledger/sys-metrics.json
// 抗重启（重启后柱状图不清零）。
// 缓存：端口 30s（execSync 贵），cron 5min（crontab 极少变）。

interface SysMetric { label: string; value: string; pair: string; pct: number | null }
interface SysPort { port: number; name: string; scope: 'public' | 'local'; conns: number }
interface SysCron { name: string; status: 'ok' | 'fail' | 'unknown'; ago: string }
interface SysHistory { disk: number[]; mem: number[]; load: number[]; rss: number[] }
interface SysData { metrics: SysMetric[]; history: SysHistory; ports: SysPort[]; cron: SysCron[]; seq: number }

const PORTS_CACHE_MS = 30_000;
const CRON_CACHE_MS = 300_000;
const HISTORY_MAX = 40; // 40 × 5s ≈ 3 分钟窗（覆盖客户端 24 根 ≈ 2 分钟显示窗）
const HISTORY_PATH = path.join(KFM_DATA_DIR, 'ledger', 'sys-metrics.json');
let portsCache: { data: SysPort[]; ts: number } | null = null;
let cronCache: { data: SysCron[]; ts: number } | null = null;
let history: Array<{ ts: number; disk: number; mem: number; load: number; rss: number }> = [];
let sampleSeq = 0; // 采样拍序号（每次 tick +1）——客户端按「seq 变了 = 新拍」做时钟驱动滑动，
// 不依赖值变化（稳态下负载/内存值几分钟不变，值驱动会彻底静止，2026-08-07 用户实测）
let samplerStarted = false;

// 原始指标读取（statfs/meminfo/loadavg/RSS——都是便宜本地读，采样器与请求路径共用）
// raw 同时携带实值（used/total），供面板百分号后的 xx/xx 对
interface RawMetrics {
  disk: number; mem: number; load: number; rss: number;
  diskUsedG: number; diskTotalG: number;
  memUsedG: number; memTotalG: number;
  loadRaw: number; cores: number;
  rssLimitMB: number; // 进程 RSS 天花板（cgroup memory.high；0 = 无限制，退回整机内存参照）
}

// 进程自身 cgroup 内存软限（MemoryHigh）——kfmv4 经 systemd 跑在独立 cgroup。
// 注意主机上 /sys/fs/cgroup 是整棵树，根下的 memory.high 是根 cgroup 的（max），
// 必须按 /proc/self/cgroup 的相对路径拼（2026-08-07 第一版直读根路径踩坑实测）。
// 柱高按限额归一后，100% 参考线 = 刹车墙距离（用户指正：进程项参照 3.4G 整机失真）。
function readRssLimitMB(): number {
  try { // cgroup v2：/proc/self/cgroup 形如 0::/system.slice/kfmv4.service
    const rel = fs.readFileSync('/proc/self/cgroup', 'utf-8').match(/^0::(.+)$/m)?.[1]?.trim();
    if (rel) {
      for (const f of ['memory.high', 'memory.max']) {
        try {
          const v = fs.readFileSync(`/sys/fs/cgroup${rel}/${f}`, 'utf-8').trim();
          if (v !== 'max') { const n = Number(v); if (n > 0 && n < 1e15) return Math.round(n / 1048576); }
        } catch { /* 下一候选 */ }
      }
    }
  } catch { /* 非 v2 */ }
  try { // cgroup v1：找 memory 子系统行
    const rel = fs.readFileSync('/proc/self/cgroup', 'utf-8').split('\n').find(l => l.includes(':memory:'))?.split(':')[2]?.trim();
    if (rel) {
      const n = Number(fs.readFileSync(`/sys/fs/cgroup/memory${rel}/memory.limit_in_bytes`, 'utf-8').trim());
      if (n > 0 && n < 1e15) return Math.round(n / 1048576);
    }
  } catch { /* 无限制 */ }
  return 0;
}
function readMetricsRaw(): RawMetrics {
  let disk = 0, diskUsedG = 0, diskTotalG = 0;
  try {
    const s = fs.statfsSync('/');
    const bsize = Number(s.bsize), blocks = Number(s.blocks), bavail = Number(s.bavail);
    disk = Math.round((1 - bavail / blocks) * 100);
    diskTotalG = Math.round(blocks * bsize / 1073741824);
    diskUsedG = Math.round((blocks - bavail) * bsize / 1073741824);
  } catch { /* 保留 0 */ }
  let mem = 0, memUsedG = 0, memTotalG = 0;
  try {
    const mi = fs.readFileSync('/proc/meminfo', 'utf-8');
    const total = Number(mi.match(/MemTotal:\s+(\d+)/)?.[1]);
    const avail = Number(mi.match(/MemAvailable:\s+(\d+)/)?.[1]);
    if (total > 0 && avail >= 0) {
      mem = Math.round((1 - avail / total) * 100);
      memTotalG = Math.round(total / 104857.6) / 10;
      memUsedG = Math.round((total - avail) / 104857.6) / 10;
    }
  } catch { /* 保留 0 */ }
  const cores = Math.max(1, os.cpus().length);
  const loadRaw = os.loadavg()[0];
  const load = Math.round((loadRaw / cores) * 100);
  const rss = Math.round(process.memoryUsage().rss / 1e6);
  return { disk, mem, load, rss, diskUsedG, diskTotalG, memUsedG, memTotalG, loadRaw, cores, rssLimitMB: readRssLimitMB() };
}

// 5s 采样器：环形缓冲 + 每次落盘（文件极小，重启后续上）
function startSysSampler(): void {
  if (samplerStarted) return;
  samplerStarted = true;
  try {
    const j = JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf-8')) as typeof history;
    if (Array.isArray(j)) history = j.slice(-HISTORY_MAX);
  } catch { /* 无历史文件 → 从零积累 */ }
  const tick = () => {
    sampleSeq++;
    history.push({ ts: Date.now(), ...readMetricsRaw() });
    if (history.length > HISTORY_MAX) history.shift();
    try { fs.writeFileSync(HISTORY_PATH, JSON.stringify(history)); } catch { /* 落盘失败不致命 */ }
  };
  tick();
  setInterval(tick, 5_000).unref();
}

// 监听端口两列（ss -tlnp 现场解析；ipv4/ipv6 同端口去重；名从进程名 + 友好别名）
const PORT_FRIENDLY: Record<number, string> = {
  8021: 'kfmv4', 9229: 'kfm·dbg', 8033: 'relay·守视', 80: 'nginx', 22: 'sshd', 53: 'dns', 34267: 'aliyun',
};
function collectPorts(): SysPort[] {
  const now = Date.now();
  if (portsCache && now - portsCache.ts < PORTS_CACHE_MS) return portsCache.data;
  let out: SysPort[] = [];
  try {
    const ss = execSync('ss -tlnpH', { encoding: 'utf-8', timeout: 5000 });
    const seen = new Map<number, SysPort>();
    for (const line of ss.split('\n')) {
      const m = line.match(/\s([\d.*%[\]\w]+):(\d+)\s+[\w.:*%[\]]+\s+users:\(\("([^"]+)"/);
      if (!m) continue;
      const port = Number(m[2]);
      if (seen.has(port)) continue;
      seen.set(port, {
        port,
        name: PORT_FRIENDLY[port] ?? m[3],
        scope: m[1] === '0.0.0.0' || m[1] === '[::]' || m[1] === '*' ? 'public' : 'local',
        conns: 0,
      });
    }
    // 各端口活跃连接数（established 按本地端口计数——面板的「谁在被真实使用」维度）
    try {
      const est = execSync('ss -tnH state established', { encoding: 'utf-8', timeout: 5000 });
      for (const line of est.split('\n')) {
        const m = line.match(/\s[\d.*%[\]\w]+:(\d+)\s+[\w.:*%[\]]+\s/);
        if (!m) continue;
        const p = seen.get(Number(m[1]));
        if (p) p.conns++;
      }
    } catch { /* 连接数取不到 → 全 0 */ }
    out = [...seen.values()].sort((a, b) => a.port - b.port);
  } catch { /* ss 不可用 → 空列表 */ }
  portsCache = { data: out, ts: now };
  return out;
}

// auto-push.sh 无 >> 重定向但脚本内部自记日志——crontab 解析的特例补丁表
const CRON_INTERNAL_LOG: Record<string, string> = {
  'auto-push.sh': '/var/log/kfmv4-autopush.log',
};

// 状态判据：逐脚本成败标记表 + 末位对比（尾 8KB 内最后一个 err 匹配晚于最后一个
// ok 匹配 → fail）。为什么不用通用关键字：entry 的 4KB 窗会吞进上一轮 FAIL（本轮
// 其实 PASS）；obs-agg 的报告正文自带「失败 288」统计字样；sync 的成功输出就是
// git 噪音无 ok 标记——通用正则三种都判错（2026-08-06 实测）。表外新条目走
// DEFAULT 通用回退。诚实边界：脚本崩溃无输出 → unknown（ago 变老是旁证）。
interface CronMarker { ok?: RegExp; err?: RegExp }
const CRON_MARKERS: Record<string, CronMarker> = {
  'sync':  { err: /fatal|failed to push|error: failed/i }, // 成功输出=git 噪音，无 ok 标记
  'clean': {},                                             // 静默脚本
  'chain': { ok: /信箱 ←/, err: /💀|Traceback|Command failed/ },
  'bench': { ok: /信箱 ←/, err: /💀|Traceback|Command failed/ },
  'entry': { ok: /✅ PASS/, err: /❌ FAIL/ },
  'agg':   { err: /Traceback|Command failed|💀/ }, // 报告正文含「失败 N」统计字样，不算错
  'push':  { ok: /部署成功/, err: /部署失败/ },
  'retain':{ err: /Traceback|Error|失败/ },
};
// 显示名别名（竖条 48px 内容宽放不下长名——chain-bench/obs-agg/auto-push 实测换行难看）
const CRON_NAME_ALIAS: Record<string, string> = { 'chain-bench': 'bench', 'obs-agg': 'agg', 'auto-push': 'push' };
const CRON_MARKER_DEFAULT: CronMarker = { err: /fatal|error|failed|失败|Traceback|❌|✗/i };

function lastIndexOf(re: RegExp | undefined, text: string): number {
  if (!re) return -1;
  const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
  let last = -1, m: RegExpExecArray | null;
  while ((m = g.exec(text)) !== null) { last = m.index; if (m[0] === '') break; }
  return last;
}

function fmtAgo(mtimeMs: number): string {
  const h = (Date.now() - mtimeMs) / 3_600_000;
  if (h < 1) return `${Math.max(1, Math.round(h * 60))}m`;
  if (h < 24) return `${Math.round(h)}h`;
  const d = h / 24;
  if (d < 7) return `${Math.round(d)}d`;
  return `${Math.round(d / 7)}w`;
}

function collectCron(): SysCron[] {
  const now = Date.now();
  if (cronCache && now - cronCache.ts < CRON_CACHE_MS) return cronCache.data;
  let out: SysCron[] = [];
  try {
    const tab = execSync('crontab -l', { encoding: 'utf-8', timeout: 5000 });
    for (const line of tab.split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      // 名字 = 行内第一个脚本 basename 去扩展名缩写（先去前导点：/root/.kfmv4-sync.sh）
      const sm = t.match(/([\w.-]+\.(?:sh|mjs|cjs|js))/);
      if (!sm) continue;
      const name = sm[1].replace(/\.(sh|mjs|cjs|js)$/, '').replace(/^\./, '')
        .replace(/^kfmv4-/, '').replace(/^semantic-/, '').replace(/^routine-entry-validation/, 'entry')
        .replace(/^session-retention/, 'retain').replace(/^obs-aggregate/, 'obs-agg')
        .replace(/^clean-npm-temp/, 'clean');
      // 同一脚本多行（chain 每日 + --with-bench 周一）：带参数的给后缀区分
      const suffix = t.includes('--with-bench') ? '-bench' : '';
      const logM = t.match(/>>\s*(\/var\/log\/[\w.-]+)/);
      const logPath = logM?.[1] ?? CRON_INTERNAL_LOG[sm[1]];
      let status: SysCron['status'] = 'unknown';
      let ago = '—';
      if (logPath) {
        try {
          const st = fs.statSync(logPath);
          ago = fmtAgo(st.mtimeMs);
          if (st.size > 0) {
            const fd = fs.openSync(logPath, 'r');
            const buf = Buffer.alloc(Math.min(8192, st.size));
            fs.readSync(fd, buf, 0, buf.length, Math.max(0, st.size - buf.length));
            fs.closeSync(fd);
            const tail = buf.toString('utf-8');
            const mk = CRON_MARKERS[CRON_NAME_ALIAS[name + suffix] ?? name + suffix] ?? CRON_MARKER_DEFAULT;
            status = lastIndexOf(mk.err, tail) > lastIndexOf(mk.ok, tail) ? 'fail' : 'ok';
          }
        } catch { /* 日志还没产生 → unknown */ }
      }
      const full = CRON_NAME_ALIAS[name + suffix] ?? name + suffix;
      if (!out.some(c => c.name === full)) out.push({ name: full, status, ago });
    }
  } catch { /* crontab 不可用 → 空列表 */ }
  cronCache = { data: out, ts: now };
  return out;
}

function collectSys(): SysData {
  startSysSampler();
  const r = readMetricsRaw();
  const historyOf = (k: 'disk' | 'mem' | 'load' | 'rss') => history.map(s => s[k]);
  // rss 历史下发前转成占限额百分比（有限额时）——柱状图判色/柱高按「样本值=百分比」口径，
  // MB 原值 115>85 会误判红且柱高顶满（2026-08-07 用户实测全红）；无限制环境保持 MB + pct null 旧行为
  const rssHist = historyOf('rss');
  return {
    metrics: [
      { label: '硬盘', value: `${r.disk}%`, pair: `${r.diskUsedG}/${r.diskTotalG}G`, pct: r.disk },
      { label: '内存', value: `${r.mem}%`, pair: `${r.memUsedG}/${r.memTotalG}G`, pct: r.mem },
      { label: '负载', value: `${r.load}%`, pair: `${r.loadRaw.toFixed(2)}/${r.cores}`, pct: r.load },
      { label: '进程', value: `${r.rss}M`, pair: r.rssLimitMB > 0 ? `/${(r.rssLimitMB / 1024).toFixed(1)}G` : `/${r.memTotalG}G`, pct: r.rssLimitMB > 0 ? Math.round((r.rss / r.rssLimitMB) * 100) : null },
    ],
    history: { disk: historyOf('disk'), mem: historyOf('mem'), load: historyOf('load'), rss: r.rssLimitMB > 0 ? rssHist.map(v => Math.round((v / r.rssLimitMB) * 100)) : rssHist },
    ports: collectPorts(),
    cron: collectCron(),
    seq: sampleSeq,
  };
}

// ========== 档案馆 · 会话星轨（2026-08-07 用户定稿：中央面板新增科幻线条框） ==========
// 数据源：~/.kfmv4/sessions/*.json 顶层字段（title/createdAt/updatedAt/messageCount/
// tokenCount）。 sessions/script/ 是脚本会话分流目录，不读。
// 清洗：messageCount≤2 且无 tokenCount 的是测试残留（s1/s2/s3/s-basic… 2026-08-06
// 20:48 同刻产物），过滤。缺 count 字段的旧会话（蔚然的一次整理）以 messages.length
// 兜底 messageCount、tokenCount 记 0。
// 收束：按 tokenCount 降序取 TOP 5，其余聚合为一条「其他 ×N」虚线轨（跨度=min~max）。
// 6 行钉死星轨高度（2026-08-09 用户定稿）；routine-validate-* 机器验证会话过滤不上轨。
// 30s 缓存——会话文件低频变化，现场 parse 全部顶层文件（当前约 4MB）每 30s 一次可接受。

interface ArchiveTrack {
  title: string;
  tokens: number;
  msgs: number;
  t0: string;          // createdAt
  t1: string;          // updatedAt（缺省回落 createdAt）
  active: boolean;     // 48h 内有更新 → 末端呼吸光点
  aggregate?: number;  // 聚合轨：被合并的会话数
}
interface ArchiveData { sessions: number; totalTokens: number; tracks: ArchiveTrack[] }

const SESSIONS_DIR = path.join(KFM_DATA_DIR, 'sessions');
const ARCHIVE_CACHE_MS = 30_000;
const ARCHIVE_TOP_N = 5; // TOP5+聚合轨=6 行钉死星轨高度（2026-08-09 用户定稿：取消随轨道数自动长高，当前状态即最大高度）
const ACTIVE_WINDOW_MS = 48 * 3_600_000;
let archiveCache: { data: ArchiveData; ts: number } | null = null;

function collectArchive(): ArchiveData {
  const now = Date.now();
  if (archiveCache && now - archiveCache.ts < ARCHIVE_CACHE_MS) return archiveCache.data;
  const empty: ArchiveData = { sessions: 0, totalTokens: 0, tracks: [] };
  let out = empty;
  try {
    const files = fs.readdirSync(SESSIONS_DIR).filter(f => f.endsWith('.json'));
    const tracks: ArchiveTrack[] = [];
    for (const f of files) {
      try {
        const j = JSON.parse(fs.readFileSync(path.join(SESSIONS_DIR, f), 'utf-8')) as Record<string, unknown>;
        const title = String(j.title || f.replace(/\.json$/, ''));
        // 机器验证会话（研究臂 routine-entry-validation 产物）不上轨——自动化
        // 例行运行会无限累积，把真实会话挤出 TOP（2026-08-09 用户实拍：星轨
        // 一夜多出三条 routine-validate-*，面板自动长高）
        if (title.startsWith('routine-validate-')) continue;
        const msgs = Number(j.messageCount) || (Array.isArray(j.messages) ? j.messages.length : 0);
        const tokens = Number(j.tokenCount) || 0;
        if (msgs <= 2) continue; // 测试残留（s1/s2/s3/s-basic… 同刻产物，msgs≤2；sess-ok 有 7 token 也是残留）
        const t0 = String(j.createdAt || '');
        if (!t0) continue;
        const t1 = String(j.updatedAt || t0);
        tracks.push({
          title,
          tokens, msgs, t0, t1,
          active: now - new Date(t1).getTime() < ACTIVE_WINDOW_MS,
        });
      } catch { /* 单个坏文件不拖垮整轨 */ }
    }
    tracks.push(...collectKimiTracks(now));
    const totalTokens = tracks.reduce((s, t) => s + t.tokens, 0);
    tracks.sort((a, b) => b.tokens - a.tokens);
    const top = tracks.slice(0, ARCHIVE_TOP_N);
    const rest = tracks.slice(ARCHIVE_TOP_N);
    if (rest.length > 0) {
      top.push({
        title: '其他',
        tokens: rest.reduce((s, t) => s + t.tokens, 0),
        msgs: rest.reduce((s, t) => s + t.msgs, 0),
        t0: rest.map(t => t.t0).sort()[0],
        t1: rest.map(t => t.t1).sort().at(-1)!,
        active: rest.some(t => t.active),
        aggregate: rest.length,
      });
    }
    out = { sessions: tracks.length, totalTokens, tracks: top };
  } catch { /* sessions 目录不存在 → 空 */ }
  archiveCache = { data: out, ts: now };
  return out;
}

// ========== kimi-code 长会话并入星轨（2026-08-08 用户指令：两条长 session 上轨） ==========
// 入选规则：~/.kimi-code/sessions/*//session_*\/agents/main/wire.jsonl ≥ 1MB——
// 当前恰好 = 研究臂 84M + 主线 14M 两条；短会话（40~440K）不入选，规则自然泛化。
// token 口径 = 新处理 token（inputOther + inputCacheCreation + output），**不含
// inputCacheRead**——cacheRead 每轮重读全量上下文，研究臂含它 4.77G、不含 49.8M，
// 计入会把 kfm 轨道（190K 级）在 sqrt 刻度上压成不可见（2026-08-08 实测两口径）。
// msgs 口径 = LLM 调用次数（usage 记录数），非消息条数，tooltip 自行注意。
// 增量扫描：按 offset 只读新增尾部（kimi 会话是活的，主线臂每轮都在追加）；
// 文件截断（轮转）则归零重扫。进程重启后首次全量扫 84M 约 1s，可接受。

const KIMI_SESSIONS_ROOT = path.join(os.homedir(), '.kimi-code', 'sessions');
const KIMI_WIRE_MIN_BYTES = 1_000_000;

interface KimiWireState { offset: number; tokens: number; calls: number }
const kimiWireState = new Map<string, KimiWireState>();

function scanKimiWire(file: string, size: number): KimiWireState {
  const st = kimiWireState.get(file) ?? { offset: 0, tokens: 0, calls: 0 };
  if (size < st.offset) { st.offset = 0; st.tokens = 0; st.calls = 0; } // 轮转截断 → 重扫
  if (size > st.offset) {
    const fd = fs.openSync(file, 'r');
    const len = size - st.offset;
    const buf = Buffer.alloc(len);
    fs.readSync(fd, buf, 0, len, st.offset);
    fs.closeSync(fd);
    let lastNl = -1; // 只处理完整行，半截行留下一轮（文件只追加）
    for (let i = buf.length - 1; i >= 0; i--) if (buf[i] === 10) { lastNl = i; break; }
    if (lastNl >= 0) {
      const text = buf.subarray(0, lastNl).toString('utf-8');
      for (const m of text.matchAll(/"usage":\{[^}]*\}/g)) {
        const u = m[0];
        const num = (k: string) => Number(u.match(new RegExp(`"${k}":(\\d+)`))?.[1] ?? 0);
        st.tokens += num('inputOther') + num('inputCacheCreation') + num('output');
        st.calls++;
      }
      st.offset += lastNl + 1;
    }
  }
  kimiWireState.set(file, st);
  return st;
}

function collectKimiTracks(now: number): ArchiveTrack[] {
  const out: ArchiveTrack[] = [];
  let wds: string[] = [];
  try { wds = fs.readdirSync(KIMI_SESSIONS_ROOT).map(d => path.join(KIMI_SESSIONS_ROOT, d)); } catch { return out; }
  for (const wd of wds) {
    let sessDirs: string[] = [];
    try { sessDirs = fs.readdirSync(wd).filter(d => d.startsWith('session_')); } catch { continue; }
    for (const sd of sessDirs) {
      const wire = path.join(wd, sd, 'agents', 'main', 'wire.jsonl');
      try {
        const fst = fs.statSync(wire);
        if (fst.size < KIMI_WIRE_MIN_BYTES) continue;
        const w = scanKimiWire(wire, fst.size);
        let title = sd.slice(8, 16);
        let t0 = new Date(fst.birthtimeMs > 0 ? fst.birthtimeMs : fst.mtimeMs).toISOString();
        let t1 = new Date(fst.mtimeMs).toISOString();
        try {
          const sj = JSON.parse(fs.readFileSync(path.join(wd, sd, 'state.json'), 'utf-8')) as Record<string, unknown>;
          if (sj.title) title = String(sj.title).slice(0, 14);
          if (sj.createdAt) t0 = String(sj.createdAt);
          if (sj.updatedAt && new Date(String(sj.updatedAt)).getTime() > new Date(t1).getTime()) t1 = String(sj.updatedAt);
        } catch { /* state.json 缺失/损坏 → 用 wire 时间戳 */ }
        out.push({
          title: `kimi·${title}`,
          tokens: w.tokens,
          msgs: w.calls,
          t0, t1,
          active: now - new Date(t1).getTime() < ACTIVE_WINDOW_MS,
        });
      } catch { /* 无 wire 或读取失败 → 跳过 */ }
    }
  }
  return out;
}

// ========== 脉搏数据面（2026-08-08 用户定稿：填屏第二批——史官数据流上屏） ==========
// 立项初心闭环：8.5 史官制度「每条数据流落盘」→ 观测台「放到一起显示」。
// 四条 jsonl 滚动 24h 窗口聚合，**尾部限扫**（append-only，24h 量远小于尾部窗口；
// ledger/agent-calls/tool-exec 各 200KB，check-failures/build-metrics 各 100KB）+ 60s 缓存。
// ledger/permission-audit 暂缓：87% allow / 13% ask 分布单一（2026-08-08 实测 2000 条），
// 等权限引擎 8.5.1 审批通道上线再连同 ask 流一起做。

interface PulseLlm { calls: number; okRate: number; avgMs: number; byProvider: Record<string, number>; lastAgo: string }
interface PulseTools { calls: number; fails: number; top: Array<{ name: string; n: number }> }
interface PulseChecks { fails: number; top: Array<{ name: string; n: number }> }
interface PulseBuild { lastMs: number; lastOk: boolean; builds: number }
interface PulseData { llm: PulseLlm; tools: PulseTools; checks: PulseChecks; build: PulseBuild }

const PULSE_CACHE_MS = 60_000;
const PULSE_WINDOW_MS = 24 * 3_600_000;
let pulseCache: { data: PulseData; ts: number } | null = null;

// jsonl 尾部窗口解析（首行可能是半截，丢弃）
function readJsonlTail(file: string, maxBytes: number): Array<Record<string, unknown>> {
  try {
    const st = fs.statSync(file);
    const start = Math.max(0, st.size - maxBytes);
    const fd = fs.openSync(file, 'r');
    const buf = Buffer.alloc(st.size - start);
    fs.readSync(fd, buf, 0, buf.length, start);
    fs.closeSync(fd);
    let text = buf.toString('utf-8');
    if (start > 0) { const nl = text.indexOf('\n'); text = nl >= 0 ? text.slice(nl + 1) : ''; }
    const out: Array<Record<string, unknown>> = [];
    for (const line of text.split('\n')) {
      if (!line) continue;
      try { out.push(JSON.parse(line)); } catch { /* 半截尾行 */ }
    }
    return out;
  } catch { return []; }
}

const inWindow = (ts: unknown, cutoff: number) => typeof ts === 'string' && new Date(ts).getTime() >= cutoff;

function collectPulse(): PulseData {
  const now = Date.now();
  if (pulseCache && now - pulseCache.ts < PULSE_CACHE_MS) return pulseCache.data;
  const cutoff = now - PULSE_WINDOW_MS;

  const llmRows = readJsonlTail(path.join(KFM_DATA_DIR, 'ledger', 'agent-calls.jsonl'), 200_000).filter(r => inWindow(r.ts, cutoff));
  const llmOk = llmRows.filter(r => r.ok === true);
  const byProvider: Record<string, number> = {};
  for (const r of llmRows) {
    const p = String(r.provider ?? '?').split('/')[0];
    byProvider[p] = (byProvider[p] ?? 0) + 1;
  }
  const lastTs = llmRows.length ? Math.max(...llmRows.map(r => new Date(String(r.ts)).getTime())) : 0;
  const llm: PulseLlm = {
    calls: llmRows.length,
    okRate: llmRows.length ? Math.round((llmOk.length / llmRows.length) * 100) : 100,
    avgMs: llmRows.length ? Math.round(llmRows.reduce((s, r) => s + Number(r.ms ?? 0), 0) / llmRows.length) : 0,
    byProvider,
    lastAgo: lastTs ? fmtAgo(lastTs) : '—',
  };

  const toolRows = readJsonlTail(path.join(KFM_DATA_DIR, 'ledger', 'tool-exec.jsonl'), 200_000).filter(r => inWindow(r.ts, cutoff));
  const toolCnt = new Map<string, number>();
  for (const r of toolRows) {
    const t = String(r.tool ?? '?');
    toolCnt.set(t, (toolCnt.get(t) ?? 0) + 1);
  }
  const tools: PulseTools = {
    calls: toolRows.length,
    fails: toolRows.filter(r => r.ok === false).length,
    top: [...toolCnt.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([name, n]) => ({ name, n })),
  };

  const chkRows = readJsonlTail(path.join(KFM_DATA_DIR, 'ledger', 'check-failures.jsonl'), 100_000).filter(r => inWindow(r.ts, cutoff));
  const chkCnt = new Map<string, number>();
  for (const r of chkRows) {
    const c = String(r.check ?? '?').replace(/\.mjs$/, '').replace(/^check-/, '');
    chkCnt.set(c, (chkCnt.get(c) ?? 0) + 1);
  }
  const checks: PulseChecks = {
    fails: chkRows.length,
    top: [...chkCnt.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name, n]) => ({ name, n })),
  };

  const bldRows = readJsonlTail(path.join(KFM_DATA_DIR, 'ledger', 'build-metrics.jsonl'), 100_000)
    .filter(r => r.phase === 'build' && inWindow(r.ts, cutoff));
  const lastBld = bldRows.at(-1);
  const build: PulseBuild = {
    lastMs: Number(lastBld?.ms ?? 0),
    lastOk: lastBld ? lastBld.ok === true : true,
    builds: bldRows.length,
  };

  const data: PulseData = { llm, tools, checks, build };
  pulseCache = { data, ts: now };
  return data;
}

// ========== 巡逻健康 + 会话 token + 权限审计（2026-08-09 用户定稿：填屏第三批） ==========
// 立项初心延续：8.5 史官制度「每条数据流落盘」→ 观测台「放到一起显示」。
// 巡逻 = 语义巡逻 runner 成本/健康（F5 成本闸门的数据源：次数/失败/耗时）；
// tokens = 会话 token 消耗（口径：语料包/两个配置不统计——待用户点名后填排除表）；
// perms = 权限引擎审计（破界率观测仪，8.5.0 骨架数据；2026-08-08 曾以「分布单一」
// 暂缓——用户拍板先上屏，分布单一本身也是观测结论）。

interface PatrolData { runs: number; fails: number; lastMs: number; lastOk: boolean; lastAgo: string }
interface TokenSession { title: string; tokens: number; msgs: number; updatedAt: string }
interface TokensData { total: number; sessions: TokenSession[] }
interface PermsData { allow: number; ask: number; deny: number; total: number; breakRate: number; unattended: number }

const PATROL_CACHE_MS = 60_000;
const TOKENS_CACHE_MS = 60_000;
const PERMS_CACHE_MS = 60_000;
let patrolCache: { data: PatrolData; ts: number } | null = null;
let tokensCache: { data: TokensData; ts: number } | null = null;
let permsCache: { data: PermsData; ts: number } | null = null;

function collectPatrol(): PatrolData {
  const now = Date.now();
  if (patrolCache && now - patrolCache.ts < PATROL_CACHE_MS) return patrolCache.data;
  const cutoff = now - 7 * 24 * 3_600_000;
  const rows = readJsonlTail(path.join(KFM_DATA_DIR, 'ledger', 'semantic-chain-metrics.jsonl'), 20_000).filter(r => inWindow(r.ts, cutoff));
  const last = rows.at(-1);
  const lastTs = last ? new Date(String(last.ts)).getTime() : 0;
  const data: PatrolData = {
    runs: rows.length,
    fails: rows.filter(r => r.ok !== true).length,
    lastMs: Number(last?.ms ?? 0),
    lastOk: last ? last.ok === true : true,
    lastAgo: lastTs ? fmtAgo(lastTs) : '—',
  };
  patrolCache = { data, ts: now };
  return data;
}

function collectTokens(): TokensData {
  const now = Date.now();
  if (tokensCache && now - tokensCache.ts < TOKENS_CACHE_MS) return tokensCache.data;
  // 口径排除表（用户 2026-08-09 定稿：语料包/两个配置不统计——待点名后填标题）
  const EXCLUDE_TITLES: string[] = [];
  const out: TokenSession[] = [];
  let files: string[];
  try { files = fs.readdirSync(SESSIONS_DIR).filter(f => f.endsWith('.json')); } catch { files = []; }
  for (const f of files) {
    try {
      const j = JSON.parse(fs.readFileSync(path.join(SESSIONS_DIR, f), 'utf-8')) as Record<string, unknown>;
      const title = String(j.title || f.replace(/\.json$/, ''));
      if (/^routine-validate-/.test(title)) continue; // 机器验证会话（与星轨同过滤）
      if (EXCLUDE_TITLES.includes(title)) continue;
      const tokens = Number(j.tokenCount ?? 0);
      const msgs = Number(j.messageCount ?? 0);
      if (msgs <= 2 && tokens <= 0) continue; // 空会话/测试残留
      out.push({ title, tokens, msgs, updatedAt: String(j.updatedAt ?? '') });
    } catch { /* 损坏会话跳过 */ }
  }
  out.sort((a, b) => b.tokens - a.tokens);
  const data: TokensData = { total: out.reduce((s, x) => s + x.tokens, 0), sessions: out };
  tokensCache = { data, ts: now };
  return data;
}

function collectPerms(): PermsData {
  const now = Date.now();
  if (permsCache && now - permsCache.ts < PERMS_CACHE_MS) return permsCache.data;
  const cutoff = now - 24 * 3_600_000;
  const rows = readJsonlTail(path.join(KFM_DATA_DIR, 'ledger', 'permission-audit.jsonl'), 100_000).filter(r => inWindow(r.ts, cutoff));
  let allow = 0, ask = 0, deny = 0, unattended = 0;
  for (const r of rows) {
    const d = String(r.decision ?? '');
    if (d === 'allow') allow++; else if (d === 'deny') deny++; else ask++;
    if (String(r.mode ?? '') === 'unattended') unattended++;
  }
  const total = rows.length;
  const data: PermsData = {
    allow, ask, deny, total,
    breakRate: total ? Math.round((deny / total) * 1000) / 10 : 0,
    unattended,
  };
  permsCache = { data, ts: now };
  return data;
}

// ========== 角色卡星座图（2026-08-09 用户定稿：全角色关系网，纯展示） ==========
// 数据源 .kfmv4/agents/roles/*.json（id/name/promptFiles/dynamicPromptFiles/updatedAt）
// + .kfmv4/active.json（roleFile=活跃角色）。文件为绝对路径可能在工作区外——只读 stat
// 不写；refCount = 被几张卡引用（共用文件形成角色间隐式连线）。前端纯光点不显示文字。
interface FileRef { path: string; name: string; dir: string; size: number; mtime: number; refCount: number; missing: boolean }
interface RoleNode { id: string; name: string; updatedAt: string; static: FileRef[]; dynamic: FileRef[] }
interface RolesData { roles: RoleNode[]; activeRoleId: string; totalRoles: number; totalFiles: number }

const ROLES_CACHE_MS = 60_000;
let rolesCache: { data: RolesData; ts: number } | null = null;

/** 纯函数：可测（fixture 传临时目录）。坏文件跳过、缺失文件标 missing 仍入图 */
export function buildRolesData(rolesDir: string, activePath: string): RolesData {
  let files: string[] = [];
  try { files = fs.readdirSync(rolesDir).filter(f => f.endsWith('.json')); } catch { files = []; }
  const fileMap = new Map<string, { size: number; mtime: number; missing: boolean }>();
  const refCount = new Map<string, number>();
  const raw: Array<Record<string, unknown>> = [];
  for (const f of files) {
    try {
      const r = JSON.parse(fs.readFileSync(path.join(rolesDir, f), 'utf-8')) as Record<string, unknown>;
      raw.push(r);
      const list = [
        ...(Array.isArray(r.promptFiles) ? r.promptFiles as unknown[] : []),
        ...(Array.isArray(r.dynamicPromptFiles) ? r.dynamicPromptFiles as unknown[] : []),
      ];
      for (const p of list) {
        if (typeof p !== 'string' || !p) continue;
        if (!fileMap.has(p)) {
          let size = 0, mtime = 0, missing = false;
          try { const st = fs.statSync(p); size = st.size; mtime = st.mtimeMs; } catch { missing = true; }
          fileMap.set(p, { size, mtime, missing });
        }
        refCount.set(p, (refCount.get(p) ?? 0) + 1);
      }
    } catch { /* 坏 JSON 跳过 */ }
  }
  const mkRefs = (list: unknown[] | undefined): FileRef[] =>
    (Array.isArray(list) ? list : []).filter((p): p is string => typeof p === 'string' && !!p).map(p => {
      const m = fileMap.get(p) ?? { size: 0, mtime: 0, missing: true };
      return { path: p, name: path.basename(p), dir: path.basename(path.dirname(p)), size: m.size, mtime: m.mtime, refCount: refCount.get(p) ?? 0, missing: m.missing };
    });
  const roles: RoleNode[] = raw.map(r => ({
    id: String(r.id ?? ''),
    name: String(r.name ?? r.id ?? ''),
    updatedAt: String(r.updatedAt ?? ''),
    static: mkRefs(r.promptFiles as unknown[] | undefined),
    dynamic: mkRefs(r.dynamicPromptFiles as unknown[] | undefined),
  })).filter(r => r.id);
  let activeRoleId = '';
  try {
    activeRoleId = String(JSON.parse(fs.readFileSync(activePath, 'utf-8')).roleFile ?? '');
  } catch { /* active 缺失兜底 */ }
  if (!roles.some(r => r.id === activeRoleId)) activeRoleId = roles[0]?.id ?? '';
  return { roles, activeRoleId, totalRoles: roles.length, totalFiles: fileMap.size };
}

function collectRoles(): RolesData {
  const now = Date.now();
  if (rolesCache && now - rolesCache.ts < ROLES_CACHE_MS) return rolesCache.data;
  const data = buildRolesData(path.join(KFM_DATA_DIR, 'agents', 'roles'), path.join(KFM_DATA_DIR, 'active.json'));
  rolesCache = { data, ts: now };
  return data;
}
