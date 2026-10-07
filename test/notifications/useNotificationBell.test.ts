import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope, nextTick } from "vue";
import {
  badgeContent,
  relativeTime,
  useNotificationBell,
  type BellNotification,
  type NotificationSource,
} from "../../src/notifications/useNotificationBell.js";

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const noop = (): void => {};

const fakeSource = (overrides: Partial<NotificationSource> = {}) => {
  const items: BellNotification[] = [
    { id: 1, title: "Unread", createdAt: new Date().toISOString(), url: "/tasks/1" },
    { id: 2, title: "Read", createdAt: new Date().toISOString(), readAt: new Date().toISOString() },
  ];
  const source: NotificationSource = {
    list: vi.fn(() => Promise.resolve(items)),
    unreadCount: vi.fn(() => Promise.resolve(3)),
    markRead: vi.fn(() => Promise.resolve()),
    markAllRead: vi.fn(() => Promise.resolve()),
    ...overrides,
  };
  return source;
};

const mount = (source: NotificationSource, pollIntervalMs?: number) => {
  const scope = effectScope();
  const bell = scope.run(() => useNotificationBell(source, { pollIntervalMs }));
  if (!bell) throw new Error("effect scope is inactive");
  return { bell, scope };
};

describe("badgeContent / relativeTime", () => {
  it("caps the badge at 99+", () => {
    expect(badgeContent(7)).toBe("7");
    expect(badgeContent(100)).toBe("99+");
  });

  it("formats ages", () => {
    const now = Date.parse("2026-09-25T12:00:00Z");
    expect(relativeTime("2026-09-25T11:59:30Z", now)).toBe("just now");
    expect(relativeTime("2026-09-25T11:55:00Z", now)).toBe("5m ago");
    expect(relativeTime("2026-09-25T09:00:00Z", now)).toBe("3h ago");
    expect(relativeTime("2026-09-23T12:00:00Z", now)).toBe("2d ago");
  });
});

describe("useNotificationBell", () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] }));
  afterEach(() => vi.useRealTimers());

  it("loads the unread count on start and polls it", async () => {
    const source = fakeSource();
    const { bell, scope } = mount(source, 1000);
    await flush();
    expect(bell.unread.value).toBe(3);
    vi.advanceTimersByTime(2000);
    expect(source.unreadCount).toHaveBeenCalledTimes(3);
    scope.stop();
    vi.advanceTimersByTime(2000);
    expect(source.unreadCount).toHaveBeenCalledTimes(3);
  });

  it("keeps the last count when a poll fails", async () => {
    let shouldFail = false;
    const source = fakeSource({
      unreadCount: vi.fn(() =>
        shouldFail ? Promise.reject(new Error("down")) : Promise.resolve(3),
      ),
    });
    const { bell } = mount(source, 1000);
    await flush();
    shouldFail = true;
    vi.advanceTimersByTime(1000);
    await flush();
    expect(bell.unread.value).toBe(3);
  });

  it("fetches the list only when opened", async () => {
    const source = fakeSource();
    const { bell } = mount(source);
    await flush();
    expect(source.list).not.toHaveBeenCalled();
    bell.open.value = true;
    await nextTick();
    await flush();
    expect(source.list).toHaveBeenCalledWith({ limit: 20 });
    expect(bell.items.value).toHaveLength(2);
  });

  it("opening an unread item marks it read and returns its route", async () => {
    const source = fakeSource();
    const { bell } = mount(source);
    await flush();
    bell.open.value = true;
    const url = await bell.openItem({ id: 1, title: "x", createdAt: "", url: "/tasks/1" });
    expect(url).toBe("/tasks/1");
    expect(source.markRead).toHaveBeenCalledWith(1);
    expect(bell.unread.value).toBe(2);
    expect(bell.open.value).toBe(false);
  });

  it("opening a read item does not mark it again", async () => {
    const source = fakeSource();
    const { bell } = mount(source);
    await flush();
    expect(
      await bell.openItem({ id: 2, title: "x", createdAt: "", readAt: "2026-01-01" }),
    ).toBeNull();
    expect(source.markRead).not.toHaveBeenCalled();
    expect(bell.unread.value).toBe(3);
  });

  it("mark all read zeroes the count and reloads the list", async () => {
    const source = fakeSource();
    const { bell } = mount(source);
    await flush();
    await bell.readAll();
    expect(source.markAllRead).toHaveBeenCalled();
    expect(bell.unread.value).toBe(0);
    expect(source.list).toHaveBeenCalled();
  });

  it("uses subscribe instead of polling when the source offers it", async () => {
    let notify = noop;
    const unsubscribe = vi.fn();
    const source = fakeSource({
      subscribe: (onChange) => {
        notify = onChange;
        return unsubscribe;
      },
    });
    const { scope } = mount(source, 1000);
    await flush();
    vi.advanceTimersByTime(5000);
    expect(source.unreadCount).toHaveBeenCalledTimes(1);
    notify();
    expect(source.unreadCount).toHaveBeenCalledTimes(2);
    scope.stop();
    expect(unsubscribe).toHaveBeenCalled();
  });
});
