import { Worker } from 'worker_threads';
import { launchHeadlessBrowser } from '../src/server/ai/tools/omp/browser/launch.ts';

async function main() {
  const browser = await launchHeadlessBrowser({ headless: true });
  const ws = browser.wsEndpoint();
  console.log('Browser ws:', ws);
  
  const worker = new Worker(new URL('./test-worker-pup.ts', import.meta.url));
  worker.on('message', msg => {
    console.log('Worker:', JSON.stringify(msg));
    if (msg.ready) worker.postMessage({ ws });
  });
  worker.on('error', err => console.log('Worker error:', err.message));
  worker.on('exit', code => console.log('Worker exit:', code));
  
  setTimeout(() => { console.log('TIMEOUT'); process.exit(1); }, 30000);
}
main().catch(err => console.error(err.message));
