# ⚠️ Error Handling — Lagless Core

This document explains how errors are structured, classified, propagated, and handled within Lagless Core.

Lagless is designed so that **errors are predictable, recoverable when possible, and always observable**.

---

# 🧠 1. Error Handling Philosophy

Lagless follows three principles:

```text id="p1"
1. Never fail silently
2. Classify every failure
3. Recover automatically when possible
```

Errors are not just exceptions — they are **state transitions in the system**.

---

# 🧱 2. Error Types Overview

Lagless defines structured error categories:

* Request Errors
* Network Errors
* Cache Errors
* Storage Errors
* Offline Errors
* Retry Errors
* Sync Errors
* Plugin Errors
* Validation Errors

Each type has specific handling rules.

---

# 🌐 3. Request Errors

Request errors occur during HTTP execution.

```ts id="r1"
RequestError
```

## Examples

* invalid URL
* failed fetch
* aborted request
* timeout

---

## Handling Behavior

```text id="r2"
Request Failure → Retry Engine → Cache Fallback → Queue (if offline)
```

---

# 📡 4. Network Errors

Network errors are transient failures:

* no internet
* DNS failure
* connection reset

```ts id="n1"
NetworkError
```

## Behavior

```text id="n2"
Network Failure → Retry Engine → Backoff → Retry Attempt
```

---

# 📦 5. Cache Errors

Cache errors occur when storage or retrieval fails.

```ts id="c1"
CacheError
```

## Causes

* corrupted cache entry
* storage quota exceeded
* invalid serialization

## Behavior

```text id="c2"
Cache Failure → Bypass Cache → Network Request
```

---

# 💾 6. Storage Errors

Storage engine failures:

```ts id="s1"
StorageError
```

## Causes

* IndexedDB unavailable
* quota exceeded
* write failure

## Handling

```text id="s2"
Storage Failure → Fallback Memory Store → Retry Write Later
```

---

# 📴 7. Offline Errors

Offline errors occur when:

* user is offline
* operation requires network immediately

```ts id="o1"
OfflineError
```

## Handling

```text id="o2"
Offline Action → Queue Operation → Deferred Execution
```

No user-facing failure is thrown if queueing succeeds.

---

# 🔁 8. Retry Errors

Retry errors occur when all retry attempts are exhausted.

```ts id="r3"
RetryError
```

## Flow

```text id="r4"
Attempt 1 → Attempt 2 → Attempt 3 → Fail → RetryError
```

## Handling Strategy

* log error in metrics
* emit event
* mark operation as failed

---

# 🔄 9. Sync Errors

Sync errors occur during reconciliation.

```ts id="sy1"
SyncError
```

## Causes

* conflict not resolved
* server rejection
* merge failure

## Handling

```text id="sy2"
Sync Failure → Conflict Resolution Strategy → Retry Sync
```

---

# 🔌 10. Plugin Errors

Plugin errors are isolated and never crash the system.

```ts id="p1"
PluginError
```

## Isolation Principle

```text id="p2"
Plugin Failure → Captured → Logged → Core Continues
```

Plugins cannot break core runtime.

---

# 🧪 11. Validation Errors

Validation errors occur when request input is invalid.

```ts id="v1"
ValidationError
```

## Examples

* missing required field
* invalid type
* schema mismatch

## Behavior

```text id="v2"
Validation Error → Stop Execution → Return Immediate Failure
```

No retries occur.

---

# ⚙️ 12. Error Propagation Flow

All errors flow through a unified pipeline:

```text id="f1"
Engine Error
   ↓
Classification Layer
   ↓
Retry Decision Engine
   ↓
Fallback System (Cache / Queue / Offline)
   ↓
Event Emission
   ↓
Metrics Logging
```

---

# 📡 13. Error Events

Errors are always emitted as events:

```text id="e1"
request:error
cache:error
sync:error
retry:error
plugin:error
storage:error
```

Example:

```ts id="e2"
client.events.on("request:error", (err) => {
  console.log(err.message);
});
```

---

# 📊 14. Error Metrics

Lagless tracks:

* error frequency
* error type distribution
* retry exhaustion rate
* sync failure rate

```ts id="m1"
const metrics = client.getMetricsSnapshot();
```

---

# 🔁 15. Automatic Recovery System

Lagless attempts recovery in this order:

```text id="a1"
1. Retry Engine
2. Cache Fallback
3. Queue Storage (offline)
4. Sync Recovery
5. Final Failure State
```

---

# 🧠 16. Error State Model

Every operation has a lifecycle state:

```text id="st1"
pending
processing
retrying
failed
succeeded
```

Errors are transitions between states.

---

# ⚠️ 17. Critical Failure Handling

Some errors cannot be recovered:

* validation failure
* authentication failure
* forbidden request

These bypass retry completely.

---

# 🔒 18. Safety Guarantees

Lagless guarantees:

* no silent failures
* no untracked errors
* no plugin crashes affecting core
* no unobserved retry exhaustion

---

# 🚀 19. Best Practices

## Always inspect error types

```ts id="bp1"
if (error instanceof NetworkError) {}
```

---

## Do not retry validation errors

They are permanent failures.

---

## Use events for monitoring

```ts id="bp2"
client.events.on("request:error", handler);
```

---

## Monitor retry exhaustion

High retry exhaustion = system instability.

---

# 🧠 20. Summary

Lagless error handling ensures:

* structured error classification
* automatic recovery when possible
* controlled retry lifecycle
* safe plugin isolation
* full observability
* event-driven error tracking

---

# 🚀 Final Insight

In Lagless Core:

> Errors are not interruptions — they are managed state transitions in a resilient system.
