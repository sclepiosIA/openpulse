import React from "react"
import { render, screen, fireEvent, act } from "@testing-library/react"
import { renderHook } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { KanbanBoard } from "./KanbanBoard"

const {
  MOCK_TASKS_GLOBAL,
  MOCK_TASKS_ETAB,
  mockUseTaches,
  mockUseTachesByEtablissement,
  mockUseUpdateTache,
  mockUseArchiveTache,
  mockToastFn,
  mockFrom,
} = vi.hoisted(() => {
  const globalTasks = [
    {
      id: "t1",
      titre: "Tâche globale 1",
      description: "Desc 1",
      statut: "A faire" as const,
      priorite: "high" as const,
      archive: false,
      categorie: { nom: "Cat 1", couleur: "#ff0000" },
      echeance: "2024-01-01T00:00:00.000Z",
      responsable: { prenom: "Alice", nom: "Martin" },
    },
    {
      id: "t2",
      titre: "Tâche globale 2",
      description: "Desc 2",
      statut: "En cours" as const,
      priorite: "medium" as const,
      archive: true,
      categorie: { nom: "Cat 2", couleur: "#00ff00" },
      echeance: "2024-02-01T00:00:00.000Z",
      responsable: { prenom: "Bob", nom: "Dupont" },
    },
  ]

  const etabTasks = [
    {
      id: "e1",
      titre: "Tâche etab 1",
      description: "Etab 1",
      statut: "Bloqué" as const,
      priorite: "low" as const,
      archive: false,
      categorie: { nom: "Cat E", couleur: "#0000ff" },
      echeance: "2024-03-01T00:00:00.000Z",
      responsable: { prenom: "Carla", nom: "Durand" },
    },
    {
      id: "e2",
      titre: "Tâche etab 2",
      description: "Etab 2",
      statut: "Terminé" as const,
      priorite: "high" as const,
      archive: true,
      categorie: { nom: "Cat F", couleur: "#ff00ff" },
      echeance: "2024-04-01T00:00:00.000Z",
      responsable: { prenom: "David", nom: "Leroy" },
    },
  ]

  const toastFn = vi.fn()

  const useTachesMock = vi.fn(() => ({
    data: globalTasks,
    isLoading: false,
    isError: false,
    error: null,
  }))

  const useTachesByEtablissementMock = vi.fn(() => ({
    data: etabTasks,
    isLoading: false,
    isError: false,
    error: null,
  }))

  const useUpdateTacheMock = vi.fn(() => ({
    mutateAsync: vi.fn().mockResolvedValue({}),
    isLoading: false,
    isError: false,
    error: null,
  }))

  const useArchiveTacheMock = vi.fn(() => ({
    mutateAsync: vi.fn().mockResolvedValue({}),
    isLoading: false,
    isError: false,
    error: null,
  }))

  const builder = {
    select: () => builder,
    eq: () => builder,
    gte: () => builder,
    lte: () => builder,
    in: () => builder,
    order: () => builder,
    limit: () => builder,
    insert: () => builder,
    update: () => builder,
    delete: () => builder,
    single: () => Promise.resolve({ data: null, error: null }),
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
    then: (resolve: (v: unknown) => void) => {
      resolve({ data: null, error: null })
      return Promise.resolve()
    },
    catch: () => builder,
  }

  const fromFn = vi.fn(() => builder)

  return {
    MOCK_TASKS_GLOBAL: globalTasks,
    MOCK_TASKS_ETAB: etabTasks,
    mockUseTaches: useTachesMock,
    mockUseTachesByEtablissement: useTachesByEtablissementMock,
    mockUseUpdateTache: useUpdateTacheMock,
    mockUseArchiveTache: useArchiveTacheMock,
    mockToastFn: toastFn,
    mockFrom: fromFn,
  }
})

vi.mock("@/hooks/tasks/useTaches", () => ({
  useTaches: mockUseTaches,
  useTachesByEtablissement: mockUseTachesByEtablissement,
  useUpdateTache: mockUseUpdateTache,
  useArchiveTache: mockUseArchiveTache,
}))

vi.mock("@/hooks/shared/use-toast", () => ({
  useToast: () => ({
    toast: mockToastFn,
  }),
}))

vi.mock("@/components/ui/card", () => ({
  Card: (props: { children: React.ReactNode }) => <div data-testid="card">{props.children}</div>,
  CardContent: (props: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-content" className={props.className}>
      {props.children}
    </div>
  ),
}))

vi.mock("@/components/ui/badge", () => ({
  Badge: (props: {
    children: React.ReactNode
    variant?: string
    className?: string
    style?: React.CSSProperties
  }) => (
    <span data-testid="badge" data-variant={props.variant} className={props.className} style={props.style}>
      {props.children}
    </span>
  ),
}))

vi.mock("@/components/ui/button", () => ({
  Button: (props: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; size?: string }) => (
    <button {...props} data-variant={props.variant} data-size={props.size}>
      {props.children}
    </button>
  ),
}))

vi.mock("@/components/ui/switch", () => ({
  Switch: (props: { id?: string; checked?: boolean; onCheckedChange?: (checked: boolean) => void }) => (
    <input
      type="checkbox"
      id={props.id}
      checked={props.checked}
      onChange={(e) => props.onCheckedChange && props.onCheckedChange(e.target.checked)}
    />
  ),
}))

vi.mock("@/components/ui/label", () => ({
  Label: (props: React.LabelHTMLAttributes<HTMLLabelElement>) => <label {...props} />,
}))

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: (props: { children: React.ReactNode }) => <div>{props.children}</div>,
  DropdownMenuTrigger: (props: { asChild?: boolean; children: React.ReactElement }) =>
    props.asChild ? props.children : <button>{props.children}</button>,
  DropdownMenuContent: (props: { children: React.ReactNode; align?: string }) => (
    <div data-testid="dropdown-content">{props.children}</div>
  ),
  DropdownMenuItem: (props: { children: React.ReactNode; onClick?: () => void }) => (
    <div role="menuitem" onClick={props.onClick}>
      {props.children}
    </div>
  ),
}))

vi.mock("@/components/ui/dialog", () => ({
  Dialog: (props: { children: React.ReactNode }) => <div>{props.children}</div>,
  DialogTrigger: (props: { asChild?: boolean; children: React.ReactElement }) =>
    props.asChild ? props.children : <button>{props.children}</button>,
  DialogContent: (props: { children: React.ReactNode; className?: string }) => (
    <div data-testid="dialog-content" className={props.className}>
      {props.children}
    </div>
  ),
  DialogHeader: (props: { children: React.ReactNode }) => <div>{props.children}</div>,
  DialogTitle: (props: { children: React.ReactNode }) => <h2>{props.children}</h2>,
}))

vi.mock("@/components/tasks/TacheDocuments", () => ({
  TacheDocuments: (props: { tacheId: string; tacheTitre: string }) => (
    <div data-testid="tache-documents">
      Docs for {props.tacheTitre} ({props.tacheId})
    </div>
  ),
}))

vi.mock("@dnd-kit/core", () => {
  const ReactImport = require("react")
  return {
    DndContext: (props: {
      children: React.ReactNode
      sensors?: unknown
      collisionDetection?: unknown
      onDragStart?: (e: any) => void
      onDragEnd?: (e: any) => void
    }) => <div>{props.children}</div>,
    closestCenter: vi.fn(),
    KeyboardSensor: vi.fn(),
    PointerSensor: vi.fn(),
    useSensor: vi.fn((sensor: unknown) => sensor),
    useSensors: vi.fn((...sensors: unknown[]) => sensors),
    useDroppable: vi.fn(() => ({
      isOver: false,
      setNodeRef: vi.fn(),
    })),
    useDraggable: vi.fn(() => ({
      attributes: {},
      listeners: {},
      setNodeRef: vi.fn(),
      transform: null,
      isDragging: false,
    })),
    DragOverlay: (props: { children: React.ReactNode }) => (
      <div data-testid="drag-overlay">{props.children}</div>
    ),
  }
})

vi.mock("lucide-react", () => {
  const Icon =
    (name: string) =>
    (props: { className?: string }) =>
      <span data-icon={name} className={props.className} />
  return {
    Calendar: Icon("Calendar"),
    Users: Icon("Users"),
    MoreVertical: Icon("MoreVertical"),
    FileText: Icon("FileText"),
    Archive: Icon("Archive"),
    ArchiveRestore: Icon("ArchiveRestore"),
    GripVertical: Icon("GripVertical"),
  }
})

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
  },
}))

vi.mock("@/components/AuthProvider", () => ({
  AuthProvider: (props: { children: React.ReactNode }) => <div>{props.children}</div>,
}))

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "u1", email: "test@example.com" },
    session: { user: { id: "u1" } },
    isLoading: false,
  }),
}))

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "u1", email: "test@example.com" },
    session: { user: { id: "u1" } },
    isLoading: false,
  }),
}))

vi.mock("@/hooks/useAdminRole", () => ({
  useAdminRole: () => true,
}))

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock("@/hooks/*", () => ({}))

vi.mock("@/lib/*", () => ({}))

vi.mock("@/services/*", () => ({}))

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })
  return function Wrapper(props: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{props.children}</QueryClientProvider>
  }
}

describe("KanbanBoard", () => {
  it("affiche les tâches globales par défaut et masque les archivées", () => {
    mockUseTaches.mockReturnValueOnce({
      data: MOCK_TASKS_GLOBAL,
      isLoading: false,
      isError: false,
      error: null,
    })
    mockUseTachesByEtablissement.mockReturnValueOnce({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
    })

    render(<KanbanBoard />, { wrapper: createWrapper() })

    expect(screen.getByText("Vue Kanban")).toBeDefined()
    expect(screen.getByText("Tâche globale 1")).toBeDefined()
    const archivedTitle = screen.queryByText("Tâche globale 2")
    expect(archivedTitle).toBeNull()
    const badges = screen.getAllByTestId("badge")
    const counts = badges.map((b) => b.textContent)
    expect(counts).toContain("1")
  })

  it("permet d'afficher les tâches archivées via le switch", () => {
    mockUseTaches.mockReturnValueOnce({
      data: MOCK_TASKS_GLOBAL,
      isLoading: false,
      isError: false,
      error: null,
    })
    mockUseTachesByEtablissement.mockReturnValueOnce({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
    })

    render(<KanbanBoard />, { wrapper: createWrapper() })

    const switchInput = screen.getByLabelText("Afficher archivées") as HTMLInputElement
    expect(switchInput.checked).toBe(false)

    fireEvent.click(switchInput)

    expect(screen.getByText("Tâche globale 2")).toBeDefined()
  })

  it("utilise les tâches par établissement quand etablissementId est fourni", () => {
    mockUseTaches.mockReturnValueOnce({
      data: MOCK_TASKS_GLOBAL,
      isLoading: false,
      isError: false,
      error: null,
    })
    mockUseTachesByEtablissement.mockReturnValueOnce({
      data: MOCK_TASKS_ETAB,
      isLoading: false,
      isError: false,
      error: null,
    })

    render(<KanbanBoard etablissementId="etab-1" />, { wrapper: createWrapper() })

    expect(screen.getByText("Tâche etab 1")).toBeDefined()
    const absentGlobal = screen.queryByText("Tâche globale 1")
    expect(absentGlobal).toBeNull()
  })

  it("appelle useUpdateTache.mutateAsync lorsqu'on change le statut via le menu", async () => {
    const mutateAsyncMock = vi.fn().mockResolvedValue({})
    mockUseUpdateTache.mockReturnValueOnce({
      mutateAsync: mutateAsyncMock,
      isLoading: false,
      isError: false,
      error: null,
    })
    mockUseArchiveTache.mockReturnValueOnce({
      mutateAsync: vi.fn().mockResolvedValue({}),
      isLoading: false,
      isError: false,
      error: null,
    })
    mockUseTaches.mockReturnValueOnce({
      data: MOCK_TASKS_GLOBAL,
      isLoading: false,
      isError: false,
      error: null,
    })
    mockUseTachesByEtablissement.mockReturnValueOnce({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
    })

    render(<KanbanBoard />, { wrapper: createWrapper() })

    const moreButtons = screen.getAllByRole("button", { name: "Plus d'options" })
    expect(moreButtons.length).toBeGreaterThan(0)

    fireEvent.click(moreButtons[0])

    const menuItem = screen.getByText("Déplacer vers En cours")
    await act(async () => {
      fireEvent.click(menuItem)
    })

    expect(mutateAsyncMock).toHaveBeenCalledTimes(1)
    expect(mutateAsyncMock).toHaveBeenCalledWith({
      id: "t1",
      data: { statut: "En cours" },
    })
    expect(mockToastFn).toHaveBeenCalledWith({
      title: "Tâche mise à jour",
      description: "Statut: En cours",
    })
  })

  it("appelle useArchiveTache.mutateAsync lorsqu'on archive ou désarchive via le bouton", async () => {
    const archiveMutateAsync = vi.fn().mockResolvedValue({})
    mockUseArchiveTache.mockReturnValueOnce({
      mutateAsync: archiveMutateAsync,
      isLoading: false,
      isError: false,
      error: null,
    })
    mockUseUpdateTache.mockReturnValueOnce({
      mutateAsync: vi.fn().mockResolvedValue({}),
      isLoading: false,
      isError: false,
      error: null,
    })
    mockUseTaches.mockReturnValueOnce({
      data: MOCK_TASKS_GLOBAL,
      isLoading: false,
      isError: false,
      error: null,
    })
    mockUseTachesByEtablissement.mockReturnValueOnce({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
    })

    render(<KanbanBoard />, { wrapper: createWrapper() })

    const archiveButtons = screen.getAllByRole("button", { name: "Archiver" })
    expect(archiveButtons.length).toBeGreaterThan(0)

    await act(async () => {
      fireEvent.click(archiveButtons[0])
    })

    expect(archiveMutateAsync).toHaveBeenCalledTimes(1)
    expect(archiveMutateAsync).toHaveBeenCalledWith({
      id: "t1",
      archive: true,
    })
  })

  it("affiche un toast d'erreur lorsqu'une mise à jour de statut échoue", async () => {
    const failingMutate = vi.fn().mockRejectedValue(new Error("update failed"))
    mockUseUpdateTache.mockReturnValueOnce({
      mutateAsync: failingMutate,
      isLoading: false,
      isError: false,
      error: null,
    })
    mockUseArchiveTache.mockReturnValueOnce({
      mutateAsync: vi.fn().mockResolvedValue({}),
      isLoading: false,
      isError: false,
      error: null,
    })
    mockUseTaches.mockReturnValueOnce({
      data: MOCK_TASKS_GLOBAL,
      isLoading: false,
      isError: false,
      error: null,
    })
    mockUseTachesByEtablissement.mockReturnValueOnce({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
    })
    mockToastFn.mockReset()

    render(<KanbanBoard />, { wrapper: createWrapper() })

    const moreButtons = screen.getAllByRole("button", { name: "Plus d'options" })
    fireEvent.click(moreButtons[0])

    const menuItem = screen.getByText("Déplacer vers En cours")
    await act(async () => {
      fireEvent.click(menuItem)
    })

    expect(failingMutate).toHaveBeenCalledTimes(1)
    expect(mockToastFn).toHaveBeenCalledWith({
      title: "Erreur",
      description: "Impossible de mettre à jour",
      variant: "destructive",
    })
  })

  it("affiche un toast d'erreur lorsqu'un archivage échoue", async () => {
    const failingArchive = vi.fn().mockRejectedValue(new Error("archive failed"))
    mockUseArchiveTache.mockReturnValueOnce({
      mutateAsync: failingArchive,
      isLoading: false,
      isError: false,
      error: null,
    })
    mockUseUpdateTache.mockReturnValueOnce({
      mutateAsync: vi.fn().mockResolvedValue({}),
      isLoading: false,
      isError: false,
      error: null,
    })
    mockUseTaches.mockReturnValueOnce({
      data: MOCK_TASKS_GLOBAL,
      isLoading: false,
      isError: false,
      error: null,
    })
    mockUseTachesByEtablissement.mockReturnValueOnce({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
    })
    mockToastFn.mockReset()

    render(<KanbanBoard />, { wrapper: createWrapper() })

    const archiveButtons = screen.getAllByRole("button", { name: "Archiver" })
    await act(async () => {
      fireEvent.click(archiveButtons[0])
    })

    expect(failingArchive).toHaveBeenCalledTimes(1)
    expect(mockToastFn).toHaveBeenCalledWith({
      title: "Erreur",
      description: "Impossible de modifier l'archivage",
      variant: "destructive",
    })
  })

  it("affiche les documents de tâche dans la boîte de dialogue", () => {
    mockUseTaches.mockReturnValueOnce({
      data: MOCK_TASKS_GLOBAL,
      isLoading: false,
      isError: false,
      error: null,
    })
    mockUseTachesByEtablissement.mockReturnValueOnce({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
    })
    mockUseUpdateTache.mockReturnValueOnce({
      mutateAsync: vi.fn().mockResolvedValue({}),
      isLoading: false,
      isError: false,
      error: null,
    })
    mockUseArchiveTache.mockReturnValueOnce({
      mutateAsync: vi.fn().mockResolvedValue({}),
      isLoading: false,
      isError: false,
      error: null,
    })

    render(<KanbanBoard />, { wrapper: createWrapper() })

    const docButtons = screen.getAllByRole("button", { name: "Voir les documents" })
    expect(docButtons.length).toBeGreaterThan(0)

    fireEvent.click(docButtons[0])

    expect(screen.getByTestId("tache-documents").textContent).toContain("Tâche globale 1")
  })

  it("peut utiliser renderHook avec QueryClientProvider wrapper sans erreur", () => {
    const Wrapper = createWrapper()
    const { result } = renderHook(() => React.useState(0), { wrapper: Wrapper })
    const [, setVal] = result.current
    act(() => {
      setVal(1)
    })
    expect(result.current[0]).toBe(1)
  })
})