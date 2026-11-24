import { createMemoryHistory, createRouter, type RouteRecordRaw, type Router } from "vue-router";

// server-kit's UsageInventoryItem. ui-kit only produces the `view` and
// `feature` kinds; server-kit adds the app's `api` routes itself.
export interface UsageInventoryItem {
  kind: "api" | "view" | "feature";
  key: string;
}

export interface UsageInventoryOptions {
  // The app's router, or the route records it is built from.
  routes: Router | readonly RouteRecordRaw[];
  // Every `data-track` and `trackUsage()` feature name the app uses.
  features?: readonly string[];
}

// What the app has, for server-kit's `usage.inventory`: what "never used" is
// measured against. Views are the route patterns `view` events carry, so
// redirects and records without a component are left out. Views are
// sorted, so a checked-in copy only changes when the routes do.
export const usageInventory = ({
  routes,
  features = [],
}: UsageInventoryOptions): UsageInventoryItem[] => {
  // A throwaway router normalizes plain records (nested paths, aliases)
  // exactly as the app's own does. It never navigates, so lazy components
  // are not loaded.
  const router =
    "getRoutes" in routes
      ? routes
      : createRouter({ history: createMemoryHistory(), routes: [...routes] });
  const views = new Set(
    router
      .getRoutes()
      .filter((record) => !record.redirect && Object.keys(record.components ?? {}).length > 0)
      .map((record) => record.path),
  );
  // eslint-disable-next-line unicorn/no-array-sort -- sorts a fresh copy; toSorted is ES2023
  const sorted = [...views].sort((left, right) => left.localeCompare(right));
  return [
    ...sorted.map((key) => ({ kind: "view" as const, key })),
    ...[...new Set(features)].map((key) => ({ kind: "feature" as const, key })),
  ];
};
