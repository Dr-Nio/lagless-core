import { RetryPolicy } from '../types';
import { RetryError } from '../errors';
import { EventBus } from '../events';
import { delay } from '../utils';

export interface RetryContext {
  attempt: number;
  maxAttempts: number;
  error: Error;
  startTime: number;
}

export class RetryEngine {
  private activeRetries: Map<string, AbortController> = new Map();

  constructor(private eventBus: EventBus) {}

  async execute<T>(
    fn: () => Promise<T>,
    policy: Partial<RetryPolicy>,
    id?: string
  ): Promise<T> {
    const fullPolicy = this.normalizePolicy(policy);
    let attempt = 1;
    const startTime = Date.now();

    while (attempt <= fullPolicy.maxAttempts) {
      try {
        const result = await fn();
        if (attempt > 1) {
          this.eventBus.emit('retry:success', { key: id || 'unknown', attempt });
        }
        return result;
      } catch (error) {
        const shouldRetry = fullPolicy.retryCondition?.(error as Error) ?? true;
        
        if (!shouldRetry || attempt === fullPolicy.maxAttempts) {
          this.eventBus.emit('retry:exhausted', {
            key: id || 'unknown',
            attempts: attempt,
            error: error as Error,
          });
          throw new RetryError(
            `Operation failed after ${attempt} attempts`,
            attempt,
            { originalError: error }
          );
        }

        this.eventBus.emit('retry:attempt', {
          key: id || 'unknown',
          attempt,
          maxAttempts: fullPolicy.maxAttempts,
        });

        // Calculate delay with exponential backoff and jitter
        let waitTime = fullPolicy.baseDelay * Math.pow(fullPolicy.backoffMultiplier, attempt - 1);
        waitTime = Math.min(waitTime, fullPolicy.maxDelay);
        
        if (fullPolicy.jitter) {
          waitTime = waitTime * (0.5 + Math.random() * 0.5);
        }

        await delay(waitTime);
        attempt++;
      }
    }

    throw new RetryError(`Operation failed after ${fullPolicy.maxAttempts} attempts`, fullPolicy.maxAttempts);
  }

  private normalizePolicy(policy: Partial<RetryPolicy>): RetryPolicy {
    return {
      maxAttempts: policy.maxAttempts ?? 3,
      baseDelay: policy.baseDelay ?? 1000,
      maxDelay: policy.maxDelay ?? 30000,
      backoffMultiplier: policy.backoffMultiplier ?? 2,
      jitter: policy.jitter ?? true,
      retryCondition: policy.retryCondition ?? ((error: Error) => {
        const message = error.message.toLowerCase();
        const isNetwork = message.includes('fetch') || message.includes('network') || message.includes('offline');
        const isTimeout = message.includes('timeout');
        const isRateLimit = message.includes('429') || message.includes('rate');
        const isServerError = message.includes('500') || message.includes('502') || message.includes('503');
        return isNetwork || isTimeout || isRateLimit || isServerError;
      }),
    };
  }

  cancel(id: string): void {
    const controller = this.activeRetries.get(id);
    if (controller) {
      controller.abort();
      this.activeRetries.delete(id);
    }
  }

  cancelAll(): void {
    for (const controller of this.activeRetries.values()) {
      controller.abort();
    }
    this.activeRetries.clear();
  }

  getActiveCount(): number {
    return this.activeRetries.size;
  }
}
