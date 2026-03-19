import {
  test,
  describe,
  expect,
  mock,
  spyOn,
  beforeEach,
  afterEach,
} from "bun:test";

import * as retryUtils from "./utils/retry.utils";

import { request, RequestError, RequestTimeoutError } from "./index";

describe("request utility", () => {
  const originalFetch = global.fetch;
  const originalRetry = retryUtils.retry;

  const mockJsonResponse = { data: "test response" };

  beforeEach(() => {
    // Mock the retry function to just call the callback once
    spyOn(retryUtils, "retry").mockImplementation((fn, _retries) => fn());

    // Mock fetch to return a successful response
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    global.fetch = mock(
      () =>
        Promise.resolve({
          ok: true,
          status: 200,
          statusText: "OK",
          text: () => Promise.resolve(JSON.stringify(mockJsonResponse)),
        }) as unknown as Response,
    );
  });

  afterEach(() => {
    global.fetch = originalFetch;
    spyOn(retryUtils, "retry").mockImplementation(originalRetry);
  });

  test("makes a basic GET request", async () => {
    const result = await request({
      url: "https://api.example.com/data",
    });

    expect(result).toEqual(mockJsonResponse);
    expect(global.fetch).toHaveBeenCalledWith("https://api.example.com/data", {
      method: "GET",
      body: undefined,
      headers: { "content-type": "application/json" },
    });
  });

  test("makes a GET request with query parameters", async () => {
    await request({
      url: "https://api.example.com/data",
      params: { id: 123, filter: "active" },
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.example.com/data?id=123&filter=active",
      {
        method: "GET",
        body: undefined,
        headers: { "content-type": "application/json" },
      },
    );
  });

  test("makes a POST request with body", async () => {
    await request({
      url: "https://api.example.com/data",
      method: "POST",
      body: { name: "test", values: [1, 2, 3] },
    });

    expect(global.fetch).toHaveBeenCalledWith("https://api.example.com/data", {
      method: "POST",
      body: JSON.stringify({ name: "test", values: [1, 2, 3] }),
      headers: { "content-type": "application/json" },
    });
  });

  test("includes custom headers in the request", async () => {
    await request({
      url: "https://api.example.com/data",
      headers: {
        Authorization: "Bearer token123",
        "content-type": "application/json",
      },
    });

    expect(global.fetch).toHaveBeenCalledWith("https://api.example.com/data", {
      method: "GET",
      body: undefined,
      headers: {
        Authorization: "Bearer token123",
        "content-type": "application/json",
      },
    });
  });

  test("uses the retry utility with specified retry count", async () => {
    await request({
      url: "https://api.example.com/data",
      retries: 3,
    });

    expect(retryUtils.retry).toHaveBeenCalledWith(expect.any(Function), 3);
  });

  test("uses default retry count of 0 when not specified", async () => {
    await request({
      url: "https://api.example.com/data",
    });

    expect(retryUtils.retry).toHaveBeenCalledWith(expect.any(Function), 0);
  });

  test("throws RequestError when response is 200 but contains invalid JSON", async () => {
    // Mock fetch to return a successful response with invalid JSON
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    global.fetch = mock(
      () =>
        Promise.resolve({
          ok: true,
          status: 200,
          statusText: "OK",
          text: () => Promise.resolve("invalid json {"),
        }) as unknown as Response,
    );

    try {
      await request({
        url: "https://api.example.com/data",
      });
      expect.unreachable("Expected RequestError to be thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(RequestError);
      expect((error as RequestError).status).toBe(200);
      expect((error as RequestError).statusText).toBe("OK");
      expect((error as RequestError).message).toContain(
        "Failed to parse JSON response",
      );
      expect((error as RequestError).response).toBe("invalid json {");
    }
  });

  test("throws RequestError when response is 200 but body is empty", async () => {
    // Mock fetch to return a successful response with empty body
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    global.fetch = mock(
      () =>
        Promise.resolve({
          ok: true,
          status: 200,
          statusText: "OK",
          text: () => Promise.resolve(""),
        }) as unknown as Response,
    );

    try {
      await request({
        url: "https://api.example.com/data",
      });
      expect.unreachable("Expected RequestError to be thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(RequestError);
      expect((error as RequestError).status).toBe(200);
      expect((error as RequestError).statusText).toBe("OK");
      expect((error as RequestError).message).toContain(
        "Failed to parse JSON response",
      );
      expect((error as RequestError).message).toContain("Empty response body");
      expect((error as RequestError).response).toBe("");
    }
  });

  test("retries request when JSON parsing fails", async () => {
    // Restore the real retry implementation for this test
    spyOn(retryUtils, "retry").mockImplementation(originalRetry);

    let callCount = 0;
    // Mock fetch to fail with invalid JSON twice, then succeed
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    global.fetch = mock(() => {
      callCount++;
      if (callCount < 3) {
        // First two calls return invalid JSON
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: "OK",
          text: () => Promise.resolve("invalid json {"),
        }) as unknown as Response;
      }
      // Third call succeeds with valid JSON
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: "OK",
        text: () => Promise.resolve(JSON.stringify(mockJsonResponse)),
      }) as unknown as Response;
    });

    const result = await request({
      url: "https://api.example.com/data",
      retries: 3,
    });

    expect(result).toEqual(mockJsonResponse);
    expect(callCount).toBe(3); // Should have retried 2 times (3 total calls)
  });

  test("handles error response with invalid JSON without body already used error", async () => {
    // Mock fetch to return an error response with invalid JSON
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    global.fetch = mock(
      () =>
        Promise.resolve({
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
          text: () => Promise.resolve("invalid json {"),
        }) as unknown as Response,
    );

    try {
      await request({
        url: "https://api.example.com/data",
      });
      expect.unreachable("Expected RequestError to be thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(RequestError);
      expect((error as RequestError).status).toBe(500);
      expect((error as RequestError).statusText).toBe("Internal Server Error");
      expect((error as RequestError).message).toContain(
        "Request failed with status 500",
      );
      // Should contain the text response since JSON parsing failed
      expect((error as RequestError).response).toBe("invalid json {");
    }
  });

  test("handles error response with valid JSON", async () => {
    const errorResponse = { error: "Something went wrong" };
    // Mock fetch to return an error response with valid JSON
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    global.fetch = mock(
      () =>
        Promise.resolve({
          ok: false,
          status: 400,
          statusText: "Bad Request",
          text: () => Promise.resolve(JSON.stringify(errorResponse)),
        }) as unknown as Response,
    );

    try {
      await request({
        url: "https://api.example.com/data",
      });
      expect.unreachable("Expected RequestError to be thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(RequestError);
      expect((error as RequestError).status).toBe(400);
      expect((error as RequestError).statusText).toBe("Bad Request");
      expect((error as RequestError).message).toContain(
        "Request failed with status 400",
      );
      // Should contain the parsed JSON object
      expect((error as RequestError).response).toEqual(errorResponse);
    }
  });
});

describe("request timeout", () => {
  const originalFetch = global.fetch;
  const originalRetry = retryUtils.retry;

  afterEach(() => {
    global.fetch = originalFetch;
    spyOn(retryUtils, "retry").mockImplementation(originalRetry);
  });

  test("passes an AbortSignal to fetch when timeout is set", async () => {
    const mockJsonResponse = { data: "ok" };
    spyOn(retryUtils, "retry").mockImplementation((fn, _retries) => fn());

    let capturedSignal: AbortSignal | undefined;
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    global.fetch = mock((_, opts) => {
      capturedSignal = opts?.signal;
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: "OK",
        text: () => Promise.resolve(JSON.stringify(mockJsonResponse)),
      }) as unknown as Response;
    });

    await request({ url: "https://api.example.com/data", timeout: 5000 });

    expect(capturedSignal).toBeInstanceOf(AbortSignal);
  });

  test("does not pass a signal to fetch when timeout is not set", async () => {
    const mockJsonResponse = { data: "ok" };
    spyOn(retryUtils, "retry").mockImplementation((fn, _retries) => fn());

    let capturedSignal: AbortSignal | undefined;
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    global.fetch = mock((_, opts) => {
      capturedSignal = opts?.signal;
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: "OK",
        text: () => Promise.resolve(JSON.stringify(mockJsonResponse)),
      }) as unknown as Response;
    });

    await request({ url: "https://api.example.com/data" });

    expect(capturedSignal).toBeUndefined();
  });

  test("throws RequestTimeoutError when the request exceeds the timeout", async () => {
    spyOn(retryUtils, "retry").mockImplementation((fn, _retries) => fn());

    // fetch never resolves — the AbortController will cancel it
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    global.fetch = mock(
      (_url: string, opts: RequestInit) =>
        new Promise((_resolve, reject) => {
          opts.signal?.addEventListener("abort", () =>
            reject(
              new DOMException("The operation was aborted.", "AbortError"),
            ),
          );
        }),
    );

    try {
      await request({ url: "https://api.example.com/data", timeout: 50 });
      expect.unreachable("Expected RequestTimeoutError to be thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(RequestTimeoutError);
      expect((error as RequestTimeoutError).message).toBe(
        "Request timed out after 50ms",
      );
      expect((error as RequestTimeoutError).timeout).toBe(50);
    }
  });

  test("retries on timeout and succeeds if a later attempt completes in time", async () => {
    spyOn(retryUtils, "retry").mockImplementation(originalRetry);

    let callCount = 0;
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    global.fetch = mock((_url: string, opts: RequestInit) => {
      callCount++;
      if (callCount < 3) {
        // First two attempts time out
        return new Promise((_resolve, reject) => {
          opts.signal?.addEventListener("abort", () =>
            reject(
              new DOMException("The operation was aborted.", "AbortError"),
            ),
          );
        });
      }
      // Third attempt resolves immediately (well within timeout)
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: "OK",
        text: () => Promise.resolve(JSON.stringify({ data: "ok" })),
      }) as unknown as Response;
    });

    const result = await request({
      url: "https://api.example.com/data",
      timeout: 50,
      retries: 3,
    });

    expect(result).toEqual({ data: "ok" });
    expect(callCount).toBe(3);
  });

  test("throws RequestTimeoutError after exhausting all retries on timeout", async () => {
    spyOn(retryUtils, "retry").mockImplementation(originalRetry);

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    global.fetch = mock(
      (_url: string, opts: RequestInit) =>
        new Promise((_resolve, reject) => {
          opts.signal?.addEventListener("abort", () =>
            reject(
              new DOMException("The operation was aborted.", "AbortError"),
            ),
          );
        }),
    );

    try {
      await request({
        url: "https://api.example.com/data",
        timeout: 50,
        retries: 2,
      });
      expect.unreachable("Expected RequestTimeoutError to be thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(RequestTimeoutError);
      expect((error as RequestTimeoutError).message).toBe(
        "Request timed out after 50ms",
      );
    }
  });
});
