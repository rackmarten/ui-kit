import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope, nextTick, ref } from "vue";

type Module = typeof import("../../src/composables/useBackClose.js");
type RouterModule = typeof import("../../src/router/homelabRouter.js");

// history.back() fires popstate on a later task.
const settle = () => new Promise((resolve) => setTimeout(resolve, 30));

let mod: Module;
let routerMod: RouterModule;
let routerPops: number;
const countRouterPop = () => routerPops++;

beforeEach(async () => {
  // The composable keeps its overlay stack at module level; start each test clean.
  vi.resetModules();
  mod = await import("../../src/composables/useBackClose.js");
  routerMod = await import("../../src/router/homelabRouter.js");
  globalThis.history.replaceState(null, "", "/a");
  routerPops = 0;
  // Stands in for vue-router's own (bubble-phase) popstate listener.
  globalThis.addEventListener("popstate", countRouterPop);
});

afterEach(() => {
  globalThis.removeEventListener("popstate", countRouterPop);
});

const overlayTag = (): unknown =>
  (globalThis.history.state as { hlOverlay?: unknown } | null)?.hlOverlay;

const mountOverlay = (open = ref(false)) => {
  const scope = effectScope();
  scope.run(() => {
    mod.useBackClose(open);
  });
  return { open, scope };
};

describe("useBackClose", () => {
  it("back closes an open overlay without the router seeing the pop", async () => {
    const { open } = mountOverlay();
    const before = globalThis.history.length;
    open.value = true;
    expect(globalThis.history).toHaveLength(before + 1);
    expect(overlayTag()).toBeTypeOf("number");

    globalThis.history.back();
    await settle();

    expect(open.value).toBe(false);
    expect(globalThis.location.pathname).toBe("/a");
    expect(overlayTag()).toBeUndefined();
    expect(routerPops).toBe(0);
  });

  it("closing from the UI consumes the overlay's entry", async () => {
    const { open } = mountOverlay();
    open.value = true;
    open.value = false;
    await settle();

    expect(overlayTag()).toBeUndefined();
    expect(globalThis.location.pathname).toBe("/a");
    expect(routerPops).toBe(0);
  });

  it("back closes only the topmost of two overlays", async () => {
    const first = mountOverlay();
    const second = mountOverlay();
    first.open.value = true;
    second.open.value = true;

    globalThis.history.back();
    await settle();
    expect(second.open.value).toBe(false);
    expect(first.open.value).toBe(true);

    globalThis.history.back();
    await settle();
    expect(first.open.value).toBe(false);
    expect(routerPops).toBe(0);
  });

  it("disposing an open overlay (unmount) steps back off its entry", async () => {
    const { open, scope } = mountOverlay();
    open.value = true;
    scope.stop();
    await settle();
    expect(overlayTag()).toBeUndefined();
  });
});

const bootRouter = async () => {
  const page = { template: "<div />" };
  const router = routerMod.createHomelabRouter([
    { path: "/a", component: page },
    { path: "/b", component: page },
  ]);
  await router.push("/a");
  await router.isReady();
  return router;
};

describe("createHomelabRouter + useBackClose", () => {
  it("a link tapped in a drawer replaces the drawer's entry", async () => {
    const router = await bootRouter();
    const { open } = mountOverlay();
    open.value = true;
    const lengthWithDrawer = globalThis.history.length;

    // AppShell's drawer item: close the drawer and navigate in one tap.
    open.value = false;
    await router.push("/b");
    await settle();

    expect(globalThis.location.pathname).toBe("/b");
    expect(overlayTag()).toBeUndefined();
    expect(globalThis.history).toHaveLength(lengthWithDrawer);

    globalThis.history.back();
    await settle();
    await nextTick();
    expect(globalThis.location.pathname).toBe("/a");
    expect(router.currentRoute.value.path).toBe("/a");
  });

  it("a link tapped in an overlay still navigates when another guard defers it", async () => {
    const router = await bootRouter();
    // Vuetify's closeOnBack (VMenu, VDialog, VNavigationDrawer) holds every
    // navigation for a setTimeout tick; the step back off the overlay's entry
    // must not land inside that window and undo the navigation.
    router.beforeEach(() => new Promise<void>((resolve) => setTimeout(resolve)));
    const { open } = mountOverlay();
    open.value = true;

    open.value = false;
    await router.push("/b");
    await settle();
    await nextTick();

    expect(globalThis.location.pathname).toBe("/b");
    expect(router.currentRoute.value.path).toBe("/b");
    expect(overlayTag()).toBeUndefined();
  });

  it("an overlay left open across a navigation lets back reach the router", async () => {
    const router = await bootRouter();
    const { open } = mountOverlay();
    open.value = true;
    await router.push("/b");
    expect(overlayTag()).toBeUndefined();

    globalThis.history.back();
    await settle();
    expect(router.currentRoute.value.path).toBe("/a");
    // It no longer owns an entry, so closing it now must not step back again.
    open.value = false;
    await settle();
    expect(globalThis.location.pathname).toBe("/a");
  });
});

describe("redirectLegacyHashUrl", () => {
  it("turns /#/x into /x in place", () => {
    globalThis.history.replaceState(null, "", "/#/tasks/12?tab=log");
    const before = globalThis.history.length;
    routerMod.redirectLegacyHashUrl();
    expect(globalThis.location.pathname).toBe("/tasks/12");
    expect(globalThis.location.search).toBe("?tab=log");
    expect(globalThis.location.hash).toBe("");
    expect(globalThis.history).toHaveLength(before);
  });

  it("leaves clean URLs and plain anchors alone", () => {
    globalThis.history.replaceState(null, "", "/tasks#section");
    routerMod.redirectLegacyHashUrl();
    expect(globalThis.location.pathname).toBe("/tasks");
    expect(globalThis.location.hash).toBe("#section");
  });
});
