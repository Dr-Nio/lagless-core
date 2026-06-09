import { CacheStrategy, SyncStrategy, RequestOptions, RequestResponse } from '../types';
import { CacheEngine } from '../core/cache';
import { RequestEngine } from '../core/request';
import { EventBus } from '../events';

export interface StrategyContext {
  request: RequestOptions;
  cacheKey: string;
  tags?: string[];
}

export interface StrategyResult<T> {
  data: T;
  fromCache: boolean;
  latency: number;
}

export class StrategyEngine {
  constructor(
    private cacheEngine: CacheEngine,
    private requestEngine: RequestEngine,
    private eventBus: EventBus
  ) {}

  async execute<T>(
    context: StrategyContext,
    strategy: CacheStrategy
  ): Promise<StrategyResult<T>> {
    const startTime = performance.now();
    
    switch (strategy) {
      case 'cache-only':
        return this.cacheOnly<T>(context);
      case 'network-only':
        return this.networkOnly<T>(context);
      case 'cache-first':
        return this.cacheFirst<T>(context);
      case 'network-first':
        return this.networkFirst<T>(context);
      case 'stale-while-revalidate':
        return this.staleWhileRevalidate<T>(context);
      default:
        return this.networkFirst<T>(context);
    }
  }

  private async cacheOnly<T>(context: StrategyContext): Promise<StrategyResult<T>> {
    const cached = await this.cacheEngine.get<T>(context.cacheKey);
    if (cached === null) {
      throw new Error(`Cache miss for key: ${context.cacheKey}`);
    }
    return {
      data: cached,
      fromCache: true,
      latency: 0,
    };
  }

  private async networkOnly<T>(context: StrategyContext): Promise<StrategyResult<T>> {
    const response = await this.requestEngine.execute<T>(context.request);
    if (context.tags) {
      await this.cacheEngine.set(context.cacheKey, response.data, context.tags);
    }
    return {
      data: response.data,
      fromCache: false,
      latency: response.latency,
    };
  }

  private async cacheFirst<T>(context: StrategyContext): Promise<StrategyResult<T>> {
    const cached = await this.cacheEngine.get<T>(context.cacheKey);
    if (cached !== null) {
      return {
        data: cached,
        fromCache: true,
        latency: 0,
      };
    }
    const response = await this.requestEngine.execute<T>(context.request);
    if (context.tags) {
      await this.cacheEngine.set(context.cacheKey, response.data, context.tags);
    }
    return {
      data: response.data,
      fromCache: false,
      latency: response.latency,
    };
  }

  private async networkFirst<T>(context: StrategyContext): Promise<StrategyResult<T>> {
    try {
      const response = await this.requestEngine.execute<T>(context.request);
      if (context.tags) {
        await this.cacheEngine.set(context.cacheKey, response.data, context.tags);
      }
      return {
        data: response.data,
        fromCache: false,
        latency: response.latency,
      };
    } catch (error) {
      const cached = await this.cacheEngine.get<T>(context.cacheKey);
      if (cached !== null) {
        // this.eventBus.emit('cache:fallback', { key: context.cacheKey, error });
        
        // Replace with console log
        console.debug(`Cache fallback for key: ${context.cacheKey}`, error);
        return {
          data: cached,
          fromCache: true,
          latency: 0,
        };
      }
      throw error;
    }
  }

  private async staleWhileRevalidate<T>(context: StrategyContext): Promise<StrategyResult<T>> {
    const cached = await this.cacheEngine.get<T>(context.cacheKey);
    
    // Start revalidation in background
    const revalidatePromise = this.requestEngine.execute<T>(context.request)
      .then(async response => {
        if (context.tags) {
          await this.cacheEngine.set(context.cacheKey, response.data, context.tags);
        }
        return response.data;
      })
      .catch(() => null);
    
    if (cached !== null) {
      // Return stale data immediately, revalidate in background
      revalidatePromise.catch(() => {});
      return {
        data: cached,
        fromCache: true,
        latency: 0,
      };
    }
    
    // No cache, wait for network
    const freshData = await revalidatePromise;
    if (freshData === null) {
      throw new Error(`No data available for key: ${context.cacheKey}`);
    }
    return {
      data: freshData as T,
      fromCache: false,
      latency: 0,
    };
  }
}

export function getDefaultStrategy(strategy?: CacheStrategy): CacheStrategy {
  return strategy || 'network-first';
}

export function createCustomStrategy<T>(
  handler: (context: StrategyContext, next: () => Promise<StrategyResult<T>>) => Promise<StrategyResult<T>>
): (context: StrategyContext) => Promise<StrategyResult<T>> {
  return async (context: StrategyContext) => {
    let nextCalled = false;
    const next = async (): Promise<StrategyResult<T>> => {
      nextCalled = true;
      // Default fallback to network-first
      const engine = null as any; // This would need actual engine reference
      throw new Error('Custom strategy must implement its own logic or call next with a default');
    };
    const result = await handler(context, next);
    if (!nextCalled) {
      return result;
    }
    throw new Error('Custom strategy next() called but not implemented');
  };
}
