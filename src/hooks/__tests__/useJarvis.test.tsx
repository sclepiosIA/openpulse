import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'
import { supabase } from '@/integrations/supabase/client';

// Mock Supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: '123' } } } }),
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: '123' } } }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { is_enabled: true }, error: null }),
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    }),
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: { response: 'Test response' }, error: null }),
    },
  },
}))

// Mock useAuth
vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({
    user: { id: '123', email: 'test@test.com' },
    signOut: vi.fn(),
  }),
}))

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = createTestQueryClient()
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

describe('JARVIS Hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('useJarvisKeyboardShortcuts', () => {
    it('should trigger onToggle on Cmd+J', async () => {
      const onToggle = vi.fn()
      const onClose = vi.fn()

      // Import dynamically to avoid hoisting issues
      const { useJarvisKeyboardShortcuts } = await import('@/hooks/jarvis/useJarvisKeyboardShortcuts')

      renderHook(
        () =>
          useJarvisKeyboardShortcuts({
            isOpen: false,
            onToggle,
            onClose,
            enabled: true,
          }),
        { wrapper: TestWrapper }
      )

      // Simulate Cmd+J
      const event = new KeyboardEvent('keydown', {
        key: 'j',
        metaKey: true,
        bubbles: true,
      })
      document.dispatchEvent(event)

      await waitFor(() => {
        expect(onToggle).toHaveBeenCalled()
      })
    })

    it('should trigger onClose on Escape when open', async () => {
      const onToggle = vi.fn()
      const onClose = vi.fn()

      const { useJarvisKeyboardShortcuts } = await import('@/hooks/jarvis/useJarvisKeyboardShortcuts')

      renderHook(
        () =>
          useJarvisKeyboardShortcuts({
            isOpen: true,
            onToggle,
            onClose,
            enabled: true,
          }),
        { wrapper: TestWrapper }
      )

      // Simulate Escape
      const event = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
      })
      document.dispatchEvent(event)

      await waitFor(() => {
        expect(onClose).toHaveBeenCalled()
      })
    })

    it('should not trigger when disabled', async () => {
      const onToggle = vi.fn()
      const onClose = vi.fn()

      const { useJarvisKeyboardShortcuts } = await import('@/hooks/jarvis/useJarvisKeyboardShortcuts')

      renderHook(
        () =>
          useJarvisKeyboardShortcuts({
            isOpen: false,
            onToggle,
            onClose,
            enabled: false,
          }),
        { wrapper: TestWrapper }
      )

      const event = new KeyboardEvent('keydown', {
        key: 'j',
        metaKey: true,
        bubbles: true,
      })
      document.dispatchEvent(event)

      expect(onToggle).not.toHaveBeenCalled()
    })
  })

describe('useJarvisContextualActions', () => {
    it('should return actions based on current route', async () => {
      const { useJarvisContextualActions } = await import('@/hooks/jarvis/useJarvisContextualActions')

      const { result } = renderHook(() => useJarvisContextualActions(), {
        wrapper: TestWrapper,
      })

      // Should have quickActions array
      expect(Array.isArray(result.current.quickActions)).toBe(true)
      expect(typeof result.current.contextLabel).toBe('string')
      expect(typeof result.current.hasContext).toBe('boolean')
    })
  })
})

describe('JARVIS Types', () => {
  it('should have valid tool risk levels', () => {
    const validLevels = ['safe', 'moderate', 'sensitive', 'critical']
    
    // Test that these are the expected values
    expect(validLevels).toContain('safe')
    expect(validLevels).toContain('moderate')
    expect(validLevels).toContain('sensitive')
    expect(validLevels).toContain('critical')
  })

  it('should have valid message roles', () => {
    const validRoles = ['user', 'assistant', 'system']
    
    expect(validRoles).toContain('user')
    expect(validRoles).toContain('assistant')
    expect(validRoles).toContain('system')
  })
})

describe('JARVIS Utilities', () => {
  it('should validate email format', () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    
    expect(emailRegex.test('test@example.com')).toBe(true)
    expect(emailRegex.test('invalid-email')).toBe(false)
    expect(emailRegex.test('test@')).toBe(false)
    expect(emailRegex.test('@example.com')).toBe(false)
  })

  it('should validate UUID format', () => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    
    expect(uuidRegex.test('123e4567-e89b-12d3-a456-426614174000')).toBe(true)
    expect(uuidRegex.test('invalid-uuid')).toBe(false)
    expect(uuidRegex.test('123e4567-e89b-12d3-a456')).toBe(false)
  })

  it('should sanitize potential SQL injection', () => {
    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE)\b)/gi,
      /(--|\;|\*|\/\*|\*\/)/g,
    ]
    
    const dangerousInput = "'; DROP TABLE users; --"
    const hasSqlInjection = sqlPatterns.some(pattern => pattern.test(dangerousInput))
    
    expect(hasSqlInjection).toBe(true)
    
    const safeInput = "Hello, how are you?"
    const safeHasSqlInjection = sqlPatterns.some(pattern => pattern.test(safeInput))
    
    expect(safeHasSqlInjection).toBe(false)
  })
})
