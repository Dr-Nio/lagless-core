import { LaglessConfig, MetricsSnapshot, RequestResponse, RequestOptions } from './types';
import { ConfigManager } from './config';
import { EventBus } from './events';
import { MetricsEngine } from './metrics';
import { CacheEngine } from './core/cache';
import { StorageEngine } from './core/storage';
import { RequestEngine } from './core/request';
import { OfflineEngine } from './offline';
import { QueueEngine } from './queue';
import { SyncEngine } from './sync';
import { DedupEngine } from './dedup';
import { RetryEngine } from './retry';
import { SubscriptionEngine } from './subscriptions';
import { PluginManager, createLoggerPlugin, createMetricsPlugin, Plugin } from './plugins';
import { StrategyEngine } from './strategies';
import { environmentDetection } from './utils';

export interface LaglessClient {
  // Core APIs
  request: RequestEngine['execute'];
  cache: CacheEngine;
  storage: StorageEngine;
  offline: OfflineEngine;
  queue: QueueEngine;
  sync: SyncEngine;
  subscriptions: SubscriptionEngine;
  metrics: MetricsEngine;
  events: EventBus;
  plugins: PluginManager;
  strategies: StrategyEngine;
  config: ConfigManager;
  
  // Utility methods
  invalidate(tag: string): Promise<number>;
  invalidateTags(tags: string[]): Promise<number>;
  getMetricsSnapshot(): MetricsSnapshot;
  destroy(): void;
}

export function createLagless(config?: Partial<LaglessConfig>): LaglessClient {
  // Initialize config
  const configManager = new ConfigManager(config);
  const finalConfig = configManager.getFull();
  
  // Initialize event bus first
  const eventBus = new EventBus();
  
  // Initialize metrics
  const metrics = new MetricsEngine(eventBus, finalConfig.metrics);
  
  // Initialize storage
  const storage = new StorageEngine(eventBus, configManager);
  
  // Initialize cache
  const cache = new CacheEngine(eventBus, metrics, configManager);
  
  // Initialize retry engine
  const retry = new RetryEngine(eventBus);
  
  // Initialize dedup engine
  const dedup = new DedupEngine(eventBus, metrics, finalConfig.dedup?.ttl ?? 5000);
  
  // Initialize request engine
  const request = new RequestEngine(eventBus, metrics, dedup, retry, configManager);
  
  // Initialize offline engine
  const offline = new OfflineEngine(eventBus, storage, configManager);
  
  // Initialize queue engine
  const queue = new QueueEngine(eventBus, storage, request, offline, configManager);
  
  // Initialize sync engine
  const sync = new SyncEngine(eventBus, offline, queue, configManager);
  
  // Initialize subscription engine
  const subscriptions = new SubscriptionEngine(eventBus);
  
  // Initialize plugin manager
  const plugins = new PluginManager(eventBus);
  
  // Register default plugins if debug enabled
  if (finalConfig.debug) {
    plugins.register(createLoggerPlugin({ logLevel: 'debug' }));
  }
  if (finalConfig.metrics?.exporters && finalConfig.metrics.exporters.length > 0) {
    plugins.register(createMetricsPlugin());
  }
  
  // Register user plugins
  if (finalConfig.plugins) {
    for (const plugin of finalConfig.plugins) {
      plugins.register(plugin);
    }
  }
  
  // Initialize strategy engine
  const strategies = new StrategyEngine(cache, request, eventBus);
  
  // Wrap request to apply strategies
  const requestWithStrategy: RequestEngine['execute'] = async <T>(options: RequestOptions<T>) => {
    const strategy = options.strategy || finalConfig.request?.defaultStrategy || 'network-first';
    const cacheKey = options.cacheKey || (options.url + (options.method || 'GET'));
    
    // Build strategy context without undefined values
    const strategyContext: any = {
      request: options,
      cacheKey,
    };
    
    // Only add tags if defined
    if (options.tags !== undefined) {
      strategyContext.tags = options.tags;
    }
    
    const result = await strategies.execute<T>(strategyContext, strategy);
    
    // Update subscription cache
    subscriptions.setData(cacheKey, result.data);
    
    return {
      data: result.data,
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      fromCache: result.fromCache,
      fromDedup: false,
      latency: result.latency,
      timestamp: Date.now(),
    } as RequestResponse<T>;
  };
  
  return {
    request: requestWithStrategy,
    cache,
    storage,
    offline,
    queue,
    sync,
    subscriptions,
    metrics,
    events: eventBus,
    plugins,
    strategies,
    config: configManager,
    
    invalidate: async (tag: string) => {
      return cache.invalidate(tag);
    },
    
    invalidateTags: async (tags: string[]) => {
      return cache.invalidateTags(tags);
    },
    
    getMetricsSnapshot: () => {
      return metrics.getSnapshot();
    },
    
    destroy: () => {
      sync.destroy();
      offline.destroy();
      dedup.destroy();
      metrics.destroy();
      plugins.clear();
      subscriptions.unsubscribeAll();
      subscriptions.clearData();
      eventBus.removeAllListeners();
    },
  };
}

export const createClient = createLagless;

export function createRequest() {
  // Factory for request engine creation (for advanced use)
  const eventBus = new EventBus();
  const metrics = new MetricsEngine(eventBus, { enabled: true });
  const config = new ConfigManager();
  const retry = new RetryEngine(eventBus);
  const dedup = new DedupEngine(eventBus, metrics);
  return new RequestEngine(eventBus, metrics, dedup, retry, config);
}

export function createCache() {
  const eventBus = new EventBus();
  const metrics = new MetricsEngine(eventBus, { enabled: true });
  const config = new ConfigManager();
  return new CacheEngine(eventBus, metrics, config);
}

export function createStorage() {
  const eventBus = new EventBus();
  const config = new ConfigManager();
  return new StorageEngine(eventBus, config);
}

export function createOfflineEngine() {
  const eventBus = new EventBus();
  const config = new ConfigManager();
  const storage = new StorageEngine(eventBus, config);
  return new OfflineEngine(eventBus, storage, config);
}

export function createSyncEngine() {
  const eventBus = new EventBus();
  const config = new ConfigManager();
  const storage = new StorageEngine(eventBus, config);
  const offline = new OfflineEngine(eventBus, storage, config);
  const metrics = new MetricsEngine(eventBus, { enabled: true });
  const retry = new RetryEngine(eventBus);
  const dedup = new DedupEngine(eventBus, metrics);
  const request = new RequestEngine(eventBus, metrics, dedup, retry, config);
  const queue = new QueueEngine(eventBus, storage, request, offline, config);
  return new SyncEngine(eventBus, offline, queue, config);
}

export function createQueue() {
  const eventBus = new EventBus();
  const config = new ConfigManager();
  const storage = new StorageEngine(eventBus, config);
  const metrics = new MetricsEngine(eventBus, { enabled: true });
  const retry = new RetryEngine(eventBus);
  const dedup = new DedupEngine(eventBus, metrics);
  const request = new RequestEngine(eventBus, metrics, dedup, retry, config);
  const offline = new OfflineEngine(eventBus, storage, config);
  return new QueueEngine(eventBus, storage, request, offline, config);
}

export function createMetrics() {
  const eventBus = new EventBus();
  return new MetricsEngine(eventBus, { enabled: true });
}

export function createEventBus() {
  return new EventBus();
}

export function registerPlugin(client: LaglessClient, plugin: Plugin) {
  client.plugins.register(plugin);
}
