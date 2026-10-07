import { computed, onScopeDispose, ref, watch, type ComputedRef, type Ref } from "vue";

// Top-bar global search. The app supplies a provider; the kit owns the debounce, the stale
// response guard and the dialog.
export interface SearchResult {
  // Unique within its group.
  key: string | number;
  title: string;
  subtitle?: string;
  icon?: string;
  // Route pushed through vue-router when the result is picked.
  to: string;
}

export interface SearchGroup {
  label: string;
  results: SearchResult[];
}

export type SearchProvider = (term: string) => Promise<SearchGroup[]>;

export const DEFAULT_SEARCH_DEBOUNCE_MS = 250;

export const useGlobalSearch = (
  provider: SearchProvider,
  options: { debounceMs?: number } = {},
): {
  query: Ref<string>;
  groups: ComputedRef<SearchGroup[]>;
  loading: Ref<boolean>;
  failed: Ref<boolean>;
  firstResult: ComputedRef<SearchResult>;
  reset: () => void;
} => {
  const debounceMs = options.debounceMs ?? DEFAULT_SEARCH_DEBOUNCE_MS;
  const query = ref("");
  const groups: Ref<SearchGroup[]> = ref([]);
  const loading = ref(false);
  const failed = ref(false);
  // Empty groups are dropped so the dialog never shows a bare header.
  const visibleGroups = computed(() => groups.value.filter((group) => group.results.length > 0));
  // Public type predates this refactor (it was inferred without the null);
  // kept to avoid an API change, the value is still null when nothing matches.
  const firstResult = computed(
    () => (visibleGroups.value.at(0)?.results.at(0) ?? null) as SearchResult,
  );

  let debounceHandle: ReturnType<typeof setTimeout> | undefined;
  let requestId = 0;

  const runSearch = async (term: string, thisRequest: number): Promise<void> => {
    try {
      const result = await provider(term);
      if (thisRequest === requestId) {
        groups.value = result;
        failed.value = false;
      }
    } catch {
      if (thisRequest === requestId) {
        groups.value = [];
        failed.value = true;
      }
    } finally {
      if (thisRequest === requestId) loading.value = false;
    }
  };

  // The model is null at runtime after a clearable field's clear button.
  watch(query, (value: string | null) => {
    clearTimeout(debounceHandle);
    const term = (value ?? "").trim();
    // Invalidate anything in flight so a late answer can't overwrite this.
    const thisRequest = ++requestId;
    if (!term) {
      groups.value = [];
      loading.value = false;
      failed.value = false;
      return;
    }
    loading.value = true;
    debounceHandle = setTimeout(() => {
      void runSearch(term, thisRequest);
    }, debounceMs);
  });

  const reset = (): void => {
    query.value = "";
  };

  onScopeDispose(() => {
    clearTimeout(debounceHandle);
  });

  return { query, groups: visibleGroups, loading, failed, firstResult, reset };
};
