# Offline Engine

The Offline Engine is responsible for detecting connectivity changes and coordinating offline-first behavior throughout Lagless Core.

It enables applications to continue functioning when network connectivity is unavailable while ensuring operations are synchronized once connectivity returns.

The Offline Engine works closely with:

* Request Engine
* Queue Engine
* Sync Engine
* Event Bus
* Storage Engine
* Metrics Engine

---

# Overview

The Offline Engine acts as the connectivity awareness layer of Lagless.

```text
Application
      │
      ▼
Offline Engine
      │
 ┌────┴────┐
 │         │
Online   Offline
 │         │
 ▼         ▼
Network   Queue
```

Its purpose is to:

* Detect connectivity changes
* Manage online/offline state
* Coordinate queued operations
* Trigger synchronization
* Emit connectivity events

---

# Responsibilities

The Offline Engine manages:

* Connectivity detection
* Online state tracking
* Offline state tracking
* Reconnection handling
* Queue coordination
* Sync coordination
* Offline event generation
* Connectivity metrics

---

# Online vs Offline

Lagless treats connectivity as a runtime state.

Possible states:

```text
ONLINE
```

```text
OFFLINE
```

Applications can react to changes in this state.

---

# Connectivity Lifecycle

```text
Online
   │
   ▼
Connection Lost
   │
   ▼
Offline
   │
   ▼
Queue Operations
   │
   ▼
Connection Restored
   │
   ▼
Synchronization
   │
   ▼
Online
```

---

# Configuration

Offline support may be enabled globally.

```typescript
const client = createLagless({
  offline: {
    enabled: true
  }
});
```

---

# Checking Status

Determine whether the application is currently online.

```typescript
const online =
  client.offline.isOnline();
```

Determine whether the application is offline.

```typescript
const offline =
  client.offline.isOffline();
```

---

# Manual State Control

Useful for testing.

```typescript
client.offline.setOnline(
  false
);
```

```typescript
client.offline.setOnline(
  true
);
```

Example test:

```typescript
client.offline.setOnline(
  false
);

expect(
  client.offline.isOffline()
).toBe(true);
```

---

# Automatic Detection

The Offline Engine can observe browser connectivity APIs.

```text
Browser
    │
    ▼
Connectivity Change
    │
    ▼
Offline Engine
```

Typical signals include:

* navigator.onLine
* Network events
* Failed requests
* Custom connectivity providers

---

# Connectivity Providers

Lagless may support multiple detection strategies.

Examples:

```text
Browser API
Ping Endpoint
Custom Health Check
Native Platform Signal
```

Applications may choose the most reliable option for their environment.

---

# Offline Requests

When offline, requests may behave differently depending on strategy.

Example:

```typescript
await client.request({
  url: '/api/posts',
  strategy: 'network-first'
});
```

Possible flow:

```text
Request
   │
   ▼
Offline
   │
   ▼
Cache Fallback
```

---

# Offline Mutations

Write operations often cannot be completed while offline.

Example:

```typescript
await client.request({
  url: '/api/posts',
  method: 'POST',
  body: {
    title: 'Offline Post'
  }
});
```

Lagless may queue the operation for later execution.

---

# Queue Coordination

The Offline Engine works directly with the Queue Engine.

```text
Offline
    │
    ▼
Queue Operation
    │
    ▼
Persist Queue
```

When connectivity returns:

```text
Online
   │
   ▼
Process Queue
   │
   ▼
Sync Data
```

---

# Queue Persistence

Queued operations may survive restarts.

```typescript
offline: {
  queuePersistence: true
}
```

Flow:

```text
Offline
   │
   ▼
Queue Operation
   │
   ▼
Storage Engine
   │
   ▼
IndexedDB
```

After restart:

```text
Application Start
       │
       ▼
Restore Queue
       │
       ▼
Continue Processing
```

---

# Maximum Queue Size

Applications may limit queue growth.

```typescript
offline: {
  maxQueueSize: 1000
}
```

When exceeded:

```text
Queue Full
    │
    ▼
Reject Operation
```

or

```text
Queue Full
    │
    ▼
Evict Oldest Entry
```

depending on configuration.

---

# Reconnection Handling

When connectivity returns:

```text
Offline
   │
   ▼
Online
   │
   ▼
Reconnect Event
   │
   ▼
Queue Processing
   │
   ▼
Synchronization
```

This process may occur automatically.

---

# Sync Integration

The Offline Engine triggers synchronization events.

Example:

```text
Connectivity Restored
         │
         ▼
Sync Engine
         │
         ▼
Fetch Updates
         │
         ▼
Refresh Cache
```

This ensures application data becomes current again.

---

# Conflict Scenarios

Offline applications may encounter conflicts.

Example:

```text
Device A Offline
      │
      ▼
Modify Record
      │
      ▼
Server Updated Elsewhere
      │
      ▼
Reconnect
```

Result:

```text
Conflict
```

Conflict resolution is delegated to the Sync Engine.

---

# Offline Cache Usage

Offline applications frequently rely on cache.

Example:

```typescript
await client.request({
  url: '/api/profile',
  strategy: 'cache-first'
});
```

Flow:

```text
Offline
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

# Events

The Offline Engine emits connectivity events.

Examples:

```text
offline:detected
online:detected
offline:queued
offline:reconnected
```

Example subscription:

```typescript
client.events.on(
  'offline:detected',
  payload => {
    console.log(
      payload.timestamp
    );
  }
);
```

---

# Event Flow

```text
Connection Lost
       │
       ▼
offline:detected
       │
       ▼
Queue Operations
       │
       ▼
Connection Restored
       │
       ▼
online:detected
       │
       ▼
offline:reconnected
```

---

# Metrics

The Offline Engine records metrics such as:

* Offline duration
* Reconnection count
* Queue growth
* Queue drain count
* Connectivity transitions

Example:

```typescript
const metrics =
  client.getMetricsSnapshot();
```

---

# Monitoring Offline Time

Applications may track time spent offline.

```text
Online
  │
  ▼
Offline
  │
  ▼
Duration Recorded
  │
  ▼
Online
```

Useful for:

* Diagnostics
* Reliability monitoring
* User experience analysis

---

# Storage Integration

The Offline Engine relies on persistence for:

* Queue recovery
* Connectivity metadata
* Sync checkpoints

```text
Offline Engine
       │
       ▼
Storage Engine
       │
       ▼
IndexedDB
```

---

# Error Handling

Possible offline-related errors include:

```typescript
OfflineError
QueueError
SyncError
```

Example:

```typescript
try {
  await client.request({
    url: '/api/posts'
  });
} catch (error) {
  if (
    error instanceof OfflineError
  ) {
    console.log(
      'Offline mode'
    );
  }
}
```

---

# Testing Offline Behavior

Example:

```typescript
client.offline.setOnline(
  false
);

await client.queue.add({
  url: '/api/posts',
  method: 'POST'
});

expect(
  await client.queue.getPendingCount()
).toBe(1);
```

Restore connectivity:

```typescript
client.offline.setOnline(
  true
);

await client.queue.processQueue();
```

---

# Best Practices

## Enable Queue Persistence

For offline-first applications:

```typescript
offline: {
  queuePersistence: true
}
```

This prevents operation loss.

---

## Set Queue Limits

Prevent unbounded growth.

```typescript
offline: {
  maxQueueSize: 1000
}
```

---

## Use Cache-Friendly Strategies

Prefer:

```typescript
cache-first
```

or

```typescript
stale-while-revalidate
```

for offline resilience.

---

## Monitor Connectivity Events

Subscribe to online/offline events.

```typescript
client.events.on(
  'online:detected',
  callback
);
```

This improves user experience and observability.

---

## Test Offline Scenarios

Regularly test:

* Connection loss
* Queue persistence
* Reconnection
* Synchronization

Offline-first behavior should be verified as carefully as network behavior.

---

# Summary

The Offline Engine is the connectivity awareness system of Lagless Core.

It provides:

* Online/offline detection
* Queue coordination
* Reconnection handling
* Sync triggering
* Offline event generation
* Connectivity metrics
* Persistent offline workflows

allowing applications to remain functional even when network connectivity is unavailable.
