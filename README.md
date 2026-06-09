# ⚡ Lagless Core

> A type-safe request orchestration, caching, storage, synchronization, and offline runtime for modern TypeScript applications.

Lagless Core provides a unified engine for handling network requests, caching strategies, offline operations, persistent storage, synchronization, metrics collection, subscriptions, and extensibility through plugins.

Designed for modern browser, hybrid, and edge environments, Lagless enables developers to build resilient applications that remain responsive regardless of network conditions.

---

## Why Lagless?

Modern applications often require multiple disconnected solutions for:

* Network requests
* Caching
* Offline support
* Request retries
* Persistent storage
* Background synchronization
* Event handling
* Metrics collection

Lagless Core unifies these concerns into a single runtime with a consistent API and architecture.

---

## Features

| Feature                    | Supported |
| -------------------------- | --------- |
| HTTP Requests              | ✅         |
| Request Deduplication      | ✅         |
| Automatic Retries          | ✅         |
| Cache Strategies           | ✅         |
| Persistent Storage         | ✅         |
| Offline Queue              | ✅         |
| Background Synchronization | ✅         |
| Event Bus                  | ✅         |
| Metrics Collection         | ✅         |
| Plugin System              | ✅         |
| Subscriptions              | ✅         |
| TypeScript Support         | ✅         |

---

## Architecture

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

Each engine is responsible for a specific concern and communicates through well-defined internal contracts.

---

## Installation

```bash
npm install lagless-core
```

```bash
yarn add lagless-core
```

```bash
pnpm add lagless-core
```

---

## Quick Start

```typescript
import { createLagless } from 'lagless-core';

const client = createLagless();

const response = await client.request({
  url: 'https://api.henzret.com/items/products/users',
  method: 'GET'
});

console.log(response.data);
```

---

## Core Components

### Request Engine

Handles:

* HTTP requests
* Retries
* Timeouts
* Interceptors
* Request deduplication

### Cache Engine

Supports:

* cache-only
* network-only
* cache-first
* network-first
* stale-while-revalidate

### Storage Engine

Provides:

* IndexedDB support
* localStorage support
* Memory storage
* Encryption support
* Compression support
* Version migrations

### Offline Engine

Provides:

* Offline detection
* Operation queuing
* Queue persistence
* Automatic replay

### Synchronization Engine

Supports:

* Reconnect synchronization
* Visibility synchronization
* Focus synchronization
* Scheduled synchronization

### Event Bus

Provides:

* Type-safe events
* Event history
* Internal communication
* Custom events

### Metrics Engine

Tracks:

* Cache performance
* Request latency
* Retry statistics
* Custom metrics

### Plugin System

Provides:

* Lifecycle hooks
* Extensibility
* Built-in plugins
* Custom integrations

---

## Documentation

### Guides

* [Getting Started](./docs/getting-started.md)
* [Core Concepts](./docs/core-concepts.md)
* [Architecture](./docs/architecture.md)

### Engines

* [Request Engine](./docs/request-engine.md)
* [Cache Engine](./docs/cache-engine.md)
* [Storage Engine](./docs/storage-engine.md)
* [Offline Engine](./docs/offline-engine.md)
* [Queue Engine](./docs/queue-engine.md)
* [Sync Engine](./docs/sync-engine.md)
* [Metrics Engine](./docs/metrics-engine.md)
* [Event Bus](./docs/event-bus.md)
* [Plugin System](./docs/plugin-system.md)

### Advanced

* [Performance](./docs/performance.md)
* [Error Handling](./docs/error-handling.md)
* [Testing](./docs/testing.md)
* [API Reference](./docs/api-reference.md)

---

## Example

```typescript
const client = createLagless({
  cache: {
    enabled: true,
    defaultTTL: 300000
  },
  offline: {
    enabled: true
  },
  sync: {
    enabled: true
  }
});

const posts = await client.request({
  url: '/api/posts',
  strategy: 'stale-while-revalidate',
  tags: ['posts']
});
```

---

## Browser Support

| Browser | Version |
| ------- | ------- |
| Chrome  | 90+     |
| Edge    | 90+     |
| Firefox | 88+     |
| Safari  | 14+     |

---

## Node.js Support

* Node.js 16+
* Native Fetch API or compatible polyfill

---

## Contributing

Contributions are welcome.

Please read:

* [CONTRIBUTING.md](./CONTRIBUTING.md)
* [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)

before submitting issues or pull requests.

---

## Security

If you discover a security vulnerability, please follow the responsible disclosure process outlined in:

* [SECURITY.md](./SECURITY.md)

---

## License

Licensed under the Lagless Source-Available License (LSAL) v1.0.

See:

* [LICENSE.md](./LICENSE.md)

for complete licensing terms.

---

## Support

* Documentation
* GitHub Discussions
* GitHub Issues

Community and support resources will be published as the project matures.
