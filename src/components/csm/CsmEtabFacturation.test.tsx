import React from 'react'
import { render, screen } from '@testing-library/react'

const {
  FACT,
  mockUseCsmFacturation,
  mockUpsert,
  mockEditableSelectCell,
  mockEditableCell,
  mockCalendar,
  mockButton,
  mockPopover,
  mockPopoverTrigger,
  mockPopoverContent,
} = vi.hoisted(() => {
  const FACT = {
    id: 'fact-1',
    etablissement_id: 'etab-1',
    modele_facturation: 'Statique',
    date_deploiement: '2025-01-10',
    date_debut_periode: '2025-02-01',
    date_fin_periode: '2025-02-28',
    derniere_relance: '2025-03-05',
    facturation_effectuee: 'OUI',
    notes: 'Texte notes',
  }

  const mockUpsert = vi.fn()
  const mockUseCsmFacturation = vi.fn()

  const mockEditableSelectCell = vi.fn(
    (props: { value?: string; options: Array<{ value: string; label: string }>; onSave: (v: string) => void }) => {
      return (
        <button
          type="button"
          data-testid="editable-select"
          data-value={props.value ?? ''}
          onClick={() => props.onSave(props.options[1]?.value ?? 'NA')}
        >
          {props.value ?? ''}
        </button>
      )
    }
  )

  const mockEditableCell = vi.fn(
    (props: { value?: string | null; placeholder?: string; multiline?: boolean; onSave: (v: string) => void }) => {
      return (
        <button type="button" data-testid="editable-cell" onClick={() => props.onSave('Nouvelle note')}>
          {props.value ?? props.placeholder ?? ''}
        </button>
      )
    }
  )

  const mockCalendar = vi.fn(
    (props: { selected?: Date; onSelect: (d?: Date) => void; mode?: string; initialFocus?: boolean }) => {
      return (
        <button type="button" data-testid="calendar" onClick={() => props.onSelect(new Date(2025, 2, 15))}>
          calendar
        </button>
      )
    }
  )

  const mockButton = vi.fn((props: React.ButtonHTMLAttributes<HTMLButtonElement>) => {
    const { children, ...rest } = props
    return (
      <button type="button" {...rest}>
        {children}
      </button>
    )
  })

  const mockPopover = vi.fn(
    (props: { open?: boolean; onOpenChange?: (v: boolean) => void; children?: React.ReactNode }) => {
      return <div data-testid="popover">{props.children}</div>
    }
  )

  const mockPopoverTrigger = vi.fn((props: { asChild?: boolean; children?: React.ReactNode }) => {
    return <div data-testid="popover-trigger">{props.children}</div>
  })

  const mockPopoverContent = vi.fn((props: { children?: React.ReactNode }) => {
    return <div data-testid="popover-content">{props.children}</div>
  })

  return {
    FACT,
    mockUseCsmFacturation,
    mockUpsert,
    mockEditableSelectCell,
    mockEditableCell,
    mockCalendar,
    mockButton,
    mockPopover,
    mockPopoverTrigger,
    mockPopoverContent,
  }
})

vi.mock('@/hooks/csm/useCsmFacturation', () => ({
  useCsmFacturation: (etablissementId: string) => mockUseCsmFacturation(etablissementId),
}))

vi.mock('@/components/ui/card', () => ({
  Card: (p: { children?: React.ReactNode }) => <div data-testid="card">{p.children}</div>,
  CardHeader: (p: { children?: React.ReactNode; className?: string }) => <div data-testid="card-header">{p.children}</div>,
  CardTitle: (p: { children?: React.ReactNode; className?: string }) => <div data-testid="card-title">{p.children}</div>,
  CardContent: (p: { children?: React.ReactNode }) => <div data-testid="card-content">{p.children}</div>,
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: (p: { children?: React.ReactNode; className?: string }) => (
    <span data-testid="badge" data-class={p.className ?? ''}>
      {p.children}
    </span>
  ),
}))

vi.mock('@/components/csm/EditableSelectCell', () => ({
  EditableSelectCell: (props: {
    value?: string
    options: Array<{ value: string; label: string }>
    onSave: (v: string) => void
  }) => mockEditableSelectCell(props),
}))

vi.mock('@/components/csm/EditableCell', () => ({
  EditableCell: (props: { value?: string | null; placeholder?: string; multiline?: boolean; onSave: (v: string) => void }) =>
    mockEditableCell(props),
}))

vi.mock('@/components/ui/button', () => ({
  Button: (props: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; size?: string }) => mockButton(props),
}))

vi.mock('@/components/ui/calendar', () => ({
  Calendar: (props: { selected?: Date; onSelect: (d?: Date) => void; mode?: string; initialFocus?: boolean; className?: string }) =>
    mockCalendar(props),
}))

vi.mock('@/components/ui/popover', () => ({
  Popover: (props: { open?: boolean; onOpenChange?: (v: boolean) => void; children?: React.ReactNode }) => mockPopover(props),
  PopoverTrigger: (props: { asChild?: boolean; children?: React.ReactNode }) => mockPopoverTrigger(props),
  PopoverContent: (props: { className?: string; align?: string; children?: React.ReactNode }) => mockPopoverContent(props),
}))

vi.mock('@/lib/utils', () => ({
  cn: (...args: Array<string | false | null | undefined>) => args.filter(Boolean).join(' '),
}))

vi.mock('lucide-react', () => ({
  Receipt: () => <span data-testid="icon-receipt" />,
  CalendarIcon: () => <span data-testid="icon-calendar" />,
}))

import { CsmEtabFacturation } from './CsmEtabFacturation'

describe('CsmEtabFacturation', () => {
  it('affiche les valeurs métier et le badge lorsque la facturation est présente', () => {
    mockUseCsmFacturation.mockReturnValue({ single: FACT, upsert: mockUpsert })

    render(<CsmEtabFacturation etablissementId="etab-1" />)

    expect(screen.getByText('Suivi facturation CSM')).toBeTruthy()

    const badge = screen.getByTestId('badge')
    expect(badge.textContent).toBe('OUI')
    expect(badge.getAttribute('data-class')?.includes('bg-emerald-100')).toBe(true)

    const selects = screen.getAllByTestId('editable-select')
    const values = selects.map((n) => n.getAttribute('data-value') ?? '')
    expect(values).toContain('Statique')
    expect(values).toContain('OUI')

    const note = screen.getByTestId('editable-cell')
    expect(note.textContent).toBe('Texte notes')

    expect(screen.getByText('10/01/2025')).toBeTruthy()
    expect(screen.getByText('01/02/2025')).toBeTruthy()
    expect(screen.getByText('28/02/2025')).toBeTruthy()
    expect(screen.getByText('05/03/2025')).toBeTruthy()
  })

  it('déclenche upsert avec le payload attendu lors de la sauvegarde (select + date + notes)', async () => {
    mockUseCsmFacturation.mockReturnValue({ single: FACT, upsert: mockUpsert })
    mockUpsert.mockClear()

    render(<CsmEtabFacturation etablissementId="etab-1" />)

    const selects = screen.getAllByTestId('editable-select')
    selects[0]?.click()

    expect(mockUpsert).toHaveBeenCalledTimes(1)
    const arg0 = mockUpsert.mock.calls[0]?.[0] as Record<string, unknown>
    expect(arg0.etablissement_id).toBe('etab-1')
    expect(arg0.modele_facturation).toBe('Succes +3')
    expect(arg0.notes).toBe('Texte notes')

    const calendars = screen.getAllByTestId('calendar')
    calendars[0]?.click()

    expect(mockUpsert).toHaveBeenCalledTimes(2)
    const arg1 = mockUpsert.mock.calls[1]?.[0] as Record<string, unknown>
    expect(arg1.etablissement_id).toBe('etab-1')
    expect(arg1.date_deploiement).toBe('2025-03-15')

    const noteBtn = screen.getByTestId('editable-cell')
    noteBtn.click()

    expect(mockUpsert).toHaveBeenCalledTimes(3)
    const arg2 = mockUpsert.mock.calls[2]?.[0] as Record<string, unknown>
    expect(arg2.etablissement_id).toBe('etab-1')
    expect(arg2.notes).toBe('Nouvelle note')
  })

  it('ne rend pas de badge si facturation_effectuee est absente', () => {
    mockUseCsmFacturation.mockReturnValue({
      single: { ...FACT, facturation_effectuee: null },
      upsert: mockUpsert,
    })

    render(<CsmEtabFacturation etablissementId="etab-1" />)

    expect(screen.queryByTestId('badge')).toBeNull()

    const selects = screen.getAllByTestId('editable-select')
    const values = selects.map((n) => n.getAttribute('data-value') ?? '')
    expect(values).toContain('NA')
  })
})