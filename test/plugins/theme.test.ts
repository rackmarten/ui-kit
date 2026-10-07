import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { h } from "vue";
import { VApp, VAppBar, VCard } from "vuetify/components";
import { mix, shiftHue } from "../../src/plugins/color.js";
import {
  createHomelabVuetify,
  glowBackground,
  homelabComponentDefaults,
  mergeDeep,
  themeColors,
} from "../../src/plugins/vuetify.js";

describe("color helpers", () => {
  it("mixes two colours by weight", () => {
    expect(mix("#ffffff", "#000000", 0)).toBe("#000000");
    expect(mix("#ffffff", "#000000", 1)).toBe("#ffffff");
    expect(mix("#ff0000", "#0000ff", 0.5)).toBe("#800080");
    expect(mix("#fff", "#000", 1)).toBe("#ffffff");
  });

  it("rotates hue and keeps a round trip stable", () => {
    expect(shiftHue("#ff0000", 120)).toBe("#00ff00");
    expect(shiftHue("#3fae6a", 0)).toBe("#3fae6a");
    expect(shiftHue("#808080", 90)).toBe("#808080");
  });

  it("rejects non-hex input", () => {
    expect(() => mix("red", "#000000", 0.5)).toThrow(/hex/);
  });
});

describe("themeColors", () => {
  it("keeps the accent as primary and separates the surface tiers", () => {
    for (const isDark of [true, false]) {
      const colors = themeColors(isDark, "#3fae6a");
      expect(colors.primary).toBe("#3fae6a");
      for (const key of ["success", "warning", "error", "info", "secondary"])
        expect(colors[key]).toMatch(/^#[0-9a-f]{6}$/);
      expect(new Set([colors.background, colors.surface, colors["surface-variant"]]).size).toBe(3);
    }
  });

  it("keeps surfaces neutral and darkens the app bar", () => {
    const green = themeColors(true, "#3fae6a");
    expect(green.surface).toBe(themeColors(true, "#ff6b6b").surface);
    expect(green["app-bar"]).toBe("#19462a");
    expect(green["app-bar-end"]).toBe("#194346");
    expect(green.glow).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe("glowBackground", () => {
  it("sizes the glow in vmax and fades it in light mode", () => {
    expect(glowBackground(true)).toContain(
      "rgba(var(--v-theme-primary), 0.16), transparent 60vmax",
    );
    expect(glowBackground(false)).toContain("rgba(var(--v-theme-primary), 0.096)");
    expect(glowBackground(true)).toMatch(/rgb\(var\(--v-theme-background\)\)$/);
  });
});

describe("mergeDeep", () => {
  it("merges nested objects and replaces other values", () => {
    const merged = mergeDeep(
      { nested: { first: 1, second: 2 }, list: [1], keep: true },
      { nested: { second: 3 }, list: [2] },
    );
    expect(merged).toEqual({ nested: { first: 1, second: 3 }, list: [2], keep: true });
  });
});

describe("createHomelabVuetify", () => {
  it("overrides one component default without dropping the rest", () => {
    const vuetify = createHomelabVuetify({
      accent: "#3fae6a",
      overrides: { defaults: { VCard: { elevation: 4 } } },
    });
    const card = mount({ render: () => h(VCard, () => "x") }, { global: { plugins: [vuetify] } });
    expect(card.classes()).toContain("elevation-4");
    expect(card.classes()).toContain("rounded-lg");
    expect(homelabComponentDefaults.VCard.elevation).toBe(1);
  });

  it("paints the app bar with the accent gradient", () => {
    // VApp's layout needs ResizeObserver, which jsdom lacks.
    if (!("ResizeObserver" in globalThis)) {
      globalThis.ResizeObserver = class {
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
      };
    }
    const vuetify = createHomelabVuetify({ accent: "#3fae6a" });
    const wrapper = mount(
      { render: () => h(VApp, () => h(VAppBar)) },
      { global: { plugins: [vuetify] } },
    );
    const header = wrapper.find("header");
    expect(header.classes()).toContain("bg-app-bar");
    expect(header.attributes("style")).toContain("linear-gradient");
  });
});
