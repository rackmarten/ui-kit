import type { RouteLocationNormalized, Router } from "vue-router";

// Which pages an app's users open, how long they spend where, and which
// marked controls they use, posted to server-kit's usage relay route.
//
// - `view`: one per navigation to a new path, named by its route pattern
//   (`/tasks/:id`), never the URL, so no ids, params or query strings.
// - `active`: seconds (1-60) per minute, route and module. Active means the
//   page is visible, the window has focus, and there was mouse, keyboard,
//   touch or scroll input in the last USAGE_IDLE_MS. The module is the
//   closest `data-module="<name>"` around whatever was last touched, else
//   the route's name (or its first static segment).
// - `click`: one per click on an element inside `data-track="<feature>"`,
//   or per `trackUsage(feature)` call. Only the feature name is sent.
//
// Events are batched in memory and sent every USAGE_FLUSH_MS, and with
// sendBeacon when the page is hidden (which cannot set headers, hence
// `?client=pwa`).

export const USAGE_IDLE_MS = 30_000;
export const USAGE_TICK_MS = 5000;
export const USAGE_FLUSH_MS = 60_000;
export const USAGE_EVENTS_URL = "/api/usage/events";
// sendBeacon and keepalive fetches cap a body at 64 KiB.
const MAX_EVENTS_PER_SEND = 200;
const MINUTE_MS = 60_000;

// server-kit's ClientUsageEvent: what the relay route accepts.
export interface ClientUsageEvent {
  ts: string;
  kind: "view" | "active" | "click";
  route: string;
  module?: string;
  feature?: string;
  value?: number;
}

export type UsageSend = (events: ClientUsageEvent[], beacon: boolean) => void;

export interface UsageTrackerEnv {
  now(): number;
  isVisible(): boolean;
  hasFocus(): boolean;
  send: UsageSend;
}

interface ActiveTime {
  minute: number;
  route: string;
  module: string;
  ms: number;
}

const minuteStart = (ms: number): number => Math.floor(ms / MINUTE_MS) * MINUTE_MS;
const iso = (ms: number): string => new Date(ms).toISOString();

export class UsageTracker {
  private lastInput = Number.NEGATIVE_INFINITY;
  private lastTick: number;
  private route: string | null = null;
  private routeModule = "";
  private module: string | null = null;
  private events: ClientUsageEvent[] = [];
  private active = new Map<string, ActiveTime>();
  // Visible and focused as of the last tick.
  private wasActive: boolean;

  constructor(private readonly env: UsageTrackerEnv) {
    this.lastTick = env.now();
    this.wasActive = env.isVisible() && env.hasFocus();
  }

  // A navigation: credits the time so far to the old route, then counts the
  // new one. `routeModule` is what its time counts as outside a data-module.
  view(route: string, routeModule: string): void {
    this.tick();
    this.route = route;
    this.routeModule = routeModule;
    this.module = null;
    this.events.push({ ts: iso(this.env.now()), kind: "view", route });
  }

  // Any input. `module` is the data-module around its target, if any;
  // undefined (a document scroll, say) keeps the current one.
  input(module?: string | null): void {
    this.tick();
    this.lastInput = this.env.now();
    if (module !== undefined) this.module = module;
  }

  click(feature: string, module: string | null = null): void {
    this.input(module);
    this.track(feature, module);
  }

  track(feature: string, module: string | null = null): void {
    if (!this.route || !feature) return;
    const event: ClientUsageEvent = {
      ts: iso(this.env.now()),
      kind: "click",
      route: this.route,
      feature,
    };
    if (module) event.module = module;
    this.events.push(event);
  }

  // Credits the time since the last tick that was active: visible, focused,
  // and no later than USAGE_IDLE_MS after the last input. Time that spans a
  // minute boundary is split between the two minutes. `isEnding` is a blur
  // or hide being handled: the page already reports it, but was active
  // until just now if it was at the last tick.
  tick(isEnding = false): void {
    const now = this.env.now();
    let from = this.lastTick;
    this.lastTick = now;
    const isActive = this.env.isVisible() && this.env.hasFocus();
    const shouldCount = isActive || (isEnding && this.wasActive);
    this.wasActive = isActive;
    if (!this.route || !shouldCount) return;
    const until = Math.min(now, this.lastInput + USAGE_IDLE_MS);
    const module = this.module ?? this.routeModule;
    while (from < until) {
      const minute = minuteStart(from);
      const end = Math.min(until, minute + MINUTE_MS);
      const key = `${String(minute)}\u0000${this.route}\u0000${module}`;
      const found = this.active.get(key);
      if (found) found.ms += end - from;
      else this.active.set(key, { minute, route: this.route, module, ms: end - from });
      from = end;
    }
  }

  // The window lost focus: credit what came before, then stop.
  pause(): void {
    this.tick(true);
  }

  // The page is back: what passed while it was away was not active.
  resume(): void {
    this.lastTick = this.env.now();
    this.wasActive = this.env.isVisible() && this.env.hasFocus();
  }

  // Sends and clears the batch. Active time is held until its minute is
  // over, so a minute is normally one event per route and module; `all`
  // (the page is hidden, or tracking stops) sends the current minute too.
  // Seconds are whole: the current minute keeps its remainder for the next
  // flush, a finished minute's remainder under one second is dropped.
  flush(all = false, beacon = all): ClientUsageEvent[] {
    this.tick(all);
    const current = minuteStart(this.env.now());
    const events = this.events;
    this.events = [];
    for (const [key, entry] of this.active) {
      const isOpen = entry.minute >= current;
      if (!all && isOpen) continue;
      const value = Math.min(60, Math.floor(entry.ms / 1000));
      if (isOpen) entry.ms -= value * 1000;
      else this.active.delete(key);
      if (value < 1) continue;
      const { route, module } = entry;
      events.push({ ts: iso(entry.minute), kind: "active", route, module, value });
    }
    for (let i = 0; i < events.length; i += MAX_EVENTS_PER_SEND) {
      this.env.send(events.slice(i, i + MAX_EVENTS_PER_SEND), beacon);
    }
    return events;
  }
}

// The route pattern of the page (`/tasks/:id`), never its URL.
export const usageRoute = (route: RouteLocationNormalized): string =>
  route.matched.at(-1)?.path ?? (typeof route.name === "string" ? route.name : "unmatched");

// What a route's time counts as outside a data-module: its name, else its
// first static segment ("/tasks/:id" -> "tasks"), else "home".
export const usageModule = (route: RouteLocationNormalized): string => {
  if (typeof route.name === "string" && route.name) return route.name;
  return (
    usageRoute(route)
      .split("/")
      .find((segment) => segment && !segment.startsWith(":")) ?? "home"
  );
};

// Undefined when the target is not an element (a document scroll).
const moduleOf = (target: EventTarget | null): string | null | undefined => {
  if (!(target instanceof Element)) return undefined;
  return target.closest<HTMLElement>("[data-module]")?.dataset.module || null;
};

const featureOf = (target: EventTarget | null): string | null => {
  const element = target instanceof Element ? target.closest<HTMLElement>("[data-track]") : null;
  return element?.dataset.track || null;
};

// Periodic batches go by fetch with `x-homelab-client: pwa`; the one sent as
// the page is hidden goes by sendBeacon, which survives the page closing.
export const createUsageSend =
  (url = USAGE_EVENTS_URL): UsageSend =>
  (events, beacon) => {
    const body = JSON.stringify({ events });
    const beaconUrl = `${url}${url.includes("?") ? "&" : "?"}client=pwa`;
    const canBeacon = beacon && typeof navigator.sendBeacon === "function";
    if (canBeacon && navigator.sendBeacon(beaconUrl, body)) return;
    fetch(url, {
      method: "POST",
      keepalive: true,
      headers: { "content-type": "application/json", "x-homelab-client": "pwa" },
      body,
    }).catch(() => {});
  };

export interface UsageTrackerOptions {
  // server-kit's relay route. Default `/api/usage/events`.
  url?: string;
  // Replaces the fetch/sendBeacon delivery, e.g. in tests.
  send?: UsageSend;
}

const INPUT_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "wheel", "scroll"];

// The one tracker running in the page, which trackUsage() records into.
let running: UsageTracker | null = null;

// A programmatic `click` event for `feature` on the current route; nothing
// while tracking is off.
export const trackUsage = (feature: string): void => {
  running?.track(feature);
};

// Wires a tracker to the window and the router. Returns the function that
// stops it, sending what it still holds. While one is running, another
// start does nothing (and its stop is a no-op).
export const startUsageTracking = (
  router: Router,
  options: UsageTrackerOptions = {},
): (() => void) => {
  if (running || typeof document === "undefined") return () => {};
  const win = globalThis;
  const doc = document;
  const tracker = new UsageTracker({
    now: () => Date.now(),
    isVisible: () => doc.visibilityState === "visible",
    hasFocus: () => doc.hasFocus(),
    send: options.send ?? createUsageSend(options.url),
  });
  running = tracker;

  const onView = (route: RouteLocationNormalized) => {
    tracker.view(usageRoute(route), usageModule(route));
  };
  // Started after the first navigation: count the page already shown.
  if (router.currentRoute.value.matched.length > 0) onView(router.currentRoute.value);
  // A query or hash change on the same path is not a new view.
  const removeAfterEach = router.afterEach((to, from, failure) => {
    if (!failure && (from.matched.length === 0 || to.path !== from.path)) onView(to);
  });

  const onInput = (event: Event) => {
    tracker.input(moduleOf(event.target));
  };
  const onClick = (event: Event) => {
    const feature = featureOf(event.target);
    if (feature) tracker.click(feature, moduleOf(event.target) ?? null);
    else tracker.input(moduleOf(event.target));
  };
  const onVisibility = () => {
    if (doc.visibilityState === "visible") tracker.resume();
    else tracker.flush(true);
  };
  const onBlur = () => {
    tracker.pause();
  };
  const onFocus = () => {
    tracker.resume();
  };
  const onPageHide = () => {
    tracker.flush(true);
  };
  const listenerOptions = { capture: true, passive: true };
  for (const name of INPUT_EVENTS) win.addEventListener(name, onInput, listenerOptions);
  win.addEventListener("click", onClick, listenerOptions);
  doc.addEventListener("visibilitychange", onVisibility);
  win.addEventListener("blur", onBlur);
  win.addEventListener("focus", onFocus);
  win.addEventListener("pagehide", onPageHide);
  const ticker = setInterval(() => {
    tracker.tick();
  }, USAGE_TICK_MS);
  const flusher = setInterval(() => {
    tracker.flush();
  }, USAGE_FLUSH_MS);

  return () => {
    removeAfterEach();
    for (const name of INPUT_EVENTS) win.removeEventListener(name, onInput, listenerOptions);
    win.removeEventListener("click", onClick, listenerOptions);
    doc.removeEventListener("visibilitychange", onVisibility);
    win.removeEventListener("blur", onBlur);
    win.removeEventListener("focus", onFocus);
    win.removeEventListener("pagehide", onPageHide);
    clearInterval(ticker);
    clearInterval(flusher);
    tracker.flush(true);
    running = null;
  };
};
