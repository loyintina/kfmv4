// ESM resolve hook: redirect 'gsap' and xterm packages to mocks
export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'gsap') {
    const mockUrl = new URL('./mocks/gsap.ts', import.meta.url).href;
    return { url: mockUrl, format: 'module', shortCircuit: true };
  }
  if (specifier === '@xterm/xterm') {
    const mockUrl = new URL('./mocks/xterm.ts', import.meta.url).href;
    return { url: mockUrl, format: 'module', shortCircuit: true };
  }
  if (specifier === '@xterm/addon-fit') {
    const mockUrl = new URL('./mocks/xterm-addon-fit.ts', import.meta.url).href;
    return { url: mockUrl, format: 'module', shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
