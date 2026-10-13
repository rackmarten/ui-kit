import { mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, effectScope, h } from "vue";
import { usePolling, type Polling, type PollingOptions } from "../../src/api/usePolling.js";

const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

const setHidden = (hidden: boolean) => {
  Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
  document.dispatchEvent(new Event("visibilitychange"));
};

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
};

const render = () => h("div");

const inScope = <T>(load: () => Promise<T>, interval?: number, options?: PollingOptions) => {
  const scope = effectScope();
  const polling = scope.run(() => usePolling(load, interval, options)) as Polling<T>;
  return { polling, scope };
};

describe("usePolling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setHidden(false);
  });
  afterEach(() => vi.useRealTimers());

  it("starts on mount and stops on unmount", async () => {
    const load = vi.fn(() => Promise.resolve(1));
    let polling: Polling<number> | undefined;
    const wrapper = mount(
      defineComponent({
        setup() {
          polling = usePolling(load, 1000);
          expect(load).not.toHaveBeenCalled();
          return render;
        },
      }),
    );
    await flush();
    expect(load).toHaveBeenCalledTimes(1);
    expect(polling?.data.value).toBe(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(load).toHaveBeenCalledTimes(2);
    wrapper.unmount();
    await vi.advanceTimersByTimeAsync(5000);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("defaults to a 5 s interval and honours immediate: false", async () => {
    const load = vi.fn(() => Promise.resolve("x"));
    const { scope } = inScope(load, undefined, { immediate: false });
    await flush();
    expect(load).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(4999);
    expect(load).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(load).toHaveBeenCalledTimes(1);
    scope.stop();
  });

  it("skips ticks while hidden and refreshes once when visible again", async () => {
    const load = vi.fn(() => Promise.resolve(0));
    const { scope } = inScope(load, 1000);
    await flush();
    expect(load).toHaveBeenCalledTimes(1);
    setHidden(true);
    await vi.advanceTimersByTimeAsync(5000);
    expect(load).toHaveBeenCalledTimes(1);
    setHidden(false);
    await flush();
    expect(load).toHaveBeenCalledTimes(2);
    scope.stop();
    setHidden(true);
    setHidden(false);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("keeps polling while hidden when pauseWhenHidden is false", async () => {
    setHidden(true);
    const load = vi.fn(() => Promise.resolve(0));
    const { scope } = inScope(load, 1000, { pauseWhenHidden: false });
    await vi.advanceTimersByTimeAsync(2000);
    expect(load).toHaveBeenCalledTimes(3);
    scope.stop();
  });

  it("never runs two loads at once", async () => {
    const pending = deferred<number>();
    const load = vi.fn(() => pending.promise);
    const { polling, scope } = inScope(load, 1000);
    expect(polling.loading.value).toBe(true);
    await vi.advanceTimersByTimeAsync(3000);
    const manual = polling.refresh();
    expect(load).toHaveBeenCalledTimes(1);
    pending.resolve(7);
    await manual;
    expect(polling.data.value).toBe(7);
    expect(polling.loading.value).toBe(false);
    scope.stop();
  });

  it("keeps the last good data when a load fails, and clears the error after", async () => {
    const load = vi
      .fn<() => Promise<string>>()
      .mockResolvedValueOnce("good")
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce("better");
    const { polling, scope } = inScope(load, 1000);
    await flush();
    expect(polling.data.value).toBe("good");
    await vi.advanceTimersByTimeAsync(1000);
    expect(polling.data.value).toBe("good");
    expect(polling.error.value).toBe("offline");
    await polling.refresh();
    expect(polling.data.value).toBe("better");
    expect(polling.error.value).toBeNull();
    scope.stop();
  });
});
