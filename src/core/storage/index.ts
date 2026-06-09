import { StorageAdapter, LaglessConfig } from '../../types';
import { StorageError } from '../../errors';
import { EventBus } from '../../events';
import { safeSerialize, safeDeserialize, environmentDetection } from '../../utils';
import { ConfigManager } from '../../config';

interface StoredValue {
  data: unknown;
  version: number;
  timestamp: number;
  ttl?: number;
}

export class StorageEngine {
  private adapter: StorageAdapter;
  private prefix: string;
  private version: number;
  private migrations: Record<number, (data: unknown) => unknown>;

  constructor(
    private eventBus: EventBus,
    private config: ConfigManager
  ) {
    const storageConfig = this.config.get('storage');
    this.adapter = storageConfig?.adapter || this.createDefaultAdapter();
    this.prefix = storageConfig?.prefix || 'lagless';
    this.version = storageConfig?.version || 1;
    this.migrations = storageConfig?.migrations || {};
    
    this.initialize();
  }

  private createDefaultAdapter(): StorageAdapter {
    const env = environmentDetection();
    
    if (env === 'browser' && typeof indexedDB !== 'undefined') {
      return this.createIndexedDBAdapter();
    }
    
    if (typeof localStorage !== 'undefined') {
      return this.createLocalStorageAdapter();
    }
    
    return this.createMemoryAdapter();
  }

  private createIndexedDBAdapter(): StorageAdapter {
    const dbName = `${this.prefix}_db`;
    let db: IDBDatabase | null = null;
    const requestPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const openRequest = indexedDB.open(dbName, 1);
      openRequest.onerror = () => reject(new StorageError('Failed to open IndexedDB'));
      openRequest.onsuccess = () => {
        db = openRequest.result;
        resolve(db);
      };
      openRequest.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('lagless_store')) {
          db.createObjectStore('lagless_store');
        }
      };
    });

    return {
      get: async <T>(key: string): Promise<T | null> => {
        const database = await requestPromise;
        return new Promise((resolve, reject) => {
          const transaction = database.transaction(['lagless_store'], 'readonly');
          const store = transaction.objectStore('lagless_store');
          const request = store.get(key);
          request.onsuccess = () => {
            const value = request.result as StoredValue | undefined;
            if (!value) {
              resolve(null);
              return;
            }
            if (value.ttl && Date.now() > value.timestamp + value.ttl) {
              this.delete(key).catch(() => {});
              resolve(null);
              return;
            }
            resolve(value.data as T);
          };
          request.onerror = () => reject(new StorageError(`Failed to get key: ${key}`));
        });
      },
      set: async <T>(key: string, value: T, ttl?: number): Promise<void> => {
        const database = await requestPromise;
        return new Promise((resolve, reject) => {
          const transaction = database.transaction(['lagless_store'], 'readwrite');
          const store = transaction.objectStore('lagless_store');
          const storedValue: StoredValue = {
            data: value,
            version: this.version,
            timestamp: Date.now(),
          };
          // Only add ttl if it's defined
          if (ttl !== undefined) {
            storedValue.ttl = ttl;
          }
          const request = store.put(storedValue, key);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(new StorageError(`Failed to set key: ${key}`));
        });
      },
      delete: async (key: string): Promise<void> => {
        const database = await requestPromise;
        return new Promise((resolve, reject) => {
          const transaction = database.transaction(['lagless_store'], 'readwrite');
          const store = transaction.objectStore('lagless_store');
          const request = store.delete(key);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(new StorageError(`Failed to delete key: ${key}`));
        });
      },
      clear: async (): Promise<void> => {
        const database = await requestPromise;
        return new Promise((resolve, reject) => {
          const transaction = database.transaction(['lagless_store'], 'readwrite');
          const store = transaction.objectStore('lagless_store');
          const request = store.clear();
          request.onsuccess = () => resolve();
          request.onerror = () => reject(new StorageError('Failed to clear store'));
        });
      },
      has: async (key: string): Promise<boolean> => {
        const value = await this.get(key);
        return value !== null;
      },
      keys: async (): Promise<string[]> => {
        const database = await requestPromise;
        return new Promise((resolve, reject) => {
          const transaction = database.transaction(['lagless_store'], 'readonly');
          const store = transaction.objectStore('lagless_store');
          const request = store.getAllKeys();
          request.onsuccess = () => resolve(request.result as string[]);
          request.onerror = () => reject(new StorageError('Failed to get keys'));
        });
      },
    };
  }

  private createLocalStorageAdapter(): StorageAdapter {
    return {
      get: async <T>(key: string): Promise<T | null> => {
        const fullKey = `${this.prefix}_${key}`;
        const raw = localStorage.getItem(fullKey);
        if (!raw) return null;
        const value = safeDeserialize<StoredValue>(raw);
        if (!value) return null;
        if (value.ttl && Date.now() > value.timestamp + value.ttl) {
          await this.delete(key);
          return null;
        }
        return value.data as T;
      },
      set: async <T>(key: string, value: T, ttl?: number): Promise<void> => {
        const fullKey = `${this.prefix}_${key}`;
        const storedValue: StoredValue = {
          data: value,
          version: this.version,
          timestamp: Date.now(),
        };
        // Only add ttl if it's defined
        if (ttl !== undefined) {
          storedValue.ttl = ttl;
        }
        const serialized = safeSerialize(storedValue);
        if (!serialized) throw new StorageError(`Failed to serialize value for key: ${key}`);
        localStorage.setItem(fullKey, serialized);
      },
      delete: async (key: string): Promise<void> => {
        const fullKey = `${this.prefix}_${key}`;
        localStorage.removeItem(fullKey);
      },
      clear: async (): Promise<void> => {
        const keys = Object.keys(localStorage);
        for (const key of keys) {
          if (key.startsWith(`${this.prefix}_`)) {
            localStorage.removeItem(key);
          }
        }
      },
      has: async (key: string): Promise<boolean> => {
        const fullKey = `${this.prefix}_${key}`;
        return localStorage.getItem(fullKey) !== null;
      },
      keys: async (): Promise<string[]> => {
        const keys: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(`${this.prefix}_`)) {
            keys.push(key.slice(this.prefix.length + 1));
          }
        }
        return keys;
      },
    };
  }

  private createMemoryAdapter(): StorageAdapter {
    const store = new Map<string, StoredValue>();
    return {
      get: async <T>(key: string): Promise<T | null> => {
        const value = store.get(key);
        if (!value) return null;
        if (value.ttl && Date.now() > value.timestamp + value.ttl) {
          store.delete(key);
          return null;
        }
        return value.data as T;
      },
      set: async <T>(key: string, value: T, ttl?: number): Promise<void> => {
        const storedValue: StoredValue = {
          data: value,
          version: this.version,
          timestamp: Date.now(),
        };
        // Only add ttl if it's defined
        if (ttl !== undefined) {
          storedValue.ttl = ttl;
        }
        store.set(key, storedValue);
      },
      delete: async (key: string): Promise<void> => {
        store.delete(key);
      },
      clear: async (): Promise<void> => {
        store.clear();
      },
      has: async (key: string): Promise<boolean> => {
        return store.has(key);
      },
      keys: async (): Promise<string[]> => {
        return Array.from(store.keys());
      },
    };
  }

  private async initialize(): Promise<void> {
    try {
      const currentVersion = await this.getVersion();
      if (currentVersion < this.version) {
        await this.runMigrations(currentVersion, this.version);
        await this.setVersion(this.version);
      }
    } catch (error) {
      console.warn('Storage initialization failed:', error);
    }
  }

  private async getVersion(): Promise<number> {
    const version = await this.adapter.get<number>('__version__');
    return version ?? 0;
  }

  private async setVersion(version: number): Promise<void> {
    await this.adapter.set('__version__', version);
  }

  private async runMigrations(fromVersion: number, toVersion: number): Promise<void> {
    const allKeys = await this.adapter.keys();
    for (let v = fromVersion + 1; v <= toVersion; v++) {
      const migration = this.migrations[v];
      if (migration) {
        for (const key of allKeys) {
          if (key === '__version__') continue;
          const value = await this.adapter.get(key);
          if (value !== null) {
            const migrated = migration(value);
            await this.adapter.set(key, migrated);
          }
        }
      }
    }
  }

  async get<T>(key: string): Promise<T | null> {
    this.eventBus.emit('storage:get', { key });
    const encryption = this.config.get('storage')?.encryption;
    const rawData = await this.adapter.get<T>(key);
    
    if (!rawData) {
      return null;
    }
    
    if (encryption) {
      try {
        const decrypted = await encryption.decrypt(rawData as string);
        const deserialized = safeDeserialize(decrypted) as T;
        return deserialized;
      } catch (error) {
        throw new StorageError(`Decryption failed for key: ${key}`, { error });
      }
    }
    
    return rawData;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    this.eventBus.emit('storage:set', { key });
    const encryption = this.config.get('storage')?.encryption;
    const compression = this.config.get('storage')?.compression;
    
    let data = value;
    if (compression) {
      const serialized = safeSerialize(data);
      if (serialized) {
        const compressed = await compression.compress(serialized);
        data = compressed as unknown as T;
      }
    }
    
    if (encryption) {
      const serialized = safeSerialize(data);
      if (serialized) {
        const encrypted = await encryption.encrypt(serialized);
        data = encrypted as unknown as T;
      }
    }
    
    await this.adapter.set(key, data, ttl);
  }

  async delete(key: string): Promise<void> {
    this.eventBus.emit('storage:delete', { key });
    await this.adapter.delete(key);
  }

  async clear(): Promise<void> {
    this.eventBus.emit('storage:clear', {});
    await this.adapter.clear();
  }

  async has(key: string): Promise<boolean> {
    return this.adapter.has(key);
  }

  async keys(): Promise<string[]> {
    const allKeys = await this.adapter.keys();
    return allKeys.filter(k => k !== '__version__');
  }

  async getMany<T>(keys: string[]): Promise<Record<string, T>> {
    const results: Record<string, T> = {};
    for (const key of keys) {
      const value = await this.get<T>(key);
      if (value !== null) {
        results[key] = value;
      }
    }
    return results;
  }

  async setMany(items: Record<string, unknown>, ttl?: number): Promise<void> {
    for (const [key, value] of Object.entries(items)) {
      await this.set(key, value, ttl);
    }
  }

  async deleteMany(keys: string[]): Promise<void> {
    for (const key of keys) {
      await this.delete(key);
    }
  }

  async getSize(): Promise<number> {
    const keys = await this.keys();
    let total = 0;
    for (const key of keys) {
      const value = await this.get(key);
      if (value !== null) {
        const serialized = safeSerialize(value);
        if (serialized) total += new Blob([serialized]).size;
      }
    }
    return total;
  }
}
