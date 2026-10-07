import type { BellNotification, NotificationSource } from "./useNotificationBell.js";

// A NotificationSource over server-kit's registerNotificationRoutes,
// so an app using that helper needs no adapter code of
// its own beyond picking icons and colours for its kinds.
export interface HttpNotificationSourceOptions {
  // Where registerNotificationRoutes is mounted.
  baseUrl?: string;
  // Icon/colour (or anything else) per notification, usually from its kind.
  decorate?: (notification: BellNotification) => Partial<BellNotification>;
  fetch?: typeof fetch;
}

export const createHttpNotificationSource = (
  options: HttpNotificationSourceOptions = {},
): NotificationSource => {
  const base = options.baseUrl ?? "/api/notifications";
  const doFetch = options.fetch ?? ((input, init) => fetch(input, init));

  const call = async <T>(path: string, init?: RequestInit): Promise<T | undefined> => {
    const response = await doFetch(`${base}${path}`, init);
    if (!response.ok) {
      throw new Error(`${init?.method ?? "GET"} ${base}${path}: ${String(response.status)}`);
    }
    return response.status === 204 ? undefined : ((await response.json()) as T);
  };

  return {
    async list({ limit, beforeId, unread }) {
      const params = new URLSearchParams({ limit: String(limit) });
      if (beforeId !== undefined) params.set("beforeId", String(beforeId));
      if (unread) params.set("unread", "true");
      const rows = (await call<BellNotification[]>(`?${params.toString()}`)) ?? [];
      const { decorate } = options;
      return decorate
        ? rows.map((notification) => ({ ...notification, ...decorate(notification) }))
        : rows;
    },
    async unreadCount() {
      const result = await call<{ unread: number }>("/unread-count");
      return result?.unread ?? 0;
    },
    async markRead(id) {
      await call(`/${encodeURIComponent(String(id))}/read`, { method: "POST" });
    },
    async markAllRead() {
      await call("/read-all", { method: "POST" });
    },
  };
};
