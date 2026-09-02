import { cleanup, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import DirectionDashboard from './DirectionDashboard'

const { dashboardMock } = vi.hoisted(() => ({
  dashboardMock: vi.fn(() => null),
}))

vi.mock('@/pages/Dashboard', () => ({
  default: dashboardMock,
}))

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 0,
        gcTime: 0,
      },
      mutations: {
        retry: 0,
      },
    },
  })
}

function renderDirectionDashboard() {
  const queryClient = createQueryClient()

  return render(
    <QueryClientProvider client={queryClient}>
      <DirectionDashboard />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  cleanup()
  dashboardMock.mockClear()
  document.title = 'Titre précédent'
})

afterEach(() => {
  cleanup()
})

describe('DirectionDashboard', () => {
  it('affiche la page Direction avec son titre, son descriptif métier et le dashboard agrégé', () => {
    renderDirectionDashboard()

    expect(screen.getByTestId('direction-page')).toBeTruthy()
    expect(screen.getByRole('heading', { level: 1, name: 'Direction' })).toBeTruthy()
    expect(
      screen.getByText(
        "Vue consolidée des indicateurs de pilotage réservée à l'équipe direction.",
      ),
    ).toBeTruthy()
    expect(dashboardMock).toHaveBeenCalledTimes(1)
  })

  it('définit le titre du document au montage', () => {
    renderDirectionDashboard()

    expect(document.title).toBe('Direction · OpenPulse')
  })

  it('restaure le titre précédent du document au démontage', () => {
    const { unmount } = renderDirectionDashboard()

    expect(document.title).toBe('Direction · OpenPulse')

    unmount()

    expect(document.title).toBe('Titre précédent')
  })
})