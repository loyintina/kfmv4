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
const gsap: any = {
  to: () => ({ kill: noop }), fromTo: () => ({ kill: noop }), set: () => ({ kill: noop }),
  timeline: () => mockTl(), killTweensOf: noop,
  globalTimeline: mockTl(), registerPlugin: noop,
  core: { Timeline: function() { return mockTl(); } },
};
export default gsap;
export { gsap };
