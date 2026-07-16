/**
 * omp/native.ts — 直载 pi-natives Rust addon
 *
 * 绕过 omp 的 ESM/TypeScript/Bun 胶水层，直接用 Node.js createRequire
 * 加载平台对应的 .node 原生模块。
 */
import { createRequire } from 'module';
import { arch, platform } from 'os';

function getNativePath(): string {
  const plat = platform();
  const cpu = arch();
  let packageName: string;
  if (plat === 'linux' && cpu === 'x64') {
    packageName = 'pi-natives-linux-x64';
  } else if (plat === 'darwin' && cpu === 'x64') {
    packageName = 'pi-natives-darwin-x64';
  } else if (plat === 'darwin' && cpu === 'arm64') {
    packageName = 'pi-natives-darwin-arm64';
  } else if (plat === 'linux' && cpu === 'arm64') {
    packageName = 'pi-natives-linux-arm64';
  } else if (plat === 'win32' && cpu === 'x64') {
    packageName = 'pi-natives-win32-x64';
  } else {
    throw new Error(`不支持的平台: ${plat}-${cpu}`);
  }
  const req = createRequire(import.meta.url);
  try {
    return req.resolve(`@oh-my-pi/${packageName}`);
  } catch {
    throw new Error(`pi-natives 平台包未安装: @oh-my-pi/${packageName}`);
  }
}

const nativePath = getNativePath();
const req = createRequire(import.meta.url);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _natives: Record<string, any> = req(nativePath);

// 导出版本哨兵确认正确加��
if (typeof _natives.__piNativesV16_4_2 !== 'function') {
  throw new Error('pi-natives 版本哨兵检查失败，.node 文件可能与包版本不匹配');
}

// 初始化 Tokio 运行时（pi-natives 要求）
if (typeof _natives.__ompInstallTokioRuntime === 'function') {
  _natives.__ompInstallTokioRuntime();
}

export const executeShell = _natives.executeShell as (
  options: { command: string; cwd?: string; env?: Record<string, string>; timeoutMs?: number; signal?: AbortSignal },
  onChunk?: ((error: Error | null, chunk: string) => void) | null,
) => Promise<{ exitCode?: number; cancelled: boolean; timedOut: boolean; workingDir?: string }>;

export const grep = _natives.grep as (
  options: {
    pattern: string; path: string; glob?: string; type?: string;
    ignoreCase?: boolean; hidden?: boolean; gitignore?: boolean;
    maxCount?: number; maxColumns?: number; signal?: AbortSignal; timeoutMs?: number;
  },
  onMatch?: ((error: Error | null, match: { path: string; lineNumber: number; line: string; truncated?: boolean }) => void) | null,
) => Promise<{ matches: Array<{ path: string; lineNumber: number; line: string }>; totalMatches: number; filesWithMatches: number; filesSearched: number; limitReached?: boolean }>;

export const glob = _natives.glob as (
  options: {
    pattern: string; path: string; hidden?: boolean; gitignore?: boolean;
    maxResults?: number; signal?: AbortSignal; timeoutMs?: number;
  },
  onMatch?: ((error: Error | null, match: { path: string; fileType: number; mtime?: number; size?: number }) => void) | null,
) => Promise<{ matches: Array<{ path: string; fileType: number }>; totalMatches: number }>;
