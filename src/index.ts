import { retry } from "./utils/retry.utils";
import { stringify } from "./utils/query-string.utils";
import { omitUndefined } from "./utils/omit-undefined.utils";

export type RequestParams = Record<
  string,
  | boolean
  | string
  | number
  | string[]
  | number[]
  | Array<Record<string, any>>
  | Record<string, any>
>;

export type Request = {
  url: string;
  headers?: Record<string, string>;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  params?: RequestParams;
  body?: RequestParams;
  retries?: number;
  proxy?: string;
  timeout?: number;
};

export class RequestError extends Error {
  constructor(
    message: string,
    public status: number,
    public statusText: string,
    public response?: unknown,
  ) {
    super(message);
    this.name = "RequestError";
  }
}

export class RequestTimeoutError extends Error {
  constructor(public timeout: number) {
    super(`Request timed out after ${timeout}ms`);
    this.name = "RequestTimeoutError";
  }
}

export const request = async <T>(req: Request) => {
  return retry(async () => {
    const url = req.params
      ? `${req.url}?${stringify(omitUndefined(req.params))}`
      : req.url;

    const controller = req.timeout ? new AbortController() : null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    if (controller && req.timeout) {
      timeoutId = setTimeout(() => controller.abort(), req.timeout);
    }

    const fetchOptions: RequestInit & { proxy?: string } = {
      method: req.method ?? "GET",
      body: req.body ? JSON.stringify(omitUndefined(req.body)) : undefined,
      headers: {
        "content-type": "application/json",
        ...(req.headers || {}),
      },
      ...(controller ? { signal: controller.signal } : {}),
    };

    if (req.proxy) {
      fetchOptions.proxy = req.proxy;
    }

    let response: Response;
    try {
      response = await fetch(url, fetchOptions);
    } catch (error) {
      if (timeoutId) clearTimeout(timeoutId);
      if (controller?.signal.aborted) {
        throw new RequestTimeoutError(req.timeout!);
      }
      throw error;
    }

    if (timeoutId) clearTimeout(timeoutId);

    if (!response.ok) {
      let errorData: unknown;
      try {
        // Read as text first, then try to parse as JSON
        const errorText = await response.text();
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = errorText;
        }
      } catch {
        errorData = "";
      }
      throw new RequestError(
        `Request failed with status ${response.status}`,
        response.status,
        response.statusText,
        errorData,
      );
    }

    let responseText: string = "";
    try {
      responseText = await response.text();
      if (!responseText.trim()) {
        throw new Error("Empty response body");
      }
      return JSON.parse(responseText) as T;
    } catch (error) {
      // If parsing fails, use the text we already read (or empty string if text() failed)
      throw new RequestError(
        `Failed to parse JSON response: ${error instanceof Error ? error.message : String(error)}`,
        response.status,
        response.statusText,
        responseText,
      );
    }
  }, req.retries ?? 0);
};
