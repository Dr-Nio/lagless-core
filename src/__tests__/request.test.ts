import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RequestEngine } from '../core/request';
import { EventBus } from '../events';
import { MetricsEngine } from '../metrics';
import { DedupEngine } from '../dedup';
import { RetryEngine } from '../retry';
import { ConfigManager } from '../config';

describe('RequestEngine', () => {
  let request: RequestEngine;
  let eventBus: EventBus;
  let metrics: MetricsEngine;

  beforeEach(() => {
    eventBus = new EventBus();
    metrics = new MetricsEngine(eventBus, { enabled: true });
    const config = new ConfigManager();
    const retry = new RetryEngine(eventBus);
    const dedup = new DedupEngine(eventBus, metrics);
    request = new RequestEngine(eventBus, metrics, dedup, retry, config);
    vi.clearAllMocks();
    
    // Reset fetch mock before each test
    vi.restoreAllMocks();
  });

  it('should execute GET request successfully', async () => {
    const mockResponse = new Response(JSON.stringify({ data: 'test' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

    const result = await request.execute({ url: 'https://api.example.com/data' });
    expect(result.data).toEqual({ data: 'test' });
    expect(result.status).toBe(200);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('should handle request timeout', async () => {
    globalThis.fetch = vi.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
    await expect(request.execute({ url: 'https://api.example.com', timeout: 10 })).rejects.toThrow('timeout');
  });

  it('should retry on failure', async () => {
    let attempts = 0;
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      attempts++;
      if (attempts < 3) throw new Error('Network error');
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    const result = await request.execute({ url: 'https://api.example.com', retryPolicy: { maxAttempts: 3, baseDelay: 10 } });
    expect(result.status).toBe(200);
    expect(globalThis.fetch).toHaveBeenCalledTimes(3);
  });

  it('should deduplicate identical requests', async () => {
    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      callCount++;
      await new Promise(r => setTimeout(r, 20));
      return new Response(JSON.stringify({ id: callCount }), { status: 200 });
    });
    const [res1, res2, res3] = await Promise.all([
      request.execute({ url: 'https://api.example.com/dedup', method: 'GET' }),
      request.execute({ url: 'https://api.example.com/dedup', method: 'GET' }),
      request.execute({ url: 'https://api.example.com/dedup', method: 'GET' }),
    ]);
    expect(callCount).toBe(1);
    expect(res1.data).toEqual({ id: 1 });
    expect(res2.data).toEqual({ id: 1 });
    expect(res3.data).toEqual({ id: 1 });
  });

  it('should abort request', async () => {
    globalThis.fetch = vi.fn().mockImplementation(() => new Promise(() => {}));
    const promise = request.execute({ url: 'https://api.example.com' });
    request.abort('some-id'); // Not the actual id, but abortAll works
    request.abortAll();
    await expect(promise).rejects.toThrow('aborted');
  });
});
