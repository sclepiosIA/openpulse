import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const {
  EDGE_SUCCESS,
  invokeEdgeMock,
  toastErrorMock,
  sanitizeSupabaseErrorMock,
  formatDistanceToNowMock,
} = vi.hoisted(() => {
  const EDGE_SUCCESS = {
    result: {
      summary: 'Relation globalement positive avec échanges réguliers.',
      key_points: ['Relance sur le dossier administratif', 'Validation du devis en attente'],
      pending_actions: ['Envoyer les pièces manquantes', 'Planifier un appel de suivi'],
      sentiment: 'positif' as const,
      last_contact_date: '2026-05-30T10:00:00.000Z',
    },
  }

  return {
    EDGE_SUCCESS,
    invokeEdgeMock: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
    toastErrorMock: vi.fn<(message: string) => void>(),
    sanitizeSupabaseErrorMock: vi.fn<(err: unknown) => string>(),
    formatDistanceToNowMock: vi.fn<(...args: unknown[]) => string>(),
  }
})

vi.mock('@/services/edgeFunctions', () => ({
  invokeEdge: invokeEdgeMock,
}))

vi.mock('sonner', () => ({
  toast: {
    error: toastErrorMock,
    success: vi.fn(),
    message: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}))

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: sanitizeSupabaseErrorMock,
}))

vi.mock('date-fns', () => ({
  formatDistanceToNow: formatDistanceToNowMock,
}))

vi.mock('date-fns/locale', () => ({
  fr: {},
}))

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div data-testid="card-header">{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div data-testid="card-content">{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <div data-testid="card-title">{children}</div>,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    type,
  }: {
    children: React.ReactNode
    onClick?: () => void
    disabled?: boolean
    type?: 'button' | 'submit' | 'reset'
    variant?: string
    size?: string
  }) => (
    <button type={type ?? 'button'} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode; className?: string }) => <span>{children}</span>,
}))

vi.mock('lucide-react', () => {
  const Icon =
    (name: string) =>
    ({ className }: { className?: string }) =>
      <span data-icon={name} className={className} />
  return {
    Loader2: Icon('Loader2'),
    Brain: Icon('Brain'),
    RefreshCw: Icon('RefreshCw'),
    CheckCircle2: Icon('CheckCircle2'),
    AlertTriangle: Icon('AlertTriangle'),
    TrendingUp: Icon('TrendingUp'),
    MessageSquare: Icon('MessageSquare'),
    Calendar: Icon('Calendar'),
  }
})

import { CommunicationAISynthesis } from './CommunicationAISynthesis'

function createWrapper() {
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

describe('CommunicationAISynthesis', () => {
  it('affiche l’état initial, lance la génération, affiche le loader puis le résultat (succès)', async () => {
    const user = userEvent.setup()
    const deferred: { resolve: (v: unknown) => void; reject: (e: unknown) => void; promise: Promise<unknown> } = {
      resolve: () => undefined,
      reject: () => undefined,
      promise: Promise.resolve(),
    }
    deferred.promise = new Promise((res, rej) => {
      deferred.resolve = res
      deferred.reject = rej
    })

    invokeEdgeMock.mockReturnValueOnce(deferred.promise)
    formatDistanceToNowMock.mockReturnValue('il y a quelques secondes')

    render(<CommunicationAISynthesis etablissementId="eta-1" etablissementNom="Etab X" />, {
      wrapper: createWrapper(),
    })

    expect(screen.getByText('Synthèse IA des communications')).toBeInTheDocument()
    expect(
      screen.getByText(/Analysez l'ensemble des emails et interactions avec Etab X/i)
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Générer la synthèse/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Générer la synthèse/i }))

    expect(invokeEdgeMock).toHaveBeenCalledTimes(1)
    expect(invokeEdgeMock).toHaveBeenCalledWith('synthesize-communication', { etablissement_id: 'eta-1' })

    expect(await screen.findByText('Analyse des communications en cours...')).toBeInTheDocument()

    deferred.resolve(EDGE_SUCCESS)

    await waitFor(() => {
      expect(screen.getByText('Synthèse IA')).toBeInTheDocument()
    })

    expect(screen.getByText('Générée il y a quelques secondes')).toBeInTheDocument()

    expect(screen.getByText('Résumé de la relation')).toBeInTheDocument()
    expect(screen.getByText('Positif')).toBeInTheDocument()
    expect(screen.getByText(EDGE_SUCCESS.result.summary)).toBeInTheDocument()

    const dateFr = new Date(EDGE_SUCCESS.result.last_contact_date).toLocaleDateString('fr-FR')
    expect(screen.getByText(`Dernier contact : ${dateFr}`)).toBeInTheDocument()

    expect(screen.getByText('Points clés récents')).toBeInTheDocument()
    expect(screen.getByText(EDGE_SUCCESS.result.key_points[0])).toBeInTheDocument()
    expect(screen.getByText(EDGE_SUCCESS.result.key_points[1])).toBeInTheDocument()

    expect(screen.getByText('Actions en attente')).toBeInTheDocument()
    expect(screen.getByText(EDGE_SUCCESS.result.pending_actions[0])).toBeInTheDocument()
    expect(screen.getByText(EDGE_SUCCESS.result.pending_actions[1])).toBeInTheDocument()

    expect(screen.getByRole('button', { name: /Régénérer/i })).toBeInTheDocument()
  })

  it('gère une erreur edge (data.error) : toast.error appelé avec erreur sanitizée et retour à l’état initial', async () => {
    const user = userEvent.setup()

    invokeEdgeMock.mockResolvedValueOnce({ error: 'edge failed' })
    sanitizeSupabaseErrorMock.mockReturnValueOnce('Erreur sanitizée')
    formatDistanceToNowMock.mockReturnValue('il y a 1 minute')

    render(<CommunicationAISynthesis etablissementId="eta-2" etablissementNom="Etab Y" />, {
      wrapper: createWrapper(),
    })

    await user.click(screen.getByRole('button', { name: /Générer la synthèse/i }))

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledTimes(1)
    })
    expect(toastErrorMock).toHaveBeenCalledWith('Erreur sanitizée')

    await waitFor(() => {
      expect(screen.getByText('Synthèse IA des communications')).toBeInTheDocument()
    })
    expect(screen.queryByText('Synthèse IA')).not.toBeInTheDocument()
  })

  it('permet de régénérer depuis un résultat et rappelle invokeEdge avec les bons paramètres', async () => {
    const user = userEvent.setup()

    invokeEdgeMock.mockResolvedValueOnce(EDGE_SUCCESS)
    formatDistanceToNowMock.mockReturnValue('il y a quelques secondes')

    render(<CommunicationAISynthesis etablissementId="eta-3" etablissementNom="Etab Z" />, {
      wrapper: createWrapper(),
    })

    await user.click(screen.getByRole('button', { name: /Générer la synthèse/i }))

    await waitFor(() => {
      expect(screen.getByText('Synthèse IA')).toBeInTheDocument()
    })

    invokeEdgeMock.mockResolvedValueOnce({
      result: {
        ...EDGE_SUCCESS.result,
        summary: 'Synthèse mise à jour après nouveaux échanges.',
        sentiment: 'neutre' as const,
        key_points: [],
        pending_actions: [],
        last_contact_date: null,
      },
    })

    await user.click(screen.getByRole('button', { name: /Régénérer/i }))

    expect(invokeEdgeMock).toHaveBeenCalledWith('synthesize-communication', { etablissement_id: 'eta-3' })

    await waitFor(() => {
      expect(screen.getByText('Synthèse mise à jour après nouveaux échanges.')).toBeInTheDocument()
    })
    expect(screen.getByText('Neutre')).toBeInTheDocument()
    expect(screen.getByText('Aucun point clé identifié')).toBeInTheDocument()
    expect(screen.getByText('Aucune action en attente')).toBeInTheDocument()
    expect(screen.queryByText(/Dernier contact :/i)).not.toBeInTheDocument()
  })
})