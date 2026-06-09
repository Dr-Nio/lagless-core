import { describe, it, expect, beforeEach } from 'vitest';
import { StorageEngine } from '../core/storage';
import { EventBus } from '../events';
import { ConfigManager } from '../config';

describe('StorageEngine', () => {
  let storage: StorageEngine;

  beforeEach(() => {
    const eventBus = new EventBus();
    const config = new ConfigManager();
    storage = new StorageEngine(eventBus, config);
  });

  it('should set and get value', async () => {
    await storage.set('key1', { foo: 'bar' });
    const value = await storage.get('key1');
    expect(value).toEqual({ foo: 'bar' });
  });

  it('should return null for missing key', async () => {
    const value = await storage.get('missing');
    expect(value).toBeNull();
  });

  it('should delete key', async () => {
    await storage.set('to-delete', 'value');
    await storage.delete('to-delete');
    expect(await storage.get('to-delete')).toBeNull();
  });

  it('should check existence', async () => {
    await storage.set('exists', 'yes');
    expect(await storage.has('exists')).toBe(true);
    expect(await storage.has('no')).toBe(false);
  });

  it('should get all keys', async () => {
    // Clear storage first to remove previous test data
    await storage.clear();
    
    await storage.set('a', 1);
    await storage.set('b', 2);
    
    const keys = await storage.keys();
    // Filter out internal keys like '__version__'
    const filteredKeys = keys.filter(k => k !== '__version__');
    
    expect(filteredKeys.sort()).toEqual(['a', 'b']);
  });

  it('should clear all', async () => {
    await storage.set('a', 1);
    await storage.set('b', 2);
    await storage.clear();
    expect(await storage.keys()).toEqual([]);
  });

  it('should get many keys', async () => {
    await storage.set('x', 10);
    await storage.set('y', 20);
    const result = await storage.getMany(['x', 'y', 'z']);
    expect(result).toEqual({ x: 10, y: 20 });
  });

  it('should set many', async () => {
    await storage.setMany({ a: 1, b: 2 });
    expect(await storage.get('a')).toBe(1);
    expect(await storage.get('b')).toBe(2);
  });
});
