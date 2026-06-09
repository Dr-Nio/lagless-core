import { SerializationError } from '../errors';
import { stableStringify } from '../utils';

export interface Serializer {
  serialize<T>(value: T): string;
  deserialize<T>(value: string): T;
}

export class JsonSerializer implements Serializer {
  serialize<T>(value: T): string {
    try {
      return JSON.stringify(value);
    } catch (error) {
      if (error instanceof Error && error.message.includes('circular')) {
        return stableStringify(value);
      }
      throw new SerializationError(`Failed to serialize value: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  deserialize<T>(value: string): T {
    try {
      return JSON.parse(value) as T;
    } catch (error) {
      throw new SerializationError(`Failed to deserialize value: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

export class SafeSerializer implements Serializer {
  private maxDepth = 100;
  private seen = new WeakSet();

  serialize<T>(value: T, depth = 0): string {
    if (depth > this.maxDepth) {
      throw new SerializationError('Maximum serialization depth exceeded');
    }

    try {
      const safeValue = this.makeSafe(value, depth);
      return JSON.stringify(safeValue);
    } catch (error) {
      throw new SerializationError(`Failed to safely serialize value: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  deserialize<T>(value: string): T {
    try {
      return JSON.parse(value) as T;
    } catch (error) {
      throw new SerializationError(`Failed to deserialize value: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private makeSafe(value: unknown, depth: number): unknown {
    if (value === null || value === undefined) {
      return value;
    }

    if (typeof value === 'function') {
      return '[Function]';
    }

    if (typeof value === 'symbol') {
      return value.toString();
    }

    if (typeof value === 'bigint') {
      return value.toString();
    }

    if (value instanceof Date) {
      return { __type: 'Date', value: value.toISOString() };
    }

    if (value instanceof RegExp) {
      return { __type: 'RegExp', source: value.source, flags: value.flags };
    }

    if (value instanceof Map) {
      const obj: Record<string, unknown> = {};
      for (const [k, v] of value.entries()) {
        obj[this.makeSafe(k, depth + 1) as string] = this.makeSafe(v, depth + 1);
      }
      return { __type: 'Map', value: obj };
    }

    if (value instanceof Set) {
      const arr: unknown[] = [];
      for (const v of value.values()) {
        arr.push(this.makeSafe(v, depth + 1));
      }
      return { __type: 'Set', value: arr };
    }

    if (typeof value === 'object') {
      if (this.seen.has(value)) {
        return '[Circular]';
      }
      this.seen.add(value);
      const result: Record<string, unknown> = {};
      for (const key in value as object) {
        if (Object.prototype.hasOwnProperty.call(value, key)) {
          result[key] = this.makeSafe((value as Record<string, unknown>)[key], depth + 1);
        }
      }
      this.seen.delete(value);
      return result;
    }

    return value;
  }
}

export function serializeWithRecovery<T>(value: T, fallback?: T): string {
  const serializer = new SafeSerializer();
  try {
    return serializer.serialize(value);
  } catch {
    if (fallback !== undefined) {
      return serializer.serialize(fallback);
    }
    return 'null';
  }
}

export function deserializeWithRecovery<T>(value: string, fallback?: T): T | null {
  const serializer = new SafeSerializer();
  try {
    return serializer.deserialize<T>(value);
  } catch {
    if (fallback !== undefined) {
      return fallback;
    }
    return null;
  }
}

export function detectCorruption(data: string): boolean {
  try {
    JSON.parse(data);
    return false;
  } catch {
    return true;
  }
}

export function attemptRecovery(data: string): string | null {
  // Attempt to fix common JSON corruption issues
  let fixed = data;
  
  // Fix trailing commas
  fixed = fixed.replace(/,\s*}/g, '}');
  fixed = fixed.replace(/,\s*]/g, ']');
  
  // Fix missing quotes
  fixed = fixed.replace(/([{,]\s*)([a-zA-Z0-9_]+)(\s*:)/g, '$1"$2"$3');
  
  // Fix unescaped quotes
  fixed = fixed.replace(/(?<!\\)"/g, '\\"');
  
  try {
    JSON.parse(fixed);
    return fixed;
  } catch {
    return null;
  }
}
