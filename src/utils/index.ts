import { JSONValue, Primitive } from '../types';

export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (obj instanceof Date) {
    return new Date(obj.getTime()) as T;
  }
  if (obj instanceof Array) {
    return obj.map(item => deepClone(item)) as T;
  }
  if (obj instanceof Map) {
    return new Map(Array.from(obj.entries()).map(([k, v]) => [deepClone(k), deepClone(v)])) as T;
  }
  if (obj instanceof Set) {
    return new Set(Array.from(obj.values()).map(v => deepClone(v))) as T;
  }
  if (obj instanceof RegExp) {
    return new RegExp(obj.source, obj.flags) as T;
  }
  const clonedObj: Record<string, unknown> = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      clonedObj[key] = deepClone((obj as Record<string, unknown>)[key]);
    }
  }
  return clonedObj as T;
}

export function deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
  const result = deepClone(target);
  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const sourceVal = source[key];
      const targetVal = result[key];
      if (
        sourceVal &&
        typeof sourceVal === 'object' &&
        !Array.isArray(sourceVal) &&
        targetVal &&
        typeof targetVal === 'object' &&
        !Array.isArray(targetVal)
      ) {
        result[key] = deepMerge(targetVal as Record<string, unknown>, sourceVal as Record<string, unknown>) as T[Extract<keyof T, string>];
      } else if (sourceVal !== undefined) {
        result[key] = sourceVal as T[Extract<keyof T, string>];
      }
    }
  }
  return result;
}

export function stableStringify(obj: unknown): string {
  const seen = new WeakSet();
  function serialize(value: unknown): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'function') return '[Function]';
    if (typeof value === 'symbol') return value.toString();
    if (typeof value === 'bigint') return value.toString();
    if (typeof value === 'number') return Number.isNaN(value) ? 'NaN' : String(value);
    if (typeof value === 'boolean') return String(value);
    if (typeof value === 'string') return JSON.stringify(value);
    if (value instanceof Date) return `Date(${value.toISOString()})`;
    if (value instanceof RegExp) return value.toString();
    if (value instanceof Map) {
      const obj: Record<string, unknown> = {};
      for (const [k, v] of value.entries()) {
        obj[serialize(k)] = serialize(v);
      }
      return JSON.stringify(obj);
    }
    if (value instanceof Set) {
      return JSON.stringify(Array.from(value).map(v => serialize(v)).sort());
    }
    if (typeof value === 'object') {
      if (seen.has(value)) {
        return '[Circular]';
      }
      seen.add(value);
      const keys = Object.keys(value as object).sort();
      const result: Record<string, string> = {};
      for (const key of keys) {
        result[key] = serialize((value as Record<string, unknown>)[key]);
      }
      seen.delete(value);
      return JSON.stringify(result);
    }
    return String(value);
  }
  return serialize(obj);
}

export function hashGeneration(input: string | unknown): string {
  const str = typeof input === 'string' ? input : stableStringify(input);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

export function keyNormalization(key: string): string {
  return key.trim().toLowerCase().replace(/[^a-z0-9_\-.]/g, '_');
}

export function environmentDetection(): 'browser' | 'node' | 'edge' | 'unknown' {
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    return 'browser';
  }
  if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    return 'node';
  }
  if (typeof globalThis !== 'undefined' && (globalThis as unknown as { EdgeRuntime?: string }).EdgeRuntime) {
    return 'edge';
  }
  return 'unknown';
}

export function storageDetection(): 'indexeddb' | 'localstorage' | 'memory' {
  if (typeof indexedDB !== 'undefined') {
    return 'indexeddb';
  }
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem('__test__', 'test');
      localStorage.removeItem('__test__');
      return 'localstorage';
    } catch {
      return 'memory';
    }
  }
  return 'memory';
}

export function isOffline(): boolean {
  if (typeof navigator !== 'undefined') {
    return !navigator.onLine;
  }
  return false;
}

export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}-${crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36)}`;
}

export function getSize(obj: unknown): number {
  try {
    const str = JSON.stringify(obj);
    return new Blob([str]).size;
  } catch {
    return 0;
  }
}

export function safeDeserialize<T>(data: string): T | null {
  try {
    return JSON.parse(data) as T;
  } catch {
    return null;
  }
}

export function safeSerialize(data: unknown): string | null {
  try {
    return JSON.stringify(data);
  } catch (e) {
    if (e instanceof Error && e.message.includes('circular')) {
      return stableStringify(data);
    }
    return null;
  }
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === null || proto === Object.prototype;
}

export function omit<T extends Record<string, unknown>, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  const result = { ...obj };
  for (const key of keys) {
    delete result[key];
  }
  return result;
}

export function pick<T extends Record<string, unknown>, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }
  return result;
}
