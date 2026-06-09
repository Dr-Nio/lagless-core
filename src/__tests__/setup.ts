import { vi } from 'vitest';

// Mock Headers
if (typeof Headers === 'undefined') {
  class MockHeaders {
    private store: Map<string, string> = new Map();
    
    constructor(init?: Record<string, string>) {
      if (init) {
        Object.entries(init).forEach(([key, value]) => {
          this.set(key, value);
        });
      }
    }
    
    get(key: string): string | null {
      return this.store.get(key.toLowerCase()) || null;
    }
    
    set(key: string, value: string): this {
      this.store.set(key.toLowerCase(), value);
      return this;
    }
    
    has(key: string): boolean {
      return this.store.has(key.toLowerCase());
    }
    
    delete(key: string): boolean {
      return this.store.delete(key.toLowerCase());
    }
    
    forEach(callback: (value: string, key: string, parent: this) => void): void {
      this.store.forEach((value, key) => callback(value, key, this));
    }
    
    keys(): IterableIterator<string> {
      return this.store.keys();
    }
    
    values(): IterableIterator<string> {
      return this.store.values();
    }
    
    entries(): IterableIterator<[string, string]> {
      return this.store.entries();
    }
  }
  
  globalThis.Headers = MockHeaders as any;
}

// Mock fetch
globalThis.fetch = vi.fn();

// Mock Response
if (typeof Response === 'undefined') {
  globalThis.Response = class {
    public body: string;
    public init?: any;
    
    constructor(body: string, init?: any) {
      this.body = body;
      this.init = init;
    }
    
    json() { 
      return JSON.parse(this.body); 
    }
    
    text() { 
      return this.body; 
    }
    
    get ok() { 
      return this.init?.status === 200; 
    }
    
    get status() { 
      return this.init?.status || 200; 
    }
    
    get statusText() { 
      return this.init?.statusText || 'OK'; 
    }
    
    get headers() { 
      return new Headers(); 
    }
  } as any;
}

// Increase test timeout
vi.setConfig({ testTimeout: 15000 });

// Global setup
beforeEach(() => {
  vi.clearAllMocks();
  vi.resetAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});
