/**
 * obs-hud.ts — 观测台 HUD（8.5 史官制度 · L1 中央内容层，2026-08-05 立项）
 *
 * 背景信息窗：主卡（deepseek 余额）+ 双信息框（信箱=语义巡逻 verdict 时间线 /
 * 待办=stack.yaml 工作栈全状态渲染，2026-08-06 用户拍板：状态=字段非散文标记）
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
interface SysData { metrics: SysMetric[]; history: SysHistory; ports: SysPort[]; cron: SysCron[] }

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
          <span class="obs-inbox-title">信箱</span>
          <span class="obs-inbox-status"></span>
        </div>
        <div class="obs-inbox-list"></div>
      </div>
      <div class="obs-stack">
        <div class="obs-inbox-head">
          <span class="obs-inbox-title">待办</span>
          <span class="obs-stack-status"></span>
        </div>
        <div class="obs-stack-list"></div>
      </div>
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
  const placeRail = () => {
    const r = hud.querySelector<HTMLElement>('.obs-inbox')!.getBoundingClientRect();
    rail.style.left = `${r.left}px`;
    rail.style.top = `${r.bottom + 10}px`;
  };
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
  }, 5_000);

  const clockEl = hud.querySelector<HTMLElement>('.obs-clock')!;
  const balanceEl = hud.querySelector<HTMLElement>('.obs-balance')!;
  const inboxListEl = hud.querySelector<HTMLElement>('.obs-inbox-list')!;
  const inboxStatusEl = hud.querySelector<HTMLElement>('.obs-inbox-status')!;
  const stackListEl = hud.querySelector<HTMLElement>('.obs-stack-list')!;
  const stackStatusEl = hud.querySelector<HTMLElement>('.obs-stack-status')!;

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

  // 详情视图：头部显示日期；滚动框内左上角返回按钮 + 类型徽标，下接完整原文
  function renderInboxDetail(): void {
    if (!inboxDetail) return;
    const dot = INBOX_DOT_CLASS[inboxDetail.type] ?? 'obs-dot-other';
    const mark = INBOX_MARK[inboxDetail.type] ?? '·';
    const label = INBOX_LABEL[inboxDetail.type] ?? inboxDetail.type;
    inboxStatusEl.textContent = inboxDetail.date + (inboxDetail.time ? ' ' + inboxDetail.time : '');
    inboxListEl.innerHTML = `
      <div class="obs-inbox-detail">
        <div class="obs-inbox-detail-top"><button class="obs-inbox-back">‹</button><span class="obs-dot ${dot}"></span><span class="obs-inbox-detail-meta">${mark} ${label}</span></div>
        <div class="obs-inbox-detail-text">${inboxDetail.text}</div>
      </div>`;
  }

  function showInboxDetail(i: number): void {
    const e = inboxEntries[i];
    if (!e) return;
    inboxDetail = e;
    renderInboxDetail();
  }
  function showInboxList(): void {
    inboxDetail = null;
    renderInboxList();
  }

  // 点击条目 → 详情；详情内返回按钮 → 列表（事件委托，滚动区已局部 pointer-events auto）
  inboxListEl.addEventListener('click', e => {
    const target = e.target as HTMLElement;
    if (target.closest('.obs-inbox-back')) { showInboxList(); return; }
    if (inboxDetail) return;
    const item = target.closest<HTMLElement>('.obs-inbox-item');
    if (item) {
      const i = Number(item.dataset.i);
      if (Number.isInteger(i)) showInboxDetail(i);
    }
  });

  // 渲染待办列表（todo/hold 全亮在前，done 渐淡殿后，分组计数；条目 = 状态点+#编号+标题
  // （独立 clamp 2）+ note 次行（独立单行截断）——标题与 note 同层共用一个 clamp 时，
  // 标题占满两行会顶掉 note 并白挂省略号（2026-08-06 用户实拍反馈）
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

  // 待办详情：头部显示编号；滚动框内左上角返回按钮 + 状态 chip，下接标题/日期/note/detail 全文
  function renderStackDetail(): void {
    if (!stackDetail) return;
    const label = STACK_LABEL[stackDetail.status] ?? stackDetail.status;
    // 服务端 detail 首行 = title（详情锚），此处单独渲染标题后剥掉首行防重复
    const body = stackDetail.detail.split('\n').slice(1).join('\n').trim();
    stackStatusEl.textContent = `#${stackDetail.n}`;
    stackListEl.innerHTML = `
      <div class="obs-inbox-detail">
        <div class="obs-inbox-detail-top"><button class="obs-inbox-back obs-stack-back">‹</button><span class="obs-stack-chip obs-stack-chip-${stackDetail.status}">${label}</span></div>
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
    renderStackDetail();
  }
  function showStackList(): void {
    stackDetail = null;
    renderStackList();
  }

  stackListEl.addEventListener('click', e => {
    const target = e.target as HTMLElement;
    if (target.closest('.obs-stack-back')) { showStackList(); return; }
    if (stackDetail) return;
    const item = target.closest<HTMLElement>('.obs-inbox-item');
    if (item) {
      const i = Number(item.dataset.i);
      if (Number.isInteger(i)) showStackDetail(i);
    }
  });

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
  let lastBarLen = -1;
  let lastBarSig = '';
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
        if (take.length > BAR_SHOW) track.style.transform = `translateX(-${BAR_STEP}px)`;
        rec = { row: wrap.querySelector<HTMLElement>('.obs-sys-row')!, track };
        metricRecs.set(key, rec);
      }
      rec.row.innerHTML = `<span class="obs-sys-label">${m.label}</span><span class="obs-rail-num${metricCls(m.pct)}">${m.value}</span><span class="obs-sys-pair">${m.pair ?? ''}</span>`;
    });
    // 新样本判定：四列同拍，缓冲未满看长度，满后看四列尾值联合签名；四列全同值连拍漏一拍，无新信息不滑
    const len = hists[0].length;
    const sig = hists.map(h => h[h.length - 1]).join('|');
    if (len > 0 && (len !== lastBarLen || sig !== lastBarSig)) {
      lastBarLen = len;
      lastBarSig = sig;
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
    }
    railPortsEl.innerHTML = sys.ports.map(p =>
      `<div class="obs-port-row"><span class="obs-port-dot obs-port-dot-${p.scope}" style="${pulseStyle(String(p.port))}"></span><span class="obs-port-num">${p.port}</span><span class="obs-port-name">${p.name}</span><span class="obs-port-conns">${(p.conns ?? 0) > 0 ? '×' + p.conns : ''}</span></div>`
    ).join('');
    sizePorts(); // 端口窗口钉死 4 行高（行数变化后重测）
  }

  // 余额 + 信箱 + 待办 + SYS 刷新（5s 轮询；服务端缓存外部 deepseek 调用）
  // 数据未变不重渲染——innerHTML 重建会重置滚动位置，5s 一次等于禁止翻列表
  let lastTotal = '';
  let lastInboxKey = '';
  let lastStackKey = '';
  let lastSysKey = '';
  const refresh = async () => {
    try {
      const res = await fetch(`${API}/obs/hud`, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json() as { balance?: { total?: string; error?: string }; inbox?: InboxEntry[]; stack?: StackData; sys?: SysData };
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
    } catch {
      balanceEl.textContent = '—';
    }
  };
  refresh();
  setInterval(refresh, REFRESH_MS);
}
