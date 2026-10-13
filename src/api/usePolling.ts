import { getCurrentInstance, getCurrentScope, onMounted, onScopeDispose, ref, type Ref } from "vue";

export interface PollingOptions {
  // Load at start instead of waiting for the first interval. Default true.
  immediate?: boolean;
  // Skip ticks while the page is hidden, refresh once when it's shown again.
  // Default true.
  pauseWhenHidden?: boolean;
}

export interface Polling<T> {
  // The last successful result; kept when a later load fails.
  // eslint-disable-next-line id-denylist -- the conventional name for a composable's loaded value
  data: Ref<T | null>;
  error: Ref<string | null>;
  loading: Ref<boolean>;
  refresh(): Promise<void>;
}

// Runs `load` every `intervalMs` while the calling component is mounted (or,
// outside a component, from now until the effect scope is disposed). Never
// runs two loads at once: a refresh during a load joins the one in flight.
export const usePolling = <T>(
  load: () => Promise<T>,
  intervalMs = 5000,
  options: PollingOptions = {},
): Polling<T> => {
  const shouldPauseWhenHidden = options.pauseWhenHidden ?? true;
  const result = ref(null) as Ref<T | null>;
  const error = ref<string | null>(null);
  const loading = ref(false);
  let inFlight: Promise<void> | null = null;
  let timer: ReturnType<typeof setInterval> | undefined;
  let isStopped = false;

  const refresh = (): Promise<void> => {
    inFlight ??= (async () => {
      loading.value = true;
      try {
        result.value = await load();
        error.value = null;
      } catch (error_) {
        error.value = error_ instanceof Error ? error_.message : String(error_);
      } finally {
        loading.value = false;
        inFlight = null;
      }
    })();
    return inFlight;
  };

  const isHidden = () =>
    shouldPauseWhenHidden && typeof document !== "undefined" && document.hidden;

  const onVisibilityChange = () => {
    if (!document.hidden) void refresh();
  };

  const start = () => {
    if (isStopped) return;
    if ((options.immediate ?? true) && !isHidden()) void refresh();
    timer = setInterval(() => {
      if (!isHidden()) void refresh();
    }, intervalMs);
    if (shouldPauseWhenHidden && typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibilityChange);
    }
  };

  const stop = () => {
    isStopped = true;
    clearInterval(timer);
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", onVisibilityChange);
    }
  };

  if (getCurrentInstance()) onMounted(start);
  else start();
  // A component's setup scope is disposed on unmount.
  if (getCurrentScope()) onScopeDispose(stop);

  // eslint-disable-next-line id-denylist -- see Polling.data
  return { data: result, error, loading, refresh };
};
