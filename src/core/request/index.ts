import { RequestOptions, RequestResponse, HTTPMethod, RetryPolicy } from '../../types';
import { RequestError, TimeoutError, AbortError, RetryError } from '../../errors';
import { delay, generateId, hashGeneration } from '../../utils';
import { EventBus } from '../../events';
import { MetricsEngine } from '../../metrics';
import { DedupEngine } from '../../dedup';
import { RetryEngine } from '../../retry';
import { ConfigManager } from '../../config';

export class RequestEngine {
  private abortControllers: Map<string, AbortController> = new Map();
  private pendingRequests: Map<string, Promise<RequestResponse>> = new Map();

  constructor(
    private eventBus: EventBus,
    private metrics: MetricsEngine,
    private dedup: DedupEngine,
    private retryEngine: RetryEngine,
    private config: ConfigManager
  ) {}

  async execute<T = unknown>(options: RequestOptions<T>): Promise<RequestResponse<T>> {
    const requestId = generateId();
    const startTime = performance.now();
    const normalizedOptions = this.normalizeOptions(options);
    const cacheKey = normalizedOptions.cacheKey || this.generateCacheKey(normalizedOptions);

    // Apply interceptors
    let processedOptions = await this.applyRequestInterceptors(normalizedOptions);

    // Deduplication check
    if (this.config.get('dedup')?.enabled && processedOptions.method === 'GET') {
      const dedupResult = this.dedup.getOrCreate(cacheKey, () => this.executeInternal<T>(processedOptions, requestId));
      if (dedupResult.fromCache) {
        this.eventBus.emit('dedup:hit', { key: cacheKey, activeCount: dedupResult.activeCount });
        this.metrics.record('dedup_hit', 1);
        // Cast the promise to the correct generic type
        return dedupResult.promise as Promise<RequestResponse<T>>;
      }
      // Cast the promise to the correct generic type
      return dedupResult.promise as Promise<RequestResponse<T>>;
    }

    return this.executeInternal<T>(processedOptions, requestId);
  }

  private async executeInternal<T>(options: RequestOptions<T>, requestId: string): Promise<RequestResponse<T>> {
    const startTime = performance.now();
    const controller = new AbortController();
    this.abortControllers.set(requestId, controller);

    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    try {
      this.eventBus.emit('request:start', { url: options.url, method: options.method || 'GET' });

      const mergedSignal = this.mergeSignals(options.signal, controller.signal);

      if (options.timeout && options.timeout > 0) {
        timeoutId = setTimeout(() => {
          controller.abort(new TimeoutError(`Request timeout after ${options.timeout}ms`));
        }, options.timeout);
      }

      const fetchOptions: RequestInit = {
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        signal: mergedSignal,
      };

      if (options.body && (options.method === 'POST' || options.method === 'PUT' || options.method === 'PATCH')) {
        fetchOptions.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
      }

      const fetchPromise = fetch(options.url, fetchOptions);
      const response = await this.withRetry(fetchPromise, options, requestId);

      clearTimeout(timeoutId);

      if (!response.ok) {
        // Only include method if it's defined
        const errorOptions: { status: number; url: string; method?: string; code?: string; context?: Record<string, unknown> } = {
          status: response.status,
          url: options.url,
        };
        if (options.method) {
          errorOptions.method = options.method;
        }
        throw new RequestError(`Request failed with status ${response.status}`, errorOptions);
      }

      const data = await this.parseResponse<T>(response);
      const latency = performance.now() - startTime;

      const result: RequestResponse<T> = {
        data,
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        fromCache: false,
        fromDedup: false,
        latency,
        timestamp: Date.now(),
      };

      const processedResult = await this.applyResponseInterceptors(result);
      this.eventBus.emit('request:end', { url: options.url, method: options.method || 'GET', latency });
      this.metrics.record('request_latency', latency);
      this.metrics.record('network_calls', 1);

      return processedResult;
    } catch (error) {
      clearTimeout(timeoutId);
      this.eventBus.emit('request:error', { url: options.url, method: options.method || 'GET', error: error as Error });
      this.metrics.record('request_error', 1);
      throw error;
    } finally {
      this.abortControllers.delete(requestId);
    }
  }

  private async withRetry<T>(promise: Promise<Response>, options: RequestOptions, requestId: string): Promise<Response> {
    const retryPolicy = this.buildRetryPolicy(options.retryPolicy);
    
    return this.retryEngine.execute(
      async () => {
        const response = await promise;
        if (!response.ok && retryPolicy.retryCondition?.(new RequestError(`HTTP ${response.status}`, { status: response.status }))) {
          throw new RequestError(`HTTP ${response.status}`, { status: response.status });
        }
        return response;
      },
      {
        maxAttempts: retryPolicy.maxAttempts,
        baseDelay: retryPolicy.baseDelay,
        maxDelay: retryPolicy.maxDelay,
        backoffMultiplier: retryPolicy.backoffMultiplier,
        jitter: retryPolicy.jitter,
      },
      requestId
    );
  }

  private normalizeOptions(options: RequestOptions): RequestOptions {
    const defaultStrategy = this.config.get('request')?.defaultStrategy;
    const defaultTimeout = this.config.get('request')?.timeout;
    
    // Start with base options
    const normalized: RequestOptions = {
      url: options.url,
      method: options.method || 'GET',
    };
    
    // Copy optional properties only if they exist in the original
    if (options.headers !== undefined) {
      normalized.headers = options.headers;
    }
    if (options.body !== undefined) {
      normalized.body = options.body;
    }
    if (options.signal !== undefined) {
      normalized.signal = options.signal;
    }
    if (options.cacheKey !== undefined) {
      normalized.cacheKey = options.cacheKey;
    }
    if (options.tags !== undefined) {
      normalized.tags = options.tags;
    }
    if (options.priority !== undefined) {
      normalized.priority = options.priority;
    }
    if (options.metadata !== undefined) {
      normalized.metadata = options.metadata;
    }
    
    // Only assign strategy if it's defined (from options or default)
    const strategy = options.strategy ?? defaultStrategy;
    if (strategy !== undefined) {
      normalized.strategy = strategy;
    }
    
    // Only assign timeout if it's defined (from options or default)
    const timeout = options.timeout ?? defaultTimeout;
    if (timeout !== undefined) {
      normalized.timeout = timeout;
    }
    
    // Only assign retryPolicy if it's defined (from options or default)
    const defaultRetryPolicy = this.config.get('request')?.retryPolicy;
    const retryPolicy = options.retryPolicy ?? defaultRetryPolicy;
    if (retryPolicy !== undefined) {
      normalized.retryPolicy = retryPolicy;
    }
    
    return normalized;
  }

  private buildRetryPolicy(partial?: Partial<RetryPolicy>): RetryPolicy {
    const defaultPolicy = this.config.get('request')?.retryPolicy;
    
    // Build the policy with required properties
    const policy: RetryPolicy = {
      maxAttempts: partial?.maxAttempts ?? defaultPolicy?.maxAttempts ?? 3,
      baseDelay: partial?.baseDelay ?? defaultPolicy?.baseDelay ?? 1000,
      maxDelay: partial?.maxDelay ?? defaultPolicy?.maxDelay ?? 30000,
      backoffMultiplier: partial?.backoffMultiplier ?? defaultPolicy?.backoffMultiplier ?? 2,
      jitter: partial?.jitter ?? defaultPolicy?.jitter ?? true,
    };
    
    // Only assign retryCondition if it's defined
    const retryCondition = partial?.retryCondition ?? defaultPolicy?.retryCondition;
    if (retryCondition !== undefined) {
      policy.retryCondition = retryCondition;
    }
    
    return policy;
  }

  private generateCacheKey(options: RequestOptions): string {
    const keyObj = {
      url: options.url,
      method: options.method,
      headers: options.headers,
      body: options.body,
    };
    return hashGeneration(keyObj);
  }

  private async parseResponse<T>(response: Response): Promise<T> {
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      return response.json() as Promise<T>;
    }
    if (contentType?.includes('text/')) {
      return response.text() as unknown as T;
    }
    return response.arrayBuffer() as unknown as T;
  }

  private mergeSignals(...signals: (AbortSignal | undefined)[]): AbortSignal {
    const controller = new AbortController();
    for (const signal of signals) {
      if (signal?.aborted) {
        controller.abort(signal.reason);
        return controller.signal;
      }
      signal?.addEventListener('abort', () => controller.abort(signal.reason), { once: true });
    }
    return controller.signal;
  }

  private async applyRequestInterceptors(options: RequestOptions): Promise<RequestOptions> {
    const interceptors = this.config.get('request')?.interceptors?.request || [];
    let result = options;
    for (const interceptor of interceptors) {
      result = await interceptor(result);
    }
    return result;
  }

  private async applyResponseInterceptors<T>(response: RequestResponse<T>): Promise<RequestResponse<T>> {
    const interceptors = this.config.get('request')?.interceptors?.response || [];
    let result: RequestResponse<T> = response;
    for (const interceptor of interceptors) {
      result = await interceptor(result) as RequestResponse<T>;
    }
    return result;
  }

  abort(requestId: string): void {
    const controller = this.abortControllers.get(requestId);
    if (controller) {
      controller.abort(new AbortError('Request aborted by user'));
    }
  }

  abortAll(): void {
    for (const controller of this.abortControllers.values()) {
      controller.abort(new AbortError('All requests aborted'));
    }
    this.abortControllers.clear();
  }
}
