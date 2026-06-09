# Cache Engine

The Cache Engine is responsible for storing, retrieving, invalidating, and managing cached data within Lagless Core.

It serves as the primary performance layer between applications and external data sources, reducing network requests while maintaining data consistency.

The Cache Engine works closely with:

* Request Engine
* Strategy Engine
* Storage Engine
* Subscription Engine
* Synchronization Engine
* Event Bus
* Metrics Engine

---

# Overview

The Cache Engine sits between the application and the network.

```text
Application
      │
      ▼
Request Engine
      │
      ▼
Cache Engine
      │
 ┌────┴────┐
 │         │
Hit       Miss
 │         │
 ▼         ▼
Return   Network
Cache    Request
```

Its purpose is to:

* Reduce latency
* Reduce bandwidth usage
* Minimize redundant requests
* Improve resilience
* Support offline functionality

---

# Responsibilities

The Cache Engine manages:

* Cache storage
* Cache retrieval
* Cache expiration
* Tag indexing
* Cache invalidation
* Cache updates
* Cache metadata
* Cache statistics

---

# Cache Entry Structure

Every cached item is stored as a cache entry.

```typescript
interface CacheEntry<T = unknown> {
  key: string;
  value: T;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  expiresAt?: number;
}
```

---

# Cache Keys

Every cache entry is uniquely identified by a cache key.

Examples:

```text
user:1
user:42
posts:list
posts:featured
settings
```

Keys must be deterministic.

The same request should always generate the same cache key.

---

# Cache Lifecycle

A cache entry follows a predictable lifecycle.

```text
Created
   │
   ▼
Stored
   │
   ▼
Retrieved
   │
   ▼
Updated
   │
   ▼
Expired
   │
   ▼
Removed
```

---

# Writing Data

Store data directly:

```typescript
await client.cache.set(
  'user:1',
  {
    id: 1,
    name: 'John'
  }
);
```

---

# Reading Data

Retrieve cached values:

```typescript
const user =
  await client.cache.get('user:1');
```

Returns:

```typescript
{
  id: 1,
  name: 'John'
}
```

or

```typescript
undefined
```

if the entry does not exist.

---

# Deleting Data

Remove a specific entry.

```typescript
await client.cache.delete(
  'user:1'
);
```

---

# Clearing Cache

Remove all cache entries.

```typescript
await client.cache.clear();
```

---

# Time-To-Live (TTL)

TTL controls how long entries remain valid.

Example:

```typescript
await client.cache.set(
  'user:1',
  user,
  [],
  60000
);
```

The entry expires after:

```text
60 Seconds
```

---

# Default TTL

A default TTL may be configured globally.

```typescript
const client = createLagless({
  cache: {
    defaultTTL: 300000
  }
});
```

Equivalent to:

```text
5 Minutes
```

---

# Expiration Flow

```text
Cache Entry
      │
      ▼
TTL Expires
      │
      ▼
Marked Expired
      │
      ▼
Removed or Refreshed
```

Behavior depends on the active cache strategy.

---

# Tags

Tags group related cache entries.

Example:

```typescript
await client.cache.set(
  'post:1',
  post,
  ['posts']
);
```

Multiple entries may share a tag.

```text
posts
 ├─ post:1
 ├─ post:2
 ├─ post:3
 └─ post:4
```

---

# Why Tags Matter

Without tags:

```text
post:1
post:2
post:3
post:4
```

Every entry must be invalidated individually.

With tags:

```text
posts
 ├─ post:1
 ├─ post:2
 ├─ post:3
 └─ post:4
```

One invalidation removes all related entries.

---

# Tag Invalidation

Invalidate all entries associated with a tag.

```typescript
await client.invalidate(
  'posts'
);
```

---

# Multiple Tag Invalidation

Invalidate several tags simultaneously.

```typescript
await client.invalidateTags([
  'posts',
  'comments',
  'users'
]);
```

---

# Cache Strategies

The Cache Engine participates in all strategy execution.

Supported strategies:

* cache-only
* network-only
* cache-first
* network-first
* stale-while-revalidate

---

# cache-only

Retrieve only from cache.

```typescript
await client.request({
  url: '/api/posts',
  strategy: 'cache-only'
});
```

Flow:

```text
Request
   │
   ▼
Cache Lookup
   │
 ┌─┴─┐
 │   │
Hit Miss
 │   │
 ▼   ▼
Data Error
```

---

# network-only

Always bypass cache.

```typescript
await client.request({
  url: '/api/posts',
  strategy: 'network-only'
});
```

Flow:

```text
Request
   │
   ▼
Network
```

---

# cache-first

Prefer cached data.

```typescript
await client.request({
  url: '/api/posts',
  strategy: 'cache-first'
});
```

Flow:

```text
Cache
  │
 ┌┴┐
 │ │
Hit Miss
 │ │
 ▼ ▼
Data Network
```

---

# network-first

Prefer fresh network data.

```typescript
await client.request({
  url: '/api/posts',
  strategy: 'network-first'
});
```

Flow:

```text
Network
   │
 ┌─┴─┐
 │   │
Success Failure
 │       │
 ▼       ▼
Data   Cache
```

---

# stale-while-revalidate

Return cached data immediately.

Refresh cache asynchronously.

```typescript
await client.request({
  url: '/api/posts',
  strategy: 'stale-while-revalidate'
});
```

Flow:

```text
Cache
  │
  ▼
Return Data
  │
  ▼
Background Fetch
  │
  ▼
Cache Update
```

This strategy provides excellent user experience and perceived performance.

---

# Cache Metadata

Each entry contains metadata.

Example:

```typescript
{
  key: 'user:1',
  createdAt: 1700000000,
  updatedAt: 1700005000,
  expiresAt: 1700010000,
  tags: ['users']
}
```

Metadata supports:

* Expiration
* Auditing
* Synchronization
* Metrics

---

# Batch Operations

Store multiple entries efficiently.

```typescript
await client.cache.setMany({
  'user:1': user1,
  'user:2': user2,
  'user:3': user3
});
```

---

# Batch Retrieval

```typescript
const users =
  await client.cache.getMany([
    'user:1',
    'user:2',
    'user:3'
  ]);
```

---

# Storage Integration

The Cache Engine delegates persistence to the Storage Engine.

```text
Cache Engine
      │
      ▼
Storage Engine
      │
      ▼
IndexedDB
localStorage
Memory
Custom Adapter
```

This separation keeps cache behavior independent of storage implementation.

---

# Subscription Integration

Cache updates may trigger subscriptions.

Example:

```typescript
client.subscriptions.subscribe(
  'user:1',
  callback
);
```

When the cache changes:

```text
Cache Update
      │
      ▼
Subscription Engine
      │
      ▼
Notify Subscribers
```

---

# Event Integration

The Cache Engine emits events.

Examples:

```text
cache:set
cache:get
cache:delete
cache:invalidate
cache:clear
cache:expired
```

Example:

```typescript
client.events.on(
  'cache:set',
  payload => {
    console.log(payload.key);
  }
);
```

---

# Metrics Integration

The Cache Engine records metrics.

Examples:

* Cache hits
* Cache misses
* Cache writes
* Cache invalidations
* Expired entries

Example:

```typescript
const metrics =
  client.getMetricsSnapshot();
```

---

# Memory Management

Cache growth may be limited.

```typescript
const client = createLagless({
  cache: {
    maxSize: 100 * 1024 * 1024
  }
});
```

Example:

```text
100 MB
```

maximum cache size.

---

# LRU Eviction

Least Recently Used (LRU) eviction may be enabled.

```typescript
cache: {
  lru: true
}
```

Flow:

```text
Cache Full
    │
    ▼
Evict Oldest Accessed Entry
    │
    ▼
Store New Entry
```

---

# Error Handling

Possible cache errors include:

```typescript
CacheError
ValidationError
StorageError
```

Example:

```typescript
try {
  await client.cache.set(
    'key',
    value
  );
} catch (error) {
  if (error instanceof CacheError) {
    console.error(error);
  }
}
```

---

# Best Practices

## Use Tags Consistently

Good:

```typescript
tags: ['posts']
```

Avoid:

```typescript
tags: ['Posts']
tags: ['POSTS']
tags: ['post']
```

Consistency improves invalidation behavior.

---

## Set Appropriate TTLs

Different data requires different lifetimes.

Examples:

```text
User Profile      → Long TTL
News Feed         → Medium TTL
Leaderboard       → Short TTL
```

---

## Prefer Tag Invalidation

Avoid deleting individual entries when a tag can be used.

Good:

```typescript
await client.invalidate('posts');
```

---

## Monitor Hit Rate

Regularly review cache metrics.

High hit rates indicate effective caching.

Low hit rates may indicate:

* TTL too short
* Poor key generation
* Excessive invalidation

---

# Summary

The Cache Engine is the performance foundation of Lagless Core.

It provides:

* Deterministic caching
* TTL management
* Tag-based invalidation
* Strategy integration
* Storage abstraction
* Subscription notifications
* Metrics collection
* Event generation

while remaining independent of storage implementations and network transports.
