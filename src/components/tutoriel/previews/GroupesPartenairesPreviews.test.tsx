const { ROWS, mockFrom } = vi.hoisted(() => ({
  ROWS: [{ id: '1', name: 'Test Row' }],
  mockFrom: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        gte: vi.fn(() => ({
          lte: vi.fn(() => ({
            in: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(() => ({
                  then: (cb: any) => cb({ data: [{ id: '1' }], error: null }),
                  catch: vi.fn(() => ({ data: [{ id: '1' }], error: null })),
                })),
              })),
            })),
          })),
        })),
      })),
    })),
    single: vi.fn(() => Promise.resolve({ data: ROWS, error: null })),
    maybeSingle: vi.fn(() => Promise.resolve({ data: ROWS[0], error: null })),
  })),
}))

const { user, session } = vi.hoisted(() => ({
  user: { id: 'u1', email: 't@t.co' },
  session: { user: { id: 'u1' } },
}))

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: mockFrom },
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user,
    session,
    isLoading: false,
  }),
}))

vi.mock('react-router-dom', () => ({
  useNavigate: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock('../TutorielCountUpAnimation', () => ({
  TutorielCountUpAnimation: (props: any) => props.value,
}))

import React from 'react'
import { render, screen, renderHook } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { GroupeCardPreview, PartenaireCardPreview, RelationsTimelinePreview } from './GroupesPartenairesPreviews'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

function renderWithQueryClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })
  return render(ui, {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  })
}

describe('GroupesPartenairesPreviews - visuels de preview', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders GroupeCardPreview with core content', () => {
    // Hook wrapper (stable) to satisfy wrapper usage
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: {
              queries: { retry: 0, gcTime: 0 },
              mutations: { retry: 0 },
            },
          })
        }
      >
        {children}
      </QueryClientProvider>
    )
    renderHook(() => null, { wrapper })
    render(<GroupeCardPreview />, { wrapper })
    expect(screen.getByText('Groupement Rhône-Alpes')).toBeTruthy()
    expect(screen.getByText('Établissements')).toBeTruthy()
    expect(screen.getByText('Voir le groupe')).toBeTruthy()
  })

  it('renders PartenaireCardPreview with core content', () => {
    renderWithQueryClient(<PartenaireCardPreview />)
    expect(screen.getByText('MedTech Solutions')).toBeTruthy()
    expect(screen.getByText('Intégrateur')).toBeTruthy()
    expect(screen.getByText('Paris')).toBeTruthy()
    expect(screen.getByText('contact@medtech-solutions.fr')).toBeTruthy()
  })

  it('renders RelationsTimelinePreview with core content', () => {
    renderWithQueryClient(<RelationsTimelinePreview />)
    expect(screen.getByText('Historique des relations')).toBeTruthy()
    expect(screen.getByText(/Email envoyé/)).toBeTruthy()
  })
})