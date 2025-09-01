/**
 * Basic test to validate Jest setup
 */

describe('Jest Setup Validation', () => {
  test('should have Chrome API mocked', () => {
    expect(chrome).toBeDefined();
    expect(chrome.storage).toBeDefined();
    expect(chrome.storage.local).toBeDefined();
    expect(chrome.runtime).toBeDefined();
  });

  test('should have fetch API mocked', () => {
    expect(fetch).toBeDefined();
    expect(typeof fetch).toBe('function');
  });

  test('should have crypto API mocked', () => {
    expect(crypto).toBeDefined();
    expect(crypto.subtle).toBeDefined();
    expect(crypto.getRandomValues).toBeDefined();
  });

  test('should be able to call Chrome storage API', async () => {
    const result = await chrome.storage.local.get('test');
    expect(chrome.storage.local.get).toHaveBeenCalledWith('test');
  });
});