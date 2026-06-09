# 📘 Getting Started — Lagless Core

This guide helps you install, initialize, and use Lagless Core in a real application environment.

It focuses on the **actual developer workflow**, not internal architecture.

---

# 🚀 Installation

Install Lagless Core via npm, yarn, or pnpm:

```bash
npm install lagless-core
```

or

```bash
yarn add lagless-core
```

or

```bash
pnpm add lagless-core
```

---

# 🧠 Basic Concept

Lagless Core revolves around a single client instance:

```ts
import { createLagless } from "lagless-core";

const client = createLagless();
```

From this point, everything flows through `client`.

---

# ⚙️ First Request

Make your first API request:

```ts
const response = await client.request({
  url: "/api/users",
  method: "GET"
});

console.log(response.data);
```

---

# ⚡ Understanding Request Strategies

Lagless supports intelligent request strategies:

---

## 1. Network First (default)

```ts
await client.request({
  url: "/api/data",
  strategy: "network-first"
});
```

Tries network first, falls back to cache.

---

## 2. Cache First

```ts
await client.request({
  url: "/api/data",
  strategy: "cache-first"
});
```

Returns cached data if available, otherwise fetches.

---

## 3. Stale While Revalidate

```ts
await client.request({
  url: "/api/data",
  strategy: "stale-while-revalidate"
});
```

Returns cached data immediately, then updates in background.

---

## 4. Cache Only

```ts
await client.request({
  url: "/api/data",
  strategy: "cache-only"
});
```

Only uses cache (offline-safe).

---

## 5. Network Only

```ts
await client.request({
  url: "/api/data",
  strategy: "network-only"
});
```

Always fetches fresh data.

---

# 🧩 Working with Cache

## Save data manually

```ts
await client.cache.set(
  "user:1",
  { id: 1, name: "John" },
  ["user"],
  60000
);
```

---

## Get cached data

```ts
const user = await client.cache.get("user:1");
```

---

## Invalidate cache

```ts
await client.cache.invalidate("user");
```

---

# 📴 Offline Support (Core Feature)

Lagless automatically queues actions when offline.

---

## Add offline operation

```ts
await client.queue.add({
  url: "/api/posts",
  method: "POST",
  body: {
    title: "Offline Post"
  }
});
```

---

## Process queued operations

```ts
await client.queue.processQueue();
```

---

## Check queue status

```ts
const count = await client.queue.getPendingCount();
console.log(count);
```

---

# 🔄 Synchronization

Sync ensures data consistency when reconnecting.

```ts
await client.sync.run();
```

Sync triggers automatically on:

* reconnect
* visibility change
* focus event (optional config)

---

# 📡 Subscriptions (Reactive Data Layer)

Subscribe to real-time updates:

```ts
const unsubscribe = client.subscriptions.subscribe(
  "user:1",
  (data, oldData) => {
    console.log("Updated:", data);
  }
);
```

---

## Namespace subscription

```ts
client.subscriptions.subscribeToNamespace(
  "user",
  (data) => {
    console.log("User update:", data);
  }
);
```

---

## Pattern subscription

```ts
client.subscriptions.subscribeToPattern(
  /^post:\d+$/,
  (payload) => {
    console.log("Post changed:", payload);
  }
);
```

---

# 🔁 Retry Behavior (Automatic)

Retries happen automatically on:

* network failure
* timeout
* 5xx server errors
* rate limiting

Example config:

```ts
const client = createLagless({
  request: {
    retryPolicy: {
      maxAttempts: 3,
      baseDelay: 1000,
      backoffMultiplier: 2,
      jitter: true
    }
  }
});
```

---

# 📊 Metrics Snapshot

Get runtime insights:

```ts
const metrics = client.getMetricsSnapshot();

console.log(metrics);
```

Example output:

```json
{
  "requests": 120,
  "cacheHits": 80,
  "cacheMisses": 40,
  "queueSize": 2,
  "retries": 5
}
```

---

# 🔌 Plugins

Extend behavior without modifying core:

```ts
client.plugins.register({
  name: "auth",
  hooks: {
    beforeRequest: async (ctx) => {
      ctx.headers = {
        ...ctx.headers,
        Authorization: "Bearer token"
      };
      return ctx;
    }
  }
});
```

---

# 📡 Event System

Listen to system-wide events:

```ts
client.events.on("request:start", (event) => {
  console.log("Request started:", event.url);
});

client.events.on("cache:set", (event) => {
  console.log("Cache updated:", event.key);
});
```

---

# 🧪 Full Minimal Example

```ts
import { createLagless } from "lagless-core";

const client = createLagless();

async function run() {
  const user = await client.request({
    url: "/api/user/1",
    strategy: "cache-first"
  });

  console.log(user.data);

  await client.queue.add({
    url: "/api/user/update",
    method: "POST",
    body: { name: "New Name" }
  });

  await client.sync.run();
}

run();
```

---

# 🧭 Mental Model

Think of Lagless as:

```
UI
 ↓
Subscriptions
 ↓
Cache Layer
 ↓
Request Engine
 ↓
Retry Engine
 ↓
Queue Engine
 ↓
Sync Engine
 ↓
Storage Layer
```

---

# 🧱 Summary

To use Lagless Core:

1. Create client
2. Make requests
3. Use caching strategies
4. Queue offline actions
5. Sync when online
6. Subscribe to updates

---

# 🚀 You are now ready

From here you can:

* build frontend apps
* build offline-first systems
* integrate with Next.js / React
* extend via plugins
