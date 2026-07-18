/**
 * launch.ts — Chromium 启动 + stealth 补丁
 *
 * 移植自 omp browser/launch.ts。
 * 替换：
 *   - @oh-my-pi/pi-utils → 内联实现
 *   - Bun.write → fs.writeFileSync
 *   - Bun.file().text() → fs.readFileSync（仅 macOS 路径）
 *   - stealth txt 文件 → fs.readFileSync 在模块加载时读取
 *   - loadBrowsers / PUPPETEER_REVISIONS 保留 dynamic import（懒加载，只在首次下载 Chromium 时触发）
 *   - loadPuppeteer / loadPuppeteerInWorker 保留 dynamic import（需在 chdir 后加载，见注释）
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as cp from 'node:child_process';
import { fileURLToPath } from 'node:url';
import type { Browser, CDPSession, Page, default as Puppeteer, Target } from 'puppeteer-core';
import { ToolError } from '../../types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Stealth scripts — read at module load time (Node.js has no `with {type:"text"}`)
// ---------------------------------------------------------------------------
function readStealthScript(name: string): string {
  return fs.readFileSync(path.join(__dirname, 'puppeteer', name), 'utf-8');
}

const stealthTamperingScript  = readStealthScript('00_stealth_tampering.txt');
const stealthActivityScript   = readStealthScript('01_stealth_activity.txt');
const stealthHairlineScript   = readStealthScript('02_stealth_hairline.txt');
const stealthBotdScript       = readStealthScript('03_stealth_botd.txt');
const stealthIframeScript     = readStealthScript('04_stealth_iframe.txt');
const stealthWebglScript      = readStealthScript('05_stealth_webgl.txt');
const stealthScreenScript     = readStealthScript('06_stealth_screen.txt');
const stealthFontsScript      = readStealthScript('07_stealth_fonts.txt');
const stealthAudioScript      = readStealthScript('08_stealth_audio.txt');
const stealthLocaleScript     = readStealthScript('09_stealth_locale.txt');
const stealthPluginsScript    = readStealthScript('10_stealth_plugins.txt');
const stealthHardwareScript   = readStealthScript('11_stealth_hardware.txt');
const stealthCodecsScript     = readStealthScript('12_stealth_codecs.txt');
const stealthWorkerScript     = readStealthScript('13_stealth_worker.txt');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
export const DEFAULT_VIEWPORT = { width: 1365, height: 768, deviceScaleFactor: 1.25 };
export const BROWSER_PROTOCOL_TIMEOUT_MS = 60_000;
const ENABLE_AUTOMATION_FLAG = '--enable-automation';
const STEALTH_IGNORE_DEFAULT_ARGS = [
  ENABLE_AUTOMATION_FLAG,
  '--disable-extensions',
  '--disable-default-apps',
  '--disable-component-extensions-with-background-pages',
  '--disable-popup-blocking',
  '--disable-client-side-phishing-detection',
  '--allow-pre-commit-input',
  '--disable-ipc-flooding-protection',
  '--metrics-recording-only',
];
const STEALTH_ACCEPT_LANGUAGE = 'en-US,en';
const USER_AGENT_TARGET_TIMEOUT_MS = 5_000;
const USER_AGENT_TARGET_TYPES = new Set(['page', 'webview', 'background_page']);
const PUPPETEER_SOURCE_URL_SUFFIX = '//# sourceURL=__puppeteer_evaluation_script__';

// ---------------------------------------------------------------------------
// Helpers replacing @oh-my-pi/pi-utils
// ---------------------------------------------------------------------------

/** Chromium cache dir for kfmv4 (replaces getPuppeteerDir()). */
function getPuppeteerDir(): string {
  const dir = path.join(os.homedir(), '.kfmv4', 'puppeteer');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** which(1) lookup (replaces $which from pi-utils). */
function $which(cmd: string): string | undefined {
  try {
    return cp.execSync(`which ${cmd}`, { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().trim() || undefined;
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Puppeteer loading (dynamic import intentional — see comments)
// ---------------------------------------------------------------------------

let puppeteerModule: typeof Puppeteer | undefined;

/**
 * Load puppeteer-core from a safe CWD.
 * Dynamic import required: puppeteer-core probes process.cwd() at module-init
 * time via cosmiconfig; we must chdir to a scratch dir before loading to avoid
 * malformed package.json in the user's project tree crashing the import.
 */
export async function loadPuppeteer(): Promise<typeof Puppeteer> {
  if (puppeteerModule) return puppeteerModule;
  const prev = process.cwd();
  const safeDir = getPuppeteerDir();
  fs.writeFileSync(path.join(safeDir, 'package.json'), '{}');
  try {
    process.chdir(safeDir);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const mod = await import('puppeteer-core');
    puppeteerModule = (mod as { default: typeof Puppeteer }).default;
    return puppeteerModule;
  } finally {
    process.chdir(prev);
  }
}

let puppeteerModuleWorker: typeof Puppeteer | undefined;

/**
 * Load puppeteer-core inside a worker thread.
 * Dynamic import required: must override process.cwd while loading.
 */
export async function loadPuppeteerInWorker(safeDir: string): Promise<typeof Puppeteer> {
  if (puppeteerModuleWorker) return puppeteerModuleWorker;
  const orig = process.cwd;
  Object.defineProperty(process, 'cwd', { value: () => safeDir, configurable: true });
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const mod = await import('puppeteer-core');
    puppeteerModuleWorker = (mod as { default: typeof Puppeteer }).default;
    return puppeteerModuleWorker;
  } finally {
    Object.defineProperty(process, 'cwd', { value: orig, configurable: true });
  }
}

// ---------------------------------------------------------------------------
// Chromium resolution
// ---------------------------------------------------------------------------

let chromiumExecutablePromise: Promise<string | undefined> | undefined;

async function ensureChromiumExecutable(): Promise<string | undefined> {
  const sysChrome = resolveSystemChromium();
  if (sysChrome) return sysChrome;
  const envPath = process.env['PUPPETEER_EXECUTABLE_PATH'];
  if (envPath) return envPath;
  if (chromiumExecutablePromise) return chromiumExecutablePromise;

  chromiumExecutablePromise = (async () => {
    // Dynamic import intentional: @puppeteer/browsers is lazily loaded only
    // on first Chromium download to avoid startup cost.
    const browsers = await import('@puppeteer/browsers');
    const platform = browsers.detectBrowserPlatform();
    if (!platform) return undefined;
    const cacheDir = getPuppeteerDir();
    // Dynamic import intentional: internal puppeteer-core revision data.
    const { PUPPETEER_REVISIONS } = await import('puppeteer-core/internal/revisions.js');
    const buildId = await browsers.resolveBuildId(browsers.Browser.CHROME, platform, PUPPETEER_REVISIONS.chrome);
    const executablePath = browsers.computeExecutablePath({
      browser: browsers.Browser.CHROME,
      buildId,
      cacheDir,
      platform,
    });
    if (fs.existsSync(executablePath)) return executablePath;
    let lastPct = -1;
    await browsers.install({
      browser: browsers.Browser.CHROME,
      buildId,
      cacheDir,
      platform,
      downloadProgressCallback: (downloaded, total) => {
        if (total <= 0) return;
        const pct = Math.floor((downloaded / total) * 100);
        if (pct >= lastPct + 10 || downloaded === total) {
          lastPct = pct;
          process.stderr.write(`[browser] Chromium download: ${pct}%\n`);
        }
      },
    });
    return executablePath;
  })().catch(err => {
    chromiumExecutablePromise = undefined;
    const msg = err instanceof Error ? err.message : String(err);
    throw new ToolError(
      `Failed to install Chromium for puppeteer: ${msg}. ` +
      'Set PUPPETEER_EXECUTABLE_PATH to use an existing Chrome/Chromium binary.',
    );
  });
  return chromiumExecutablePromise;
}

let resolvedChromium: string | null | undefined;

function isExecutableFile(p: string): boolean {
  try { return fs.statSync(p).isFile(); } catch { return false; }
}

function systemChromiumCandidates(): string[] {
  const home = os.homedir();
  const candidates: string[] = [];
  switch (process.platform) {
    case 'darwin':
      for (const root of ['/Applications', path.join(home, 'Applications')]) {
        candidates.push(
          path.join(root, 'Google Chrome.app/Contents/MacOS/Google Chrome'),
          path.join(root, 'Google Chrome Beta.app/Contents/MacOS/Google Chrome Beta'),
          path.join(root, 'Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary'),
          path.join(root, 'Chromium.app/Contents/MacOS/Chromium'),
          path.join(root, 'Microsoft Edge.app/Contents/MacOS/Microsoft Edge'),
        );
      }
      break;
    case 'linux': {
      const names = ['google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser', 'chrome'];
      for (const name of names) {
        const found = $which(name);
        if (found) candidates.push(found);
      }
      candidates.push(
        '/usr/bin/google-chrome-stable', '/usr/bin/google-chrome',
        '/usr/bin/chromium', '/usr/bin/chromium-browser',
        '/snap/bin/chromium',
      );
      break;
    }
    case 'win32': {
      const pf  = process.env['ProgramFiles']       ?? 'C:\\Program Files';
      const pf86 = process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)';
      const appData = process.env['LOCALAPPDATA']   ?? path.join(home, 'AppData\\Local');
      candidates.push(
        path.join(pf,     'Google\\Chrome\\Application\\chrome.exe'),
        path.join(pf86,   'Google\\Chrome\\Application\\chrome.exe'),
        path.join(appData,'Google\\Chrome\\Application\\chrome.exe'),
        path.join(pf,     'Microsoft\\Edge\\Application\\msedge.exe'),
      );
      break;
    }
  }
  return candidates;
}

function resolveSystemChromium(): string | undefined {
  if (resolvedChromium !== undefined) return resolvedChromium ?? undefined;
  const seen = new Set<string>();
  for (const c of systemChromiumCandidates()) {
    if (!c || seen.has(c)) continue;
    seen.add(c);
    if (isExecutableFile(c)) { resolvedChromium = c; return c; }
  }
  resolvedChromium = null;
  return undefined;
}

// ---------------------------------------------------------------------------
// Launch
// ---------------------------------------------------------------------------

export interface LaunchHeadlessOptions {
  headless: boolean;
  viewport?: { width: number; height: number; deviceScaleFactor?: number };
}

export async function launchHeadlessBrowser(opts: LaunchHeadlessOptions): Promise<Browser> {
  const vp = opts.viewport ?? DEFAULT_VIEWPORT;
  const initialViewport = {
    width: vp.width,
    height: vp.height,
    deviceScaleFactor: vp.deviceScaleFactor ?? DEFAULT_VIEWPORT.deviceScaleFactor,
  };
  const puppeteer = await loadPuppeteer();
  const launchArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-blink-features=AutomationControlled',
    `--window-size=${initialViewport.width},${initialViewport.height}`,
  ];
  const proxy = process.env['PUPPETEER_PROXY'];
  if (proxy) {
    launchArgs.push(`--proxy-server=${proxy}`);
    const bypassLoopback = process.env['PUPPETEER_PROXY_BYPASS_LOOPBACK']?.toLowerCase();
    if (bypassLoopback === 'true' || bypassLoopback === '1') {
      launchArgs.push('--proxy-bypass-list=<-loopback>');
    }
  }
  const ignoreCert = process.env['PUPPETEER_PROXY_IGNORE_CERT_ERRORS']?.toLowerCase();
  if (ignoreCert === 'true' || ignoreCert === '1') {
    launchArgs.push('--ignore-certificate-errors');
  }
  const executablePath = await ensureChromiumExecutable();
  return puppeteer.launch({
    headless: opts.headless,
    defaultViewport: opts.headless ? initialViewport : null,
    executablePath,
    args: launchArgs,
    ignoreDefaultArgs: stealthIgnoreDefaultArgs(executablePath),
    protocolTimeout: BROWSER_PROTOCOL_TIMEOUT_MS,
  });
}

export async function applyViewport(
  page: Page,
  viewport?: { width: number; height: number; deviceScaleFactor?: number },
): Promise<void> {
  if (!viewport) { await page.setViewport(DEFAULT_VIEWPORT); return; }
  await page.setViewport({
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: viewport.deviceScaleFactor ?? DEFAULT_VIEWPORT.deviceScaleFactor,
  });
}

// ---------------------------------------------------------------------------
// Stealth helpers
// ---------------------------------------------------------------------------

function isMicrosoftEdgeExecutable(executablePath: string | undefined): boolean {
  if (!executablePath) return false;
  const norm = executablePath.replaceAll('\\', '/').toLowerCase();
  const name = norm.slice(norm.lastIndexOf('/') + 1);
  return name === 'msedge.exe' || name === 'microsoft edge' || name.startsWith('microsoft-edge');
}

function stealthIgnoreDefaultArgs(executablePath: string | undefined): string[] {
  if (!isMicrosoftEdgeExecutable(executablePath)) return [...STEALTH_IGNORE_DEFAULT_ARGS];
  return STEALTH_IGNORE_DEFAULT_ARGS.filter(a => a !== ENABLE_AUTOMATION_FLAG);
}

interface PuppeteerCdpClient {
  send: (method: string, params?: Record<string, unknown>) => Promise<unknown>;
}

export interface UserAgentOverride {
  userAgent: string;
  platform: string;
  acceptLanguage: string;
  userAgentMetadata: {
    brands: Array<{ brand: string; version: string }>;
    fullVersion: string;
    fullVersionList: Array<{ brand: string; version: string }>;
    platform: string;
    platformVersion: string;
    architecture: string;
    bitness: string;
    model: string;
    mobile: boolean;
  };
}

export interface UserAgentSession {
  override: UserAgentOverride;
  browserSession: CDPSession | null;
}

function resolvePageClient(page: Page): PuppeteerCdpClient | null {
  const p = page as Page & { _client?: (() => PuppeteerCdpClient) | PuppeteerCdpClient };
  if (!p._client) return null;
  return typeof p._client === 'function' ? p._client() : p._client;
}

const patchedClients = new WeakSet<object>();

function patchSourceUrl(page: Page): void {
  const client = resolvePageClient(page);
  if (!client) return;
  if (patchedClients.has(client as object)) return;
  patchedClients.add(client as object);
  const original = client.send.bind(client);
  client.send = async (method: string, params?: Record<string, unknown>) => {
    const next = async (p?: Record<string, unknown>) => {
      try { return await original(method, p); }
      catch (error) {
        if (error instanceof Error &&
            error.message.includes('Protocol error (Network.getResponseBody): No resource with given identifier found')) {
          return undefined;
        }
        throw error;
      }
    };
    if (!method || !params) return next(params);
    const key = method === 'Runtime.evaluate' ? 'expression'
              : method === 'Runtime.callFunctionOn' ? 'functionDeclaration'
              : null;
    if (!key) return next(params);
    const value = params[key];
    if (typeof value !== 'string' || value.endsWith(PUPPETEER_SOURCE_URL_SUFFIX)) return next(params);
    return next({ ...params, [key]: `${value}\n${PUPPETEER_SOURCE_URL_SUFFIX}` });
  };
}

function resolveHostArchitecture(): string {
  if (os.arch() === 'arm64') return 'arm';
  if (os.arch().includes('64')) return 'x86';
  return '';
}

function resolveHostBitness(): string {
  return os.arch().includes('64') ? '64' : '';
}

async function resolveMacOsProductVersion(): Promise<string> {
  if (os.platform() !== 'darwin') return '';
  try {
    const plist = fs.readFileSync('/System/Library/CoreServices/SystemVersion.plist', 'utf-8');
    return plist.match(/<key>ProductVersion<\/key>\s*<string>([^<]+)<\/string>/)?.[1] ?? '';
  } catch { return ''; }
}

async function resolveUserAgentOverride(page: Page): Promise<UserAgentOverride> {
  const rawUA = await page.browser().userAgent();
  let userAgent = rawUA.replace('HeadlessChrome/', 'Chrome/');
  if (userAgent.includes('Linux') && !userAgent.includes('Android')) {
    userAgent = userAgent.replace(/\(([^)]+)\)/, '(Windows NT 10.0; Win64; x64)');
  }
  const uaMatch = userAgent.match(/Chrome\/([\d.]+)/);
  const browserMatch = (await page.browser().version()).match(/\/([\d.]+)/);
  const legacyVersion = uaMatch?.[1] ?? browserMatch?.[1] ?? '0';
  const fullVersion = browserMatch?.[1] ?? legacyVersion;
  const majorVersion = parseInt(legacyVersion.split('.')[0] ?? '0', 10) || 0;
  const isAndroid = userAgent.includes('Android');
  const isMac = userAgent.includes('Mac OS X');
  const isWindows = userAgent.includes('Windows');
  const platform = isMac ? 'MacIntel' : isAndroid ? 'Android' : userAgent.includes('Linux') ? 'Linux' : 'Win32';
  const platformFull = isMac ? 'macOS' : isAndroid ? 'Android' : userAgent.includes('Linux') ? 'Linux' : 'Windows';
  const platformVersion = isMac
    ? await resolveMacOsProductVersion()
    : userAgent.includes('Android ')
      ? (userAgent.match(/Android ([^;]+)/)?.[1] ?? '')
      : isWindows ? (userAgent.match(/Windows NT ([\d.]+)/)?.[1] ?? '') : '';
  const architecture = isAndroid ? '' : resolveHostArchitecture();
  const bitness = isAndroid ? '' : resolveHostBitness();
  const model = isAndroid ? (userAgent.match(/Android.*?;\s([^)]+)/)?.[1] ?? '') : '';

  const brandOrders = [[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]] as const;
  const order = brandOrders[majorVersion % brandOrders.length] ?? brandOrders[0];
  const escaped = [' ', ' ', ';'] as const;
  const greaseyBrand = `${escaped[order[0]]}Not${escaped[order[1]]}A${escaped[order[2]]}Brand`;
  const brands: Array<{ brand: string; version: string }> = [];
  brands[order[0]] = { brand: greaseyBrand, version: '99' };
  brands[order[1]] = { brand: 'Chromium', version: String(majorVersion) };
  brands[order[2]] = { brand: 'Google Chrome', version: String(majorVersion) };
  const fullVersionList = brands.map(({ brand }) => ({
    brand,
    version: brand === greaseyBrand ? '99.0.0.0' : fullVersion,
  }));
  return {
    userAgent, platform: platform, acceptLanguage: STEALTH_ACCEPT_LANGUAGE,
    userAgentMetadata: { brands, fullVersion, fullVersionList, platform: platformFull,
      platformVersion, architecture, bitness, model, mobile: isAndroid },
  };
}

function wrapSession(session: CDPSession): PuppeteerCdpClient {
  return { send: async (method, params) => session.send(method as never, params as never) };
}

async function sendUserAgentOverride(client: PuppeteerCdpClient, override: UserAgentOverride): Promise<void> {
  try { await client.send('Network.enable'); } catch { /* best-effort */ }
  try { await client.send('Network.setUserAgentOverride', override as unknown as Record<string, unknown>); } catch { /* best-effort */ }
  try { await client.send('Emulation.setUserAgentOverride', override as unknown as Record<string, unknown>); } catch { /* best-effort */ }
}

async function withSoftTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | undefined> {
  let timer: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<undefined>(resolve => { timer = setTimeout(() => resolve(undefined), timeoutMs); });
  try { return await Promise.race([promise.catch(() => undefined), timeoutPromise]); }
  finally { if (timer) clearTimeout(timer); }
}

function targetSupportsUserAgentOverride(target: Target): boolean {
  return Boolean(target.type() && USER_AGENT_TARGET_TYPES.has(target.type()));
}

function targetInfoSupportsUserAgentOverride(info: { type?: string } | undefined): boolean {
  return Boolean(info?.type && USER_AGENT_TARGET_TYPES.has(info.type));
}

async function applyTargetUserAgentOverride(target: Target, override: UserAgentOverride): Promise<void> {
  const session = await target.createCDPSession();
  try { await sendUserAgentOverride(wrapSession(session), override); }
  finally { await session.detach().catch(() => undefined); }
}

async function configureUserAgentTargets(
  browser: Browser,
  state: { browserSession: CDPSession | null; override: UserAgentOverride },
  targetTimeoutMs = USER_AGENT_TARGET_TIMEOUT_MS,
): Promise<void> {
  if (!state.browserSession) {
    state.browserSession = await browser.target().createCDPSession();
    await state.browserSession.send('Target.setAutoAttach', {
      autoAttach: true, waitForDebuggerOnStart: false, flatten: true,
    });
    state.browserSession.on(
      'Target.attachedToTarget',
      async (event: { sessionId: string; targetInfo?: { type?: string } }) => {
        if (!targetInfoSupportsUserAgentOverride(event.targetInfo)) return;
        const connection = state.browserSession?.connection();
        const session = connection?.session(event.sessionId);
        if (!session) return;
        await withSoftTimeout(sendUserAgentOverride(wrapSession(session), state.override), targetTimeoutMs);
      },
    );
  }
  await Promise.all(
    browser.targets().filter(targetSupportsUserAgentOverride).map(target =>
      withSoftTimeout(applyTargetUserAgentOverride(target, state.override), targetTimeoutMs),
    ),
  );
}

const STEALTH_PATCH_SCRIPTS = [
  stealthTamperingScript, stealthActivityScript, stealthHairlineScript,
  stealthBotdScript, stealthIframeScript, stealthWebglScript,
  stealthScreenScript, stealthFontsScript, stealthAudioScript,
  stealthLocaleScript, stealthPluginsScript, stealthHardwareScript,
  stealthCodecsScript, stealthWorkerScript,
];

function buildStealthInjectionScript(scripts: readonly string[] = STEALTH_PATCH_SCRIPTS): string {
  const joint = scripts.map(s => `\n\t\ttry {\n\t\t\t${s};\n\t\t} catch (e) {}`).join(';\n');
  return `(() => {
    const Page_Function_toString = Function.prototype.toString;
    const Page_FunctionToStringDescriptor = Object.getOwnPropertyDescriptor(Function.prototype, "toString");
    const Page_Proxy = Proxy;
    const Page_WeakMap = WeakMap;
    const Page_WeakMap_get = Page_WeakMap.prototype.get;
    const Page_WeakMap_set = Page_WeakMap.prototype.set;
    let iframe = null;
    const container = document.head ?? document.documentElement;
    if (container) {
      iframe = document.createElement("iframe");
      iframe.style.display = "none";
      container.appendChild(iframe);
      if (!iframe.contentWindow) iframe = null;
    }
    try {
      const nativeWindow = iframe ? iframe.contentWindow : window;
      const Function_toString = nativeWindow.Function.prototype.toString;
      const Object_defineProperty = nativeWindow.Object.defineProperty;
      const Reflect_apply = nativeWindow.Reflect.apply;
      const Reflect_get = nativeWindow.Reflect.get;
      const nativeFunctionSources = new Page_WeakMap();
      const makeNativeString = (name) => "function " + (name || "") + "() { [native code] }";
      const registerNativeSource = (fn, source) => {
        if (typeof fn === "function") Reflect_apply(Page_WeakMap_set, nativeFunctionSources, [fn, source]);
        return fn;
      };
      const patchToString = (fn, name) => registerNativeSource(fn, makeNativeString(name));
      if (${scripts.length > 0 ? 'true' : 'false'}) {
        const functionToStringProxy = new Page_Proxy(Page_Function_toString, {
          apply(target, thisArg, args) {
            const source = Reflect_apply(Page_WeakMap_get, nativeFunctionSources, [thisArg]);
            if (source) return source;
            return Reflect_apply(target, thisArg, args || []);
          },
          get(target, key, receiver) { return Reflect_get(target, key, receiver); },
        });
        registerNativeSource(functionToStringProxy, makeNativeString("toString"));
        Object_defineProperty(Function.prototype, "toString", {
          ...(Page_FunctionToStringDescriptor || { writable: true, configurable: true, enumerable: false }),
          value: functionToStringProxy,
        });
      }
      ${joint}
    } finally {
      if (iframe && iframe.parentNode) iframe.parentNode.removeChild(iframe);
    }})();`;
}

async function injectStealthScripts(page: Page): Promise<void> {
  await page.evaluateOnNewDocument(buildStealthInjectionScript());
}

export async function applyStealthPatches(
  browser: Browser,
  page: Page,
  state: { browserSession: CDPSession | null; override: UserAgentOverride | null },
): Promise<void> {
  patchSourceUrl(page);
  if (!state.override) {
    state.override = await resolveUserAgentOverride(page);
  }
  const client = resolvePageClient(page);
  if (client) await sendUserAgentOverride(client, state.override);
  const targetState = { browserSession: state.browserSession, override: state.override };
  await configureUserAgentTargets(browser, targetState);
  state.browserSession = targetState.browserSession;
  await injectStealthScripts(page);
}
