/* @vitest-environment jsdom */
import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { CatalogueImportDialog } from './CatalogueImportDialog'
import { parseProduitsCSV, useProduitImport } from '@/hooks/catalogue/useProduitImport'

const { PARSED_ROWS, importRowsMock } = vi.hoisted(() => ({
  PARSED_ROWS: [
    {
      code: 'P-001',
      nom: 'Produit valide',
      description: 'desc',
      type: 'service',
      categorie: 'Cat A',
      prix_unitaire_ht: 120,
      taux_tva: 20,
      unite: 'u',
      est_actif: true,
    },
    {
      code: 'P-002',
      nom: 'Produit invalide',
      description: 'desc2',
      type: 'produit',
      categorie: 'Cat B',
      prix_unitaire_ht: 50,
      taux_tva: 20,
      unite: 'u',
      est_actif: true,
      _errors: ['code dupliqué', 'prix invalide'],
    },
  ],
  importRowsMock: vi.fn(),
}))

vi.mock('lucide-react', () => ({
  Upload: (props: React.SVGProps<SVGSVGElement>) => React.createElement('svg', props),
  FileText: (props: React.SVGProps<SVGSVGElement>) => React.createElement('svg', props),
  AlertCircle: (props: React.SVGProps<SVGSVGElement>) => React.createElement('svg', props),
}))

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({
    open,
    children,
  }: {
    open: boolean
    onOpenChange?: (o: boolean) => void
    children: React.ReactNode
  }) => (open ? React.createElement('div', { 'data-testid': 'dialog-root' }, children) : null),
  DialogContent: ({
    children,
    ...props
  }: React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode }) =>
    React.createElement('div', props, children),
  DialogHeader: ({
    children,
    ...props
  }: React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode }) =>
    React.createElement('div', props, children),
  DialogTitle: ({
    children,
    ...props
  }: React.HTMLAttributes<HTMLHeadingElement> & { children: React.ReactNode }) =>
    React.createElement('h2', props, children),
  DialogFooter: ({
    children,
    ...props
  }: React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode }) =>
    React.createElement('div', props, children),
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    disabled,
    onClick,
    type = 'button',
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) =>
    React.createElement('button', { type, disabled, onClick, ...props }, children),
}))

vi.mock('@/components/ui/alert', () => ({
  Alert: ({
    children,
    ...props
  }: React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode }) =>
    React.createElement('div', props, children),
  AlertDescription: ({
    children,
    ...props
  }: React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode }) =>
    React.createElement('div', props, children),
}))

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({
    children,
    ...props
  }: React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode }) =>
    React.createElement('div', props, children),
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({
    children,
    ...props
  }: React.HTMLAttributes<HTMLSpanElement> & { children: React.ReactNode }) =>
    React.createElement('span', props, children),
}))

vi.mock('@/hooks/catalogue/useProduitImport', () => ({
  parseProduitsCSV: vi.fn(() => PARSED_ROWS),
  useProduitImport: vi.fn(() => ({
    importRows: importRowsMock,
    isImporting: false,
  })),
}))

describe('CatalogueImportDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(parseProduitsCSV).mockReturnValue(PARSED_ROWS)
    vi.mocked(useProduitImport).mockReturnValue({
      importRows: importRowsMock,
      isImporting: false,
    })
  })

  it('affiche l’état initial avec le bouton d’import désactivé', () => {
    render(<CatalogueImportDialog open onOpenChange={vi.fn()} />)

    expect(screen.getByText('Importer un catalogue CSV')).toBeInTheDocument()
    expect(screen.getByText('Choisir un fichier CSV…')).toBeInTheDocument()
    expect(screen.getByText(/code, nom, description, type, categorie, prix_unitaire_ht/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Importer' })).toBeDisabled()
    expect(screen.queryByText('1 valides')).not.toBeInTheDocument()
    expect(screen.queryByText('1 en erreur')).not.toBeInTheDocument()
  })

  it('parse un fichier CSV, affiche les lignes valides/en erreur et importe avec succès', async () => {
    const onOpenChange = vi.fn()
    importRowsMock.mockResolvedValue({ inserted: 1, updated: 0, errors: [] })

    render(<CatalogueImportDialog open onOpenChange={onOpenChange} />)

    const input = document.querySelector('input[type="file"]')
    expect(input).not.toBeNull()

    const file = {
      name: 'catalogue.csv',
      text: vi.fn().mockResolvedValue('code,nom\nP-001,Produit'),
    }

    fireEvent.change(input as HTMLInputElement, { target: { files: [file] } })

    await waitFor(() => {
      expect(file.text).toHaveBeenCalledTimes(1)
      expect(parseProduitsCSV).toHaveBeenCalledWith('code,nom\nP-001,Produit')
    })

    expect(screen.getByText('catalogue.csv')).toBeInTheDocument()
    expect(screen.getByText('1 valides')).toBeInTheDocument()
    expect(screen.getByText('1 en erreur')).toBeInTheDocument()
    expect(screen.getByText('P-001')).toBeInTheDocument()
    expect(screen.getByText('Produit valide')).toBeInTheDocument()
    expect(screen.getByText('120€')).toBeInTheDocument()
    expect(screen.getByText('P-002')).toBeInTheDocument()
    expect(screen.getByText('Produit invalide')).toBeInTheDocument()
    expect(screen.getByText('code dupliqué, prix invalide')).toBeInTheDocument()

    const importButton = screen.getByRole('button', { name: 'Importer (1)' })
    expect(importButton).toBeEnabled()

    fireEvent.click(importButton)

    await waitFor(() => {
      expect(importRowsMock).toHaveBeenCalledWith(PARSED_ROWS)
    })

    expect(onOpenChange).toHaveBeenCalledWith(false)

    await waitFor(() => {
      expect(screen.getByText('Choisir un fichier CSV…')).toBeInTheDocument()
    })

    expect(screen.queryByText('catalogue.csv')).not.toBeInTheDocument()
    expect(screen.queryByText('1 valides')).not.toBeInTheDocument()
    expect(screen.queryByText('1 en erreur')).not.toBeInTheDocument()
  })

  it('ne ferme pas la dialog si l’import ne crée aucune ligne', async () => {
    const onOpenChange = vi.fn()
    importRowsMock.mockResolvedValue({ inserted: 0, updated: 0, errors: ['none'] })

    render(<CatalogueImportDialog open onOpenChange={onOpenChange} />)

    const input = document.querySelector('input[type="file"]')
    expect(input).not.toBeNull()

    const file = {
      name: 'catalogue.csv',
      text: vi.fn().mockResolvedValue('csv'),
    }

    fireEvent.change(input as HTMLInputElement, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Importer (1)' })).toBeEnabled()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Importer (1)' }))

    await waitFor(() => {
      expect(importRowsMock).toHaveBeenCalledWith(PARSED_ROWS)
    })

    expect(onOpenChange).not.toHaveBeenCalledWith(false)
    expect(screen.getByText('catalogue.csv')).toBeInTheDocument()
    expect(screen.getByText('1 valides')).toBeInTheDocument()
    expect(screen.getByText('1 en erreur')).toBeInTheDocument()
  })

  it('désactive le bouton Importer pendant un import en cours', async () => {
    vi.mocked(useProduitImport).mockReturnValue({
      importRows: importRowsMock,
      isImporting: true,
    })

    render(<CatalogueImportDialog open onOpenChange={vi.fn()} />)

    const input = document.querySelector('input[type="file"]')
    expect(input).not.toBeNull()

    const file = {
      name: 'catalogue.csv',
      text: vi.fn().mockResolvedValue('csv'),
    }

    fireEvent.change(input as HTMLInputElement, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText('1 valides')).toBeInTheDocument()
    })

    expect(screen.getByRole('button', { name: 'Importer (1)' })).toBeDisabled()
  })

  it('ferme via Annuler', () => {
    const onOpenChange = vi.fn()

    render(<CatalogueImportDialog open onOpenChange={onOpenChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }))

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})