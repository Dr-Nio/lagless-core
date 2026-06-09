import { EventBus } from '../events';
import { generateId } from '../utils';

export type SubscriptionCallback<T = unknown> = (data: T, oldData?: T) => void | Promise<void>;

export interface Subscription<T = unknown> {
  id: string;
  key: string;
  callback: SubscriptionCallback<T>;
  once: boolean;
  filter?: (data: T) => boolean;
}

export interface SubscriptionOptions<T = unknown> {
  once?: boolean;
  filter?: (data: T) => boolean;
}

export class SubscriptionEngine {
  private subscriptions: Map<string, Set<Subscription>> = new Map();
  private namespaceMap: Map<string, Set<string>> = new Map(); // namespace -> keys
  private dataCache: Map<string, unknown> = new Map();

  constructor(private eventBus: EventBus) {
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Listen to cache events to trigger subscriptions
    this.eventBus.on('cache:set', (payload: { key: string; tags: string[] }) => {
      const data = this.dataCache.get(payload.key);
      if (data !== undefined) {
        this.notify(payload.key, data, undefined, { source: 'cache' });
      }
    });

    // Listen to cache:invalidate events instead of cache:update
    this.eventBus.on('cache:invalidate', (payload: { key: string; tags: string[] }) => {
      const oldData = this.dataCache.get(payload.key);
      this.dataCache.delete(payload.key);
      if (oldData !== undefined) {
        this.notify(payload.key, null, oldData, { deleted: true });
      }
    });

    this.eventBus.on('sync:end', () => {
      // Trigger refresh notifications for all subscribed keys
      for (const key of this.dataCache.keys()) {
        const data = this.dataCache.get(key);
        if (data !== undefined) {
          this.notify(key, data);
        }
      }
    });
  }

  subscribe<T = unknown>(
    key: string,
    callback: SubscriptionCallback<T>,
    options?: SubscriptionOptions<T>
  ): () => void {
    const subscription: Partial<Subscription<T>> = {
      id: generateId(),
      key,
      callback: callback as SubscriptionCallback,
      once: options?.once ?? false,
    };
    
    // Only add filter if defined
    if (options?.filter !== undefined) {
      subscription.filter = options.filter;
    }

    if (!this.subscriptions.has(key)) {
      this.subscriptions.set(key, new Set());
    }
    this.subscriptions.get(key)!.add(subscription as Subscription);

    // Update namespace map (extract namespace from key: "user:123" -> namespace "user")
    const namespace = this.extractNamespace(key);
    if (!this.namespaceMap.has(namespace)) {
      this.namespaceMap.set(namespace, new Set());
    }
    this.namespaceMap.get(namespace)!.add(key);

    // Return unsubscribe function
    return () => {
      const subs = this.subscriptions.get(key);
      if (subs) {
        subs.delete(subscription as Subscription);
        if (subs.size === 0) {
          this.subscriptions.delete(key);
        }
      }
    };
  }

  subscribeToNamespace<T = unknown>(
    namespace: string,
    callback: SubscriptionCallback<Record<string, T>>,
    options?: SubscriptionOptions<Record<string, T>>
  ): () => void {
    const keysInNamespace = this.namespaceMap.get(namespace) || new Set();
    const aggregatedData: Record<string, T> = {};

    for (const key of keysInNamespace) {
      const data = this.dataCache.get(key) as T;
      if (data !== undefined) {
        aggregatedData[key] = data;
      }
    }

    const namespaceCallback = async (data: Record<string, T>, oldData?: Record<string, T>) => {
      await callback(data, oldData);
    };

    // Subscribe to all keys in namespace
    const unsubscribers: Array<() => void> = [];
    for (const key of keysInNamespace) {
      const unsub = this.subscribe(key, () => {
        // Re-aggregate on any change
        const newAggregated: Record<string, T> = {};
        for (const k of keysInNamespace) {
          const val = this.dataCache.get(k) as T;
          if (val !== undefined) newAggregated[k] = val;
        }
        namespaceCallback(newAggregated, aggregatedData).catch(() => {});
      }, options as SubscriptionOptions<unknown>);
      unsubscribers.push(unsub);
    }

    // Also listen for new keys added to namespace
    const namespaceListener = (payload: { key: string; tags: string[] }) => {
      if (this.extractNamespace(payload.key) === namespace) {
        const newUnsub = this.subscribe(payload.key, () => {
          const newAggregated: Record<string, T> = {};
          for (const k of this.namespaceMap.get(namespace) || []) {
            const val = this.dataCache.get(k) as T;
            if (val !== undefined) newAggregated[k] = val;
          }
          namespaceCallback(newAggregated, aggregatedData).catch(() => {});
        }, options as SubscriptionOptions<unknown>);
        unsubscribers.push(newUnsub);
      }
    };

    this.eventBus.on('cache:set', namespaceListener);

    return () => {
      for (const unsub of unsubscribers) {
        unsub();
      }
      this.eventBus.off('cache:set', namespaceListener);
    };
  }

  subscribeToPattern<T = unknown>(
    pattern: RegExp,
    callback: SubscriptionCallback<{ key: string; value: T }>,
    options?: SubscriptionOptions<{ key: string; value: T }>
  ): () => void {
    const matchingKeys = Array.from(this.subscriptions.keys()).filter(key => pattern.test(key));
    const unsubscribers: Array<() => void> = [];

    for (const key of matchingKeys) {
      const unsub = this.subscribe(key, (value: T) => {
        const result = callback({ key, value });
        if (result && typeof (result as Promise<void>).catch === 'function') {
          result.catch(() => {});
        }
      }, options as SubscriptionOptions<unknown>);
      unsubscribers.push(unsub);
    }

    // Listen for new keys that match pattern
    const patternListener = (payload: { key: string; tags: string[] }) => {
      if (pattern.test(payload.key)) {
        const newUnsub = this.subscribe(payload.key, (value: T) => {
          const result = callback({ key: payload.key, value });
          if (result && typeof (result as Promise<void>).catch === 'function') {
            result.catch(() => {});
          }
        }, options as SubscriptionOptions<unknown>);
        unsubscribers.push(newUnsub);
      }
    };

    this.eventBus.on('cache:set', patternListener);

    return () => {
      for (const unsub of unsubscribers) {
        unsub();
      }
      this.eventBus.off('cache:set', patternListener);
    };
  }

  private async notify<T>(
    key: string,
    data: T,
    oldData?: T,
    meta?: { source?: string; deleted?: boolean }
  ): Promise<void> {
    const subscriptions = this.subscriptions.get(key);
    if (!subscriptions) return;

    if (data !== undefined && data !== null) {
      this.dataCache.set(key, data);
    } else if (meta?.deleted) {
      this.dataCache.delete(key);
    }

    const toRemove: Subscription[] = [];

    for (const sub of subscriptions) {
      if (sub.filter && !sub.filter(data)) {
        continue;
      }

      try {
        const result = sub.callback(data, oldData);
        // Handle both sync and async callbacks
        if (result instanceof Promise) {
          await result;
        }
        if (sub.once) {
          toRemove.push(sub);
        }
      } catch {
        // Ignore callback errors
      }
    }

    // Remove once subscriptions
    for (const sub of toRemove) {
      const subs = this.subscriptions.get(key);
      if (subs) {
        subs.delete(sub);
        if (subs.size === 0) {
          this.subscriptions.delete(key);
        }
      }
    }
  }

  private extractNamespace(key: string): string {
    const parts = key.split(':');
    return parts[0] || 'default';
  }

  unsubscribe(key: string, callback?: SubscriptionCallback): void {
    if (callback) {
      const subs = this.subscriptions.get(key);
      if (subs) {
        for (const sub of subs) {
          if (sub.callback === callback) {
            subs.delete(sub);
            break;
          }
        }
        if (subs.size === 0) {
          this.subscriptions.delete(key);
        }
      }
    } else {
      this.subscriptions.delete(key);
    }
  }

  unsubscribeAll(): void {
    this.subscriptions.clear();
    this.namespaceMap.clear();
  }

  getSubscriberCount(key?: string): number {
    if (key) {
      return this.subscriptions.get(key)?.size ?? 0;
    }
    let total = 0;
    for (const subs of this.subscriptions.values()) {
      total += subs.size;
    }
    return total;
  }

  getActiveKeys(): string[] {
    return Array.from(this.subscriptions.keys());
  }

  getData<T = unknown>(key: string): T | undefined {
    return this.dataCache.get(key) as T | undefined;
  }

  setData<T = unknown>(key: string, data: T): void {
    const oldData = this.dataCache.get(key);
    this.dataCache.set(key, data);
    this.notify(key, data, oldData).catch(() => {});
  }

  clearData(): void {
    this.dataCache.clear();
  }
}
