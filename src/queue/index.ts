import { QueuedOperation, HTTPMethod } from '../types';
import { EventBus } from '../events';
import { StorageEngine } from '../core/storage';
import { RequestEngine } from '../core/request';
import { OfflineEngine } from '../offline';
import { ConfigManager } from '../config';
import { generateId, delay } from '../utils';
import { OfflineError } from '../errors';

export class QueueEngine {
  private queue: QueuedOperation[] = [];
  private processing = false;
  private persistenceKey = 'lagless_queue';
  private maxSize: number;

  constructor(
    private eventBus: EventBus,
    private storage: StorageEngine,
    private requestEngine: RequestEngine,
    private offlineEngine: OfflineEngine,
    private config: ConfigManager
  ) {
    this.maxSize = this.config.get('offline')?.maxQueueSize ?? 1000;
    this.loadFromStorage().catch(() => {});
  }

  private async loadFromStorage(): Promise<void> {
    try {
      const saved = await this.storage.get<QueuedOperation[]>(this.persistenceKey);
      if (saved && Array.isArray(saved)) {
        this.queue = saved;
        // Use a generic event or remove this line if not needed
        this.eventBus.emit('queue:add' as any, { count: this.queue.length });
      }
    } catch {
      // Silently fail - queue will start empty
    }
  }

  private async persist(): Promise<void> {
    try {
      await this.storage.set(this.persistenceKey, this.queue);
    } catch {
      // Silently fail - queue will stay in memory
    }
  }

  async add(operation: Omit<QueuedOperation, 'id' | 'timestamp' | 'attempts'>): Promise<string> {
    if (this.queue.length >= this.maxSize) {
      // Remove oldest operation
      const removed = this.queue.shift();
      // Use a generic event or log instead
      console.debug('Queue evicted operation:', removed);
    }

    const queuedOp: QueuedOperation = {
      ...operation,
      id: generateId(),
      timestamp: Date.now(),
      attempts: 0,
      maxAttempts: operation.maxAttempts || 3,
      retryUntil: Date.now() + (operation.maxAttempts || 3) * 30000, // 30 seconds per attempt max
    };

    this.queue.push(queuedOp);
    await this.persist();
    
    this.eventBus.emit('queue:add', { operation: queuedOp });

    // Attempt to process immediately if online
    if (this.offlineEngine.isOnline() && !this.processing) {
      this.processQueue().catch(() => {});
    }

    return queuedOp.id;
  }

  async processQueue(): Promise<number> {
    if (this.processing) {
      return 0;
    }

    if (!this.offlineEngine.isOnline()) {
      throw new OfflineError('Cannot process queue while offline');
    }

    this.processing = true;
    let processed = 0;

    try {
      const toProcess = [...this.queue];
      
      for (const operation of toProcess) {
        const index = this.queue.findIndex(op => op.id === operation.id);
        if (index === -1) continue;

        // Check if operation has expired
        if (Date.now() > operation.retryUntil) {
          this.queue.splice(index, 1);
          await this.persist();
          this.eventBus.emit('queue:fail', { operation, error: new Error('Operation expired') });
          continue;
        }

        this.eventBus.emit('queue:process', { operation });

        try {
          await this.executeOperation(operation);
          
          // Remove on success
          this.queue.splice(index, 1);
          await this.persist();
          this.eventBus.emit('queue:success', { operation });
          processed++;
        } catch (error) {
          // Update attempt count
          operation.attempts++;
          
          if (operation.attempts >= operation.maxAttempts) {
            // Remove permanently on max attempts
            this.queue.splice(index, 1);
            await this.persist();
            this.eventBus.emit('queue:fail', { operation, error: error as Error });
          } else {
            // Keep in queue for retry
            this.eventBus.emit('queue:retry', { operation, attempt: operation.attempts });
            // Move to end of queue
            this.queue.splice(index, 1);
            this.queue.push(operation);
            await this.persist();
          }
          
          // Small delay before next operation on error
          await delay(1000);
        }
      }
    } finally {
      this.processing = false;
    }

    return processed;
  }

  private async executeOperation(operation: QueuedOperation): Promise<void> {
    // Build request options without undefined values
    const requestOptions: any = {
      url: operation.url,
      method: operation.method,
      retryPolicy: {
        maxAttempts: 1, // Queue handles retries
      },
    };
    
    // Only add headers if defined
    if (operation.headers !== undefined) {
      requestOptions.headers = operation.headers;
    }
    
    // Only add body if defined
    if (operation.body !== undefined) {
      requestOptions.body = operation.body;
    }
    
    // Only add metadata if defined
    if (operation.metadata !== undefined) {
      requestOptions.metadata = operation.metadata;
    }

    await this.requestEngine.execute(requestOptions);
  }

  async getPendingCount(): Promise<number> {
    return this.queue.length;
  }

  async getPendingOperations(): Promise<QueuedOperation[]> {
    return [...this.queue];
  }

  async cancelOperation(id: string): Promise<boolean> {
    const index = this.queue.findIndex(op => op.id === id);
    if (index !== -1) {
      this.queue.splice(index, 1);
      await this.persist();
      return true;
    }
    return false;
  }

  async clearQueue(): Promise<void> {
    this.queue = [];
    await this.persist();
    // Use a generic event or remove this line
    console.debug('Queue cleared');
  }

  async retryFailed(ids?: string[]): Promise<number> {
    let retried = 0;
    const toRetry = ids 
      ? this.queue.filter(op => ids.includes(op.id))
      : this.queue.filter(op => op.attempts > 0 && op.attempts < op.maxAttempts);
    
    for (const operation of toRetry) {
      // Reset attempts to give fresh try
      operation.attempts = 0;
      retried++;
    }
    
    await this.persist();
    
    if (this.offlineEngine.isOnline() && !this.processing) {
      this.processQueue().catch(() => {});
    }
    
    return retried;
  }

  async getStats(): Promise<{
    pending: number;
    maxSize: number;
    oldestTimestamp: number | null;
    newestTimestamp: number | null;
  }> {
    return {
      pending: this.queue.length,
      maxSize: this.maxSize,
      oldestTimestamp: this.queue[0]?.timestamp ?? null,
      newestTimestamp: this.queue[this.queue.length - 1]?.timestamp ?? null,
    };
  }
}
