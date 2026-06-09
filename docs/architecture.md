# Architecture

## Overview

Lagless Core is built as a collection of independent engines coordinated through a central client runtime.

Each engine is responsible for a single concern and communicates through stable internal interfaces.

This separation allows features such as caching, synchronization, offline support, storage persistence, metrics collection, and request management to evolve independently while remaining part of a unified system.

---

## High-Level Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                     Lagless Client                          │
├─────────────────────────────────────────────────────────────┤
│ RequestEngine      │ CacheEngine        │ StorageEngine     │
│ QueueEngine        │ SyncEngine         │ OfflineEngine     │
│ MetricsEngine      │ EventBus           │ PluginManager     │
│ DedupEngine        │ RetryEngine        │ SubscriptionEngine│
│ StrategyEngine     │ ConfigManager                         │
└─────────────────────────────────────────────────────────────┘
```

---

## Design Principles

### Separation of Concerns

Every engine has a clearly defined responsibility.

Examples:

* RequestEngine manages HTTP requests.
* CacheEngine manages cache storage and retrieval.
* OfflineEngine manages connectivity state.
* QueueEngine manages deferred operations.
* MetricsEngine tracks performance and telemetry.

No engine should directly assume responsibility for another engine's domain.

---

### Deterministic Behavior

Given the same:

* configuration
* request
* cache state
* storage state

Lagless should produce predictable outcomes.

This principle helps ensure reproducibility and easier debugging.

---

### Storage Independence

Lagless does not depend on a single storage implementation.

Storage providers are abstracted behind the StorageEngine.

Supported implementations may include:

* Memory
* localStorage
* IndexedDB
* Custom adapters

---

### Event-Driven Coordination

Engines communicate through the Event Bus.

Example:

```text
Request Completed
        │
        ▼
 EventBus Emits
        │
        ▼
 CacheEngine Updates
        │
        ▼
 SubscriptionEngine Notifies
```

This reduces coupling between subsystems.

---

## Core Runtime

The Lagless Client acts as the orchestration layer.

Responsibilities include:

* Engine initialization
* Configuration management
* Lifecycle management
* Resource cleanup
* Plugin registration

The client exposes a unified public API while delegating functionality to internal engines.

---

## Request Lifecycle

A typical request follows this path:

```text
Application
      │
      ▼
RequestEngine
      │
      ▼
StrategyEngine
      │
      ▼
Cache Lookup
      │
 ┌────┴────┐
 │         │
Hit       Miss
 │         │
 ▼         ▼
Return   Network
Cache    Request
            │
            ▼
      CacheEngine
            │
            ▼
         Response
```

---

## Request Engine

The Request Engine is responsible for:

* Request execution
* Timeout handling
* Interceptors
* Request normalization
* Abort support

The engine serves as the entry point for all network operations.

---

## Deduplication Engine

The Deduplication Engine prevents duplicate concurrent requests.

Example:

```typescript
await Promise.all([
  client.request({ url: '/api/posts' }),
  client.request({ url: '/api/posts' }),
  client.request({ url: '/api/posts' })
]);
```

Only a single network request is performed.

Remaining callers receive the same result.

---

## Retry Engine

The Retry Engine manages failed requests.

Features include:

* Exponential backoff
* Retry limits
* Retry jitter
* Delay scheduling

Typical flow:

```text
Request Failed
       │
       ▼
 Retry Engine
       │
       ▼
 Wait
       │
       ▼
 Retry
```

---

## Strategy Engine

The Strategy Engine determines how data is resolved.

Supported strategies:

### cache-only

Only retrieve from cache.

### network-only

Always perform network requests.

### cache-first

Attempt cache first.

Fallback to network on miss.

### network-first

Attempt network first.

Fallback to cache on failure.

### stale-while-revalidate

Return cached data immediately.

Refresh cache asynchronously.

---

## Cache Engine

The Cache Engine manages:

* Cache storage
* TTL expiration
* Tag indexing
* Cache invalidation
* Cache retrieval

### Cache Flow

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
Return Fetch
```

---

## Storage Engine

The Storage Engine provides persistence.

Responsibilities:

* Read operations
* Write operations
* Deletion
* Serialization
* Migrations

Storage providers must implement a common interface.

---

## Offline Engine

The Offline Engine tracks connectivity.

Responsibilities:

* Online detection
* Offline detection
* Connectivity events
* Queue coordination

Events emitted:

```text
offline:detected
online:detected
```

---

## Queue Engine

The Queue Engine stores operations that cannot execute immediately.

Common examples:

* Offline mutations
* Failed network writes
* Deferred synchronization

Queue entries may persist across application restarts.

---

## Synchronization Engine

The Synchronization Engine coordinates background updates.

Supported triggers:

### Reconnect

Triggered when connectivity returns.

### Visibility

Triggered when the application becomes visible.

### Focus

Triggered when application focus returns.

### Scheduled

Triggered on configured intervals.

---

## Subscription Engine

The Subscription Engine provides reactive updates.

Supported subscriptions:

* Exact keys
* Namespaces
* Pattern matching

Example:

```typescript
client.subscriptions.subscribe('user:1', callback);
```

---

## Event Bus

The Event Bus enables communication between internal systems.

Characteristics:

* Type-safe
* Asynchronous
* Event history support
* Internal and external events

Example events:

```text
request:start
request:end
cache:set
cache:invalidate
offline:detected
sync:start
sync:end
```

---

## Metrics Engine

The Metrics Engine collects runtime statistics.

Examples:

* Cache hit rate
* Cache miss rate
* Request latency
* Retry count
* Queue depth

Metrics may be consumed internally or exported externally.

---

## Plugin Manager

The Plugin Manager extends functionality without modifying core code.

Plugin lifecycle:

```text
Register
    │
    ▼
Setup
    │
    ▼
Hooks Active
    │
    ▼
Teardown
```

Plugins may interact with:

* Requests
* Responses
* Metrics
* Events
* Synchronization

---

## Configuration Manager

The Configuration Manager validates and distributes configuration.

Responsibilities:

* Default values
* Validation
* Runtime access
* Engine configuration

All engines receive configuration through this system.

---

## Lifecycle

### Initialization

```text
Create Client
      │
      ▼
Load Configuration
      │
      ▼
Initialize Engines
      │
      ▼
Register Plugins
      │
      ▼
Ready
```

### Shutdown

```text
Destroy Client
      │
      ▼
Flush Queues
      │
      ▼
Persist State
      │
      ▼
Remove Listeners
      │
      ▼
Shutdown Complete
```

---

## Future Extensibility

The architecture is designed to support:

* Additional storage providers
* Additional synchronization strategies
* New cache policies
* New metrics exporters
* New plugin capabilities

without requiring changes to existing public APIs.
