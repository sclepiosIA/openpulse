// @vitest-environment jsdom

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { RecordSidePeek } from './RecordSidePeek'

const { sheetState, buttonPropsSpy } = vi.hoisted(() => ({
  sheetState: {
    lastOpen: undefined as boolean | undefined,
    onOpenChange: undefined as ((open: boolean) => void) | undefined,
    contentClassName: '',
    contentSide: '',
  },
  buttonPropsSpy: vi.fn(),
}))

vi.mock('@/components/ui/sheet', () => {
  const Sheet = ({
    open,
    onOpenChange,
    children,
  }: {
    open: boolean
    onOpenChange: (open: boolean) => void
    children?: React.ReactNode
  }) => {
    sheetState.lastOpen = open
    sheetState.onOpenChange = onOpenChange
    return (
      <div data-testid="sheet-root" data-open={String(open)}>
        {children}
      </div>
    )
  }

  const SheetContent = ({
    side,
    className,
    children,
  }: {
    side?: string
    className?: string
    children?: React.ReactNode
  }) => {
    sheetState.contentClassName = className ?? ''
    sheetState.contentSide = side ?? ''
    return (
      <section data-testid="sheet-content" data-side={side} className={className}>
        {children}
      </section>
    )
  }

  const SheetHeader = ({
    className,
    children,
  }: {
    className?: string
    children?: React.ReactNode
  }) => <header data-testid="sheet-header" className={className}>{children}</header>

  const SheetTitle = ({
    className,
    children,
  }: {
    className?: string
    children?: React.ReactNode
  }) => <h2 data-testid="sheet-title" className={className}>{children}</h2>

  const SheetDescription = ({
    className,
    children,
  }: {
    className?: string
    children?: React.ReactNode
  }) => <p data-testid="sheet-description" className={className}>{children}</p>

  return {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
  }
})

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    className,
    size,
    variant,
  }: {
    children?: React.ReactNode
    onClick?: () => void
    className?: string
    size?: string
    variant?: string
  }) => {
    buttonPropsSpy({ className, size, variant })
    return (
      <button
        type="button"
        data-testid="open-full-button"
        data-size={size}
        data-variant={variant}
        className={className}
        onClick={onClick}
      >
        {children}
      </button>
    )
  },
}))

vi.mock('lucide-react', () => ({
  ExternalLink: ({ className }: { className?: string }) => (
    <svg data-testid="external-link-icon" className={className} />
  ),
}))

vi.mock('@/lib/utils', () => ({
  cn: (...inputs: Array<string | undefined | null | false>) => inputs.filter(Boolean).join(' '),
}))

describe('RecordSidePeek', () => {
  beforeEach(() => {
    sheetState.lastOpen = undefined
    sheetState.onOpenChange = undefined
    sheetState.contentClassName = ''
    sheetState.contentSide = ''
    buttonPropsSpy.mockClear()
  })

  it('renders title, subtitle, children and default width classes when open', () => {
    render(
      <RecordSidePeek
        open
        onClose={vi.fn()}
        title="Fiche client"
        subtitle="Entreprise"
      >
        <div>Contenu détaillé</div>
      </RecordSidePeek>,
    )

    expect(screen.getByTestId('sheet-root')).toHaveAttribute('data-open', 'true')
    expect(screen.getByTestId('sheet-content')).toHaveAttribute('data-side', 'right')
    expect(screen.getByTestId('sheet-title')).toHaveTextContent('Fiche client')
    expect(screen.getByTestId('sheet-description')).toHaveTextContent('Entreprise')
    expect(screen.getByText('Contenu détaillé')).toBeInTheDocument()
    expect(sheetState.contentClassName).toContain('p-0 flex flex-col gap-0')
    expect(sheetState.contentClassName).toContain('w-full sm:max-w-xl md:max-w-2xl')
  })

  it('does not render subtitle or full-open button when optional props are absent', () => {
    render(
      <RecordSidePeek
        open={false}
        onClose={vi.fn()}
        title="Sans options"
      >
        <div>Corps</div>
      </RecordSidePeek>,
    )

    expect(screen.getByTestId('sheet-root')).toHaveAttribute('data-open', 'false')
    expect(screen.queryByTestId('sheet-description')).not.toBeInTheDocument()
    expect(screen.queryByTestId('open-full-button')).not.toBeInTheDocument()
    expect(screen.getByText('Corps')).toBeInTheDocument()
  })

  it('renders the open full action with default label and triggers callback on click', () => {
    const onOpenFull = vi.fn()

    render(
      <RecordSidePeek
        open
        onClose={vi.fn()}
        title="Prospect"
        onOpenFull={onOpenFull}
      >
        <div>Infos</div>
      </RecordSidePeek>,
    )

    const button = screen.getByTestId('open-full-button')
    expect(button).toHaveTextContent('Ouvrir la fiche')
    expect(screen.getByTestId('external-link-icon')).toBeInTheDocument()
    expect(button).toHaveAttribute('data-size', 'sm')
    expect(button).toHaveAttribute('data-variant', 'outline')

    fireEvent.click(button)
    expect(onOpenFull).toHaveBeenCalledTimes(1)
    expect(buttonPropsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        size: 'sm',
        variant: 'outline',
        className: 'h-8 gap-1.5 mr-8',
      }),
    )
  })

  it('uses a custom label and appends custom width class', () => {
    render(
      <RecordSidePeek
        open
        onClose={vi.fn()}
        title="Dossier"
        onOpenFull={vi.fn()}
        openFullLabel="Voir la fiche complète"
        widthClassName="max-w-4xl"
      >
        <div>Prévisualisation</div>
      </RecordSidePeek>,
    )

    expect(screen.getByTestId('open-full-button')).toHaveTextContent('Voir la fiche complète')
    expect(sheetState.contentClassName).toContain('w-full sm:max-w-xl md:max-w-2xl')
    expect(sheetState.contentClassName).toContain('max-w-4xl')
  })

  it('calls onClose only when the sheet requests closing', () => {
    const onClose = vi.fn()

    render(
      <RecordSidePeek
        open
        onClose={onClose}
        title="Ticket"
      >
        <div>Historique</div>
      </RecordSidePeek>,
    )

    expect(sheetState.onOpenChange).toBeTypeOf('function')

    sheetState.onOpenChange?.(true)
    expect(onClose).not.toHaveBeenCalled()

    sheetState.onOpenChange?.(false)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('supports ReactNode title and subtitle content', () => {
    render(
      <RecordSidePeek
        open
        onClose={vi.fn()}
        title={<span>Commande <strong>#42</strong></span>}
        subtitle={<span>Statut <em>confirmé</em></span>}
      >
        <div>Détails commande</div>
      </RecordSidePeek>,
    )

    expect(screen.getByTestId('sheet-title')).toHaveTextContent('Commande #42')
    expect(screen.getByTestId('sheet-description')).toHaveTextContent('Statut confirmé')
    expect(screen.getByText('Détails commande')).toBeInTheDocument()
  })
})