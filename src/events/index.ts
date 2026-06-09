import { EventMap } from '../types';
import { ValidationError } from '../errors';

type EventKey = keyof EventMap;
type EventCallback<K extends EventKey> = (payload: EventMap[K]) => void | Promise<void>;

interface EventListenerEntry<K extends EventKey> {
  callback: EventCallback<K>;
  priority: number;
  once: boolean;
}

export class EventBus {
  private listeners: Map<EventKey, Set<EventListenerEntry<EventKey>>> = new Map();
  private history: Array<{ event: EventKey; payload: unknown; timestamp: number }> = [];
  private historyLimit = 100;
  private replaying = false;

  constructor(historyLimit = 100) {
    this.historyLimit = historyLimit;
  }

  on<K extends EventKey>(
    event: K,
    callback: EventCallback<K>,
    options?: { priority?: number; once?: boolean }
  ): () => void {
    const priority = options?.priority ?? 0;
    const once = options?.once ?? false;

    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    const entry: EventListenerEntry<K> = {
      callback: callback as EventCallback<EventKey>,
      priority,
      once,
    };

    this.listeners.get(event)!.add(entry as EventListenerEntry<EventKey>);

    // Return unsubscribe function
    return () => {
      const listeners = this.listeners.get(event);
      if (listeners) {
        listeners.delete(entry as EventListenerEntry<EventKey>);
        if (listeners.size === 0) {
          this.listeners.delete(event);
        }
      }
    };
  }

  once<K extends EventKey>(event: K, callback: EventCallback<K>, options?: { priority?: number }): () => void {
    return this.on(event, callback, { ...options, once: true });
  }

  off<K extends EventKey>(event: K, callback: EventCallback<K>): void {
    const listeners = this.listeners.get(event);
    if (!listeners) return;

    for (const entry of listeners) {
      if (entry.callback === callback) {
        listeners.delete(entry);
        break;
      }
    }

    if (listeners.size === 0) {
      this.listeners.delete(event);
    }
  }

  async emit<K extends EventKey>(event: K, payload: EventMap[K]): Promise<void> {
    // Record history
    if (this.historyLimit > 0) {
      this.history.push({ event, payload: payload as unknown, timestamp: Date.now() });
      if (this.history.length > this.historyLimit) {
        this.history.shift();
      }
    }

    const listeners = this.listeners.get(event);
    if (!listeners || listeners.size === 0) return;

    // Sort by priority (higher priority first)
    const sorted = Array.from(listeners).sort((a, b) => b.priority - a.priority);
    
    const toRemove: EventListenerEntry<EventKey>[] = [];

    for (const entry of sorted) {
      try {
        await (entry.callback as EventCallback<K>)(payload);
        if (entry.once) {
          toRemove.push(entry);
        }
      } catch {
        // Silently ignore callback errors
      }
    }

    // Remove once listeners
    for (const entry of toRemove) {
      listeners.delete(entry);
    }

    if (listeners.size === 0) {
      this.listeners.delete(event);
    }
  }

  async emitAsync<K extends EventKey>(event: K, payload: EventMap[K]): Promise<void> {
    return this.emit(event, payload);
  }

  emitSync<K extends EventKey>(event: K, payload: EventMap[K]): void {
    // Fire and forget - but still record history
    if (this.historyLimit > 0) {
      this.history.push({ event, payload: payload as unknown, timestamp: Date.now() });
      if (this.history.length > this.historyLimit) {
        this.history.shift();
      }
    }

    const listeners = this.listeners.get(event);
    if (!listeners) return;

    const sorted = Array.from(listeners).sort((a, b) => b.priority - a.priority);
    const toRemove: EventListenerEntry<EventKey>[] = [];

    for (const entry of sorted) {
      try {
        (entry.callback as EventCallback<K>)(payload);
        if (entry.once) {
          toRemove.push(entry);
        }
      } catch {
        // Ignore
      }
    }

    for (const entry of toRemove) {
      listeners.delete(entry);
    }

    if (listeners.size === 0) {
      this.listeners.delete(event);
    }
  }

  async replay(event?: EventKey): Promise<void> {
    if (this.replaying) {
      throw new ValidationError('Already replaying events');
    }

    this.replaying = true;
    try {
      const eventsToReplay = event
        ? this.history.filter(h => h.event === event)
        : [...this.history];

      for (const historyEvent of eventsToReplay) {
        await this.emit(historyEvent.event as EventKey, historyEvent.payload as any);
      }
    } finally {
      this.replaying = false;
    }
  }

  getHistory(event?: EventKey): Array<{ event: EventKey; payload: unknown; timestamp: number }> {
    if (event) {
      return this.history.filter(h => h.event === event);
    }
    return [...this.history];
  }

  clearHistory(): void {
    this.history = [];
  }

  listenerCount(event?: EventKey): number {
    if (event) {
      return this.listeners.get(event)?.size ?? 0;
    }
    let total = 0;
    for (const listeners of this.listeners.values()) {
      total += listeners.size;
    }
    return total;
  }

  eventNames(): EventKey[] {
    return Array.from(this.listeners.keys());
  }

  removeAllListeners(event?: EventKey): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}
