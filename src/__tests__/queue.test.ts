import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { QueueEngine } from '../queue';
import { EventBus } from '../events';
import { StorageEngine } from '../core/storage';
import { RequestEngine } from '../core/request';
import { OfflineEngine } from '../offline';
import { ConfigManager } from '../config';
import { MetricsEngine } from '../metrics';
import { DedupEngine } from '../dedup';
import { RetryEngine } from '../retry';

describe('QueueEngine', () => {
  let queue: QueueEngine;
  let storage: StorageEngine;
  let request: RequestEngine;

  beforeEach(() => {
    const eventBus = new EventBus();
    const config = new ConfigManager({ offline: { queuePersistence: true, maxQueueSize: 10 } });
    storage = new StorageEngine(eventBus, config);
    const metrics = new MetricsEngine(eventBus, { enabled: true });
    const retry = new RetryEngine(eventBus);
    const dedup = new DedupEngine(eventBus, metrics);
    request = new RequestEngine(eventBus, metrics, dedup, retry, config);
    const offline = new OfflineEngine(eventBus, storage, config);
    queue = new QueueEngine(eventBus, storage, request, offline, config);
    vi.clearAllMocks();
    
    // Mock fetch
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should add operation to queue', async () => {
    const id = await queue.add({
      url: '/api/test',
      method: 'POST',
      body: { data: 'test' },
      maxAttempts: 3,
      retryUntil: Date.now() + 90000,
    });
    const pending = await queue.getPendingCount();
    expect(pending).toBe(1);
    expect(id).toBeDefined();
  });

  it('should process queue when online', async () => {
    (globalThis.fetch as any).mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    await queue.add({ 
      url: '/api/test', 
      method: 'POST',
      maxAttempts: 3,
      retryUntil: Date.now() + 90000,
    });
    const processed = await queue.processQueue();
    expect(processed).toBe(1);
    expect(await queue.getPendingCount()).toBe(0);
  });

  it('should retry failed operations', async () => {
    let attempts = 0;
    (globalThis.fetch as any).mockImplementation(async () => {
      attempts++;
      if (attempts < 2) throw new Error('Network error');
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    await queue.add({ 
      url: '/api/retry', 
      method: 'POST', 
      maxAttempts: 3,
      retryUntil: Date.now() + 90000,
    });
    await queue.processQueue();
    expect(attempts).toBe(2);
    expect(await queue.getPendingCount()).toBe(0);
  });

  it('should cancel operation', async () => {
    const id = await queue.add({ 
      url: '/api/cancel', 
      method: 'POST',
      maxAttempts: 3,
      retryUntil: Date.now() + 90000,
    });
    const cancelled = await queue.cancelOperation(id);
    expect(cancelled).toBe(true);
    expect(await queue.getPendingCount()).toBe(0);
  });

  it('should clear queue', async () => {
    await queue.add({ 
      url: '/api/a', 
      method: 'POST',
      maxAttempts: 3,
      retryUntil: Date.now() + 90000,
    });
    await queue.add({ 
      url: '/api/b', 
      method: 'POST',
      maxAttempts: 3,
      retryUntil: Date.now() + 90000,
    });
    await queue.clearQueue();
    expect(await queue.getPendingCount()).toBe(0);
  });
});
