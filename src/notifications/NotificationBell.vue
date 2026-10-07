<script setup lang="ts">
// Drop into AppShell's #app-bar-actions slot with the app's own source.
import { useRouter } from "vue-router";
import { useBackClose } from "../composables/useBackClose.js";
import {
  badgeContent,
  relativeTime,
  useNotificationBell,
  type BellNotification,
  type NotificationSource,
} from "./useNotificationBell.js";

const props = defineProps<{
  source: NotificationSource;
  // Route of the app's full history page; the "See all" button hides without it.
  seeAllTo?: string;
  pollIntervalMs?: number;
  limit?: number;
}>();

const router = useRouter();
const { unread, open, items, openItem, readAll } = useNotificationBell(props.source, {
  pollIntervalMs: props.pollIntervalMs,
  limit: props.limit,
});
useBackClose(open);

// Inline rather than a <style> block: ui-kit ships no CSS file of its own.
const unreadStyle = { background: "rgba(var(--v-theme-primary), 0.08)" };

const onItem = async (notification: BellNotification): Promise<void> => {
  const url = await openItem(notification);
  if (url) await router.push(url);
};
</script>

<template>
  <v-menu v-model="open" location="bottom end" :close-on-content-click="false" max-width="420">
    <template #activator="{ props: menuProps }">
      <v-btn icon variant="text" v-bind="menuProps" aria-label="Notifications">
        <v-badge :model-value="unread > 0" :content="badgeContent(unread)" color="error">
          <v-icon>mdi-bell-outline</v-icon>
        </v-badge>
      </v-btn>
    </template>
    <v-card min-width="320">
      <v-card-title class="d-flex align-center text-subtitle-1">
        Notifications
        <v-spacer />
        <v-btn size="small" variant="text" :disabled="unread === 0" @click="readAll"
          >Mark all read</v-btn
        >
      </v-card-title>
      <v-divider />
      <v-list density="compact" max-height="420" class="overflow-y-auto">
        <v-list-item v-if="items.length === 0" subtitle="Nothing yet" />
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
            <span v-if="n.body">{{ n.body }} · </span>{{ relativeTime(n.createdAt) }}
          </v-list-item-subtitle>
        </v-list-item>
      </v-list>
      <template v-if="seeAllTo">
        <v-divider />
        <v-card-actions>
          <v-btn block variant="text" :to="seeAllTo" @click="open = false">See all</v-btn>
        </v-card-actions>
      </template>
    </v-card>
  </v-menu>
</template>
