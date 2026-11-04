const fallback = new Map<string, string>();
export function readBrowserValue(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return fallback.get(key) ?? null;
  }
}
export function writeBrowserValue(key: string, value: string): void {
  fallback.set(key, value);
  try {
    localStorage.setItem(key, value);
  } catch {
    return;
  }
}
export function removeBrowserValue(key: string): void {
  fallback.delete(key);
  try {
    localStorage.removeItem(key);
  } catch {
    return;
  }
}
