import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useContacts } from '@/hooks/crm/useContacts'

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('useContacts', () => {
  it('should return hook structure', () => {
    const { result } = renderHook(() => useContacts('etab-1'), {
      wrapper: createWrapper()
    })

    expect(result.current).toHaveProperty('contacts')
    expect(result.current).toHaveProperty('isLoading')
  })
})