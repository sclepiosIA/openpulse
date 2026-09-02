import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('@/hooks/competences/useCompetencesKPIs', () => ({
  useCompetencesKPIs: () => ({
    data: {
      totalCompetences: 25,
      totalEmployeesWithCompetences: 12,
      averageCompetencesPerEmployee: 3.5,
      expiringCertifications: 2,
    },
    isLoading: false,
  }),
}))
vi.mock('@/hooks/competences/useReferentielCompetences', () => ({
  useReferentielCompetences: () => ({
    competences: [],
    competencesByCategory: {},
    isLoading: false,
  }),
}))
vi.mock('@/hooks/hr/useEmployeeCertifications', () => ({
  useReferentielCertifications: () => ({
    certifications: [],
    isLoading: false,
  }),
  useEmployeeCertifications: () => ({
    employeeCertifications: [],
    expiringCertifications: [],
    isLoading: false,
    addCertification: { isPending: false, mutateAsync: vi.fn() },
  }),
}))
vi.mock('@/hooks/rd/usePlansDeveloppement', () => ({
  usePlansDeveloppement: () => ({
    plans: [],
    isLoading: false,
  }),
}))
vi.mock('@/hooks/ui/use-mobile', () => ({
  useIsMobile: () => false,
}))

import Competences from '../Competences'

describe('Competences page', () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  it('renders without crashing', () => {
    const { container } = render(
      <QueryClientProvider client={qc}>
        <Competences />
      </QueryClientProvider>
    )
    expect(container.firstElementChild).toBeTruthy()
  })

  it('renders KPI values', () => {
    render(
      <QueryClientProvider client={qc}>
        <Competences />
      </QueryClientProvider>
    )
    expect(screen.getByText('25')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
  })
})
