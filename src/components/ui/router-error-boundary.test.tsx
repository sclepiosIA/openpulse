import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterErrorBoundary } from './router-error-boundary'

const {
  debugWarn,
  fullPageLoaderText,
  unregisterMock,
  reloadMock,
  cacheKeysMock,
  cacheDeleteMock,
  getRegistrationsMock,
} = vi.hoisted(() => {
  const debugWarn = vi.fn()
  const fullPageLoaderText = 'FULL_PAGE_LOADER'
  const unregisterMock = vi.fn().mockResolvedValue(true)
  const reloadMock = vi.fn()
  const cacheKeysMock = vi.fn().mockResolvedValue(['k1', 'k2'])
  const cacheDeleteMock = vi.fn().mockResolvedValue(true)
  const getRegistrationsMock = vi.fn().mockResolvedValue([{ unregister: unregisterMock }])
  return {
    debugWarn,
    fullPageLoaderText,
    unregisterMock,
    reloadMock,
    cacheKeysMock,
    cacheDeleteMock,
    getRegistrationsMock,
  }
})

vi.mock('@/lib/debug', () => ({
  debug: { warn: debugWarn },
}))

vi.mock('./full-page-loader', () => ({
  FullPageLoader: () => <div data-testid="full-page-loader">{fullPageLoaderText}</div>,
}))

vi.mock('./button', () => ({
  Button: ({
    children,
    onClick,
    variant,
  }: {
    children: React.ReactNode
    onClick?: () => void
    variant?: string
  }) => (
    <button type="button" data-variant={variant ?? ''} onClick={onClick}>
      {children}
    </button>
  ),
}))

vi.mock('lucide-react', () => ({
  RefreshCw: (props: Record<string, unknown>) => <svg data-testid="icon-refresh" {...props} />,
  AlertTriangle: (props: Record<string, unknown>) => <svg data-testid="icon-alert" {...props} />,
}))

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })
}

function renderWithProviders(ui: React.ReactElement) {
  const client = createQueryClient()
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

describe('RouterErrorBoundary', () => {
  it('renders children when no error', () => {
    renderWithProviders(
      <RouterErrorBoundary>
        <div>OK_CHILD</div>
      </RouterErrorBoundary>,
    )

    expect(screen.getByText('OK_CHILD')).toBeTruthy()
    expect(screen.queryByTestId('full-page-loader')).toBeNull()
    expect(debugWarn).not.toHaveBeenCalled()
  })

  it('captures chunk loading errors and can retry to render children again (no remount)', async () => {
    const Thrower = ({ shouldThrow }: { shouldThrow: boolean }) => {
      if (shouldThrow) throw new Error('Loading chunk 1 failed')
      return <div>RECOVERED_CHILD</div>
    }

    renderWithProviders(
      <RouterErrorBoundary>
        <Thrower shouldThrow />
      </RouterErrorBoundary>,
    )

    expect(screen.getByText('Erreur de chargement')).toBeTruthy()
    expect(
      screen.getByText(
        'Une mise à jour est disponible ou la connexion a été interrompue. Rechargez la page pour continuer.',
      ),
    ).toBeTruthy()
    expect(screen.getByTestId('icon-alert')).toBeTruthy()
    expect(screen.getByTestId('icon-refresh')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }))

    renderWithProviders(
      <RouterErrorBoundary>
        <Thrower shouldThrow={false} />
      </RouterErrorBoundary>,
    )

    expect(screen.getByText('RECOVERED_CHILD')).toBeTruthy()
  })

  it('calls reload cleanup (service worker + caches) then window.location.reload on "Recharger la page"', async () => {
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { getRegistrations: getRegistrationsMock },
      configurable: true,
    })

    Object.defineProperty(window, 'caches', {
      value: {
        keys: cacheKeysMock,
        delete: cacheDeleteMock,
      },
      configurable: true,
    })

    Object.defineProperty(window, 'location', {
      value: { reload: reloadMock },
      configurable: true,
    })

    const Thrower = () => {
      throw new Error('Failed to fetch')
    }

    renderWithProviders(
      <RouterErrorBoundary>
        <Thrower />
      </RouterErrorBoundary>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Recharger la page' }))

    await waitFor(() => {
      expect(getRegistrationsMock).toHaveBeenCalledTimes(1)
      expect(unregisterMock).toHaveBeenCalledTimes(1)
      expect(cacheKeysMock).toHaveBeenCalledTimes(1)
      expect(cacheDeleteMock).toHaveBeenCalledTimes(2)
      expect(reloadMock).toHaveBeenCalledTimes(1)
    })

    const deletedKeys = cacheDeleteMock.mock.calls.map(args => String(args[0]))
    expect(deletedKeys).toEqual(['k1', 'k2'])
  })

  it('uses fallback prop for router-context handled errors', () => {
    const Thrower = () => {
      throw new Error('useNavigate may be used only in the context of a <Router> component')
    }

    renderWithProviders(
      <RouterErrorBoundary fallback={<div>MY_FALLBACK</div>}>
        <Thrower />
      </RouterErrorBoundary>,
    )

    expect(screen.getByText('MY_FALLBACK')).toBeTruthy()
    expect(screen.queryByTestId('full-page-loader')).toBeNull()
  })

  it('renders FullPageLoader by default for handled radix/router context errors when no fallback provided', () => {
    const Thrower = () => {
      throw new Error('TabsList must be used within Tabs')
    }

    renderWithProviders(
      <RouterErrorBoundary>
        <Thrower />
      </RouterErrorBoundary>,
    )

    expect(screen.getByTestId('full-page-loader')).toBeTruthy()
    expect(screen.queryByText('Erreur de chargement')).toBeNull()
  })

  it('rethrows unknown errors', () => {
    const Thrower = () => {
      throw new Error('totally-unknown-error')
    }

    expect(() =>
      renderWithProviders(
        <RouterErrorBoundary>
          <Thrower />
        </RouterErrorBoundary>,
      ),
    ).toThrow(/totally-unknown-error/)
  })

  it('logs warnings via debug.warn for handled errors (chunk path + didCatch)', () => {
    debugWarn.mockClear()

    const ThrowerChunk = () => {
      throw Object.assign(new Error('Loading CSS chunk 2 failed'), { name: 'ChunkLoadError' })
    }

    renderWithProviders(
      <RouterErrorBoundary>
        <ThrowerChunk />
      </RouterErrorBoundary>,
    )

    const flattened = debugWarn.mock.calls.flat().map(v => String(v)).join('\n')
    expect(flattened.includes('[RouterErrorBoundary] Chunk loading error:')).toBe(true)
    expect(flattened.includes('Router/Chunk error caught:')).toBe(true)
    expect(flattened.includes('Loading CSS chunk 2 failed')).toBe(true)
  })
})