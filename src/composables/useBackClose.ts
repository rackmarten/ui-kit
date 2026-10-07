import { onScopeDispose, watch, type Ref } from "vue";
import type { Router } from "vue-router";

// Back closes the topmost open overlay (dialog, drawer, menu, bottom sheet)
// instead of leaving the page or, on the first page of an installed PWA,
// exiting the app.
//
// Opening pushes a same-URL history entry tagged with the overlay's id, so
// there is always something for back to pop. The popstate that pops it is
// caught in the capture phase and stopped, so neither vue-router (which would
// re-run navigation for the same URL) nor Vuetify's own closeOnBack (which
// only works when there's an earlier entry to cancel) sees it. Closing from
// the UI consumes the entry again with history.back(), and a link followed
// from inside an overlay replaces its entry (see installBackClose) so the
// history doesn't keep a stale same-URL step.
//
// Chrome skips entries pushed without a user gesture when going back, so an
// overlay should open from a click/tap, not on its own at page load.

const STATE_KEY = "hlOverlay";

interface OverlayEntry {
  id: number;
  href: string;
  close: () => void;
}

const stack: OverlayEntry[] = [];
let lastId = 0;
let ownPops = 0;
let isListening = false;
// Set between installBackClose's beforeEach and afterEach. A step back queued
// while a navigation is in flight waits for it to settle (see release).
let isNavigating = false;
let afterNavigation: (() => void)[] = [];

const stateId = (state: unknown): number | undefined => {
  const id = (state as Record<string, unknown> | null)?.[STATE_KEY];
  return typeof id === "number" ? id : undefined;
};

const onPopState = (event: PopStateEvent): void => {
  if (ownPops > 0) {
    // Our own history.back() after a UI close - nothing to navigate.
    ownPops--;
    event.stopImmediatePropagation();
    return;
  }
  const landedOn = stateId(event.state);
  const closing: OverlayEntry[] = [];
  // Ids only grow, so every overlay newer than the entry we landed on is gone.
  for (
    let top = stack.at(-1);
    top && (landedOn === undefined || top.id > landedOn);
    top = stack.at(-1)
  ) {
    closing.push(top);
    stack.pop();
  }
  const oldest = closing.at(-1);
  if (!oldest) return;
  // Back that also left the page (several steps at once) is a real navigation
  // the router must handle; a pop that stays on the same URL is only ours.
  if (globalThis.location.href === oldest.href) event.stopImmediatePropagation();
  for (const entry of closing) entry.close();
};

const ensureListener = (): void => {
  if (isListening || !("window" in globalThis)) return;
  globalThis.addEventListener("popstate", onPopState, { capture: true });
  isListening = true;
};

const release = (entry: OverlayEntry): void => {
  const index = stack.indexOf(entry);
  if (index === -1) return;
  stack.splice(index, 1);
  // A tap on a drawer link closes the drawer and navigates in the same tick.
  // Wait for that navigation (which replaces this entry) before deciding, and
  // only step back if we're still on this overlay's own entry - otherwise
  // going back would undo the navigation. Other guards can hold a navigation
  // past this timeout (Vuetify's closeOnBack defers every one by a tick), so
  // a navigation still in flight is waited out too.
  const stepBack = () => {
    if (stateId(globalThis.history.state) !== entry.id) return;
    ownPops++;
    globalThis.history.back();
  };
  setTimeout(() => {
    if (isNavigating) afterNavigation.push(stepBack);
    else stepBack();
  }, 0);
};

const settleNavigation = (): void => {
  isNavigating = false;
  const queued = afterNavigation;
  afterNavigation = [];
  for (const step of queued) step();
};

// Navigating away while an overlay entry is current replaces that entry
// instead of pushing past it. This checks the entry, not the stack: a drawer
// link has already closed (released) its drawer by the time the guard runs.
// createHomelabRouter calls this; an app with its own router can too.
export const installBackClose = (router: Router): void => {
  router.beforeEach((to) => {
    isNavigating = true;
    if (to.redirectedFrom || stateId(globalThis.history.state) === undefined) return;
    return { path: to.path, query: to.query, hash: to.hash, replace: true };
  });
  router.afterEach(() => {
    // An overlay left open across a navigation no longer owns an entry on
    // this page; it closes later without stepping back.
    for (let index = stack.length - 1; index >= 0; index--) {
      if (stack[index].href !== globalThis.location.href) stack.splice(index, 1);
    }
    // vue-router's replace copies the current state, tag included; drop a tag
    // no open overlay owns so the new page's entry is a plain one again.
    const id = stateId(globalThis.history.state);
    if (id !== undefined && !stack.some((entry) => entry.id === id)) {
      const rest = Object.fromEntries(
        Object.entries(globalThis.history.state as Record<string, unknown>).filter(
          ([key]) => key !== STATE_KEY,
        ),
      );
      globalThis.history.replaceState(rest, "");
    }
    settleNavigation();
  });
  // A navigation that throws never reaches afterEach.
  router.onError(() => {
    settleNavigation();
  });
};

export const useBackClose = (open: Ref<boolean>): void => {
  if (!("window" in globalThis)) return;
  ensureListener();
  let entry: OverlayEntry | null = null;

  watch(
    open,
    (isOpen) => {
      if (isOpen && !entry) {
        lastId = Math.max(Date.now(), lastId + 1);
        const opened: OverlayEntry = {
          id: lastId,
          href: globalThis.location.href,
          close: () => {
            entry = null;
            open.value = false;
          },
        };
        entry = opened;
        stack.push(opened);
        // Keep vue-router's own state fields so its position bookkeeping holds.
        globalThis.history.pushState({ ...globalThis.history.state, [STATE_KEY]: opened.id }, "");
      } else if (!isOpen && entry) {
        const closed = entry;
        entry = null;
        release(closed);
      }
    },
    { immediate: true, flush: "sync" },
  );

  onScopeDispose(() => {
    if (!entry) return;
    const closed = entry;
    entry = null;
    release(closed);
  });
};
