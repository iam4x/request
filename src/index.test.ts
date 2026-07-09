import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  mock,
  test,
} from "bun:test";

import {
  request,
  RequestError,
  RequestParseError,
  RequestTimeoutError,
} from "./index";

describe("request utility", () => {
  const originalFetch = global.fetch;
  const mockJsonResponse = { data: "test response" };

  beforeEach(() => {
    global.fetch = mock(() =>
      Promise.resolve(new Response(JSON.stringify(mockJsonResponse))),
    ) as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.useRealTimers();
    global.fetch = originalFetch;
  });

  test("makes a basic GET request", async () => {
    const result = await request({
      url: "https://api.example.com/data",
    });

    expect(result).toEqual(mockJsonResponse);
    expect(global.fetch).toHaveBeenCalledWith("https://api.example.com/data", {
      method: "GET",
      body: undefined,
      headers: {},
    });
  });

  test("makes a GET request with query parameters", async () => {
    await request({
      url: "https://api.example.com/data",
      params: { id: 123, filter: "active", omitted: undefined, empty: null },
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.example.com/data?id=123&filter=active&empty",
      {
        method: "GET",
        body: undefined,
        headers: {},
      },
    );
  });

  test("does not append a question mark when query parameters are empty", async () => {
    await request({
      url: "https://api.example.com/data",
      params: { omitted: undefined },
    });

    expect(global.fetch).toHaveBeenCalledWith("https://api.example.com/data", {
      method: "GET",
      body: undefined,
      headers: {},
    });
  });

  test("makes a PATCH request with a JSON object body", async () => {
    await request({
      url: "https://api.example.com/data",
      method: "PATCH",
      body: { name: "test", values: [1, 2, 3] },
    });

    expect(global.fetch).toHaveBeenCalledWith("https://api.example.com/data", {
      method: "PATCH",
      body: JSON.stringify({ name: "test", values: [1, 2, 3] }),
      headers: { "content-type": "application/json" },
    });
  });

  test("does not override a custom content-type for JSON object bodies", async () => {
    await request({
      url: "https://api.example.com/data",
      method: "POST",
      headers: { "Content-Type": "application/vnd.api+json" },
      body: { name: "test" },
    });

    expect(global.fetch).toHaveBeenCalledWith("https://api.example.com/data", {
      method: "POST",
      body: JSON.stringify({ name: "test" }),
      headers: { "Content-Type": "application/vnd.api+json" },
    });
  });

  test("passes string bodies without JSON serialization", async () => {
    await request({
      url: "https://api.example.com/data",
      method: "POST",
      body: "raw text",
    });

    expect(global.fetch).toHaveBeenCalledWith("https://api.example.com/data", {
      method: "POST",
      body: "raw text",
      headers: {},
    });
  });

  test("passes FormData bodies without JSON serialization", async () => {
    const formData = new FormData();
    formData.set("name", "test");

    await request({
      url: "https://api.example.com/data",
      method: "POST",
      body: formData,
    });

    expect(global.fetch).toHaveBeenCalledWith("https://api.example.com/data", {
      method: "POST",
      body: formData,
      headers: {},
    });
  });

  test("passes binary bodies without JSON serialization", async () => {
    const body = new Uint8Array([1, 2, 3]);

    await request({
      url: "https://api.example.com/data",
      method: "POST",
      body,
    });

    expect(global.fetch).toHaveBeenCalledWith("https://api.example.com/data", {
      method: "POST",
      body,
      headers: {},
    });
  });

  test("passes fetch-compatible request options", async () => {
    const signal = new AbortController().signal;

    await request({
      url: "https://api.example.com/data",
      credentials: "include",
      mode: "cors",
      cache: "no-store",
      redirect: "manual",
      referrer: "https://example.com",
      referrerPolicy: "no-referrer",
      integrity: "sha256-test",
      priority: "high",
      signal,
      keepalive: false,
    });

    expect(global.fetch).toHaveBeenCalledWith("https://api.example.com/data", {
      method: "GET",
      body: undefined,
      headers: {},
      credentials: "include",
      mode: "cors",
      cache: "no-store",
      redirect: "manual",
      referrer: "https://example.com",
      referrerPolicy: "no-referrer",
      integrity: "sha256-test",
      priority: "high",
      signal,
      keepalive: false,
    });
  });

  test("returns plain text when responseType is text", async () => {
    global.fetch = mock(() =>
      Promise.resolve(new Response("plain text response")),
    ) as unknown as typeof fetch;

    const result = await request({
      url: "https://api.example.com/data",
      responseType: "text",
    });

    expect(result).toBe("plain text response");
  });

  test("returns empty text when responseType is text", async () => {
    global.fetch = mock(() =>
      Promise.resolve(new Response("")),
    ) as unknown as typeof fetch;

    const result = await request({
      url: "https://api.example.com/data",
      responseType: "text",
    });

    expect(result).toBe("");
  });

  test("returns the raw Response without consuming the body", async () => {
    const response = new Response("raw body");
    global.fetch = mock(() =>
      Promise.resolve(response),
    ) as unknown as typeof fetch;

    const result = await request({
      url: "https://api.example.com/data",
      responseType: "response",
    });

    expect(result).toBe(response);
    expect(await response.text()).toBe("raw body");
  });

  test("returns a response stream", async () => {
    global.fetch = mock(() =>
      Promise.resolve(new Response("stream body")),
    ) as unknown as typeof fetch;

    const result = await request({
      url: "https://api.example.com/data",
      responseType: "stream",
    });

    expect(result).toBeInstanceOf(ReadableStream);
  });

  test("returns an arrayBuffer response", async () => {
    global.fetch = mock(() =>
      Promise.resolve(new Response("binary")),
    ) as unknown as typeof fetch;

    const result = await request({
      url: "https://api.example.com/data",
      responseType: "arrayBuffer",
    });

    expect(new TextDecoder().decode(result)).toBe("binary");
  });

  test("returns a blob response", async () => {
    global.fetch = mock(() =>
      Promise.resolve(
        new Response("blob data", {
          headers: { "content-type": "text/plain" },
        }),
      ),
    ) as unknown as typeof fetch;

    const result = await request({
      url: "https://api.example.com/data",
      responseType: "blob",
    });

    expect(result).toBeInstanceOf(Blob);
    expect(result.type).toStartWith("text/plain");
    expect(await result.text()).toBe("blob data");
  });

  test("returns undefined for responseType void with an empty body", async () => {
    global.fetch = mock(() =>
      Promise.resolve(new Response(null, { status: 204 })),
    ) as unknown as typeof fetch;

    const result = await request({
      url: "https://api.example.com/data",
      responseType: "void",
    });

    expect(result).toBeUndefined();
  });

  test("returns metadata without requiring the raw response mode", async () => {
    const responseBody = { saved: true };
    global.fetch = mock(() =>
      Promise.resolve(
        new Response(JSON.stringify(responseBody), {
          status: 202,
          statusText: "Accepted",
          headers: { "retry-after": "5" },
        }),
      ),
    ) as unknown as typeof fetch;

    const result = await request<typeof responseBody>({
      url: "https://api.example.com/settings",
      method: "PUT",
      body: { theme: "dark" },
      returnMetadata: true,
      okStatuses: [202],
    });

    expect(result.data).toEqual(responseBody);
    expect(result.status).toBe(202);
    expect(result.statusText).toBe("Accepted");
    expect(result.headers.get("retry-after")).toBe("5");
    expect(result.response).toBeInstanceOf(Response);
  });

  test("accepts configured status codes", async () => {
    global.fetch = mock(() =>
      Promise.resolve(
        new Response(JSON.stringify({ queued: true }), { status: 202 }),
      ),
    ) as unknown as typeof fetch;

    const result = await request<{ queued: boolean }>({
      url: "https://api.example.com/events",
      method: "POST",
      okStatuses: [200, 202],
    });

    expect(result).toEqual({ queued: true });
  });

  test("throws RequestParseError when a successful JSON response is invalid", async () => {
    global.fetch = mock(() =>
      Promise.resolve(new Response("invalid json {")),
    ) as unknown as typeof fetch;

    try {
      await request({
        url: "https://api.example.com/data",
      });
      expect.unreachable("Expected RequestParseError to be thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(RequestParseError);
      expect(error).toBeInstanceOf(RequestError);
      expect((error as RequestParseError).status).toBe(200);
      expect((error as RequestParseError).statusText).toBe("");
      expect((error as RequestParseError).response).toBe("invalid json {");
      expect((error as RequestParseError).responseText).toBe("invalid json {");
      expect((error as RequestParseError).rawResponse).toBeInstanceOf(Response);
    }
  });

  test("throws RequestParseError when a successful JSON response body is empty", async () => {
    global.fetch = mock(() =>
      Promise.resolve(new Response("")),
    ) as unknown as typeof fetch;

    try {
      await request({
        url: "https://api.example.com/data",
      });
      expect.unreachable("Expected RequestParseError to be thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(RequestParseError);
      expect((error as RequestParseError).message).toContain(
        "Empty response body",
      );
      expect((error as RequestParseError).responseText).toBe("");
    }
  });

  test("throws RequestError with parsed response details for failed responses", async () => {
    const errorResponse = { error: "Something went wrong" };
    global.fetch = mock(() =>
      Promise.resolve(
        new Response(JSON.stringify(errorResponse), {
          status: 400,
          statusText: "Bad Request",
          headers: { "x-request-id": "abc" },
        }),
      ),
    ) as unknown as typeof fetch;

    try {
      await request({
        url: "https://api.example.com/data",
      });
      expect.unreachable("Expected RequestError to be thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(RequestError);
      expect((error as RequestError).status).toBe(400);
      expect((error as RequestError).statusText).toBe("Bad Request");
      expect((error as RequestError).response).toEqual(errorResponse);
      expect((error as RequestError).responseText).toBe(
        JSON.stringify(errorResponse),
      );
      expect((error as RequestError).headers.get("x-request-id")).toBe("abc");
      expect((error as RequestError).rawResponse).toBeInstanceOf(Response);
    }
  });

  test("uses a custom fetch implementation", async () => {
    const customFetch = mock(() =>
      Promise.resolve(new Response(JSON.stringify({ from: "custom" }))),
    );

    const result = await request<{ from: string }>({
      url: "https://api.example.com/data",
      fetch: customFetch as unknown as typeof fetch,
    });

    expect(result).toEqual({ from: "custom" });
    expect(customFetch).toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("supports native fetch-style overloads", async () => {
    const customFetch = mock(() => Promise.resolve(new Response("ok")));

    const result = await request("https://api.example.com/data", {
      method: "POST",
      body: "payload",
      fetch: customFetch as unknown as typeof fetch,
    });

    expect(result).toBeInstanceOf(Response);
    expect(await result.text()).toBe("ok");
    expect(customFetch).toHaveBeenCalledWith("https://api.example.com/data", {
      method: "POST",
      body: "payload",
    });
  });
});

describe("request retry strategy", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    jest.useRealTimers();
    global.fetch = originalFetch;
  });

  test("retries legacy retries on parse errors", async () => {
    let callCount = 0;
    global.fetch = mock(() => {
      callCount++;
      if (callCount < 3) {
        return Promise.resolve(new Response("invalid json {"));
      }

      return Promise.resolve(new Response(JSON.stringify({ data: "ok" })));
    }) as unknown as typeof fetch;

    const result = await request({
      url: "https://api.example.com/data",
      retries: 3,
    });

    expect(result).toEqual({ data: "ok" });
    expect(callCount).toBe(3);
  });

  test("retries configured statuses", async () => {
    let callCount = 0;
    global.fetch = mock(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve(new Response("busy", { status: 503 }));
      }

      return Promise.resolve(new Response(JSON.stringify({ data: "ok" })));
    }) as unknown as typeof fetch;

    const result = await request({
      url: "https://api.example.com/data",
      retry: { attempts: 1, delayMs: 0, retryOnStatus: [503] },
    });

    expect(result).toEqual({ data: "ok" });
    expect(callCount).toBe(2);
  });

  test("does not retry non-idempotent methods by default", async () => {
    let callCount = 0;
    global.fetch = mock(() => {
      callCount++;
      return Promise.resolve(new Response("busy", { status: 503 }));
    }) as unknown as typeof fetch;

    await expect(
      request({
        url: "https://api.example.com/data",
        method: "POST",
        retry: { attempts: 1, delayMs: 0 },
      }),
    ).rejects.toBeInstanceOf(RequestError);

    expect(callCount).toBe(1);
  });

  test("retries non-idempotent methods when explicitly enabled", async () => {
    let callCount = 0;
    global.fetch = mock(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve(new Response("busy", { status: 503 }));
      }

      return Promise.resolve(new Response(JSON.stringify({ data: "ok" })));
    }) as unknown as typeof fetch;

    const result = await request({
      url: "https://api.example.com/data",
      method: "POST",
      retry: {
        attempts: 1,
        delayMs: 0,
        retryOnStatus: [503],
        retryNonIdempotent: true,
      },
    });

    expect(result).toEqual({ data: "ok" });
    expect(callCount).toBe(2);
  });

  test("does not retry keepalive requests unless explicitly enabled", async () => {
    let callCount = 0;
    global.fetch = mock(() => {
      callCount++;
      return Promise.resolve(new Response("busy", { status: 503 }));
    }) as unknown as typeof fetch;

    await expect(
      request({
        url: "https://api.example.com/data",
        keepalive: true,
        retry: { attempts: 1, delayMs: 0, retryOnStatus: [503] },
      }),
    ).rejects.toBeInstanceOf(RequestError);

    expect(callCount).toBe(1);
  });

  test("respects Retry-After when configured", async () => {
    let callCount = 0;
    global.fetch = mock(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve(
          new Response("busy", {
            status: 503,
            headers: { "retry-after": "0" },
          }),
        );
      }

      return Promise.resolve(new Response(JSON.stringify({ data: "ok" })));
    }) as unknown as typeof fetch;

    const resultPromise = request({
      url: "https://api.example.com/data",
      retry: {
        attempts: 1,
        delayMs: 10_000,
        retryOnStatus: [503],
        respectRetryAfter: true,
      },
    });

    const result = await resultPromise;
    expect(result).toEqual({ data: "ok" });
    expect(callCount).toBe(2);
  });
});

describe("request timeout", () => {
  const originalFetch = global.fetch;
  const originalClearTimeout = globalThis.clearTimeout;

  const advanceTimersByTime = async (milliseconds: number) => {
    await Promise.resolve();
    jest.advanceTimersByTime(milliseconds);
    await Promise.resolve();
  };

  const createTextResponse = (text: () => Promise<string>) =>
    ({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: new Headers(),
      text,
    }) as unknown as Response;

  afterEach(() => {
    jest.useRealTimers();
    global.fetch = originalFetch;
    globalThis.clearTimeout = originalClearTimeout;
  });

  test("passes an AbortSignal to fetch when timeout is set", async () => {
    let capturedSignal: AbortSignal | undefined;
    global.fetch = mock((_url: string | URL, opts?: RequestInit) => {
      capturedSignal = opts?.signal ?? undefined;
      return Promise.resolve(new Response(JSON.stringify({ data: "ok" })));
    }) as unknown as typeof fetch;

    await request({ url: "https://api.example.com/data", timeout: 5000 });

    expect(capturedSignal).toBeInstanceOf(AbortSignal);
  });

  test("passes an external AbortSignal when timeout is not set", async () => {
    const signal = new AbortController().signal;
    let capturedSignal: AbortSignal | undefined;
    global.fetch = mock((_url: string | URL, opts?: RequestInit) => {
      capturedSignal = opts?.signal ?? undefined;
      return Promise.resolve(new Response(JSON.stringify({ data: "ok" })));
    }) as unknown as typeof fetch;

    await request({ url: "https://api.example.com/data", signal });

    expect(capturedSignal).toBe(signal);
  });

  test("throws RequestTimeoutError when the request exceeds the timeout", async () => {
    jest.useFakeTimers();

    global.fetch = mock(
      (_url: string | URL, opts?: RequestInit) =>
        new Promise((_resolve, reject) => {
          opts?.signal?.addEventListener("abort", () =>
            reject(
              new DOMException("The operation was aborted.", "AbortError"),
            ),
          );
        }),
    ) as unknown as typeof fetch;

    const resultPromise = request({
      url: "https://api.example.com/data",
      timeout: 50,
    });

    await advanceTimersByTime(50);

    await expect(resultPromise).rejects.toBeInstanceOf(RequestTimeoutError);
    await expect(resultPromise).rejects.toHaveProperty("timeout", 50);
  });

  test("throws RequestTimeoutError when the response body stalls", async () => {
    jest.useFakeTimers();

    global.fetch = mock((_url: string | URL, opts?: RequestInit) =>
      Promise.resolve(
        createTextResponse(
          () =>
            new Promise((_resolve, reject) => {
              opts?.signal?.addEventListener(
                "abort",
                () =>
                  reject(
                    new DOMException(
                      "The operation was aborted.",
                      "AbortError",
                    ),
                  ),
                { once: true },
              );
            }),
        ),
      ),
    ) as unknown as typeof fetch;

    const resultPromise = request({
      url: "https://api.example.com/data",
      timeout: 50,
    });

    await advanceTimersByTime(50);

    await expect(resultPromise).rejects.toBeInstanceOf(RequestTimeoutError);
  });

  test("retries on timeout and succeeds if a later attempt completes in time", async () => {
    jest.useFakeTimers();

    let callCount = 0;
    global.fetch = mock((_url: string | URL, opts?: RequestInit) => {
      callCount++;
      if (callCount === 1) {
        return new Promise((_resolve, reject) => {
          opts?.signal?.addEventListener("abort", () =>
            reject(
              new DOMException("The operation was aborted.", "AbortError"),
            ),
          );
        });
      }

      return Promise.resolve(new Response(JSON.stringify({ data: "ok" })));
    }) as unknown as typeof fetch;

    const resultPromise = request({
      url: "https://api.example.com/data",
      timeout: 50,
      retry: { attempts: 1, delayMs: 0 },
    });

    await advanceTimersByTime(50);

    const result = await resultPromise;
    expect(result).toEqual({ data: "ok" });
    expect(callCount).toBe(2);
  });

  test("clears the timeout timer after a successful attempt", async () => {
    const clearTimeoutMock = mock(
      (timer?: Parameters<typeof clearTimeout>[0]) =>
        originalClearTimeout(timer),
    );
    globalThis.clearTimeout =
      clearTimeoutMock as unknown as typeof clearTimeout;

    global.fetch = mock(() =>
      Promise.resolve(new Response(JSON.stringify({ data: "ok" }))),
    ) as unknown as typeof fetch;

    await request({ url: "https://api.example.com/data", timeout: 50 });

    expect(clearTimeoutMock).toHaveBeenCalledTimes(1);
  });
});
