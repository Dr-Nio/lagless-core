import { EventBus } from '../events';
import { StorageEngine } from '../core/storage';
import { ConfigManager } from '../config';
import { OfflineError } from '../errors';
import { generateId } from '../utils';

export type OfflineStatus = 'online' | 'offline' | 'connecting';

export interface OfflineListener {
  (status: OfflineStatus, previousStatus: OfflineStatus): void;
}

export class OfflineEngine {
  private status: OfflineStatus = 'online';
  private listeners: Set<OfflineListener> = new Set();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectCheckInterval = 3000; // 3 seconds
  private offlineTimestamp: number | null = null;
  private pendingOperations: Map<string, () => Promise<void>> = new Map();

  constructor(
    private eventBus: EventBus,
    private storage: StorageEngine,
    private config: ConfigManager
  ) {
    this.detectInitialStatus();
    this.setupListeners();
  }

  private detectInitialStatus(): void {
    if (typeof navigator !== 'undefined') {
      this.status = navigator.onLine ? 'online' : 'offline';
      if (this.status === 'offline') {
        this.offlineTimestamp = Date.now();
      }
    }
  }

  private setupListeners(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => {
      this.handleOnline();
    });

    window.addEventListener('offline', () => {
      this.handleOffline();
    });
  }

  private handleOnline(): void {
    const previousStatus = this.status;
    this.status = 'online';
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    const duration = this.offlineTimestamp ? Date.now() - this.offlineTimestamp : 0;
    this.offlineTimestamp = null;

    this.eventBus.emit('offline:reconnected', { timestamp: Date.now(), duration });
    this.notifyListeners(previousStatus);
  }

  private handleOffline(): void {
    const previousStatus = this.status;
    this.status = 'offline';
    this.offlineTimestamp = Date.now();

    this.eventBus.emit('offline:detected', { timestamp: Date.now() });
    this.notifyListeners(previousStatus);

    // Start reconnect polling for environments where online event might not fire
    this.startReconnectPolling();
  }

  private startReconnectPolling(): void {
    if (this.reconnectTimer) return;

    this.reconnectTimer = setInterval(() => {
      if (typeof navigator !== 'undefined' && navigator.onLine && this.status === 'offline') {
        this.handleOnline();
      }
    }, this.reconnectCheckInterval);
  }

  private notifyListeners(previousStatus: OfflineStatus): void {
    for (const listener of this.listeners) {
      try {
        listener(this.status, previousStatus);
      } catch {
        // Ignore listener errors
      }
    }
  }

  public getStatus(): OfflineStatus {
    return this.status;
  }

  public isOnline(): boolean {
    return this.status === 'online';
  }

  public isOffline(): boolean {
    return this.status === 'offline';
  }

  public subscribe(listener: OfflineListener): () => void {
    this.listeners.add(listener);
    // Immediately call with current status
    listener(this.status, this.status);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public async executeOfflineSafe<T>(
    operation: () => Promise<T>,
    fallback?: () => Promise<T>
  ): Promise<T> {
    if (this.isOnline()) {
      return operation();
    }

    if (fallback) {
      return fallback();
    }

    throw new OfflineError('Operation failed due to offline state');
  }

  public async queueOperation<T>(
    operationId: string,
    executor: () => Promise<T>,
    options?: {
      maxRetries?: number;
      persist?: boolean;
      metadata?: Record<string, unknown>;
    }
  ): Promise<T> {
    const persist = options?.persist ?? this.config.get('offline')?.queuePersistence ?? true;
    const maxRetries = options?.maxRetries ?? 3;

    const executeWithRetry = async (attempt = 1): Promise<T> => {
      try {
        if (this.isOffline()) {
          throw new OfflineError('Device is offline');
        }
        return await executor();
      } catch (error) {
        if (attempt < maxRetries && (error instanceof OfflineError || this.isOffline())) {
          await this.waitForOnline();
          return executeWithRetry(attempt + 1);
        }
        throw error;
      }
    };

    if (this.isOffline() && persist) {
      // Store operation for later replay
      await this.persistOperation(operationId, executor, options);
    }

    return executeWithRetry();
  }

  private async persistOperation<T>(
    operationId: string,
    executor: () => Promise<T>,
    options?: { metadata?: Record<string, unknown> }
  ): Promise<void> {
    const queueKey = `offline_queue_${operationId}`;
    const operationData = {
      id: operationId,
      executor: executor.toString(), // Serialize function (limited)
      metadata: options?.metadata,
      timestamp: Date.now(),
    };
    await this.storage.set(queueKey, operationData);
    this.pendingOperations.set(operationId, executor as () => Promise<void>);
  }

  private async waitForOnline(): Promise<void> {
    if (this.isOnline()) return;

    return new Promise((resolve) => {
      const unsubscribe = this.subscribe((status) => {
        if (status === 'online') {
          unsubscribe();
          resolve();
        }
      });
    });
  }

  public async replayQueuedOperations(): Promise<number> {
    if (this.isOffline()) {
      throw new OfflineError('Cannot replay operations while offline');
    }

    const keys = await this.storage.keys();
    const queueKeys = keys.filter(k => k.startsWith('offline_queue_'));

    let successCount = 0;
    for (const key of queueKeys) {
      const operation = await this.storage.get<{
        id: string;
        executor: string;
        metadata?: Record<string, unknown>;
      }>(key);
      
      if (operation) {
        try {
          // eslint-disable-next-line no-new-func
          const executor = new Function('return (' + operation.executor + ')')() as () => Promise<void>;
          await executor();
          await this.storage.delete(key);
          this.pendingOperations.delete(operation.id);
          successCount++;
        } catch (error) {
          console.error(`Failed to replay operation ${operation.id}:`, error);
        }
      }
    }

    return successCount;
  }

  public async clearQueuedOperations(): Promise<void> {
    const keys = await this.storage.keys();
    const queueKeys = keys.filter(k => k.startsWith('offline_queue_'));
    for (const key of queueKeys) {
      await this.storage.delete(key);
    }
    this.pendingOperations.clear();
  }

  public getQueuedOperationCount(): number {
    return this.pendingOperations.size;
  }

  public destroy(): void {
    if (this.reconnectTimer) {
      clearInterval(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.listeners.clear();
    this.pendingOperations.clear();
  }
}
