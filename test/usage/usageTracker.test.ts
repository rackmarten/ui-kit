import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryHistory, createRouter, type Router } from "vue-router";
import {
  createUsageSend,
  startUsageTracking,
  trackUsage,
  USAGE_FLUSH_MS,
  USAGE_IDLE_MS,
  USAGE_TICK_MS,
  UsageTracker,
  type ClientUsageEvent,
} from "../../src/usage/usageTracker.js";

const START = Date.UTC(2026, 10, 7, 12, 0, 0);

const setup = () => {
  const state = { now: START, isVisible: true, hasFocus: true };
  const sent: { events: ClientUsageEvent[]; beacon: boolean }[] = [];
  const tracker = new UsageTracker({
    now: () => state.now,
    isVisible: () => state.isVisible,
    hasFocus: () => state.hasFocus,
    send: (events, beacon) => sent.push({ events, beacon }),
  });
  tracker.view("/items", "items");
  const advance = (ms: number) => {
    for (let left = ms; left > 0; left -= USAGE_TICK_MS) {
      state.now += Math.min(USAGE_TICK_MS, left);
      tracker.tick();
    }
  };
  return { state, sent, tracker, advance };
};

const of = (events: ClientUsageEvent[], kind: ClientUsageEvent["kind"]) =>
  events.filter((event) => event.kind === kind);
const activeSeconds = (events: ClientUsageEvent[]) =>
  of(events, "active").reduce((sum, event) => sum + (event.value ?? 0), 0);

describe("UsageTracker active time", () => {
  it("counts nothing before any input", () => {
    const { tracker, advance } = setup();
    advance(20_000);
    expect(of(tracker.flush(true), "active")).toEqual([]);
  });

  it("stops counting USAGE_IDLE_MS after the last input", () => {
    const { tracker, advance } = setup();
    tracker.input();
    advance(50_000);
    expect(activeSeconds(tracker.flush(true))).toBe(USAGE_IDLE_MS / 1000);
  });

  it("keeps counting while input continues", () => {
    const { tracker, advance } = setup();
    for (let i = 0; i < 4; i++) {
      tracker.input();
      advance(10_000);
    }
    expect(activeSeconds(tracker.flush(true))).toBe(40);
  });

  it("counts nothing while the tab is hidden", () => {
    const { state, tracker, advance } = setup();
    state.isVisible = false;
    tracker.input();
    advance(10_000);
    expect(of(tracker.flush(true), "active")).toEqual([]);
  });

  it("counts nothing while the window is blurred", () => {
    const { state, tracker, advance } = setup();
    state.hasFocus = false;
    tracker.input();
    advance(10_000);
    expect(of(tracker.flush(true), "active")).toEqual([]);
  });

  it("credits time up to a blur, not after it", () => {
    const { state, tracker, advance } = setup();
    tracker.input();
    advance(10_000);
    state.hasFocus = false;
    tracker.pause();
    advance(10_000);
    state.hasFocus = true;
    tracker.resume();
    expect(activeSeconds(tracker.flush(true))).toBe(10);
  });

  it("credits time up to a hide or blur that falls between ticks", () => {
    const { state, tracker, advance } = setup();
    tracker.input();
    state.now += 3000;
    state.isVisible = false;
    expect(activeSeconds(tracker.flush(true))).toBe(3);
    state.isVisible = true;
    tracker.resume();
    tracker.input();
    state.now += 2000;
    state.hasFocus = false;
    tracker.pause();
    advance(10_000);
    expect(activeSeconds(tracker.flush(true))).toBe(2);
  });

  it("carries the current minute's leftover milliseconds instead of rounding up", () => {
    const { state, tracker } = setup();
    tracker.input();
    state.now += 1500;
    expect(activeSeconds(tracker.flush(true))).toBe(1);
    state.now += 1500;
    expect(activeSeconds(tracker.flush(true))).toBe(2);
  });

  it("attributes time to the module of the last input, else the route's", () => {
    const { tracker, advance } = setup();
    tracker.input("review");
    advance(10_000);
    tracker.input(null);
    advance(5000);
    const active = of(tracker.flush(true), "active");
    expect(active).toContainEqual(expect.objectContaining({ module: "review", value: 10 }));
    expect(active).toContainEqual(expect.objectContaining({ module: "items", value: 5 }));
    expect(active.every((event) => event.route === "/items")).toBe(true);
  });

  it("credits the old route up to a navigation and resets the module", () => {
    const { tracker, advance } = setup();
    tracker.input("review");
    advance(10_000);
    tracker.view("/items/:id", "items");
    advance(5000);
    const active = of(tracker.flush(true), "active");
    expect(active).toEqual([
      expect.objectContaining({ route: "/items", module: "review", value: 10 }),
      expect.objectContaining({ route: "/items/:id", module: "items", value: 5 }),
    ]);
  });

  it("splits time across a minute boundary, one event per minute", () => {
    const { state, tracker, advance } = setup();
    state.now = START + 50_000;
    tracker.resume();
    tracker.input();
    advance(20_000);
    const active = of(tracker.flush(true), "active");
    expect(active.map((event) => [event.ts, event.value])).toEqual([
      ["2026-11-07T12:00:00.000Z", 10],
      ["2026-11-07T12:01:00.000Z", 10],
    ]);
  });

  it("holds the current minute back from a periodic flush", () => {
    const { tracker, advance } = setup();
    tracker.input();
    advance(10_000);
    expect(of(tracker.flush(), "active")).toEqual([]);
    advance(50_000);
    expect(activeSeconds(tracker.flush())).toBe(USAGE_IDLE_MS / 1000);
  });
});

describe("UsageTracker events", () => {
  it("records a view per navigation with its timestamp", () => {
    const { tracker } = setup();
    expect(of(tracker.flush(), "view")).toEqual([
      { ts: "2026-11-07T12:00:00.000Z", kind: "view", route: "/items" },
    ]);
  });

  it("records a click per tracked feature, with its module if any", () => {
    const { tracker } = setup();
    tracker.click("approve", "review");
    tracker.track("export");
    expect(of(tracker.flush(), "click")).toEqual([
      {
        ts: "2026-11-07T12:00:00.000Z",
        kind: "click",
        route: "/items",
        feature: "approve",
        module: "review",
      },
      { ts: "2026-11-07T12:00:00.000Z", kind: "click", route: "/items", feature: "export" },
    ]);
  });

  it("sends once and empties the batch", () => {
    const { sent, tracker } = setup();
    tracker.flush(true);
    tracker.flush();
    expect(sent).toHaveLength(1);
    expect(sent[0].beacon).toBe(true);
  });

  it("splits a large batch into several sends", () => {
    const { sent, tracker } = setup();
    for (let i = 0; i < 450; i++) tracker.track("spam");
    tracker.flush();
    expect(sent.map((batch) => batch.events.length)).toEqual([200, 200, 51]);
  });
});

describe("createUsageSend", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("beacons to ?client=pwa, and falls back to fetch when the beacon is refused", () => {
    const sendBeacon = vi.fn().mockReturnValueOnce(true).mockReturnValueOnce(false);
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("navigator", { sendBeacon });
    vi.stubGlobal("fetch", fetchMock);
    const send = createUsageSend();
    const events: ClientUsageEvent[] = [{ ts: "t", kind: "click", route: "/", feature: "go" }];
    send(events, true);
    expect(sendBeacon).toHaveBeenCalledWith(
      "/api/usage/events?client=pwa",
      JSON.stringify({ events }),
    );
    expect(fetchMock).not.toHaveBeenCalled();
    send(events, true);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("posts periodic batches with the pwa client header", () => {
    const sendBeacon = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("navigator", { sendBeacon });
    vi.stubGlobal("fetch", fetchMock);
    createUsageSend("/base/api/usage/events")([], false);
    expect(sendBeacon).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      "/base/api/usage/events",
      expect.objectContaining({
        method: "POST",
        keepalive: true,
        headers: expect.objectContaining({ "x-homelab-client": "pwa" }) as unknown,
      }),
    );
  });
});

const click = (id: string) => {
  document.querySelector(`#${id}`)?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
};

describe("startUsageTracking", () => {
  const page = { template: "<div />" };
  let router: Router;
  let visibility: DocumentVisibilityState;
  let sent: { events: ClientUsageEvent[]; beacon: boolean }[];
  let stop: () => void;

  const allEvents = () => sent.flatMap((batch) => batch.events);

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(START);
    visibility = "visible";
    vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility);
    vi.spyOn(document, "hasFocus").mockReturnValue(true);
    router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: "/", component: page },
        { path: "/items/:id", name: "item", component: page },
        { path: "/reports/:year/:month", component: page },
      ],
    });
    await router.push("/");
    sent = [];
    stop = startUsageTracking(router, { send: (events, beacon) => sent.push({ events, beacon }) });
  });

  afterEach(() => {
    stop();
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("records views by route pattern, never params, ids or query strings", async () => {
    await router.push("/items/42?tab=secret#notes");
    await router.push("/items/42?tab=other");
    await router.push("/reports/2026/11");
    vi.advanceTimersByTime(USAGE_FLUSH_MS);
    expect(of(allEvents(), "view").map((event) => event.route)).toEqual([
      "/",
      "/items/:id",
      "/reports/:year/:month",
    ]);
    expect(JSON.stringify(allEvents())).not.toMatch(/42|2026\/11|secret|tab=/);
  });

  it("counts data-track clicks and active time in the nearest data-module", () => {
    document.body.innerHTML = `
      <section data-module="review">
        <button data-track="approve"><span id="label">Approve</span></button>
        <button id="plain">Plain</button>
      </section>
      <p id="outside">Outside</p>`;
    click("label");
    click("plain");
    vi.advanceTimersByTime(USAGE_FLUSH_MS);
    const events = allEvents();
    expect(of(events, "click")).toEqual([
      expect.objectContaining({ route: "/", feature: "approve", module: "review" }),
    ]);
    expect(of(events, "active")).toEqual([
      expect.objectContaining({ route: "/", module: "review", value: USAGE_IDLE_MS / 1000 }),
    ]);
    expect(sent.every((batch) => !batch.beacon)).toBe(true);
  });

  it("keeps the module through a document scroll", () => {
    document.body.innerHTML = `<section data-module="review"><p id="text">Text</p></section>`;
    click("text");
    vi.advanceTimersByTime(USAGE_TICK_MS);
    document.dispatchEvent(new Event("scroll"));
    vi.advanceTimersByTime(USAGE_TICK_MS);
    globalThis.dispatchEvent(new Event("pagehide"));
    expect(of(allEvents(), "active")).toEqual([
      expect.objectContaining({ module: "review", value: 10 }),
    ]);
  });

  it("stops counting on a window blur and starts again on focus", () => {
    const hasFocus = vi.mocked(document.hasFocus);
    globalThis.dispatchEvent(new KeyboardEvent("keydown"));
    vi.advanceTimersByTime(7000);
    hasFocus.mockReturnValue(false);
    globalThis.dispatchEvent(new Event("blur"));
    vi.advanceTimersByTime(20_000);
    hasFocus.mockReturnValue(true);
    globalThis.dispatchEvent(new Event("focus"));
    globalThis.dispatchEvent(new KeyboardEvent("keydown"));
    vi.advanceTimersByTime(5000);
    globalThis.dispatchEvent(new Event("pagehide"));
    expect(activeSeconds(allEvents())).toBe(12);
  });

  it("falls back to the route name, or its first static segment, outside a data-module", async () => {
    document.body.innerHTML = `<p id="outside">Outside</p>`;
    await router.push("/items/7");
    click("outside");
    vi.advanceTimersByTime(10_000);
    await router.push("/reports/2026/1");
    click("outside");
    vi.advanceTimersByTime(10_000);
    globalThis.dispatchEvent(new Event("pagehide"));
    const active = of(allEvents(), "active");
    expect(active).toContainEqual(expect.objectContaining({ route: "/items/:id", module: "item" }));
    expect(active).toContainEqual(
      expect.objectContaining({ route: "/reports/:year/:month", module: "reports" }),
    );
  });

  it("flushes with a beacon when the tab is hidden, and counts nothing while hidden", () => {
    document.body.innerHTML = `<button id="go" data-track="go">Go</button>`;
    click("go");
    vi.advanceTimersByTime(10_000);
    visibility = "hidden";
    document.dispatchEvent(new Event("visibilitychange"));
    expect(sent).toHaveLength(1);
    expect(sent[0].beacon).toBe(true);
    expect(activeSeconds(sent[0].events)).toBe(10);
    expect(of(sent[0].events, "click")).toHaveLength(1);

    globalThis.dispatchEvent(new KeyboardEvent("keydown"));
    vi.advanceTimersByTime(USAGE_FLUSH_MS * 2);
    expect(activeSeconds(allEvents())).toBe(10);
  });

  it("does not count time while the window is blurred", () => {
    vi.mocked(document.hasFocus).mockReturnValue(false);
    globalThis.dispatchEvent(new KeyboardEvent("keydown"));
    vi.advanceTimersByTime(USAGE_FLUSH_MS * 2);
    expect(of(allEvents(), "active")).toEqual([]);
  });

  it("records trackUsage() calls only while running", () => {
    trackUsage("export");
    stop();
    trackUsage("ignored");
    const clicks = of(allEvents(), "click");
    expect(clicks).toEqual([expect.objectContaining({ route: "/", feature: "export" })]);
    expect(sent.at(-1)?.beacon).toBe(true);
  });

  it("sends nothing after it is stopped", () => {
    stop();
    const before = sent.length;
    document.body.innerHTML = `<button id="go" data-track="go">Go</button>`;
    click("go");
    vi.advanceTimersByTime(USAGE_FLUSH_MS * 2);
    expect(sent).toHaveLength(before);
  });

  it("runs one tracker at a time", () => {
    const send = vi.fn();
    const stopSecond = startUsageTracking(router, { send });
    stopSecond();
    trackUsage("still-first");
    vi.advanceTimersByTime(USAGE_FLUSH_MS);
    expect(send).not.toHaveBeenCalled();
    expect(of(allEvents(), "click")).toEqual([expect.objectContaining({ feature: "still-first" })]);
  });
});
