import { describe, expect, test, vi } from "vitest";

import {
  request,
  RequestParseError,
  type RequestMetadata,
} from "../../dist/index.js";

describe("compiled package in Vitest node", () => {
  test("handles typed PATCH JSON requests with metadata", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ saved: true }), {
          status: 202,
          statusText: "Accepted",
          headers: { "retry-after": "3" },
        }),
      ),
    );

    const result = await request<{ saved: boolean }>({
      url: "https://api.example.com/settings",
      method: "PATCH",
      body: { theme: "dark" },
      fetch: fetchMock as unknown as typeof fetch,
      okStatuses: [202],
      returnMetadata: true,
    });

    expect(result).toMatchObject<RequestMetadata<{ saved: boolean }>>({
      data: { saved: true },
      status: 202,
      statusText: "Accepted",
      headers: result.headers,
      response: result.response,
    });
    expect(result.headers.get("retry-after")).toBe("3");
    expect(fetchMock).toHaveBeenCalledWith("https://api.example.com/settings", {
      method: "PATCH",
      body: JSON.stringify({ theme: "dark" }),
      headers: { "content-type": "application/json" },
    });
  });

  test("passes binary bodies through and returns raw responses", async () => {
    const body = new Uint8Array([1, 2, 3]);
    const fetchMock = vi.fn(() =>
      Promise.resolve(new Response("accepted", { status: 202 })),
    );

    const result = await request({
      url: "https://api.example.com/proxy",
      method: "POST",
      body,
      fetch: fetchMock as unknown as typeof fetch,
      okStatuses: [202],
      responseType: "response",
    });

    expect(result.status).toBe(202);
    expect(await result.text()).toBe("accepted");
    expect(fetchMock).toHaveBeenCalledWith("https://api.example.com/proxy", {
      method: "POST",
      body,
      headers: {},
    });
  });

  test("preserves successful response parse failures distinctly", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response("not json")));

    await expect(
      request({
        url: "https://api.example.com/data",
        fetch: fetchMock as unknown as typeof fetch,
      }),
    ).rejects.toBeInstanceOf(RequestParseError);
  });
});
