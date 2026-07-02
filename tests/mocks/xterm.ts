export class Terminal {
  open(_el?: HTMLElement) {}
  write(_data: string) {}
  writeln(_data: string) {}
  scrollLines(_n: number) {}
  clear() {}
  dispose() {}
  loadAddon(_addon: unknown) {}
  get onData(): any { return null }
  set onData(_: any) {}
  get rows(): number { return 24 }
  get cols(): number { return 80 }
  get buffer() { return { active: { baseY: 0, cursorY: 0 } } }
}
