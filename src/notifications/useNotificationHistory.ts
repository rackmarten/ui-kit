import { ref, watch, type Ref } from "vue";
import type { BellNotification, NotificationSource } from "./useNotificationBell.js";

export const DEFAULT_HISTORY_PAGE = 50;

// State and actions behind NotificationsView.vue (the bell's "See all"),
// kept free of Vuetify so it can be unit tested. Pages by id, newest first.
export const useNotificationHistory = (
  source: NotificationSource,
  pageSize = DEFAULT_HISTORY_PAGE,
): {
  items: Ref<BellNotification[]>;
  unreadOnly: Ref<boolean>;
  loading: Ref<boolean>;
  exhausted: Ref<boolean>;
  load: (reset: boolean) => Promise<void>;
  openItem: (notification: BellNotification) => Promise<string | null>;
  readAll: () => Promise<void>;
} => {
  const items: Ref<BellNotification[]> = ref([]);
  const unreadOnly = ref(false);
  const loading = ref(false);
  const exhausted = ref(false);

  const load = async (reset: boolean): Promise<void> => {
    loading.value = true;
    try {
      const beforeId = reset ? undefined : items.value.at(-1)?.id;
      const page = await source.list({ limit: pageSize, beforeId, unread: unreadOnly.value });
      items.value = reset ? page : [...items.value, ...page];
      exhausted.value = page.length < pageSize;
    } finally {
      loading.value = false;
    }
  };

  // Marks the item read (if needed) and returns the route to open, if any.
  const openItem = async (notification: BellNotification): Promise<string | null> => {
    if (!notification.readAt) {
      await source.markRead(notification.id);
      notification.readAt = new Date().toISOString();
    }
    return notification.url ?? null;
  };

  const readAll = async (): Promise<void> => {
    await source.markAllRead();
    await load(true);
  };

  watch(unreadOnly, () => void load(true));

  return { items, unreadOnly, loading, exhausted, load, openItem, readAll };
};
