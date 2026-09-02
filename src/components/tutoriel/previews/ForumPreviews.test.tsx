import React from 'react'
import { render, screen, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const { mockFrom, supabaseBuilder, toastSuccess, toastError } = vi.hoisted(() => {
  type SupabaseResult = { data: unknown; error: { message: string } | null }

  const createThenable = () => {
    const t: {
      __data: unknown
      __error: { message: string } | null
      then: (onFulfilled: (v: SupabaseResult) => unknown, onRejected?: (e: unknown) => unknown) => Promise<unknown>
      catch: (onRejected: (e: unknown) => unknown) => Promise<unknown>
      setResult: (data: unknown, error?: { message: string } | null) => void
    } = {
      __data: null,
      __error: null,
      then: (onFulfilled, onRejected) =>
        Promise.resolve({ data: t.__data, error: t.__error } satisfies SupabaseResult).then(onFulfilled, onRejected),
      catch: (onRejected) => Promise.resolve({ data: t.__data, error: t.__error } satisfies SupabaseResult).catch(onRejected),
      setResult: (data, error = null) => {
        t.__data = data
        t.__error = error
      },
    }
    return t
  }

  const makeBuilder = () => {
    const thenable = createThenable()
    const builder: Record<string, unknown> = {
      __thenable: thenable,

      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      neq: vi.fn(() => builder),
      gt: vi.fn(() => builder),
      gte: vi.fn(() => builder),
      lt: vi.fn(() => builder),
      lte: vi.fn(() => builder),
      in: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      range: vi.fn(() => builder),
      insert: vi.fn(() => builder),
      update: vi.fn(() => builder),
      upsert: vi.fn(() => builder),
      delete: vi.fn(() => builder),

      maybeSingle: vi.fn(async () => ({ data: thenable.__data, error: thenable.__error })),
      single: vi.fn(async () => ({ data: thenable.__data, error: thenable.__error })),

      then: thenable.then,
      catch: thenable.catch,
    }
    return builder
  }

  const supabaseBuilder = makeBuilder()
  const mockFrom = vi.fn(() => supabaseBuilder)

  const toastSuccess = vi.fn()
  const toastError = vi.fn()

  return { mockFrom, supabaseBuilder, toastSuccess, toastError }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: { user: { id: 'u1' } } },
        error: null,
      })),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
  },
}))

vi.mock('sonner', () => ({
  toast: { success: toastSuccess, error: toastError },
}))

vi.mock('react-router-dom', async () => {
  const actual = (await vi.importActual<typeof import('react-router-dom')>('react-router-dom')) as typeof import('react-router-dom')
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useLocation: () => ({ pathname: '/' }),
    useParams: () => ({}),
  }
})

vi.mock('framer-motion', () => ({
  motion: {
    div: (props: React.HTMLAttributes<HTMLDivElement>) => <div {...props} />,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />
  return {
    MessageSquare: Icon,
    Users: Icon,
    ThumbsUp: Icon,
    Eye: Icon,
    Pin: Icon,
    User: Icon,
    Reply: Icon,
    Award: Icon,
    CheckCircle2: Icon,
    MessageCircle: Icon,
    Plus: Icon,
  }
})

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...props }: { children: React.ReactNode; [k: string]: unknown }) => <span {...props}>{children}</span>,
}))

vi.mock('@/components/ui/avatar', () => ({
  Avatar: ({ children, ...props }: { children: React.ReactNode; [k: string]: unknown }) => <div {...props}>{children}</div>,
  AvatarFallback: ({ children, ...props }: { children: React.ReactNode; [k: string]: unknown }) => <div {...props}>{children}</div>,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: { children: React.ReactNode; [k: string]: unknown }) => <button {...props}>{children}</button>,
}))

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: { children: React.ReactNode; [k: string]: unknown }) => <div {...props}>{children}</div>,
  CardHeader: ({ children, ...props }: { children: React.ReactNode; [k: string]: unknown }) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }: { children: React.ReactNode; [k: string]: unknown }) => <div {...props}>{children}</div>,
}))

vi.mock('../TutorielCountUpAnimation', () => ({
  TutorielCountUpAnimation: ({ value }: { value: number }) => <span>{value}</span>,
}))

import { ForumPostListPreview, ForumPostDetailPreview, ForumStatsPreview } from './ForumPreviews'

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })
}

function renderWithClient(ui: React.ReactElement) {
  const client = createQueryClient()
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

describe('ForumPreviews', () => {
  it('ForumPostListPreview affiche les discussions récentes et les métriques (valeurs réelles)', () => {
    renderWithClient(<ForumPostListPreview />)

    expect(screen.getByText('Discussions récentes')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Nouveau sujet/i })).toBeInTheDocument()

    expect(screen.getByText('Bonnes pratiques pour un déploiement en grand compte')).toBeInTheDocument()
    expect(screen.getByText('Marie Dupont')).toBeInTheDocument()
    expect(screen.getByText('Déploiement')).toBeInTheDocument()
    expect(screen.getByText('Grand compte')).toBeInTheDocument()
    expect(screen.getByText('Formation')).toBeInTheDocument()
    expect(screen.getByText('Résolu')).toBeInTheDocument()
    expect(screen.getByText('Il y a 2h')).toBeInTheDocument()

    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('245')).toBeInTheDocument()
    expect(screen.getAllByText('8').length).toBeGreaterThanOrEqual(1)

    expect(screen.getByText('Comment optimiser les imports de données personnelles ?')).toBeInTheDocument()
    expect(screen.getByText('Thomas Bernard')).toBeInTheDocument()
    expect(screen.getByText('Technique')).toBeInTheDocument()
    expect(screen.getByText('Import')).toBeInTheDocument()
    expect(screen.getByText('Données')).toBeInTheDocument()

    expect(screen.getByText("Retour d'expérience : migration depuis ancien système")).toBeInTheDocument()
    expect(screen.getByText('Sophie Martin')).toBeInTheDocument()
    expect(screen.getByText("Retour d'expérience")).toBeInTheDocument()
    expect(screen.getByText('Migration')).toBeInTheDocument()
    expect(screen.getByText('Témoignage')).toBeInTheDocument()
  })

  it('ForumPostDetailPreview: chargement (réponses cachées) puis succès (réponses affichées) via timer', async () => {
    vi.useFakeTimers()
    renderWithClient(<ForumPostDetailPreview />)

    expect(screen.getByText('Bonnes pratiques pour un déploiement en grand compte')).toBeInTheDocument()
    expect(
      screen.getByText(
        /Bonjour à tous, nous préparons le déploiement de la solution dans notre organisation\.\s*Quelles sont vos recommandations pour une migration réussie \?/,
      ),
    ).toBeInTheDocument()
    expect(screen.queryByText('Meilleure réponse')).toBeNull()

    await act(async () => {
      vi.advanceTimersByTime(801)
    })

    expect(screen.getByText('Thomas B.')).toBeInTheDocument()
    expect(screen.getByText('Meilleure réponse')).toBeInTheDocument()
    expect(screen.getByText('Sophie M.')).toBeInTheDocument()
    expect(screen.getByText('Je confirme, la documentation officielle est très utile sur ce point.')).toBeInTheDocument()

    vi.useRealTimers()
  })

  it('ForumStatsPreview affiche les stats et tendances (valeurs réelles)', () => {
    renderWithClient(<ForumStatsPreview />)

    expect(screen.getByText('Sujets')).toBeInTheDocument()
    expect(screen.getByText('156')).toBeInTheDocument()
    expect(screen.getByText('+12 ce mois')).toBeInTheDocument()

    expect(screen.getByText('Membres actifs')).toBeInTheDocument()
    expect(screen.getByText('47')).toBeInTheDocument()
    expect(screen.getByText('+5 ce mois')).toBeInTheDocument()

    expect(screen.getByText('Réponses')).toBeInTheDocument()
    expect(screen.getByText('892')).toBeInTheDocument()
    expect(screen.getByText('+45 cette semaine')).toBeInTheDocument()

    expect(screen.getByText('Résolutions')).toBeInTheDocument()
    expect(screen.getByText('134')).toBeInTheDocument()
    expect(screen.getByText('86% de taux')).toBeInTheDocument()
  })

  it("Supabase mock thenable: succès puis erreur (format { data:null, error:{message:'x'} })", async () => {
    const builder = supabaseBuilder as unknown as { __thenable: { setResult: (data: unknown, error?: { message: string } | null) => void } }
    builder.__thenable.setResult([{ id: 'row1' }], null)

    const result1 = await (mockFrom('posts') as unknown as Promise<{ data: unknown; error: unknown }>)
    expect(mockFrom).toHaveBeenCalledWith('posts')
    expect(result1).toEqual({ data: [{ id: 'row1' }], error: null })

    builder.__thenable.setResult(null, { message: 'x' })
    const result2 = await (mockFrom('posts') as unknown as Promise<{ data: unknown; error: { message: string } | null }>)
    expect(result2.data).toBeNull()
    expect(result2.error).toEqual({ message: 'x' })
  })
})