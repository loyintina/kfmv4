// Minimal preload for browser globals
const _store = {};
globalThis.localStorage = {
  getItem: (k) => _store[k] ?? null,
  setItem: (k, v) => { _store[k] = v; },
  removeItem: (k) => { delete _store[k]; },
  clear: () => { for (const k of Object.keys(_store)) delete _store[k]; },
  get length() { return Object.keys(_store).length; },
  key: (i) => Object.keys(_store)[i] ?? null,
};

globalThis.document = {
  getElementById: () => null,
  createElement: (tag) => ({
    tagName: tag.toUpperCase(), id: '', style: {},
    classList: { add: () => {}, remove: () => {} },
    getContext: () => null,
    getBoundingClientRect: () => ({ width: 295, height: 618, left: 0, top: 0 }),
    addEventListener: () => {}, removeEventListener: () => {},
    appendChild: () => {}, setAttribute: () => {}, getAttribute: () => null,
    clientWidth: 295, clientHeight: 618, scrollTop: 0, scrollLeft: 0,
  }),
  body: { appendChild: () => {}, removeChild: () => {}, style: {} },
  addEventListener: () => {}, querySelector: () => null,
};
globalThis.window = globalThis;
globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 16);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
globalThis.devicePixelRatio = 2;
if (!globalThis.performance) { globalThis.performance = { now: () => Date.now() }; }
