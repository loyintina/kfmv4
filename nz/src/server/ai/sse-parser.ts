/**
 * sse-parser.ts — 增量 SSE 帧解析器（纯逻辑零 IO）。
 *
 * 语义基准 = na src/brain.rs SseParser 同语义复刻：
 *   - data: 行 + 空行分隔成帧；多 data 行按 SSE 规范以 \n 拼接；
 *   - 碎喂/粘包/半帧/CRLF/注释行（: 开头）全容忍；
 *   - event:/id:/retry: 等字段行静默忽略（九事件协议无 event: 行）；
 *   - [DONE] 不作特判，作载荷原样透出（翻译器判定终结）；
 *   - 半帧（无帧界空行）暂存不吐。
 *
 * 输入为 string（调用方负责 TextDecoder 流式解码），喂入任意切块。
 */

export class SseParser {
  private buf = '';
  private dataLines: string[] = [];

  /** 喂入任意切块的文本（可逐字符碎喂）。 */
  feed(chunk: string): void {
    this.buf += chunk;
  }

  /** 取下一个完整帧的载荷；无完整帧返回 null（半帧暂存不吐）。 */
  nextFrame(): string | null {
    for (;;) {
      const nl = this.buf.indexOf('\n');
      if (nl < 0) return null;
      let line = this.buf.slice(0, nl);
      this.buf = this.buf.slice(nl + 1);
      if (line.endsWith('\r')) line = line.slice(0, -1); // CRLF 容忍
      if (line === '') {
        // 空行 = 帧界；只有攒了 data 才成帧（连续空行不算帧）
        if (this.dataLines.length === 0) continue;
        const frame = this.dataLines.join('\n');
        this.dataLines = [];
        return frame;
      }
      if (line.startsWith(':')) continue; // SSE 注释行
      if (line.startsWith('data:')) {
        // 规范：冒号后至多去掉一个前导空格
        let rest = line.slice(5);
        if (rest.startsWith(' ')) rest = rest.slice(1);
        this.dataLines.push(rest);
      }
      // event:/id:/retry: 等字段静默忽略
    }
  }

  /** 把 buffer 里当前所有完整帧取空。 */
  drainFrames(): string[] {
    const out: string[] = [];
    let f: string | null;
    while ((f = this.nextFrame()) !== null) out.push(f);
    return out;
  }
}
