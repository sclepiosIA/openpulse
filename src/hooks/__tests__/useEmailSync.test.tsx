import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// Mock modules before importing the hook
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: vi.fn()
    }
  }
}))

vi.mock('@/lib/supabaseTyped', () => ({
  fromExtended: vi.fn()
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn()
  }
}))

vi.mock('@/lib/debug', () => ({
  debug: {
    log: vi.fn(),
    error: vi.fn()
  }
}))

vi.mock('@/hooks/shared/useErrorHandler', () => ({
  useErrorHandler: () => ({
    handleError: vi.fn()
  })
}))

import { useEmailSync } from '../email/useEmailSync'
import { supabase } from '@/integrations/supabase/client'
import { fromExtended } from '@/lib/supabaseTyped'
import { toast } from 'sonner'

interface WrapperProps {
  children: React.ReactNode
}

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  })
  return ({ children }: WrapperProps) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('useEmailSync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('syncNow', () => {
    it('should sync emails for a single account successfully', async () => {
      const mockInvoke = vi.fn().mockResolvedValue({ 
        data: { emailsSynced: 5 }, 
        error: null 
      })
      vi.mocked(supabase.functions.invoke).mockImplementation(mockInvoke)

      const { result } = renderHook(
        () => useEmailSync('account-123'),
        { wrapper: createWrapper() }
      )

      await act(async () => {
        await result.current.syncNow()
      })

      expect(mockInvoke).toHaveBeenCalledWith('sync-emails', {
        body: { account_id: 'account-123', full_resync: false }
      })
      expect(toast.success).toHaveBeenCalledWith('5 nouveaux emails synchronisés')
    })

    it('should show error toast when no account is selected', async () => {
      const { result } = renderHook(
        () => useEmailSync(undefined),
        { wrapper: createWrapper() }
      )

      await act(async () => {
        await result.current.syncNow()
      })

      expect(toast.error).toHaveBeenCalledWith('Aucun compte email sélectionné')
    })

    it('should sync all accounts when accountId is "all"', async () => {
      const allAccounts = [
        { id: 'acc-1', email_address: 'test1@example.com' },
        { id: 'acc-2', email_address: 'test2@example.com' }
      ]

      const mockInvoke = vi.fn()
        .mockResolvedValueOnce({ data: { emailsSynced: 3 }, error: null })
        .mockResolvedValueOnce({ data: { emailsSynced: 0 }, error: null }) // reconcile acc-1
        .mockResolvedValueOnce({ data: { emailsSynced: 2 }, error: null })
        .mockResolvedValueOnce({ data: { emailsSynced: 0 }, error: null }) // reconcile acc-2

      vi.mocked(supabase.functions.invoke).mockImplementation(mockInvoke)

      const { result } = renderHook(
        () => useEmailSync('all', allAccounts),
        { wrapper: createWrapper() }
      )

      await act(async () => {
        await result.current.syncNow()
      })

      // Should have been called for each account
      expect(mockInvoke).toHaveBeenCalledTimes(4)
      expect(toast.success).toHaveBeenCalled()
    })
  })

  describe('fullSync', () => {
    it('should perform full resync with full_resync flag', async () => {
      const mockInvoke = vi.fn().mockResolvedValue({ 
        data: { emailsSynced: 100 }, 
        error: null 
      })
      vi.mocked(supabase.functions.invoke).mockImplementation(mockInvoke)

      const { result } = renderHook(
        () => useEmailSync('account-456'),
        { wrapper: createWrapper() }
      )

      await act(async () => {
        await result.current.fullSync()
      })

      expect(mockInvoke).toHaveBeenCalledWith('sync-emails', {
        body: { account_id: 'account-456', full_resync: true }
      })
      expect(toast.success).toHaveBeenCalledWith(
        expect.stringContaining('Synchronisation complète effectuée')
      )
    })
  })

  describe('reconcileEmails', () => {
    it('should call sync-emails with reconcile_only flag', async () => {
      const mockInvoke = vi.fn().mockResolvedValue({ 
        data: { deleted_count: 3 }, 
        error: null 
      })
      vi.mocked(supabase.functions.invoke).mockImplementation(mockInvoke)

      const { result } = renderHook(
        () => useEmailSync('account-789'),
        { wrapper: createWrapper() }
      )

      let deletedCount: number
      await act(async () => {
        deletedCount = await result.current.reconcileEmails()
      })

      expect(mockInvoke).toHaveBeenCalledWith('sync-emails', {
        body: { account_id: 'account-789', reconcile_only: true }
      })
      expect(deletedCount!).toBe(3)
    })

    it('should return 0 when accountId is "all"', async () => {
      const { result } = renderHook(
        () => useEmailSync('all'),
        { wrapper: createWrapper() }
      )

      let deletedCount: number
      await act(async () => {
        deletedCount = await result.current.reconcileEmails()
      })

      expect(deletedCount!).toBe(0)
    })
  })

  describe('getLastSyncDate', () => {
    it('should return last sync date from the account', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { last_sync_at: '2024-01-15T10:30:00Z' },
            error: null
          })
        })
      })
      vi.mocked(fromExtended).mockReturnValue({ select: mockSelect } as any)

      const { result } = renderHook(
        () => useEmailSync('account-123'),
        { wrapper: createWrapper() }
      )

      let lastSync: string | null = null
      await act(async () => {
        lastSync = await result.current.getLastSyncDate() ?? null
      })

      expect(lastSync).toBe('2024-01-15T10:30:00Z')
    })

    it('should return null when accountId is "all"', async () => {
      const { result } = renderHook(
        () => useEmailSync('all'),
        { wrapper: createWrapper() }
      )

      let lastSync: string | null = null
      await act(async () => {
        lastSync = await result.current.getLastSyncDate() ?? null
      })

      expect(lastSync).toBeNull()
    })
  })

  describe('syncing state', () => {
    it('should track syncing state correctly', async () => {
      const mockInvoke = vi.fn().mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({ data: { emailsSynced: 1 }, error: null }), 100)
        )
      )
      vi.mocked(supabase.functions.invoke).mockImplementation(mockInvoke)

      const { result } = renderHook(
        () => useEmailSync('account-123'),
        { wrapper: createWrapper() }
      )

      expect(result.current.isSyncing).toBe(false)

      act(() => {
        result.current.syncNow()
      })

      // isSyncing should be true during sync
      expect(result.current.isSyncing).toBe(true)

      await waitFor(() => {
        expect(result.current.isSyncing).toBe(false)
      })
    })
  })
})
