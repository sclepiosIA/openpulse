import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOfflineStatus } from '../shared/useOfflineStatus';

describe('useOfflineStatus', () => {
  it('starts with online status', () => {
    const { result } = renderHook(() => useOfflineStatus());
    expect(result.current.isOnline).toBe(true);
    expect(result.current.isOffline).toBe(false);
    expect(result.current.wasOffline).toBe(false);
  });

  it('detects offline event', () => {
    const { result } = renderHook(() => useOfflineStatus());
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(result.current.isOnline).toBe(false);
    expect(result.current.isOffline).toBe(true);
    expect(result.current.wasOffline).toBe(true);
  });

  it('detects online event after offline', () => {
    const { result } = renderHook(() => useOfflineStatus());
    act(() => { window.dispatchEvent(new Event('offline')); });
    act(() => { window.dispatchEvent(new Event('online')); });
    expect(result.current.isOnline).toBe(true);
    expect(result.current.isOffline).toBe(false);
  });
});
