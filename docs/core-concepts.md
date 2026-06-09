# Core Concepts

This document introduces the fundamental concepts behind Lagless Core.

Understanding these concepts will help you use the library effectively and make informed architectural decisions in your applications.

---

# The Lagless Model

Lagless is built around a simple idea:

> Applications should continue working regardless of network conditions while minimizing unnecessary requests and maintaining data consistency.

To achieve this, Lagless combines several systems:

* Request orchestration
* Caching
* Persistent storage
* Offline support
* Synchronization
* Event-driven communication

into a single runtime.

---

# Requests

A request represents an operation that retrieves or sends data.

Example:

```typescript
const response = await client.request({
  url: '/api/users',
  method: 'GET'
});
```

Every request passes through the internal request pipeline before execution.

The pipeline may:

* Deduplicate requests
* Apply caching strategies
* Retry failures
* Emit events
* Record metrics

---

# Request Lifecycle

A request generally follows this flow:

```text
Request
   │
   ▼
Strategy Resolution
   │
   ▼
Cache Lookup
   │
 ┌─┴─┐
 │   │
Hit Miss
 │   │
 ▼   ▼
Return Network
      │
      ▼
Cache Update
      │
      ▼
Response
```

---

# Cache Strategies

A cache strategy determines how Lagless resolves data.

---

## cache-only

Only retrieve data from cache.

If the item does not exist, the request fails.

```typescript
await client.request({
  url: '/api/users',
  strategy: 'cache-only'
});
```

---

## network-only

Always perform a network request.

Cache is ignored.

```typescript
await client.request({
  url: '/api/users',
  strategy: 'network-only'
});
```

---

## cache-first

Try cache first.

If no cached value exists, fetch from the network.

```typescript
await client.request({
  url: '/api/users',
  strategy: 'cache-first'
});
```

---

## network-first

Try the network first.

If the request fails, use cached data if available.

```typescript
await client.request({
  url: '/api/users',
  strategy: 'network-first'
});
```

---

## stale-while-revalidate

Return cached data immediately.

Update the cache in the background.

```typescript
await client.request({
  url: '/api/users',
  strategy: 'stale-while-revalidate'
});
```

This strategy provides excellent perceived performance.

---

# Cache Entries

A cache entry contains:

```typescript
{
  key: string;
  value: unknown;
  tags: string[];
  createdAt: number;
  expiresAt?: number;
}
```

Each entry is uniquely identified by its cache key.

---

# Cache Keys

Cache keys identify stored data.

Examples:

```text
user:1
user:42
posts:list
settings
```

Lagless generates keys deterministically to ensure predictable behavior.

The same request should produce the same cache key.

---

# Tags

Tags group related cache entries.

Example:

```typescript
await client.request({
  url: '/api/posts',
  tags: ['posts']
});
```

Multiple entries may share the same tag.

---

## Why Tags Exist

Without tags:

```text
posts:1
posts:2
posts:3
posts:4
```

You would need to invalidate each entry individually.

With tags:

```text
Tag: posts
 ├─ posts:1
 ├─ posts:2
 ├─ posts:3
 └─ posts:4
```

A single invalidation clears all related entries.

---

## Invalidating Tags

```typescript
await client.invalidate('posts');
```

Or:

```typescript
await client.invalidateTags([
  'posts',
  'comments'
]);
```

---

# Time-To-Live (TTL)

TTL determines how long data remains valid.

Example:

```typescript
cache: {
  defaultTTL: 300000
}
```

The above configuration sets a TTL of five minutes.

After expiration:

* Entries may be removed
* Entries may be refreshed
* Strategies may determine next behavior

---

# Storage

Storage provides persistence.

Lagless separates caching from storage.

Examples include:

* Memory
* localStorage
* IndexedDB
* Custom providers

Storage implementations must follow a common interface.

---

# Offline State

Lagless continuously tracks connectivity.

The runtime can be:

```text
ONLINE
```

or

```text
OFFLINE
```

State changes trigger events and synchronization workflows.

---

# Offline Operations

When offline, certain operations may be queued.

Example:

```typescript
await client.queue.add({
  url: '/api/posts',
  method: 'POST',
  body: {
    title: 'Offline Post'
  }
});
```

The operation executes later when connectivity returns.

---

# Queue

The queue stores pending operations.

Typical queue entries include:

```typescript
{
  id: string;
  url: string;
  method: string;
  body: unknown;
  attempts: number;
}
```

Queue entries can persist across sessions.

---

# Synchronization

Synchronization keeps data up-to-date.

Lagless supports multiple synchronization triggers.

---

## Reconnect Sync

Triggered when the application reconnects.

```text
Offline
   │
   ▼
Online
   │
   ▼
Sync
```

---

## Visibility Sync

Triggered when the application becomes visible.

```text
Hidden
   │
   ▼
Visible
   │
   ▼
Sync
```

---

## Focus Sync

Triggered when application focus returns.

```text
Blurred
   │
   ▼
Focused
   │
   ▼
Sync
```

---

## Scheduled Sync

Triggered at configured intervals.

```typescript
sync: {
  interval: 60000
}
```

---

# Request Deduplication

Duplicate concurrent requests are merged.

Example:

```typescript
await Promise.all([
  client.request({ url: '/api/users' }),
  client.request({ url: '/api/users' }),
  client.request({ url: '/api/users' })
]);
```

Only one network request is executed.

All callers receive the same response.

---

# Subscriptions

Subscriptions provide reactive updates.

---

## Exact Key Subscription

```typescript
client.subscriptions.subscribe(
  'user:1',
  callback
);
```

---

## Namespace Subscription

```typescript
client.subscriptions.subscribeToNamespace(
  'user',
  callback
);
```

Receives updates for:

```text
user:1
user:2
user:3
```

---

## Pattern Subscription

```typescript
client.subscriptions.subscribeToPattern(
  /^user:\d+$/,
  callback
);
```

Receives updates matching the pattern.

---

# Events

Events enable communication across the runtime.

Examples:

```text
request:start
request:end
cache:set
cache:invalidate
offline:detected
sync:start
sync:end
```

Applications may also emit custom events.

```typescript
await client.events.emit(
  'custom:event',
  { value: 123 }
);
```

---

# Metrics

Metrics measure runtime behavior.

Examples:

```typescript
const metrics =
  client.getMetricsSnapshot();
```

Common metrics include:

* Cache hits
* Cache misses
* Network requests
* Retry attempts
* Queue depth
* Average latency

---

# Plugins

Plugins extend Lagless without modifying core code.

A plugin may:

* Observe requests
* Modify responses
* Record metrics
* Emit events
* Integrate external systems

Example:

```typescript
client.plugins.register(
  analyticsPlugin
);
```

---

# Configuration

Lagless behavior is controlled through configuration.

Example:

```typescript
const client = createLagless({
  cache: {
    enabled: true
  },
  offline: {
    enabled: true
  },
  sync: {
    enabled: true
  }
});
```

Configuration is distributed internally to all engines.

---

# Putting It Together

A typical request may involve:

```text
Request
   │
   ▼
Strategy
   │
   ▼
Cache
   │
   ▼
Network
   │
   ▼
Storage
   │
   ▼
Events
   │
   ▼
Metrics
   │
   ▼
Subscriptions
```

Each system contributes a specific capability while remaining part of a unified runtime.

This coordinated architecture is what enables Lagless to provide resilient, offline-capable, cache-aware applications through a single API.
