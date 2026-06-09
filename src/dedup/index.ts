import { EventBus } from '../events';
import { MetricsEngine } from '../metrics';
import { hashGeneration } from '../utils';

interface DedupEntry<T = unknown> {
  promise: Promise<T>;
  createdAt: number;
  activeConsumers: number;
}

export class DedupEngine {
  private cache: Map<string, DedupEntry<any>> = new Map();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private eventBus: EventBus,
    private metrics: MetricsEngine,
    private ttl = 5000
  ) {
    this.startCleanup();
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.ttl);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.createdAt > this.ttl) {
        this.cache.delete(key);
      }
    }
  }

  getOrCreate<T>(
    key: string | Record<string, unknown>,
    factory: () => Promise<T>
  ): { promise: Promise<T>; fromCache: boolean; activeCount: number } {
    const cacheKey = typeof key === 'string' ? key : hashGeneration(key);
    const existing = this.cache.get(cacheKey);
    
    if (existing) {
      existing.activeConsumers++;
      this.metrics.record('dedup_hit', 1);
      this.eventBus.emit('dedup:hit', { key: cacheKey, activeCount: existing.activeConsumers });
      return {
        promise: existing.promise as Promise<T>,
        fromCache: true,
        activeCount: existing.activeConsumers,
      };
    }

    const promise = factory();
    const entry: DedupEntry<T> = {
      promise,
      createdAt: Date.now(),
      activeConsumers: 1,
    };
    this.cache.set(cacheKey, entry);
    this.metrics.record('dedup_new', 1);
    this.eventBus.emit('dedup:new', { key: cacheKey });

    // Clean up after promise settles
    promise.finally(() => {
      const finalEntry = this.cache.get(cacheKey);
      if (finalEntry) {
        finalEntry.activeConsumers--;
        if (finalEntry.activeConsumers === 0) {
          // Don't delete immediately, wait for TTL
          setTimeout(() => {
            const checkEntry = this.cache.get(cacheKey);
            if (checkEntry && checkEntry.activeConsumers === 0) {
              this.cache.delete(cacheKey);
            }
          }, this.ttl);
        }
      }
    });

    return {
      promise,
      fromCache: false,
      activeCount: 1,
    };
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  setTTL(ttl: number): void {
    this.ttl = ttl;
    this.restartCleanup();
  }

  private restartCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.startCleanup();
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.cache.clear();
  }
}
