import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope, nextTick } from "vue";
import {
  useGlobalSearch,
  type SearchGroup,
  type SearchProvider,
} from "../../src/search/useGlobalSearch.js";

const tasks = (...titles: string[]): SearchGroup => ({
  label: "Tasks",
  results: titles.map((title, index) => ({
    key: index,
    title,
    to: `/tasks/${String(index)}`,
  })),
});

const noop = (): void => {};

const mount = (provider: SearchProvider) => {
  const scope = effectScope();
  const search = scope.run(() => useGlobalSearch(provider, { debounceMs: 100 }));
  if (!search) throw new Error("effect scope is inactive");
  return { search, scope };
};

const type = async (search: ReturnType<typeof useGlobalSearch>, value: string | null) => {
  search.query.value = value as string;
  await nextTick();
};

describe("useGlobalSearch", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("debounces keystrokes into one provider call", async () => {
    const provider = vi.fn(() => Promise.resolve([tasks("bell")]));
    const { search } = mount(provider);
    await type(search, "b");
    await type(search, "be");
    await type(search, " bell ");
    expect(search.loading.value).toBe(true);
    await vi.advanceTimersByTimeAsync(100);
    expect(provider).toHaveBeenCalledTimes(1);
    expect(provider).toHaveBeenCalledWith("bell");
    expect(search.loading.value).toBe(false);
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- firstResult is null at runtime when nothing matches
    expect(search.firstResult.value?.title).toBe("bell");
  });

  it("ignores a slow answer that arrives after a newer query", async () => {
    let resolveOld: (groups: SearchGroup[]) => void = noop;
    const provider = vi.fn((term: string) =>
      term === "old"
        ? new Promise<SearchGroup[]>((resolve) => {
            resolveOld = resolve;
          })
        : Promise.resolve([tasks("new")]),
    );
    const { search } = mount(provider);
    await type(search, "old");
    await vi.advanceTimersByTimeAsync(100);
    await type(search, "new");
    await vi.advanceTimersByTimeAsync(100);
    resolveOld([tasks("old")]);
    await vi.advanceTimersByTimeAsync(0);
    expect(search.groups.value[0]?.results[0]?.title).toBe("new");
  });

  it("an answer arriving after the field is cleared is dropped", async () => {
    let resolveAnswer: (groups: SearchGroup[]) => void = noop;
    const provider = vi.fn(
      () =>
        new Promise<SearchGroup[]>((resolve) => {
          resolveAnswer = resolve;
        }),
    );
    const { search } = mount(provider);
    await type(search, "bell");
    await vi.advanceTimersByTimeAsync(100);
    await type(search, null); // v-text-field's clear button sets null
    resolveAnswer([tasks("bell")]);
    await vi.advanceTimersByTimeAsync(0);
    expect(search.groups.value).toEqual([]);
    expect(search.loading.value).toBe(false);
  });

  it("drops empty groups and picks the first result across groups", async () => {
    const provider = vi.fn(() =>
      Promise.resolve([{ label: "Projects", results: [] }, tasks("a", "b")]),
    );
    const { search } = mount(provider);
    await type(search, "a");
    await vi.advanceTimersByTimeAsync(100);
    expect(search.groups.value.map((group) => group.label)).toEqual(["Tasks"]);
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- firstResult is null at runtime when nothing matches
    expect(search.firstResult.value?.to).toBe("/tasks/0");
  });

  it("flags a failed provider call", async () => {
    const provider = vi.fn(() => Promise.reject(new Error("down")));
    const { search } = mount(provider);
    await type(search, "x");
    await vi.advanceTimersByTimeAsync(100);
    expect(search.failed.value).toBe(true);
    expect(search.loading.value).toBe(false);
    expect(search.groups.value).toEqual([]);
  });

  it("reset clears the query and results", async () => {
    const { search } = mount(vi.fn(() => Promise.resolve([tasks("a")])));
    await type(search, "a");
    await vi.advanceTimersByTimeAsync(100);
    search.reset();
    await nextTick();
    expect(search.query.value).toBe("");
    expect(search.groups.value).toEqual([]);
  });
});
