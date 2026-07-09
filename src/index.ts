import { stringify } from "./utils/query-string.utils.js";
import { omitUndefined } from "./utils/omit-undefined.utils.js";

export type RequestMethod =
  | "GET"
  | "HEAD"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "OPTIONS"
  | (string & {});

export type RequestParamValue =
  | boolean
  | string
  | number
  | null
  | undefined
  | Array<boolean | string | number | null | undefined>;

export type RequestParams = Record<string, RequestParamValue>;

export type JsonObjectBody = Record<string, unknown>;
export type RequestBody = JsonObjectBody | BodyInit | null;
export type RequestResponseType =
  "json" | "text" | "response" | "stream" | "arrayBuffer" | "blob" | "void";
export type RequestPriorityValue = RequestInit extends {
  priority?: infer Priority;
}
  ? Priority
  : "high" | "low" | "auto";

export type RetryBackoff =
  | "linear"
  | "exponential"
  | "fixed"
  | ((attempt: number, delayMs: number) => number);

export type RetryOptions = {
  attempts: number;
  delayMs?: number;
  backoff?: RetryBackoff;
  jitter?: boolean | number;
  retryOnStatus?: number[] | ((status: number) => boolean);
  retryOnError?: (error: unknown, attempt: number) => boolean;
  respectRetryAfter?: boolean;
  retryNonIdempotent?: boolean;
  retryKeepalive?: boolean;
};

export type RequestMetadata<T> = {
  data: T;
  status: number;
  statusText: string;
  headers: Headers;
  response: Response;
};

export type FetchImplementation = typeof fetch;

export type Request = {
  url: string | URL;
  headers?: HeadersInit;
  method?: RequestMethod;
  params?: RequestParams;
  body?: RequestBody;
  responseType?: RequestResponseType;
  returnMetadata?: boolean;
  okStatuses?: number[] | ((status: number) => boolean);
  retries?: number;
  retry?: RetryOptions;
  fetch?: FetchImplementation;
  proxy?: string;
  timeout?: number;
  keepalive?: boolean;
  credentials?: RequestCredentials;
  mode?: RequestMode;
  cache?: RequestCache;
  redirect?: RequestRedirect;
  referrer?: string;
  referrerPolicy?: ReferrerPolicy;
  integrity?: string;
  priority?: RequestPriorityValue;
  signal?: AbortSignal;
};

type NativeRequestInit = RequestInit & {
  fetch?: FetchImplementation;
  proxy?: string;
  priority?: RequestPriorityValue;
};

type RequestErrorDetails = {
  status: number;
  statusText: string;
  headers?: Headers;
  response?: unknown;
  responseText?: string;
  rawResponse?: Response;
};

export class RequestError extends Error {
  public status: number;
  public statusText: string;
  public headers: Headers;
  public response?: unknown;
  public responseText: string;
  public rawResponse?: Response;

  constructor(message: string, details: RequestErrorDetails);
  constructor(
    message: string,
    status: number,
    statusText: string,
    response?: unknown,
  );
  constructor(
    message: string,
    detailsOrStatus: RequestErrorDetails | number,
    statusText?: string,
    response?: unknown,
  ) {
    super(message);
    this.name = "RequestError";

    const details =
      typeof detailsOrStatus === "number"
        ? {
            status: detailsOrStatus,
            statusText: statusText ?? "",
            response,
            responseText: typeof response === "string" ? response : "",
          }
        : detailsOrStatus;

    this.status = details.status;
    this.statusText = details.statusText;
    this.headers = details.headers ?? new Headers();
    this.response = details.response;
    this.responseText = details.responseText ?? "";
    this.rawResponse = details.rawResponse;
  }
}

export class RequestParseError extends RequestError {
  constructor(message: string, details: RequestErrorDetails) {
    super(message, details);
    this.name = "RequestParseError";
  }
}

export class RequestTimeoutError extends Error {
  constructor(public timeout: number) {
    super(`Request timed out after ${timeout}ms`);
    this.name = "RequestTimeoutError";
  }
}

const idempotentMethods = new Set(["GET", "HEAD", "PUT", "DELETE", "OPTIONS"]);
const defaultRetryStatuses = new Set([408, 425, 429, 500, 502, 503, 504]);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isPlainObject = (value: unknown): value is JsonObjectBody => {
  if (Object.prototype.toString.call(value) !== "[object Object]") {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const hasHeader = (headers: Record<string, string>, name: string) =>
  Object.keys(headers).some((header) => header.toLowerCase() === name);

const normalizeHeaders = (headers?: HeadersInit): Record<string, string> => {
  if (!headers) return {};

  if (typeof Headers !== "undefined" && headers instanceof Headers) {
    return Object.fromEntries(headers.entries());
  }

  if (Array.isArray(headers)) {
    return Object.fromEntries(headers);
  }

  return { ...(headers as Record<string, string>) };
};

const prepareBodyAndHeaders = (req: Request) => {
  const headers = normalizeHeaders(req.headers);

  if (req.body === undefined) {
    return { body: undefined, headers };
  }

  if (req.body === null) {
    return { body: null, headers };
  }

  if (isPlainObject(req.body)) {
    if (!hasHeader(headers, "content-type")) {
      headers["content-type"] = "application/json";
    }

    return {
      body: JSON.stringify(omitUndefined(req.body)),
      headers,
    };
  }

  return { body: req.body, headers };
};

const appendParams = (url: string | URL, params?: RequestParams) => {
  const baseUrl = String(url);
  if (!params) return baseUrl;

  const query = stringify(params);
  if (!query) return baseUrl;

  return `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}${query}`;
};

const isAcceptedStatus = (
  response: Response,
  okStatuses?: Request["okStatuses"],
) => {
  if (!okStatuses) return response.ok;

  if (Array.isArray(okStatuses)) {
    return okStatuses.includes(response.status);
  }

  return okStatuses(response.status);
};

const parseTextAsJson = (text: string) => {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
};

const createRequestError = async (
  response: Response,
  message = `Request failed with status ${response.status}`,
) => {
  let responseText = "";
  let parsedResponse: unknown = "";

  try {
    responseText = await response.text();
    parsedResponse = responseText ? parseTextAsJson(responseText) : "";
  } catch {
    responseText = "";
    parsedResponse = "";
  }

  return new RequestError(message, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
    response: parsedResponse,
    responseText,
    rawResponse: response,
  });
};

const parseSuccessResponse = async <T>(
  response: Response,
  req: Request,
): Promise<
  | T
  | string
  | Response
  | ReadableStream<Uint8Array>
  | ArrayBuffer
  | Blob
  | null
  | void
> => {
  const responseType = req.responseType ?? "json";

  if (responseType === "response") {
    return response;
  }

  if (responseType === "stream") {
    return response.body;
  }

  if (responseType === "arrayBuffer") {
    return response.arrayBuffer();
  }

  if (responseType === "blob") {
    return response.blob();
  }

  if (responseType === "void") {
    return undefined;
  }

  if (
    responseType === "json" &&
    ((req.method ?? "GET").toUpperCase() === "HEAD" ||
      response.status === 204 ||
      response.status === 205 ||
      response.status === 304)
  ) {
    return undefined;
  }

  const responseText = await response.text();

  if (responseType === "text") {
    return responseText;
  }

  if (!responseText.trim()) {
    throw new RequestParseError(
      "Failed to parse JSON response: Empty response body",
      {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        response: responseText,
        responseText,
        rawResponse: response,
      },
    );
  }

  try {
    return JSON.parse(responseText) as T;
  } catch (error) {
    throw new RequestParseError(
      `Failed to parse JSON response: ${error instanceof Error ? error.message : String(error)}`,
      {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        response: responseText,
        responseText,
        rawResponse: response,
      },
    );
  }
};

const assignIfDefined = <Key extends keyof NativeRequestInit>(
  target: NativeRequestInit,
  key: Key,
  value: NativeRequestInit[Key] | undefined,
) => {
  if (value !== undefined) {
    target[key] = value;
  }
};

const buildFetchOptions = (
  req: Request,
  signal?: AbortSignal,
): NativeRequestInit => {
  const { body, headers } = prepareBodyAndHeaders(req);
  const fetchOptions: NativeRequestInit = {
    method: req.method ?? "GET",
    body,
    headers,
  };

  assignIfDefined(fetchOptions, "credentials", req.credentials);
  assignIfDefined(fetchOptions, "mode", req.mode);
  assignIfDefined(fetchOptions, "cache", req.cache);
  assignIfDefined(fetchOptions, "redirect", req.redirect);
  assignIfDefined(fetchOptions, "referrer", req.referrer);
  assignIfDefined(fetchOptions, "referrerPolicy", req.referrerPolicy);
  assignIfDefined(fetchOptions, "integrity", req.integrity);
  assignIfDefined(fetchOptions, "priority", req.priority);
  assignIfDefined(fetchOptions, "keepalive", req.keepalive);
  assignIfDefined(fetchOptions, "signal", signal);
  assignIfDefined(fetchOptions, "proxy", req.proxy);

  return fetchOptions;
};

const createAttemptSignal = (req: Request) => {
  const timeoutError = req.timeout
    ? new RequestTimeoutError(req.timeout)
    : null;
  const controller = req.timeout ? new AbortController() : null;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let timedOut = false;
  let removeAbortListener: (() => void) | null = null;

  if (controller && req.signal) {
    const abortFromRequestSignal = () => {
      controller.abort(req.signal?.reason);
    };

    if (req.signal.aborted) {
      abortFromRequestSignal();
    } else {
      req.signal.addEventListener("abort", abortFromRequestSignal, {
        once: true,
      });
      removeAbortListener = () =>
        req.signal?.removeEventListener("abort", abortFromRequestSignal);
    }
  }

  if (controller && req.timeout && timeoutError) {
    timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort(timeoutError);
    }, req.timeout);
  }

  return {
    signal: controller?.signal ?? req.signal,
    timeoutError,
    get timedOut() {
      return timedOut;
    },
    cleanup: () => {
      if (timeoutId !== null) clearTimeout(timeoutId);
      removeAbortListener?.();
    },
  };
};

const runAttempt = async <T>(req: Request) => {
  const url = appendParams(req.url, req.params);
  const attemptSignal = createAttemptSignal(req);
  const fetchImpl = req.fetch ?? fetch;

  try {
    const response = await fetchImpl(
      url,
      buildFetchOptions(req, attemptSignal.signal),
    );

    if (!isAcceptedStatus(response, req.okStatuses)) {
      throw await createRequestError(response);
    }

    const data = await parseSuccessResponse<T>(response, req);

    if (req.returnMetadata) {
      return {
        data,
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        response,
      };
    }

    return data;
  } catch (error) {
    if (attemptSignal.timedOut && attemptSignal.timeoutError) {
      throw attemptSignal.timeoutError;
    }

    throw error;
  } finally {
    attemptSignal.cleanup();
  }
};

const retryAttemptsFor = (req: Request) =>
  req.retry?.attempts ?? req.retries ?? 0;

const isStatusRetryable = (status: number, retry?: RetryOptions) => {
  if (!retry?.retryOnStatus) {
    return defaultRetryStatuses.has(status);
  }

  if (Array.isArray(retry.retryOnStatus)) {
    return retry.retryOnStatus.includes(status);
  }

  return retry.retryOnStatus(status);
};

const methodCanRetryByDefault = (req: Request) => {
  const method = (req.method ?? "GET").toUpperCase();
  return idempotentMethods.has(method);
};

const shouldRetry = (error: unknown, req: Request, failedAttempt: number) => {
  if (req.keepalive && !req.retry?.retryKeepalive) {
    return false;
  }

  const hasExplicitRetryPredicate =
    Boolean(req.retry?.retryOnStatus) || Boolean(req.retry?.retryOnError);
  const isLegacyRetry = !req.retry && req.retries !== undefined;

  if (
    !isLegacyRetry &&
    !req.retry?.retryNonIdempotent &&
    !hasExplicitRetryPredicate &&
    !methodCanRetryByDefault(req)
  ) {
    return false;
  }

  if (req.retry?.retryOnError?.(error, failedAttempt)) {
    return true;
  }

  if (error instanceof RequestError) {
    if (isLegacyRetry) return true;
    return isStatusRetryable(error.status, req.retry);
  }

  if (isLegacyRetry) return true;

  return req.retry?.retryOnError
    ? req.retry.retryOnError(error, failedAttempt)
    : true;
};

const retryAfterDelay = (error: unknown) => {
  if (!(error instanceof RequestError)) return null;

  const retryAfter = error.headers.get("retry-after");
  if (!retryAfter) return null;

  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1000);
  }

  const date = Date.parse(retryAfter);
  if (!Number.isNaN(date)) {
    return Math.max(0, date - Date.now());
  }

  return null;
};

const retryDelay = (
  error: unknown,
  retry: RetryOptions | undefined,
  failedAttempt: number,
) => {
  const retryAfter = retry?.respectRetryAfter ? retryAfterDelay(error) : null;
  if (retryAfter !== null) return retryAfter;

  const delayMs = retry?.delayMs ?? 100;
  const backoff = retry?.backoff ?? "linear";
  const delay =
    typeof backoff === "function"
      ? backoff(failedAttempt, delayMs)
      : backoff === "fixed"
        ? delayMs
        : backoff === "exponential"
          ? delayMs * 2 ** (failedAttempt - 1)
          : delayMs * failedAttempt;

  if (retry?.jitter === true) {
    return Math.random() * delay;
  }

  if (typeof retry?.jitter === "number") {
    return delay + Math.random() * retry.jitter;
  }

  return delay;
};

const runWithRetries = async <T>(req: Request) => {
  const retryAttempts = retryAttemptsFor(req);

  for (let failedAttempt = 0; ; failedAttempt++) {
    try {
      return await runAttempt<T>(req);
    } catch (error) {
      if (
        failedAttempt >= retryAttempts ||
        !shouldRetry(error, req, failedAttempt + 1)
      ) {
        throw error;
      }

      const delay = retryDelay(error, req.retry, failedAttempt + 1);
      if (delay > 0) {
        await sleep(delay);
      }
    }
  }
};

const isNativeRequest = (value: unknown) =>
  typeof globalThis.Request !== "undefined" &&
  value instanceof globalThis.Request;

const isRequestOptions = (value: unknown): value is Request =>
  typeof value === "object" &&
  value !== null &&
  !isNativeRequest(value) &&
  !(value instanceof URL) &&
  "url" in value;

export function request(
  input: RequestInfo | URL,
  init?: NativeRequestInit,
): Promise<Response>;
export function request(
  req: Request & { responseType: "response"; returnMetadata: true },
): Promise<RequestMetadata<Response>>;
export function request(
  req: Request & { responseType: "response"; returnMetadata?: false },
): Promise<Response>;
export function request(
  req: Request & { responseType: "stream"; returnMetadata: true },
): Promise<RequestMetadata<ReadableStream<Uint8Array> | null>>;
export function request(
  req: Request & { responseType: "stream"; returnMetadata?: false },
): Promise<ReadableStream<Uint8Array> | null>;
export function request(
  req: Request & { responseType: "arrayBuffer"; returnMetadata: true },
): Promise<RequestMetadata<ArrayBuffer>>;
export function request(
  req: Request & { responseType: "arrayBuffer"; returnMetadata?: false },
): Promise<ArrayBuffer>;
export function request(
  req: Request & { responseType: "blob"; returnMetadata: true },
): Promise<RequestMetadata<Blob>>;
export function request(
  req: Request & { responseType: "blob"; returnMetadata?: false },
): Promise<Blob>;
export function request(
  req: Request & { responseType: "void"; returnMetadata: true },
): Promise<RequestMetadata<void>>;
export function request(
  req: Request & { responseType: "void"; returnMetadata?: false },
): Promise<void>;
export function request(
  req: Request & { responseType: "text"; returnMetadata: true },
): Promise<RequestMetadata<string>>;
export function request(
  req: Request & { responseType: "text"; returnMetadata?: false },
): Promise<string>;
export function request<T>(
  req: Request & { responseType?: "json"; returnMetadata: true },
): Promise<RequestMetadata<T>>;
export function request<T>(
  req: Request & { responseType?: "json"; returnMetadata?: false },
): Promise<T>;
export async function request<T>(
  reqOrInput: Request | RequestInfo | URL,
  init?: NativeRequestInit,
) {
  if (!isRequestOptions(reqOrInput)) {
    const fetchImpl = init?.fetch ?? fetch;
    const { fetch: _fetch, ...fetchInit } = init ?? {};
    return fetchImpl(reqOrInput, fetchInit);
  }

  return runWithRetries<T>(reqOrInput);
}
