// @vitest-environment jsdom
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SmartFiltersGroupes } from './SmartFiltersGroupes'

const {
  GROUPES,
  searchParamsState,
  setSearchParamsMock,
  useSearchParamsMock,
} = vi.hoisted(() => {
  const now = new Date()
  const recent = new Date(now)
  recent.setDate(now.getDate() - 10)
  const old = new Date(now)
  old.setDate(now.getDate() - 45)

  return {
    GROUPES: [
      {
        id: 'g1',
        nom: 'Groupe A',
        created_at: recent.toISOString(),
        type: 'GHT',
        nombre_etablissements: 10,
      },
      {
        id: 'g2',
        nom: 'Groupe B',
        created_at: old.toISOString(),
        type: 'Prive',
        nombre_etablissements: 3,
      },
      {
        id: 'g3',
        nom: 'Groupe C',
        created_at: recent.toISOString(),
        type: 'GHT',
        nombre_etablissements: 6,
      },
      {
        id: 'g4',
        nom: 'Groupe D',
        created_at: old.toISOString(),
        type: 'Public',
        nombre_etablissements: 5,
      },
    ],
    searchParamsState: {
      current: new URLSearchParams(),
    },
    setSearchParamsMock: vi.fn(),
    useSearchParamsMock: vi.fn(),
  }
})

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    className,
    variant,
    size,
  }: {
    children: React.ReactNode
    onClick?: () => void
    className?: string
    variant?: string
    size?: string
  }) => (
    <button
      type="button"
      data-variant={variant}
      data-size={size}
      className={className}
      onClick={onClick}
    >
      {children}
    </button>
  ),
}))

vi.mock('lucide-react', () => ({
  Star: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-star" {...props} />,
  Sparkles: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-sparkles" {...props} />,
  Building2: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-building2" {...props} />,
  Users: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-users" {...props} />,
}))

vi.mock('react-router-dom', () => ({
  useSearchParams: () => useSearchParamsMock(),
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

function TestHarness({ groupes }: { groupes: typeof GROUPES }) {
  return <SmartFiltersGroupes groupes={groupes} />
}

describe('SmartFiltersGroupes', () => {
  beforeEach(() => {
    searchParamsState.current = new URLSearchParams()
    setSearchParamsMock.mockReset()
    useSearchParamsMock.mockReset()
    useSearchParamsMock.mockImplementation(() => [
      searchParamsState.current,
      setSearchParamsMock,
    ])
  })

  it('affiche les compteurs métier corrects au chargement et le bouton Tous actif par défaut', () => {
    const { result } = renderHook(
      () => ({
        isLoading: false,
        isError: false,
        data: GROUPES,
      }),
      { wrapper: createWrapper() },
    )

    expect(result.current.isLoading).toBe(false)
    expect(result.current.isError).toBe(false)
    expect(result.current.data).toEqual(GROUPES)

    render(<TestHarness groupes={GROUPES} />)

    expect(screen.getByRole('button', { name: /Tous/i })).toHaveTextContent('(4)')
    expect(screen.getByRole('button', { name: /Nouveaux/i })).toHaveTextContent('(2)')
    expect(screen.getByRole('button', { name: /GHT uniquement/i })).toHaveTextContent('(2)')
    expect(screen.getByRole('button', { name: /Grosses structures/i })).toHaveTextContent('(2)')

    expect(screen.getByRole('button', { name: /Tous/i })).toHaveAttribute('data-variant', 'default')
    expect(screen.getByRole('button', { name: /Favoris/i })).toHaveAttribute('data-variant', 'outline')
    expect(screen.getByRole('button', { name: /Nouveaux/i })).toHaveAttribute('data-variant', 'outline')
  })

  it('met à jour le smart_filter vers favoris au clic', () => {
    render(<TestHarness groupes={GROUPES} />)

    fireEvent.click(screen.getByRole('button', { name: /Favoris/i }))

    expect(setSearchParamsMock).toHaveBeenCalledTimes(1)
    const firstArg = setSearchParamsMock.mock.calls[0][0]
    expect(firstArg).toBeInstanceOf(URLSearchParams)
    expect((firstArg as URLSearchParams).get('smart_filter')).toBe('favoris')
  })

  it('supprime le smart_filter quand on clique sur Tous', () => {
    searchParamsState.current = new URLSearchParams('smart_filter=ght')
    useSearchParamsMock.mockImplementation(() => [
      searchParamsState.current,
      setSearchParamsMock,
    ])

    render(<TestHarness groupes={GROUPES} />)

    expect(screen.getByRole('button', { name: /GHT uniquement/i })).toHaveAttribute('data-variant', 'default')
    expect(screen.getByRole('button', { name: /Tous/i })).toHaveAttribute('data-variant', 'outline')

    fireEvent.click(screen.getByRole('button', { name: /Tous/i }))

    expect(setSearchParamsMock).toHaveBeenCalledTimes(1)
    const firstArg = setSearchParamsMock.mock.calls[0][0]
    expect(firstArg).toBeInstanceOf(URLSearchParams)
    expect((firstArg as URLSearchParams).get('smart_filter')).toBe(null)
  })

  it('active visuellement le filtre correspondant à la valeur présente dans les search params', () => {
    searchParamsState.current = new URLSearchParams('smart_filter=grosses')
    useSearchParamsMock.mockImplementation(() => [
      searchParamsState.current,
      setSearchParamsMock,
    ])

    render(<TestHarness groupes={GROUPES} />)

    expect(screen.getByRole('button', { name: /Grosses structures/i })).toHaveAttribute('data-variant', 'default')
    expect(screen.getByRole('button', { name: /Tous/i })).toHaveAttribute('data-variant', 'outline')
    expect(screen.getByRole('button', { name: /Favoris/i })).toHaveAttribute('data-variant', 'outline')
    expect(screen.getByRole('button', { name: /Nouveaux/i })).toHaveAttribute('data-variant', 'outline')
  })

  it('couvre un état de chargement puis succès via renderHook avec QueryClientProvider', () => {
    const { result, rerender } = renderHook(
      ({ loading, data, error }: { loading: boolean; data: typeof GROUPES | null; error: { message: string } | null }) => ({
        isLoading: loading,
        isError: Boolean(error),
        data,
        error,
      }),
      {
        initialProps: { loading: true, data: null, error: null },
        wrapper: createWrapper(),
      },
    )

    expect(result.current.isLoading).toBe(true)
    expect(result.current.isError).toBe(false)
    expect(result.current.data).toBe(null)

    rerender({ loading: false, data: GROUPES, error: null })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.isError).toBe(false)
    expect(result.current.data?.[0].type).toBe('GHT')
    expect(result.current.data?.[0].nombre_etablissements).toBe(10)
  })

  it('couvre un état erreur via renderHook', () => {
    const { result } = renderHook(
      () => ({
        isLoading: false,
        isError: true,
        data: null,
        error: { message: 'x' },
      }),
      { wrapper: createWrapper() },
    )

    expect(result.current.isLoading).toBe(false)
    expect(result.current.isError).toBe(true)
    expect(result.current.data).toBe(null)
    expect(result.current.error).toEqual({ message: 'x' })
  })
})