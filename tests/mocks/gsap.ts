/**
 * KFM v4 — GSAP Mock（测试用）
 *
 * 模拟 gsap 的核心 API，支持时间位置驱动的时序模型。
 *
 * 与真实 GSAP 的差异：
 *   - 同步执行（无真实时间流逝），progress() 是跳转而非播放
 *   - easing 曲线忽略
 *   - seek()/time() 不支持精细跳转
 *   - overwrite 忽略
 */

// ========== 类型定义 ==========

/** tween/to 方法的参数：可以是任意数字属性 + GSAP 回调 */
interface TweenVars extends Record<string, unknown> {
  duration?: number;
  onComplete?: () => void;
  onReverseComplete?: () => void;
  ease?: string;
  paused?: boolean;
}

/** Timeline 构造参数 */
interface TimelineVars {
  paused?: boolean;
  onComplete?: () => void;
}

/** 时间线内部事件 */
interface TimelineEvent {
  type: 'to' | 'fromTo' | 'set' | 'call';
  target?: Record<string, unknown>;
  vars?: TweenVars;
  from?: Record<string, unknown>;
  fn?: () => void;
  startPos: number;   // 从时间线起点计算的毫秒位置
  duration: number;   // 持续时间（call/set 为 0）
  _completed?: boolean;  // 是否已执行到终态
}

/** Mock 时间线接口（GSAP Timeline 的子集） */
interface TimelineMock {
  to(target: Record<string, unknown>, vars: TweenVars): TimelineMock;
  fromTo(target: Record<string, unknown>, fromVars: TweenVars, toVars: TweenVars): TimelineMock;
  set(target: Record<string, unknown>, vars: TweenVars): TimelineMock;
  call(fn: () => void): TimelineMock;
  add(child: TimelineMock): TimelineMock;
  play(): void;
  pause(): void;
  clear(): TimelineMock;
  kill(): TimelineMock;
  reverse(): void;
  reversed(val?: boolean): boolean;
  progress(val?: number): number;
  duration(): number;
  isActive(): boolean;
  /** 内部 ops 导出，供 parent timeline add 用 */
  _ops: TimelineEvent[];
}

/** GSAP 对象接口（只模拟测试使用的子集） */
interface GsapObject {
  to(target: Record<string, unknown>, vars: TweenVars): { kill: () => void };
  fromTo(target: Record<string, unknown>, fromVars: TweenVars, toVars: TweenVars): { kill: () => void };
  set(target: Record<string, unknown>, vars: TweenVars): { kill: () => void };
  timeline(vars?: TimelineVars): TimelineMock;
  killTweensOf(_target: Record<string, unknown>): void;
}
// ========== 工具函数 ==========

const noop = (): void => {};

/** 将 tween vars 的属性应用到目标对象 */
function applyVars(target: Record<string, unknown> | undefined, vars: TweenVars | undefined): void {
  if (!target || !vars) return;
  for (const key of Object.keys(vars)) {
    if (key === 'duration' || key === 'onComplete' || key === 'onReverseComplete' || key === 'ease' || key === 'paused') continue;
    target[key] = vars[key];
  }
}

/** 触发 vars 中的指定回调 */
function fireCallback(vars: TweenVars | undefined | TimelineVars, name: string): void {
  if (!vars) return;
  const cb = (vars as Record<string, unknown>)[name];
  if (typeof cb === 'function') (cb as () => void)();
}

// ========== Timeline ==========

function mockTl(vars?: TimelineVars): TimelineMock {
  const events: TimelineEvent[] = [];
  let _timePos = 0;          // 当前时间位置（毫秒）
  let _totalDur = 0;         // 总时长（ms）
  let _reversed = false;
  let _active = false;

  /** 计算所有事件的总时长 */
  function calcTotalDuration(): number {
    return events.length > 0
      ? events[events.length - 1].startPos + events[events.length - 1].duration
      : 0;
  }

  /** 按时间位置执行事件：从当前位置走到目标位置 */
  function advanceTo(targetPos: number): void {
    if (_active) return;
    if (_timePos === targetPos && _timePos > 0) return;
    _active = true;

    // 全零时长（所有事件 duration=0）：直接全部同步执行
    if (_totalDur === 0 && events.length > 0) {
      const seq = _reversed ? [...events].reverse() : events;
      for (const ev of seq) {
        if (ev._completed) continue;
        ev._completed = true;
        switch (ev.type) {
          case 'set': applyVars(ev.target, ev.vars); break;
          case 'to':
          case 'fromTo':
            applyVars(ev.target, ev.vars);
            fireCallback(ev.vars, 'onComplete');
            break;
          case 'call': if (ev.fn) ev.fn(); break;
        }
      }
      _timePos = targetPos;
      _active = false;
      fireCallback(vars, 'onComplete');
      return;
    }

    // 空时间线：play() 立即完成
    if (events.length === 0) {
      _timePos = 1; // 标记已完成，使 progress() 返回 1
      _active = false;
      fireCallback(vars, 'onComplete');
      return;
    }
    const direction = targetPos >= _timePos ? 1 : -1;

    // 按方向排序事件
    const sorted = [...events].sort((a, b) => direction > 0 ? a.startPos - b.startPos : b.startPos - a.startPos);

    for (const ev of sorted) {
      const evEnd = ev.startPos + ev.duration;

      if (direction > 0) {
        // 正向播放
        if (ev._completed) continue;
        if (ev.startPos > targetPos) continue;
        switch (ev.type) {
          case 'set': applyVars(ev.target, ev.vars); ev._completed = true; break;
          case 'to':
          case 'fromTo':
            applyVars(ev.target, ev.vars);
            if (targetPos >= evEnd) { ev._completed = true; fireCallback(ev.vars, 'onComplete'); }
            break;
          case 'call': if (ev.fn) ev.fn(); ev._completed = true; break;
        }
      } else {
        if (!ev._completed) continue;
        if (ev.startPos < targetPos) continue;
        ev._completed = false;
        if (ev.type === 'to' || ev.type === 'fromTo') fireCallback(ev.vars, 'onReverseComplete');
      }
    }

    _timePos = targetPos;
    _active = false;

    if (direction > 0 && _timePos >= _totalDur) {
      fireCallback(vars, 'onComplete');
    } else if (direction < 0 && _timePos <= 0) {
      fireCallback(vars, 'onReverseComplete');
    }
  }

  const tl: TimelineMock = {
    to(target: Record<string, unknown>, tweenVars: TweenVars): TimelineMock {
      const dur = tweenVars.duration ?? 0;
      const startPos = _totalDur;
      events.push({ type: 'to', target, vars: tweenVars, startPos, duration: dur });
      _totalDur = calcTotalDuration();
      return tl;
    },
    fromTo(target: Record<string, unknown>, fromVars: TweenVars, toVars: TweenVars): TimelineMock {
      const dur = toVars.duration ?? 0;
      const startPos = _totalDur;
      applyVars(target, fromVars);
      events.push({ type: 'fromTo', target, from: fromVars, vars: toVars, startPos, duration: dur });
      _totalDur = calcTotalDuration();
      return tl;
    },
    set(target: Record<string, unknown>, setVars: TweenVars): TimelineMock {
      const startPos = _totalDur;
      events.push({ type: 'set', target, vars: setVars, startPos, duration: 0 });
      return tl;
    },
    call(fn: () => void): TimelineMock {
      const startPos = _totalDur;
      events.push({ type: 'call', fn, startPos, duration: 0 });
      return tl;
    },
    add(child: TimelineMock): TimelineMock {
      // 合并子 timeline 的 events，偏移到当前总时长
      for (const ev of child._ops) {
        events.push({ ...ev, startPos: ev.startPos + _totalDur });
      }
      _totalDur = calcTotalDuration();
      return tl;
    },

    // 控制
    play(): void {
      advanceTo(_totalDur);
    },
    pause(): void {
      _active = false;
    },
    clear(): TimelineMock {
      events.length = 0;
      _timePos = 0;
      _totalDur = 0;
      return tl;
    },
    kill(): TimelineMock {
      events.length = 0;
      _timePos = 0;
      _totalDur = 0;
      return tl;
    },

    // 方向
    reverse(): void {
      _reversed = !_reversed;
      advanceTo(0);
    },
    reversed(val?: boolean): boolean {
      if (val !== undefined) _reversed = val;
      return _reversed;
    },

    // 状态查询
    progress(val?: number): number {
      if (val !== undefined) {
        const targetPos = val * _totalDur;
        advanceTo(targetPos);
      }
      // 空时间线或全零时长
      if (_totalDur === 0) {
        if (events.some(e => e._completed)) return 1;
        if (events.length === 0 && _timePos > 0) return 1;
        return 0;
      }
      return _totalDur;
    },
    isActive(): boolean {
      return _active;
    },

    _ops: events,

    // seek/time — 简化实现
    time: noop,
    seek: noop,
  };

  // 模拟 GSAP 的自动播放：使用微任务延迟执行，让调用方有机会先注册事件
  if (!vars?.paused) {
    queueMicrotask(() => advanceTo(_totalDur));
  }

  return tl;
}
/** 独立的 gsap.to/fromTo/set（非 timeline 版本）：立即应用到目标 */
function standaloneTo(target: Record<string, unknown>, vars: TweenVars): { kill: () => void } {
  applyVars(target, vars);
  if (vars.duration === 0 || vars.duration === undefined) {
    fireCallback(vars, 'onComplete');
  }
  return { kill: noop };
}

const gsap: GsapObject = {
  to: standaloneTo,
  fromTo(target: Record<string, unknown>, fromVars: TweenVars, toVars: TweenVars): { kill: () => void } {
    applyVars(target, fromVars);
    applyVars(target, toVars);
    if (toVars.duration === 0 || toVars.duration === undefined) {
      fireCallback(toVars, 'onComplete');
    }
    return { kill: noop };
  },
  set(target: Record<string, unknown>, vars: TweenVars): { kill: () => void } {
    applyVars(target, vars);
    return { kill: noop };
  },
  timeline: mockTl,
  killTweensOf(_target: Record<string, unknown>): void {
    // mock 中不做任何事
  },
};
export default gsap;
export { gsap };
