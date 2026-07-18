/**
 * run-cancellation.ts — 浏览器运行取消工具
 *
 * 提供 untilAborted / markHandled / waitForBrowserRun 等工具函数，
 * 确保浏览器操作在 AbortSignal 触发时正确取消。
 */
import { throwIfAborted } from '../../types.js';

function untilAborted<T>(signal: AbortSignal | undefined | null, pr: Promise<T> | (() => Promise<T>)): Promise<T> {
	if (!signal) return typeof pr === 'function' ? pr() : pr;
	if (signal.aborted) return Promise.reject(new Error('Aborted'));
	// Promise.withResolvers is ES2024; inline for ES2022 compat
	let resolve!: (value: T | PromiseLike<T>) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
	const onAbort = () => reject(signal.reason instanceof Error ? signal.reason : new Error('Aborted'));
	signal.addEventListener('abort', onAbort, { once: true });
	void (async () => { try { resolve(await (typeof pr === 'function' ? pr() : pr)); } catch (err) { reject(err); } finally { signal.removeEventListener('abort', onAbort); } })();
	return promise;
}

/**
 * Marks a run-scoped promise as observed without changing its behavior for awaited callers.
 *
 * Browser run teardown aborts can reject promises created for evaluated code after user code
 * has stopped observing them (for example fire-and-forget `wait()`/facade calls). In 16.3.0
 * those zero-consumer rejections reached the process-level `unhandledRejection` handler and
 * killed every subagent sharing the process (issues #4499/#4672). Attaching a no-op rejection
 * handler at creation makes the promise observed while returning the original promise so callers
 * that do await it still receive the rejection.
 */
export function markHandled<T>(promise: Promise<T>): Promise<T> {
	void promise.catch(() => undefined);
	return promise;
}

/** Sleeps inside evaluated browser code while honoring the owning run's cancellation signal. */
export function waitForBrowserRun(ms: number, signal: AbortSignal): Promise<void> {
	const promise = (async (): Promise<void> => {
		throwIfAborted(signal);
		await untilAborted(signal, () => new Promise<void>(r => setTimeout(r, ms)));
		throwIfAborted(signal);
	})();
	return markHandled(promise);
}

/** Binds a long-lived browser facade to one evaluated run's abort signal. */
export function bindBrowserRunFacade<T extends object>(target: T, signal: AbortSignal): T {
	const cache = new Map<PropertyKey, unknown>();
	return new Proxy(target, {
		get(current, prop) {
			throwIfAborted(signal);
			const cached = cache.get(prop);
			if (cached) return cached;
			const value = Reflect.get(current, prop, current);
			if (typeof value === "function") {
				const wrapped = (...args: unknown[]): unknown => {
					throwIfAborted(signal);
					const result = Reflect.apply(value, current, args);
					if (result && typeof result === "object") {
						const then = Reflect.get(result, "then");
						if (typeof then === "function") {
							return markHandled(
								Promise.resolve(result).then(resolved => {
									throwIfAborted(signal);
									return resolved;
								}),
							);
						}
					}
					throwIfAborted(signal);
					return result;
				};
				cache.set(prop, wrapped);
				return wrapped;
			}
			if (value && typeof value === "object") {
				const wrapped = bindBrowserRunFacade(value, signal);
				cache.set(prop, wrapped);
				return wrapped;
			}
			return value;
		},
	});
}
