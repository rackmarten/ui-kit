import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { defineComponent, h, ref, type Ref } from "vue";
import { createMemoryHistory, createRouter, type Router } from "vue-router";
import { USAGE_FLUSH_MS, type ClientUsageEvent } from "../../src/usage/usageTracker.js";
import { useUsageTracker } from "../../src/usage/useUsageTracker.js";

const page = { template: "<div />" };

const tracked = (options: { enabled?: Ref<boolean>; send: (events: ClientUsageEvent[]) => void }) =>
  defineComponent({
    setup() {
      const { track } = useUsageTracker({ enabled: options.enabled, send: options.send });
      return () =>
        h(
          "button",
          {
            onClick: () => {
              track("go");
            },
          },
          "Go",
        );
    },
  });

describe("useUsageTracker", () => {
  let router: Router;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.spyOn(document, "hasFocus").mockReturnValue(true);
    router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: "/", component: page }],
    });
    await router.push("/");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("does nothing without a router installed", async () => {
    const send = vi.fn();
    const wrapper = mount(tracked({ send }));
    await wrapper.find("button").trigger("click");
    vi.advanceTimersByTime(USAGE_FLUSH_MS);
    wrapper.unmount();
    expect(send).not.toHaveBeenCalled();
  });

  it("follows `enabled` and stops on unmount", async () => {
    const enabled = ref(false);
    const send = vi.fn<(events: ClientUsageEvent[]) => void>();
    const wrapper = mount(tracked({ enabled, send }), { global: { plugins: [router] } });
    await wrapper.find("button").trigger("click");
    vi.advanceTimersByTime(USAGE_FLUSH_MS);
    expect(send).not.toHaveBeenCalled();

    enabled.value = true;
    await wrapper.vm.$nextTick();
    await wrapper.find("button").trigger("click");
    wrapper.unmount();
    const events = send.mock.calls.flatMap(([batch]) => batch);
    expect(events).toContainEqual(expect.objectContaining({ kind: "view", route: "/" }));
    expect(events).toContainEqual(expect.objectContaining({ kind: "click", feature: "go" }));

    send.mockClear();
    vi.advanceTimersByTime(USAGE_FLUSH_MS * 2);
    expect(send).not.toHaveBeenCalled();
  });

  it("leaves a second instance idle while one is running", async () => {
    const first = vi.fn<(events: ClientUsageEvent[]) => void>();
    const second = vi.fn();
    const one = mount(tracked({ send: first }), { global: { plugins: [router] } });
    const two = mount(tracked({ send: second }), { global: { plugins: [router] } });
    await two.find("button").trigger("click");
    two.unmount();
    one.unmount();
    expect(second).not.toHaveBeenCalled();
    const clicks = first.mock.calls
      .flatMap(([batch]) => batch)
      .filter((event) => event.kind === "click");
    expect(clicks).toHaveLength(1);
  });
});
