// ESM resolve hook: redirect 'gsap' to our mock
export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'gsap') {
    const mockUrl = new URL('./mocks/gsap.ts', import.meta.url).href;
    return { url: mockUrl, format: 'module', shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
