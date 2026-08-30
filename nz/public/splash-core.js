/* ============================================================================
 * 深蓝意志开屏核心 v15 —— 动画唯一真源（demo 页与正式覆层共用本文件）。
 *
 * 覆盖纪律（2026-08-30 用户拍板「未来改这个可以直接覆盖」）：
 *   本文件是唯一真源 + 服务器对 splash-core.js 单独 no-cache——
 *   替换本文件后刷新即新版，不需要重打包 bundle.js。
 *
 * API：
 *   window.NzSplashCore.create(refs) -> handle
 *   refs   = { splash, art, beamO, beamO2, beamI }（DOM 元素，id 不约定）
 *   handle = { show(opts), hide(), complete(), render(t), isRunning(), VERSION }
 *     show(opts)  唤醒（幂等重入：重置时钟从头播）。
 *                 opts.introMs = 预测的终端就绪时长——编排骨架等比缩放，
 *                 三条扫线正好在 introMs 扫完（v15 开机自播，用户拍板
 *                 「开机动画结束时三线正好扫完，按时间重新定线速」）。
 *     hide()      淡出关闭
 *     complete()  终端首帧就绪收口：没扫完=时间平移直接跳到扫完帧，
 *                 定帧 SETTLE 后自动淡出；已扫完=短停留后淡出（v15）
 *     render(t)   冻结帧渲染绝对毫秒 t（含 1s 延迟；自验收/截图用；
 *                 恒用基准速度，不受 show(opts) 缩放影响）
 *
 * 编排骨架（v9c 起纪律：编排点钉光束位置按几何反解，不钉屏幕出现时机）：
 *   黑场 1s → 双蓝同底升起（快蓝开外环、慢蓝在后）→ 快蓝过瞳孔行时点出
 *   紫线从顶压下开内环（中央留黑洞）→ 慢蓝与紫线在瞳孔行精确会师，
 *   孤瞳点火 → 三线出屏，进入永久活跃动画（HSL 色带绕环自转形状不转 +
 *   双环反向变速亮波 + 孤瞳脉冲）。不循环，刷新重播。
 * 演化史与拍板记录见 splash-demo.html 头注与 TASK 2026-08-30 条目。
 * ========================================================================== */
window.NzSplashCore = (function () {
  var VERSION = 'v15';

  // 覆层 CSS（唯一真源：demo 与正式覆层都吃这份；z-index 400 压 Cordis
  // 层根 overlay 300——v8 port 实测 300 被压漏出底部按键栏/终端）
  var CSS =
    '#nz-splash{position:fixed;inset:0;background:#05070f;display:none;' +
    'align-items:center;justify-content:center;transition:opacity .3s ease;' +
    'cursor:pointer;z-index:400}' +
    '#nz-splash.on{display:flex}' +
    '#nz-splash.out{opacity:0;pointer-events:none}' +
    '#nz-splash pre{margin:0;font-family:monospace;font-size:18px;' +
    'line-height:20px;white-space:pre;user-select:none;text-align:center}' +
    '#nz-splash .st-cyan{color:#56b6f0;animation:nzPulse 1.6s ease-in-out infinite}' +
    '@keyframes nzPulse{0%,100%{opacity:1}50%{opacity:.45}}' +
    '#nz-splash .beam{position:absolute;left:0;right:0;height:2px;opacity:0;' +
    'pointer-events:none;will-change:top,opacity}' +
    '#nz-splash .beam-outer{background:#60a5fa;' +
    'box-shadow:0 0 12px 3px rgba(59,130,246,.8),0 0 42px 10px rgba(59,130,246,.32)}' +
    '#nz-splash .beam-inner{background:#a78bfa;' +
    'box-shadow:0 0 12px 3px rgba(139,92,246,.8),0 0 42px 10px rgba(139,92,246,.32)}';

  function create(refs) {
    var splash = refs.splash, pre = refs.art;
    var beamO = refs.beamO, beamO2 = refs.beamO2, beamI = refs.beamI;

    var TICK = 42;
    var T0 = 1000;      // v14f：刷新后整体延迟 1s 再动线（治半空出现观感）
    // v15：T_OUT/T_IN 从常量变实例变量——show({introMs}) 时等比缩放，
    // 编排骨架（inStart/purpleIn/pupilHi/blue2V…全从这两个值几何反解）
    // 随之整体伸缩，三线会师/孤瞳点火的相对关系不变。
    var BASE_T_OUT = 2000, BASE_T_IN = 2000;
    var T_OUT = BASE_T_OUT;   // 蓝光束扫全程（屏底缘→屏顶缘）
    var T_IN = BASE_T_IN;     // 紫光束扫全程（屏顶缘→屏底缘）
    var SCAN_W = 1.5;                // 扫线冲顶亮斑半宽（行）
    var AHEAD_W = 0.6, AHEAD_MAX = 0.22; // 迎头微晕
    var REVEAL = 2;                  // 探照灯半径（行）
    var GHOST_L = 0.24;              // 幽影峰值 L
    var L_BLACK = 0.04;
    var FLOW_AMP = 0.22;             // 亮波振幅（相对）
    var L_CAP = 0.85;                // v14d 压白天花板

    // ---- 定种子随机（mulberry32：重绘不跳变，乱而确定）----
    var seed = 20260829 >>> 0;
    function R() {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    var GLYPHS = ['█', '█', '█', '█', '▉', '▉', '▊', '▊', '▋', '▌', '▍'];
    var GLYPH_W = { '█': 1, '▉': 0.875, '▊': 0.75, '▋': 0.625, '▌': 0.5, '▍': 0.375 };
    function pickGlyph() { return GLYPHS[Math.floor(R() * GLYPHS.length)]; }

    // ---- 竖长网格：19×27，瞳心居中 ----
    var EW = 19, EH = 27, ECX = 9, ECY = 13;
    var emblem = [];
    for (var ey0 = 0; ey0 < EH; ey0++) emblem.push(new Array(EW).fill(null));
    // 硬隔离（v4 拍板）：任何块不得与异色块 8-邻接——紫蓝永不相触
    function touchesOtherZone(x, y, zone) {
      for (var dy = -1; dy <= 1; dy++) {
        for (var dx = -1; dx <= 1; dx++) {
          var n = emblem[y + dy] && emblem[y + dy][x + dx];
          if (n && n.zone !== zone) return true;
        }
      }
      return false;
    }

    // ---- 环 = 槽位序列（色带自转的基础）----
    // 槽位=环上几何位置（x/y/fx 理想缘位），沿环周有序：顶尖→右缘下行→
    // 底尖→左缘上行。形状钉槽位、颜色沿槽位移位=色带转而形状不转。
    // 每行每侧至多一块、无缺行无卫星（v8 纪律）。
    function buildRing(cx, cy, rx, ry, zone) {
      var slots = [];
      function trySlot(fx, y) {
        var x = Math.round(fx);
        if (x < 0 || x >= EW || y < 0 || y >= EH) return;
        if (emblem[y][x]) return;
        if (touchesOtherZone(x, y, zone)) return;
        emblem[y][x] = { zone: zone, slot: slots.length };
        slots.push({ x: x, y: y, fx: fx });
      }
      trySlot(cx, cy - ry);                           // 顶尖
      for (var dy = -ry + 1; dy <= ry; dy++) {        // 右缘（含底尖）
        trySlot(cx + rx * (1 - Math.abs(dy) / ry), cy + dy);
      }
      for (var dy2 = ry - 1; dy2 >= -ry + 1; dy2--) { // 左缘
        trySlot(cx - rx * (1 - Math.abs(dy2) / ry), cy + dy2);
      }
      return slots;
    }

    // 孤瞳：单一块（中央眼睛只一个方块，v4 拍板）
    emblem[ECY][ECX] = { zone: 'pupil' };

    var slotsIn = buildRing(ECX, ECY, 3, 7, 'inner');
    var slotsOut = buildRing(ECX, ECY, 8, 13, 'outer');

    // ---- 块参数（v14b：形状/颜色两层分离，用户拍板）----
    // 色相收敛蓝紫/青紫主题（v14c 两轮收窄）：外环 210→196° 青蓝微渐变，
    // 内环 262→278° 紫罗兰微渐变，各 ±4° 抖动；冷侧中低饱和、暖侧高饱和；
    // 亮度层级 孤瞳 > 外环 > 内环（只钉均值，个体允许交叉）。
    function buildShapes(n, lLo, lHi) {
      var bs = [];
      for (var i = 0; i < n; i++) {
        var glyph = pickGlyph();
        bs.push({ glyph: glyph, w: GLYPH_W[glyph], L: lLo + R() * (lHi - lLo) });
      }
      return bs;
    }
    function buildColors(n, h0, h1, sLo, sHi) {
      var cs = [];
      for (var i = 0; i < n; i++) {
        var u = i / n;
        cs.push({ H: h0 + (h1 - h0) * u + (R() * 8 - 4),
                  S: sLo + R() * (sHi - sLo) });
      }
      return cs;
    }
    var shapesOut = buildShapes(slotsOut.length, 0.42, 0.68);
    var colorsOut = buildColors(slotsOut.length, 210, 196, 45, 65);  // 青蓝，冷
    var shapesIn = buildShapes(slotsIn.length, 0.30, 0.50);
    var colorsIn = buildColors(slotsIn.length, 262, 278, 75, 95);    // 紫罗兰，暖
    var PUPIL = { H: 210, S: 55 };

    function hsl(h, s, l) {
      h = ((h % 360) + 360) % 360;
      return 'hsl(' + Math.round(h) + ',' + Math.round(s) + '%,' +
             (Math.round(l * 1000) / 10) + '%)';
    }

    // ---- v9f 同步修复：先换 27×19 真空格网格再让 geom() 量 pre（勿回退）----
    var primed = false;
    var blankLine = new Array(EW + 1).join(' ');
    function prime() {
      if (primed) return;
      primed = true;
      pre.textContent = new Array(EH).fill(blankLine).join('\n');
      preRect = null;
    }

    // ---- 全屏扫掠几何（v9c 拍板：编排点钉光束位置）----
    var preRect = null;
    addEventListener('resize', function () { preRect = null; });
    function geom() {
      if (!preRect) preRect = pre.getBoundingClientRect();
      var vh = window.innerHeight || preRect.height;
      var sr = vh / (preRect.height / EH);
      return { sr: sr, off: Math.max(0, (sr - EH) / 2) };
    }
    function inStart() { var g = geom(); return T_OUT * (EH + g.off - ECY) / g.sr; }
    function beamV() { var g = geom(); return g.sr / T_IN; }
    function outerYs(ms) { var g = geom(); return (EH + g.off) - (ms / T_OUT) * g.sr; }
    function innerYs(ms) { return (ECY - 7) + (ms - inStart()) * beamV(); }
    function pupilHi() { return inStart() + 7 / beamV(); }
    function purpleIn() { var g = geom(); return inStart() - (ECY - 7 + g.off) / beamV(); }
    function purpleOut() { var g = geom(); return inStart() + (EH + g.off - ECY + 7) / beamV(); }
    function roundEnd() { return purpleOut(); }
    // ---- v14f 蓝2：与蓝1 同底出发、慢速；速度按几何反解=(屏底→瞳孔行)/
    // pupilHi，保证与紫线在瞳孔行精确会师，孤瞳此刻点火（用户拍板）----
    function blue2V() { var g = geom(); return (EH + g.off - ECY) / pupilHi(); }
    function blue2Ys(ms) { var g = geom(); return (EH + g.off) - blue2V() * ms; }
    function blue2Out() { var g = geom(); return (EH + 2 * g.off) / blue2V(); }

    // ---- v14 变速亮波：相位=速度的解析积分（纯函数，冻结帧可复现）----
    // 瞬时速度=w0·(1+a1·sin+a2·sin)，双正弦叠加时快时慢不可预测；
    // 系数和<1 恒正向。外环波逆、内环波顺：双波一顺一逆。
    function makeFlow(w0, a1, p1, w1, a2, p2, w2, dir) {
      return function (ms) {
        var W = ms - a1 / w1 * (Math.cos(w1 * ms + p1) - Math.cos(p1))
                   - a2 / w2 * (Math.cos(w2 * ms + p2) - Math.cos(p2));
        return dir * w0 * W;
      };
    }
    var flowOut = makeFlow(2 * Math.PI / 1400, 0.55, 1.3, 2 * Math.PI / 660,
                           0.35, 4.1, 2 * Math.PI / 1090, -1);
    var flowIn = makeFlow(2 * Math.PI / 950, 0.50, 2.6, 2 * Math.PI / 720,
                          0.38, 0.7, 2 * Math.PI / 1230, +1);
    var K_OUT = 2, K_IN = 3;

    // ---- v14 色带自转：roundEnd 后缓入启动（扫描期静止，否则探照灯
    // 对不上）；外环顺(+) 内环逆(−)，各与自身亮波反向（用户拍板）----
    function rotOff(ms, v) {
      var tau = ms - roundEnd();
      if (tau <= 0) return 0;
      var Tr = 250;
      return v * (tau - Tr * (1 - Math.exp(-tau / Tr)));
    }

    // ---- 单元状态 ----
    function ghostL(d) {
      // 只在线前方 ≤REVEAL 行显形；d>0（线已过）绝不显形——v14e 孤瞳
      // 全时段调用暴露此洞：线过后 1+d/REVEAL>1 反而更亮（0.60 杂块）
      if (d < -REVEAL || d > 0) return { visible: false, scanned: false, L: 0 };
      return { visible: true, scanned: false, L: GHOST_L * (1 + d / REVEAL) };
    }
    function scanL(d, prog, baseL) {
      if (prog >= 1) return { visible: true, scanned: true, L: baseL, flow: true };
      if (d > SCAN_W) return { visible: true, scanned: true, L: baseL, flow: true };
      if (d >= 0) return { visible: true, scanned: true,
        L: baseL + (L_CAP - baseL) * (1 - d / SCAN_W) };              // 冲顶
      if (d > -AHEAD_W) return { visible: true, scanned: false,
        L: L_BLACK + (AHEAD_MAX - L_BLACK) * (1 + d / AHEAD_W) };     // 迎头微晕
      return { visible: false, scanned: false, L: 0 };
    }

    function setBeam(el, ys) {
      if (ys === null) { el.style.opacity = '0'; return; }
      el.style.opacity = '1';
      el.style.top = (preRect.top + (ys + 0.5) * (preRect.height / EH) - 1) + 'px';
    }

    function frame(ms) {
      // 不取模不循环——扫描放一遍后永久停在活跃动画，刷新重播（v14b 拍板）
      var rOut = Math.round(rotOff(ms, 1 / 180));    // 外环色带自转（槽位步，顺）
      var rIn = Math.round(rotOff(ms, -1 / 230));    // 内环色带自转（逆）
      var lines = [];
      for (var y = 0; y < EH; y++) {
        var html = '', run = '';
        function flush() { if (run) { html += run; run = ''; } }
        for (var x = 0; x < EW; x++) {
          var cell = emblem[y][x];
          if (!cell) { run += ' '; continue; }
          var span = null;
          if (cell.zone === 'pupil') {
            var st;
            if (ms < pupilHi()) {
              // v14e：点火前中央无亮点——只在蓝1/蓝2 贴近时有幽影，否则黑洞
              var g1 = ghostL(y - outerYs(ms));
              var g2 = (ms >= 0) ? ghostL(y - blue2Ys(ms)) : { visible: false, L: 0 };
              st = g1.visible ? g1 : g2;
            } else {
              // 双线会师点火：300ms 内从 L_CAP 缓入常规脉冲 0.62–0.82
              var pulse = 0.72 + 0.10 * Math.sin(2 * Math.PI * ms / 1600);
              var dtp = ms - pupilHi();
              st = { visible: true, scanned: true,
                     L: dtp < 300 ? L_CAP + (pulse - L_CAP) * (dtp / 300) : pulse };
            }
            if (st.visible) {
              span = '<span style="color:' + hsl(PUPIL.H, PUPIL.S, st.L) + '">█</span>';
            }
          } else {
            var isOut = cell.zone === 'outer';
            var slots = isOut ? slotsOut : slotsIn;
            var shapes = isOut ? shapesOut : shapesIn;
            var colors = isOut ? colorsOut : colorsIn;
            var n = slots.length, j = cell.slot;
            var sh = shapes[j];                       // 形状钉槽位
            var co = colors[((j - (isOut ? rOut : rIn)) % n + n) % n]; // 颜色绕环转
            var st2;
            if (isOut) {
              var ys = outerYs(ms), prog = ms / T_OUT, d = y - ys;
              st2 = (prog < 1 && d < 0) ? ghostL(d) : scanL(d, prog, sh.L);
            } else {
              var yi = innerYs(ms), progi = (yi - (ECY - 7)) / 14, di = yi - y;
              st2 = (progi < 1 && di < 0) ? ghostL(di) : scanL(di, progi, sh.L);
            }
            if (st2.visible) {
              if (!st2.scanned) {
                // 幽影/迎头：标准件 █ 无钉线，本块色相的低亮度暗结构
                span = '<span style="color:' + hsl(co.H, co.S, st2.L) + '">█</span>';
              } else {
                var L = st2.L;
                if (st2.flow) {
                  var psi = (isOut ? K_OUT : K_IN) * (2 * Math.PI * j / n) +
                            (isOut ? flowOut(ms) : flowIn(ms));
                  L = L * (1 + FLOW_AMP * Math.sin(psi));
                  if (L > L_CAP) L = L_CAP;
                }
                // v14e：蓝2 过境在已固化外环上再擦一次冲顶闪光
                if (isOut && ms >= 0 && ms < blue2Out()) {
                  var d2 = y - blue2Ys(ms);
                  if (d2 >= 0 && d2 <= SCAN_W) {
                    var fl = sh.L + (L_CAP - sh.L) * (1 - d2 / SCAN_W);
                    if (fl > L) L = fl;
                  }
                }
                var nudge = (slots[j].fx - slots[j].x) + (1 - sh.w) / 2;
                span = '<span style="color:' + hsl(co.H, co.S, L) +
                       (nudge ? ';position:relative;left:' + nudge.toFixed(2) + 'ch' : '') +
                       '">' + sh.glyph + '</span>';
              }
            }
          }
          if (span) { flush(); html += span; }
          else run += ' ';
        }
        flush();
        lines.push(html);
      }
      pre.innerHTML = lines.join('\n');
      setBeam(beamO, (ms >= 0 && ms < T_OUT) ? outerYs(ms) : null);
      setBeam(beamO2, (ms >= 0 && ms < blue2Out()) ? blue2Ys(ms) : null);
      setBeam(beamI, (ms >= purpleIn() && ms < purpleOut()) ? innerYs(ms) : null);
    }

    // ---- 驱动/生命周期 ----
    // 纪律：任何一帧渲染抛错都不得清屏——停表保留静态兜底帧
    var styled = false;
    function ensureStyle() {
      if (styled) return;
      styled = true;
      var st = document.createElement('style');
      st.textContent = CSS;
      document.head.appendChild(st);
    }
    var t0 = 0, last = 0, dead = false, running = false;
    var SETTLE = 500;       // 扫完定帧：给用户看一眼完整徽标再退场
    var SETTLE_LATE = 300;  // 就绪时早已扫完（预测偏短）：短停留
    var settleTimer = 0, completed = false;
    function tick(now) {
      if (dead || !running) return;
      if (now - last >= TICK) {
        last = now;
        try { frame(now - t0 - T0); } catch (e) { dead = true; return; }
      }
      requestAnimationFrame(tick);
    }
    function show(opts) {
      ensureStyle();
      prime();
      splash.classList.remove('out');
      splash.classList.add('on');
      // v15 时长伸缩：必须在 'on' 之后量——display:none 时 preRect 全是 0，
      // roundEnd() 会算出 Infinity/NaN
      T_OUT = BASE_T_OUT; T_IN = BASE_T_IN;
      var introMs = opts && opts.introMs;
      if (introMs > 0) {
        var base0 = roundEnd();
        if (base0 > 0 && isFinite(base0)) {
          var k = introMs / base0;
          if (k < 0.15) k = 0.15; else if (k > 8) k = 8; // 防离谱预测拉爆编排
          T_OUT = BASE_T_OUT * k; T_IN = BASE_T_IN * k;
        }
      }
      clearTimeout(settleTimer); completed = false;
      t0 = performance.now(); last = 0; dead = false; running = true;
      requestAnimationFrame(tick);
      return running;
    }
    function hide() {
      running = false;
      clearTimeout(settleTimer);
      splash.classList.add('out');
      setTimeout(function () { splash.classList.remove('on'); }, 320);
      return running;
    }
    // v15 首帧收口：预测与实际必有偏差——没扫完=时钟平移到扫完帧
    // （光束灭/徽标完整/活跃动画起点），定帧后自动退场；已扫完=短停留。
    // 幂等；未在播=false。
    function complete() {
      if (completed || !running) return false;
      completed = true;
      var ms = performance.now() - t0 - T0;
      var late = ms >= roundEnd();
      if (!late) t0 -= (roundEnd() - ms);
      settleTimer = setTimeout(hide, late ? SETTLE_LATE : SETTLE);
      return true;
    }
    splash.addEventListener('click', hide);

    return {
      VERSION: VERSION,
      show: show,
      hide: hide,
      complete: complete,
      isRunning: function () { return running; },
      // 冻结帧：渲染绝对毫秒 t（含 1s 延迟；自验收/截图用；恒用基准速度）
      render: function (t) {
        ensureStyle(); prime();
        T_OUT = BASE_T_OUT; T_IN = BASE_T_IN;
        frame(t - T0);
      },
    };
  }

  return { VERSION: VERSION, create: create };
})();
