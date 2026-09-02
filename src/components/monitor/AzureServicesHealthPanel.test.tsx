/* @vitest-environment jsdom */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { AzureServicesHealthPanel } from './AzureServicesHealthPanel'
import type { AzureServiceHealthResult } from '@/services/azureServiceHealth'

const { PROBE_MOCK, RESULTS } = vi.hoisted(() => {
  const results: AzureServiceHealthResult[] = [
    {
      id: 'drive',
      label: 'Drive API',
      description: 'Documents Azure Drive, uploads, permissions et sync desktop.',
      baseUrl: 'https://drive.test',
      healthPath: '/healthz',
      status: 'ok',
      httpStatus: 200,
      version: '0.1.0',
      checkedAt: '2026-07-08T10:00:00.000Z',
      dependencies: { database: 'ok', blob_storage: 'ok' },
      message: null,
    },
    {
      id: 'mail',
      label: 'Mail API',
      description: 'Smart Inbox Azure, comptes mail et supervision de sync.',
      baseUrl: 'https://mail.test',
      healthPath: '/healthz',
      status: 'degraded',
      httpStatus: 200,
      version: '0.1.1',
      checkedAt: '2026-07-08T10:00:01.000Z',
      dependencies: { database: 'down' },
      message: null,
    },
    {
      id: 'pulse',
      label: 'Pulse API',
      description: 'Conversations Pulse Azure et futur gateway temps réel.',
      baseUrl: null,
      healthPath: '/healthz',
      status: 'unconfigured',
      httpStatus: null,
      version: null,
      checkedAt: '2026-07-08T10:00:02.000Z',
      dependencies: {},
      message: 'URL non configurée',
    },
    {
      id: 'meetings',
      label: 'Meetings API',
      description: 'Visio, upload audio et pipeline transcription Azure.',
      baseUrl: 'https://meetings.test',
      healthPath: '/healthz',
      status: 'down',
      httpStatus: 503,
      version: null,
      checkedAt: '2026-07-08T10:00:03.000Z',
      dependencies: {},
      message: 'HTTP 503',
    },
  ]

  return {
    RESULTS: results,
    PROBE_MOCK: vi.fn(async () => results),
  }
})

vi.mock('@/services/azureServiceHealth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/azureServiceHealth')>()),
  probeAllAzureServices: PROBE_MOCK,
}))

function wrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

describe('AzureServicesHealthPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('affiche le résumé et le détail des 4 services Azure Gestion', async () => {
    render(<AzureServicesHealthPanel />, { wrapper: wrapper() })

    expect(screen.getByText('Sonde des services Azure…')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('1/4 OK')).toBeInTheDocument()
    })

    expect(PROBE_MOCK).toHaveBeenCalledTimes(1)
    for (const service of RESULTS) {
      expect(screen.getByText(service.label)).toBeInTheDocument()
    }
    expect(screen.getByText('Dégradé')).toBeInTheDocument()
    expect(screen.getByText('Non configuré')).toBeInTheDocument()
    expect(screen.getByText('Indisponible')).toBeInTheDocument()
    expect(screen.getByText('database: ok')).toBeInTheDocument()
    expect(screen.getByText('blob_storage: ok')).toBeInTheDocument()
    expect(screen.getByText('HTTP 503')).toBeInTheDocument()
    expect(screen.getByText(/3 service\(s\) configuré\(s\)/)).toBeInTheDocument()
  })
})
