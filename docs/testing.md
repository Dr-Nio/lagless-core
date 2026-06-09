# 🧪 Testing Guide — Lagless Core

This document explains how to test Lagless Core applications, plugins, and internal behaviors in a reliable and deterministic way.

Lagless is designed to be **fully testable across all layers**: request, cache, queue, sync, retry, and plugins.

---

# 🧠 1. Testing Philosophy

Lagless testing is based on 4 principles:

```text id="p1"
1. Deterministic behavior
2. Engine isolation
3. Mockable network layer
4. Event-driven verification
```

Tests should validate **system behavior**, not just function outputs.

---

# ⚙️ 2. Test Setup

Lagless works with modern test runners like:

* Vitest
* Jest
* Node test runner

Example setup:

```ts id="s1"
import { createLagless } from "lagless-core";
import { vi, describe, it, expect } from "vitest";
```

---

# 🧱 3. Creating a Test Client

Always create isolated instances:

```ts id="c1"
const client = createLagless({
  cache: {
    enabled: true,
    defaultTTL: 1000
  },
  metrics: {
    enabled: false
  }
});
```

Isolation ensures no shared state between tests.

---

# 🌐 4. Testing Requests

## Basic request test

```ts id="r1"
it("should fetch data", async () => {
  const res = await client.request({
    url: "/api/test"
  });

  expect(res).toBeDefined();
});
```

---

## Mocking network calls

```ts id="r2"
global.fetch = vi.fn().mockResolvedValue({
  json: async () => ({ data: "ok" })
});
```

---

## Retry behavior test

```ts id="r3"
const fetcher = vi.fn()
  .mockRejectedValueOnce(new Error("fail"))
  .mockResolvedValue({ data: "success" });

const result = await client.request({
  url: "/api/test"
});

expect(result.data).toBe("success");
```

---

# 📦 5. Cache Testing

## Cache write/read

```ts id="c2"
await client.cache.set("key", { value: 123 });

const cached = await client.cache.get("key");

expect(cached.value).toBe(123);
```

---

## Cache hit validation

```ts id="c3"
const spy = vi.fn();

await client.request({
  url: "/api/data",
  strategy: "cache-first"
});

await client.request({
  url: "/api/data",
  strategy: "cache-first"
});

expect(spy).toHaveBeenCalledTimes(1);
```

---

# 📴 6. Offline Queue Testing

## Queue operations when offline

```ts id="q1"
client.offline.setOnline(false);

await client.queue.add({
  url: "/api/post",
  method: "POST",
  body: { title: "Test" }
});

expect(await client.queue.getPendingCount())
  .toBe(1);
```

---

## Processing queue when online

```ts id="q2"
client.offline.setOnline(true);

await client.queue.processQueue();

expect(await client.queue.getPendingCount())
  .toBe(0);
```

---

# 🔄 7. Sync Testing

```ts id="s2"
it("should sync queued operations", async () => {
  await client.sync.run();

  const metrics = client.getMetricsSnapshot();

  expect(metrics.syncSuccessRate).toBeGreaterThan(0);
});
```

---

# 🔁 8. Retry Testing

## Retry success case

```ts id="rt1"
const result = await client.request({
  url: "/api/fail-once"
});

expect(result).toBeDefined();
```

---

## Retry exhaustion case

```ts id="rt2"
await expect(
  client.request({
    url: "/api/always-fail",
    retryPolicy: {
      maxAttempts: 1
    }
  })
).rejects.toThrow();
```

---

# 📡 9. Event Testing

Lagless emits events for all system actions.

## Listening to events

```ts id="e1"
const handler = vi.fn();

client.events.on("request:start", handler);

await client.request({
  url: "/api/test"
});

expect(handler).toHaveBeenCalled();
```

---

## Cache event test

```ts id="e2"
const handler = vi.fn();

client.events.on("cache:set", handler);

await client.cache.set("key", "value");

expect(handler).toHaveBeenCalled();
```

---

# 🔌 10. Plugin Testing

## Register plugin

```ts id="p1"
const plugin = {
  name: "test-plugin",
  hooks: {
    beforeRequest: vi.fn((ctx) => ctx)
  }
};

client.plugins.register(plugin);
```

---

## Validate hook execution

```ts id="p2"
await client.request({
  url: "/api/test"
});

expect(plugin.hooks.beforeRequest)
  .toHaveBeenCalled();
```

---

# 📊 11. Metrics Testing

```ts id="m1"
client.metrics.counter("requests", 1);

const snapshot = client.getMetricsSnapshot();

expect(snapshot.requests).toBeGreaterThan(0);
```

---

# 🧠 12. Deterministic Testing Strategy

Lagless is deterministic when:

* same cache state
* same mock network responses
* same configuration

---

## Example deterministic setup

```ts id="d1"
beforeEach(() => {
  vi.clearAllMocks();
});
```

---

# ⚡ 13. Performance Testing

## Measure latency

```ts id="perf1"
const start = Date.now();

await client.request({
  url: "/api/test"
});

const duration = Date.now() - start;

expect(duration).toBeLessThan(200);
```

---

# 🧪 14. Integration Testing

Test full flow:

```ts id="i1"
await client.queue.add({
  url: "/api/save",
  method: "POST",
  body: { name: "Test" }
});

await client.sync.run();

const metrics = client.getMetricsSnapshot();

expect(metrics.queueSize).toBe(0);
```

---

# 🧠 15. Best Practices

## Always isolate client instances

```ts id="bp1"
const client = createLagless();
```

---

## Mock network explicitly

Avoid real API calls in tests.

---

## Test behavior, not implementation

Focus on outcomes:

* cache hit
* retry success
* queue processing

---

## Use event assertions

Lagless is event-driven — test events heavily.

---

# 🚀 16. Summary

Lagless testing ensures:

* deterministic behavior
* full engine isolation
* reliable offline simulation
* retry validation
* cache correctness
* plugin safety
* event correctness

---

# 🧠 Final Insight

In Lagless Core:

> If it cannot be tested reliably, it does not belong in the core system.
