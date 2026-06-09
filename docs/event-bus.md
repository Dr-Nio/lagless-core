# Event Bus

The Event Bus is the communication backbone of Lagless Core.

It provides a centralized, type-safe event system that allows internal engines, plugins, extensions, and applications to communicate without direct dependencies.

The Event Bus enables a loosely coupled architecture where components can react to system activity without needing to know implementation details of other subsystems.

The Event Bus is used throughout Lagless Core by:

* Request Engine
* Cache Engine
* Storage Engine
* Offline Engine
* Queue Engine
* Sync Engine
* Retry Engine
* Metrics Engine
* Plugin Manager
* Subscription Engine

---

# Overview

The Event Bus acts as the central communication layer.

```text
Request Engine ─┐
Cache Engine ───┤
Storage Engine ─┤
Offline Engine ─┤
Queue Engine ───┤
Sync Engine ────┤
Retry Engine ───┤
Plugin Manager ─┤
                ▼
            Event Bus
                ▲
                │
Applications ───┘
```

Instead of components calling each other directly, they publish and subscribe to events.

---

# Why an Event Bus Exists

Without an event bus:

```text
Engine A
   │
   ▼
Engine B
   │
   ▼
Engine C
```

This creates tight coupling.

With an event bus:

```text
Engine A
   │
   ▼
Event Bus
   ▲
   │
Engine B

Engine C
```

Components remain independent.

---

# Design Goals

The Event Bus is designed to provide:

* Loose coupling
* Type safety
* Predictable event flow
* Extensibility
* Observability
* Plugin integration
* Event history

---

# Core Concepts

The Event Bus is built around three concepts:

```text
Emit
Listen
Unsubscribe
```

---

# Emitting Events

Components publish events.

```typescript
await client.events.emit(
  'request:start',
  {
    url: '/api/users',
    method: 'GET'
  }
);
```

Flow:

```text
Engine
  │
  ▼
Emit Event
  │
  ▼
Event Bus
```

---

# Listening to Events

Applications can listen for events.

```typescript
client.events.on(
  'request:start',
  payload => {
    console.log(payload);
  }
);
```

Flow:

```text
Event Bus
    │
    ▼
Listener
```

---

# Removing Listeners

Listeners can be removed.

```typescript
const unsubscribe =
  client.events.on(
    'request:start',
    callback
  );

unsubscribe();
```

This prevents memory leaks and unwanted subscriptions.

---

# Event Lifecycle

```text
Emit
 │
 ▼
Dispatch
 │
 ▼
Listeners
 │
 ▼
Complete
```

---

# Event Structure

All events follow a consistent structure.

```typescript
interface EventPayload {
  timestamp: number;

  source: string;

  data: unknown;
}
```

Example:

```typescript
{
  timestamp: 1700000000,
  source: 'request-engine',
  data: {
    url: '/api/users'
  }
}
```

---

# Type Safety

Lagless events are strongly typed.

Example:

```typescript
interface EventMap {
  'request:start': {
    url: string;
    method: string;
  };

  'request:end': {
    url: string;
    duration: number;
  };
}
```

Usage:

```typescript
client.events.on(
  'request:end',
  payload => {
    payload.duration;
  }
);
```

TypeScript validates payload access automatically.

---

# Built-In Events

Lagless emits events from every subsystem.

---

# Request Events

Examples:

```text
request:start
request:end
request:error
request:retry
request:abort
```

Example:

```typescript
client.events.on(
  'request:error',
  payload => {
    console.log(payload.error);
  }
);
```

---

# Cache Events

Examples:

```text
cache:set
cache:get
cache:delete
cache:invalidate
cache:miss
cache:hit
```

Example:

```typescript
client.events.on(
  'cache:hit',
  payload => {
    console.log(payload.key);
  }
);
```

---

# Storage Events

Examples:

```text
storage:set
storage:get
storage:delete
storage:clear
storage:migration
```

---

# Offline Events

Examples:

```text
offline:detected
online:detected
offline:reconnected
offline:queued
```

---

# Queue Events

Examples:

```text
queue:add
queue:process
queue:success
queue:failure
queue:retry
queue:cancel
```

---

# Sync Events

Examples:

```text
sync:start
sync:end
sync:success
sync:error
sync:conflict
```

---

# Plugin Events

Examples:

```text
plugin:registered
plugin:loaded
plugin:removed
```

---

# Metrics Events

Examples:

```text
metrics:recorded
metrics:exported
```

---

# Custom Events

Applications may emit custom events.

```typescript
await client.events.emit(
  'user:login',
  {
    id: 1
  }
);
```

Listen:

```typescript
client.events.on(
  'user:login',
  payload => {
    console.log(payload.id);
  }
);
```

---

# Namespacing

Event names are namespaced.

Examples:

```text
request:start
cache:set
sync:success
queue:retry
```

Benefits:

* Avoid collisions
* Improve readability
* Simplify filtering

---

# Event Propagation

Event delivery follows a predictable sequence.

```text
Emit
 │
 ▼
Queue Event
 │
 ▼
Dispatch
 │
 ▼
Listeners
```

Every listener receives the same payload.

---

# Multiple Listeners

Many listeners may subscribe to a single event.

```text
Event
  │
 ┌┼──────┬─────┐
 ▼▼      ▼     ▼
A        B     C
```

All listeners are executed independently.

---

# Once Listeners

Listeners may automatically remove themselves.

```typescript
client.events.once(
  'sync:success',
  payload => {
    console.log(payload);
  }
);
```

After execution:

```text
Listener Removed
```

---

# Wildcard Listening

Applications may listen to groups of events.

Example:

```typescript
client.events.onPattern(
  /^cache:/,
  payload => {
    console.log(payload);
  }
);
```

Receives:

```text
cache:set
cache:get
cache:delete
cache:invalidate
```

---

# Event Filtering

Listeners may filter events.

Example:

```typescript
client.events.on(
  'request:end',
  payload => {
    if (
      payload.duration > 500
    ) {
      console.warn(
        'Slow request'
      );
    }
  }
);
```

---

# Event History

The Event Bus may maintain historical events.

Example:

```typescript
const history =
  client.events.getHistory(
    'request:end'
  );
```

Returns:

```typescript
[
  {
    timestamp: 1700000000
  }
]
```

Useful for:

* Debugging
* Monitoring
* Testing

---

# History Limits

History retention may be configured.

```typescript
events: {
  historyLimit: 1000
}
```

Flow:

```text
Event
  │
  ▼
Store History
  │
  ▼
Evict Oldest
```

when limits are exceeded.

---

# Event Replay

Historical events may be replayed.

```typescript
await client.events.replay(
  'cache:set'
);
```

Useful for:

* Debugging
* Plugin initialization
* Diagnostics

---

# Error Isolation

Listener failures do not affect other listeners.

Example:

```text
Listener A Throws
        │
        ▼
Listener B Continues
```

This prevents cascading failures.

---

# Asynchronous Events

Listeners may be asynchronous.

```typescript
client.events.on(
  'sync:success',
  async payload => {
    await analytics.track(
      payload
    );
  }
);
```

The Event Bus coordinates execution safely.

---

# Event Ordering

Events are delivered in emission order.

```text
Event 1
  │
  ▼
Event 2
  │
  ▼
Event 3
```

This guarantees predictable behavior.

---

# Plugin Integration

Plugins frequently rely on events.

Example:

```typescript
client.events.on(
  'request:end',
  payload => {
    sendMetric(payload);
  }
);
```

Most plugin functionality is event-driven.

---

# Metrics Integration

The Event Bus emits metrics-related events and records event activity.

Examples:

* Event count
* Listener count
* Dispatch duration
* Failed listeners

---

# Monitoring

Applications may inspect event activity.

Example:

```typescript
const stats =
  client.events.getStats();
```

Possible metrics:

```typescript
{
  listeners: 45,
  emitted: 10000
}
```

---

# Event Flow Example

Request lifecycle:

```text
request:start
      │
      ▼
request:end
      │
      ▼
cache:set
      │
      ▼
sync:success
```

Each subsystem reacts independently.

---

# Error Handling

Possible errors include:

```typescript
EventError
ListenerError
HistoryError
```

Example:

```typescript
try {
  await client.events.emit(
    'custom:event',
    {}
  );
} catch (error) {
  console.error(error);
}
```

---

# Testing Events

Example:

```typescript
const callback =
  vi.fn();

client.events.on(
  'cache:set',
  callback
);

await client.cache.set(
  'user',
  {}
);

expect(
  callback
).toHaveBeenCalled();
```

---

# Best Practices

## Namespace Events

Prefer:

```text
cache:set
```

instead of:

```text
set
```

---

## Remove Unused Listeners

Always unsubscribe.

```typescript
const unsubscribe =
  client.events.on(
    'sync:end',
    callback
  );

unsubscribe();
```

---

## Avoid Heavy Handlers

Long-running handlers may affect responsiveness.

Move expensive work to background tasks where possible.

---

## Monitor Event Volume

High event volume may indicate:

* Excessive retries
* Infinite loops
* Misconfigured plugins

Review metrics regularly.

---

## Use Event History Carefully

Large histories consume memory.

Configure retention limits appropriately.

---

# Summary

The Event Bus is the communication backbone of Lagless Core.

It provides:

* Type-safe events
* Event emission
* Event subscriptions
* Event history
* Event replay
* Pattern matching
* Error isolation
* Plugin integration
* Metrics integration

allowing every subsystem in Lagless to communicate through a loosely coupled, observable, and extensible event-driven architecture.
