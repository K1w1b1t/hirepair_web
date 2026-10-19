import { readBrowserValue, removeBrowserValue, writeBrowserValue } from './browser-storage';
describe('browser storage failures', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    localStorage.clear();
  });
  it('preserves values in memory if the browser refuses persistence', () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readBrowserValue('fallback-test')).toBeNull();
    writeBrowserValue('fallback-test', 'value');
    expect(readBrowserValue('fallback-test')).toBe('value');
    removeBrowserValue('fallback-test');
    expect(readBrowserValue('fallback-test')).toBeNull();
  });
  it('uses persistent storage when it is available', () => {
    writeBrowserValue('test-key', 'value');
    expect(readBrowserValue('test-key')).toBe('value');
    removeBrowserValue('test-key');
    expect(readBrowserValue('test-key')).toBeNull();
  });
});
