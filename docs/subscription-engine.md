# Subscription Engine

The Subscription Engine is the reactive data layer of Lagless Core.

It enables applications to observe changes to cached data, synchronized resources, storage entries, and application state without manually polling for updates.

The Subscription Engine bridges Lagless internals with user interfaces, allowing frameworks and applications to react automatically when data changes.

It works closely with:

* Cache Engine
* Sync Engine
* Event Bus
* Storage Engine
* Request Engine
* Offline Engine

and serves as the primary reactive interface exposed to application developers.

---

# Overview

The Subscription Engine provides observable access to data changes.

```text
Application UI
      │
      ▼
Subscription Engine
      │
      ▼
Cache Engine
      │
      ▼
Data Changes
```

Whenever data changes, subscribers are automatically notified.

---

# Why Subscriptions Exist

Without subscriptions:

```text
Data Changes
      │
      ▼
Manual Refresh
      │
      ▼
UI Update
```

Applications must constantly check for updates.

With subscriptions:

```text
Data Changes
      │
      ▼
Subscription Engine
      │
      ▼
Automatic Update
```

The UI stays synchronized automatically.

---

# Responsibilities

The Subscription Engine manages:

* Data subscriptions
* Reactive updates
* Namespace subscriptions
* Pattern subscriptions
* One-time subscriptions
* Subscription lifecycle management
* Change notifications
* Subscription metrics

---

# Core Concept

A subscription is a relationship between:

```text
Subscriber
      │
      ▼
Observed Data
      │
      ▼
Notifications
```

Whenever observed data changes, subscribers receive updates.

---

# Subscription Lifecycle

```text
Subscribe
    │
    ▼
Wait
    │
    ▼
Data Changes
    │
    ▼
Notify
    │
    ▼
Unsubscribe
```

---

# Creating a Subscription

Observe a specific key.

```typescript
const unsubscribe =
  client.subscriptions.subscribe(
    'user:1',
    (data, oldData) => {
      console.log(data);
    }
  );
```

Flow:

```text
Subscribe
    │
    ▼
Watch user:1
```

---

# Receiving Updates

When data changes:

```text
Cache Updated
      │
      ▼
Subscription Engine
      │
      ▼
Subscriber
```

Callback execution:

```typescript
(data, oldData) => {
  console.log(data);
}
```

---

# Unsubscribing

Subscriptions should be removed when no longer needed.

```typescript
unsubscribe();
```

Flow:

```text
Active
  │
  ▼
Unsubscribe
  │
  ▼
Removed
```

---

# Key-Based Subscriptions

The most common subscription type.

```typescript
client.subscriptions.subscribe(
  'user:123',
  callback
);
```

Only changes affecting:

```text
user:123
```

trigger updates.

---

# Namespace Subscriptions

Observe groups of related keys.

Example:

```typescript
client.subscriptions.subscribeToNamespace(
  'user',
  callback
);
```

Matches:

```text
user:1
user:2
user:3
user:999
```

Flow:

```text
user:*
```

Useful for collections of related records.

---

# Pattern Subscriptions

Observe keys matching a pattern.

Example:

```typescript
client.subscriptions.subscribeToPattern(
  /^post:\d+$/,
  callback
);
```

Matches:

```text
post:1
post:2
post:3
```

Does not match:

```text
user:1
```

Pattern subscriptions provide flexible filtering.

---

# Once Subscriptions

Automatically unsubscribe after first notification.

```typescript
client.subscriptions.subscribe(
  'sync:complete',
  callback,
  {
    once: true
  }
);
```

Flow:

```text
Notify
  │
  ▼
Remove Subscription
```

---

# Immediate Subscriptions

Immediately receive current value.

```typescript
client.subscriptions.subscribe(
  'user:1',
  callback,
  {
    immediate: true
  }
);
```

Flow:

```text
Subscribe
    │
    ▼
Current Value
    │
    ▼
Callback
```

Useful during component initialization.

---

# Change Detection

Subscribers are notified only when values change.

Example:

```text
Value A
   │
   ▼
Value B
```

Notification occurs.

However:

```text
Value A
   │
   ▼
Value A
```

may not trigger updates depending on configuration.

---

# Subscription Sources

Updates may originate from multiple sources.

Examples:

```text
Cache Updates
Network Requests
Sync Operations
Storage Changes
Queue Processing
```

All are routed through the Subscription Engine.

---

# Cache Integration

The Cache Engine is the primary source of subscription updates.

Flow:

```text
Cache Set
    │
    ▼
Subscription Engine
    │
    ▼
Notify Subscribers
```

Example:

```typescript
await client.cache.set(
  'user:1',
  user
);
```

Subscribers automatically receive updates.

---

# Request Integration

Requests may update subscriptions.

```text
Network Request
       │
       ▼
Cache Update
       │
       ▼
Subscriber Notification
```

Applications remain synchronized with network responses.

---

# Sync Integration

Synchronization frequently triggers updates.

```text
Sync Complete
      │
      ▼
Cache Refresh
      │
      ▼
Subscriptions Updated
```

This keeps interfaces current.

---

# Offline Integration

Subscriptions continue functioning while offline.

```text
Offline
   │
   ▼
Local Cache Changes
   │
   ▼
Notifications
```

Reactive behavior is preserved even without connectivity.

---

# Storage Integration

Persistent data changes may trigger notifications.

```text
Storage Update
      │
      ▼
Subscription Engine
```

Useful for long-lived application state.

---

# Subscription Context

Callbacks may receive contextual information.

Example:

```typescript
{
  key: 'user:1',
  value: user,
  oldValue: previousUser,
  timestamp: Date.now()
}
```

This allows advanced processing.

---

# Notification Ordering

Updates are delivered in deterministic order.

```text
Update 1
   │
   ▼
Update 2
   │
   ▼
Update 3
```

This ensures predictable reactive behavior.

---

# Batched Notifications

Multiple updates may be grouped.

Without batching:

```text
Update
Update
Update
Update
```

With batching:

```text
Batch
  │
  ▼
Single Notification Cycle
```

Benefits:

* Reduced rendering
* Improved performance
* Lower callback overhead

---

# Subscription State

Applications may inspect active subscriptions.

```typescript
const stats =
  client.subscriptions.getStats();
```

Example:

```typescript
{
  active: 50,
  namespaces: 5,
  patterns: 3
}
```

---

# Subscription Registry

Internally the engine maintains:

```text
Key Registry
Namespace Registry
Pattern Registry
```

This enables efficient lookup and notification.

---

# Event Integration

The Subscription Engine emits lifecycle events.

Examples:

```text
subscription:add
subscription:remove
subscription:update
subscription:notify
```

Example:

```typescript
client.events.on(
  'subscription:update',
  payload => {
    console.log(payload);
  }
);
```

---

# Event Flow

```text
Data Change
     │
     ▼
subscription:update
     │
     ▼
Notify Subscribers
```

---

# Reactive Framework Integration

The Subscription Engine is framework-agnostic.

Supported patterns include:

```text
React
Vue
Svelte
Solid
Angular
Vanilla TypeScript
```

Framework adapters can build on top of the Subscription Engine.

---

# React Example

```typescript
useEffect(() => {
  const unsubscribe =
    client.subscriptions.subscribe(
      'user:1',
      setUser
    );

  return unsubscribe;
}, []);
```

Whenever the user changes:

```text
Cache Update
      │
      ▼
React Re-render
```

---

# Vue Example

```typescript
onMounted(() => {
  unsubscribe =
    client.subscriptions.subscribe(
      'user:1',
      value => {
        user.value = value;
      }
    );
});
```

---

# Svelte Example

```typescript
const unsubscribe =
  client.subscriptions.subscribe(
    'user:1',
    value => {
      user = value;
    }
  );
```

---

# Metrics

The Subscription Engine records:

* Active subscriptions
* Notification count
* Namespace count
* Pattern count
* Callback execution time
* Unsubscribe count

Example:

```typescript
const metrics =
  client.getMetricsSnapshot();
```

---

# Memory Management

Unused subscriptions consume resources.

Potential issues:

```text
Memory Growth
Duplicate Notifications
Leaked Components
```

Applications should always unsubscribe.

---

# Error Isolation

Subscriber failures do not affect other subscribers.

Example:

```text
Subscriber A Throws
         │
         ▼
Subscriber B Continues
```

This prevents cascading failures.

---

# Error Handling

Possible errors include:

```typescript
SubscriptionError
NotificationError
PatternError
```

Example:

```typescript
try {
  client.subscriptions.subscribe(
    'user:1',
    callback
  );
} catch (error) {
  console.error(error);
}
```

---

# Testing Subscriptions

Example:

```typescript
const callback =
  vi.fn();

client.subscriptions.subscribe(
  'user:1',
  callback
);

await client.cache.set(
  'user:1',
  {
    id: 1
  }
);

expect(
  callback
).toHaveBeenCalled();
```

---

# Best Practices

## Always Unsubscribe

```typescript
const unsubscribe =
  client.subscriptions.subscribe(
    'user:1',
    callback
  );

unsubscribe();
```

Prevents memory leaks.

---

## Prefer Key Subscriptions

Use:

```text
user:123
```

instead of broad patterns whenever possible.

More targeted subscriptions are more efficient.

---

## Use Namespaces for Collections

Prefer:

```text
user:*
```

when observing many related entities.

---

## Batch Frequent Updates

High-frequency updates should be batched to avoid excessive rendering.

---

## Monitor Subscription Metrics

Watch for:

* Unexpected growth
* Excessive notifications
* Long callback execution times

These may indicate performance issues.

---

# Summary

The Subscription Engine is the reactive data layer of Lagless Core.

It provides:

* Key subscriptions
* Namespace subscriptions
* Pattern subscriptions
* Reactive notifications
* Framework integration
* Batched updates
* Subscription lifecycle management
* Error isolation
* Metrics and monitoring

allowing applications to automatically react to data changes while remaining framework-agnostic and highly performant.
