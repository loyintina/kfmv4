// Register the GSAP hook before any modules load
import { register } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
register(resolve(__dirname, 'gsap-hook.mjs'), import.meta.url);
