// @vitest-environment jsdom

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ContractBuilderLayout } from './ContractBuilderLayout'

const {
  SECTIONS,
  TREE,
  updateMutate,
  createMutate,
  reorderMutate,
  buildSectionTreeMock,
  useContractSectionsMock,
  useUpdateSectionMock,
  useCreateSectionMock,
  useReorderSectionsMock,
  useIsMobileMock,
  binderPropsSpy,
  editorPropsSpy,
  previewPropsSpy,
  drawerPropsSpy,
} = vi.hoisted(() => {
  const sections = [
    {
      id: 'sec-1',
      contrat_id: 'ctr-1',
      parent_id: null,
      titre: 'Préambule',
      type: 'section',
      ordre: 0,
    },
    {
      id: 'sec-2',
      contrat_id: 'ctr-1',
      parent_id: null,
      titre: 'Obligations',
      type: 'section',
      ordre: 1,
    },
  ]

  const tree = [
    {
      id: 'sec-1',
      contrat_id: 'ctr-1',
      parent_id: null,
      titre: 'Préambule',
      type: 'section',
      ordre: 0,
      children: [],
    },
    {
      id: 'sec-2',
      contrat_id: 'ctr-1',
      parent_id: null,
      titre: 'Obligations',
      type: 'section',
      ordre: 1,
      children: [],
    },
  ]

  return {
    SECTIONS: sections,
    TREE: tree,
    updateMutate: vi.fn(),
    createMutate: vi.fn(),
    reorderMutate: vi.fn(),
    buildSectionTreeMock: vi.fn(() => tree),
    useContractSectionsMock: vi.fn(() => ({ data: sections, isLoading: false })),
    useUpdateSectionMock: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
    useCreateSectionMock: vi.fn(() => ({ mutate: vi.fn() })),
    useReorderSectionsMock: vi.fn(() => ({ mutate: vi.fn() })),
    useIsMobileMock: vi.fn(() => false),
    binderPropsSpy: vi.fn(),
    editorPropsSpy: vi.fn(),
    previewPropsSpy: vi.fn(),
    drawerPropsSpy: vi.fn(),
  }
})

vi.mock('@/hooks/ui/use-mobile', () => ({
  useIsMobile: useIsMobileMock,
}))

vi.mock('@/components/ui/resizable', () => ({
  ResizablePanelGroup: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="resizable-group">{children}</div>
  ),
  ResizablePanel: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="resizable-panel">{children}</div>
  ),
  ResizableHandle: () => <div data-testid="resizable-handle" />,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    ...props
  }: {
    children: React.ReactNode
    onClick?: () => void
  } & Record<string, unknown>) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('lucide-react', () => ({
  PanelLeftClose: () => <svg data-testid="icon-panel-left-close" />,
  PanelLeftOpen: () => <svg data-testid="icon-panel-left-open" />,
  PanelRightClose: () => <svg data-testid="icon-panel-right-close" />,
  PanelRightOpen: () => <svg data-testid="icon-panel-right-open" />,
  Library: () => <svg data-testid="icon-library" />,
  Eye: () => <svg data-testid="icon-eye" />,
  EyeOff: () => <svg data-testid="icon-eye-off" />,
  Save: () => <svg data-testid="icon-save" />,
}))

vi.mock('./ContractBinder', () => ({
  ContractBinder: (props: {
    sections: typeof TREE
    selectedId: string | null
    onSelect: (id: string) => void
    onAddSection: (parentId?: string) => void
    onReorder: (sections: { id: string; ordre: number; parent_id: string | null }[]) => void
    isLoading: boolean
  }) => {
    binderPropsSpy(props)
    return (
      <div data-testid="contract-binder">
        <div>Binder count: {props.sections.length}</div>
        <div>Binder loading: {String(props.isLoading)}</div>
        <button onClick={() => props.onSelect('sec-1')}>select-sec-1</button>
        <button onClick={() => props.onAddSection()}>add-root-section</button>
        <button onClick={() => props.onReorder([{ id: 'sec-2', ordre: 0, parent_id: null }])}>
          reorder-sections
        </button>
      </div>
    )
  },
}))

vi.mock('./LazyContractSectionEditor', () => ({
  ContractSectionEditor: (props: {
    section: (typeof SECTIONS)[number] | undefined
    onUpdate: (data: Partial<(typeof SECTIONS)[number]>) => void
    isSaving: boolean
  }) => {
    editorPropsSpy(props)
    return (
      <div data-testid="contract-editor">
        <div>Editor section: {props.section ? props.section.titre : 'none'}</div>
        <div>Editor saving: {String(props.isSaving)}</div>
        <button onClick={() => props.onUpdate({ titre: 'Titre modifié' })}>update-section</button>
      </div>
    )
  },
}))

vi.mock('./ContractPreview', () => ({
  ContractPreview: (props: {
    sections: typeof TREE
    titre: string
    highlightedSectionId?: string | null
  }) => {
    previewPropsSpy(props)
    return (
      <div data-testid="contract-preview">
        <div>Preview title: {props.titre}</div>
        <div>Preview sections: {props.sections.length}</div>
        <div>Preview highlighted: {props.highlightedSectionId ?? 'none'}</div>
      </div>
    )
  },
}))

vi.mock('./ClauseLibraryDrawer', () => ({
  ClauseLibraryDrawer: (props: {
    open: boolean
    onOpenChange: (open: boolean) => void
    contratId: string
    onClauseAdded: () => void
  }) => {
    drawerPropsSpy(props)
    return (
      <div data-testid="clause-library-drawer">
        <div>Drawer open: {String(props.open)}</div>
        <div>Drawer contratId: {props.contratId}</div>
      </div>
    )
  },
}))

vi.mock('@/hooks/contracts/useContractSections', () => ({
  buildSectionTree: buildSectionTreeMock,
  useContractSections: useContractSectionsMock,
  useUpdateSection: useUpdateSectionMock,
  useCreateSection: useCreateSectionMock,
  useReorderSections: useReorderSectionsMock,
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

describe('ContractBuilderLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useIsMobileMock.mockReturnValue(false)
    useContractSectionsMock.mockReturnValue({ data: SECTIONS, isLoading: false })
    useUpdateSectionMock.mockReturnValue({ mutate: updateMutate, isPending: false })
    useCreateSectionMock.mockReturnValue({ mutate: createMutate })
    useReorderSectionsMock.mockReturnValue({ mutate: reorderMutate })
    buildSectionTreeMock.mockReturnValue(TREE)
  })

  it('rend la vue desktop avec le titre, le binder et la prévisualisation', () => {
    render(<ContractBuilderLayout contratId="ctr-1" contratTitre="Contrat cadre" />, {
      wrapper: createWrapper(),
    })

    expect(screen.getByText('Contrat cadre')).toBeInTheDocument()
    expect(screen.getByTestId('contract-binder')).toBeInTheDocument()
    expect(screen.getByTestId('contract-editor')).toBeInTheDocument()
    expect(screen.getByTestId('contract-preview')).toBeInTheDocument()
    expect(screen.getByText('Preview title: Contrat cadre')).toBeInTheDocument()
    expect(screen.getByText('Binder count: 2')).toBeInTheDocument()
    expect(buildSectionTreeMock).toHaveBeenCalledWith(SECTIONS)
  })

  it('sélectionne une section puis met à jour la section sélectionnée', () => {
    render(<ContractBuilderLayout contratId="ctr-1" />, {
      wrapper: createWrapper(),
    })

    expect(screen.getByText('Editor section: none')).toBeInTheDocument()

    fireEvent.click(screen.getByText('select-sec-1'))

    expect(screen.getByText('Editor section: Préambule')).toBeInTheDocument()
    expect(screen.getByText('Preview highlighted: sec-1')).toBeInTheDocument()

    fireEvent.click(screen.getByText('update-section'))

    expect(updateMutate).toHaveBeenCalledWith({
      id: 'sec-1',
      contrat_id: 'ctr-1',
      titre: 'Titre modifié',
    })
  })

  it('crée une section racine avec les valeurs métier attendues', () => {
    render(<ContractBuilderLayout contratId="ctr-1" />, {
      wrapper: createWrapper(),
    })

    fireEvent.click(screen.getByText('add-root-section'))

    expect(createMutate).toHaveBeenCalledTimes(1)
    const firstCall = createMutate.mock.calls[0]
    expect(firstCall[0]).toEqual({
      contrat_id: 'ctr-1',
      parent_id: null,
      titre: 'Nouvelle section',
      type: 'section',
      ordre: 2,
    })
    expect(firstCall[1]).toEqual({
      onSuccess: expect.any(Function),
    })
  })

  it('réordonne les sections avec le contrat ciblé', () => {
    render(<ContractBuilderLayout contratId="ctr-1" />, {
      wrapper: createWrapper(),
    })

    fireEvent.click(screen.getByText('reorder-sections'))

    expect(reorderMutate).toHaveBeenCalledWith({
      contrat_id: 'ctr-1',
      sections: [{ id: 'sec-2', ordre: 0, parent_id: null }],
    })
  })

  it('bascule les panneaux desktop binder et preview', () => {
    render(<ContractBuilderLayout contratId="ctr-1" />, {
      wrapper: createWrapper(),
    })

    expect(screen.getByTestId('contract-binder')).toBeInTheDocument()
    expect(screen.getByTestId('contract-preview')).toBeInTheDocument()

    fireEvent.click(screen.getAllByRole('button')[0])
    expect(screen.queryByTestId('contract-binder')).not.toBeInTheDocument()

    fireEvent.click(screen.getAllByRole('button')[2])
    expect(screen.queryByTestId('contract-preview')).not.toBeInTheDocument()
  })

  it("rend la vue mobile, permet de basculer l'aperçu et déclenche onSave", () => {
    const onSave = vi.fn()
    useIsMobileMock.mockReturnValue(true)

    render(
      <ContractBuilderLayout contratId="ctr-1" contratTitre="Mobile contrat" onSave={onSave} />,
      {
        wrapper: createWrapper(),
      }
    )

    expect(screen.getByText('Structure')).toBeInTheDocument()
    expect(screen.getByTestId('contract-editor')).toBeInTheDocument()
    expect(screen.queryByTestId('contract-preview')).not.toBeInTheDocument()

    fireEvent.click(screen.getByLabelText("Afficher l'aperçu"))
    expect(screen.getByText('Preview title: Mobile contrat')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Enregistrer'))
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('ouvre la bibliothèque de clauses depuis le bouton dédié', () => {
    render(<ContractBuilderLayout contratId="ctr-1" />, {
      wrapper: createWrapper(),
    })

    expect(screen.getByText('Drawer open: false')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Bibliothèque'))

    expect(screen.getByText('Drawer open: true')).toBeInTheDocument()
    expect(screen.getByText('Drawer contratId: ctr-1')).toBeInTheDocument()
  })

  it("propage l'état de chargement aux composants internes", () => {
    useContractSectionsMock.mockReturnValue({ data: SECTIONS, isLoading: true })

    render(<ContractBuilderLayout contratId="ctr-1" />, {
      wrapper: createWrapper(),
    })

    expect(screen.getByText('Binder loading: true')).toBeInTheDocument()
    expect(binderPropsSpy).toHaveBeenCalled()
    const lastBinderProps = binderPropsSpy.mock.calls[
      binderPropsSpy.mock.calls.length - 1
    ]?.[0] as {
      isLoading: boolean
    }
    expect(lastBinderProps.isLoading).toBe(true)
  })
})
