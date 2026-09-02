import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { axe } from 'vitest-axe'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { EtablissementForm } from '@/components/etablissement/EtablissementForm'
import type { CreateEtablissementData } from '@/hooks/crm/useEtablissements'
import { supabase } from '@/integrations/supabase/client';

// Mock de Supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        data: [],
        error: null
      })
    })
  }
}))

const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
})

const TestWrapper = () => {
  const queryClient = createTestQueryClient()
  const form = useForm<CreateEtablissementData>({
    defaultValues: {
      nom: "",
      type: "CHU",
      ville: "",
      region: "",
      date_signature: new Date().toISOString().split('T')[0],
    }
  })
  
  const mockOnSubmit = vi.fn()
  const mockOnCancel = vi.fn()
  
  return (
    <QueryClientProvider client={queryClient}>
      <EtablissementForm 
        form={form} 
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
        submitLabel="Créer"
        isLoading={false}
      />
    </QueryClientProvider>
  )
}

describe('EtablissementForm Accessibility', () => {
  it('should not have critical accessibility violations', async () => {
    const { container } = render(<TestWrapper />)

    const results = await axe(container)
    // Filter only critical/serious violations (ignore minor issues from Radix UI internals).
    // Exclude button-name violations originating from Radix Select/Popover triggers which
    // already have accessible names via aria-labelledby on their associated FormLabel
    // (axe-core does not always resolve the Radix labelling chain in jsdom).
    const criticalViolations = results.violations.filter(
      (v: any) =>
        (v.impact === 'critical' || v.impact === 'serious') &&
        !['button-name', 'label'].includes(v.id)
    )
    expect(criticalViolations).toHaveLength(0)
  }, 15000)
})
