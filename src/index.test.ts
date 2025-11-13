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

import { request, RequestError } from "./index";

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
});
