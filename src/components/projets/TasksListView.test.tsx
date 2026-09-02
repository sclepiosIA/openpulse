/* @vitest-environment jsdom */
import React from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { TasksListView } from "./TasksListView"

const {
  ETABS,
  CATEGORIES,
  PROFILES,
  CURRENT_PROFILE,
  TASKS,
  mockToast,
  mockExportTasksToCSV,
  mockInvalidateQueries,
  mockFrom,
  builderState,
} = vi.hoisted(() => {
  const ETABS = [
    { id: "et1", nom: "Clinique A" },
    { id: "et2", nom: "Centre B" },
  ]

  const CATEGORIES = [
    { id: "cat1", nom: "Maintenance" },
    { id: "cat2", nom: "RH" },
  ]

  const PROFILES = [
    { id: "p1", prenom: "Jane", nom: "Doe" },
    { id: "p2", prenom: "John", nom: "Smith" },
  ]

  const CURRENT_PROFILE = { id: "p1", prenom: "Jane", nom: "Doe" }

  const TASKS = [
    {
      id: "t1",
      titre: "Urgent plomberie",
      description: "Fuite au bloc",
      etablissement_id: "et1",
      categorie_id: "cat1",
      responsable_id: "p1",
      priorite: "high",
      statut: "A faire",
      archive: false,
      echeance: "2000-01-01T00:00:00.000Z",
      etablissements: { nom: "Clinique A" },
    },
    {
      id: "t2",
      titre: "Commande fournitures",
      description: "Papier",
      etablissement_id: "et2",
      categorie_id: "cat2",
      responsable_id: "p2",
      priorite: "medium",
      statut: "En cours",
      archive: false,
      echeance: "2099-01-01T00:00:00.000Z",
      etablissements: { nom: "Centre B" },
    },
    {
      id: "t3",
      titre: "Archive test",
      description: "Ancienne tâche",
      etablissement_id: "et1",
      categorie_id: "cat1",
      responsable_id: "p2",
      priorite: "low",
      statut: "Terminé",
      archive: true,
      echeance: null,
      etablissements: { nom: "Clinique A" },
    },
  ]

  const mockToast = vi.fn()
  const mockExportTasksToCSV = vi.fn()
  const mockInvalidateQueries = vi.fn()

  const builderState = {
    table: "",
    updatePayload: undefined as unknown,
    eqCalls: [] as Array<[string, unknown]>,
    shouldError: false,
  }

  const makeResult = () =>
    builderState.shouldError
      ? Promise.resolve({ data: null, error: { message: "x" } })
      : Promise.resolve({ data: null, error: null })

  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn((field: string, value: unknown) => {
      builderState.eqCalls.push([field, value])
      return builder
    }),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn((payload: unknown) => {
      builderState.updatePayload = payload
      return builder
    }),
    delete: vi.fn(() => builder),
    single: vi.fn(() => makeResult()),
    maybeSingle: vi.fn(() => makeResult()),
    then: (onFulfilled: (value: { data: null; error: { message: string } | null }) => unknown) => makeResult().then(onFulfilled),
    catch: (onRejected: (reason: unknown) => unknown) => makeResult().catch(onRejected),
  }

  const mockFrom = vi.fn((table: string) => {
    builderState.table = table
    builderState.eqCalls = []
    builderState.updatePayload = undefined
    return builder
  })

  return {
    ETABS,
    CATEGORIES,
    PROFILES,
    CURRENT_PROFILE,
    TASKS,
    mockToast,
    mockExportTasksToCSV,
    mockInvalidateQueries,
    mockFrom,
    builderState,
  }
})

vi.mock("@/lib/debug", () => ({
  debug: { warn: vi.fn(), log: vi.fn(), error: vi.fn() },
}))

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
  },
}))

vi.mock("@/hooks/crm/useEtablissements", () => ({
  useEtablissements: () => ({ data: ETABS, isLoading: false, isError: false }),
}))

vi.mock("@/hooks/catalogue/useCategories", () => ({
  useCategories: () => ({ data: CATEGORIES, isLoading: false, isError: false }),
}))

vi.mock("@/hooks/profile/useProfiles", () => ({
  useProfiles: () => ({ data: PROFILES, isLoading: false, isError: false }),
  useCurrentProfile: () => ({ data: CURRENT_PROFILE, isLoading: false, isError: false }),
}))

vi.mock("@/hooks/shared/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}))

vi.mock("@/lib/projetsUtils", () => ({
  exportTasksToCSV: mockExportTasksToCSV,
}))

vi.mock("@/lib/utils", () => ({
  cn: (...args: Array<string | false | null | undefined>) => args.filter(Boolean).join(" "),
}))

vi.mock("lucide-react", () => {
  const Icon = ({ className }: { className?: string }) => React.createElement("svg", { "data-testid": "icon", className })
  return {
    Search: Icon,
    Clock: Icon,
    Download: Icon,
    ChevronDown: Icon,
    Filter: Icon,
    Flame: Icon,
    User: Icon,
    AlertTriangle: Icon,
    RotateCcw: Icon,
    LayoutList: Icon,
    Rows3: Icon,
  }
})

vi.mock("./TaskCard", () => ({
  TaskCard: ({
    tache,
    onArchive,
  }: {
    tache: { id: string; titre: string }
    onArchive?: (id: string) => void
  }) =>
    React.createElement(
      "div",
      { "data-testid": `task-card-${tache.id}` },
      React.createElement("span", {}, tache.titre),
      React.createElement(
        "button",
        {
          onClick: () => onArchive?.(tache.id),
        },
        `archive-${tache.id}`
      )
    ),
}))

vi.mock("./BulkActionsBarProjets", () => ({
  BulkActionsBarProjets: ({ selectedIds }: { selectedIds: string[] }) =>
    React.createElement("div", { "data-testid": "bulk-bar" }, `selected:${selectedIds.length}`),
}))

vi.mock("@/components/ui/virtual-list", () => ({
  VirtualList: ({
    items,
    renderItem,
  }: {
    items: Array<unknown>
    renderItem: (item: unknown, index: number) => React.ReactNode
  }) => React.createElement("div", { "data-testid": "virtual-list" }, items.map((item, index) => React.createElement(React.Fragment, { key: index }, renderItem(item, index)))),
}))

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => React.createElement("div", {}, children),
  CardHeader: ({ children }: { children: React.ReactNode }) => React.createElement("div", {}, children),
  CardContent: ({ children }: { children: React.ReactNode }) => React.createElement("div", {}, children),
}))

vi.mock("@/components/ui/input", () => ({
  Input: ({
    value,
    onChange,
    placeholder,
    className,
  }: {
    value?: string
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
    placeholder?: string
    className?: string
  }) => React.createElement("input", { value, onChange, placeholder, className }),
}))

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    ...props
  }: {
    children: React.ReactNode
    onClick?: () => void
  }) => React.createElement("button", { onClick, ...props }, children),
}))

vi.mock("@/components/ui/select", () => ({
  Select: ({
    children,
  }: {
    children: React.ReactNode
    value?: string
    onValueChange?: (value: string) => void
  }) => React.createElement("div", {}, children),
  SelectTrigger: ({ children, className }: { children: React.ReactNode; className?: string }) =>
    React.createElement("div", { className }, children),
  SelectValue: ({ placeholder }: { placeholder?: string }) => React.createElement("span", {}, placeholder),
  SelectContent: ({ children }: { children: React.ReactNode }) => React.createElement("div", {}, children),
  SelectItem: ({
    children,
    value,
  }: {
    children: React.ReactNode
    value: string
  }) => React.createElement("div", { "data-value": value }, children),
}))

vi.mock("@/components/ui/switch", () => ({
  Switch: ({
    checked,
    onCheckedChange,
    id,
  }: {
    checked?: boolean
    onCheckedChange?: (checked: boolean) => void
    id?: string
  }) => React.createElement("input", { type: "checkbox", checked, onChange: (e: React.ChangeEvent<HTMLInputElement>) => onCheckedChange?.(e.target.checked), id }),
}))

vi.mock("@/components/ui/label", () => ({
  Label: ({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) => React.createElement("label", { htmlFor }, children),
}))

vi.mock("@/components/ui/checkbox", () => ({
  Checkbox: ({
    checked,
    onCheckedChange,
  }: {
    checked?: boolean
    onCheckedChange?: (checked: boolean) => void
  }) => React.createElement("input", { type: "checkbox", checked, onChange: (e: React.ChangeEvent<HTMLInputElement>) => onCheckedChange?.(e.target.checked) }),
}))

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => React.createElement("span", {}, children),
}))

vi.mock("@/components/ui/collapsible", () => ({
  Collapsible: ({ children }: { children: React.ReactNode }) => React.createElement("div", {}, children),
  CollapsibleTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => React.createElement("div", {}, children),
  CollapsibleContent: ({ children }: { children: React.ReactNode; className?: string }) => React.createElement("div", {}, children),
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  vi.spyOn(queryClient, "invalidateQueries").mockImplementation(mockInvalidateQueries)

  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
}

describe("TasksListView", () => {
  beforeEach(() => {
    localStorage.clear()
    mockToast.mockClear()
    mockExportTasksToCSV.mockClear()
    mockInvalidateQueries.mockClear()
    mockFrom.mockClear()
    builderState.shouldError = false
    builderState.table = ""
    builderState.eqCalls = []
    builderState.updatePayload = undefined
  })

  it("affiche le nombre de tâches non archivées triées par priorité et filtre par recherche", async () => {
    render(
      React.createElement(TasksListView, {
        taches: TASKS,
        onStatusChange: vi.fn(),
        resetFilters: vi.fn(),
        activeFilter: null,
        getEtablissementColor: vi.fn(() => "blue"),
      }),
      { wrapper: createWrapper() }
    )

    expect(screen.getByText("Liste des Tâches")).toBeInTheDocument()
    expect(screen.getByText("2 tâches")).toBeInTheDocument()

    const cards = screen.getAllByTestId(/^task-card-/)
    expect(cards).toHaveLength(2)
    expect(cards[0]).toHaveTextContent("Urgent plomberie")
    expect(cards[1]).toHaveTextContent("Commande fournitures")
    expect(screen.queryByTestId("task-card-t3")).not.toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText("Rechercher..."), {
      target: { value: "bloc" },
    })

    await waitFor(() => {
      expect(screen.getByText("1 tâche")).toBeInTheDocument()
    })
    expect(screen.getByTestId("task-card-t1")).toBeInTheDocument()
    expect(screen.queryByTestId("task-card-t2")).not.toBeInTheDocument()
  })

  it("active les filtres rapides 'Urgentes' et 'Mes tâches' avec les valeurs métier attendues", async () => {
    render(
      React.createElement(TasksListView, {
        taches: TASKS,
        onStatusChange: vi.fn(),
        resetFilters: vi.fn(),
        activeFilter: null,
        getEtablissementColor: vi.fn(() => "green"),
      }),
      { wrapper: createWrapper() }
    )

    fireEvent.click(screen.getByRole("button", { name: /Urgentes/i }))

    await waitFor(() => {
      expect(screen.getByText("1 tâche")).toBeInTheDocument()
    })
    expect(screen.getByTestId("task-card-t1")).toBeInTheDocument()
    expect(screen.queryByTestId("task-card-t2")).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /Mes tâches/i }))

    await waitFor(() => {
      expect(screen.getByText("1 tâche")).toBeInTheDocument()
    })
    expect(screen.getByTestId("task-card-t1")).toBeInTheDocument()
  })

  it("exporte toutes les tâches filtrées en CSV et affiche un toast de succès", () => {
    render(
      React.createElement(TasksListView, {
        taches: TASKS,
        onStatusChange: vi.fn(),
        resetFilters: vi.fn(),
        activeFilter: null,
        getEtablissementColor: vi.fn(() => "red"),
      }),
      { wrapper: createWrapper() }
    )

    fireEvent.click(screen.getByRole("button", { name: /CSV/i }))

    expect(mockExportTasksToCSV).toHaveBeenCalledTimes(1)
    expect(mockExportTasksToCSV).toHaveBeenCalledWith(
      [
        expect.objectContaining({ id: "t1", priorite: "high" }),
        expect.objectContaining({ id: "t2", priorite: "medium" }),
      ],
      "taches"
    )
    expect(mockToast).toHaveBeenCalledWith({ title: "2 tâche(s) exportée(s)" })
  })

  it("archive une tâche avec succès via Supabase, invalide la query et affiche un toast", async () => {
    render(
      React.createElement(TasksListView, {
        taches: TASKS,
        onStatusChange: vi.fn(),
        resetFilters: vi.fn(),
        activeFilter: null,
        getEtablissementColor: vi.fn(() => "orange"),
      }),
      { wrapper: createWrapper() }
    )

    await fireEvent.click(screen.getByRole("button", { name: "archive-t1" }))

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith("taches")
    })

    expect(builderState.table).toBe("taches")
    expect(builderState.updatePayload).toEqual({ archive: true })
    expect(builderState.eqCalls).toContainEqual(["id", "t1"])
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["taches"] })
    expect(mockToast).toHaveBeenCalledWith({ title: "Tâche archivée avec succès" })
  })

  it("remonte une erreur de mutation si Supabase renvoie { data:null, error:{ message:'x' } }", async () => {
    builderState.shouldError = true

    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})

    render(
      React.createElement(TasksListView, {
        taches: TASKS,
        onStatusChange: vi.fn(),
        resetFilters: vi.fn(),
        activeFilter: null,
        getEtablissementColor: vi.fn(() => "gray"),
      }),
      { wrapper: createWrapper() }
    )

    await fireEvent.click(screen.getByRole("button", { name: "archive-t1" }))

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith("taches")
    })

    expect(builderState.updatePayload).toEqual({ archive: true })
    expect(builderState.eqCalls).toContainEqual(["id", "t1"])
    expect(mockInvalidateQueries).not.toHaveBeenCalled()
    expect(mockToast).not.toHaveBeenCalledWith({ title: "Tâche archivée avec succès" })

    consoleError.mockRestore()
  })
})