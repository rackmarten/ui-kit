import { inject, onBeforeUnmount, onMounted, toValue, watch, type MaybeRefOrGetter } from "vue";
import { routerKey, type Router } from "vue-router";
import { startUsageTracking, trackUsage, type UsageTrackerOptions } from "./usageTracker.js";

export interface UseUsageTrackerOptions extends UsageTrackerOptions {
  // Default true: calling the composable is the app's opt-in. Read again
  // whenever it changes, so a setting can switch tracking on and off.
  enabled?: MaybeRefOrGetter<boolean>;
  // Default: the app's router.
  router?: Router;
}

export interface UsageTrackerHandle {
  // A `click` event for `feature`, for what has no element to mark with
  // `data-track`.
  track(feature: string): void;
}

// Tracks usage while the calling component is mounted and `enabled` is true.
// AppShell calls this for its `usage` prop.
export const useUsageTracker = (options: UseUsageTrackerOptions = {}): UsageTrackerHandle => {
  const router = options.router ?? inject(routerKey, null);
  const isEnabled = () => toValue(options.enabled ?? true);
  let stop: (() => void) | null = null;
  let isMounted = false;

  const sync = () => {
    const shouldRun = isMounted && isEnabled() && router !== null;
    if (shouldRun && !stop) stop = startUsageTracking(router, options);
    if (!shouldRun && stop) {
      stop();
      stop = null;
    }
  };

  onMounted(() => {
    isMounted = true;
    sync();
  });
  watch(isEnabled, sync);
  onBeforeUnmount(() => {
    isMounted = false;
    sync();
  });

  return { track: trackUsage };
};
