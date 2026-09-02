/* @vitest-environment jsdom */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BulkActionsBarGeo } from './BulkActionsBarGeo'

const {
  ETABLISSEMENTS,
  PROFILES,
  CATEGORIES,
  toastSpy,
  exportSpy,
  sanitizeSpy,
  onClearSelectionSpy,
  invalidateQueriesSpy,
  mockUseProfiles,
  mockUseCategories,
  mockUseToast,
  insertMock,
  mockFrom,
} = vi.hoisted(() => {
  const ETABLISSEMENTS = [
    { id: 'e1', nom: 'Alpha' },
    { id: 'e2', nom: 'Beta' },
    { id: 'e3', nom: 'Gamma' },
  ]
  const PROFILES = [
    { id: 'p1', prenom: 'Jean', nom: 'Dupont' },
    { id: 'p2', prenom: 'Lea', nom: 'Martin' },
  ]
  const CATEGORIES = [
    { id: 'c1', nom: 'Visite' },
    { id: 'c2', nom: 'Relance' },
  ]
  const toastSpy = vi.fn()
  const exportSpy = vi.fn()
  const sanitizeSpy = vi.fn(() => 'Erreur propre')
  const onClearSelectionSpy = vi.fn()
  const invalidateQueriesSpy = vi.fn()
  const insertMock = vi.fn()

  const createBuilder = () => {
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      gte: vi.fn(() => builder),
      lte: vi.fn(() => builder),
      in: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      insert: insertMock,
      update: vi.fn(() => builder),
      delete: vi.fn(() => builder),
      upsert: vi.fn(() => builder),
      single: vi.fn(async () => ({ data: null, error: null })),
      maybeSingle: vi.fn(async () => ({ data: null, error: null })),
      then: (onFulfilled: (value: unknown) => unknown) =>
        Promise.resolve({ data: null, error: null }).then(onFulfilled),
      catch: (onRejected: (reason: unknown) => unknown) =>
        Promise.resolve({ data: null, error: null }).catch(onRejected),
    }
    return builder
  }

  const mockFrom = vi.fn(() => createBuilder())
  const mockUseProfiles = vi.fn(() => ({ data: PROFILES }))
  const mockUseCategories = vi.fn(() => ({ data: CATEGORIES }))
  const mockUseToast = vi.fn(() => ({ toast: toastSpy }))

  return {
    ETABLISSEMENTS,
    PROFILES,
    CATEGORIES,
    toastSpy,
    exportSpy,
    sanitizeSpy,
    onClearSelectionSpy,
    invalidateQueriesSpy,
    mockUseProfiles,
    mockUseCategories,
    mockUseToast,
    insertMock,
    mockFrom,
  }
})

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    ariaLabel,
    title,
    ...props
  }: React.PropsWithChildren<{
    onClick?: () => void
    disabled?: boolean
    ariaLabel?: string
    title?: string
  }>) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel ?? props['aria-label']}
      title={title}
    >
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({
    open,
    children,
  }: React.PropsWithChildren<{ open: boolean; onOpenChange?: (open: boolean) => void }>) =>
    open ? <div data-testid="dialog-root">{children}</div> : null,
  DialogContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DialogHeader: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DialogTitle: ({ children }: React.PropsWithChildren) => <h2>{children}</h2>,
  DialogFooter: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}))

vi.mock('@/components/ui/input', () => ({
  Input: ({
    value,
    onChange,
    placeholder,
    type,
  }: {
    value?: string
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
    placeholder?: string
    type?: string
  }) => <input value={value} onChange={onChange} placeholder={placeholder} type={type} />,
}))

vi.mock('@/components/ui/label', () => ({
  Label: ({ children }: React.PropsWithChildren) => <label>{children}</label>,
}))

vi.mock('@/components/ui/textarea', () => ({
  Textarea: ({
    value,
    onChange,
    placeholder,
  }: {
    value?: string
    onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
    placeholder?: string
    rows?: number
  }) => <textarea value={value} onChange={onChange} placeholder={placeholder} />,
}))

vi.mock('@/components/ui/select', () => {
  const ReactModule = React
  type SelectContextValue = {
    value?: string
    onValueChange?: (value: string) => void
  }
  const SelectContext = ReactModule.createContext<SelectContextValue>({})

  const Select = ({
    value,
    onValueChange,
    children,
  }: React.PropsWithChildren<SelectContextValue>) => (
    <SelectContext.Provider value={{ value, onValueChange }}>
      <div>{children}</div>
    </SelectContext.Provider>
  )

  const SelectTrigger = ({ children }: React.PropsWithChildren) => <div>{children}</div>
  const SelectValue = ({ placeholder }: { placeholder?: string }) => <span>{placeholder ?? ''}</span>
  const SelectContent = ({ children }: React.PropsWithChildren) => <div>{children}</div>
  const SelectItem = ({
    value,
    children,
  }: React.PropsWithChildren<{ value: string }>) => {
    const ctx = ReactModule.useContext(SelectContext)
    return (
      <button type="button" onClick={() => ctx.onValueChange?.(value)}>
        {children}
      </button>
    )
  }

  return { Select, SelectContent, SelectItem, SelectTrigger, SelectValue }
})

vi.mock('lucide-react', () => ({
  X: () => <svg data-testid="icon-x" />,
  Download: () => <svg data-testid="icon-download" />,
  ListPlus: () => <svg data-testid="icon-list-plus" />,
  Loader2: () => <svg data-testid="icon-loader" />,
}))

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: sanitizeSpy,
}))

vi.mock('@/hooks/profile/useProfiles', () => ({
  useProfiles: mockUseProfiles,
}))

vi.mock('@/hooks/catalogue/useCategories', () => ({
  useCategories: mockUseCategories,
}))

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: mockUseToast,
}))

vi.mock('@/lib/analyseGeoUtils', () => ({
  exportEtablissementsToCSV: exportSpy,
}))

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })
  vi.spyOn(queryClient, 'invalidateQueries').mockImplementation(invalidateQueriesSpy)

  function Wrapper({ children }: React.PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }

  return Wrapper
}

describe('BulkActionsBarGeo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseProfiles.mockReturnValue({ data: PROFILES })
    mockUseCategories.mockReturnValue({ data: CATEGORIES })
    mockUseToast.mockReturnValue({ toast: toastSpy })
    insertMock.mockResolvedValue({ error: null })
    sanitizeSpy.mockReturnValue('Erreur propre')
  })

  it('ne rend rien quand aucune sélection', () => {
    const { container } = render(
      <BulkActionsBarGeo
        selectedIds={[]}
        etablissements={ETABLISSEMENTS}
        onClearSelection={onClearSelectionSpy}
      />,
      { wrapper: createWrapper() }
    )

    expect(container).toBeEmptyDOMElement()
  })

  it('exporte uniquement les établissements sélectionnés et affiche un toast de succès', () => {
    render(
      <BulkActionsBarGeo
        selectedIds={['e1', 'e3']}
        etablissements={ETABLISSEMENTS}
        onClearSelection={onClearSelectionSpy}
      />,
      { wrapper: createWrapper() }
    )

    expect(screen.getByText('2 sélectionnés')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /exporter/i }))

    expect(exportSpy).toHaveBeenCalledTimes(1)
    expect(exportSpy).toHaveBeenCalledWith(
      [ETABLISSEMENTS[0], ETABLISSEMENTS[2]],
      'etablissements_selection'
    )
    expect(toastSpy).toHaveBeenCalledWith({
      title: '2 établissement(s) exporté(s)',
    })
  })

  it('ouvre la fenêtre de création et valide les champs obligatoires', async () => {
    render(
      <BulkActionsBarGeo
        selectedIds={['e1', 'e2']}
        etablissements={ETABLISSEMENTS}
        onClearSelection={onClearSelectionSpy}
      />,
      { wrapper: createWrapper() }
    )

    fireEvent.click(screen.getByRole('button', { name: /créer tâche groupée/i }))

    expect(screen.getByText('Créer une tâche pour 2 établissement(s)')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /créer 2 tâche\(s\)/i }))

    await waitFor(() => {
      expect(toastSpy).toHaveBeenCalledWith({
        title: 'Veuillez remplir les champs obligatoires',
        variant: 'destructive',
      })
    })

    expect(insertMock).not.toHaveBeenCalled()
  })

  it('crée des tâches groupées, invalide les requêtes et réinitialise la sélection', async () => {
    render(
      <BulkActionsBarGeo
        selectedIds={['e1', 'e2']}
        etablissements={ETABLISSEMENTS}
        onClearSelection={onClearSelectionSpy}
      />,
      { wrapper: createWrapper() }
    )

    fireEvent.click(screen.getByRole('button', { name: /créer tâche groupée/i }))

    fireEvent.change(screen.getByPlaceholderText('Titre de la tâche'), {
      target: { value: 'Appel de suivi' },
    })
    fireEvent.change(screen.getByPlaceholderText('Description optionnelle'), {
      target: { value: 'Contacter les établissements' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Visite' }))
    fireEvent.click(screen.getByRole('button', { name: 'Jean Dupont' }))
    fireEvent.click(screen.getByRole('button', { name: '🔴 Haute' }))

    const dateInput = screen.getByDisplayValue('') as HTMLInputElement
    fireEvent.change(dateInput, { target: { value: '2026-05-20' } })

    fireEvent.click(screen.getByRole('button', { name: /créer 2 tâche\(s\)/i }))

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('taches')
      expect(insertMock).toHaveBeenCalledTimes(1)
    })

    expect(insertMock).toHaveBeenCalledWith([
      {
        titre: 'Appel de suivi',
        description: 'Contacter les établissements',
        etablissement_id: 'e1',
        categorie_id: 'c1',
        responsable_id: 'p1',
        priorite: 'high',
        echeance: '2026-05-20',
        statut: 'A faire',
      },
      {
        titre: 'Appel de suivi',
        description: 'Contacter les établissements',
        etablissement_id: 'e2',
        categorie_id: 'c1',
        responsable_id: 'p1',
        priorite: 'high',
        echeance: '2026-05-20',
        statut: 'A faire',
      },
    ])

    await waitFor(() => {
      expect(toastSpy).toHaveBeenCalledWith({
        title: '2 tâche(s) créée(s)',
      })
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['taches'] })
      expect(onClearSelectionSpy).toHaveBeenCalledTimes(1)
    })

    await waitFor(() => {
      expect(screen.queryByText('Créer une tâche pour 2 établissement(s)')).not.toBeInTheDocument()
    })
  })

  it('gère une erreur Supabase et affiche un toast destructif', async () => {
    const supabaseError = { message: 'x' }
    insertMock.mockResolvedValueOnce({ error: supabaseError })
    sanitizeSpy.mockReturnValueOnce('Erreur propre')

    render(
      <BulkActionsBarGeo
        selectedIds={['e1']}
        etablissements={ETABLISSEMENTS}
        onClearSelection={onClearSelectionSpy}
      />,
      { wrapper: createWrapper() }
    )

    fireEvent.click(screen.getByRole('button', { name: /créer tâche groupée/i }))

    fireEvent.change(screen.getByPlaceholderText('Titre de la tâche'), {
      target: { value: 'Nouvelle tâche' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Relance' }))

    fireEvent.click(screen.getByRole('button', { name: /créer 1 tâche\(s\)/i }))

    await waitFor(() => {
      expect(sanitizeSpy).toHaveBeenCalledWith(supabaseError)
    })

    expect(toastSpy).toHaveBeenCalledWith({
      title: 'Erreur',
      description: 'Erreur propre',
      variant: 'destructive',
    })
    expect(invalidateQueriesSpy).not.toHaveBeenCalled()
    expect(onClearSelectionSpy).not.toHaveBeenCalled()
    expect(screen.getByText('Créer une tâche pour 1 établissement(s)')).toBeInTheDocument()
  })

  it('annule la sélection via le bouton dédié', () => {
    render(
      <BulkActionsBarGeo
        selectedIds={['e2']}
        etablissements={ETABLISSEMENTS}
        onClearSelection={onClearSelectionSpy}
      />,
      { wrapper: createWrapper() }
    )

    fireEvent.click(screen.getByRole('button', { name: 'Annuler la sélection' }))

    expect(onClearSelectionSpy).toHaveBeenCalledTimes(1)
  })
})