# Retry Engine

The Retry Engine is the reliability layer of Lagless Core.

It is responsible for automatically retrying operations that fail due to transient conditions such as network interruptions, temporary server errors, rate limits, connectivity changes, and synchronization failures.

The Retry Engine improves resilience by increasing the likelihood that operations eventually succeed without requiring manual intervention from application developers.

It works closely with:

* Request Engine
* Queue Engine
* Sync Engine
* Offline Engine
* Event Bus
* Metrics Engine

and serves as the centralized retry coordinator for the entire runtime.

---

# Overview

The Retry Engine determines whether a failed operation should be attempted again.

```text id="c3g41r"
Operation
    │
    ▼
Failure
    │
    ▼
Retry Engine
    │
 ┌──┴──┐
 │     │
Retry Fail
```

Its primary goal is to recover from temporary failures automatically.

---

# Why Retries Exist

Without retries:

```text id="9v4q5w"
Request
   │
   ▼
Temporary Failure
   │
   ▼
Permanent Failure
```

With retries:

```text id="k9m5pv"
Request
   │
   ▼
Temporary Failure
   │
   ▼
Retry
   │
   ▼
Success
```

Many failures are temporary and recover naturally after a short delay.

---

# Responsibilities

The Retry Engine manages:

* Retry decisions
* Retry scheduling
* Retry delays
* Backoff strategies
* Jitter application
* Retry limits
* Retry classification
* Retry metrics

---

# Retry Lifecycle

```text id="8xjv9q"
Execute
   │
   ▼
Failure
   │
   ▼
Classify
   │
 ┌─┴─┐
 │   │
Retry Stop
 │
 ▼
Delay
 │
 ▼
Execute Again
```

---

# Configuration

Retries can be configured globally.

```typescript id="6fxaq0"
const client = createLagless({
  request: {
    retryPolicy: {
      maxAttempts: 3
    }
  }
});
```

---

# Basic Retry Policy

Example:

```typescript id="cwh39s"
retryPolicy: {
  maxAttempts: 3,
  baseDelay: 1000
}
```

Meaning:

```text id="m8o0qq"
Attempt 1
Attempt 2
Attempt 3
```

with a one-second base delay.

---

# Retry Classification

Not all failures should be retried.

The Retry Engine first determines whether a failure is recoverable.

```text id="pr8d3f"
Failure
   │
   ▼
Classification
```

Result:

```text id="jwdnqx"
Retryable
```

or

```text id="qz9h4r"
Non-Retryable
```

---

# Retryable Failures

Common retryable failures include:

```text id="wdg7c7"
Network Errors
Timeouts
Connection Resets
Temporary Server Errors
Rate Limits
```

These often succeed when attempted again later.

---

# Non-Retryable Failures

Common non-retryable failures include:

```text id="4j5q8g"
Validation Errors
Malformed Requests
Authentication Failures
Authorization Failures
```

Repeating the same request would not solve the problem.

---

# HTTP Retry Classification

Typical classification:

```text id="8e8yyi"
429 Too Many Requests
500 Internal Server Error
502 Bad Gateway
503 Service Unavailable
504 Gateway Timeout
```

Usually retryable.

---

Typical non-retryable responses:

```text id="rl6hbe"
400 Bad Request
401 Unauthorized
403 Forbidden
404 Not Found
422 Validation Error
```

Usually not retried.

---

# Retry Delays

Retries are delayed to avoid overwhelming services.

Example:

```text id="kg8h67"
Failure
   │
   ▼
Wait
   │
   ▼
Retry
```

---

# Fixed Delay Strategy

Uses a constant delay.

Configuration:

```typescript id="v7xhjz"
retryPolicy: {
  baseDelay: 1000
}
```

Timeline:

```text id="8u7h5m"
1s
1s
1s
```

Simple but not always optimal.

---

# Exponential Backoff

Delay grows after each failure.

Configuration:

```typescript id="5j6c5r"
retryPolicy: {
  baseDelay: 1000,
  backoffMultiplier: 2
}
```

Timeline:

```text id="slv0tz"
1s
2s
4s
8s
```

This is the recommended default strategy.

---

# Why Exponential Backoff Matters

Without backoff:

```text id="yzh9gf"
Retry
Retry
Retry
Retry
Retry
```

Services may become overloaded.

With backoff:

```text id="g1avjl"
Retry
  │
  ▼
Wait Longer
  │
  ▼
Retry
```

Recovery is more graceful.

---

# Maximum Delay

Delay growth may be capped.

Configuration:

```typescript id="2fjtmq"
retryPolicy: {
  maxDelay: 30000
}
```

Timeline:

```text id="3fqzzg"
1s
2s
4s
8s
16s
30s
30s
30s
```

This prevents excessively long waits.

---

# Jitter

Jitter introduces randomness into delays.

Configuration:

```typescript id="ld3um0"
retryPolicy: {
  jitter: true
}
```

Without jitter:

```text id="2dz5r6"
Client A → 1s
Client B → 1s
Client C → 1s
```

All retry simultaneously.

With jitter:

```text id="tixw8v"
Client A → 0.8s
Client B → 1.2s
Client C → 1.5s
```

Retry load becomes distributed.

---

# Retry Timeline Example

Configuration:

```typescript id="5ubvra"
retryPolicy: {
  maxAttempts: 5,
  baseDelay: 1000,
  backoffMultiplier: 2,
  jitter: true
}
```

Possible timeline:

```text id="wljpdm"
Attempt 1
Fail
Wait 1.1s

Attempt 2
Fail
Wait 2.4s

Attempt 3
Fail
Wait 4.8s

Attempt 4
Success
```

---

# Request Engine Integration

The Request Engine delegates retry decisions.

```text id="1cxtjlwm"
Request Failure
       │
       ▼
Retry Engine
       │
       ▼
Retry Decision
```

This keeps retry logic centralized.

---

# Queue Engine Integration

Queue processing frequently uses retries.

Flow:

```text id="jlwmzz"
Queue Entry
     │
     ▼
Failure
     │
     ▼
Retry Engine
     │
     ▼
Retry Later
```

This enables reliable offline mutation recovery.

---

# Sync Engine Integration

Synchronization failures may also be retried.

```text id="8ryxw6"
Sync Failure
     │
     ▼
Retry Engine
```

Useful during intermittent connectivity problems.

---

# Offline Integration

Offline failures may defer retries until connectivity returns.

```text id="jhrzzt"
Offline
   │
   ▼
Pause Retries
   │
   ▼
Reconnect
   │
   ▼
Resume Retries
```

This avoids unnecessary work.

---

# Retry Context

Each retry attempt carries context.

Example:

```typescript id="ll6du7"
{
  attempt: 3,
  maxAttempts: 5,
  delay: 4000,
  error: previousError
}
```

Applications and plugins can inspect this information.

---

# Retry State

Operations may expose retry state.

Example:

```typescript id="b3jvby"
{
  status: 'retrying',
  attempt: 2
}
```

Possible states:

```text id="h6bryj"
pending
retrying
succeeded
failed
```

---

# Cancellation

Retries may be cancelled.

Example:

```typescript id="kgjj0t"
await client.retry.cancel(
  operationId
);
```

Flow:

```text id="2prm5m"
Retry Scheduled
      │
      ▼
Cancel
      │
      ▼
Removed
```

Useful during shutdown or user intervention.

---

# Retry Events

The Retry Engine emits lifecycle events.

Examples:

```text id="ig1u0f"
retry:start
retry:scheduled
retry:attempt
retry:success
retry:failure
retry:cancel
```

Example:

```typescript id="hmx9pd"
client.events.on(
  'retry:attempt',
  payload => {
    console.log(
      payload.attempt
    );
  }
);
```

---

# Event Flow

```text id="74o0u6"
Failure
   │
   ▼
retry:start
   │
   ▼
retry:attempt
   │
 ┌─┴─┐
 │   │
 ▼   ▼
Success Failure
 │        │
 ▼        ▼
retry:success
retry:failure
```

---

# Retry Metrics

The Retry Engine records:

* Retry count
* Retry success rate
* Retry failure rate
* Average retry duration
* Attempt distribution
* Backoff delays

Example:

```typescript id="31cptn"
const metrics =
  client.getMetricsSnapshot();
```

---

# Monitoring Retry Health

Useful indicators include:

```text id="xq3cyg"
Retry Rate
Failure Rate
Average Attempts
```

Unexpected increases may indicate:

* API instability
* Connectivity issues
* Infrastructure problems

---

# Error Handling

Possible errors include:

```typescript id="ht6k1e"
RetryError
TimeoutError
NetworkError
RateLimitError
```

Example:

```typescript id="rll9bq"
try {
  await client.request({
    url: '/api/users'
  });
} catch (error) {
  if (
    error instanceof RetryError
  ) {
    console.error(error);
  }
}
```

---

# Testing Retry Behavior

Example:

```typescript id="vjzz4z"
const fetcher =
  vi.fn()
    .mockRejectedValueOnce(
      new Error()
    )
    .mockResolvedValue({
      data: 'ok'
    });

const result =
  await client.request({
    url: '/api/test'
  });

expect(
  result.data
).toBe('ok');
```

This verifies retry recovery.

---

# Advanced Retry Policy

Example:

```typescript id="tr7lyy"
retryPolicy: {
  maxAttempts: 5,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  jitter: true
}
```

Recommended for production systems.

---

# Best Practices

## Use Exponential Backoff

Prefer:

```typescript id="s4e5w2"
backoffMultiplier: 2
```

instead of aggressive fixed retries.

---

## Enable Jitter

Always use:

```typescript id="3t1skt"
jitter: true
```

for distributed systems.

---

## Limit Retry Attempts

Avoid infinite retries.

Recommended:

```typescript id="y2t1cv"
maxAttempts: 3
```

to

```typescript id="g6sy8m"
maxAttempts: 5
```

depending on workload.

---

## Classify Failures Carefully

Retry only failures that may recover.

Avoid retrying validation and authorization errors.

---

## Monitor Retry Metrics

Watch for:

* High retry counts
* Rising failure rates
* Excessive delays

These often indicate infrastructure problems.

---

# Summary

The Retry Engine is the resilience and recovery layer of Lagless Core.

It provides:

* Retry classification
* Retry scheduling
* Exponential backoff
* Jitter support
* Retry cancellation
* Queue retry coordination
* Synchronization retry handling
* Retry events
* Retry metrics

ensuring transient failures are handled automatically and reliably throughout the entire Lagless runtime.
