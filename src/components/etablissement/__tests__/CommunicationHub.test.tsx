import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Évite l'import de pdfjs-dist qui nécessite DOMMatrix (non disponible dans jsdom)
vi.mock('@/components/email/AttachmentPreview', () => ({
  AttachmentPreview: () => null,
}))

vi.mock('@/lib/supabaseBrowser', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p: any = new Proxy(
    {
      then: (resolve: (v: { data: never[]; error: null; count: number }) => void) =>
        resolve({ data: [], error: null, count: 0 }),
    },
    { get: (target: any, prop) => (prop === 'then' ? target.then : (..._a: unknown[]) => p) }
  )
  return { supabase: p }
})

vi.mock('@/integrations/supabase/client', () => {
  type Chainable = { [K: string]: (...args: unknown[]) => Chainable }
  const p: Chainable = new Proxy({} as Chainable, {
    get:
      () =>
      (..._a: unknown[]) =>
        p,
  })
  return { supabase: p }
})

import { CommunicationHub } from '../CommunicationHub'
import { supabase } from '@/integrations/supabase/client';

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })

describe('CommunicationHub', () => {
  it('renders search input', () => {
    render(
      <QueryClientProvider client={qc}>
        <CommunicationHub etablissementId="e1" etablissementNom="CHU Test" />
      </QueryClientProvider>
    )
    expect(screen.getByPlaceholderText(/Rechercher/i)).toBeInTheDocument()
  })
})
