import { LaglessConfig } from '../types';
import { environmentDetection, deepMerge } from '../utils';
import { ValidationError } from '../errors';

const defaultConfig: LaglessConfig = {
  request: {
    timeout: 30000,
    retryPolicy: {
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2,
      jitter: true,
      retryCondition: (error: Error) => {
        const isNetworkError = error.message.includes('fetch') || error.message.includes('network');
        const isTimeoutError = error.message.includes('timeout');
        const isServerError = error.message.includes('500') || error.message.includes('502') || error.message.includes('503');
        return isNetworkError || isTimeoutError || isServerError;
      },
    },
    defaultStrategy: 'network-first',
    interceptors: {
      request: [],
      response: [],
    },
  },
  cache: {
    maxSize: 100 * 1024 * 1024,
    defaultTTL: 5 * 60 * 1000,
    enabled: true,
    lru: true,
  },
  storage: {
    prefix: 'lagless',
    version: 1,
    migrations: {},
  },
  offline: {
    enabled: true,
    queuePersistence: true,
    maxQueueSize: 1000,
  },
  sync: {
    enabled: true,
    strategies: ['background', 'reconnect', 'visibility', 'focus'],
    interval: 30000,
    onChange: true,
  },
  metrics: {
    enabled: true,
    sampleRate: 1.0,
    exporters: [],
  },
  dedup: {
    enabled: true,
    ttl: 5000,
  },
  plugins: [],
  debug: false,
  environment: environmentDetection(),
};

export class ConfigManager {
  private config: LaglessConfig;
  private listeners: Set<(config: LaglessConfig) => void> = new Set();

  constructor(initialConfig?: Partial<LaglessConfig>) {
    this.config = deepMerge(defaultConfig as Record<string, unknown>, (initialConfig || {}) as Record<string, unknown>) as LaglessConfig;
    this.validate();
  }

  private validate(): void {
    if (this.config.cache?.maxSize !== undefined && this.config.cache.maxSize < 0) {
      throw new ValidationError('cache.maxSize must be non-negative');
    }
    if (this.config.cache?.defaultTTL !== undefined && this.config.cache.defaultTTL < 0) {
      throw new ValidationError('cache.defaultTTL must be non-negative');
    }
    if (this.config.request?.timeout !== undefined && this.config.request.timeout <= 0) {
      throw new ValidationError('request.timeout must be positive');
    }
    if (this.config.offline?.maxQueueSize !== undefined && this.config.offline.maxQueueSize <= 0) {
      throw new ValidationError('offline.maxQueueSize must be positive');
    }
    if (this.config.metrics?.sampleRate !== undefined && (this.config.metrics.sampleRate <= 0 || this.config.metrics.sampleRate > 1)) {
      throw new ValidationError('metrics.sampleRate must be between 0 and 1');
    }
    if (this.config.dedup?.ttl !== undefined && this.config.dedup.ttl < 0) {
      throw new ValidationError('dedup.ttl must be non-negative');
    }
  }

  public get<K extends keyof LaglessConfig>(key: K): LaglessConfig[K] {
    return this.config[key];
  }

  public getFull(): LaglessConfig {
    return deepClone(this.config);
  }

  public set<K extends keyof LaglessConfig>(key: K, value: LaglessConfig[K]): void {
    this.config[key] = deepClone(value) as LaglessConfig[K];
    this.validate();
    this.notifyListeners();
  }

  public update(partial: Partial<LaglessConfig>): void {
    this.config = deepMerge(this.config as Record<string, unknown>, partial as Record<string, unknown>) as LaglessConfig;
    this.validate();
    this.notifyListeners();
  }

  public subscribe(listener: (config: LaglessConfig) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    const snapshot = this.getFull();
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch {
        // Ignore listener errors
      }
    }
  }
}

function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime()) as T;
  if (Array.isArray(obj)) return obj.map(item => deepClone(item)) as T;
  const cloned: Record<string, unknown> = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      cloned[key] = deepClone((obj as Record<string, unknown>)[key]);
    }
  }
  return cloned as T;
}
