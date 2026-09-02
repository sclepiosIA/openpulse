// Safe wrapper around localStorage to avoid errors in restricted environments (iframes, private mode)
import { debug } from '@/lib/debug';
let _storageAvailable: boolean | null = null;

function isStorageAvailable(): boolean {
  if (_storageAvailable !== null) return _storageAvailable;
  try {
    if (typeof localStorage === "undefined") {
      _storageAvailable = false;
      return _storageAvailable;
    }
    const test = "__storage_test__";
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    _storageAvailable = true;
  } catch (e) {
    debug.warn("[safeStorage] localStorage unavailable:", e);
    _storageAvailable = false;
  }
  return _storageAvailable;
}

export const safeStorage = {
  getItem(key: string): string | null {
    if (!isStorageAvailable()) return null;
    try {
      return localStorage.getItem(key);
    } catch (e) {
      debug.warn("[safeStorage] getItem failed:", e);
      return null;
    }
  },
  setItem(key: string, value: string): void {
    if (!isStorageAvailable()) return;
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      debug.warn("[safeStorage] setItem failed:", e);
    }
  },
  removeItem(key: string): void {
    if (!isStorageAvailable()) return;
    try {
      localStorage.removeItem(key);
    } catch (e) {
      debug.warn("[safeStorage] removeItem failed:", e);
    }
  },
  clear(): void {
    if (!isStorageAvailable()) return;
    try {
      localStorage.clear();
    } catch (e) {
      debug.warn("[safeStorage] clear failed:", e);
    }
  },
};
