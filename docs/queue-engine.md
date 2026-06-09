# Queue Engine

The Queue Engine is responsible for managing deferred operations within Lagless Core.

It provides reliable execution of operations that cannot be completed immediately due to connectivity issues, temporary failures, rate limits, synchronization requirements, or application-defined scheduling rules.

The Queue Engine is a critical component of Lagless' offline-first architecture and works closely with:

* Offline Engine
* Request Engine
* Retry Engine
* Sync Engine
* Storage Engine
* Event Bus
* Metrics Engine

---

# Overview

The Queue Engine acts as a persistent operation scheduler.

```text
Application
      │
      ▼
 Queue Engine
      │
 ┌────┴────┐
 │         │
Execute   Store
 Now      Later
```

Its purpose is to:

* Persist deferred operations
* Retry failed operations
* Support offline workflows
* Guarantee eventual execution
* Enable recovery after restarts
* Coordinate with synchronization workflows

---

# Responsibilities

The Queue Engine manages:

* Operation creation
* Queue persistence
* Queue processing
* Retry coordination
* Operation cancellation
* Queue prioritization
* Queue recovery
* Queue metrics

---

# Why Queues Exist

Without a queue:

```text
User Action
     │
     ▼
Network Failure
     │
     ▼
Lost Operation
```

With a queue:

```text
User Action
     │
     ▼
Network Failure
     │
     ▼
Queue Operation
     │
     ▼
Retry Later
     │
     ▼
Success
```

The queue ensures important operations are not lost.

---

# Queue Lifecycle

```text
Created
   │
   ▼
Queued
   │
   ▼
Persisted
   │
   ▼
Processing
   │
 ┌─┴─┐
 │   │
Success Failure
 │        │
 ▼        ▼
Done    Retry
```

---

# Queue Entry Structure

Every queued operation is represented by an entry.

```typescript
interface QueueEntry {
  id: string;

  url: string;

  method: HTTPMethod;

  headers?: Record<string, string>;

  body?: unknown;

  createdAt: number;

  updatedAt: number;

  attempts: number;

  maxAttempts: number;

  priority: number;

  metadata?: Record<string, unknown>;
}
```

---

# Creating Queue Entries

Operations may be queued manually.

```typescript
const operationId =
  await client.queue.add({
    url: '/api/posts',
    method: 'POST',
    body: {
      title: 'Hello'
    }
  });
```

Returns:

```typescript
"queue_abc123"
```

The identifier can be used for later inspection or cancellation.

---

# Automatic Queueing

The Offline Engine may automatically queue operations.

Example:

```text
POST Request
     │
     ▼
Offline
     │
     ▼
Queue Operation
```

This behavior allows applications to continue functioning while disconnected.

---

# Persistence

Queue entries may be persisted through the Storage Engine.

```text
Queue Engine
      │
      ▼
Storage Engine
      │
      ▼
IndexedDB
```

Benefits:

* Survive page refreshes
* Survive application restarts
* Recover after crashes

---

# Queue Recovery

On startup:

```text
Application Start
        │
        ▼
Load Queue
        │
        ▼
Restore Entries
        │
        ▼
Resume Processing
```

Applications continue where they previously stopped.

---

# Processing the Queue

Process pending operations.

```typescript
await client.queue.processQueue();
```

Execution flow:

```text
Pending Entry
      │
      ▼
Execute Request
      │
 ┌────┴────┐
 │         │
Success Failure
 │         │
 ▼         ▼
Remove    Retry
```

---

# Automatic Processing

Queue processing may occur automatically.

Triggers include:

* Connectivity restored
* Application focused
* Synchronization started
* Scheduled intervals

Example:

```text
Online
   │
   ▼
Process Queue
```

---

# Queue Inspection

Retrieve pending operations.

```typescript
const operations =
  await client.queue.getPendingOperations();
```

Returns:

```typescript
[
  {
    id: 'queue_1',
    url: '/api/posts'
  }
]
```

---

# Pending Count

Retrieve queue size.

```typescript
const count =
  await client.queue.getPendingCount();
```

Useful for:

* UI indicators
* Monitoring
* Diagnostics

---

# Queue Priorities

Operations may have priorities.

```typescript
await client.queue.add({
  url: '/api/posts',
  priority: 10
});
```

Higher priorities are processed first.

Example:

```text
Priority 10
Priority 5
Priority 1
```

Processing order:

```text
10
 │
 ▼
5
 │
 ▼
1
```

---

# Retry Attempts

Every entry tracks execution attempts.

```typescript
{
  attempts: 2,
  maxAttempts: 5
}
```

Flow:

```text
Attempt 1
    │
    ▼
Failure
    │
    ▼
Attempt 2
```

Retries continue until success or limit reached.

---

# Maximum Attempts

Configure retry limits.

```typescript
await client.queue.add({
  url: '/api/posts',
  maxAttempts: 5
});
```

After reaching the limit:

```text
Attempt Limit Reached
         │
         ▼
Mark Failed
```

---

# Failed Operations

Failed entries remain available for inspection.

```typescript
const failed =
  await client.queue.getFailedOperations();
```

Example result:

```typescript
[
  {
    id: 'queue_1',
    attempts: 5
  }
]
```

---

# Retrying Failed Entries

Retry all failed operations.

```typescript
await client.queue.retryFailed();
```

Retry specific operations.

```typescript
await client.queue.retryFailed([
  'queue_1',
  'queue_2'
]);
```

---

# Cancelling Operations

Remove queued entries.

```typescript
await client.queue.cancelOperation(
  operationId
);
```

Flow:

```text
Queued
   │
   ▼
Cancelled
   │
   ▼
Removed
```

---

# Queue Scheduling

The Queue Engine may schedule execution.

Possible scheduling modes:

```text
Immediate
Delayed
Reconnect
Manual
```

Example:

```typescript
await client.queue.add({
  url: '/api/posts',
  delay: 5000
});
```

Execution begins after five seconds.

---

# Queue Ordering

Default ordering:

```text
Priority
   │
   ▼
Creation Time
```

This ensures predictable execution behavior.

---

# Queue Backpressure

Large queues may affect performance.

Example:

```text
10,000 Pending Operations
```

Mitigation strategies:

* Maximum queue size
* Priorities
* Rate limiting
* Batch processing

---

# Maximum Queue Size

Configure limits.

```typescript
offline: {
  maxQueueSize: 1000
}
```

When exceeded:

```text
Queue Full
```

Possible responses:

* Reject new entries
* Evict oldest entries
* Evict lowest priority entries

Configuration determines behavior.

---

# Batch Processing

Multiple entries may be processed together.

```text
Queue
 ├─ Entry 1
 ├─ Entry 2
 ├─ Entry 3
 └─ Entry 4
```

Processing:

```text
Batch
  │
  ▼
Single Processing Cycle
```

Benefits:

* Lower overhead
* Better throughput
* Reduced network churn

---

# Offline Integration

The Queue Engine is heavily integrated with offline workflows.

Example:

```text
Offline
   │
   ▼
Create Entry
   │
   ▼
Persist Queue
   │
   ▼
Reconnect
   │
   ▼
Process Queue
```

This is one of the core mechanisms behind Lagless' offline-first capabilities.

---

# Retry Engine Integration

The Queue Engine delegates retry scheduling.

```text
Queue Failure
      │
      ▼
Retry Engine
      │
      ▼
Backoff Delay
      │
      ▼
Retry Queue Entry
```

This prevents aggressive retry behavior.

---

# Sync Engine Integration

Queue processing often occurs before synchronization.

```text
Reconnect
   │
   ▼
Process Queue
   │
   ▼
Sync Engine
   │
   ▼
Refresh Data
```

This ensures server state is updated before synchronization begins.

---

# Storage Integration

Queue persistence relies on the Storage Engine.

```text
Queue Entry
     │
     ▼
Serialize
     │
     ▼
Store
```

Recovery:

```text
Load
 │
 ▼
Deserialize
 │
 ▼
Restore Queue
```

---

# Events

The Queue Engine emits lifecycle events.

Examples:

```text
queue:add
queue:remove
queue:process
queue:success
queue:failure
queue:retry
queue:cancel
```

Example:

```typescript
client.events.on(
  'queue:success',
  payload => {
    console.log(payload.id);
  }
);
```

---

# Event Flow

```text
queue:add
    │
    ▼
queue:process
    │
 ┌──┴──┐
 │     │
 ▼     ▼
Success Failure
 │         │
 ▼         ▼
queue:success
queue:retry
```

---

# Metrics

The Queue Engine records:

* Queue depth
* Retry count
* Failed operations
* Successful operations
* Average processing time
* Recovery count

Example:

```typescript
const metrics =
  client.getMetricsSnapshot();
```

---

# Error Handling

Possible errors include:

```typescript
QueueError
StorageError
OfflineError
RetryError
```

Example:

```typescript
try {
  await client.queue.add({
    url: '/api/posts'
  });
} catch (error) {
  if (
    error instanceof QueueError
  ) {
    console.error(error);
  }
}
```

---

# Testing Queue Behavior

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

Reconnect:

```typescript
client.offline.setOnline(
  true
);

await client.queue.processQueue();
```

Verify:

```typescript
expect(
  await client.queue.getPendingCount()
).toBe(0);
```

---

# Best Practices

## Enable Persistence

Persist queues whenever offline support is important.

```typescript
offline: {
  queuePersistence: true
}
```

---

## Set Retry Limits

Avoid infinite retries.

```typescript
maxAttempts: 5
```

---

## Use Priorities

Critical operations should receive higher priority.

```typescript
priority: 10
```

---

## Monitor Queue Growth

Large queues may indicate:

* Connectivity problems
* Server issues
* Excessive retries

Review queue metrics regularly.

---

## Test Recovery

Always verify:

* Queue restoration
* Crash recovery
* Reconnection handling
* Retry behavior

Offline-first systems depend heavily on reliable queue recovery.

---

# Summary

The Queue Engine is the deferred execution backbone of Lagless Core.

It provides:

* Persistent operation queues
* Offline mutation support
* Retry coordination
* Queue prioritization
* Recovery after restart
* Automatic processing
* Event generation
* Queue metrics

ensuring operations are executed reliably even when connectivity is unavailable or temporary failures occur.
