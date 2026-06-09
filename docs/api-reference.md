# 📚 API Reference — Lagless Core

This document defines the **official public API surface** of Lagless Core.

It is the contract developers rely on when building applications, plugins, and integrations.

---

# 🧠 1. Core Client

## createLagless

Creates a new Lagless client instance.

```ts id="c1"
createLagless(config?: LaglessConfig): LaglessClient
```

---

## Example

```ts id="c2"
import { createLagless } from "lagless-core";

const client = createLagless();
```

---

# ⚙️ 2. Client Interface

```ts id="i1"
interface LaglessClient {
  request(options: RequestOptions): Promise<RequestResponse>;

  cache: CacheEngine;
  queue: QueueEngine;
  sync: SyncEngine;
  retry: RetryEngine;

  subscriptions: SubscriptionEngine;
  events: EventBus;
  metrics: MetricsEngine;
  plugins: PluginManager;

  getMetricsSnapshot(): MetricsSnapshot;

  invalidate(tag: string | string[]): Promise<void>;

  destroy(): void;
}
```

---

# 🌐 3. Request API

## request()

Executes a network request with full Lagless pipeline.

```ts id="r1"
request(options: RequestOptions): Promise<RequestResponse>
```

---

## RequestOptions

```ts id="r2"
interface RequestOptions {
  url: string;
  method?: HTTPMethod;
  headers?: Record<string, string>;
  body?: unknown;

  strategy?: CacheStrategy;

  timeout?: number;

  retryPolicy?: Partial<RetryPolicy>;

  tags?: string[];

  priority?: number;

  metadata?: Record<string, unknown>;
}
```

---

## Cache Strategies

```ts id="r3"
type CacheStrategy =
  | "network-first"
  | "cache-first"
  | "cache-only"
  | "network-only"
  | "stale-while-revalidate";
```

---

## Example

```ts id="r4"
const res = await client.request({
  url: "/api/users",
  strategy: "cache-first"
});
```

---

# 📦 4. Cache API

## get()

```ts id="c3"
cache.get<T>(key: string): Promise<T | null>
```

## set()

```ts id="c4"
cache.set<T>(
  key: string,
  value: T,
  tags?: string[],
  ttl?: number
): Promise<void>
```

## invalidate()

```ts id="c5"
cache.invalidate(tag: string | string[]): Promise<void>
```

## clear()

```ts id="c6"
cache.clear(): Promise<void>
```

---

# 📴 5. Queue API

## add()

```ts id="q1"
queue.add(operation: QueueOperation): Promise<string>
```

## getPendingCount()

```ts id="q2"
queue.getPendingCount(): Promise<number>
```

## processQueue()

```ts id="q3"
queue.processQueue(): Promise<void>
```

## cancelOperation()

```ts id="q4"
queue.cancelOperation(id: string): Promise<void>
```

---

# 🔄 6. Sync API

## run()

```ts id="s1"
sync.run(): Promise<void>
```

Triggers synchronization of queued and cached mutations.

---

# 🔁 7. Retry API

Retry engine is internal but configurable via request options.

---

## RetryPolicy

```ts id="rp1"
interface RetryPolicy {
  maxAttempts: number;
  baseDelay: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  jitter?: boolean;
}
```

---

# 📡 8. Subscription API

## subscribe()

```ts id="sub1"
subscribe<T>(
  key: string,
  callback: (data: T, old?: T) => void
): () => void
```

---

## subscribeToNamespace()

```ts id="sub2"
subscribeToNamespace<T>(
  namespace: string,
  callback: (data: T) => void
): () => void
```

---

## subscribeToPattern()

```ts id="sub3"
subscribeToPattern(
  pattern: RegExp,
  callback: (payload: { key: string; value: unknown }) => void,
  options?: { once?: boolean }
): () => void
```

---

# 📊 9. Metrics API

## counter()

```ts id="m1"
metrics.counter(name: string, value: number): void
```

## gauge()

```ts id="m2"
metrics.gauge(name: string, value: number): void
```

## timing()

```ts id="m3"
metrics.timing(name: string, ms: number): void
```

## histogram()

```ts id="m4"
metrics.histogram(name: string, value: number): void
```

---

## getMetricsSnapshot()

```ts id="m5"
getMetricsSnapshot(): MetricsSnapshot
```

---

# 🔌 10. Plugin API

## register()

```ts id="p1"
plugins.register(plugin: Plugin): void
```

## unregister()

```ts id="p2"
plugins.unregister(name: string): void
```

---

## Plugin Interface

```ts id="p3"
interface Plugin {
  name: string;
  version?: string;

  hooks?: Record<string, Function>;

  setup?: (manager: PluginManager) => void;

  teardown?: () => void;
}
```

---

## Example

```ts id="p4"
client.plugins.register({
  name: "auth",
  hooks: {
    beforeRequest: async (ctx) => {
      ctx.headers.Authorization = "Bearer token";
      return ctx;
    }
  }
});
```

---

# 📡 11. Event API

## on()

```ts id="e1"
events.on(event: string, handler: Function): void
```

## emit()

```ts id="e2"
events.emit(event: string, payload?: unknown): void
```

---

## Common Events

```ts id="e3"
request:start
request:end
request:error

cache:set
cache:get

queue:add
queue:process

sync:start
sync:end

retry:attempt
retry:failure

plugin:error
```

---

# 💾 12. Storage Engine (Indirect API)

```ts id="st1"
storage.get(key)
storage.set(key, value)
storage.delete(key)
storage.clear()
```

---

# 🧠 13. Error Types

```ts id="er1"
RequestError
NetworkError
CacheError
QueueError
SyncError
RetryError
PluginError
ValidationError
OfflineError
```

---

# 🧾 14. Configuration Schema

```ts id="cfg1"
interface LaglessConfig {
  cache?: {
    maxSize?: number;
    defaultTTL?: number;
    lru?: boolean;
  };

  request?: {
    timeout?: number;
    retryPolicy?: RetryPolicy;
  };

  offline?: {
    enabled?: boolean;
    queuePersistence?: boolean;
  };

  sync?: {
    enabled?: boolean;
    strategies?: string[];
  };

  metrics?: {
    enabled?: boolean;
    sampleRate?: number;
  };

  debug?: boolean;
}
```

---

# 🚀 15. Lifecycle API

```ts id="l1"
client.destroy(): void
```

Cleans up:

* subscriptions
* event listeners
* queues
* timers
* cache handles

---

# 🧠 16. Summary

The Lagless API provides:

* Unified request system
* Multi-layer caching
* Offline queue execution
* Sync engine coordination
* Retry resilience
* Reactive subscriptions
* Plugin extensibility
* Metrics observability
* Event-driven architecture

---

# 🚀 Final Insight

Lagless API is designed so that:

> Every complex distributed system behavior is accessible through a single, consistent client interface.
