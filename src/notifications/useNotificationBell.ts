import { onScopeDispose, ref, watch, type Ref } from "vue";

// The app-bar bell.
// Each app keeps its own notification history in its own backend and hands
// the bell an adapter; the bell only knows this shape.
export interface BellNotification {
  id: string | number;
  title: string;
  body?: string | null;
  // Route to open on tap (pushed through vue-router).
  url?: string | null;
  readAt?: string | null;
  createdAt: string;
  // mdi icon and Vuetify colour; default to a bell in primary.
  icon?: string;
  color?: string;
  // App-defined category, as stored by server-kit's notifications helper.
  kind?: string;
}

export interface ListOptions {
  limit: number;
  // Paging and filtering for NotificationsView; the bell never sets them.
  beforeId?: BellNotification["id"];
  unread?: boolean;
}

export interface NotificationSource {
  list(options: ListOptions): Promise<BellNotification[]>;
  unreadCount(): Promise<number>;
  markRead(id: BellNotification["id"]): Promise<void>;
  markAllRead(): Promise<void>;
  // Optional live updates: call onChange whenever the unread count may have
  // changed, return an unsubscribe. Without it the bell polls unreadCount.
  subscribe?(onChange: () => void): () => void;
}

export interface NotificationBellOptions {
  pollIntervalMs?: number;
  limit?: number;
}

export const DEFAULT_BELL_POLL_MS = 30_000;
export const DEFAULT_BELL_LIMIT = 20;

export const badgeContent = (unread: number): string => (unread > 99 ? "99+" : String(unread));

export const relativeTime = (iso: string, now = Date.now()): string => {
  const secs = Math.round((now - new Date(iso).getTime()) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${String(mins)}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${String(hours)}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${String(days)}d ago`;
  return new Date(iso).toLocaleDateString();
};

// State and actions behind NotificationBell.vue, kept free of Vuetify so it
// can be unit tested. `open` drives the menu: the list is only fetched when
// it opens, the unread count is polled (or pushed via subscribe).
export const useNotificationBell = (
  source: NotificationSource,
  options: NotificationBellOptions = {},
): {
  unread: Ref<number>;
  open: Ref<boolean>;
  items: Ref<BellNotification[]>;
  refreshCount: () => Promise<void>;
  loadList: () => Promise<void>;
  openItem: (notification: BellNotification) => Promise<string | null>;
  readAll: () => Promise<void>;
} => {
  const limit = options.limit ?? DEFAULT_BELL_LIMIT;
  const unread = ref(0);
  const open = ref(false);
  const items: Ref<BellNotification[]> = ref([]);

  const refreshCount = async (): Promise<void> => {
    try {
      unread.value = await source.unreadCount();
    } catch {
      // A failed poll keeps the last known count rather than flashing zero.
    }
  };

  const loadList = async (): Promise<void> => {
    try {
      items.value = await source.list({ limit });
    } catch {
      // Keep whatever was shown last.
    }
  };

  // Marks the item read (if needed) and returns the route to open, if any.
  const openItem = async (notification: BellNotification): Promise<string | null> => {
    open.value = false;
    if (!notification.readAt) {
      await source.markRead(notification.id);
      unread.value = Math.max(0, unread.value - 1);
    }
    return notification.url ?? null;
  };

  const readAll = async (): Promise<void> => {
    await source.markAllRead();
    unread.value = 0;
    await loadList();
  };

  watch(open, (isOpen) => {
    if (isOpen) void loadList();
  });

  void refreshCount();
  if (source.subscribe) {
    const unsubscribe = source.subscribe(() => {
      void refreshCount();
      if (open.value) void loadList();
    });
    onScopeDispose(unsubscribe);
  } else {
    const timer = setInterval(
      () => void refreshCount(),
      options.pollIntervalMs ?? DEFAULT_BELL_POLL_MS,
    );
    onScopeDispose(() => {
      clearInterval(timer);
    });
  }

  return { unread, open, items, refreshCount, loadList, openItem, readAll };
};
