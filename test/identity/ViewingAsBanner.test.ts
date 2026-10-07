import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { createVuetify } from "vuetify";
import * as components from "vuetify/components";
import ViewingAsBanner from "../../src/identity/ViewingAsBanner.vue";
import { useHomelabUser, type HomelabUser } from "../../src/identity/useHomelabUser.js";

const jana: HomelabUser = { id: "p2", name: "Jana", roles: [], groups: ["family"], services: [] };
const vuetify = createVuetify({ components });
const render = (user: HomelabUser | null) =>
  mount(ViewingAsBanner, { props: { user }, global: { plugins: [vuetify] } });

describe("ViewingAsBanner", () => {
  it("shows the viewed person and the admin behind it when act is present", () => {
    const text = render({ ...jana, actor: { id: "p1", name: "Marek" } }).text();
    expect(text).toContain("Viewing as Jana");
    expect(text).toContain("read-only");
    expect(text).toContain("You are Marek");
  });

  it("renders nothing for a normal user or no user", () => {
    expect(render(jana).find("[data-testid=viewing-as]").exists()).toBe(false);
    expect(render(null).find("[data-testid=viewing-as]").exists()).toBe(false);
  });
});

const respond = (status: number, body: unknown) =>
  vi.fn(() =>
    Promise.resolve(
      Response.json(body, {
        status,
        headers: { "content-type": "application/json" },
      }),
    ),
  );

describe("useHomelabUser", () => {
  it("loads /api/me", async () => {
    const fetch = respond(200, jana);
    const { user, loaded } = useHomelabUser({ fetch });
    await loaded;
    expect(fetch).toHaveBeenCalledWith("/api/me", expect.anything());
    expect(user.value?.name).toBe("Jana");
  });

  it("stays null on 401, 404, non-JSON or a network error", async () => {
    for (const fetch of [
      respond(401, { error: "missing" }),
      respond(404, {}),
      vi.fn(() => Promise.resolve(new Response("<html>", { status: 200 }))),
      vi.fn(() => Promise.reject(new Error("down"))),
    ]) {
      const { user, loaded } = useHomelabUser({ fetch });
      await loaded;
      expect(user.value).toBeNull();
    }
  });
});
