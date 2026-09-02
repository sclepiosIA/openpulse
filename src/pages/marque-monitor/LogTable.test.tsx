// @vitest-environment jsdom
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { LogTable } from './LogTable'

const { LABELS, SOURCE_CONFIG_MOCK, SEVERITY_CONFIG_MOCK } = vi.hoisted(() => {
  const labels = {
    summarize: 'Résumé IA',
    classify: 'Classification IA',
  }

  return {
    LABELS: labels,
    SOURCE_CONFIG_MOCK: {
      ai: {
        label: 'IA',
        color: 'text-violet-600',
        icon: ({ className }: { className?: string }) => <svg data-testid="source-icon-ai" className={className} />,
      },
      api: {
        label: 'API',
        color: 'text-blue-600',
        icon: ({ className }: { className?: string }) => <svg data-testid="source-icon-api" className={className} />,
      },
    },
    SEVERITY_CONFIG_MOCK: {
      info: { label: 'Info', class: 'text-slate-600' },
      error: { label: 'Erreur', class: 'text-red-600' },
    },
  }
})

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardHeader: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-header" className={className}>
      {children}
    </div>
  ),
  CardTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h2 className={className}>{children}</h2>
  ),
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-content" className={className}>
      {children}
    </div>
  ),
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    className,
  }: {
    children: React.ReactNode
    onClick?: () => void
    className?: string
  }) => (
    <button type="button" onClick={onClick} className={className}>
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({
    children,
    className,
  }: {
    children: React.ReactNode
    className?: string
    variant?: string
  }) => <span className={className}>{children}</span>,
}))

vi.mock('@/components/ui/table', () => ({
  Table: ({ children }: { children: React.ReactNode }) => <table>{children}</table>,
  TableHeader: ({ children }: { children: React.ReactNode }) => <thead>{children}</thead>,
  TableBody: ({ children }: { children: React.ReactNode }) => <tbody>{children}</tbody>,
  TableRow: ({
    children,
    onClick,
    className,
  }: {
    children: React.ReactNode
    onClick?: () => void
    className?: string
  }) => (
    <tr onClick={onClick} className={className}>
      {children}
    </tr>
  ),
  TableHead: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <th className={className}>{children}</th>
  ),
  TableCell: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <td className={className}>{children}</td>
  ),
}))

vi.mock('lucide-react', () => ({
  Check: ({ className }: { className?: string }) => <svg data-testid="check-icon" className={className} />,
}))

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | undefined | null | false>) => classes.filter(Boolean).join(' '),
}))

vi.mock('@/hooks/ai/useAIUsageStats', () => ({
  getProcessingTypeLabel: (type: string) => LABELS[type as keyof typeof LABELS] ?? type,
}))

vi.mock('./config', () => ({
  SOURCE_CONFIG: SOURCE_CONFIG_MOCK,
  SEVERITY_CONFIG: SEVERITY_CONFIG_MOCK,
}))

describe('LogTable', () => {
  it('affiche un état de chargement avec le total', () => {
    const onLoadMore = vi.fn()
    const onSelect = vi.fn()

    const { container } = render(
      <LogTable
        logs={[]}
        isLoading
        totalCount={3}
        hasMore={false}
        onLoadMore={onLoadMore}
        onSelect={onSelect}
        isMobile={false}
      />,
    )

    expect(screen.getByText('Événements (3)')).toBeInTheDocument()
    expect(container.querySelector('.animate-spin')).toBeTruthy()
    expect(screen.queryByText('Système opérationnel')).not.toBeInTheDocument()
  })

  it('affiche l’état vide quand aucun log n’est trouvé', () => {
    render(
      <LogTable
        logs={[]}
        isLoading={false}
        totalCount={0}
        hasMore={false}
        onLoadMore={vi.fn()}
        onSelect={vi.fn()}
        isMobile={false}
      />,
    )

    expect(screen.getByText('Système opérationnel')).toBeInTheDocument()
    expect(screen.getByText('Aucun événement trouvé sur cette période')).toBeInTheDocument()
    expect(screen.getByTestId('check-icon')).toBeInTheDocument()
  })

  it('affiche les logs, formate les valeurs métier, gère la sélection et le chargement supplémentaire', () => {
    const onLoadMore = vi.fn()
    const onSelect = vi.fn()

    const logs = [
      {
        id: 'log-1',
        timestamp: '2024-05-10T14:30:00.000Z',
        source: 'ai',
        severity: 'error',
        type: 'summarize',
        message: 'Traitement IA interrompu',
        userEmail: 'user@test.io',
        userId: 'user-1234',
      },
      {
        id: 'log-2',
        timestamp: '2024-05-11T08:15:00.000Z',
        source: 'api',
        severity: 'info',
        type: 'heartbeat',
        message: 'Ping service',
        userEmail: '',
        userId: 'abcdef12-3456',
      },
    ]

    render(
      <LogTable
        logs={logs}
        isLoading={false}
        totalCount={5}
        hasMore
        onLoadMore={onLoadMore}
        onSelect={onSelect}
        isMobile={false}
      />,
    )

    expect(screen.getByText('Événements (5)')).toBeInTheDocument()
    expect(screen.getByText('Date')).toBeInTheDocument()
    expect(screen.getByText('Source')).toBeInTheDocument()
    expect(screen.getByText('Sévérité')).toBeInTheDocument()
    expect(screen.getByText('Type')).toBeInTheDocument()
    expect(screen.getByText('Message')).toBeInTheDocument()
    expect(screen.getByText('Utilisateur')).toBeInTheDocument()

    expect(screen.getByText('IA')).toBeInTheDocument()
    expect(screen.getByText('API')).toBeInTheDocument()
    expect(screen.getByText('Erreur')).toBeInTheDocument()
    expect(screen.getByText('Info')).toBeInTheDocument()
    expect(screen.getByText('Résumé IA')).toBeInTheDocument()
    expect(screen.getByText('heartbeat')).toBeInTheDocument()
    expect(screen.getByText('Traitement IA interrompu')).toBeInTheDocument()
    expect(screen.getByText('Ping service')).toBeInTheDocument()
    expect(screen.getByText('user@test.io')).toBeInTheDocument()
    expect(screen.getByText('abcdef12')).toBeInTheDocument()
    expect(screen.getByTestId('source-icon-ai')).toBeInTheDocument()
    expect(screen.getByTestId('source-icon-api')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Traitement IA interrompu'))
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith(logs[0])

    fireEvent.click(screen.getByText('Charger plus (3 restants)'))
    expect(onLoadMore).toHaveBeenCalledTimes(1)
  })

  it('masque la colonne utilisateur sur mobile', () => {
    const logs = [
      {
        id: 'log-3',
        timestamp: '2024-05-12T10:00:00.000Z',
        source: 'api',
        severity: 'info',
        type: 'heartbeat',
        message: 'Service disponible',
        userEmail: 'mobile@test.io',
        userId: 'mob-1',
      },
    ]

    render(
      <LogTable
        logs={logs}
        isLoading={false}
        totalCount={1}
        hasMore={false}
        onLoadMore={vi.fn()}
        onSelect={vi.fn()}
        isMobile
      />,
    )

    expect(screen.queryByText('Utilisateur')).not.toBeInTheDocument()
    expect(screen.queryByText('mobile@test.io')).not.toBeInTheDocument()
    expect(screen.getByText('Service disponible')).toBeInTheDocument()
  })
})