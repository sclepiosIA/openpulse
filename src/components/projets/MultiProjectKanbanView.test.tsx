/* @vitest-environment jsdom */

import React from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MultiProjectKanbanView } from "./MultiProjectKanbanView"

const {
  TASKS,
  MUTATE_ASYNC,
  GET_ETAB_COLOR,
  DND_STATE,
  SORTABLE_SET_NODE_REF,
} = vi.hoisted(() => ({
  TASKS: [
    {
      id: "t1",
      titre: "Préparer dossier",
      statut: "A faire",
      archive: false,
      priorite: "high",
      etablissement_id: "e1",
      etablissements: { nom: "Clinique Nord" },
      categorie_id: "c1",
      categories_taches: { nom: "Admin", couleur: "#3366ff" },
      echeance: "2024-03-15T00:00:00.000Z",
      responsable_profile: { prenom: "Jean", nom: "Dupont" },
    },
    {
      id: "t2",
      titre: "Appeler le patient",
      statut: "En cours",
      archive: false,
      priorite: "medium",
      etablissement_id: "e2",
      etablissements: { nom: "Centre Sud" },
      categorie_id: "c2",
      categories_taches: { nom: "Suivi", couleur: "#22aa66" },
      echeance: "2024-04-20T00:00:00.000Z",
      responsable_profile: { prenom: "Marie", nom: "Martin" },
    },
    {
      id: "t3",
      titre: "Archivée à vérifier",
      statut: "Terminé",
      archive: true,
      priorite: "low",
      etablissement_id: "e1",
      etablissements: { nom: "Clinique Nord" },
      categorie_id: "c1",
      categories_taches: { nom: "Admin", couleur: "#3366ff" },
      echeance: "2024-05-10T00:00:00.000Z",
      responsable_profile: { prenom: "Luc", nom: "Bernard" },
    },
  ],
  MUTATE_ASYNC: vi.fn().mockResolvedValue({ data: null, error: null }),
  GET_ETAB_COLOR: vi.fn((id: string) => (id === "e1" ? "#123456" : "#654321")),
  DND_STATE: {
    latestOnDragStart: undefined as
      | ((event: { active: { id: string } }) => void)
      | undefined,
    latestOnDragEnd: undefined as
      | ((event: { active: { id: string }; over: { id: string } | null }) => Promise<void> | void)
      | undefined,
  },
  SORTABLE_SET_NODE_REF: vi.fn(),
}))

vi.mock("@/hooks/tasks/useKanbanTaskMutation", () => ({
  useKanbanTaskMutation: () => ({
    mutateAsync: MUTATE_ASYNC,
    isPending: false,
    isError: false,
    error: null,
  }),
}))

vi.mock("@/components/ui/card", () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>
      {children}
    </div>
  ),
  CardHeader: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-header" className={className}>
      {children}
    </div>
  ),
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-content" className={className}>
      {children}
    </div>
  ),
}))

vi.mock("@/components/ui/badge", () => ({
  Badge: ({
    children,
    className,
    style,
  }: {
    children: React.ReactNode
    className?: string
    style?: React.CSSProperties
  }) => (
    <div data-testid="badge" className={className} style={style}>
      {children}
    </div>
  ),
}))

vi.mock("@/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value: string
    onValueChange: (value: string) => void
    children: React.ReactNode
  }) => (
    <div>
      <label htmlFor="group-by-select">Group by</label>
      <select
        id="group-by-select"
        data-testid="group-select"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
      >
        <option value="status">Par statut</option>
        <option value="category">Par catégorie</option>
      </select>
      {children}
    </div>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: () => <span>selected</span>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/ui/switch", () => ({
  Switch: ({
    checked,
    onCheckedChange,
    id,
  }: {
    checked: boolean
    onCheckedChange: (checked: boolean) => void
    id: string
  }) => (
    <input
      data-testid="archive-switch"
      id={id}
      type="checkbox"
      checked={checked}
      onChange={(e) => onCheckedChange(e.target.checked)}
    />
  ),
}))

vi.mock("@/components/ui/label", () => ({
  Label: ({
    children,
    htmlFor,
    className,
  }: {
    children: React.ReactNode
    htmlFor?: string
    className?: string
  }) => (
    <label htmlFor={htmlFor} className={className}>
      {children}
    </label>
  ),
}))

vi.mock("@/components/tasks/TaskEditDialog", () => ({
  TaskEditDialog: ({ tache }: { tache: { id: string } }) => (
    <button type="button">Edit {tache.id}</button>
  ),
}))

vi.mock("lucide-react", () => ({
  Building2: () => <span>building</span>,
  Calendar: () => <span>calendar</span>,
  User: () => <span>user</span>,
  GripVertical: () => <span>grip</span>,
}))

vi.mock("@dnd-kit/utilities", () => ({
  CSS: {
    Transform: {
      toString: () => "",
    },
  },
}))

vi.mock("@dnd-kit/sortable", () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useSortable: () => ({
    attributes: { "data-sortable": "yes" },
    listeners: {},
    setNodeRef: SORTABLE_SET_NODE_REF,
    transform: null,
    transition: undefined,
    isDragging: false,
  }),
}))

vi.mock("@dnd-kit/core", () => ({
  DndContext: ({
    children,
    onDragStart,
    onDragEnd,
  }: {
    children: React.ReactNode
    onDragStart?: (event: { active: { id: string } }) => void
    onDragEnd?: (event: { active: { id: string }; over: { id: string } | null }) => Promise<void> | void
  }) => {
    DND_STATE.latestOnDragStart = onDragStart
    DND_STATE.latestOnDragEnd = onDragEnd
    return <div data-testid="dnd-context">{children}</div>
  },
  DragOverlay: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="drag-overlay">{children}</div>
  ),
  MouseSensor: class {},
  TouchSensor: class {},
  KeyboardSensor: class {},
  useSensor: () => ({}),
  useSensors: (...sensors: unknown[]) => sensors,
  closestCenter: vi.fn(),
}))

vi.mock("@/integrations/supabase/client", () => {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    then: (resolve: (value: { data: null; error: null }) => void) =>
      Promise.resolve(resolve({ data: null, error: null })),
    catch: vi.fn(),
  }
  const mockFrom = vi.fn(() => builder)
  return {
    supabase: {
      from: mockFrom,
    },
  }
})

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

describe("MultiProjectKanbanView", () => {
  it("affiche les colonnes par statut, masque les archivées par défaut et affiche les données métier", () => {
    const Wrapper = createWrapper()

    render(
      <Wrapper>
        <MultiProjectKanbanView taches={TASKS} getEtablissementColor={GET_ETAB_COLOR} />
      </Wrapper>,
    )

    expect(screen.getByText("Vue Kanban")).toBeInTheDocument()
    expect(screen.getByText("À faire")).toBeInTheDocument()
    expect(screen.getByText("En cours")).toBeInTheDocument()
    expect(screen.getByText("Bloqué")).toBeInTheDocument()
    expect(screen.getByText("Terminé")).toBeInTheDocument()

    expect(screen.getByText("Préparer dossier")).toBeInTheDocument()
    expect(screen.getByText("Appeler le patient")).toBeInTheDocument()
    expect(screen.queryByText("Archivée à vérifier")).not.toBeInTheDocument()

    expect(screen.getByText("Clinique Nord")).toBeInTheDocument()
    expect(screen.getByText("Centre Sud")).toBeInTheDocument()
    expect(screen.getByText("Admin")).toBeInTheDocument()
    expect(screen.getByText("Suivi")).toBeInTheDocument()
    expect(screen.getByText("J. Dupont")).toBeInTheDocument()
    expect(screen.getByText("M. Martin")).toBeInTheDocument()

    expect(GET_ETAB_COLOR).toHaveBeenCalledWith("e1", "Clinique Nord")
    expect(GET_ETAB_COLOR).toHaveBeenCalledWith("e2", "Centre Sud")

    const badges = screen.getAllByTestId("badge")
    expect(badges.some((node) => node.textContent?.includes("1"))).toBe(true)
  })

  it("affiche les tâches archivées quand le switch est activé", () => {
    const Wrapper = createWrapper()

    render(
      <Wrapper>
        <MultiProjectKanbanView taches={TASKS} getEtablissementColor={GET_ETAB_COLOR} />
      </Wrapper>,
    )

    expect(screen.queryByText("Archivée à vérifier")).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId("archive-switch"))

    expect(screen.getByText("Archivée à vérifier")).toBeInTheDocument()
    expect(screen.getByText("L. Bernard")).toBeInTheDocument()
  })

  it("regroupe par catégorie quand la sélection change", () => {
    const Wrapper = createWrapper()

    render(
      <Wrapper>
        <MultiProjectKanbanView taches={TASKS} getEtablissementColor={GET_ETAB_COLOR} />
      </Wrapper>,
    )

    fireEvent.change(screen.getByTestId("group-select"), {
      target: { value: "category" },
    })

    expect(screen.getAllByText("Admin").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Suivi").length).toBeGreaterThan(0)
    expect(screen.getByText("Préparer dossier")).toBeInTheDocument()
    expect(screen.getByText("Appeler le patient")).toBeInTheDocument()
  })

  it("déclenche la mutation avec le nouveau statut lors d'un drag vers une colonne de statut", async () => {
    const Wrapper = createWrapper()

    render(
      <Wrapper>
        <MultiProjectKanbanView taches={TASKS} getEtablissementColor={GET_ETAB_COLOR} />
      </Wrapper>,
    )

    await DND_STATE.latestOnDragEnd?.({
      active: { id: "t1" },
      over: { id: "column-En cours" },
    })

    await waitFor(() => {
      expect(MUTATE_ASYNC).toHaveBeenCalledWith({
        id: "t1",
        data: { statut: "En cours" },
      })
    })
  })

  it("déclenche la mutation avec la catégorie cible en mode catégorie lors d'un drop sur une tâche", async () => {
    const Wrapper = createWrapper()

    render(
      <Wrapper>
        <MultiProjectKanbanView taches={TASKS} getEtablissementColor={GET_ETAB_COLOR} />
      </Wrapper>,
    )

    fireEvent.change(screen.getByTestId("group-select"), {
      target: { value: "category" },
    })

    await DND_STATE.latestOnDragEnd?.({
      active: { id: "t1" },
      over: { id: "t2" },
    })

    await waitFor(() => {
      expect(MUTATE_ASYNC).toHaveBeenCalledWith({
        id: "t1",
        data: { categorie_id: "c2" },
      })
    })
  })

  it("affiche un overlay avec la tâche active pendant le drag start", async () => {
    const Wrapper = createWrapper()

    render(
      <Wrapper>
        <MultiProjectKanbanView taches={TASKS} getEtablissementColor={GET_ETAB_COLOR} />
      </Wrapper>,
    )

    DND_STATE.latestOnDragStart?.({
      active: { id: "t1" },
    })

    await waitFor(() => {
      expect(screen.getByTestId("drag-overlay")).toHaveTextContent("Préparer dossier")
      expect(screen.getByTestId("drag-overlay")).toHaveTextContent("Clinique Nord")
    })
  })
})