/**
 * tests/browser/launch.mjs — 浏览器启动统一入口
 *
 * 手机 proot chromium（ubuntu24.04 fallback 构建）GPU 进程必崩且 FATAL
 * 自杀（gpu_data_manager_impl_private.cc:417），--use-gl=disabled 可存活；
 * 服务器/桌面 headless 无副作用。
 *
 * KFM_NZ_NO_SANDBOX=1 时补 --no-sandbox --disable-dev-shm-usage（proot/容器
 * 无特权命名空间、/dev/shm 受限，两者都需要）。
 */
import { chromium } from 'playwright';

export function launchBrowser(options = {}) {
  const args = ['--use-gl=disabled'];
  if (process.env.KFM_NZ_NO_SANDBOX === '1') args.push('--no-sandbox', '--disable-dev-shm-usage');
  return chromium.launch({ headless: true, ...options, args: [...args, ...(options.args ?? [])] });
}
