import { createRouter, createWebHistory, type Router, type RouterOptions } from "vue-router";
import { installBackClose } from "../composables/useBackClose.js";

export interface HomelabRouterOptions extends Omit<RouterOptions, "history" | "routes"> {
  // Where the app is mounted; every homelab app is served from "/".
  base?: string;
}

// Old `/#/tasks/12` links (bookmarks, dashboards, push-notification URLs) are
// rewritten in place to `/tasks/12` before the router reads the location, so
// they open the right page without adding a history entry.
export const redirectLegacyHashUrl = (base = "/"): void => {
  if (!("window" in globalThis)) return;
  const { hash } = globalThis.location;
  if (!hash.startsWith("#/")) return;
  globalThis.history.replaceState(
    globalThis.history.state,
    "",
    base.replace(/\/$/, "") + hash.slice(1),
  );
};

// The URL convention: pages at `/<route>` via
// web history, JSON under `/api` (served by server-kit's registerSpa).
export const createHomelabRouter = (
  routes: RouterOptions["routes"],
  options: HomelabRouterOptions = {},
): Router => {
  const { base = "/", ...rest } = options;
  redirectLegacyHashUrl(base);
  const router = createRouter({ ...rest, history: createWebHistory(base), routes });
  installBackClose(router);
  return router;
};
