/**
 * KFM v4 — GSAP Mock（测试用）
 *
 * 模拟 gsap 的核心 API 行为，支持：
 *   - gsap.to/fromTo/set 直接调用（应用层变量立即生效）
 *   - Timeline 顺序操作存储，play() 时按序执行
 *   - tl.call() 在所在位置之后触发（而非注册时立即触发）
 *   - tl.reverse() / reversed() 方向切换
 *   - progress() / isActive() 反映真实状态
 *
 * 与真实 GSAP 的已知差异：
 *   - 不支持真实时间流逝（同步 mock）
 *   - easing 曲线忽略
 *   - seek()/time() 不支持精细跳转
 *   - overwrite 忽略
 */

const noop = () => {};

// ── 基础变量应用 ──

function applyVars(target: any, vars: any) {
  if (target && vars) {
    for (const key of Object.keys(vars)) {
      if (key === 'duration' || key === 'ease' || key === 'overwrite'
          || key === 'onComplete' || key === 'onStart' || key === 'onUpdate') continue;
      target[key] = vars[key];
    }
  }
}

function fireCallback(vars: any, callbackName: string) {
  if (vars && typeof vars[callbackName] === 'function') {
    vars[callbackName]();
  }
}

// ── Timeline ──

function mockTl(vars?: any) {
  const ops: Array<{ type: string; target?: any; vars?: any; from?: any; fn?: Function }> = [];
  let _reversed = false;
  let _progress = 0;
  let _active = false;

  function processOps() {
    if (_active) return; // 防止重入
    _active = true;
    _progress = 0;

    const seq = _reversed ? [...ops].reverse() : ops;
    for (const op of seq) {
      switch (op.type) {
        case 'set':
          applyVars(op.target, op.vars);
          break;
        case 'to':
          applyVars(op.target, op.vars);
          fireCallback(op.vars, 'onComplete');
          break;
        case 'fromTo':
          if (op.from) applyVars(op.target, op.from);
          if (op.vars) applyVars(op.target, op.vars);
          fireCallback(op.vars, 'onComplete');
          break;
        case 'call':
          if (op.fn) op.fn();
          break;
      }
    }

    _progress = 1;
    _active = false;

    // 触发 timeline 自身的 onComplete
    fireCallback(vars, 'onComplete');
  }

  const tl: any = {
    to(target: any, tweenVars: any) {
      ops.push({ type: 'to', target, vars: tweenVars });
      return tl;
    },
    fromTo(target: any, fromVars: any, toVars: any) {
      ops.push({ type: 'fromTo', target, from: fromVars, vars: toVars });
      return tl;
    },
    set(target: any, setVars: any) {
      ops.push({ type: 'set', target, vars: setVars });
      return tl;
    },
    call(fn: Function) {
      ops.push({ type: 'call', fn });
      return tl;
    },
    add(child: any) {
      // 合并子 timeline 的 ops
      if (child && child._ops) {
        ops.push(...child._ops);
      }
      return tl;
    },

    // 控制
    play() { processOps(); return tl; },
    pause() { _active = false; },
    clear() { ops.length = 0; return tl; },
    kill() { ops.length = 0; return tl; },

    // 方向
    reverse() { _reversed = !_reversed; },
    reversed(val?: boolean) {
      if (val !== undefined) _reversed = val;
      return _reversed;
    },

    // 状态查询
    progress(val?: number) {
      if (val !== undefined) _progress = val;
      return _progress;
    },
    duration() {
      return ops.reduce((sum, op) => sum + (op.vars?.duration || 0), 0);
    },
    isActive() { return _active; },

    // 内部导出（供 parent timeline add 用）
    _ops: ops,

    // seek/time（简化：处理到指定位置）
    time: noop,
    seek: noop,
  };

  // 模拟 GSAP 的自动播放：注册完返回主线程后执行
  if (vars?.paused !== true) {
    queueMicrotask(() => processOps());
  }

  return tl;
}

// ── gsap 对象 ──

const gsap: any = {
  to: (target: any, vars: any) => {
    applyVars(target, vars);
    fireCallback(vars, 'onComplete');
    return { kill: noop };
  },
  fromTo: (target: any, from: any, to: any) => {
    if (from) applyVars(target, from);
    if (to) applyVars(target, to);
    fireCallback(to, 'onComplete');
    return { kill: noop };
  },
  set: (target: any, vars: any) => {
    applyVars(target, vars);
    return { kill: noop };
  },
  timeline: (vars?: any) => mockTl(vars),
  killTweensOf: noop,
  globalTimeline: mockTl(),
  registerPlugin: noop,
  core: { Timeline: function(vars?: any) { return mockTl(vars); } },
};

export default gsap;
export { gsap };
