/* @vitest-environment jsdom */
import React from "react"
import { render, screen, waitFor, act, renderHook } from "@testing-library/react"
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query"
import { TemplateTaskList } from "./TemplateTaskList"

const {
  USER,
  CATEGORIES,
  MODELES,
  EMPTY_MODELES,
  mockMutateAsync,
  mockUseUpdateModeleTache,
  mockOnDragEndCapture,
  DND_STATE,
  mockFrom,
  mockToastSuccess,
  mockToastError,
} = vi.hoisted(() => ({
  USER: {
    user: { id: "u1", email: "test@example.com" },
    session: { user: { id: "u1" } },
    isLoading: false,
  },
  CATEGORIES: [
    { id: "cat-1", nom: "Catégorie A" },
    { id: "cat-2", nom: "Catégorie B" },
  ],
  MODELES: [
    { id: "m1", titre: "Préparer le dossier", ordre: 0, categorie_id: "cat-1", phase: "phase-1" },
    { id: "m2", titre: "Valider les pièces", ordre: 1, categorie_id: "cat-2", phase: "phase-1" },
    { id: "m3", titre: "Envoyer la confirmation", ordre: 2, categorie_id: "cat-1", phase: "phase-1" },
  ],
  EMPTY_MODELES: [] as Array<{ id: string; titre: string; ordre: number; categorie_id: string; phase: string }>,
  mockMutateAsync: vi.fn(),
  mockUseUpdateModeleTache: vi.fn(),
  mockOnDragEndCapture: vi.fn(),
  DND_STATE: {
    lastOnDragEnd: null as null | ((event: { active: { id: string }; over: { id: string } | null }) => Promise<void> | void),
  },
  mockFrom: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
}))

vi.mock("@/integrations/supabase/client", () => {
  const result = { data: null, error: null }
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    neq: vi.fn(() => builder),
    gt: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lt: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    upsert: vi.fn(() => builder),
    single: vi.fn(async () => result),
    maybeSingle: vi.fn(async () => result),
    then: (resolve: (value: typeof result) => unknown) => Promise.resolve(resolve(result)),
    catch: vi.fn(() => builder),
  }
  mockFrom.mockImplementation(() => builder)
  return {
    supabase: {
      from: mockFrom,
      auth: {
        getUser: vi.fn(async () => ({ data: { user: USER.user }, error: null })),
        getSession: vi.fn(async () => ({ data: { session: USER.session }, error: null })),
      },
    },
  }
})

vi.mock("@/hooks/tasks/useModelesTaches", () => ({
  useUpdateModeleTache: mockUseUpdateModeleTache,
}))

vi.mock("./TemplateTaskCard", () => ({
  TemplateTaskCard: ({
    modele,
    categories,
  }: {
    modele: { id: string; titre: string }
    categories: Array<{ id: string; nom: string }>
  }) => (
    <div data-testid={`template-card-${modele.id}`}>
      <span>{modele.titre}</span>
      <span data-testid={`template-card-${modele.id}-categories`}>{categories.length}</span>
    </div>
  ),
}))

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h2 data-testid="card-title" className={className}>
      {children}
    </h2>
  ),
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-content" className={className}>
      {children}
    </div>
  ),
}))

vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: ({ className }: { className?: string }) => (
    <div data-testid="skeleton" className={className}>
      loading
    </div>
  ),
}))

vi.mock("lucide-react", () => ({
  FileQuestion: ({ className }: { className?: string }) => <svg data-testid="file-question-icon" className={className} />,
}))

vi.mock("sonner", () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}))

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}))

vi.mock("@dnd-kit/core", () => ({
  DndContext: ({
    children,
    onDragEnd,
  }: {
    children: React.ReactNode
    onDragEnd: (event: { active: { id: string }; over: { id: string } | null }) => Promise<void> | void
  }) => {
    DND_STATE.lastOnDragEnd = onDragEnd
    mockOnDragEndCapture(onDragEnd)
    return <div data-testid="dnd-context">{children}</div>
  },
  closestCenter: vi.fn(),
  KeyboardSensor: class KeyboardSensor {},
  PointerSensor: class PointerSensor {},
  useSensor: vi.fn((sensor: unknown, options?: unknown) => ({ sensor, options })),
  useSensors: vi.fn((...sensors: unknown[]) => sensors),
}))

vi.mock("@dnd-kit/sortable", () => ({
  arrayMove: <T,>(array: T[], from: number, to: number) => {
    const copy = array.slice()
    const [item] = copy.splice(from, 1)
    if (item === undefined) {
      return copy
    }
    copy.splice(to, 0, item)
    return copy
  },
  SortableContext: ({ children }: { children: React.ReactNode }) => <div data-testid="sortable-context">{children}</div>,
  sortableKeyboardCoordinates: vi.fn(),
  verticalListSortingStrategy: vi.fn(),
}))

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })
}

function renderWithClient(ui: React.ReactElement) {
  const client = createQueryClient()
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

describe("TemplateTaskList", () => {
  beforeEach(() => {
    mockMutateAsync.mockReset()
    mockUseUpdateModeleTache.mockReset()
    mockOnDragEndCapture.mockReset()
    mockToastSuccess.mockReset()
    mockToastError.mockReset()
    mockFrom.mockClear()
    DND_STATE.lastOnDragEnd = null
    mockUseUpdateModeleTache.mockReturnValue({
      mutateAsync: mockMutateAsync,
    })
  })

  it("affiche l'état de chargement avec 3 skeletons et le titre", () => {
    renderWithClient(
      <TemplateTaskList modeles={EMPTY_MODELES} categories={CATEGORIES} isLoading={true} phase={"phase-1"} />
    )

    expect(screen.getByText("Templates de tâches")).toBeInTheDocument()
    expect(screen.getAllByTestId("skeleton")).toHaveLength(3)
    expect(screen.queryByText("Aucun template pour cette phase")).not.toBeInTheDocument()
  })

  it("affiche l'état vide quand aucun modèle n'est fourni", () => {
    renderWithClient(
      <TemplateTaskList modeles={EMPTY_MODELES} categories={CATEGORIES} isLoading={false} phase={"phase-1"} />
    )

    expect(screen.getByText("Aucun template pour cette phase")).toBeInTheDocument()
    expect(
      screen.getByText("Créez votre premier template de tâche pour automatiser la création de tâches.")
    ).toBeInTheDocument()
    expect(screen.getByTestId("file-question-icon")).toBeInTheDocument()
    expect(screen.queryByTestId("template-card-m1")).not.toBeInTheDocument()
  })

  it("affiche les modèles et le nombre réel de templates", async () => {
    renderWithClient(
      <TemplateTaskList modeles={MODELES} categories={CATEGORIES} isLoading={false} phase={"phase-1"} />
    )

    await waitFor(() => {
      expect(screen.getByText("Templates de tâches (3)")).toBeInTheDocument()
    })

    expect(screen.getByTestId("template-card-m1")).toHaveTextContent("Préparer le dossier")
    expect(screen.getByTestId("template-card-m2")).toHaveTextContent("Valider les pièces")
    expect(screen.getByTestId("template-card-m3")).toHaveTextContent("Envoyer la confirmation")
    expect(screen.getAllByTestId(/template-card-/)).toHaveLength(6)
    expect(screen.getByTestId("template-card-m1-categories")).toHaveTextContent("2")
  })

  it("réordonne les éléments et met à jour uniquement les ordres modifiés", async () => {
    mockMutateAsync.mockResolvedValue({ data: null, error: null })

    renderWithClient(
      <TemplateTaskList modeles={MODELES} categories={CATEGORIES} isLoading={false} phase={"phase-1"} />
    )

    await waitFor(() => {
      expect(DND_STATE.lastOnDragEnd).not.toBeNull()
    })

    await act(async () => {
      const handler = DND_STATE.lastOnDragEnd
      if (handler) {
        await handler({
          active: { id: "m3" },
          over: { id: "m1" },
        })
      }
    })

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledTimes(3)
    })

    expect(mockMutateAsync).toHaveBeenNthCalledWith(1, {
      id: "m3",
      data: { ordre: 0 },
    })
    expect(mockMutateAsync).toHaveBeenNthCalledWith(2, {
      id: "m1",
      data: { ordre: 1 },
    })
    expect(mockMutateAsync).toHaveBeenNthCalledWith(3, {
      id: "m2",
      data: { ordre: 2 },
    })
  })

  it("ne déclenche aucune mutation si l'élément est déposé à la même position", async () => {
    renderWithClient(
      <TemplateTaskList modeles={MODELES} categories={CATEGORIES} isLoading={false} phase={"phase-1"} />
    )

    await waitFor(() => {
      expect(DND_STATE.lastOnDragEnd).not.toBeNull()
    })

    await act(async () => {
      const handler = DND_STATE.lastOnDragEnd
      if (handler) {
        await handler({
          active: { id: "m2" },
          over: { id: "m2" },
        })
      }
    })

    expect(mockMutateAsync).not.toHaveBeenCalled()
  })

  it("expose isLoading puis succès puis isError via renderHook dans un wrapper QueryClientProvider", async () => {
    const successQueryFn = vi.fn(async () => {
      await Promise.resolve()
      return MODELES
    })
    const errorQueryFn = vi.fn(async () => {
      await Promise.resolve()
      throw new Error("x")
    })

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={createQueryClient()}>{children}</QueryClientProvider>
    )

    const successHook = renderHook(
      () =>
        useQuery({
          queryKey: ["template-task-list-success"],
          queryFn: successQueryFn,
        }),
      { wrapper }
    )

    expect(successHook.result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(successHook.result.current.isSuccess).toBe(true)
    })

    expect(successHook.result.current.data).toEqual(MODELES)
    expect(successHook.result.current.data?.[0]?.titre).toBe("Préparer le dossier")

    const errorHook = renderHook(
      () =>
        useQuery({
          queryKey: ["template-task-list-error"],
          queryFn: errorQueryFn,
        }),
      { wrapper }
    )

    expect(errorHook.result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(errorHook.result.current.isError).toBe(true)
    })

    expect(errorHook.result.current.error?.message).toBe("x")
  })
})