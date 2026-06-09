# Request Engine

The Request Engine is the primary entry point into Lagless Core.

Every network operation passes through the Request Engine before reaching the network, cache layer, storage layer, retry system, metrics system, and event bus.

Its responsibilities include:

* Request execution
* Request normalization
* Interceptor execution
* Timeout management
* Abort handling
* Retry coordination
* Deduplication coordination
* Cache strategy execution
* Metrics collection
* Event emission

---

# Overview

The Request Engine orchestrates the complete lifecycle of a request.

```text
Application
      │
      ▼
Request Engine
      │
      ▼
Strategy Engine
      │
      ▼
Dedup Engine
      │
      ▼
Cache Engine
      │
      ▼
Network Layer
      │
      ▼
Retry Engine
      │
      ▼
Response
```

The engine serves as the central coordinator between multiple subsystems.

---

# Basic Usage

```typescript
const response = await client.request({
  url: '/api/users'
});
```

The Request Engine automatically determines:

* Request method
* Cache strategy
* Retry behavior
* Timeout behavior
* Event generation
* Metrics collection

based on configuration and request options.

---

# Request Options

```typescript
interface RequestOptions {
  url: string;
  method?: HTTPMethod;
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
  strategy?: CacheStrategy;
  retryPolicy?: Partial<RetryPolicy>;
  signal?: AbortSignal;
  priority?: number;
  tags?: string[];
  metadata?: Record<string, unknown>;
}
```

---

# Request Lifecycle

Every request follows a predictable lifecycle.

```text
Request Created
        │
        ▼
Normalize Options
        │
        ▼
Execute Interceptors
        │
        ▼
Resolve Strategy
        │
        ▼
Deduplicate
        │
        ▼
Cache Resolution
        │
        ▼
Network Execution
        │
        ▼
Retry Handling
        │
        ▼
Cache Update
        │
        ▼
Emit Events
        │
        ▼
Collect Metrics
        │
        ▼
Return Response
```

---

# Request Normalization

Before execution, the Request Engine normalizes incoming options.

Example:

```typescript
await client.request({
  url: '/api/users'
});
```

Internally becomes:

```typescript
{
  url: '/api/users',
  method: 'GET',
  timeout: 30000,
  strategy: 'network-first',
  headers: {}
}
```

This ensures consistent behavior across requests.

---

# HTTP Methods

Supported methods include:

```typescript
type HTTPMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'DELETE'
  | 'HEAD'
  | 'OPTIONS';
```

Example:

```typescript
await client.request({
  url: '/api/posts',
  method: 'POST',
  body: {
    title: 'Hello World'
  }
});
```

---

# Headers

Headers are passed directly to the network layer.

```typescript
await client.request({
  url: '/api/users',
  headers: {
    Authorization: 'Bearer token',
    'X-Request-ID': '123'
  }
});
```

Headers may also be modified by request interceptors.

---

# Request Body

Any serializable value may be used as a request body.

```typescript
await client.request({
  url: '/api/posts',
  method: 'POST',
  body: {
    title: 'Example',
    content: 'Hello'
  }
});
```

The transport layer determines serialization behavior.

---

# Timeout Handling

Requests may define custom timeouts.

```typescript
await client.request({
  url: '/api/users',
  timeout: 5000
});
```

If execution exceeds the timeout duration:

```text
Timeout Reached
      │
      ▼
Abort Request
      │
      ▼
Throw TimeoutError
```

---

# Abort Support

Lagless supports request cancellation through AbortController.

```typescript
const controller =
  new AbortController();

client.request({
  url: '/api/slow',
  signal: controller.signal
});

controller.abort();
```

When aborted:

* Network activity is cancelled
* Resources are released
* Request promise rejects

---

# Request Interceptors

Interceptors allow modification of requests before execution.

---

## Request Interceptor

```typescript
const client = createLagless({
  request: {
    interceptors: {
      request: [
        async options => {
          options.headers = {
            ...options.headers,
            Authorization: 'Bearer token'
          };

          return options;
        }
      ]
    }
  }
});
```

Common use cases:

* Authentication
* Header injection
* Logging
* Tracing

---

## Response Interceptor

```typescript
const client = createLagless({
  request: {
    interceptors: {
      response: [
        async response => {
          console.log(response.status);

          return response;
        }
      ]
    }
  }
});
```

Common use cases:

* Data transformation
* Logging
* Analytics
* Error normalization

---

# Request Deduplication

The Request Engine coordinates with the Deduplication Engine.

Identical concurrent requests are merged.

Example:

```typescript
await Promise.all([
  client.request({ url: '/api/users' }),
  client.request({ url: '/api/users' }),
  client.request({ url: '/api/users' })
]);
```

Result:

```text
3 Requests
     │
     ▼
Deduplication Engine
     │
     ▼
1 Network Call
     │
     ▼
Shared Response
```

This reduces network overhead and improves performance.

---

# Cache Strategy Resolution

The Request Engine delegates cache decisions to the Strategy Engine.

Supported strategies:

* cache-only
* network-only
* cache-first
* network-first
* stale-while-revalidate

Example:

```typescript
await client.request({
  url: '/api/posts',
  strategy: 'cache-first'
});
```

The selected strategy determines the request execution path.

---

# Retry Handling

Failed requests may be retried automatically.

Example:

```typescript
await client.request({
  url: '/api/posts',
  retryPolicy: {
    maxAttempts: 3
  }
});
```

Execution flow:

```text
Failure
   │
   ▼
Retry Engine
   │
   ▼
Delay
   │
   ▼
Retry
```

---

# Retry Policy

```typescript
interface RetryPolicy {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitter: boolean;
}
```

Example:

```typescript
retryPolicy: {
  maxAttempts: 5,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  jitter: true
}
```

---

# Request Priority

Requests may include priority metadata.

```typescript
await client.request({
  url: '/api/posts',
  priority: 10
});
```

Priority can be used by schedulers, queues, or plugins.

Higher values indicate higher priority.

---

# Request Tags

Tags associate requests with cache entries.

```typescript
await client.request({
  url: '/api/posts',
  tags: ['posts']
});
```

Tags enable efficient invalidation.

Example:

```typescript
await client.invalidate('posts');
```

---

# Request Metadata

Custom metadata may accompany requests.

```typescript
await client.request({
  url: '/api/users',
  metadata: {
    source: 'signup-form',
    feature: 'onboarding'
  }
});
```

Metadata is available to:

* Plugins
* Interceptors
* Metrics systems

---

# Events

The Request Engine emits lifecycle events.

Examples:

```text
request:start
request:end
request:success
request:error
request:timeout
request:abort
```

Example:

```typescript
client.events.on(
  'request:start',
  payload => {
    console.log(payload.url);
  }
);
```

---

# Metrics

The Request Engine contributes metrics such as:

* Total requests
* Successful requests
* Failed requests
* Request duration
* Retry count
* Timeout count

Metrics are available through:

```typescript
const metrics =
  client.getMetricsSnapshot();
```

---

# Errors

The Request Engine may throw:

```typescript
RequestError
TimeoutError
ValidationError
OfflineError
```

Example:

```typescript
try {
  await client.request({
    url: '/api/users'
  });
} catch (error) {
  if (error instanceof TimeoutError) {
    console.log('Timed out');
  }
}
```

---

# Response Structure

A typical response contains:

```typescript
interface Response<T> {
  data: T;
  status: number;
  headers: Headers;
  cached: boolean;
  duration: number;
}
```

Example:

```typescript
const response =
  await client.request<User>({
    url: '/api/users/1'
  });

console.log(response.data);
console.log(response.cached);
```

---

# Best Practices

## Use Tags Consistently

```typescript
tags: ['users']
```

Consistent tags simplify cache invalidation.

---

## Set Appropriate Timeouts

Avoid excessively long requests.

```typescript
timeout: 10000
```

---

## Prefer Strategy Selection

Explicitly define strategies when behavior matters.

```typescript
strategy: 'stale-while-revalidate'
```

---

## Use Interceptors Carefully

Keep interceptors lightweight.

Avoid expensive synchronous work.

---

## Monitor Metrics

Review request performance regularly.

```typescript
client.getMetricsSnapshot();
```

Metrics help identify bottlenecks and reliability issues.

---

# Summary

The Request Engine is the operational heart of Lagless Core.

It coordinates:

* Requests
* Strategies
* Retries
* Deduplication
* Timeouts
* Interceptors
* Metrics
* Events

while exposing a single, predictable API for network operations.
