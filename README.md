# @iam4x/request

A lightweight, TypeScript-first HTTP request utility with built-in retry logic, query string handling, and automatic undefined value filtering.

## Features

- 🚀 **Simple API** - Clean, intuitive interface for making HTTP requests
- 🔄 **Built-in Retry Logic** - Automatic retry mechanism for failed requests
- ⏱️ **Timeout Support** - Per-request timeouts via `AbortController` with retry-aware behaviour
- 🔗 **Query String Utilities** - Parse and stringify query parameters with support for primitive values, `null`, and arrays
- 🧹 **Automatic Cleanup** - Filters out undefined values from request bodies and params
- 📝 **Flexible Responses** - Return JSON, text, raw `Response`, streams, blobs, array buffers, or status-only `void`
- 📎 **Fetch-Compatible Options** - Pass credentials, cache, mode, redirect, referrer, integrity, priority, signal, and custom fetch implementations
- 📦 **TypeScript First** - Full TypeScript support with comprehensive type definitions
- ⚡ **Zero Dependencies** - Uses native `fetch` API, no external HTTP libraries required
- 🎯 **Tree Shakeable** - Import only what you need

## Installation

```bash
npm install @iam4x/request
# or
yarn add @iam4x/request
# or
pnpm add @iam4x/request
# or
bun add @iam4x/request
```

## Quick Start

```typescript
import { request } from "@iam4x/request";

// Simple GET request
const data = await request<{ id: number; name: string }>({
  url: "https://api.example.com/users",
});

// GET request with query parameters
const users = await request({
  url: "https://api.example.com/users",
  params: {
    page: 1,
    limit: 10,
    status: "active",
  },
});

// POST request with body
const newUser = await request({
  url: "https://api.example.com/users",
  method: "POST",
  body: {
    name: "John Doe",
    email: "john@example.com",
  },
});

// Request with retry logic
const result = await request({
  url: "https://api.example.com/data",
  retries: 3, // Will retry up to 3 times on failure
});
```

## API Reference

### `request<T>(req: Request): Promise<T>`

Makes an HTTP request with the specified options.

#### Parameters

- `req.url` (string | URL, required) - The URL to make the request to
- `req.method` (string, optional) - HTTP method (`GET`, `HEAD`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS`) or any custom method string. Defaults to `GET`
- `req.headers` (HeadersInit, optional) - Custom headers to include in the request
- `req.params` (RequestParams, optional) - Query string parameters. `undefined` values are omitted and `null` values serialize as bare keys
- `req.body` (optional) - Plain JSON object, `string`, `FormData`, `URLSearchParams`, `Blob`, `ArrayBuffer`, `ArrayBufferView`, `ReadableStream`, or `null`
- `req.responseType` (`"json" | "text" | "response" | "stream" | "arrayBuffer" | "blob" | "void"`, optional) - Successful response parsing mode. Defaults to `"json"`
- `req.returnMetadata` (boolean, optional) - Return `{ data, status, statusText, headers, response }` instead of only parsed data
- `req.okStatuses` (number[] | function, optional) - Accepted statuses. Defaults to native `response.ok`
- `req.retries` (number, optional) - Legacy number of retry attempts on failure. Defaults to `0`
- `req.retry` (RetryOptions, optional) - Retry strategy with attempts, delay, backoff, jitter, status/error predicates, and `Retry-After` support
- `req.timeout` (number, optional) - Request timeout in milliseconds. Uses `AbortController` internally. If both `timeout` and `retries` are set, each retry gets its own fresh timeout
- `req.fetch` (typeof fetch, optional) - Custom fetch implementation
- `req.proxy` (string, optional) - Proxy URL to route the request through (runtime-dependent)
- `req.keepalive` (boolean, optional) - Forwarded to `fetch` when provided. In Bun, set `false` to disable connection reuse for the request
- `req.credentials`, `req.mode`, `req.cache`, `req.redirect`, `req.referrer`, `req.referrerPolicy`, `req.integrity`, `req.priority`, `req.signal` - Forwarded to `fetch` when provided

#### Returns

`Promise<T>` - The parsed JSON response by default

Set `responseType: "text"` for `Promise<string>`, `"response"` for raw `Response`, `"stream"` for `ReadableStream | null`, `"arrayBuffer"` for `ArrayBuffer`, `"blob"` for `Blob`, or `"void"` for status-only calls.

#### Example

```typescript
const response = await request<ApiResponse>({
  url: "https://api.example.com/users",
  method: "POST",
  headers: {
    Authorization: "Bearer token123",
  },
  params: {
    include: ["profile", "settings"],
  },
  body: {
    name: "John Doe",
    email: "john@example.com",
  },
  retries: 3,
});
```

### Response Modes

Use `responseType` to control how successful responses are handled. Raw response mode does not consume the body.

```typescript
const text = await request({
  url: "https://api.example.com/health",
  responseType: "text",
});

const csv = await request({
  url: "https://api.example.com/export.csv",
  responseType: "text",
});

const rawResponse = await request({
  url: "https://api.example.com/file",
  responseType: "response",
});

const metadata = await request<void>({
  url: "https://api.example.com/settings",
  method: "PUT",
  body: { theme: "dark" },
  responseType: "void",
  returnMetadata: true,
});

console.log(metadata.status, metadata.headers.get("retry-after"));
```

## Advanced Usage

### Custom Headers

```typescript
const data = await request({
  url: "https://api.example.com/protected",
  headers: {
    Authorization: "Bearer your-token",
    "X-Custom-Header": "value",
  },
});
```

### Query Parameters

```typescript
const data = await request({
  url: "https://api.example.com/search",
  params: {
    q: "search term",
    page: 1,
    includeArchived: false,
    emptyFlag: null,
    omitted: undefined,
    tags: ["new", "featured"],
  },
});
```

This serializes as `?q=search%20term&page=1&includeArchived=false&emptyFlag&tags=new&tags=featured`.

### Request Bodies

Plain object bodies are JSON-stringified and receive `content-type: application/json` when you did not provide a content type. Other supported body types are passed through unchanged.

```typescript
await request({
  url: "https://api.example.com/affiliates/code",
  method: "PATCH",
  body: { affiliateCode },
});

await request({
  url: "https://api.example.com/upload",
  method: "POST",
  body: formData,
});
```

### Retry Logic

Use `retries` for the legacy retry count, or `retry` for a configured strategy. The strategy defaults to idempotent methods unless `retryNonIdempotent` is enabled or an explicit predicate is supplied. `keepalive` requests are not retried unless `retryKeepalive` is enabled.

```typescript
// Retry up to 3 times on failure
const data = await request({
  url: "https://api.example.com/unstable-endpoint",
  retries: 3,
});

const queued = await request({
  url: "https://api.example.com/events",
  method: "POST",
  okStatuses: [200, 202],
  retry: {
    attempts: 2,
    delayMs: 250,
    backoff: "exponential",
    retryOnStatus: [429, 503],
    respectRetryAfter: true,
    retryNonIdempotent: true,
  },
});
```

### Timeout

Use `timeout` (in milliseconds) to abort a request that takes too long. A fresh `AbortController` is created for every attempt, so each retry gets its own independent timeout window:

```typescript
import { request, RequestTimeoutError } from "@iam4x/request";

// Abort if the server doesn't respond within 5 seconds
const data = await request({
  url: "https://api.example.com/slow-endpoint",
  timeout: 5000,
});

// Combine with retries — each attempt has its own 3-second window
try {
  const data = await request({
    url: "https://api.example.com/slow-endpoint",
    timeout: 3000,
    retries: 2, // up to 3 total attempts
  });
} catch (error) {
  if (error instanceof RequestTimeoutError) {
    console.error(`All attempts timed out after ${error.timeout}ms each`);
  }
}
```

### Proxy

Route requests through a proxy by providing the proxy URL. Support depends on your runtime environment:

```typescript
const data = await request({
  url: "https://api.example.com/data",
  proxy: "http://my-proxy.internal:8080",
});
```

### Keepalive

Bun enables connection reuse by default. Set `keepalive: false` to disable it for a single request, or omit the option to preserve the runtime default:

```typescript
const data = await request({
  url: "https://api.example.com/data",
  keepalive: false,
});
```

### Type Safety

The request function is fully typed. Specify your response type for full type safety:

```typescript
interface User {
  id: number;
  name: string;
  email: string;
}

const user = await request<User>({
  url: "https://api.example.com/users/1",
});
// user is typed as User

const csv = await request({
  url: "https://api.example.com/users/export.csv",
  responseType: "text",
});
// csv is typed as string
```

### Error Handling

The `request` function throws a `RequestError` for unacceptable HTTP responses, a `RequestParseError` for successful responses that cannot be parsed as requested, and a `RequestTimeoutError` when the timeout is exceeded on every attempt:

```typescript
import {
  request,
  RequestError,
  RequestParseError,
  RequestTimeoutError,
} from "@iam4x/request";

try {
  const data = await request({
    url: "https://api.example.com/users/999",
    timeout: 5000,
  });
} catch (error) {
  if (error instanceof RequestError) {
    console.error(`Request failed: ${error.status} ${error.statusText}`);
    console.error("Response data:", error.response);
    console.error("Raw response text:", error.responseText);
  }
  if (error instanceof RequestParseError) {
    console.error("The server returned an invalid success body");
  }
  if (error instanceof RequestTimeoutError) {
    console.error(`Timed out after ${error.timeout}ms`);
  }
}
```

#### `RequestError` Class

- `message` (string) - Error message
- `status` (number) - HTTP status code
- `statusText` (string) - HTTP status text
- `headers` (Headers) - Response headers
- `response` (unknown) - Parsed response body when available, otherwise text
- `responseText` (string) - Raw response text
- `rawResponse` (Response | undefined) - Original response object

#### `RequestParseError` Class

Extends `RequestError` and preserves the successful response status plus the raw body that failed parsing.

#### `RequestTimeoutError` Class

- `message` (string) - Error message (`"Request timed out after {n}ms"`)
- `timeout` (number) - The timeout value that was exceeded, in milliseconds

## RequestParams Type

The `RequestParams` type supports:

- `string`
- `number`
- `boolean`
- `null` (serialized as a bare key)
- `undefined` (omitted)
- arrays of `string`, `number`, `boolean`, `null`, and `undefined`

## Behavior

- **Undefined Values**: Automatically filtered out from `params` and `body`
- **Content-Type**: Automatically set to `application/json` only for plain object bodies
- **Body Handling**: `FormData`, `Blob`, streams, binary data, URL search params, and strings are passed through unchanged
- **Response Parsing**: Successful responses are parsed as JSON by default; use `responseType` for text, raw responses, streams, blobs, array buffers, or void responses
- **Query String Encoding**: Special characters are automatically URL-encoded
- **Array Parameters**: Arrays in query params are serialized as repeated keys (`?tags=js&tags=ts`)
- **Null Parameters**: `null` query params are serialized as bare keys (`?flag`)

## Exports

The package exports:

- `request` - Main request function
- `RequestError` - Error class for non-2xx HTTP responses
- `RequestParseError` - Error class for successful responses that fail parsing
- `RequestTimeoutError` - Error class thrown when a request exceeds its timeout
- `Request` - Type for request options
- `RequestParams` - Type for request parameters
- `RequestBody` - Type for supported request bodies
- `RequestMetadata` - Type for metadata responses

## Requirements

- TypeScript 5.9.3 or higher (peer dependency)
- A JavaScript runtime that supports the `fetch` API (Node.js 18+, Bun, or modern browsers)

## License

MIT

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for details.

## Author

[@iam4x](https://github.com/iam4x)
