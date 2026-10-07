import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { createVuetify } from "vuetify";
import * as components from "vuetify/components";
import { createMemoryHistory, createRouter } from "vue-router";
import GlobalSearch from "../../src/search/GlobalSearch.vue";

const vuetify = createVuetify({ components });
const router = createRouter({
  history: createMemoryHistory(),
  routes: [{ path: "/", component: { template: "<div />" } }],
});
// Exposes the dialog's open state without mounting an overlay.
const vDialogStub = {
  props: ["modelValue"],
  template: '<div data-testid="dialog" :data-open="String(modelValue)" />',
};

const render = () =>
  mount(GlobalSearch, {
    props: { provider: () => Promise.resolve([]) },
    global: { plugins: [vuetify, router], stubs: { VDialog: vDialogStub } },
    attachTo: document.body,
  });

const isOpen = (wrapper: ReturnType<typeof render>) =>
  wrapper.find("[data-testid=dialog]").attributes("data-open");

const press = (target: EventTarget, init: KeyboardEventInit = {}): void => {
  target.dispatchEvent(
    new KeyboardEvent("keydown", { key: "/", bubbles: true, cancelable: true, ...init }),
  );
};

describe("GlobalSearch '/' shortcut", () => {
  it("opens on '/' from the page", async () => {
    const wrapper = render();
    press(document.body);
    await wrapper.vm.$nextTick();
    expect(isOpen(wrapper)).toBe("true");
    wrapper.unmount();
  });

  it("ignores '/' typed into a field or with a modifier, and stops after unmount", async () => {
    const wrapper = render();
    const input = document.createElement("input");
    document.body.append(input);
    press(input);
    press(document.body, { ctrlKey: true });
    await wrapper.vm.$nextTick();
    expect(isOpen(wrapper)).toBe("false");
    input.remove();
    wrapper.unmount();
    // No listener left behind: nothing throws on a stale component.
    press(document.body);
  });
});
