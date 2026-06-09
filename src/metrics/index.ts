import { MetricsSnapshot } from '../types';
import { EventBus } from '../events';

interface MetricRecord {
  name: string;
  value: number;
  tags?: Record<string, string>;
  timestamp: number;
}

export class MetricsEngine {
  private metrics: Map<string, MetricRecord[]> = new Map();
  private counters: Map<string, number> = new Map();
  private latencies: Map<string, number[]> = new Map();
  private sampleRate: number;
  private exporters: Array<(snapshot: MetricsSnapshot) => void>;
  private enabled: boolean;
  private snapshotInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private eventBus: EventBus,
    config?: { enabled?: boolean; sampleRate?: number; exporters?: Array<(snapshot: MetricsSnapshot) => void> }
  ) {
    this.enabled = config?.enabled ?? true;
    this.sampleRate = config?.sampleRate ?? 1.0;
    this.exporters = config?.exporters ?? [];

    if (this.enabled) {
      this.startSnapshotInterval();
    }
  }

  private startSnapshotInterval(): void {
    this.snapshotInterval = setInterval(() => {
      const snapshot = this.getSnapshot();
      for (const exporter of this.exporters) {
        try {
          exporter(snapshot);
        } catch {
          // Ignore exporter errors
        }
      }
    }, 60000); // Export every minute
  }

  record(name: string, value: number, tags?: Record<string, string>): void {
    if (!this.enabled) return;
    if (Math.random() > this.sampleRate) return;

    const record: MetricRecord = {
      name,
      value,
      timestamp: Date.now(),
    };

    // Only add tags if defined
    if (tags !== undefined) {
      record.tags = tags;
    }

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name)!.push(record);

    // Trim history to last 1000 records per metric
    const history = this.metrics.get(name)!;
    if (history.length > 1000) {
      history.shift();
    }

    // Update counters
    if (name === 'cache_hit' || name === 'cache_miss' || name === 'network_calls' || 
        name === 'dedup_hit' || name === 'retry_attempt' || name === 'sync_event') {
      const current = this.counters.get(name) || 0;
      this.counters.set(name, current + value);
    }

    // Update latencies
    if (name === 'request_latency') {
      if (!this.latencies.has('request_latency')) {
        this.latencies.set('request_latency', []);
      }
      this.latencies.get('request_latency')!.push(value);
      // Keep last 1000 latencies
      const latencyList = this.latencies.get('request_latency')!;
      if (latencyList.length > 1000) {
        latencyList.shift();
      }
    }

    // Create event payload without undefined tags
    const eventPayload: { name: string; value: number; tags?: Record<string, string> } = { name, value };
    if (tags !== undefined) {
      eventPayload.tags = tags;
    }
    this.eventBus.emit('metric:record', eventPayload);
  }

  counter(name: string, increment = 1): void {
    this.record(name, increment);
  }

  timing(name: string, durationMs: number, tags?: Record<string, string>): void {
    this.record(name, durationMs, tags);
  }

  gauge(name: string, value: number, tags?: Record<string, string>): void {
    this.record(name, value, tags);
  }

  getSnapshot(): MetricsSnapshot {
    const cacheHits = this.counters.get('cache_hit') || 0;
    const cacheMisses = this.counters.get('cache_miss') || 0;
    const networkCalls = this.counters.get('network_calls') || 0;
    const dedupHits = this.counters.get('dedup_hit') || 0;
    const retries = this.counters.get('retry_attempt') || 0;
    const queueSize = this.counters.get('queue_size') || 0;
    const syncEvents = this.counters.get('sync_event') || 0;
    const evictionCount = this.counters.get('cache_evict') || 0;

    const latencies = this.latencies.get('request_latency') || [];
    const averageLatency = latencies.length > 0
      ? latencies.reduce((a, b) => a + b, 0) / latencies.length
      : 0;

    return {
      cacheHits,
      cacheMisses,
      networkCalls,
      dedupHits,
      retries,
      queueSize,
      syncEvents,
      averageLatency,
      evictionCount,
      timestamps: {
        start: this.metrics.size > 0 ? Math.min(...Array.from(this.metrics.values()).flatMap(arr => arr.map(r => r.timestamp))) : Date.now(),
        end: Date.now(),
      },
    };
  }

  reset(): void {
    this.metrics.clear();
    this.counters.clear();
    this.latencies.clear();
  }

  getMetric(name: string): MetricRecord[] {
    return this.metrics.get(name) || [];
  }

  getAllMetrics(): Map<string, MetricRecord[]> {
    return new Map(this.metrics);
  }

  setSampleRate(rate: number): void {
    this.sampleRate = Math.min(1, Math.max(0, rate));
  }

  enable(): void {
    this.enabled = true;
    this.startSnapshotInterval();
  }

  disable(): void {
    this.enabled = false;
    if (this.snapshotInterval) {
      clearInterval(this.snapshotInterval);
      this.snapshotInterval = null;
    }
  }

  addExporter(exporter: (snapshot: MetricsSnapshot) => void): void {
    this.exporters.push(exporter);
  }

  removeExporter(exporter: (snapshot: MetricsSnapshot) => void): void {
    const index = this.exporters.indexOf(exporter);
    if (index !== -1) {
      this.exporters.splice(index, 1);
    }
  }

  destroy(): void {
    this.disable();
    this.reset();
  }
}
