// @vitest-environment jsdom

import React from 'react'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PatternsTab } from './PatternsTab'

const { PATTERNS, MANY_PATTERNS, SOURCE_CONFIG_MOCK } = vi.hoisted(() => {
  const now = new Date('2024-06-15T12:00:00.000Z')

  const patterns = [
    {
      fingerprint: 'fp-1',
      source: 'api' as const,
      message: 'Erreur API de validation',
      count: 10,
      firstSeen: '2024-06-15T08:30:00.000Z',
      lastSeen: new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
    },
    {
      fingerprint: 'fp-2',
      source: 'worker' as const,
      message: 'Job en échec sur la file prioritaire',
      count: 5,
      firstSeen: '2024-06-14T18:15:00.000Z',
      lastSeen: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
    },
  ]

  const manyPatterns = Array.from({ length: 35 }, (_, index) => ({
    fingerprint: `fp-many-${index + 1}`,
    source: (index % 2 === 0 ? 'api' : 'worker') as const,
    message: `Pattern ${index + 1}`,
    count: 35 - index,
    firstSeen: '2024-06-10T10:00:00.000Z',
    lastSeen: '2024-06-15T10:00:00.000Z',
  }))

  return {
    PATTERNS: patterns,
    MANY_PATTERNS: manyPatterns,
    SOURCE_CONFIG_MOCK: {
      api: {
        label: 'API',
        color: 'text-blue-500',
        icon: (props: React.SVGProps<SVGSVGElement>) => React.createElement('svg', { ...props, 'data-testid': 'source-icon-api' }),
      },
      worker: {
        label: 'Worker',
        color: 'text-orange-500',
        icon: (props: React.SVGProps<SVGSVGElement>) => React.createElement('svg', { ...props, 'data-testid': 'source-icon-worker' }),
      },
    },
  }
})

vi.mock('./config', () => ({
  SOURCE_CONFIG: SOURCE_CONFIG_MOCK,
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({
    children,
    className,
    variant,
  }: {
    children: React.ReactNode
    className?: string
    variant?: string
  }) => React.createElement('div', { className, 'data-variant': variant }, children),
}))

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => React.createElement('section', {}, children),
  CardHeader: ({ children, className }: { children: React.ReactNode; className?: string }) =>
    React.createElement('div', { className }, children),
  CardTitle: ({ children, className }: { children: React.ReactNode; className?: string }) =>
    React.createElement('h2', { className }, children),
  CardDescription: ({ children, className }: { children: React.ReactNode; className?: string }) =>
    React.createElement('p', { className }, children),
  CardContent: ({ children }: { children: React.ReactNode }) => React.createElement('div', {}, children),
}))

vi.mock('@/components/ui/progress', () => ({
  Progress: ({ value, className }: { value: number; className?: string }) =>
    React.createElement('div', {
      role: 'progressbar',
      'aria-valuenow': value,
      className,
    }),
}))

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | undefined | null | false>) => classes.filter(Boolean).join(' '),
}))

vi.mock('lucide-react', () => ({
  Repeat: (props: React.SVGProps<SVGSVGElement>) => React.createElement('svg', { ...props, 'data-testid': 'repeat-icon' }),
  Zap: (props: React.SVGProps<SVGSVGElement>) => React.createElement('svg', { ...props, 'data-testid': 'zap-icon' }),
}))

vi.mock('date-fns/locale', () => ({
  fr: {},
}))

vi.mock('date-fns', () => ({
  format: (date: Date, pattern: string) => {
    const pad = (value: number) => String(value).padStart(2, '0')
    if (pattern === 'dd/MM HH:mm') {
      return `${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`
    }
    return 'formatted-date'
  },
  formatDistanceToNow: (date: Date) => {
    const base = new Date('2024-06-15T12:00:00.000Z').getTime()
    const diffHours = Math.round((base - date.getTime()) / (60 * 60 * 1000))
    return `il y a ${diffHours} heure${diffHours > 1 ? 's' : ''}`
  },
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

describe('PatternsTab', () => {
  it('affiche un état vide quand aucun pattern récurrent n’est présent', () => {
    const Wrapper = createWrapper()

    render(React.createElement(PatternsTab, { recurringPatterns: [] }), { wrapper: Wrapper })

    expect(screen.getByText('Erreurs récurrentes (0)')).toBeInTheDocument()
    expect(
      screen.getByText('Aucun pattern récurrent détecté sur cette période'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Erreurs apparaissant au moins 2 fois — triées par fréquence'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })

  it('affiche les patterns avec les valeurs métier attendues et calcule la progression selon le maximum', () => {
    const Wrapper = createWrapper()

    render(React.createElement(PatternsTab, { recurringPatterns: PATTERNS }), { wrapper: Wrapper })

    expect(screen.getByText('Erreurs récurrentes (2)')).toBeInTheDocument()

    expect(screen.getByText('API')).toBeInTheDocument()
    expect(screen.getByText('Worker')).toBeInTheDocument()
    expect(screen.getByText('10x')).toBeInTheDocument()
    expect(screen.getByText('5x')).toBeInTheDocument()

    expect(screen.getByText('Erreur API de validation')).toBeInTheDocument()
    expect(screen.getByText('Job en échec sur la file prioritaire')).toBeInTheDocument()

    expect(screen.getByText('Premier: 15/06 08:30')).toBeInTheDocument()
    expect(screen.getByText('Dernier: 15/06 11:00')).toBeInTheDocument()
    expect(screen.getByText('Premier: 14/06 18:15')).toBeInTheDocument()
    expect(screen.getByText('Dernier: 15/06 10:00')).toBeInTheDocument()

    expect(screen.getByText('il y a 1 heure')).toBeInTheDocument()
    expect(screen.getByText('il y a 2 heures')).toBeInTheDocument()

    const bars = screen.getAllByRole('progressbar')
    expect(bars).toHaveLength(2)
    expect(bars[0]).toHaveAttribute('aria-valuenow', '100')
    expect(bars[1]).toHaveAttribute('aria-valuenow', '50')
  })

  it('limite l’affichage aux 30 premiers patterns triés fournis', () => {
    const Wrapper = createWrapper()

    render(React.createElement(PatternsTab, { recurringPatterns: MANY_PATTERNS }), { wrapper: Wrapper })

    expect(screen.getByText('Erreurs récurrentes (35)')).toBeInTheDocument()
    expect(screen.getByText('Pattern 1')).toBeInTheDocument()
    expect(screen.getByText('Pattern 30')).toBeInTheDocument()
    expect(screen.queryByText('Pattern 31')).not.toBeInTheDocument()
    expect(screen.queryByText('Pattern 35')).not.toBeInTheDocument()
    expect(screen.getAllByRole('progressbar')).toHaveLength(30)
  })
})