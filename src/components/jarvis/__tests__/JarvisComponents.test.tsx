import { supabase } from "@/integrations/supabase/client";
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// matchMedia is already polyfilled in src/test-setup.ts

// Mock Supabase
const mockChannel = {
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn().mockReturnThis(),
  unsubscribe: vi.fn(),
}
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi
        .fn()
        .mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    }),
    channel: vi.fn().mockReturnValue(mockChannel),
    removeChannel: vi.fn(),
  },
}))

// Mock des hooks Jarvis qui appellent supabase.channel en interne
vi.mock('@/hooks/jarvis/useJarvisSmartTriggers', () => ({
  useJarvisSmartTriggers: () => ({ triggers: [], hasUrgent: false }),
}))

vi.mock('@/hooks/jarvis/useJarvisIntentPrediction', () => ({
  useJarvisIntentPrediction: () => ({ highConfidencePredictions: [] }),
}))

vi.mock('@/hooks/jarvis/useJarvisKeyboardShortcuts', () => ({
  useJarvisKeyboardShortcuts: () => {},
}))

vi.mock('@/hooks/shared/use-media-query', () => ({
  useMediaQuery: () => false,
}))

vi.mock('@/contexts/JarvisUnifiedContext', () => ({
  useJarvisUnifiedOptional: () => null,
}))

vi.mock('./JarvisPremiumPanel', () => ({
  JarvisPremiumPanel: () => null,
}))

vi.mock('@/components/jarvis/JarvisPremiumPanel', () => ({
  JarvisPremiumPanel: () => null,
}))

// Mock useAuth
vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({
    user: { id: '123', email: 'test@test.com' },
    signOut: vi.fn(),
  }),
}))

// Mock useJarvis
vi.mock('@/hooks/jarvis/useJarvis', () => ({
  useJarvis: () => ({
    isEnabled: true,
    pendingCount: 0,
    settings: {},
    updateSettings: vi.fn(),
  }),
}))

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    button: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) => (
      <button {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}>{children}</button>
    ),
    div: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) => (
      <div {...(props as React.HTMLAttributes<HTMLDivElement>)}>{children}</div>
    ),
    img: ({ alt, ...props }: { alt?: string; [key: string]: unknown }) => (
      <img alt={alt} {...(props as React.ImgHTMLAttributes<HTMLImageElement>)} />
    ),
  },
  AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}))

// Mock image import
vi.mock('@/assets/marque/logo.png', () => ({
  default: 'test-image.png',
}))

import { TooltipProvider } from '@/components/ui/tooltip'
import type { JarvisPendingAction } from '@/types/jarvis'

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
      <MemoryRouter>
        <TooltipProvider>{children}</TooltipProvider>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('JarvisLogoTrigger Component', () => {
  it('should render the logo trigger button', async () => {
    const { JarvisLogoTrigger } = await import('@/components/jarvis/JarvisLogoTrigger')

    render(
      <TestWrapper>
        <JarvisLogoTrigger />
      </TestWrapper>
    )

    // Should have an accessible button
    const button = screen.getByRole('button', { name: /jarvis|openpulse/i })
    expect(button).toBeInTheDocument()
  })

  it('should render in collapsed mode with smaller size', async () => {
    const { JarvisLogoTrigger } = await import('@/components/jarvis/JarvisLogoTrigger')

    render(
      <TestWrapper>
        <JarvisLogoTrigger collapsed={true} />
      </TestWrapper>
    )

    const button = screen.getByRole('button', { name: /jarvis|openpulse/i })
    expect(button).toBeInTheDocument()
  })

  it('should have aria-label for accessibility', async () => {
    const { JarvisLogoTrigger } = await import('@/components/jarvis/JarvisLogoTrigger')

    render(
      <TestWrapper>
        <JarvisLogoTrigger />
      </TestWrapper>
    )

    const button = screen.getByLabelText(/ouvrir jarvis/i)
    expect(button).toBeInTheDocument()
  })
})

describe('JarvisThinkingIndicator Component', () => {
  it('should export component correctly', async () => {
    const module = await import('@/components/jarvis/JarvisThinkingIndicator')
    expect(module.JarvisThinkingIndicator).toBeDefined()
    // Component may be exported as function or object (memo/forwardRef)
    expect(['function', 'object']).toContain(typeof module.JarvisThinkingIndicator)
  })
})

describe('JarvisActionCard Component', () => {
  it('should render action card with proposed action', async () => {
    const { JarvisActionCard } = await import('@/components/jarvis/JarvisActionCard')

    const mockAction = {
      id: 'test-action-id',
      user_id: 'user-123',
      trigger_type: 'proactive_email' as const,
      trigger_entity_id: 'entity-123',
      trigger_entity_type: 'email_thread',
      context: {
        etablissement: undefined,
        email_thread: undefined,
        current_user: { id: 'user-123', name: 'Test User' },
      },
      proposed_action: {
        type: 'create_task' as const,
        data: { title: 'Test Task', description: 'Test description' },
        preview_text: 'Créer une tâche: Test Task',
        confidence_score: 0.85,
        reasoning: 'Based on email content',
      },
      kb_sources: [],
      status: 'pending' as const,
      ai_response: null,
      user_modification: null,
      execution_result: null,
      error_message: null,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 86400000).toISOString(),
      reviewed_at: null,
      executed_at: null,
      user_feedback: null,
      feedback_rating: null,
    }

    const handleApprove = vi.fn()
    const handleReject = vi.fn()
    const handleModify = vi.fn()

    render(
      <TestWrapper>
        <JarvisActionCard
          action={mockAction as unknown as JarvisPendingAction}
          onApprove={handleApprove}
          onReject={handleReject}
          onModify={handleModify}
        />
      </TestWrapper>
    )

    // Verify the component rendered real content (not just an empty body)
    const container = document.body.querySelector('[class]')
    expect(container).not.toBeNull()
  })
})
