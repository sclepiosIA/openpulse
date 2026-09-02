import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RDAnalytics } from '../RDAnalytics'

const { SPRINTS_DATA, STORIES_DATA } = vi.hoisted(() => ({
  SPRINTS_DATA: [] as { id: string; numero: number; statut: string }[],
  STORIES_DATA: [] as { id: string; statut: string; priorite: string }[],
}))

vi.mock('@/hooks/rd/useRD', () => ({
  useRDSprints: () => ({ data: SPRINTS_DATA }),
  useRDUserStories: () => ({ data: STORIES_DATA }),
  useProjetStats: () => ({
    data: {
      total_stories: 0,
      total_points: 0,
      avgVelocity: 0,
      doneStories: 0,
      totalStories: 0,
      inProgressStories: 0,
      totalPoints: 0,
    },
  }),
  useActiveSprint: () => ({ data: null }),
}))

vi.mock('@/hooks/rd/useSprintHistory', () => ({
  useSprintBurndown: () => ({ data: [] }),
  useCumulativeFlowData: () => ({ data: [] }),
}))

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })

describe('RDAnalytics', () => {
  it('renders analytics cards', () => {
    render(
      <QueryClientProvider client={qc}>
        <RDAnalytics projetId="p1" />
      </QueryClientProvider>
    )
    expect(screen.getByText('Vélocité par Sprint')).toBeInTheDocument()
  })

  it('renders cumulative flow chart title', () => {
    render(
      <QueryClientProvider client={qc}>
        <RDAnalytics projetId="p1" />
      </QueryClientProvider>
    )
    expect(screen.getAllByText(/Flux Cumulatif/i)[0]).toBeInTheDocument()
  })
})
