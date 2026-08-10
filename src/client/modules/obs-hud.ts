/**
 * obs-hud.ts — 观测台 HUD（8.5 史官制度 · L1 中央内容层，2026-08-05 立项）
 *
 * 背景信息窗：主卡（deepseek 余额）+ 双信息框（信箱=语义巡逻 verdict 时间线 /
 * 星轨=档案馆会话可视化，2026-08-07 用户定稿：科幻线条类，每会话一条发光轨道，
 * 占原待办位）+ 待办下移（stack.yaml 工作栈全状态渲染，固定右下贴输入栏上方）
 * + SYS 窄竖条（2026-08-06 用户定稿：信箱块正下方靠左、左线对齐主卡左线、
 * 向下顶到底；服务器四数 + 服务灯 + cron 8 条状态，只读 v1）。纯展示为主，列表局部可触摸滚动（pointer-events auto 仅滚动区）。
 *
 * 呈现哲学（依据 semantic-compiler-seed）：信箱是概率区非阻断信号——柔和状态
 * 徽标而非警报条；数据单一出处（服务端现场解析 inbox/STACK 文件，不缓存副本
 * ——语义生成原则）。SYS 阈值变色：平时灰，越限琥珀/红——出事才跳色。
 *
 * 刷新：余额+信箱+待办+SYS 5s 轮询（服务端 5s 缓存外部 deepseek 余额调用，
 * SYS 指标 5s 采样 / cron 5min 缓存）；时间本地每秒。
 */
import { API } from './state.js';
import { Z } from './z-index-layers.js';
import { initObsEmblems, type EmblemRects } from './obs-emblem.js';
import { initObsRoles, type RolesData, type RolesRect } from './obs-roles.js';

/** 轮询周期（5s，2026-08-06 用户定稿） */
const REFRESH_MS = 5_000;

let inited = false;

/** 余额固定 2 位小数（用户定稿） */
function fmtBalance(v: string): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return v;
  return `¥${n.toFixed(2)}`;
}

/** 信箱类型 → 徽标类名（柔和状态色，非警报化） */
const INBOX_DOT_CLASS: Record<string, string> = {
  warn: 'obs-dot-warn',
  ok: 'obs-dot-ok',
  dead: 'obs-dot-dead',
  stat: 'obs-dot-stat',
  other: 'obs-dot-other',
};
const INBOX_MARK: Record<string, string> = {
  warn: '⚠', ok: '✓', dead: '✕', stat: '▤', other: '·',
};
/** 类型中文标签（详情页徽标） */
const INBOX_LABEL: Record<string, string> = {
  warn: '待裁决', ok: '干净', dead: '崩溃', stat: '统计', other: '记录',
};

/** 待办状态（todo 待办 / hold 有保留 / done 已闭环——yaml status 字段直译） */
const STACK_LABEL: Record<string, string> = { todo: '待办', hold: '有保留', done: '已闭环' };

interface InboxEntry { date: string; time: string; type: string; text: string }
interface StackEntry { n: number; status: string; title: string; created: string; note: string; detail: string }
interface StackData { entries: StackEntry[]; counts: { todo: number; hold: number; done: number } }
// pair/conns 为服务端 v4 新字段；旧服务端（未重启/旧缓存）缺字段时兜底，禁止露出 undefined
interface SysMetric { label: string; value: string; pair?: string; pct: number | null }
interface SysPort { port: number; name: string; scope: 'public' | 'local'; conns?: number }
interface SysCron { name: string; status: 'ok' | 'fail' | 'unknown'; ago: string }
interface SysHistory { disk: number[]; mem: number[]; load: number[]; rss: number[] }
interface SysData { metrics: SysMetric[]; history: SysHistory; ports: SysPort[]; cron: SysCron[]; seq?: number }
// 星轨（档案馆会话，服务端已做残留过滤 + TOP8 + 聚合轨）
interface ArchiveTrack { title: string; tokens: number; msgs: number; t0: string; t1: string; active: boolean; aggregate?: number }
interface ArchiveData { sessions: number; totalTokens: number; tracks: ArchiveTrack[] }
// 脉搏（史官数据流 24h 聚合）
interface PulseData {
  llm: { calls: number; okRate: number; avgMs: number; byProvider: Record<string, number>; lastAgo: string };
  tools: { calls: number; fails: number; top: Array<{ name: string; n: number }> };
  checks: { fails: number; top: Array<{ name: string; n: number }> };
  build: { lastMs: number; lastOk: boolean; builds: number };
}
// 权限审计（24h 决策分布）；巡逻/token 类型随前端 UI 删除（服务端聚合保留供重设计取数）
interface PermsData { allow: number; ask: number; deny: number; total: number; breakRate: number; unattended: number }

export function initObsHud(): void {
  if (inited) return;
  inited = true;

  const hud = document.createElement('div');
  hud.className = 'obs-hud';
  hud.innerHTML = `
    <div class="obs-card">
      <div class="obs-left">
        <div class="obs-provider">deepseek 官方</div>
        <div class="obs-clock">--:--:--</div>
      </div>
      <div class="obs-balance">¥--</div>
    </div>
    <div class="obs-row">
      <div class="obs-inbox">
        <div class="obs-inbox-head">
          <button class="obs-inbox-back obs-inbox-back-head" style="display:none" aria-label="返回">‹</button>
          <span class="obs-inbox-title">信箱</span>
          <span class="obs-inbox-status"></span>
        </div>
        <div class="obs-inbox-list"></div>
      </div>
      <div class="obs-starmap">
        <div class="obs-inbox-head">
          <span class="obs-inbox-title">星轨</span>
          <span class="obs-starmap-status"></span>
        </div>
        <div class="obs-starmap-body"></div>
      </div>
    </div>
    <div class="obs-stack">
      <div class="obs-inbox-head">
        <button class="obs-inbox-back obs-inbox-back-head" style="display:none" aria-label="返回">‹</button>
        <span class="obs-inbox-title">待办</span>
        <span class="obs-stack-status"></span>
      </div>
      <div class="obs-stack-list"></div>
    </div>
  `;
  hud.style.zIndex = String(Z.CENTER_CONTENT); // L1 中央内容层（< SUMMON_BTN 200）
  document.body.appendChild(hud);

  // SYS 监控面板（2026-08-06 用户定稿 v3：信箱块正下方靠左、左线对齐主卡左线、向下
  // 顶到底；系统四指标带历史折线 + 监听端口两列 + cron 状态清单）——位置按
  // .obs-inbox 实测矩形注入，随 resize 重算
  const rail = document.createElement('div');
  rail.className = 'obs-rail';
  rail.innerHTML = `
    <div class="obs-rail-head">◈ 系统</div>
    <div class="obs-rail-sec obs-rail-sys"></div>
    <div class="obs-rail-head">⬡ 端口</div>
    <div class="obs-rail-sec obs-rail-ports"></div>
  `;
  rail.style.zIndex = String(Z.CENTER_CONTENT);
  document.body.appendChild(rail);
  const railSysEl = rail.querySelector<HTMLElement>('.obs-rail-sys')!;
  const railPortsEl = rail.querySelector<HTMLElement>('.obs-rail-ports')!;

  // 脉搏 + 执勤（2026-08-08 用户定稿：填屏第二批，史官数据流上屏——agent-calls/
  // tool-exec/check-failures/build-metrics 24h 聚合 + cron 八灯从 SYS 移出后的家）。
  // 布局 v4：脉搏与星轨同宽纵叠；执勤左缘顶 SYS 竖条右缘+10、右缘与星轨同齐；
  // 脉搏在上执勤在下，位置同 placeRail 实测矩形注入（starmap 底缘起排，避开右下待办卡）
  const pulse = document.createElement('div');
  pulse.className = 'obs-pulse';
  pulse.innerHTML = `
    <div class="obs-inbox-head"><span class="obs-inbox-title">脉搏</span><span class="obs-pulse-status"></span></div>
    <div class="obs-pulse-body"></div>
  `;
  pulse.style.zIndex = String(Z.CENTER_CONTENT);
  document.body.appendChild(pulse);
  const pulseBodyEl = pulse.querySelector<HTMLElement>('.obs-pulse-body')!;
  const pulseStatusEl = pulse.querySelector<HTMLElement>('.obs-pulse-status')!;
  const duty = document.createElement('div');
  duty.className = 'obs-duty';
  duty.innerHTML = `
    <div class="obs-inbox-head"><span class="obs-inbox-title">执勤</span><span class="obs-duty-status"></span></div>
    <div class="obs-duty-cron-grid"></div>
    <div class="obs-duty-body"></div>
  `;
  duty.style.zIndex = String(Z.CENTER_CONTENT);
  document.body.appendChild(duty);
  const dutyBodyEl = duty.querySelector<HTMLElement>('.obs-duty-body')!;
  const dutyCronGridEl = duty.querySelector<HTMLElement>('.obs-duty-cron-grid')!;
  const dutyStatusEl = duty.querySelector<HTMLElement>('.obs-duty-status')!;

  // 权限审计 R3（2026-08-09 用户定稿：填屏第三批）。吃 placeRail 注入的
  // 实测矩形：待办下输入栏上全宽横条。（巡逻 R1 / token R2 同日已按用户
  // 意见删除重设计——服务端聚合保留供新设计取数）
  const perms = document.createElement('div');
  perms.className = 'obs-perms';
  perms.innerHTML = `<div class="obs-perms-row"><span class="obs-perms-label">权限</span><span class="obs-perms-text"></span></div>`;
  perms.style.zIndex = String(Z.CENTER_CONTENT);
  document.body.appendChild(perms);
  const permsTextEl = perms.querySelector<HTMLElement>('.obs-perms-text')!;

  // fmtK 在深蓝意志徽标/星轨/权限共用（巡逻/token 图已删，fmtDur/fmtAgo 服务端提供）
  const fmtK = (v: number) => v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${Math.round(v / 1e3)}K` : String(v);

  const placeRail = () => {
    const r = hud.querySelector<HTMLElement>('.obs-inbox')!.getBoundingClientRect();
    rail.style.left = `${r.left}px`;
    rail.style.top = `${r.bottom + 10}px`;
    const sm = hud.querySelector<HTMLElement>('.obs-starmap')!.getBoundingClientRect();
    // 脉搏：左右界与星轨同齐（2026-08-08 v3 定稿）
    pulse.style.left = `${sm.left}px`;
    pulse.style.width = `${sm.width}px`;
    // 执勤：左缘顶到 SYS 竖条右缘+10，右缘与星轨右缘同齐（2026-08-08 v4 用户定稿：
    // 4 列 cron 灯在 200px 太挤，回到跨带版；此高度左侧是 SYS 竖条而非信箱，无碰撞）
    const sysR = rail.getBoundingClientRect();
    const dutyLeft = sysR.right + 10;
    duty.style.left = `${dutyLeft}px`;
    duty.style.width = `${sm.left + sm.width - dutyLeft}px`;
    pulse.style.top = `${sm.bottom + 10}px`;
    duty.style.top = `${pulse.getBoundingClientRect().bottom + 10}px`;
    // 底部信息框固定高度 + 空间不足消失（2026-08-10 用户定稿：浏览器高度各异，
    // 动态拉伸会过长/截断/重叠——统一固定高，空间不够哪个不够哪个消失）
    const PANEL_H = 170; // 待办/角色两框固定高度
    const inputBar = document.querySelector<HTMLElement>('.ai-input-bar');
    const inputTop = inputBar ? inputBar.getBoundingClientRect().top : window.innerHeight - 84;
    const dutyB = duty.getBoundingClientRect().bottom;
    const stackTop = dutyB + 10;
    // 待办框（.obs-stack）：固定高度；空间（到输入栏）不足则整体消失
    const stackEl = hud.querySelector<HTMLElement>('.obs-stack')!;
    const stackSpace = inputTop - 10 - stackTop;
    if (stackSpace >= PANEL_H + 40) {
      stackEl.style.display = '';
      stackEl.style.top = `${stackTop}px`;
      stackEl.style.height = `${PANEL_H}px`;
      stackEl.style.bottom = 'auto'; // 取消 CSS bottom 双锚拉伸，改固定高度
    } else {
      stackEl.style.display = 'none';
    }
    // 权限审计 R3（2026-08-09）：待办下、输入栏上，全宽横条（巡逻/token 已删）
    const srr = rail.getBoundingClientRect();
    const stk = stackEl.style.display === 'none'
      ? { left: srr.left + 210, bottom: stackTop + PANEL_H, width: 200 }
      : stackEl.getBoundingClientRect();
    perms.style.left = `${srr.left}px`;
    perms.style.width = `${stk.left + stk.width - srr.left}px`;
    perms.style.top = `${stk.bottom + 10}px`;
    perms.style.height = `${inputTop - 10 - perms.getBoundingClientRect().top}px`;
    // 角色卡星座图（2026-08-10 修订：固定高度；角色框与待办框**并排**（左列），
    // 垂直可延伸到待办下界（原动态高度即 stk.bottom - srr.bottom - 10）——
    // 用待办下界算可用空间，够 PANEL_H 显示固定高，不够消失）
    const rolesTop = srr.bottom + 10;
    const stkBottom = stk.bottom;
    const rolesSpace = stkBottom - rolesTop;
    if (rolesSpace >= PANEL_H) {
      rolesRect = {
        left: srr.left,
        top: rolesTop,
        width: stk.left - 10 - srr.left,
        height: PANEL_H,
      };
    } else {
      rolesRect = { left: srr.left, top: rolesTop, width: stk.left - 10 - srr.left, height: 0 };
    }
    const rsig = JSON.stringify(rolesRect, (k, v) => typeof v === 'number' ? Math.round(v) : v);
    if (rsig !== lastRolesSig) { lastRolesSig = rsig; roles?.relayout(); }
    // 深蓝意志徽标几何：A=四框围出的中央口袋（2026-08-09 裁决留 A，B/C 竖带取消）
    const dutyR = duty.getBoundingClientRect();
    const pocket = {
      left: dutyLeft,
      top: r.bottom + 10,
      width: sm.left - dutyLeft - 10,
      height: dutyR.top - (r.bottom + 10) - 10,
    };
    emblemRects = { pocket };
    const sig = JSON.stringify(emblemRects, (k, v) => typeof v === 'number' ? Math.round(v) : v);
    if (sig !== lastEmblemSig) { lastEmblemSig = sig; emblems?.relayout(); }
  };
  let emblemRects: EmblemRects | null = null;
  let lastEmblemSig = '';
  let rolesRect: RolesRect | null = null;
  let lastRolesSig = '';
  // 深蓝意志动态徽标 A 聚散（2026-08-09 用户实拍裁决：留 A，B 潮汐/C 轨道取消，
  // 三画布收敛单画布）；getRects 惰性读 placeRail 算好的几何
  const emblems = initObsEmblems(() => emblemRects);
  // 角色卡星座图（全角色关系网 · C 轨道极缓缓动 · 纯光点，同日定稿；v2 去标题栏）
  const roles = initObsRoles(() => rolesRect);
  placeRail();
  window.addEventListener('resize', placeRail);
  // 竖条高度钉死 = 系统区 + 端口区恰好 4 行窗口（2026-08-07 用户定稿 v2：4 整行硬切，
  // 无重叠无平滑）；端口超出 4 行 → 窗口内每 5s 硬切一屏，最后一屏定格、再击回顶；无手势穿透
  let portStride = 0; // 一屏步长 = 第 5 行与第 1 行的位置差（4 行 + 4 间距）
  const sizePorts = () => {
    const rows = railPortsEl.children;
    if (rows.length === 0) { railPortsEl.style.height = ''; portStride = 0; return; }
    const n = Math.min(4, rows.length);
    const first = rows[0] as HTMLElement;
    const last = rows[n - 1] as HTMLElement;
    railPortsEl.style.height = `${last.offsetTop + last.offsetHeight - first.offsetTop}px`;
    portStride = rows.length > 4 ? (rows[4] as HTMLElement).offsetTop - first.offsetTop : 0;
  };
  setInterval(() => {
    if (!portStride) return;
    const el = railPortsEl;
    const maxTop = el.scrollHeight - el.clientHeight;
    if (el.scrollTop >= maxTop - 2) el.scrollTo({ top: 0, behavior: 'auto' });
    else el.scrollTo({ top: Math.min(el.scrollTop + portStride, maxTop), behavior: 'auto' });
  }, 2_500);

  // 信箱/待办自动翻屏（2026-08-08 用户定稿：列表手势滑动会吞掉全局卡片堆手势，
  // 改 overflow:hidden + 按一屏高硬切，到底回顶；点击/详情交互不受影响，
  // 详情视图同容器也走翻屏——否则长文永远读不到后半）。
  // 详情三屏上限（2026-08-09 用户定稿：长文无限翻太拖沓）——详情态 maxTop 收
  // 到 2 屏，滚完 3 屏停在末屏不回顶；列表态保持到底回顶循环。
  // 节奏错位（同日定稿 v3 提速一倍）：端口 2.5s / 执勤 cron 2.8s / 信箱 3.1s /
  // 待办 3.7s——四处翻屏周期互质漂移，永不同拍齐跳，观感更活
  const autoPage = (el: HTMLElement, detail: boolean) => {
    const maxTop = detail
      ? Math.min(el.scrollHeight - el.clientHeight, 2 * el.clientHeight)
      : el.scrollHeight - el.clientHeight;
    if (maxTop <= 2) { if (el.scrollTop) el.scrollTo({ top: 0, behavior: 'auto' }); return; }
    if (el.scrollTop >= maxTop - 2) { if (!detail) el.scrollTo({ top: 0, behavior: 'auto' }); return; }
    el.scrollTo({ top: Math.min(el.scrollTop + el.clientHeight, maxTop), behavior: 'auto' });
  };
  setInterval(() => autoPage(inboxListEl, !!inboxDetail), 3_100);
  setInterval(() => autoPage(stackListEl, !!stackDetail), 3_700);

  const clockEl = hud.querySelector<HTMLElement>('.obs-clock')!;
  const balanceEl = hud.querySelector<HTMLElement>('.obs-balance')!;
  const inboxListEl = hud.querySelector<HTMLElement>('.obs-inbox-list')!;
  const inboxStatusEl = hud.querySelector<HTMLElement>('.obs-inbox-status')!;
  const inboxBackBtn = hud.querySelector<HTMLElement>('.obs-inbox .obs-inbox-back-head')!;
  const stackListEl = hud.querySelector<HTMLElement>('.obs-stack-list')!;
  const stackStatusEl = hud.querySelector<HTMLElement>('.obs-stack-status')!;
  const stackBackBtn = hud.querySelector<HTMLElement>('.obs-stack .obs-inbox-back-head')!;
  const starmapBodyEl = hud.querySelector<HTMLElement>('.obs-starmap-body')!;
  const starmapStatusEl = hud.querySelector<HTMLElement>('.obs-starmap-status')!;

  let inboxEntries: InboxEntry[] = [];
  let inboxDetail: InboxEntry | null = null;
  let stackData: StackData = { entries: [], counts: { todo: 0, hold: 0, done: 0 } };
  let stackDetail: StackEntry | null = null;

  // 本地时钟（每秒）
  const tick = () => {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    clockEl.textContent = `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  };
  tick();
  setInterval(tick, 1000);

  // 渲染信箱列表（最新在前，历史渐淡；条目 = 圆点+日期+文字单行流，两行截断）
  function renderInboxList(): void {
    const latestWarn = inboxEntries.find(e => e.type === 'warn');
    const warnCount = latestWarn?.text.match(/^\d+\s*条待裁决/)?.[0];
    inboxStatusEl.textContent = latestWarn
      ? `${INBOX_MARK.warn} ${warnCount ?? latestWarn.text.slice(0, 10)}`
      : `${INBOX_MARK.ok} 干净`;
    inboxListEl.innerHTML = inboxEntries.map((e, i) => {
      const dot = INBOX_DOT_CLASS[e.type] ?? 'obs-dot-other';
      const date = e.date.slice(5).replace('-', '/'); // MM-DD → MM/DD
      const highlight = i === 0 ? ' obs-inbox-item-new' : '';
      return `<div class="obs-inbox-item${highlight}" data-i="${i}"><span class="obs-inbox-item-flow"><span class="obs-dot ${dot}" style="${pulseStyle(e.date + e.time + e.type)}"></span><span class="obs-inbox-meta">${date}${e.time ? ' ' + e.time : ''}</span> ${e.text}</span></div>`;
    }).join('');
  }

  // 详情视图：返回按钮在标题栏（head 常驻不滚动，2026-08-09 用户定稿：sticky 方案
  // 会盖正文，按钮放标题栏才符合直觉）；状态位显示日期 + 类型徽标
  function renderInboxDetail(): void {
    if (!inboxDetail) return;
    const mark = INBOX_MARK[inboxDetail.type] ?? '·';
    const label = INBOX_LABEL[inboxDetail.type] ?? inboxDetail.type;
    inboxStatusEl.textContent = `${inboxDetail.date}${inboxDetail.time ? ' ' + inboxDetail.time : ''} · ${mark} ${label}`;
    inboxBackBtn.style.display = '';
    inboxListEl.innerHTML = `
      <div class="obs-inbox-detail">
        <div class="obs-inbox-detail-text">${inboxDetail.text}</div>
      </div>`;
  }

  function showInboxDetail(i: number): void {
    const e = inboxEntries[i];
    if (!e) return;
    inboxDetail = e;
    inboxListEl.scrollTop = 0;
    renderInboxDetail();
  }
  function showInboxList(): void {
    inboxDetail = null;
    inboxBackBtn.style.display = 'none';
    inboxListEl.scrollTop = 0;
    renderInboxList();
  }

  // 标题栏返回按钮（head 常驻，点击直接回列表）
  inboxBackBtn.addEventListener('click', showInboxList);
  // 点击条目 → 详情（事件委托，滚动区已局部 pointer-events auto）
  inboxListEl.addEventListener('click', e => {
    if (inboxDetail) return;
    const item = (e.target as HTMLElement).closest<HTMLElement>('.obs-inbox-item');
    if (item) {
      const i = Number(item.dataset.i);
      if (Number.isInteger(i)) showInboxDetail(i);
    }
  });

  // 渲染待办列表（todo/hold 在前，done 殿后，分组计数；条目 = 状态点+#编号+标题
  // （独立 clamp 2）+ note 次行（独立单行截断）——标题与 note 同层共用一个 clamp 时，
  // 标题占满两行会顶掉 note 并白挂省略号（2026-08-06 用户实拍反馈）。
  // 2026-08-08：状态渐淡取消，条目全亮，状态区分只靠光点）
  function renderStackList(): void {
    const { entries, counts } = stackData;
    stackStatusEl.textContent = `${counts.todo} 待 · ${counts.done} 闭环`;
    let prevDone = false;
    stackListEl.innerHTML = entries.map((e, i) => {
      const divider = e.status === 'done' && !prevDone ? `<div class="obs-stack-divider">已闭环</div>` : '';
      prevDone = e.status === 'done';
      const cls = e.status === 'done' ? ' obs-stack-item-done' : e.status === 'hold' ? ' obs-stack-item-hold' : '';
      return `${divider}<div class="obs-inbox-item${cls}" data-i="${i}"><span class="obs-inbox-item-flow"><span class="obs-dot obs-dot-stack-${e.status}" style="${pulseStyle('#' + e.n)}"></span><span class="obs-inbox-meta">#${e.n}</span> ${e.title}</span><span class="obs-stack-note">${e.note}</span></div>`;
    }).join('');
  }

  // 待办详情：返回按钮在标题栏；状态位显示 #编号 + 状态；滚动框内只留正文
  function renderStackDetail(): void {
    if (!stackDetail) return;
    const label = STACK_LABEL[stackDetail.status] ?? stackDetail.status;
    // 服务端 detail 首行 = title（详情锚），此处单独渲染标题后剥掉首行防重复
    const body = stackDetail.detail.split('\n').slice(1).join('\n').trim();
    stackStatusEl.textContent = `#${stackDetail.n} · ${label}`;
    stackBackBtn.style.display = '';
    stackListEl.innerHTML = `
      <div class="obs-inbox-detail">
        <div class="obs-inbox-detail-text"><span class="obs-stack-detail-title">${stackDetail.title}</span>
<span class="obs-inbox-meta">${stackDetail.created}</span>
${stackDetail.note}

${body}</div>
      </div>`;
  }

  function showStackDetail(i: number): void {
    const e = stackData.entries[i];
    if (!e) return;
    stackDetail = e;
    stackListEl.scrollTop = 0;
    renderStackDetail();
  }
  function showStackList(): void {
    stackDetail = null;
    stackBackBtn.style.display = 'none';
    stackListEl.scrollTop = 0;
    renderStackList();
  }

  stackBackBtn.addEventListener('click', showStackList);
  stackListEl.addEventListener('click', e => {
    if (stackDetail) return;
    const item = (e.target as HTMLElement).closest<HTMLElement>('.obs-inbox-item');
    if (item) {
      const i = Number(item.dataset.i);
      if (Number.isInteger(i)) showStackDetail(i);
    }
  });

  // 渲染星轨（2026-08-07 用户定稿：科幻线条类会话可视化，3:2 横版占原待办位）
  // 每会话一条发光轨道：横轴时间（右端=现在），线长=活跃跨度（createdAt→updatedAt），
  // 线宽/亮度=tokenCount（sqrt 压缩动态范围），48h 内活跃会话末端挂呼吸光点
  // （pulseStyle 伪随机节奏，与端口/信箱/待办同族）；聚合轨虚线细轨；底部 MM/DD 刻度行。
  // 行距半格 12px（2026-08-08 用户定稿），**高度钉死 6 行**（2026-08-09 用户定稿：
  // 取消随轨道数自动长高——服务端 TOP5+聚合轨保证 ≤6 行，H 为常量，当前状态即最大高度）
  function renderStarmap(a: ArchiveData): void {
    const fmtK = (v: number) => v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${Math.round(v / 1e3)}K` : String(v);
    starmapStatusEl.textContent = `${a.sessions} 会话 · Σ${fmtK(a.totalTokens)}`;
    const W = 184, PADX = 4, AXIS_H = 14, PADY = 5;
    const n = a.tracks.length;
    const rowH = 12; // 行距半格（网格 24px/格）
    const MAX_ROWS = 6; // 高度钉死：服务端 TOP5+聚合轨 ≤6 行
    const H = Math.round(PADY * 2 + MAX_ROWS * rowH + AXIS_H);
    if (a.tracks.length === 0) {
      starmapBodyEl.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img"></svg><div class="obs-starmap-empty" style="margin-top:-${H}px;line-height:${H}px">暂无会话</div>`;
      return;
    }
    const now = Date.now();
    const tMin = Math.min(...a.tracks.map(t => new Date(t.t0).getTime()));
    const span = Math.max(1, now - tMin);
    const x = (t: number) => PADX + (W - PADX * 2) * ((t - tMin) / span);
    const maxTok = Math.max(...a.tracks.map(t => t.tokens), 1);
    const md = (t: number) => { const d = new Date(t); return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`; };
    const rows = a.tracks.map((t, i) => {
      const cy = PADY + i * rowH + rowH / 2;
      const x0 = x(new Date(t.t0).getTime());
      const x1 = Math.max(x(new Date(t.t1).getTime()), x0 + 3); // 单刻会话保底 3px 段
      const hue = 190 + (i * 70) / Math.max(n - 1, 1); // 青 → 紫家族渐变
      const color = `hsl(${hue.toFixed(0)} 90% 65%)`;
      const wdt = t.aggregate ? 1 : 0.8 + 2.2 * Math.sqrt(t.tokens / maxTok);
      const dash = t.aggregate ? ' stroke-dasharray="3 3" opacity=".55"' : '';
      const tip = t.aggregate ? `其他 ×${t.aggregate} · Σ${fmtK(t.tokens)}` : `${t.title} · ${t.msgs} 条 · ${fmtK(t.tokens)}`;
      const dot = t.active
        ? `<circle class="obs-star-dot" cx="${x1.toFixed(1)}" cy="${cy.toFixed(1)}" r="2.2" fill="${color}" style="${pulseStyle(t.title + t.t0)}"/>`
        : `<circle cx="${x1.toFixed(1)}" cy="${cy.toFixed(1)}" r="1.4" fill="${color}" opacity=".5"/>`;
      return `<g><title>${tip}</title><line x1="${PADX}" y1="${cy.toFixed(1)}" x2="${W - PADX}" y2="${cy.toFixed(1)}" stroke="rgba(160,140,255,.09)" stroke-width="1"/><circle cx="${x0.toFixed(1)}" cy="${cy.toFixed(1)}" r="1.4" fill="${color}" opacity=".5"/><line x1="${x0.toFixed(1)}" y1="${cy.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${cy.toFixed(1)}" stroke="${color}" stroke-width="${wdt.toFixed(1)}" stroke-linecap="round"${dash} style="filter:drop-shadow(0 0 2px ${color})"/>${dot}</g>`;
    }).join('');
    // 四分之一位竖向淡网格（填补亮段外的空旷区，与背景网格同族）
    const grid = [0.25, 0.5, 0.75].map(f =>
      `<line x1="${(PADX + (W - PADX * 2) * f).toFixed(1)}" y1="${PADY}" x2="${(PADX + (W - PADX * 2) * f).toFixed(1)}" y2="${H - AXIS_H}" stroke="rgba(124,58,237,.07)" stroke-width="1"/>`).join('');
    const axisY = H - AXIS_H + 9;
    const axis = `<line x1="${PADX}" y1="${H - AXIS_H}" x2="${W - PADX}" y2="${H - AXIS_H}" stroke="rgba(124,58,237,.25)" stroke-width="1"/>`
      + `<text x="${PADX}" y="${axisY}" class="obs-star-axis" text-anchor="start">${md(tMin)}</text>`
      + `<text x="${W / 2}" y="${axisY}" class="obs-star-axis" text-anchor="middle">${md(tMin + span / 2)}</text>`
      + `<text x="${W - PADX}" y="${axisY}" class="obs-star-axis" text-anchor="end">现在</text>`;
    starmapBodyEl.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img">${grid}${rows}${axis}</svg>`;
  }

  // 渲染脉搏（LLM + 工具两行实况 + 工具 TOP4 横向条）与执勤（cron 灯 4 列 2 行 +
  // 检查链失败 TOP + 构建行）——渲染后重测位置（内容高度决定下一框起排点）
  const fmtDur = (ms: number) => ms >= 60_000 ? `${(ms / 60_000).toFixed(1)}m` : ms >= 1000 ? `${Math.round(ms / 1000)}s` : `${ms}ms`;
  // cron 灯窗口：4 列 2 行 = 8 条一屏（2026-08-08 用户定稿，原 2 列 4 行太高）；
  // 超出 8 条每 2.8s 硬切一屏（翻屏节奏错位家族之一，见 autoPage 注释）
  let dutyCron: SysCron[] = [];
  let dutyCronPage = 0;
  function renderDutyCron(): void {
    const per = 8;
    const pages = Math.max(1, Math.ceil(dutyCron.length / per));
    dutyCronPage %= pages;
    const slice = dutyCron.slice(dutyCronPage * per, dutyCronPage * per + per);
    // 隐形占位补满 8 格：2 行高度钉死，cron 不足/翻屏末页面板不变矮
    // （2026-08-09 用户定稿：全部面板取消自动长高，当前状态即最大高度）
    while (slice.length < per) slice.push({ name: '·', ago: '', status: 'pad' } as unknown as SysCron); // escape-ok: 隐形占位条构造（pad 占位，非类型逃逸语义）
    dutyCronGridEl.innerHTML = slice.map(c => {
      if ((c.status as string) === 'pad') return '<div class="obs-duty-cron" style="visibility:hidden"><span class="obs-duty-name">·</span></div>';
      const cls = c.status === 'ok' ? 'obs-dot-ok' : c.status === 'fail' ? 'obs-dot-dead' : 'obs-dot-other';
      return `<div class="obs-duty-cron"><span class="obs-dot ${cls}" style="${pulseStyle(c.name)}"></span><span class="obs-duty-name">${c.name}</span><span class="obs-duty-ago">${c.ago}</span></div>`;
    }).join('');
  }
  setInterval(() => {
    if (dutyCron.length <= 8) return;
    dutyCronPage++;
    renderDutyCron();
  }, 2_800);
  function renderPulse(p: PulseData, cron: SysCron[]): void {
    const provs = Object.entries(p.llm.byProvider).map(([k, v]) => `${k} ×${v}`).join(' ');
    pulseStatusEl.textContent = '24h';
    // TOP4 条数钉死 4：不足补隐形占位条，面板高度不随工具数变矮（2026-08-09 用户定稿）
    const tops = p.tools.top.slice(0, 4);
    while (tops.length < 4) tops.push({ name: '·', n: 0 });
    const maxN = Math.max(...tops.map(t => t.n), 1);
    const bars = tops.map(t =>
      t.n === 0 && t.name === '·'
        ? '<div class="obs-pulse-bar" style="visibility:hidden"><span class="obs-pulse-bar-label">·</span><span class="obs-pulse-bar-track"><span class="obs-pulse-bar-fill" style="width:0%"></span></span><span class="obs-pulse-bar-n">0</span></div>'
        : `<div class="obs-pulse-bar"><span class="obs-pulse-bar-label">${t.name}</span><span class="obs-pulse-bar-track"><span class="obs-pulse-bar-fill" style="width:${Math.round((t.n / maxN) * 100)}%"></span></span><span class="obs-pulse-bar-n">${t.n}</span></div>`).join('');
    pulseBodyEl.innerHTML = `
      <div class="obs-pulse-line"><span class="obs-pulse-key">LLM</span> ${p.llm.calls} 次 · <span class="${p.llm.okRate < 95 ? 'obs-rail-num-amber' : ''}">${p.llm.okRate}%</span> · 均 ${fmtDur(p.llm.avgMs)} · ${p.llm.lastAgo}前</div>
      <div class="obs-pulse-dim">${provs || '—'}</div>
      <div class="obs-pulse-line"><span class="obs-pulse-key">工具</span> ${p.tools.calls} 次${p.tools.fails > 0 ? ` · <span class="obs-rail-num-amber">失败 ${p.tools.fails}</span>` : ''}</div>
      ${bars}`;
    dutyCron = cron;
    dutyCronPage = 0;
    renderDutyCron();
    dutyStatusEl.textContent = `${p.checks.fails} 败`;
    dutyBodyEl.innerHTML = `
      <div class="obs-pulse-line obs-duty-sep"><span class="obs-pulse-key">检查</span> ${p.checks.fails} 失败${p.checks.top.length ? ` · ${p.checks.top.slice(0, 2).map(t => `${t.name}×${t.n}`).join(' ')}` : ''}</div>
      <div class="obs-pulse-line"><span class="obs-pulse-key">构建</span> ${p.build.builds} 次 · 最近 ${fmtDur(p.build.lastMs)} <span class="${p.build.lastOk ? 'obs-duty-ok' : 'obs-rail-num-red'}">${p.build.lastOk ? '✓' : '✗'}</span></div>`;
    placeRail();
  }

  // ========== 权限审计 R3（2026-08-09 填屏第三批；巡逻/token 同日删除重设计） ==========
  function renderPerms(p: PermsData): void {
    permsTextEl.textContent = `24h 放行 ${p.allow} · 询问 ${p.ask} · 拒绝 ${p.deny} · 越界率 ${p.breakRate}%${p.unattended ? ` · 无人 ${p.unattended}` : ''}`;
  }

  // 渲染 SYS 面板（2026-08-07 用户定稿：指标行 = 文字行（标签+百分号+xx/xx 实值对）
  // + 下方滚动柱状图（绿<70/黄 70-85/红>85 逐样本上色，新样本右侧滚入）；
  // 端口行 = 作用域标（公/本）+ 端口号 + 进程名 + 活跃连接数）
  const metricCls = (pct: number | null): string =>
    pct == null ? '' : pct > 85 ? ' obs-rail-num-red' : pct >= 70 ? ' obs-rail-num-amber' : '';
  const BAR_SHOW = 16; // 窗口恰好显示 16 根（79px，与收窄后的端口行自然宽度对齐，5s 采样 ≈ 80s 窗）
  const BAR_STEP = 5; // 柱宽 4px + 间距 1px，与 base.scss .obs-bar 同步
  // 缓动设计（2026-08-07 用户定稿 v2）：动画时长 = 服务端采样间隔（obs.ts tick 5s），
  // 速度 = 单柱步长 / 采样间隔，新柱恰好随下一拍匀速流入。
  // 两个关键不变式：
  // ① 四轨同步——四列同拍采样，任一新样本四轨齐滑（值未变的补同高柱），各自动会显得随机；
  // ② 轨道恒渲染 BAR_SHOW+1 根、稳态 translateX(-5px)——新柱 append 后恰在右界外，
  //    滑入全程无闪现；复位 = 删左界外首柱 + 无过渡归零，与滑完态逐像素一致。
  const BAR_ANIM_MS = 5_000;
  type MetricRec = { row: HTMLElement; track: HTMLElement };
  const metricRecs = new Map<string, MetricRec>();
  let lastWinSig = '';
  let lastWins: number[][] = [];
  let lastSeq = -1;
  function barHtml(v: number, pct: number | null, vmax: number): string {
    const cls = pct == null ? 'obs-bar-cyan' : v > 85 ? 'obs-bar-red' : v >= 70 ? 'obs-bar-amber' : 'obs-bar-green';
    const h = Math.max(2, Math.round(Math.min(1, v / (pct != null ? 100 : vmax)) * 16));
    return `<span class="obs-bar ${cls}" style="height:${h}px"></span>`;
  }
  const HISTORY_KEYS = ['disk', 'mem', 'load', 'rss'] as const;
  // 光点呼吸节奏伪随机（端口同款思路）：字符串种子取模 → 九档时长（2.2~4.1s）+ 十三档相位——
  // 确定性（同一条目重绘节奏不变，不跳变）而非真随机；种子：信箱用 date+time+type，待办用 #编号
  function pulseStyle(seed: string): string {
    let h = 0;
    for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) | 0;
    h = Math.abs(h);
    return `animation-duration:${(2.2 + (h % 9) * 0.23).toFixed(2)}s;animation-delay:${(-(h % 13) * 0.31).toFixed(2)}s`;
  }
  function renderSys(sys: SysData): void {
    const hists = HISTORY_KEYS.map(k => sys.history?.[k] ?? []);
    sys.metrics.forEach((m, i) => {
      const key = HISTORY_KEYS[i];
      let rec = metricRecs.get(key);
      if (!rec) {
        // 首次构建：DOM 分「文字行 + 轨道」两段；历史够长则直接以稳态（25 根 + 左移 5px）落位
        const wrap = document.createElement('div');
        wrap.className = 'obs-sys-metric';
        wrap.innerHTML = '<div class="obs-sys-row"></div><div class="obs-sys-bars"><div class="obs-sys-track"></div></div>';
        railSysEl.appendChild(wrap);
        const track = wrap.querySelector<HTMLElement>('.obs-sys-track')!;
        const take = hists[i].slice(-(BAR_SHOW + 1));
        const vmax = Math.max(...take, 1);
        track.innerHTML = take.map(v => barHtml(v, m.pct, vmax)).join('');
        if (take.length > BAR_SHOW) {
          // 首屏即启动滑入（2026-08-07 用户反馈：刷新后干等一拍才动）——与节拍滑动同款复位技巧，
          // 从 translateX(0) 过渡到稳态 -5px，加载完成立刻有流动感
          track.style.transition = 'none';
          track.style.transform = 'translateX(0)';
          void track.offsetWidth;
          track.style.transition = `transform ${BAR_ANIM_MS}ms linear`;
          track.style.transform = `translateX(-${BAR_STEP}px)`;
        }
        rec = { row: wrap.querySelector<HTMLElement>('.obs-sys-row')!, track };
        metricRecs.set(key, rec);
      }
      rec.row.innerHTML = `<span class="obs-sys-label">${m.label}</span><span class="obs-rail-num${metricCls(m.pct)}">${m.value}</span><span class="obs-sys-pair">${m.pair ?? ''}</span>`;
    });
    // 滑动驱动 = 时钟驱动（2026-08-07 用户定稿）：服务端每拍采样 seq+1，seq 变了就是新拍——
    // 值相同也照滑（补同高柱），不因稳态值不变而静止；旧服务端无 seq 退回窗口签名判定。
    // 内容恰好平移一根（各列 cur = prev.slice(1)+[new]）→ 走缓动；跳多拍（失焦冷冻期间
    // 采样积累）或历史重置 → 直接重建轨道稳态，下一拍恢复滑动。
    const wins = hists.map(h => h.slice(-(BAR_SHOW + 1)));
    const winSig = wins.map(w => w.join(',')).join('|');
    if (lastWins.length === 0 && hists[0].length > 0) {
      // 首次构建：状态同步为当前窗口（动画交给首屏滑入）——不同步则本次 renderSys 的
      // 判定段会误判跳拍走重建分支，把刚启动的首屏动画掐死
      lastWinSig = winSig;
      lastWins = wins;
      lastSeq = sys.seq ?? -1;
    } else if (hists[0].length > 0 && (sys.seq != null ? sys.seq !== lastSeq : winSig !== lastWinSig)) {
      const shiftOne = lastWins.length === 4 && wins.every((w, i) => {
        const p = lastWins[i];
        return p.length > 1 && w.length > 1 && p.slice(1).join(',') === w.slice(0, w.length - 1).join(',');
      });
      if (shiftOne) {
        HISTORY_KEYS.forEach((k, i) => {
          const tr = metricRecs.get(k)!.track;
          if (tr.children.length > BAR_SHOW) tr.firstElementChild!.remove(); // 已滑出左界的最旧柱
          tr.style.transition = 'none';
          tr.style.transform = 'translateX(0)'; // 复位：删首柱 + 归零，与滑完态无缝衔接
          const h = hists[i];
          tr.insertAdjacentHTML('beforeend', barHtml(h[h.length - 1], sys.metrics[i].pct, Math.max(...h.slice(-BAR_SHOW), 1))); // 新柱落在右界外
          void tr.offsetWidth; // 强制 reflow，让复位先生效再启动过渡
          tr.style.transition = `transform ${BAR_ANIM_MS}ms linear`;
          tr.style.transform = `translateX(-${BAR_STEP}px)`;
        });
      } else {
        // 重建轨道（无动画硬重置）——覆盖失焦积累、服务端重启历史重置等一切错位场景
        HISTORY_KEYS.forEach((k, i) => {
          const tr = metricRecs.get(k)!.track;
          const vmax = Math.max(...wins[i], 1);
          tr.style.transition = 'none';
          tr.innerHTML = wins[i].map(v => barHtml(v, sys.metrics[i].pct, vmax)).join('');
          tr.style.transform = wins[i].length > BAR_SHOW ? `translateX(-${BAR_STEP}px)` : 'translateX(0)';
        });
      }
      lastWinSig = winSig;
      lastWins = wins;
      lastSeq = sys.seq ?? lastSeq;
    }
    // 隐形占位补满 4 行：端口不足 4 行时竖条高度不变矮（2026-08-09 用户定稿：
    // 全部面板取消自动长高，当前状态即最大高度；占位行不占翻屏窗口——
    // rows.length>4 才有 portStride，补齐到恰好 4 行不触发翻屏）
    const portRows = sys.ports.map(p =>
      `<div class="obs-port-row"><span class="obs-port-dot obs-port-dot-${p.scope}" style="${pulseStyle(String(p.port))}"></span><span class="obs-port-num">${p.port}</span><span class="obs-port-name">${p.name}</span><span class="obs-port-conns">${(p.conns ?? 0) > 0 ? '×' + p.conns : ''}</span></div>`
    );
    while (portRows.length < 4) portRows.push('<div class="obs-port-row" style="visibility:hidden"><span class="obs-port-num">·</span></div>');
    railPortsEl.innerHTML = portRows.join('');
    sizePorts(); // 端口窗口钉死 4 行高（行数变化后重测）
  }

  // 余额 + 信箱 + 待办 + SYS 刷新（5s 轮询；服务端缓存外部 deepseek 调用）
  // 数据未变不重渲染——innerHTML 重建会重置滚动位置，5s 一次等于禁止翻列表
  let lastTotal = '';
  let lastInboxKey = '';
  let lastStackKey = '';
  let lastSysKey = '';
  let lastArchiveKey = '';
  let lastPulseKey = '';
  let lastPermsKey = '';
  let lastRolesKey = '';
  const refresh = async () => {
    try {
      const res = await fetch(`${API}/obs/hud`, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json() as { balance?: { total?: string; error?: string }; inbox?: InboxEntry[]; stack?: StackData; sys?: SysData; archive?: ArchiveData; pulse?: PulseData; perms?: PermsData; roles?: RolesData };
      const b = j?.balance;
      if (b && !b.error && b.total != null) {
        balanceEl.textContent = fmtBalance(b.total);
        if (b.total !== lastTotal) {
          lastTotal = b.total;
          balanceEl.classList.remove('obs-flash');
          void balanceEl.offsetWidth;
          balanceEl.classList.add('obs-flash');
        }
      } else {
        balanceEl.textContent = '—';
      }
      if (Array.isArray(j?.inbox)) {
        const key = JSON.stringify(j.inbox);
        inboxEntries = j.inbox;
        if (key !== lastInboxKey) {
          lastInboxKey = key;
          const st = inboxListEl.scrollTop;
          if (inboxDetail) renderInboxDetail(); else renderInboxList();
          inboxListEl.scrollTop = st;
        }
      }
      if (j?.stack && Array.isArray(j.stack.entries)) {
        const key = JSON.stringify(j.stack);
        stackData = j.stack;
        if (key !== lastStackKey) {
          lastStackKey = key;
          const st = stackListEl.scrollTop;
          if (stackDetail) renderStackDetail(); else renderStackList();
          stackListEl.scrollTop = st;
        }
      }
      if (j?.sys && Array.isArray(j.sys.metrics) && Array.isArray(j.sys.ports)) {
        const key = JSON.stringify(j.sys);
        if (key !== lastSysKey) {
          lastSysKey = key;
          renderSys(j.sys);
        }
      }
      if (j?.archive && Array.isArray(j.archive.tracks)) {
        const key = JSON.stringify(j.archive);
        if (key !== lastArchiveKey) {
          lastArchiveKey = key;
          renderStarmap(j.archive);
        }
      }
      if (j?.pulse?.llm && j?.pulse?.tools && j?.pulse?.checks && j?.pulse?.build) {
        const cron = Array.isArray(j?.sys?.cron) ? j.sys.cron : [];
        const key = JSON.stringify(j.pulse) + JSON.stringify(cron);
        if (key !== lastPulseKey) {
          lastPulseKey = key;
          renderPulse(j.pulse, cron);
        }
      }
      if (j?.perms && typeof j.perms.total === 'number') {
        const key = JSON.stringify(j.perms);
        if (key !== lastPermsKey) { lastPermsKey = key; renderPerms(j.perms); }
      }
      if (j?.roles && Array.isArray(j.roles.roles)) {
        const key = JSON.stringify(j.roles);
        if (key !== lastRolesKey) {
          lastRolesKey = key;
          roles.onData(j.roles);
        }
      }
    } catch {
      balanceEl.textContent = '—';
    }
  };
  refresh();
  setInterval(refresh, REFRESH_MS);
  // 锁屏/失焦回前台：立即重同步（轮询被冷冻期间服务端采样照跑，窗口签名比对会走重建分支复位）
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
}
