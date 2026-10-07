<script setup lang="ts">
// Full history behind NotificationBell's "See all". The
// `before-list` slot is for app-specific extras such as a Web Push toggle.
import { onMounted } from "vue";
import { useRouter } from "vue-router";
import { relativeTime, type NotificationSource } from "../notifications/useNotificationBell.js";
import { useNotificationHistory } from "../notifications/useNotificationHistory.js";

const props = withDefaults(
  defineProps<{ source: NotificationSource; title?: string; pageSize?: number }>(),
  {
    title: "Notifications",
    pageSize: 50,
  },
);

const router = useRouter();
const { items, unreadOnly, loading, exhausted, load, openItem, readAll } = useNotificationHistory(
  props.source,
  props.pageSize,
);

// Inline rather than a <style> block: ui-kit ships no CSS file of its own.
const unreadStyle = { background: "rgba(var(--v-theme-primary), 0.08)" };

const onItem = async (notification: (typeof items.value)[number]): Promise<void> => {
  const url = await openItem(notification);
  if (url) await router.push(url);
};

onMounted(() => void load(true));
</script>

<template>
  <v-container>
    <div class="d-flex align-center flex-wrap ga-2 mb-2">
      <h1 class="text-h5">{{ title }}</h1>
      <v-spacer />
      <v-switch
        v-model="unreadOnly"
        label="Unread only"
        density="compact"
        hide-details
        color="primary"
      />
      <v-btn variant="tonal" size="small" @click="readAll">Mark all read</v-btn>
    </div>
    <slot name="before-list" />
    <v-card>
      <v-list lines="two">
        <v-list-item v-if="!loading && items.length === 0" subtitle="Nothing here" />
        <v-list-item
          v-for="n in items"
          :key="n.id"
          :style="n.readAt ? undefined : unreadStyle"
          @click="onItem(n)"
        >
          <template #prepend>
            <v-icon :color="n.color ?? 'primary'">{{ n.icon ?? "mdi-bell-outline" }}</v-icon>
          </template>
          <v-list-item-title class="text-wrap">{{ n.title }}</v-list-item-title>
          <v-list-item-subtitle>
            <span v-if="n.body">{{ n.body }} · </span>
            <span :title="new Date(n.createdAt).toLocaleString()">{{
              relativeTime(n.createdAt)
            }}</span>
          </v-list-item-subtitle>
        </v-list-item>
      </v-list>
    </v-card>
    <div class="text-center mt-2">
      <v-btn v-if="!exhausted" variant="text" :loading="loading" @click="load(false)"
        >Load more</v-btn
      >
    </div>
  </v-container>
</template>
