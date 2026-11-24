import { describe, expect, it } from "vitest";
import { createMemoryHistory, createRouter, type RouteRecordRaw } from "vue-router";
import { usageInventory } from "../../src/usage/usageInventory.js";

const page = { template: "<div />" };
const routes: RouteRecordRaw[] = [
  { path: "/", component: page },
  { path: "/items/:id", component: page, alias: "/things/:id" },
  { path: "/old", redirect: "/" },
  {
    path: "/settings",
    component: page,
    children: [
      { path: "", component: page },
      { path: "profile", component: page },
    ],
  },
  // Lazy: never loaded just to list the routes.
  {
    path: "/lazy",
    component: () => {
      throw new Error("loaded");
    },
  },
];

describe("usageInventory", () => {
  it("lists the route patterns as views and the declared features", () => {
    expect(usageInventory({ routes, features: ["approve", "export", "approve"] })).toEqual([
      { kind: "view", key: "/" },
      { kind: "view", key: "/items/:id" },
      { kind: "view", key: "/lazy" },
      { kind: "view", key: "/settings" },
      { kind: "view", key: "/settings/profile" },
      { kind: "view", key: "/things/:id" },
      { kind: "feature", key: "approve" },
      { kind: "feature", key: "export" },
    ]);
  });

  it("takes the app's router as well as its records", () => {
    const router = createRouter({ history: createMemoryHistory(), routes });
    expect(usageInventory({ routes: router })).toEqual(usageInventory({ routes }));
  });
});
