# @iam4x/request

A lightweight, TypeScript-first HTTP request utility with built-in retry logic, query string handling, and automatic undefined value filtering.

## Features

- 🚀 **Simple API** - Clean, intuitive interface for making HTTP requests
- 🔄 **Built-in Retry Logic** - Automatic retry mechanism for failed requests
- ⏱️ **Timeout Support** - Per-request timeouts via `AbortController` with retry-aware behaviour
- 🔗 **Query String Utilities** - Parse and stringify query parameters with support for arrays and nested objects
- 🧹 **Automatic Cleanup** - Filters out undefined values from request bodies and params
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
import { request } from '@iam4x/request';

// Simple GET request
const data = await request<{ id: number; name: string }>({
  url: 'https://api.example.com/users',
});

// GET request with query parameters
const users = await request({
  url: 'https://api.example.com/users',
  params: {
    page: 1,
    limit: 10,
    status: 'active',
  },
});

// POST request with body
const newUser = await request({
  url: 'https://api.example.com/users',
  method: 'POST',
  body: {
    name: 'John Doe',
    email: 'john@example.com',
  },
});

// Request with retry logic
const result = await request({
  url: 'https://api.example.com/data',
  retries: 3, // Will retry up to 3 times on failure
});
```

## API Reference

### `request<T>(req: Request): Promise<T>`

Makes an HTTP request with the specified options.

#### Parameters

- `req.url` (string, required) - The URL to make the request to
- `req.method` (string, optional) - HTTP method (`GET`, `HEAD`, `POST`, `PUT`, `DELETE`). Defaults to `GET`
- `req.headers` (Record<string, string>, optional) - Custom headers to include in the request
- `req.params` (RequestParams, optional) - Query string parameters (automatically converted to query string)
- `req.body` (RequestParams, optional) - Request body (automatically JSON stringified)
- `req.retries` (number, optional) - Number of retry attempts on failure. Defaults to `0`
- `req.timeout` (number, optional) - Request timeout in milliseconds. Uses `AbortController` internally. If both `timeout` and `retries` are set, each retry gets its own fresh timeout
- `req.proxy` (string, optional) - Proxy URL to route the request through (runtime-dependent)

#### Returns

`Promise<T>` - The parsed JSON response

#### Example

```typescript
const response = await request<ApiResponse>({
  url: 'https://api.example.com/users',
  method: 'POST',
  headers: {
    Authorization: 'Bearer token123',
  },
  params: {
    include: ['profile', 'settings'],
  },
  body: {
    name: 'John Doe',
    email: 'john@example.com',
  },
  retries: 3,
});
```

## Advanced Usage

### Custom Headers

```typescript
const data = await request({
  url: 'https://api.example.com/protected',
  headers: {
    Authorization: 'Bearer your-token',
    'X-Custom-Header': 'value',
  },
});
```

### Complex Query Parameters

```typescript
const data = await request({
  url: 'https://api.example.com/search',
  params: {
    q: 'search term',
    filters: {
      category: 'electronics',
      price: { min: 100, max: 500 },
    },
    tags: ['new', 'featured'],
  },
});
```

### Retry Logic

The retry mechanism will automatically retry failed requests:

```typescript
// Retry up to 3 times on failure
const data = await request({
  url: 'https://api.example.com/unstable-endpoint',
  retries: 3,
});
```

### Timeout

Use `timeout` (in milliseconds) to abort a request that takes too long. A fresh `AbortController` is created for every attempt, so each retry gets its own independent timeout window:

```typescript
import { request, RequestTimeoutError } from '@iam4x/request';

// Abort if the server doesn't respond within 5 seconds
const data = await request({
  url: 'https://api.example.com/slow-endpoint',
  timeout: 5000,
});

// Combine with retries — each attempt has its own 3-second window
try {
  const data = await request({
    url: 'https://api.example.com/slow-endpoint',
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
  url: 'https://api.example.com/data',
  proxy: 'http://my-proxy.internal:8080',
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
  url: 'https://api.example.com/users/1',
});
// user is typed as User
```

### Error Handling

The `request` function throws a `RequestError` for non-2xx HTTP responses and a `RequestTimeoutError` when the timeout is exceeded on every attempt:

```typescript
import { request, RequestError, RequestTimeoutError } from '@iam4x/request';

try {
  const data = await request({
    url: 'https://api.example.com/users/999',
    timeout: 5000,
  });
} catch (error) {
  if (error instanceof RequestError) {
    console.error(`Request failed: ${error.status} ${error.statusText}`);
    console.error('Response data:', error.response);
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
- `response` (unknown) - Parsed response body (JSON or text)

#### `RequestTimeoutError` Class

- `message` (string) - Error message (`"Request timed out after {n}ms"`)
- `timeout` (number) - The timeout value that was exceeded, in milliseconds

## RequestParams Type

The `RequestParams` type supports:

- `string`
- `number`
- `boolean`
- `string[]`
- `number[]`
- `Record<string, any>` (nested objects)
- `Array<Record<string, any>>` (arrays of objects)

## Behavior

- **Undefined Values**: Automatically filtered out from `params` and `body`
- **Content-Type**: Automatically set to `application/json` for requests with a body
- **Query String Encoding**: Special characters are automatically URL-encoded
- **Array Parameters**: Arrays in query params are serialized as repeated keys (`?tags=js&tags=ts`)
- **Nested Objects**: Nested objects in query params use bracket notation (`?user[name]=John`)

## Exports

The package exports:

- `request` - Main request function
- `RequestError` - Error class for non-2xx HTTP responses
- `RequestTimeoutError` - Error class thrown when a request exceeds its timeout
- `Request` - Type for request options
- `RequestParams` - Type for request parameters/body

## Requirements

- TypeScript 5.8.3 or higher (peer dependency)
- A JavaScript runtime that supports the `fetch` API (Node.js 18+, Bun, or modern browsers)

## License

MIT

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for details.

## Author

[@iam4x](https://github.com/iam4x)
