export type Primitive = string | number | boolean | null | undefined;
export type JSONValue = Primitive | JSONObject | JSONArray;
export interface JSONObject {
  [key: string]: JSONValue;
}
export type JSONArray = JSONValue[];

export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export type CacheStrategy = 'network-first' | 'cache-first' | 'cache-only' | 'network-only' | 'stale-while-revalidate';

export type SyncStrategy = 'background' | 'reconnect' | 'visibility' | 'focus' | 'manual';

export type RetryPolicy = {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitter: boolean;
  retryCondition?: (error: Error) => boolean;
};

export type RequestOptions<T = unknown> = {
  url: string;
  method?: HTTPMethod;
  headers?: Record<string, string>;
  body?: unknown;
  signal?: AbortSignal;
  cacheKey?: string;
  strategy?: CacheStrategy;
  retryPolicy?: Partial<RetryPolicy>;
  timeout?: number;
  tags?: string[];
  priority?: number;
  metadata?: Record<string, unknown>;
};

export type RequestResponse<T = unknown> = {
  data: T;
  status: number;
  statusText: string;
  headers: Headers;
  fromCache: boolean;
  fromDedup: boolean;
  latency: number;
  timestamp: number;
};

export type CacheEntry<T = unknown> = {
  key: string;
  value: T;
  tags: string[];
  createdAt: number;
  accessedAt: number;
  expiresAt: number | null;
  size: number;
};

export type StorageAdapter = {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  has(key: string): Promise<boolean>;
  keys(): Promise<string[]>;
};

export type EventListener = (...args: unknown[]) => void | Promise<void>;

export type EventMap = {
  'request:start': { url: string; method: string };
  'request:end': { url: string; method: string; latency: number };
  'request:error': { url: string; method: string; error: Error };
  'cache:hit': { key: string; tags: string[] };
  'cache:miss': { key: string };
  'cache:set': { key: string; tags: string[] };
  'cache:evict': { key: string; reason: string };
  'cache:invalidate': { key: string; tags: string[] };
  'cache:delete': { key: string };  // Add this
  'cache:clear': {};  // Add this
  'storage:set': { key: string };
  'storage:get': { key: string };
  'storage:delete': { key: string };
  'storage:clear': { keys?: string[] };
  'offline:detected': { timestamp: number };
  'offline:reconnected': { timestamp: number; duration: number };
  'queue:add': { operation: QueuedOperation };
  'queue:process': { operation: QueuedOperation };
  'queue:success': { operation: QueuedOperation };
  'queue:retry': { operation: QueuedOperation; attempt: number };
  'queue:fail': { operation: QueuedOperation; error: Error };
  'sync:start': { strategy: string };
  'sync:end': { strategy: string; operationsProcessed: number };
  'sync:error': { strategy: string; error: Error };
  'dedup:hit': { key: string; activeCount: number };
  'dedup:new': { key: string };
  'retry:attempt': { key: string; attempt: number; maxAttempts: number };
  'retry:success': { key: string; attempt: number };
  'retry:exhausted': { key: string; attempts: number; error: Error };
  'metric:record': { name: string; value: number; tags?: Record<string, string> };

  // Add plugin events
  'plugin:registered': { name: string; version: string };
  'plugin:unregistered': { name: string };
  'plugin:error': { pluginName: string; hook: string; error: Error };
};

export type MetricsSnapshot = {
  cacheHits: number;
  cacheMisses: number;
  networkCalls: number;
  dedupHits: number;
  retries: number;
  queueSize: number;
  syncEvents: number;
  averageLatency: number;
  evictionCount: number;
  timestamps: {
    start: number;
    end: number;
  };
};

export interface QueuedOperation {
  id: string;
  url: string;
  method: HTTPMethod;
  headers?: Record<string, string>;
  body?: unknown;
  timestamp: number;
  attempts: number;
  maxAttempts: number;
  retryUntil: number;
  metadata?: Record<string, unknown>;
}

export type PluginHook = 'beforeRequest' | 'afterRequest' | 'beforeCache' | 'afterCache' | 'beforeSync' | 'afterSync' | 'beforeStorage' | 'afterStorage';

export interface Plugin {
  name: string;
  version: string;
  hooks?: Partial<Record<PluginHook, (context: unknown) => Promise<unknown> | unknown>>;
  setup?: (core: unknown) => void | Promise<void>;
  teardown?: () => void | Promise<void>;
}

export type LaglessConfig = {
  request?: {
    timeout?: number;
    retryPolicy?: Partial<RetryPolicy>;
    defaultStrategy?: CacheStrategy;
    interceptors?: {
      request?: ((options: RequestOptions) => RequestOptions | Promise<RequestOptions>)[];
      response?: ((response: RequestResponse) => RequestResponse | Promise<RequestResponse>)[];
    };
  };
  cache?: {
    maxSize?: number;
    defaultTTL?: number;
    enabled?: boolean;
    lru?: boolean;
  };
  storage?: {
    adapter?: StorageAdapter;
    prefix?: string;
    version?: number;
    migrations?: Record<number, (data: unknown) => unknown>;
    encryption?: {
      encrypt: (data: string) => Promise<string>;
      decrypt: (data: string) => Promise<string>;
    };
    compression?: {
      compress: (data: unknown) => Promise<Uint8Array>;
      decompress: (data: Uint8Array) => Promise<unknown>;
    };
  };
  offline?: {
    enabled?: boolean;
    queuePersistence?: boolean;
    maxQueueSize?: number;
  };
  sync?: {
    enabled?: boolean;
    strategies?: SyncStrategy[];
    interval?: number;
    onChange?: boolean;
  };
  metrics?: {
    enabled?: boolean;
    sampleRate?: number;
    exporters?: Array<(snapshot: MetricsSnapshot) => void>;
  };
  dedup?: {
    enabled?: boolean;
    ttl?: number;
  };
  plugins?: Plugin[];
  debug?: boolean;
  environment?: 'browser' | 'node' | 'edge' | 'unknown';
};
