/**
 * src/client/term-core.ts — nz 8.8.2 探针：rio-vt WASM 解析核的 TS 装载壳
 *
 * 边界（任务图 8.8.2）：解析核 = rio-vt→WASM（Rust crate 在 nz/term-core/）；
 * 本文件只做装载 + 喂字节 + 读文本——验证面与两线行为考卷面。
 * 渲染壳（网格→DOM/Canvas）是后续小步，不在本探针。
 *
 * glue 是 wasm-bindgen --target web 的产物（public/term-core/，由
 * `npm run build:term` 生成，不入仓、不手改）。浏览器侧走动态 import
 * 绝对路径（不进 esbuild bundle）；node 冒烟侧走文件路径 + initSync。
 */

export interface TermCoreHandle {
  feed(bytes: Uint8Array): void;
  resize(cols: number, rows: number): void;
  text(): string;
  cursor(): number;
  /** 光标可见性（DECTCEM ?25h/?25l）：false 时渲染壳必须藏光标（TUI 自绘
   * 反色块场景，壳光标不藏 = 鬼影双光标）。 */
  cursor_visible(): boolean;
  /** 应用光标模式（DECCKM ?1h/?1l）：true 时方向键/Home/End 发 SS3
   * （ESC O A），false 发 CSI（ESC [ A）——按键栏 keymap 实时读本位。 */
  app_cursor(): boolean;
  /** 渲染帧取数协议（行级 DOM 渲染壳用），格式见 wasm 侧注释。 */
  render_frame(): string;
  /** 历史区行数（scrollback 已攒，8.8.3c） */
  history_len(): number;
  /** 已挤出缓冲区总行数（单调递增，截断/错位检测游标） */
  lines_evicted(): number;
  /** 历史区渲染帧：协议同 render_frame，dump 相对区间 [from, to)（0=最旧） */
  history_frame(from: number, to: number): string;
  free(): void;
}

export interface TermCoreGlue {
  /** wasm-bindgen web target 的默认导出：异步 init（fetch wasm）。 */
  default(input?: unknown): Promise<unknown>;
  /** 同步 init（已持有 wasm 字节时用——node 冒烟走这条）。实参形如 `{ module: bytes }`。 */
  initSync(input: { module: BufferSource | WebAssembly.Module }): unknown;
  TermCore: new (cols: number, rows: number, scrollback: number) => TermCoreHandle;
}

/** 浏览器装载：动态 import（模板串路径 esbuild 不解析、不进 bundle）。 */
export async function loadTermCoreBrowser(base = '/term-core'): Promise<TermCoreGlue> {
  const glue = (await import(/* @ts-ignore 构建期无此模块，运行时由 public/term-core 提供 */
    `${base}/kfm_term_core.js`)) as unknown as TermCoreGlue;
  await glue.default(`${base}/kfm_term_core_bg.wasm`);
  return glue;
}

let sharedGlue: Promise<TermCoreGlue> | null = null;

/**
 * 全局唯一 glue 装载——所有消费方（探针/终端卡/后续插件）必须走这里。
 * wasm-bindgen glue 二次 init 会把 wasm 导出绑定换成新实例：旧实例出生
 * 的 TermCore 指针喂进新实例的函数表 → memory access out of bounds。
 * 单例 promise 从根上杜绝并发/重复 init。loader 可替换仅服务回归钉。
 */
export function loadTermCoreShared(
  base = '/term-core',
  loader: (base: string) => Promise<TermCoreGlue> = loadTermCoreBrowser,
): Promise<TermCoreGlue> {
  return (sharedGlue ??= loader(base));
}

/**
 * 探针：建 80×24 核 → 喂一段含 SGR 的样例 → 断言文本真落了网格。
 * 返回一行人读结果（守视 eval / 控制台直读）。
 */
export function probeTermCore(glue: TermCoreGlue): string {
  const t = new glue.TermCore(80, 24, 1000);
  try {
    t.feed(new TextEncoder().encode('nz term-core probe \x1b[32mOK\x1b[0m\r\n$ '));
    const text = t.text();
    if (!text.includes('nz term-core probe OK')) {
      throw new Error(`探针文本不符: ${JSON.stringify(text)}`);
    }
    const cur = t.cursor();
    return `PROBE OK cursor=${cur >>> 16},${cur & 0xffff} text=${JSON.stringify(text)}`;
  } finally {
    t.free();
  }
}
