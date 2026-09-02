import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

const mockLocation = vi.fn();
vi.mock('react-router-dom', () => ({
  useLocation: () => mockLocation(),
}));

import { usePublicRoute } from '../shared/usePublicRoute';

describe('usePublicRoute', () => {
  it('returns true for /utilisateurs', () => {
    mockLocation.mockReturnValue({ pathname: '/utilisateurs' });
    const { result } = renderHook(() => usePublicRoute());
    expect(result.current).toBe(true);
  });

  it('returns true for /enquete-satisfaction-solution', () => {
    mockLocation.mockReturnValue({ pathname: '/enquete-satisfaction-solution' });
    const { result } = renderHook(() => usePublicRoute());
    expect(result.current).toBe(true);
  });

  it('returns true for /m/app-name/install', () => {
    mockLocation.mockReturnValue({ pathname: '/m/my-app/install' });
    const { result } = renderHook(() => usePublicRoute());
    expect(result.current).toBe(true);
  });

  it('returns true for /rdv/some-slug', () => {
    mockLocation.mockReturnValue({ pathname: '/rdv/booking-page' });
    const { result } = renderHook(() => usePublicRoute());
    expect(result.current).toBe(true);
  });

  it('returns false for /etablissements', () => {
    mockLocation.mockReturnValue({ pathname: '/etablissements' });
    const { result } = renderHook(() => usePublicRoute());
    expect(result.current).toBe(false);
  });

  it('returns false for /emails', () => {
    mockLocation.mockReturnValue({ pathname: '/emails' });
    const { result } = renderHook(() => usePublicRoute());
    expect(result.current).toBe(false);
  });

  it('returns true for /auth/reset-password', () => {
    mockLocation.mockReturnValue({ pathname: '/auth/reset-password' });
    const { result } = renderHook(() => usePublicRoute());
    expect(result.current).toBe(true);
  });
});
