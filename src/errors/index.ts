export class LaglessError extends Error {
  public readonly code: string;
  public readonly timestamp: number;
  public readonly context?: Record<string, unknown>;

  constructor(message: string, code = 'LAGLESS_ERROR', context?: Record<string, unknown>) {
    super(message);
    this.name = 'LaglessError';
    this.code = code;
    this.timestamp = Date.now();
    // Only assign context if it's provided (not undefined)
    if (context !== undefined) {
      this.context = context;
    }
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class RequestError extends LaglessError {
  public readonly status?: number;
  public readonly url?: string;
  public readonly method?: string;

  constructor(
    message: string,
    options?: {
      status?: number;
      url?: string;
      method?: string;
      code?: string;
      context?: Record<string, unknown>;
    }
  ) {
    super(message, options?.code ?? 'REQUEST_ERROR', options?.context);
    this.name = 'RequestError';
    
    // Only assign if values are defined (not undefined)
    if (options?.status !== undefined) {
      this.status = options.status;
    }
    if (options?.url !== undefined) {
      this.url = options.url;
    }
    if (options?.method !== undefined) {
      this.method = options.method;
    }
  }
}

export class CacheError extends LaglessError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'CACHE_ERROR', context);
    this.name = 'CacheError';
  }
}

export class StorageError extends LaglessError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'STORAGE_ERROR', context);
    this.name = 'StorageError';
  }
}

export class SyncError extends LaglessError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'SYNC_ERROR', context);
    this.name = 'SyncError';
  }
}

export class RetryError extends LaglessError {
  public readonly attempts: number;

  constructor(message: string, attempts: number, context?: Record<string, unknown>) {
    super(message, 'RETRY_ERROR', context);
    this.name = 'RetryError';
    this.attempts = attempts;
  }
}

export class OfflineError extends LaglessError {
  constructor(message = 'Operation failed due to offline state', context?: Record<string, unknown>) {
    super(message, 'OFFLINE_ERROR', context);
    this.name = 'OfflineError';
  }
}

export class PluginError extends LaglessError {
  public readonly pluginName?: string;

  constructor(message: string, pluginName?: string, context?: Record<string, unknown>) {
    super(message, 'PLUGIN_ERROR', context);
    this.name = 'PluginError';
    // Only assign pluginName if it's provided (not undefined)
    if (pluginName !== undefined) {
      this.pluginName = pluginName;
    }
  }
}

export class ValidationError extends LaglessError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', context);
    this.name = 'ValidationError';
  }
}

export class TimeoutError extends LaglessError {
  constructor(message = 'Request timed out', context?: Record<string, unknown>) {
    super(message, 'TIMEOUT_ERROR', context);
    this.name = 'TimeoutError';
  }
}

export class AbortError extends LaglessError {
  constructor(message = 'Request aborted', context?: Record<string, unknown>) {
    super(message, 'ABORT_ERROR', context);
    this.name = 'AbortError';
  }
}

export class SerializationError extends LaglessError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'SERIALIZATION_ERROR', context);
    this.name = 'SerializationError';
  }
}
