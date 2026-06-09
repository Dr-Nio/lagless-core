import { CacheEntry, CacheStrategy, RequestResponse, RequestOptions } from '../../types';
import { CacheError } from '../../errors';
import { EventBus } from '../../events';
import { MetricsEngine } from '../../metrics';
import { hashGeneration, getSize, deepClone } from '../../utils';
import { ConfigManager } from '../../config';

interface LRUNode {
  key: string;
  prev: LRUNode | null;
  next: LRUNode | null;
}

export class CacheEngine {
  private cache: Map<string, CacheEntry> = new Map();
  private tagIndex: Map<string, Set<string>> = new Map();
  private lruHead: LRUNode | null = null;
  private lruTail: LRUNode | null = null;
  private lruMap: Map<string, LRUNode> = new Map();
  private totalSize = 0;

  constructor(
    private eventBus: EventBus,
    private metrics: MetricsEngine,
    private config: ConfigManager
  ) {}

  async get<T>(key: string): Promise<T | null> {
    const normalizedKey = this.normalizeKey(key);
    const entry = this.cache.get(normalizedKey);
    
    if (!entry) {
      this.metrics.record('cache_miss', 1);
      this.eventBus.emit('cache:miss', { key: normalizedKey });
      return null;
    }

    const now = Date.now();
    if (entry.expiresAt && entry.expiresAt <= now) {
      await this.delete(normalizedKey);
      this.eventBus.emit('cache:evict', { key: normalizedKey, reason: 'expired' });
      this.metrics.record('cache_miss', 1);
      return null;
    }

    entry.accessedAt = now;
    this.updateLRU(normalizedKey);
    this.metrics.record('cache_hit', 1);
    this.eventBus.emit('cache:hit', { key: normalizedKey, tags: entry.tags });
    
    return deepClone(entry.value) as T;
  }

  async set<T>(key: string, value: T, tags: string[] = [], ttl?: number): Promise<void> {
    const normalizedKey = this.normalizeKey(key);
    const now = Date.now();
    const effectiveTTL = ttl ?? this.config.get('cache')?.defaultTTL;
    const size = getSize(value);
    const maxSize = this.config.get('cache')?.maxSize;

    if (maxSize && size > maxSize) {
      throw new CacheError(`Value size ${size} exceeds cache max size ${maxSize}`);
    }

    const existingEntry = this.cache.get(normalizedKey);
    if (existingEntry) {
      this.totalSize -= existingEntry.size;
    }

    while (maxSize && this.totalSize + size > maxSize && this.lruTail) {
      await this.delete(this.lruTail.key);
    }

    const entry: CacheEntry = {
      key: normalizedKey,
      value: deepClone(value),
      tags,
      createdAt: now,
      accessedAt: now,
      expiresAt: effectiveTTL ? now + effectiveTTL : null,
      size,
    };

    this.cache.set(normalizedKey, entry);
    this.totalSize += size;
    this.updateLRU(normalizedKey);
    this.updateTagIndex(normalizedKey, tags);

    this.eventBus.emit('cache:set', { key: normalizedKey, tags });
    this.metrics.record('cache_set', 1);
  }

  async delete(key: string): Promise<boolean> {
    const normalizedKey = this.normalizeKey(key);
    const entry = this.cache.get(normalizedKey);
    
    if (!entry) return false;

    this.cache.delete(normalizedKey);
    this.totalSize -= entry.size;
    this.removeFromTagIndex(normalizedKey, entry.tags);
    this.removeFromLRU(normalizedKey);
    
    this.eventBus.emit('cache:delete', { key: normalizedKey });
    this.metrics.record('cache_delete', 1);
    return true;
  }

  async invalidate(tag: string): Promise<number> {
    const keysToInvalidate = this.tagIndex.get(tag);
    if (!keysToInvalidate) return 0;

    let count = 0;
    for (const key of keysToInvalidate) {
      if (await this.delete(key)) {
        count++;
      }
    }

    this.eventBus.emit('cache:invalidate', { key: tag, tags: [tag] });
    this.metrics.record('cache_invalidate', count);
    return count;
  }

  async invalidateTags(tags: string[]): Promise<number> {
    let total = 0;
    for (const tag of tags) {
      total += await this.invalidate(tag);
    }
    return total;
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.tagIndex.clear();
    this.lruHead = null;
    this.lruTail = null;
    this.lruMap.clear();
    this.totalSize = 0;
    
    this.eventBus.emit('cache:clear', {});
    this.metrics.record('cache_clear', 1);
  }

  async getWithStrategy<T>(
    key: string,
    fetcher: () => Promise<T>,
    strategy: CacheStrategy,
    tags?: string[]
  ): Promise<T> {
    switch (strategy) {
      case 'cache-only':
        const cached = await this.get<T>(key);
        if (cached === null) {
          throw new CacheError(`Cache miss for key: ${key}`);
        }
        return cached;

      case 'network-only':
        const data = await fetcher();
        if (tags) await this.set(key, data, tags);
        return data;

      case 'cache-first':
        const cacheResult = await this.get<T>(key);
        if (cacheResult !== null) return cacheResult;
        const networkResult = await fetcher();
        if (tags) await this.set(key, networkResult, tags);
        return networkResult;

      case 'network-first':
        try {
          const freshData = await fetcher();
          if (tags) await this.set(key, freshData, tags);
          return freshData;
        } catch (error) {
          const staleData = await this.get<T>(key);
          if (staleData !== null) return staleData;
          throw error;
        }

      case 'stale-while-revalidate':
        const stale = await this.get<T>(key);
        const revalidatePromise = fetcher().then(async fresh => {
          if (tags) await this.set(key, fresh, tags);
          return fresh;
        }).catch(() => null);
        
        if (stale !== null) {
          revalidatePromise.catch(() => {});
          return stale;
        }
        
        const freshResult = await revalidatePromise;
        if (freshResult === null) {
          throw new CacheError(`No data available for key: ${key}`);
        }
        return freshResult;

      default:
        return this.getWithStrategy(key, fetcher, 'network-first', tags);
    }
  }

  has(key: string): boolean {
    const normalizedKey = this.normalizeKey(key);
    return this.cache.has(normalizedKey);
  }

  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  size(): number {
    return this.cache.size;
  }

  getTotalSize(): number {
    return this.totalSize;
  }

  getStats() {
    return {
      entries: this.cache.size,
      totalSize: this.totalSize,
      maxSize: this.config.get('cache')?.maxSize,
      tags: this.tagIndex.size,
    };
  }

  private normalizeKey(key: string): string {
    return key.trim();
  }

  private updateLRU(key: string): void {
    const existingNode = this.lruMap.get(key);
    if (existingNode) {
      this.removeFromLRUList(existingNode);
    }

    const newNode: LRUNode = { key, prev: null, next: this.lruHead };
    if (this.lruHead) {
      this.lruHead.prev = newNode;
    }
    this.lruHead = newNode;
    if (!this.lruTail) {
      this.lruTail = newNode;
    }
    this.lruMap.set(key, newNode);
  }

  private removeFromLRU(key: string): void {
    const node = this.lruMap.get(key);
    if (node) {
      this.removeFromLRUList(node);
      this.lruMap.delete(key);
    }
  }

  private removeFromLRUList(node: LRUNode): void {
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      this.lruHead = node.next;
    }
    if (node.next) {
      node.next.prev = node.prev;
    } else {
      this.lruTail = node.prev;
    }
    node.prev = null;
    node.next = null;
  }

  private updateTagIndex(key: string, tags: string[]): void {
    for (const tag of tags) {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag)!.add(key);
    }
  }

  private removeFromTagIndex(key: string, tags: string[]): void {
    for (const tag of tags) {
      const keys = this.tagIndex.get(tag);
      if (keys) {
        keys.delete(key);
        if (keys.size === 0) {
          this.tagIndex.delete(tag);
        }
      }
    }
  }
}
