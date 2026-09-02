import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { use2FA } from '../auth/use2FA';

const { authState, mockDebugError } = vi.hoisted(() => ({
  authState: {
    user: { id: 'test-user-id', email: 'test@test.com' } as { id: string; email: string } | null,
  },
  mockDebugError: vi.fn(),
}));

const mockInvoke = vi.fn();
const mockGetSession = vi.fn();
const mockFrom = vi.fn();
const mockListFactors = vi.fn();

vi.mock('@/lib/supabaseBrowser', () => ({
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
      mfa: {
        listFactors: () => mockListFactors(),
      },
    },
    functions: { invoke: (...args: any[]) => mockInvoke(...args) },
    from: (...args: any[]) => mockFrom(...args),
  },
}));

// AuthProvider mock — use2FA calls useAuth() to access the current user.
vi.mock('@/components/AuthProvider', () => ({
  AuthProvider: ({ children }: { children: any }) => children,
  useAuth: () => ({
    user: authState.user,
    session: { access_token: 'mock-token' },
    loading: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  }),
  useAuthSafe: () => ({
    user: authState.user,
    session: { access_token: 'mock-token' },
    loading: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  }),
}));

vi.mock('@/lib/debug', () => ({
  debug: {
    error: mockDebugError,
  },
}));

describe('use2FA', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.user = { id: 'test-user-id', email: 'test@test.com' };
  });

  it('returns validate and check functions', () => {
    const { result } = renderHook(() => use2FA());
    expect(typeof result.current.validate2FAToken).toBe('function');
    expect(typeof result.current.check2FAEnabled).toBe('function');
    expect(result.current.isLoading).toBe(false);
  });

  describe('validate2FAToken', () => {
    it('returns false when no session', async () => {
      mockGetSession.mockResolvedValue({ data: { session: null } });

      const { result } = renderHook(() => use2FA());
      let valid: boolean = true;
      await act(async () => {
        valid = await result.current.validate2FAToken('123456');
      });

      expect(valid).toBe(false);
    });

    it('returns true when token is valid', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: { access_token: 'token-abc' } },
      });
      mockInvoke.mockResolvedValue({ data: { valid: true }, error: null });

      const { result } = renderHook(() => use2FA());
      let valid = false;
      await act(async () => {
        valid = await result.current.validate2FAToken('123456');
      });

      expect(valid).toBe(true);
      expect(mockInvoke).toHaveBeenCalledWith('generate-2fa-secret', {
        body: { action: 'validate', token: '123456' },
        headers: { Authorization: 'Bearer token-abc' },
      });
    });

    it('returns false on edge function error', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: { access_token: 'token-abc' } },
      });
      mockInvoke.mockResolvedValue({ data: null, error: new Error('fail') });

      const { result } = renderHook(() => use2FA());
      let valid = true;
      await act(async () => {
        valid = await result.current.validate2FAToken('000000');
      });

      expect(valid).toBe(false);
    });
  });

  describe('check2FAEnabled', () => {
    it('returns false when no user', async () => {
      authState.user = null;
      mockGetSession.mockResolvedValue({ data: { session: null } });

      const { result } = renderHook(() => use2FA());
      let enabled = true;
      await act(async () => {
        enabled = await result.current.check2FAEnabled();
      });

      expect(enabled).toBe(false);
      expect(mockListFactors).not.toHaveBeenCalled();
      expect(mockDebugError).not.toHaveBeenCalled();
    });

    it('returns true when 2FA is enabled', async () => {
      mockListFactors.mockResolvedValue({
        data: {
          all: [{ factorType: 'totp', status: 'verified' }],
          totp: [{ factorType: 'totp', status: 'verified' }],
          phone: [],
        },
        error: null,
      });

      const { result } = renderHook(() => use2FA());
      let enabled = false;
      await act(async () => {
        enabled = await result.current.check2FAEnabled();
      });

      expect(enabled).toBe(true);
    });

    it('returns false when 2FA is not enabled', async () => {
      mockListFactors.mockResolvedValue({
        data: {
          all: [],
          totp: [],
          phone: [],
        },
        error: null,
      });

      const { result } = renderHook(() => use2FA());
      let enabled = true;
      await act(async () => {
        enabled = await result.current.check2FAEnabled();
      });

      expect(enabled).toBe(false);
    });
  });
});
