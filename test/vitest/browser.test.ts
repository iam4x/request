// @vitest-environment happy-dom

import { describe, expect, test, vi } from "vitest";

import { request } from "../../dist/index.js";

describe("compiled package in a browser-like Vitest environment", () => {
  test("passes FormData through without JSON serialization", async () => {
    const formData = new FormData();
    formData.set("file", new Blob(["hello"], { type: "text/plain" }));

    const fetchMock = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ uploaded: true }))),
    );

    const result = await request<{ uploaded: boolean }>({
      url: "https://api.example.com/upload",
      method: "POST",
      body: formData,
      fetch: fetchMock as unknown as typeof fetch,
    });

    expect(result).toEqual({ uploaded: true });
    expect(fetchMock).toHaveBeenCalledWith("https://api.example.com/upload", {
      method: "POST",
      body: formData,
      headers: {},
    });
  });

  test("supports blob and stream response modes", async () => {
    const blobFetch = vi.fn(() =>
      Promise.resolve(
        new Response("image", { headers: { "content-type": "image/png" } }),
      ),
    );

    const blob = await request({
      url: "https://api.example.com/image",
      fetch: blobFetch as unknown as typeof fetch,
      responseType: "blob",
    });

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("image/png");

    const streamFetch = vi.fn(() => Promise.resolve(new Response("stream")));
    const stream = await request({
      url: "https://api.example.com/stream",
      fetch: streamFetch as unknown as typeof fetch,
      responseType: "stream",
    });

    expect(stream).toBeInstanceOf(ReadableStream);
  });
});
