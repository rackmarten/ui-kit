import { describe, expect, it, vi } from "vitest";
import { ApiError, createApi } from "../../src/api/createApi.js";

const fakeFetch = (response: () => Response = () => Response.json({ ok: true })) =>
  vi.fn<typeof fetch>(() => Promise.resolve(response()));

const sent = (fetchMock: ReturnType<typeof fakeFetch>, call = 0) => {
  const [url, init] = fetchMock.mock.calls[call] ?? [];
  return { url, init: init ?? {}, headers: new Headers(init?.headers) };
};

describe("createApi", () => {
  it("prefixes baseUrl and parses JSON", async () => {
    const fetchMock = fakeFetch(() => Response.json({ id: 1 }));
    const api = createApi({ baseUrl: "/api", fetch: fetchMock });
    await expect(api.get("/items/1")).resolves.toEqual({ id: 1 });
    expect(sent(fetchMock).url).toBe("/api/items/1");
  });

  it("merges init defaults, per-request headers and call headers", async () => {
    const fetchMock = fakeFetch();
    let token = "a";
    const api = createApi({
      fetch: fetchMock,
      init: { keepalive: true, headers: { "x-default": "1" } },
      headers: () => ({ authorization: `Bearer ${token}` }),
    });
    await api.get("/one");
    token = "b";
    await api.request("/two", { headers: { "x-call": "2" } });
    expect(sent(fetchMock, 0).init.keepalive).toBe(true);
    expect(sent(fetchMock, 0).headers.get("authorization")).toBe("Bearer a");
    expect(sent(fetchMock, 0).headers.get("x-default")).toBe("1");
    expect(sent(fetchMock, 1).headers.get("authorization")).toBe("Bearer b");
    expect(sent(fetchMock, 1).headers.get("x-call")).toBe("2");
  });

  it("stringifies JSON bodies with a content-type", async () => {
    const fetchMock = fakeFetch();
    const api = createApi({ fetch: fetchMock });
    await api.post("/items", { name: "demo" });
    await api.put("/items/1", [1, 2]);
    await api.patch("/items/1", { done: true });
    for (const [call, method, body] of [
      [0, "POST", '{"name":"demo"}'],
      [1, "PUT", "[1,2]"],
      [2, "PATCH", '{"done":true}'],
    ] as const) {
      const { init, headers } = sent(fetchMock, call);
      expect(init.method).toBe(method);
      expect(init.body).toBe(body);
      expect(headers.get("content-type")).toBe("application/json");
    }
  });

  it.each([
    ["FormData", new FormData()],
    ["Blob", new Blob(["x"])],
    ["ArrayBuffer", new ArrayBuffer(4)],
    ["URLSearchParams", new URLSearchParams({ page: "1" })],
    ["string", "plain text"],
  ])("passes a %s body through without a content-type", async (_name, body) => {
    const fetchMock = fakeFetch();
    await createApi({ fetch: fetchMock }).post("/upload", body);
    const { init, headers } = sent(fetchMock);
    expect(init.body).toBe(body);
    expect(headers.has("content-type")).toBe(false);
  });

  it("sends no body and no content-type when there is no body", async () => {
    const fetchMock = fakeFetch();
    const api = createApi({ fetch: fetchMock });
    await api.post("/run");
    await api.del("/items/1");
    expect(sent(fetchMock, 0).init.body).toBeUndefined();
    expect(sent(fetchMock, 0).headers.has("content-type")).toBe(false);
    expect(sent(fetchMock, 1).init.method).toBe("DELETE");
    expect(sent(fetchMock, 1).headers.has("content-type")).toBe(false);
  });

  it("resolves undefined for 204 and an empty body", async () => {
    await expect(
      createApi({ fetch: fakeFetch(() => new Response(null, { status: 204 })) }).del("/x"),
    ).resolves.toBeUndefined();
    await expect(
      createApi({ fetch: fakeFetch(() => new Response("", { status: 200 })) }).get("/x"),
    ).resolves.toBeUndefined();
  });

  it.each([
    [{ error: "Not allowed", message: "ignored" }, "Not allowed"],
    [{ message: "Bad input" }, "Bad input"],
    [{ other: true }, "/items -> 400"],
  ])("throws ApiError with the body's message (%j)", async (body, message) => {
    const api = createApi({ fetch: fakeFetch(() => Response.json(body, { status: 400 })) });
    const thrown = await api.get("/items").catch((error: unknown) => error);
    expect(thrown).toBeInstanceOf(ApiError);
    expect(thrown).toMatchObject({ message, status: 400, path: "/items", body });
  });

  it("throws with a null body when the error response is empty", async () => {
    const api = createApi({ fetch: fakeFetch(() => new Response(null, { status: 500 })) });
    await expect(api.get("/x")).rejects.toMatchObject({
      message: "/x -> 500",
      status: 500,
      body: null,
    });
  });

  it("calls onUnauthorized on 401 before throwing", async () => {
    const order: string[] = [];
    const onUnauthorized = vi.fn(() => order.push("hook"));
    const api = createApi({
      fetch: fakeFetch(() => Response.json({ error: "Login required" }, { status: 401 })),
      onUnauthorized,
    });
    await api.get("/me").catch((error: unknown) => {
      order.push("throw");
      expect(error).toMatchObject({ status: 401, message: "Login required" });
    });
    expect(order).toEqual(["hook", "throw"]);
    expect(onUnauthorized.mock.calls[0]?.[0]).toBeInstanceOf(Response);
  });

  it("raw returns the response without throwing, still handling 401", async () => {
    const onUnauthorized = vi.fn();
    const fetchMock = fakeFetch(() => new Response("nope", { status: 401 }));
    const api = createApi({ fetch: fetchMock, onUnauthorized, headers: () => ({ "x-a": "1" }) });
    const response = await api.raw("/file");
    expect(response.status).toBe(401);
    await expect(response.text()).resolves.toBe("nope");
    expect(onUnauthorized).toHaveBeenCalledOnce();
    expect(sent(fetchMock).headers.get("x-a")).toBe("1");
  });
});
