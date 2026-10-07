<script setup lang="ts">
// Drop into AppShell's #app-bar-actions slot with the app's own provider.
// A dialog rather than an inline toolbar field so it doesn't fight the app
// bar for space on mobile.
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { useBackClose } from "../composables/useBackClose.js";
import { useGlobalSearch, type SearchProvider, type SearchResult } from "./useGlobalSearch.js";
import { isTypingTarget } from "./typingTarget.js";

const props = withDefaults(
  defineProps<{
    provider: SearchProvider;
    placeholder?: string;
    label?: string;
    emptyText?: string;
    debounceMs?: number;
  }>(),
  { placeholder: "Search...", label: "Search", emptyText: "No matches", debounceMs: undefined },
);

const open = ref(false);
useBackClose(open);
const { query, groups, loading, failed, firstResult, reset } = useGlobalSearch(props.provider, {
  debounceMs: props.debounceMs,
});
const fieldRef = ref<{ focus: () => void } | null>(null);
const router = useRouter();

// Pinned near the top instead of centred, so results grow downwards.
const contentProps = { style: { alignSelf: "flex-start", marginTop: "72px" } };

watch(open, (value) => {
  if (value) void nextTick(() => fieldRef.value?.focus());
  else reset();
});

const go = (result: SearchResult): void => {
  open.value = false;
  void router.push(result.to);
};

// '/' opens search from anywhere on the page, unless you're typing.
const onSlash = (event: KeyboardEvent): void => {
  if (event.key !== "/" || open.value || event.ctrlKey || event.metaKey || event.altKey) return;
  if (isTypingTarget(event.target)) return;
  event.preventDefault();
  open.value = true;
};
onMounted(() => {
  globalThis.addEventListener("keydown", onSlash);
});
onBeforeUnmount(() => {
  globalThis.removeEventListener("keydown", onSlash);
});

const onEnter = (): void => {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- firstResult's public type omits null, but it is null when nothing matches
  if (firstResult.value) go(firstResult.value);
};
</script>

<template>
  <v-btn icon="mdi-magnify" :aria-label="label" title="Search (/)" @click="open = true" />

  <v-dialog v-model="open" max-width="560" scrollable :content-props="contentProps">
    <v-card>
      <v-card-text class="pa-2">
        <v-text-field
          ref="fieldRef"
          v-model="query"
          :placeholder="placeholder"
          prepend-inner-icon="mdi-magnify"
          variant="solo"
          density="comfortable"
          hide-details
          autofocus
          clearable
          :loading="loading"
          @keydown.enter="onEnter"
        />

        <v-list v-if="groups.length > 0" class="mt-2" density="compact">
          <template v-for="group in groups" :key="group.label">
            <v-list-subheader v-if="groups.length > 1">{{ group.label }}</v-list-subheader>
            <v-list-item
              v-for="result in group.results"
              :key="`${group.label}:${result.key}`"
              :title="result.title"
              :subtitle="result.subtitle"
              :prepend-icon="result.icon"
              @click="go(result)"
            />
          </template>
        </v-list>
        <div
          v-else-if="(query as string | null)?.trim() && !loading"
          class="text-medium-emphasis text-body-2 pa-4 text-center"
        >
          {{ failed ? "Search failed" : emptyText }}
        </div>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>
