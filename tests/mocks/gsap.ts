const noop = () => {};
function mockTl() {
  const tl: any = {
    to: () => tl, fromTo: () => tl, set: () => tl,
    call: (cb: Function) => { cb(); return tl; }, add: () => tl,
    clear: noop, kill: noop, time: noop, reverse: noop, seek: noop,
    progress: () => 0, duration: () => 0, isActive: () => false,
  };
  return tl;
}
// Apply vars to target (for set/to/fromTo)
function applyVars(target: any, vars: any) {
  if (target && vars) {
    for (const key of Object.keys(vars)) {
      if (key === 'duration' || key === 'ease' || key === 'overwrite') continue;
      target[key] = vars[key];
    }
  }
}
const gsap: any = {
  to: (target: any, vars: any) => { applyVars(target, vars); return { kill: noop }; },
  fromTo: (target: any, from: any, to: any) => { applyVars(target, to); return { kill: noop }; },
  set: (target: any, vars: any) => { applyVars(target, vars); return { kill: noop }; },
  timeline: () => mockTl(), killTweensOf: noop,
  globalTimeline: mockTl(), registerPlugin: noop,
  core: { Timeline: function() { return mockTl(); } },
};
export default gsap;
export { gsap };
