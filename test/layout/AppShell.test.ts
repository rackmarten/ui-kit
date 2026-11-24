import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { createVuetify } from "vuetify";
import * as components from "vuetify/components";
import { createMemoryHistory, createRouter } from "vue-router";
import AppShell from "../../src/layout/AppShell.vue";
import type { ShellUser } from "../../src/identity/avatar.js";
import { trackUsage, USAGE_FLUSH_MS } from "../../src/usage/usageTracker.js";

// jsdom has no ResizeObserver, which v-app's layout needs.
if (!("ResizeObserver" in globalThis)) {
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
}
// jsdom's window is 1024px wide; a "sm" breakpoint makes that desktop.
const vuetify = createVuetify({ components, display: { mobileBreakpoint: "sm" } });
// The menu renders inline, so its content is testable without an overlay.
const vMenuStub = { template: '<div><slot name="activator" :props="{}" /><slot /></div>' };
const router = createRouter({
  history: createMemoryHistory(),
  routes: [{ path: "/:p*", component: { template: "<div />" } }],
});

const marek: ShellUser = { id: "p1", name: "Marek Uncik", roles: ["admin"], deviceName: "Pixel 8" };

const render = (props: Record<string, unknown>) =>
  mount(AppShell, {
    props: { title: "Test", ...props },
    global: { plugins: [vuetify, router], stubs: { VMenu: vMenuStub } },
  });

describe("AppShell account menu", () => {
  it("shows the avatar image, name and header for a given user", () => {
    const wrapper = render({
      user: marek,
      profileTo: "/profile",
      avatarBaseUrl: "https://id.example.com/api/avatars/",
    });
    expect(wrapper.find("[data-testid=account-activator] img").attributes("src")).toBe(
      "https://id.example.com/api/avatars/p1",
    );
    expect(wrapper.find("[data-testid=account-name]").text()).toBe("Marek Uncik");
    const text = wrapper.text();
    expect(text).toContain("Admin");
    expect(text).toContain("Pixel 8");
    expect(text).toContain("Profile");
    expect(text).not.toContain("Viewing as");
    wrapper.unmount();
  });

  it("falls back to initials when the image fails", async () => {
    const wrapper = render({ user: { id: "p2", name: "Jana Nováková" }, avatarBaseUrl: "/a/" });
    await wrapper.find("[data-testid=account-activator] img").trigger("error");
    expect(wrapper.find("[data-testid=account-activator] img").exists()).toBe(false);
    expect(wrapper.find("[data-testid=account-activator]").text()).toContain("JN");
    wrapper.unmount();
  });

  it("shows the Viewing as line while an admin views as someone", () => {
    const wrapper = render({
      user: { id: "p2", name: "Jana", actor: { id: "p1", name: "Marek" } },
    });
    const text = wrapper.find("[data-testid=account-header]").text();
    expect(text).toContain("Viewing as Jana");
    expect(wrapper.text()).not.toContain("Profile");
    wrapper.unmount();
  });

  it("keeps the plain icon with no user, and the user prop skips the meUrl fetch", () => {
    const fetch = vi.spyOn(globalThis, "fetch");
    const none = render({});
    expect(none.find("[data-testid=account-activator] img").exists()).toBe(false);
    expect(none.find(".mdi-account-circle-outline").exists()).toBe(true);
    none.unmount();
    render({ user: marek, meUrl: "/api/me" }).unmount();
    expect(fetch).not.toHaveBeenCalled();
    fetch.mockRestore();
  });
});

const track = async (props: Record<string, unknown>) => {
  vi.useFakeTimers();
  vi.spyOn(document, "hasFocus").mockReturnValue(true);
  const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null));
  const wrapper = mount(AppShell, {
    props: { title: "Test", ...props },
    slots: { default: '<button data-track="export">Export</button>' },
    attachTo: document.body,
    global: { plugins: [vuetify, router], stubs: { VMenu: vMenuStub } },
  });
  await router.push("/items/12");
  await flushPromises();
  await wrapper.find("[data-track=export]").trigger("click");
  trackUsage("programmatic");
  vi.advanceTimersByTime(USAGE_FLUSH_MS);
  return { wrapper, fetch };
};

describe("AppShell usage tracking", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("is off by default", async () => {
    const { wrapper, fetch } = await track({});
    wrapper.unmount();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("sends views and data-track clicks with the usage prop, and stops when unset", async () => {
    const { wrapper, fetch } = await track({ usage: { url: "/app/api/usage/events" } });
    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("/app/api/usage/events");
    const { events } = JSON.parse(init?.body as string) as { events: { kind: string }[] };
    expect(events).toContainEqual(expect.objectContaining({ kind: "view", route: "/:p*" }));
    expect(init?.body as string).not.toContain("items");
    expect(events).toContainEqual(expect.objectContaining({ kind: "click", feature: "export" }));
    expect(events).toContainEqual(
      expect.objectContaining({ kind: "click", feature: "programmatic" }),
    );

    await wrapper.setProps({ usage: false });
    trackUsage("after-off");
    vi.advanceTimersByTime(USAGE_FLUSH_MS);
    expect(JSON.stringify(fetch.mock.calls)).not.toContain("after-off");
    wrapper.unmount();
  });
});
