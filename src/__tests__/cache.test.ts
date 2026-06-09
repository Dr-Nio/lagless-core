import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CacheEngine } from '../core/cache';
import { EventBus } from '../events';
import { MetricsEngine } from '../metrics';
import { ConfigManager } from '../config';

describe('CacheEngine', () => {
  let cache: CacheEngine;
  let eventBus: EventBus;
  let metrics: MetricsEngine;
  let config: ConfigManager;

  beforeEach(() => {
    eventBus = new EventBus();
    config = new ConfigManager({
      cache: { maxSize: 1024 * 100, defaultTTL: 1000, enabled: true, lru: true },
    });
    metrics = new MetricsEngine(eventBus, { enabled: true });
    cache = new CacheEngine(eventBus, metrics, config);
  });

  it('should set and get a value', async () => {
    await cache.set('test-key', { foo: 'bar' }, ['tag1']);
    const value = await cache.get('test-key');
    expect(value).toEqual({ foo: 'bar' });
  });

  it('should return null for missing key', async () => {
    const value = await cache.get('missing');
    expect(value).toBeNull();
  });

  it('should respect TTL', async () => {
    await cache.set('ttl-key', 'value', [], 50);
    await new Promise(resolve => setTimeout(resolve, 60));
    const value = await cache.get('ttl-key');
    expect(value).toBeNull();
  });

  it('should delete key', async () => {
    await cache.set('delete-key', 'value');
    await cache.delete('delete-key');
    const value = await cache.get('delete-key');
    expect(value).toBeNull();
  });

  it('should invalidate by tag', async () => {
    await cache.set('key1', 'val1', ['tagA']);
    await cache.set('key2', 'val2', ['tagA']);
    await cache.set('key3', 'val3', ['tagB']);
    const count = await cache.invalidate('tagA');
    expect(count).toBe(2);
    expect(await cache.get('key1')).toBeNull();
    expect(await cache.get('key2')).toBeNull();
    expect(await cache.get('key3')).toEqual('val3');
  });

  it('should handle cache-first strategy', async () => {
    const fetcher = vi.fn().mockResolvedValue('network-data');
    await cache.set('cf-key', 'cached-data');
    const result = await cache.getWithStrategy('cf-key', fetcher, 'cache-first');
    expect(result).toBe('cached-data');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('should handle network-first strategy with fallback', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('Network error'));
    await cache.set('nf-key', 'cached-fallback');
    const result = await cache.getWithStrategy('nf-key', fetcher, 'network-first');
    expect(result).toBe('cached-fallback');
    expect(fetcher).toHaveBeenCalled();
  });

  it('should handle stale-while-revalidate', async () => {
    let callCount = 0;
    const fetcher = vi.fn().mockImplementation(async () => {
      callCount++;
      return `fresh-${callCount}`;
    });
    await cache.set('swr-key', 'stale-data');
    const result = await cache.getWithStrategy('swr-key', fetcher, 'stale-while-revalidate');
    expect(result).toBe('stale-data');
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(await cache.get('swr-key')).toBe('fresh-1');
  });

  it('should track cache size and evict LRU', async () => {
    // Use undefined instead of null for defaultTTL
    const smallConfig = new ConfigManager({ cache: { maxSize: 200, defaultTTL: undefined } });
    const smallCache = new CacheEngine(eventBus, metrics, smallConfig);
    await smallCache.set('a', 'x'.repeat(100));
    await smallCache.set('b', 'y'.repeat(100));
    await smallCache.set('c', 'z'.repeat(100));
    expect(await smallCache.get('a')).toBeNull(); // evicted
    expect(await smallCache.get('b')).not.toBeNull();
    expect(await smallCache.get('c')).not.toBeNull();
  });
});
