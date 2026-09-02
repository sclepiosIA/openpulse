import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { axe } from 'vitest-axe'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppSidebar } from '../AppSidebar'
import { AuthProvider } from '../AuthProvider'
import { SidebarProvider } from '../ui/sidebar'
import { supabase } from '@/integrations/supabase/client';

// Mock du module d'icônes
vi.mock('@/assets/marque/logo.png', () => ({
  default: 'data:image/png;base64,test'
}))

// Mock de Supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
      signOut: vi.fn()
    }
  }
}))

// Mock JarvisProactiveAlerts context
vi.mock('@/contexts/JarvisProactiveAlertsContext', () => ({
  useJarvisProactiveAlertsContext: () => ({
    unreadCount: 0,
    alerts: [],
    isLoading: false,
    markAsRead: vi.fn(),
    dismissAlert: vi.fn(),
  }),
  JarvisProactiveAlertsProvider: ({ children }: { children: React.ReactNode }) => children,
}))

const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
})

const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = createTestQueryClient()
  
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AuthProvider>
          <SidebarProvider>
            {children}
          </SidebarProvider>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('AppSidebar Accessibility', () => {
  it('should not have any accessibility violations', async () => {
    const { container } = render(
      <TestWrapper>
        <AppSidebar />
      </TestWrapper>
    )

    const results = await axe(container)
    expect(results.violations).toHaveLength(0)
  }, 15_000)
})
