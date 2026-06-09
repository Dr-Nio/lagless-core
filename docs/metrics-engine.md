# Metrics Engine

The Metrics Engine is the observability layer of Lagless Core.

It collects, aggregates, and exposes runtime performance data across all system components, enabling developers to understand behavior, detect bottlenecks, and monitor system health in real time.

The Metrics Engine is designed to be lightweight, extensible, and production-safe, with minimal overhead even under high request volume.

It integrates deeply with:

* Request Engine
* Cache Engine
* Storage Engine
* Queue Engine
* Sync Engine
* Retry Engine
* Event Bus
* Subscription Engine

---

# Overview

The Metrics Engine observes everything happening inside Lagless Core.

```text id="m1q8v2"
System Activity
      │
      ▼
Metrics Engine
      │
      ▼
Aggregated Insights
```

It does not modify behavior—it only measures it.

---

# Why Metrics Exist

Without metrics:

```text id="k2n7s5"
System Runs
   │
   ▼
Unknown Performance
```

With metrics:

```text id="p9x3d1"
System Runs
   │
   ▼
Measured Behavior
   │
   ▼
Optimization Insights
```

Metrics make systems observable, debuggable, and optimizable.

---

# Responsibilities

The Metrics Engine manages:

* Performance tracking
* Latency measurement
* Request counting
* Cache hit/miss ratios
* Retry statistics
* Queue depth monitoring
* Sync performance tracking
* Custom metrics recording
* Metrics aggregation
* Metrics export

---

# Core Metric Types

The system supports several metric categories:

```text id="t8v0qk"
Counters
Gauges
Timers
Histograms
Snapshots
```

---

# Counters

Counters track incrementing values.

Example:

```typescript id="c7m2xk"
client.metrics.counter(
  'request_total',
  1
);
```

Behavior:

```text id="q1w9z8"
0 → 1 → 2 → 3 → 4
```

Used for:

* Request counts
* Error counts
* Event counts

---

# Gauges

Gauges represent current state.

Example:

```typescript id="g4n8r2"
client.metrics.gauge(
  'queue_size',
  12
);
```

Behavior:

```text id="v2k8m9"
Value can go up or down
```

Used for:

* Queue length
* Cache size
* Active connections

---

# Timers

Timers measure duration.

Example:

```typescript id="d5p3t7"
client.metrics.timing(
  'request_latency',
  150
);
```

Behavior:

```text id="l9c4v2"
Start → End → Duration
```

Used for:

* API latency
* Sync duration
* Retry delays

---

# Histograms

Histograms group values into distributions.

Example:

```typescript id="h8r1k6"
client.metrics.histogram(
  'response_size',
  1024
);
```

Used for:

* Payload sizes
* Latency distribution
* Retry intervals

---

# Snapshot Metrics

Snapshots capture current system state.

Example:

```typescript id="s6d1m9"
const metrics =
  client.getMetricsSnapshot();
```

Example output:

```typescript id="z3x9q1"
{
  requests: 1200,
  cacheHits: 800,
  cacheMisses: 200,
  retries: 50,
  queueSize: 5
}
```

---

# Request Metrics

Tracked automatically:

```text id="r1k9m3"
request:start
request:end
request:error
```

Collected values:

* Total requests
* Success rate
* Failure rate
* Average latency

---

# Cache Metrics

Tracked values:

```text id="c2x8v7"
cache_hits
cache_misses
cache_evictions
cache_size
```

Cache performance is critical for Lagless efficiency.

---

# Queue Metrics

Monitors offline and deferred operations:

```text id="q7m3d8"
queue_size
queue_processed
queue_failed
queue_retries
```

Helps detect backlog issues.

---

# Sync Metrics

Tracks synchronization health:

```text id="s4k9v2"
sync_duration
sync_success_rate
sync_failures
sync_conflicts
```

Used to ensure eventual consistency remains stable.

---

# Retry Metrics

Tracks resilience behavior:

```text id="r8t3n6"
retry_attempts
retry_success_rate
retry_failures
retry_backoff_time
```

Helps identify unstable network conditions or failing endpoints.

---

# Storage Metrics

Monitors persistence layer:

```text id="st6v2q"
storage_reads
storage_writes
storage_errors
storage_size
```

---

# Event Metrics

Tracks event system activity:

```text id="e9m2x8"
events_emitted
events_listened
event_latency
listener_failures
```

---

# Subscription Metrics

Tracks reactive system usage:

```text id="sub4k1"
active_subscriptions
subscription_notifications
unsubscribe_count
pattern_subscriptions
```

---

# Metric Flow

```text id="f2q9v7"
Engine Action
      │
      ▼
Metric Recorded
      │
      ▼
Aggregator
      │
      ▼
Snapshot
```

---

# Aggregation Strategy

Metrics are aggregated in memory before export.

```text id="a8k3v6"
Raw Data → Buffer → Aggregate → Snapshot
```

This reduces performance overhead.

---

# Sampling

High-frequency metrics may be sampled.

Example:

```typescript id="sm2v7k"
metrics: {
  sampleRate: 0.1
}
```

Meaning:

```text id="s1x8n3"
10% of events recorded
```

Used for:

* Large-scale production systems
* High-throughput APIs

---

# Real-Time Metrics

Metrics can be streamed in real time.

```text id="rt5v2m"
Engine → Metrics Stream → Dashboard
```

Useful for live monitoring tools.

---

# Exporting Metrics

Metrics can be exported to external systems.

Example:

```typescript id="ex9k3v"
client.metrics.export(
  'prometheus'
);
```

Supported outputs:

```text id="e4m7v2"
Prometheus
JSON
Custom Exporters
```

---

# Event Integration

The Metrics Engine emits events:

```text id="ev7k3x"
metrics:recorded
metrics:updated
metrics:exported
```

Example:

```typescript id="ev3m9k"
client.events.on(
  'metrics:recorded',
  payload => {
    console.log(payload);
  }
);
```

---

# Metrics Pipeline

```text id="mp9v2k"
Engine Event
     │
     ▼
Metric Capture
     │
     ▼
Aggregation
     │
     ▼
Storage Buffer
     │
     ▼
Snapshot / Export
```

---

# Performance Considerations

The Metrics Engine is optimized for low overhead:

* Non-blocking writes
* Batched aggregation
* Optional sampling
* Lazy exports

---

# Memory Management

To avoid memory issues:

```text id="mem4v2"
Old Metrics → Evicted → Snapshot Retained
```

Retention is configurable.

---

# Configuration

Example:

```typescript id="cfg8v2"
metrics: {
  enabled: true,
  sampleRate: 0.1,
  exportInterval: 60000
}
```

---

# Error Handling

Possible errors:

```typescript id="err2v9"
MetricsError
ExportError
AggregationError
BufferOverflowError
```

Example:

```typescript id="eh9v3k"
try {
  client.metrics.record(
    'event',
    1
  );
} catch (error) {
  console.error(error);
}
```

---

# Testing Metrics

Example:

```typescript id="test8v2"
client.metrics.counter(
  'requests',
  1
);

const snapshot =
  client.getMetricsSnapshot();

expect(
  snapshot.requests
).toBeGreaterThan(0);
```

---

# Best Practices

## Enable Sampling in Production

```typescript id="bp1v9k"
sampleRate: 0.1
```

Prevents overhead.

---

## Track Only Meaningful Metrics

Avoid excessive custom metrics.

Focus on:

* Latency
* Failures
* Throughput

---

## Export Metrics Regularly

Ensure external dashboards stay updated.

---

## Monitor Retry + Sync Together

Correlated metrics reveal system instability.

---

## Use Snapshots for Debugging

Snapshots provide a consistent view of system state.

---

# Summary

The Metrics Engine is the observability backbone of Lagless Core.

It provides:

* Counters
* Gauges
* Timers
* Histograms
* Snapshots
* Sampling
* Exporting
* Event integration
* Real-time observability

ensuring every subsystem in Lagless Core is measurable, debuggable, and production-ready.
