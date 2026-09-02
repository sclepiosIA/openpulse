import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('react-pdf', () => ({
  Document: () => <div />,
  Page: () => <div />,
  pdfjs: { GlobalWorkerOptions: { workerSrc: '' } },
}))
vi.mock('pdfjs-dist/build/pdf.worker.min.mjs?url', () => ({ default: '' }))
vi.mock('@/hooks/crm/useEtablissements', () => ({
  useEtablissement: () => ({ data: null, isLoading: true }),
}))
vi.mock('@/hooks/analytics/useTasksBreakdown', () => ({
  useTasksBreakdown: () => ({ data: null, isLoading: false }),
}))
vi.mock('@/hooks/tasks/useTaches', () => ({
  useTachesByEtablissement: () => ({ data: [], isLoading: false }),
}))
vi.mock('@/hooks/tasks/useRegenerateTasks', () => ({
  useRegenerateTasks: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))
vi.mock('@/hooks/ui/use-mobile', () => ({ useIsMobile: () => false }))
vi.mock('@/hooks/shared/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('@/hooks/shared/useNavigationHistory', () => ({
  useNavigationHistory: () => ({
    history: [],
    goTo: vi.fn(),
    goBack: vi.fn(),
    clearHistory: vi.fn(),
    canGoBack: false,
    pushVirtualEntry: vi.fn(),
    popVirtualEntry: vi.fn(),
    replaceCurrentLabel: vi.fn(),
  }),
}))

import EtablissementDetail from '../EtablissementDetail'

describe('EtablissementDetail page', () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  it('renders loading state', () => {
    const { container } = render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/etablissements/11111111-1111-4111-8111-111111111111']}>
          <Routes>
            <Route path="/etablissements/:id" element={<EtablissementDetail />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    )
    expect(container.firstElementChild).toBeTruthy()
  })
})
