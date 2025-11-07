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

export const request = async <T>(req: Request) => {
  return retry(async () => {
    const url = req.params
      ? `${req.url}?${stringify(omitUndefined(req.params))}`
      : req.url;

    const response = await fetch(url, {
      method: req.method ?? "GET",
      body: req.body ? JSON.stringify(omitUndefined(req.body)) : undefined,
      headers: {
        "content-type": "application/json",
        ...(req.headers || {}),
      },
    });

    if (!response.ok) {
      let errorData: unknown;
      try {
        errorData = await response.json();
      } catch {
        errorData = await response.text();
      }
      throw new RequestError(
        `Request failed with status ${response.status}`,
        response.status,
        response.statusText,
        errorData,
      );
    }

    return response.json() as Promise<T>;
  }, req.retries ?? 0);
};
