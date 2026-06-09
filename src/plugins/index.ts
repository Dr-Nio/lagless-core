import { Plugin, PluginHook, RequestOptions, RequestResponse, CacheEntry } from '../types';
import { PluginError } from '../errors';
import { EventBus } from '../events';

// Re-export the Plugin type
export type { Plugin };

export interface PluginContext {
  hook: PluginHook;
  payload: unknown;
  metadata?: Record<string, unknown>;
}

export class PluginManager {
  private plugins: Map<string, Plugin> = new Map();
  private hookHandlers: Map<PluginHook, Array<{ pluginName: string; handler: (context: unknown) => Promise<unknown> | unknown }>> = new Map();

  constructor(private eventBus: EventBus) {}

  register(plugin: Plugin): void {
    if (this.plugins.has(plugin.name)) {
      throw new PluginError(`Plugin "${plugin.name}" is already registered`, plugin.name);
    }

    // Validate plugin structure
    if (!plugin.name || typeof plugin.name !== 'string') {
      throw new PluginError('Plugin must have a valid name', plugin.name);
    }
    if (!plugin.version || typeof plugin.version !== 'string') {
      throw new PluginError('Plugin must have a valid version', plugin.name);
    }

    this.plugins.set(plugin.name, plugin);

    // Register hooks
    if (plugin.hooks) {
      for (const [hook, handler] of Object.entries(plugin.hooks)) {
        if (!this.hookHandlers.has(hook as PluginHook)) {
          this.hookHandlers.set(hook as PluginHook, []);
        }
        this.hookHandlers.get(hook as PluginHook)!.push({
          pluginName: plugin.name,
          handler: handler as (context: unknown) => Promise<unknown> | unknown,
        });
      }
    }

    // Call setup if provided
    if (plugin.setup) {
      try {
        plugin.setup(this);
      } catch (error) {
        throw new PluginError(`Failed to setup plugin "${plugin.name}"`, plugin.name, { error });
      }
    }

    this.eventBus.emit('plugin:registered', { name: plugin.name, version: plugin.version });
  }

  unregister(pluginName: string): void {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      throw new PluginError(`Plugin "${pluginName}" not found`, pluginName);
    }

    // Call teardown if provided
    if (plugin.teardown) {
      try {
        plugin.teardown();
      } catch (error) {
        console.error(`Error during teardown of plugin "${pluginName}":`, error);
      }
    }

    // Remove hooks
    for (const [hook, handlers] of this.hookHandlers.entries()) {
      const filtered = handlers.filter(h => h.pluginName !== pluginName);
      if (filtered.length === 0) {
        this.hookHandlers.delete(hook);
      } else {
        this.hookHandlers.set(hook, filtered);
      }
    }

    this.plugins.delete(pluginName);
    this.eventBus.emit('plugin:unregistered', { name: pluginName });
  }

  async executeHook<T>(hook: PluginHook, context: T): Promise<T> {
    const handlers = this.hookHandlers.get(hook);
    if (!handlers || handlers.length === 0) {
      return context;
    }

    let result = context;
    for (const handler of handlers) {
      try {
        result = await handler.handler(result) as T;
      } catch (error) {
        this.eventBus.emit('plugin:error', {
          pluginName: handler.pluginName,
          hook,
          error: error as Error,
        });
        // Continue with other plugins, but log error
        console.error(`Plugin "${handler.pluginName}" failed in hook "${hook}":`, error);
      }
    }
    return result;
  }

  getPlugin(name: string): Plugin | undefined {
    return this.plugins.get(name);
  }

  listPlugins(): Array<{ name: string; version: string }> {
    return Array.from(this.plugins.values()).map(p => ({ name: p.name, version: p.version }));
  }

  hasPlugin(name: string): boolean {
    return this.plugins.has(name);
  }

  clear(): void {
    for (const plugin of this.plugins.values()) {
      if (plugin.teardown) {
        try {
          plugin.teardown();
        } catch {
          // Ignore
        }
      }
    }
    this.plugins.clear();
    this.hookHandlers.clear();
  }
}

// Example plugin factory for common use cases
export function createLoggerPlugin(options?: { logLevel?: 'info' | 'debug' | 'warn' | 'error' }): Plugin {
  const level = options?.logLevel ?? 'info';
  return {
    name: 'logger',
    version: '1.0.0',
    hooks: {
      beforeRequest: async (context: unknown) => {
        const reqContext = context as RequestOptions;
        if (level === 'debug') {
          console.debug('[Lagless] Request:', reqContext.url, reqContext.method);
        }
        return context;
      },
      afterRequest: async (context: unknown) => {
        const resContext = context as RequestResponse;
        if (level === 'info') {
          console.log(`[Lagless] Response: ${resContext.status} (${resContext.latency}ms)`);
        }
        return context;
      },
      beforeCache: async (context: unknown) => {
        const cacheContext = context as { key: string; value: unknown };
        if (level === 'debug') {
          console.debug('[Lagless] Cache set:', cacheContext.key);
        }
        return context;
      },
    },
  };
}

export function createMetricsPlugin(collector?: (metric: { name: string; value: number }) => void): Plugin {
  return {
    name: 'metrics',
    version: '1.0.0',
    hooks: {
      afterRequest: async (context: unknown) => {
        const resContext = context as RequestResponse;
        if (collector) {
          collector({ name: 'request_latency', value: resContext.latency });
        }
        return context;
      },
    },
  };
}
