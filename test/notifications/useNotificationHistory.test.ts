import { describe, expect, it, vi } from "vitest";
import { effectScope, nextTick } from "vue";
import { createHttpNotificationSource } from "../../src/notifications/httpNotificationSource.js";
import type {
  BellNotification,
  ListOptions,
  NotificationSource,
} from "../../src/notifications/useNotificationBell.js";
import { useNotificationHistory } from "../../src/notifications/useNotificationHistory.js";

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const note = (id: number, readAt: string | null = null): BellNotification => ({
  id,
  title: `n${String(id)}`,
  createdAt: "2026-09-25T10:00:00Z",
  readAt,
  url: id === 1 ? "/posts/1" : null,
});

const pagedSource = () => {
  const all = [5, 4, 3, 2, 1].map((id) => note(id));
  const source: NotificationSource = {
    list: vi.fn(({ limit, beforeId }: ListOptions) =>
      Promise.resolve(
        all
          .filter((item) => beforeId === undefined || Number(item.id) < Number(beforeId))
          .slice(0, limit),
      ),
    ),
    unreadCount: vi.fn(() => Promise.resolve(0)),
    markRead: vi.fn(() => Promise.resolve()),
    markAllRead: vi.fn(() => Promise.resolve()),
  };
  return source;
};

const startHistory = (source: NotificationSource, pageSize?: number) => {
  const history = effectScope().run(() => useNotificationHistory(source, pageSize));
  if (!history) throw new Error("effect scope is inactive");
  return history;
};

const fakeFetch = (responses: Record<string, unknown>) =>
  vi.fn((input: RequestInfo | URL) => {
    const url = input instanceof Request ? input.url : String(input);
    const body = responses[url];
    return Promise.resolve(
      new Response(body === undefined ? null : JSON.stringify(body), {
        status: body === undefined ? 204 : 200,
      }),
    );
  }) as unknown as typeof fetch;

describe("useNotificationHistory", () => {
  it("pages by the last id until a short page", async () => {
    const source = pagedSource();
    const history = startHistory(source, 2);
    await history.load(true);
    expect(history.items.value.map((item) => item.id)).toEqual([5, 4]);
    expect(history.exhausted.value).toBe(false);
    await history.load(false);
    await history.load(false);
    expect(history.items.value.map((item) => item.id)).toEqual([5, 4, 3, 2, 1]);
    expect(history.exhausted.value).toBe(true);
    expect(source.list).toHaveBeenLastCalledWith({ limit: 2, beforeId: 2, unread: false });
  });

  it("reloads from the top when the unread filter flips", async () => {
    const source = pagedSource();
    const history = startHistory(source, 2);
    await history.load(true);
    await history.load(false);
    history.unreadOnly.value = true;
    await nextTick();
    await flush();
    expect(source.list).toHaveBeenLastCalledWith({ limit: 2, beforeId: undefined, unread: true });
    expect(history.items.value.map((item) => item.id)).toEqual([5, 4]);
  });

  it("marks an unread item read once and returns its route", async () => {
    const source = pagedSource();
    const history = startHistory(source);
    const unread = note(1);
    expect(await history.openItem(unread)).toBe("/posts/1");
    expect(await history.openItem(unread)).toBe("/posts/1");
    expect(source.markRead).toHaveBeenCalledTimes(1);
    expect(unread.readAt).toBeTruthy();
  });
});

describe("createHttpNotificationSource", () => {
  it("talks to server-kit's notification routes", async () => {
    const fetchMock = fakeFetch({
      "/api/notifications?limit=20": [{ id: 1, kind: "failure", title: "down", createdAt: "x" }],
      "/api/notifications?limit=5&beforeId=9&unread=true": [],
      "/api/notifications/unread-count": { unread: 2 },
    });
    const source = createHttpNotificationSource({
      fetch: fetchMock,
      decorate: (item) => (item.kind === "failure" ? { icon: "mdi-alert", color: "error" } : {}),
    });
    expect(await source.list({ limit: 20 })).toEqual([
      { id: 1, kind: "failure", title: "down", createdAt: "x", icon: "mdi-alert", color: "error" },
    ]);
    expect(await source.list({ limit: 5, beforeId: 9, unread: true })).toEqual([]);
    expect(await source.unreadCount()).toBe(2);
    await source.markRead(1);
    await source.markAllRead();
    expect(fetchMock).toHaveBeenCalledWith("/api/notifications/1/read", { method: "POST" });
    expect(fetchMock).toHaveBeenCalledWith("/api/notifications/read-all", { method: "POST" });
  });

  it("throws on an error status", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(new Response("no", { status: 500 })),
    ) as unknown as typeof fetch;
    await expect(createHttpNotificationSource({ fetch: fetchMock }).unreadCount()).rejects.toThrow(
      "500",
    );
  });
});
