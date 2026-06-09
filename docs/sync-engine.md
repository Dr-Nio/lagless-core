# Sync Engine

The Sync Engine is responsible for keeping application data synchronized across network, cache, storage, and offline operations.

It coordinates refresh workflows, reconciliation processes, cache updates, queue draining, and eventual consistency throughout Lagless Core.

The Sync Engine is one of the most important subsystems in Lagless because it transforms cached and offline data into a continuously updated application state.

The Sync Engine works closely with:

* Request Engine
* Cache Engine
* Offline Engine
* Queue Engine
* Storage Engine
* Event Bus
* Metrics Engine
* Subscription Engine

---

# Overview

The Sync Engine acts as the consistency coordinator for the entire runtime.

```text id="d6h0zr"
Application
      │
      ▼
 Sync Engine
      │
 ┌────┼────┬────────┐
 │    │    │        │
 ▼    ▼    ▼        ▼
Cache Queue Storage Network
```

Its purpose is to:

* Keep data current
* Refresh stale information
* Process queued operations
* Resolve conflicts
* Coordinate synchronization triggers
* Maintain eventual consistency

---

# Responsibilities

The Sync Engine manages:

* Synchronization execution
* Synchronization scheduling
* Reconnect synchronization
* Visibility synchronization
* Focus synchronization
* Scheduled synchronization
* Cache refreshes
* Conflict resolution
* Checkpoint management
* Sync metrics

---

# What Is Synchronization?

Synchronization is the process of reconciling local state with remote state.

```text id="e2hfxm"
Local Data
     │
     ▼
Synchronize
     │
     ▼
Remote Data
```

The goal is to ensure both sides eventually agree.

---

# Eventual Consistency

Lagless is designed around eventual consistency.

```text id="e5wtzc"
Client State
      │
      ▼
Temporary Difference
      │
      ▼
Synchronization
      │
      ▼
Consistent State
```

Consistency may not be immediate.

Consistency is guaranteed through synchronization workflows.

---

# Synchronization Lifecycle

```text id="dy3j1w"
Trigger
   │
   ▼
Prepare
   │
   ▼
Drain Queue
   │
   ▼
Fetch Updates
   │
   ▼
Resolve Conflicts
   │
   ▼
Update Cache
   │
   ▼
Persist State
   │
   ▼
Notify Subscribers
```

---

# Configuration

Synchronization can be enabled globally.

```typescript id="zwm90s"
const client = createLagless({
  sync: {
    enabled: true
  }
});
```

---

# Synchronization Triggers

Lagless supports multiple synchronization triggers.

Examples:

```text id="m0hghg"
Reconnect
Visibility
Focus
Scheduled
Manual
```

Multiple triggers may be active simultaneously.

---

# Reconnect Synchronization

Reconnect synchronization occurs when connectivity returns.

```text id="4ygq3k"
Offline
   │
   ▼
Online
   │
   ▼
Synchronize
```

Configuration:

```typescript id="o0fsvl"
sync: {
  strategies: [
    'reconnect'
  ]
}
```

---

# Reconnect Flow

```text id="yspozx"
Connection Restored
         │
         ▼
Process Queue
         │
         ▼
Refresh Data
         │
         ▼
Update Cache
```

This is one of the most common synchronization workflows.

---

# Visibility Synchronization

Occurs when an application becomes visible.

```text id="yuh2zv"
Hidden
   │
   ▼
Visible
   │
   ▼
Synchronize
```

Configuration:

```typescript id="s48evg"
sync: {
  strategies: [
    'visibility'
  ]
}
```

Useful for browser applications that spend long periods in background tabs.

---

# Focus Synchronization

Occurs when application focus returns.

```text id="vkqv9y"
Blurred
   │
   ▼
Focused
   │
   ▼
Synchronize
```

Configuration:

```typescript id="yg67r5"
sync: {
  strategies: [
    'focus'
  ]
}
```

Useful after switching between applications.

---

# Scheduled Synchronization

Runs at configured intervals.

```typescript id="i1daxv"
sync: {
  interval: 60000
}
```

Equivalent to:

```text id="s5ijq0"
Every 60 Seconds
```

Flow:

```text id="5s1c6j"
Timer
  │
  ▼
Synchronize
```

---

# Manual Synchronization

Applications may trigger synchronization manually.

```typescript id="mhv5bm"
await client.sync.run();
```

Flow:

```text id="xg8s3f"
Application
      │
      ▼
Manual Sync
```

Useful after important user actions.

---

# Synchronization Pipeline

Every synchronization follows a standard pipeline.

```text id="06m7ta"
Start
 │
 ▼
Check Connectivity
 │
 ▼
Drain Queue
 │
 ▼
Fetch Updates
 │
 ▼
Resolve Conflicts
 │
 ▼
Update Cache
 │
 ▼
Persist Checkpoint
 │
 ▼
Notify Subscribers
 │
 ▼
Complete
```

---

# Queue Draining

Synchronization usually begins by processing pending operations.

```text id="5m9n3x"
Queue
  │
  ▼
Execute Operations
  │
  ▼
Server Updated
```

This ensures local changes reach the server before data refreshes occur.

---

# Refreshing Cached Data

After queue processing:

```text id="r7udsy"
Fetch Latest Data
         │
         ▼
Refresh Cache
         │
         ▼
Notify Subscribers
```

This keeps local state current.

---

# Cache Refresh Example

```typescript id="55j2cz"
await client.sync.run();
```

Result:

```text id="zj9q4y"
Network Refresh
       │
       ▼
Cache Updated
       │
       ▼
Subscribers Notified
```

---

# Checkpoints

Checkpoints track synchronization progress.

Example:

```typescript id="jvw5zy"
{
  lastSyncAt: 1700000000
}
```

Stored through the Storage Engine.

---

# Why Checkpoints Matter

Without checkpoints:

```text id="8n7p72"
Full Sync
Every Time
```

With checkpoints:

```text id="1d0evg"
Last Sync Timestamp
         │
         ▼
Incremental Sync
```

This reduces synchronization cost.

---

# Incremental Synchronization

Instead of downloading everything:

```text id="ej7p3n"
Only Changes
Since Last Sync
```

Example:

```typescript id="o0y4r5"
{
  since: lastSyncAt
}
```

Benefits:

* Smaller payloads
* Faster syncs
* Lower bandwidth usage

---

# Conflict Resolution

Conflicts occur when local and remote data diverge.

Example:

```text id="hdd3l7"
Client Edit
     │
     ▼
Offline
     │
     ▼
Server Edit
     │
     ▼
Reconnect
```

Result:

```text id="zv4mdt"
Conflict
```

---

# Conflict Resolution Strategies

Common strategies include:

---

## Server Wins

```text id="42s8ji"
Remote Version
Overrides Local
```

---

## Client Wins

```text id="g4x5s7"
Local Version
Overrides Remote
```

---

## Latest Timestamp Wins

```text id="h5gb7s"
Newest Update
Wins
```

---

## Custom Resolver

```typescript id="i6w0zv"
sync: {
  conflictResolver:
    async conflict => {
      return resolve(conflict);
    }
}
```

Recommended for business-critical systems.

---

# Synchronization State

Applications may inspect synchronization status.

Example:

```typescript id="2l9ztv"
const state =
  client.sync.getState();
```

Possible states:

```text id="7j2l5u"
idle
running
completed
failed
```

---

# Cancellation

Synchronization may be cancelled.

```typescript id="b7svq3"
await client.sync.cancel();
```

Flow:

```text id="5w8j8x"
Running
   │
   ▼
Cancelled
```

Useful during application shutdown.

---

# Persistence Integration

Synchronization metadata is persisted.

Examples:

* Checkpoints
* Last sync time
* Conflict records
* Sync status

Flow:

```text id="b0ph0v"
Sync Engine
     │
     ▼
Storage Engine
```

---

# Subscription Integration

Subscribers receive updates after synchronization.

```text id="40w35k"
Sync Complete
      │
      ▼
Cache Updated
      │
      ▼
Notify Subscribers
```

Example:

```typescript id="f6z7mk"
client.subscriptions.subscribe(
  'user:1',
  callback
);
```

---

# Event Integration

The Sync Engine emits lifecycle events.

Examples:

```text id="fxzg4x"
sync:start
sync:end
sync:success
sync:error
sync:conflict
sync:cancel
```

Example:

```typescript id="ybhqnm"
client.events.on(
  'sync:start',
  payload => {
    console.log(payload);
  }
);
```

---

# Event Flow

```text id="92k0kp"
sync:start
     │
     ▼
Queue Drain
     │
     ▼
Cache Refresh
     │
     ▼
sync:success
     │
     ▼
sync:end
```

---

# Metrics

The Sync Engine records:

* Sync count
* Sync duration
* Queue drain count
* Conflict count
* Incremental sync count
* Failed sync count

Example:

```typescript id="7a8j7s"
const metrics =
  client.getMetricsSnapshot();
```

---

# Error Handling

Possible synchronization errors include:

```typescript id="c4n5dt"
SyncError
ConflictError
OfflineError
StorageError
```

Example:

```typescript id="z8xw6h"
try {
  await client.sync.run();
} catch (error) {
  if (
    error instanceof SyncError
  ) {
    console.error(error);
  }
}
```

---

# Testing Synchronization

Example:

```typescript id="8m5nlt"
await client.sync.run();

const state =
  client.sync.getState();

expect(
  state.status
).toBe('completed');
```

Test reconnect workflows:

```typescript id="c0l0gr"
client.offline.setOnline(
  false
);

client.offline.setOnline(
  true
);
```

Verify synchronization occurs automatically.

---

# Best Practices

## Enable Multiple Triggers

Recommended:

```typescript id="wtxsl1"
sync: {
  strategies: [
    'reconnect',
    'visibility',
    'focus'
  ]
}
```

---

## Use Incremental Syncs

Prefer checkpoints over full refreshes.

Benefits:

* Faster execution
* Reduced bandwidth
* Lower server load

---

## Process Queues First

Always synchronize local changes before refreshing data.

```text id="2frc5s"
Queue
  │
  ▼
Server
  │
  ▼
Refresh
```

---

## Implement Conflict Resolution

Business-critical applications should define explicit conflict handling.

Avoid relying on defaults for sensitive data.

---

## Monitor Sync Metrics

Review:

* Failures
* Duration
* Conflict frequency

to identify reliability issues.

---

# Summary

The Sync Engine is the consistency orchestration layer of Lagless Core.

It provides:

* Reconnect synchronization
* Visibility synchronization
* Focus synchronization
* Scheduled synchronization
* Queue draining
* Cache refreshes
* Conflict resolution
* Checkpoint management
* Event generation
* Synchronization metrics

ensuring applications remain accurate, current, and eventually consistent across online and offline environments.
