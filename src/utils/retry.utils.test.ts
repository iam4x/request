import { afterEach, describe, expect, jest, test } from "bun:test";

import { retry } from "./retry.utils";

describe("retry", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  test("should resolve immediately if the function succeeds on first attempt", async () => {
    const mockFn = () => Promise.resolve("success");
    const result = await retry(mockFn);
    expect(result).toBe("success");
  });

  test("should retry and succeed if function fails but succeeds before max retries", async () => {
    jest.useFakeTimers();

    let attempts = 0;
    const mockFn = () => {
      attempts++;
      if (attempts < 3) {
        return Promise.reject(new Error("temporary failure"));
      }
      return Promise.resolve("success after retry");
    };

    const resultPromise = retry(mockFn);

    await Promise.resolve();
    jest.advanceTimersByTime(100);
    await Promise.resolve();
    jest.advanceTimersByTime(200);

    const result = await resultPromise;
    expect(result).toBe("success after retry");
    expect(attempts).toBe(3);
  });

  test("should throw if max retries are exhausted", async () => {
    jest.useFakeTimers();

    let attempts = 0;
    const mockFn = () => {
      attempts++;
      return Promise.reject(new Error("persistent failure"));
    };

    const resultPromise = retry(mockFn, 3);

    await Promise.resolve();
    jest.advanceTimersByTime(100);
    await Promise.resolve();
    jest.advanceTimersByTime(200);
    await Promise.resolve();
    jest.advanceTimersByTime(300);

    await expect(resultPromise).rejects.toThrow("persistent failure");
    expect(attempts).toBe(4); // Initial attempt + 3 retries
  });

  test("should respect custom retry count", async () => {
    jest.useFakeTimers();

    let attempts = 0;
    const mockFn = () => {
      attempts++;
      return Promise.reject(new Error("failure"));
    };

    const resultPromise = retry(mockFn, 5);

    for (const delay of [100, 200, 300, 400, 500]) {
      await Promise.resolve();
      jest.advanceTimersByTime(delay);
    }

    await expect(resultPromise).rejects.toThrow("failure");
    expect(attempts).toBe(6); // Initial attempt + 5 retries
  });
});
