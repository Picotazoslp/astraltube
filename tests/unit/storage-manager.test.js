/**
 * AstralTube v3 - StorageManager Unit Tests
 * Comprehensive tests for data storage and retrieval functionality
 */

import { StorageManager } from '../../src/lib/storage.js';
import { chromeMocks, chromeTestUtils } from '../mocks/chrome-api.js';

describe('StorageManager', () => {
  let storageManager;
  
  beforeEach(async () => {
    // Reset Chrome API mocks
    chromeTestUtils.resetMocks();
    
    // Create new StorageManager instance
    storageManager = new StorageManager();
  });

  afterEach(() => {
    // Clean up
    storageManager = null;
  });

  describe('Constructor', () => {
    test('should initialize with default values', () => {
      expect(storageManager.cache).toBeInstanceOf(Map);
      expect(storageManager.cache.size).toBe(0);
      expect(storageManager.encryptionKey).toBeNull();
      expect(storageManager.initialized).toBe(false);
      expect(storageManager.compressionEnabled).toBe(true);
      expect(storageManager.maxCacheSize).toBe(100);
    });
  });

  describe('initialize()', () => {
    test('should initialize successfully with new encryption key', async () => {
      // Mock storage without existing encryption key
      chromeMocks.storage.local.get.mockResolvedValueOnce({});
      
      await storageManager.initialize();
      
      expect(storageManager.initialized).toBe(true);
      expect(storageManager.encryptionKey).not.toBeNull();
      expect(chromeMocks.storage.local.get).toHaveBeenCalledWith('encryptionKey');
      expect(chromeMocks.storage.local.set).toHaveBeenCalledWith({
        encryptionKey: expect.any(String)
      });
    });

    test('should initialize with existing encryption key', async () => {
      const existingKey = 'existing-encryption-key-123';
      
      // Mock storage with existing encryption key
      chromeMocks.storage.local.get.mockResolvedValueOnce({
        encryptionKey: existingKey
      });
      
      await storageManager.initialize();
      
      expect(storageManager.initialized).toBe(true);
      expect(storageManager.encryptionKey).toBe(existingKey);
      expect(chromeMocks.storage.local.set).not.toHaveBeenCalled();
    });

    test('should continue without encryption if initialization fails', async () => {
      // Mock storage error
      chromeMocks.storage.local.get.mockRejectedValueOnce(new Error('Storage access denied'));
      
      await storageManager.initialize();
      
      expect(storageManager.initialized).toBe(true);
      expect(storageManager.encryptionKey).toBeNull();
    });
  });

  describe('set()', () => {
    beforeEach(async () => {
      await storageManager.initialize();
    });

    test('should store simple data successfully', async () => {
      const key = 'testKey';
      const value = 'testValue';
      
      await storageManager.set(key, value);
      
      expect(chromeMocks.storage.local.set).toHaveBeenCalledWith({
        [key]: expect.any(String) // Encrypted/serialized value
      });
      expect(storageManager.cache.has(key)).toBe(true);
      expect(storageManager.cache.get(key)).toBe(value);
    });

    test('should store complex object data', async () => {
      const key = 'testObject';
      const value = {
        id: 'test123',
        name: 'Test Object',
        nested: {
          property: 'nested value',
          array: [1, 2, 3]
        }
      };
      
      await storageManager.set(key, value);
      
      expect(chromeMocks.storage.local.set).toHaveBeenCalled();
      expect(storageManager.cache.get(key)).toEqual(value);
    });

    test('should handle array data', async () => {
      const key = 'testArray';
      const value = ['item1', 'item2', { nested: 'object' }];
      
      await storageManager.set(key, value);
      
      expect(storageManager.cache.get(key)).toEqual(value);
    });

    test('should manage cache size limit', async () => {
      storageManager.maxCacheSize = 2;
      
      await storageManager.set('key1', 'value1');
      await storageManager.set('key2', 'value2');
      await storageManager.set('key3', 'value3'); // Should trigger cache cleanup
      
      expect(storageManager.cache.size).toBeLessThanOrEqual(2);
    });

    test('should handle storage errors gracefully', async () => {
      chromeMocks.storage.local.set.mockRejectedValueOnce(new Error('Storage quota exceeded'));
      
      await expect(storageManager.set('testKey', 'testValue')).rejects.toThrow('Storage quota exceeded');
    });
  });

  describe('get()', () => {
    beforeEach(async () => {
      await storageManager.initialize();
    });

    test('should retrieve cached data without storage call', async () => {
      const key = 'cachedKey';
      const value = 'cachedValue';
      
      storageManager.cache.set(key, value);
      
      const result = await storageManager.get(key);
      
      expect(result).toBe(value);
      expect(chromeMocks.storage.local.get).not.toHaveBeenCalled();
    });

    test('should retrieve data from storage when not cached', async () => {
      const key = 'storageKey';
      const value = { id: 'test', name: 'Storage Value' };
      const encryptedValue = JSON.stringify(value); // Simplified - actual implementation uses encryption
      
      chromeMocks.storage.local.get.mockResolvedValueOnce({
        [key]: encryptedValue
      });
      
      const result = await storageManager.get(key);
      
      expect(chromeMocks.storage.local.get).toHaveBeenCalledWith(key);
      expect(storageManager.cache.get(key)).toEqual(value);
    });

    test('should return default value when key does not exist', async () => {
      chromeMocks.storage.local.get.mockResolvedValueOnce({});
      
      const result = await storageManager.get('nonExistentKey', 'defaultValue');
      
      expect(result).toBe('defaultValue');
    });

    test('should handle multiple keys', async () => {
      const keys = ['key1', 'key2', 'key3'];
      const values = {
        key1: 'value1',
        key2: { nested: 'object' },
        key3: [1, 2, 3]
      };
      
      // Mock storage response with encrypted values
      chromeMocks.storage.local.get.mockResolvedValueOnce({
        key1: JSON.stringify(values.key1),
        key2: JSON.stringify(values.key2),
        key3: JSON.stringify(values.key3)
      });
      
      const result = await storageManager.get(keys);
      
      expect(result).toEqual(values);
    });
  });

  describe('remove()', () => {
    beforeEach(async () => {
      await storageManager.initialize();
    });

    test('should remove single key from storage and cache', async () => {
      const key = 'keyToRemove';
      storageManager.cache.set(key, 'someValue');
      
      await storageManager.remove(key);
      
      expect(chromeMocks.storage.local.remove).toHaveBeenCalledWith(key);
      expect(storageManager.cache.has(key)).toBe(false);
    });

    test('should remove multiple keys', async () => {
      const keys = ['key1', 'key2', 'key3'];
      keys.forEach(key => storageManager.cache.set(key, 'value'));
      
      await storageManager.remove(keys);
      
      expect(chromeMocks.storage.local.remove).toHaveBeenCalledWith(keys);
      keys.forEach(key => {
        expect(storageManager.cache.has(key)).toBe(false);
      });
    });
  });

  describe('clear()', () => {
    beforeEach(async () => {
      await storageManager.initialize();
    });

    test('should clear all storage and cache', async () => {
      // Add some items to cache
      storageManager.cache.set('key1', 'value1');
      storageManager.cache.set('key2', 'value2');
      
      await storageManager.clear();
      
      expect(chromeMocks.storage.local.clear).toHaveBeenCalled();
      expect(storageManager.cache.size).toBe(0);
    });
  });

  describe('getStorageInfo()', () => {
    beforeEach(async () => {
      await storageManager.initialize();
    });

    test('should return storage usage information', async () => {
      chromeMocks.storage.local.getBytesInUse.mockResolvedValueOnce(1024);
      
      const info = await storageManager.getStorageInfo();
      
      expect(info).toHaveProperty('bytesInUse');
      expect(info).toHaveProperty('cacheSize');
      expect(info).toHaveProperty('encryptionEnabled');
      expect(info.bytesInUse).toBe(1024);
      expect(info.cacheSize).toBe(storageManager.cache.size);
      expect(info.encryptionEnabled).toBe(storageManager.encryptionKey !== null);
    });
  });

  describe('Encryption', () => {
    beforeEach(async () => {
      await storageManager.initialize();
    });

    test('should encrypt data before storage when encryption is enabled', async () => {
      // Ensure encryption key is set
      storageManager.encryptionKey = 'test-encryption-key';
      
      const key = 'encryptedKey';
      const value = 'sensitive data';
      
      await storageManager.set(key, value);
      
      // Verify that the stored value is not the original plain text
      const storedCall = chromeMocks.storage.local.set.mock.calls[0][0];
      expect(storedCall[key]).not.toBe(value);
      expect(storedCall[key]).not.toBe(JSON.stringify(value));
    });

    test('should decrypt data after retrieval when encryption is enabled', async () => {
      storageManager.encryptionKey = 'test-encryption-key';
      
      const key = 'encryptedKey';
      const originalValue = 'sensitive data';
      
      // First store the data (which encrypts it)
      await storageManager.set(key, originalValue);
      
      // Clear cache to force retrieval from storage
      storageManager.cache.clear();
      
      // Mock the storage call to return the encrypted value
      const encryptedValue = chromeMocks.storage.local.set.mock.calls[0][0][key];
      chromeMocks.storage.local.get.mockResolvedValueOnce({
        [key]: encryptedValue
      });
      
      const retrievedValue = await storageManager.get(key);
      
      expect(retrievedValue).toBe(originalValue);
    });
  });

  describe('Compression', () => {
    beforeEach(async () => {
      await storageManager.initialize();
    });

    test('should compress large data when compression is enabled', async () => {
      const key = 'largeData';
      const largeValue = 'x'.repeat(10000); // Large string
      
      await storageManager.set(key, largeValue);
      
      const storedCall = chromeMocks.storage.local.set.mock.calls[0][0];
      // Compressed data should be smaller than original JSON
      expect(storedCall[key].length).toBeLessThan(JSON.stringify(largeValue).length);
    });

    test('should decompress data on retrieval', async () => {
      const key = 'compressedData';
      const originalValue = { data: 'x'.repeat(5000) };
      
      await storageManager.set(key, originalValue);
      
      // Clear cache and mock storage retrieval
      storageManager.cache.clear();
      const compressedValue = chromeMocks.storage.local.set.mock.calls[0][0][key];
      chromeMocks.storage.local.get.mockResolvedValueOnce({
        [key]: compressedValue
      });
      
      const retrievedValue = await storageManager.get(key);
      
      expect(retrievedValue).toEqual(originalValue);
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await storageManager.initialize();
    });

    test('should handle Chrome storage API errors', async () => {
      const error = new Error('Chrome storage error');
      chromeMocks.storage.local.get.mockRejectedValueOnce(error);
      
      await expect(storageManager.get('testKey')).rejects.toThrow('Chrome storage error');
    });

    test('should handle JSON parsing errors', async () => {
      chromeMocks.storage.local.get.mockResolvedValueOnce({
        invalidJson: 'not-valid-json{'
      });
      
      const result = await storageManager.get('invalidJson', 'default');
      
      expect(result).toBe('default');
    });

    test('should handle encryption/decryption errors', async () => {
      storageManager.encryptionKey = 'valid-key';
      
      // Mock corrupted encrypted data
      chromeMocks.storage.local.get.mockResolvedValueOnce({
        corruptedData: 'corrupted-encrypted-data'
      });
      
      const result = await storageManager.get('corruptedData', 'default');
      
      expect(result).toBe('default');
    });
  });

  describe('Cache Management', () => {
    beforeEach(async () => {
      await storageManager.initialize();
      storageManager.maxCacheSize = 3; // Set small cache size for testing
    });

    test('should implement LRU cache eviction', async () => {
      // Fill cache to capacity
      await storageManager.set('key1', 'value1');
      await storageManager.set('key2', 'value2');
      await storageManager.set('key3', 'value3');
      
      expect(storageManager.cache.size).toBe(3);
      
      // Access key1 to make it most recently used
      await storageManager.get('key1');
      
      // Add new item, should evict key2 (least recently used)
      await storageManager.set('key4', 'value4');
      
      expect(storageManager.cache.has('key1')).toBe(true); // Most recently used
      expect(storageManager.cache.has('key3')).toBe(true);
      expect(storageManager.cache.has('key4')).toBe(true); // Newly added
      expect(storageManager.cache.has('key2')).toBe(false); // Should be evicted
    });

    test('should update item position on cache hit', async () => {
      await storageManager.set('key1', 'value1');
      await storageManager.set('key2', 'value2');
      await storageManager.set('key3', 'value3');
      
      // Access key1 multiple times
      await storageManager.get('key1');
      await storageManager.get('key1');
      
      // Add new item
      await storageManager.set('key4', 'value4');
      
      // key1 should still be in cache due to recent access
      expect(storageManager.cache.has('key1')).toBe(true);
    });
  });
});