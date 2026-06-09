import { SyncStrategy } from '../types';
import { EventBus } from '../events';
import { OfflineEngine } from '../offline';
import { QueueEngine } from '../queue';
import { ConfigManager } from '../config';
import { SyncError } from '../errors';
import { delay } from '../utils';

export interface SyncEvent {
  strategy: SyncStrategy;
  timestamp: number;
  operationsProcessed: number;
  duration: number;
}

export interface SyncOptions {
  strategies?: SyncStrategy[];
  interval?: number;
  onChange?: boolean;
}

export class SyncEngine {
  private syncInProgress = false;
  private lastSyncTime: Map<SyncStrategy, number> = new Map();
  private intervalTimers: Map<SyncStrategy, ReturnType<typeof setInterval>> = new Map();
  private visibilityListener?: () => void;
  private focusListener?: () => void;
  private onlineListener?: () => void;

  constructor(
    private eventBus: EventBus,
    private offlineEngine: OfflineEngine,
    private queueEngine: QueueEngine,
    private config: ConfigManager
  ) {
    const syncConfig = this.config.get('sync');
    if (syncConfig?.enabled) {
      this.initializeStrategies(syncConfig.strategies || ['background', 'reconnect', 'visibility', 'focus']);
      this.setupEventListeners();
    }
  }

  private initializeStrategies(strategies: SyncStrategy[]): void {
    const syncConfig = this.config.get('sync');
    for (const strategy of strategies) {
      switch (strategy) {
        case 'background':
          if (syncConfig?.interval) {
            this.startIntervalSync(syncConfig.interval);
          }
          break;
        case 'reconnect':
          // Handled by setupEventListeners
          break;
        case 'visibility':
          // Handled by setupEventListeners
          break;
        case 'focus':
          // Handled by setupEventListeners
          break;
        case 'manual':
          // Manual sync triggered by user
          break;
      }
    }
  }

  private setupEventListeners(): void {
    if (typeof window === 'undefined') return;

    // Reconnect sync (online event)
    this.onlineListener = () => {
      const strategies = this.config.get('sync')?.strategies || [];
      if (strategies.includes('reconnect') && this.offlineEngine.isOnline()) {
        this.sync('reconnect').catch(error => {
          this.eventBus.emit('sync:error', { strategy: 'reconnect', error });
        });
      }
    };
    window.addEventListener('online', this.onlineListener);

    // Visibility sync
    this.visibilityListener = () => {
      const strategies = this.config.get('sync')?.strategies || [];
      if (strategies.includes('visibility') && document.visibilityState === 'visible') {
        this.sync('visibility').catch(error => {
          this.eventBus.emit('sync:error', { strategy: 'visibility', error });
        });
      }
    };
    document.addEventListener('visibilitychange', this.visibilityListener);

    // Focus sync
    this.focusListener = () => {
      const strategies = this.config.get('sync')?.strategies || [];
      if (strategies.includes('focus')) {
        this.sync('focus').catch(error => {
          this.eventBus.emit('sync:error', { strategy: 'focus', error });
        });
      }
    };
    window.addEventListener('focus', this.focusListener);
  }

  private startIntervalSync(intervalMs: number): void {
    const timer = setInterval(() => {
      if (this.offlineEngine.isOnline() && !this.syncInProgress) {
        this.sync('background').catch(error => {
          this.eventBus.emit('sync:error', { strategy: 'background', error });
        });
      }
    }, intervalMs);
    this.intervalTimers.set('background', timer);
  }

  async sync(strategy: SyncStrategy = 'manual'): Promise<SyncEvent> {
    if (this.syncInProgress) {
      throw new SyncError('Sync already in progress');
    }

    if (!this.offlineEngine.isOnline()) {
      throw new SyncError('Cannot sync while offline');
    }

    const startTime = performance.now();
    this.syncInProgress = true;

    this.eventBus.emit('sync:start', { strategy });

    try {
      // Process pending queue operations
      const operationsProcessed = await this.queueEngine.processQueue();
      
      const duration = performance.now() - startTime;
      const timestamp = Date.now();
      
      this.lastSyncTime.set(strategy, timestamp);

      const syncEvent: SyncEvent = {
        strategy,
        timestamp,
        operationsProcessed,
        duration,
      };

      this.eventBus.emit('sync:end', { strategy, operationsProcessed });
      
      return syncEvent;
    } catch (error) {
      this.eventBus.emit('sync:error', { strategy, error: error as Error });
      throw error;
    } finally {
      this.syncInProgress = false;
    }
  }

  async syncAll(): Promise<Record<SyncStrategy, SyncEvent>> {
    const results: Partial<Record<SyncStrategy, SyncEvent>> = {};
    const strategies: SyncStrategy[] = ['background', 'reconnect', 'visibility', 'focus', 'manual'];
    
    for (const strategy of strategies) {
      try {
        results[strategy] = await this.sync(strategy);
        await delay(100); // Small delay between syncs to avoid overwhelming
      } catch {
        // Continue with other strategies
      }
    }
    
    return results as Record<SyncStrategy, SyncEvent>;
  }

  getLastSyncTime(strategy?: SyncStrategy): Map<SyncStrategy, number> | number | null {
    if (strategy) {
      return this.lastSyncTime.get(strategy) || null;
    }
    return new Map(this.lastSyncTime);
  }

  isSyncing(): boolean {
    return this.syncInProgress;
  }

  async scheduleSync(strategy: SyncStrategy, delayMs: number): Promise<void> {
    setTimeout(() => {
      if (this.offlineEngine.isOnline() && !this.syncInProgress) {
        this.sync(strategy).catch(() => {});
      }
    }, delayMs);
  }

  destroy(): void {
    // Clear all interval timers
    for (const timer of this.intervalTimers.values()) {
      clearInterval(timer);
    }
    this.intervalTimers.clear();

    // Remove event listeners
    if (typeof window !== 'undefined') {
      if (this.onlineListener) {
        window.removeEventListener('online', this.onlineListener);
      }
      if (this.focusListener) {
        window.removeEventListener('focus', this.focusListener);
      }
      if (this.visibilityListener && typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', this.visibilityListener);
      }
    }
  }
}
