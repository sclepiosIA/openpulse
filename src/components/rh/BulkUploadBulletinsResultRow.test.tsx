// @vitest-environment jsdom

import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { BulkUploadBulletinsResultRow } from './BulkUploadBulletinsResultRow'

const {
  badgeProps,
  buttonProps,
  selectRootProps,
  selectTriggerProps,
  selectValueProps,
  selectItemProps,
} = vi.hoisted(() => ({
  badgeProps: vi.fn(),
  buttonProps: vi.fn(),
  selectRootProps: vi.fn(),
  selectTriggerProps: vi.fn(),
  selectValueProps: vi.fn(),
  selectItemProps: vi.fn(),
}))

vi.mock('lucide-react', () => {
  const makeIcon = (name: string) => {
    const Comp = (props: React.SVGProps<SVGSVGElement>) =>
      React.createElement('svg', {
        ...props,
        'data-testid': name,
      })
    Comp.displayName = name
    return Comp
  }

  return {
    FileText: makeIcon('FileText'),
    CheckCircle2: makeIcon('CheckCircle2'),
    XCircle: makeIcon('XCircle'),
    AlertCircle: makeIcon('AlertCircle'),
    Upload: makeIcon('Upload'),
  }
})

vi.mock('@/components/ui/badge', () => ({
  Badge: ({
    children,
    variant,
  }: {
    children: React.ReactNode
    variant?: string
  }) => {
    badgeProps({ variant })
    return <div data-testid="badge">{children}</div>
  },
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    className,
    size,
    variant,
  }: {
    children: React.ReactNode
    onClick?: () => void
    disabled?: boolean
    className?: string
    size?: string
    variant?: string
  }) => {
    buttonProps({ disabled, className, size, variant })
    return (
      <button onClick={onClick} disabled={disabled} data-testid="manual-associate-button">
        {children}
      </button>
    )
  },
}))

vi.mock('@/components/ui/select', () => {
  const SelectContext = React.createContext<{
    value: string
    onValueChange?: (value: string) => void
  }>({ value: '' })

  return {
    Select: ({
      children,
      value,
      onValueChange,
    }: {
      children: React.ReactNode
      value: string
      onValueChange?: (value: string) => void
    }) => {
      selectRootProps({ value })
      return (
        <SelectContext.Provider value={{ value, onValueChange }}>
          <div data-testid="select-root">{children}</div>
        </SelectContext.Provider>
      )
    },
    SelectTrigger: ({ children, className }: { children: React.ReactNode; className?: string }) => {
      selectTriggerProps({ className })
      return <div data-testid="select-trigger">{children}</div>
    },
    SelectValue: ({ placeholder }: { placeholder?: string }) => {
      selectValueProps({ placeholder })
      return <span data-testid="select-value">{placeholder}</span>
    },
    SelectContent: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="select-content">{children}</div>
    ),
    SelectItem: ({
      children,
      value,
    }: {
      children: React.ReactNode
      value: string
    }) => {
      const ctx = React.useContext(SelectContext)
      selectItemProps({ value })
      return (
        <button
          type="button"
          data-testid={`select-item-${value}`}
          onClick={() => ctx.onValueChange?.(value)}
        >
          {children}
        </button>
      )
    },
  }
})

describe('BulkUploadBulletinsResultRow', () => {
  const profilesMap = new Map([
    ['p1', { id: 'p1', prenom: 'Jean', nom: 'Dupont', email: 'jean@example.fr' }],
    ['p2', { id: 'p2', prenom: 'Marie', nom: 'Curie', email: 'marie@example.fr' }],
  ])

  it('affiche l’état pending avec le nom de fichier et l’icône correspondante', () => {
    render(
      <BulkUploadBulletinsResultRow
        result={{ status: 'pending', fileName: 'bulletin-janvier.pdf' }}
        index={0}
        profilesMap={profilesMap}
        isProcessing={false}
        onManualProfileChange={vi.fn()}
        onManualAssociate={vi.fn()}
      />,
    )

    expect(screen.getByText('bulletin-janvier.pdf')).toBeInTheDocument()
    expect(screen.getByTestId('FileText')).toBeInTheDocument()
    expect(screen.queryByTestId('badge')).not.toBeInTheDocument()
    expect(screen.queryByText('Analyse GPT en cours...')).not.toBeInTheDocument()
  })

  it('affiche le succès avec les infos métier exactes et le badge Exact', () => {
    render(
      <BulkUploadBulletinsResultRow
        result={{
          status: 'success',
          fileName: 'paie-fevrier.pdf',
          employeeName: 'Jean Dupont',
          mois: '2024-02',
          matchType: 'exact',
        }}
        index={1}
        profilesMap={profilesMap}
        isProcessing={false}
        onManualProfileChange={vi.fn()}
        onManualAssociate={vi.fn()}
      />,
    )

    expect(screen.getByTestId('CheckCircle2')).toBeInTheDocument()
    expect(screen.getByText('paie-fevrier.pdf')).toBeInTheDocument()
    expect(screen.getByText('Jean Dupont • 2024-02')).toBeInTheDocument()
    expect(screen.getByTestId('badge')).toHaveTextContent('Exact')
    expect(badgeProps).toHaveBeenLastCalledWith({ variant: 'default' })
  })

  it('affiche le succès partiel avec la mention de correspondance partielle et le badge secondary', () => {
    render(
      <BulkUploadBulletinsResultRow
        result={{
          status: 'success',
          fileName: 'paie-mars.pdf',
          employeeName: 'Marie Curie',
          mois: '2024-03',
          matchType: 'partial',
        }}
        index={2}
        profilesMap={profilesMap}
        isProcessing={false}
        onManualProfileChange={vi.fn()}
        onManualAssociate={vi.fn()}
      />,
    )

    expect(screen.getByText('Marie Curie • 2024-03 (correspondance partielle)')).toBeInTheDocument()
    expect(screen.getByTestId('badge')).toHaveTextContent('Partiel')
    expect(badgeProps).toHaveBeenLastCalledWith({ variant: 'secondary' })
  })

  it('affiche le succès manuel avec la mention association manuelle et le badge Manuel', () => {
    render(
      <BulkUploadBulletinsResultRow
        result={{
          status: 'success',
          fileName: 'paie-avril.pdf',
          employeeName: 'Jean Dupont',
          mois: '2024-04',
          matchType: 'manual',
        }}
        index={3}
        profilesMap={profilesMap}
        isProcessing={false}
        onManualProfileChange={vi.fn()}
        onManualAssociate={vi.fn()}
      />,
    )

    expect(screen.getByText('Jean Dupont • 2024-04 (association manuelle)')).toBeInTheDocument()
    expect(screen.getByTestId('badge')).toHaveTextContent('Manuel')
    expect(badgeProps).toHaveBeenLastCalledWith({ variant: 'default' })
  })

  it('affiche les messages de progression analyzing et uploading avec les bonnes icônes', () => {
    const { rerender } = render(
      <BulkUploadBulletinsResultRow
        result={{ status: 'analyzing', fileName: 'analyse.pdf' }}
        index={0}
        profilesMap={profilesMap}
        isProcessing={false}
        onManualProfileChange={vi.fn()}
        onManualAssociate={vi.fn()}
      />,
    )

    expect(screen.getByTestId('AlertCircle')).toBeInTheDocument()
    expect(screen.getByText('Analyse GPT en cours...')).toBeInTheDocument()

    rerender(
      <BulkUploadBulletinsResultRow
        result={{ status: 'uploading', fileName: 'upload.pdf' }}
        index={0}
        profilesMap={profilesMap}
        isProcessing={false}
        onManualProfileChange={vi.fn()}
        onManualAssociate={vi.fn()}
      />,
    )

    expect(screen.getByTestId('Upload')).toBeInTheDocument()
    expect(screen.getByText('Upload et création du salaire...')).toBeInTheDocument()
  })

  it('affiche l’erreur et permet l’association manuelle avec changement de profil puis clic sur le bouton', () => {
    const onManualProfileChange = vi.fn()
    const onManualAssociate = vi.fn()

    render(
      <BulkUploadBulletinsResultRow
        result={{
          status: 'error',
          fileName: 'erreur.pdf',
          error: 'Employé introuvable',
          canAssociateManually: true,
          manualProfileId: 'p2',
        }}
        index={7}
        profilesMap={profilesMap}
        isProcessing={false}
        onManualProfileChange={onManualProfileChange}
        onManualAssociate={onManualAssociate}
      />,
    )

    expect(screen.getByTestId('XCircle')).toBeInTheDocument()
    expect(screen.getByText('Employé introuvable')).toBeInTheDocument()
    expect(screen.getByText('Associez manuellement ce bulletin à un employé')).toBeInTheDocument()
    expect(screen.getByText('Jean Dupont (jean@example.fr)')).toBeInTheDocument()
    expect(screen.getByText('Marie Curie (marie@example.fr)')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('select-item-p1'))
    expect(onManualProfileChange).toHaveBeenCalledWith(7, 'p1')

    const button = screen.getByTestId('manual-associate-button')
    expect(button).not.toBeDisabled()
    fireEvent.click(button)
    expect(onManualAssociate).toHaveBeenCalledWith(7)
  })

  it('désactive le bouton d’association manuelle si aucun profil n’est sélectionné', () => {
    render(
      <BulkUploadBulletinsResultRow
        result={{
          status: 'error',
          fileName: 'sans-selection.pdf',
          error: 'Aucune correspondance',
          canAssociateManually: true,
          manualProfileId: '',
        }}
        index={4}
        profilesMap={profilesMap}
        isProcessing={false}
        onManualProfileChange={vi.fn()}
        onManualAssociate={vi.fn()}
      />,
    )

    expect(screen.getByTestId('manual-associate-button')).toBeDisabled()
    expect(buttonProps).toHaveBeenLastCalledWith({
      disabled: true,
      className: 'w-full text-xs',
      size: 'sm',
      variant: 'outline',
    })
  })

  it('ne montre pas l’UI d’association manuelle pendant le traitement ou sans profils', () => {
    const { rerender } = render(
      <BulkUploadBulletinsResultRow
        result={{
          status: 'error',
          fileName: 'processing.pdf',
          error: 'Erreur',
          canAssociateManually: true,
          manualProfileId: '',
        }}
        index={5}
        profilesMap={profilesMap}
        isProcessing={true}
        onManualProfileChange={vi.fn()}
        onManualAssociate={vi.fn()}
      />,
    )

    expect(screen.queryByText('Associez manuellement ce bulletin à un employé')).not.toBeInTheDocument()
    expect(screen.queryByTestId('select-root')).not.toBeInTheDocument()

    rerender(
      <BulkUploadBulletinsResultRow
        result={{
          status: 'error',
          fileName: 'no-profiles.pdf',
          error: 'Erreur',
          canAssociateManually: true,
          manualProfileId: '',
        }}
        index={6}
        profilesMap={new Map()}
        isProcessing={false}
        onManualProfileChange={vi.fn()}
        onManualAssociate={vi.fn()}
      />,
    )

    expect(screen.queryByText('Associez manuellement ce bulletin à un employé')).not.toBeInTheDocument()
    expect(screen.queryByTestId('select-root')).not.toBeInTheDocument()
  })
})