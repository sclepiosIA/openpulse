/* @vitest-environment jsdom */
import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { LogDetailDialog } from './LogDetailDialog'

const {
  stableLog,
  stableAiLog,
  toastSuccess,
  toastError,
  getProcessingTypeLabelMock,
  writeTextMock,
} = vi.hoisted(() => ({
  stableLog: {
    id: 'log-1',
    source: 'frontend',
    severity: 'error',
    type: 'UnhandledError',
    message: 'Une erreur est survenue\navec une seconde ligne',
    timestamp: '2024-06-15T14:30:45.000Z',
    userEmail: 'user@test.local',
    userId: 'user-1',
    metadata: {
      stack: 'Error: boom\n at line 1',
      route: '/admin/logs',
      console_logs: [{ level: 'error', message: 'boom' }],
      requestId: 'req-1',
      retryCount: 2,
    },
  },
  stableAiLog: {
    id: 'log-2',
    source: 'ai',
    severity: 'info',
    type: 'summarization',
    message: 'Traitement IA terminé',
    timestamp: '2024-07-01T08:15:00.000Z',
    userId: 'user-2',
    metadata: {
      model: 'gpt-mini',
    },
  },
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  getProcessingTypeLabelMock: vi.fn((value: string) => `Libellé ${value}`),
  writeTextMock: vi.fn(() => Promise.resolve(undefined)),
}))

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}))

vi.mock('@/hooks/ai/useAIUsageStats', () => ({
  getProcessingTypeLabel: getProcessingTypeLabelMock,
}))

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({
    open,
    onOpenChange,
    children,
  }: {
    open: boolean
    onOpenChange: (open: boolean) => void
    children: React.ReactNode
  }) => (
    <div data-testid="dialog" data-open={String(open)}>
      <button type="button" onClick={() => onOpenChange(false)}>
        close-dialog
      </button>
      {children}
    </div>
  ),
  DialogContent: ({
    children,
    className,
  }: {
    children: React.ReactNode
    className?: string
  }) => (
    <div data-testid="dialog-content" className={className}>
      {children}
    </div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({
    children,
    className,
  }: {
    children: React.ReactNode
    className?: string
  }) => <div className={className}>{children}</div>,
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({
    children,
    className,
  }: {
    children: React.ReactNode
    className?: string
  }) => <span className={className}>{children}</span>,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    className,
    size,
    variant,
  }: {
    children: React.ReactNode
    onClick?: () => void
    className?: string
    size?: string
    variant?: string
  }) => (
    <button type="button" data-size={size} data-variant={variant} className={className} onClick={onClick}>
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({
    children,
    className,
  }: {
    children: React.ReactNode
    className?: string
  }) => (
    <div data-testid="scroll-area" className={className}>
      {children}
    </div>
  ),
}))

vi.mock('@/components/ui/separator', () => ({
  Separator: () => <hr data-testid="separator" />,
}))

vi.mock('lucide-react', () => ({
  Check: ({ className }: { className?: string }) => <svg data-testid="check-icon" className={className} />,
  Copy: ({ className }: { className?: string }) => <svg data-testid="copy-icon" className={className} />,
}))

vi.mock('./config', () => ({
  SOURCE_CONFIG: {
    frontend: { label: 'Frontend', color: 'text-blue-500' },
    ai: { label: 'IA', color: 'text-violet-500' },
  },
  SEVERITY_CONFIG: {
    error: { label: 'Erreur', class: 'text-red-500' },
    info: { label: 'Info', class: 'text-sky-500' },
  },
}))

describe('LogDetailDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(window.navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      configurable: true,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('n’affiche pas le détail quand log est null et ouvre le dialog fermé', () => {
    const onClose = vi.fn()

    render(<LogDetailDialog log={null} onClose={onClose} />)

    expect(screen.getByTestId('dialog')).toHaveAttribute('data-open', 'false')
    expect(screen.queryByText('Type')).not.toBeInTheDocument()
    expect(screen.queryByText('Message')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Copier le JSON' })).not.toBeInTheDocument()
  })

  it('affiche les informations détaillées d’un log standard avec badges, date et métadonnées filtrées', () => {
    const onClose = vi.fn()

    render(<LogDetailDialog log={stableLog} onClose={onClose} />)

    expect(screen.getByTestId('dialog')).toHaveAttribute('data-open', 'true')
    expect(screen.getByText('Frontend')).toBeInTheDocument()
    expect(screen.getByText('Erreur')).toBeInTheDocument()
    expect(
      screen.getByText(format(new Date(stableLog.timestamp), 'dd/MM/yyyy HH:mm:ss', { locale: fr })),
    ).toBeInTheDocument()

    expect(screen.getByText('Type')).toBeInTheDocument()
    expect(screen.getByText('UnhandledError')).toBeInTheDocument()

    expect(screen.getByText('Message')).toBeInTheDocument()
    expect(screen.getByText(/Une erreur est survenue/)).toBeInTheDocument()

    expect(screen.getByText('Utilisateur')).toBeInTheDocument()
    expect(screen.getByText('user@test.local')).toBeInTheDocument()

    expect(screen.getByText('Stack Trace')).toBeInTheDocument()
    expect(screen.getByText(/Error: boom/)).toBeInTheDocument()

    expect(screen.getByText('Route')).toBeInTheDocument()
    expect(screen.getByText('/admin/logs')).toBeInTheDocument()

    expect(screen.getByText('Console Logs')).toBeInTheDocument()
    expect(screen.getByText(/\[\s*\{/)).toBeInTheDocument()

    expect(screen.getByText('Métadonnées')).toBeInTheDocument()
    expect(screen.getByText(/"requestId": "req-1"/)).toBeInTheDocument()
    expect(screen.getByText(/"retryCount": 2/)).toBeInTheDocument()
    expect(screen.queryByText(/"stack":/)).not.toBeInTheDocument()
    expect(screen.queryByText(/"route":/)).not.toBeInTheDocument()
    expect(screen.queryByText(/"console_logs":/)).not.toBeInTheDocument()

    expect(screen.getByRole('button', { name: 'Copier le JSON' })).toBeInTheDocument()
    expect(screen.getByTestId('copy-icon')).toBeInTheDocument()
  })

  it('utilise le libellé de traitement IA quand la source est ai', () => {
    const onClose = vi.fn()

    render(<LogDetailDialog log={stableAiLog} onClose={onClose} />)

    expect(getProcessingTypeLabelMock).toHaveBeenCalledWith('summarization')
    expect(screen.getByText('IA')).toBeInTheDocument()
    expect(screen.getByText('Info')).toBeInTheDocument()
    expect(screen.getByText('Libellé summarization')).toBeInTheDocument()
    expect(screen.getByText('user-2')).toBeInTheDocument()
    expect(screen.getByText(/"model": "gpt-mini"/)).toBeInTheDocument()
  })

  it('copie le JSON, affiche le toast puis réinitialise le bouton après 2 secondes', async () => {
    vi.useFakeTimers()
    const onClose = vi.fn()

    render(<LogDetailDialog log={stableLog} onClose={onClose} />)

    fireEvent.click(screen.getByRole('button', { name: 'Copier le JSON' }))

    await act(async () => {
      await Promise.resolve()
    })

    expect(writeTextMock).toHaveBeenCalledWith(JSON.stringify(stableLog, null, 2))
    expect(toastSuccess).toHaveBeenCalledWith('JSON copié dans le presse-papiers')
    expect(screen.getByRole('button', { name: 'Copié !' })).toBeInTheDocument()
    expect(screen.getByTestId('check-icon')).toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(2000)
    })

    expect(screen.getByRole('button', { name: 'Copier le JSON' })).toBeInTheDocument()
    expect(screen.getByTestId('copy-icon')).toBeInTheDocument()
  })

  it('appelle onClose via onOpenChange du Dialog', () => {
    const onClose = vi.fn()

    render(<LogDetailDialog log={stableLog} onClose={onClose} />)

    fireEvent.click(screen.getByRole('button', { name: 'close-dialog' }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('ne tente pas de copier si aucun log n’est fourni', async () => {
    const onClose = vi.fn()

    render(<LogDetailDialog log={null} onClose={onClose} />)

    expect(writeTextMock).not.toHaveBeenCalled()
    await waitFor(() => {
      expect(toastSuccess).not.toHaveBeenCalled()
    })
  })
})