// @vitest-environment jsdom
import React from "react"
import { render, screen, fireEvent, waitFor, act, renderHook } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { BulkActionsBarGroupes } from "./BulkActionsBarGroupes"

const {
  GROUPES,
  AUTH_STATE,
  mockDebugError,
  mockToast,
  mockMutateAsync,
  mockUseUpdateGroupe,
  assignTagsDialogState,
  assignResponsableDialogState,
  mockFrom,
} = vi.hoisted(() => ({
  GROUPES: [
    {
      id: "g1",
      nom: "Groupe A",
      notes: "Note initiale",
      responsable_commercial_id: null,
      responsable_csm_id: null,
    },
    {
      id: "g2",
      nom: "Groupe B",
      notes: "",
      responsable_commercial_id: null,
      responsable_csm_id: null,
    },
    {
      id: "g3",
      nom: "Groupe C",
      notes: "Autre note",
      responsable_commercial_id: "old-commercial",
      responsable_csm_id: "old-csm",
    },
  ],
  AUTH_STATE: {
    user: { id: "u1", email: "user@test.co" },
    session: { user: { id: "u1" } },
    isLoading: false,
  },
  mockDebugError: vi.fn(),
  mockToast: vi.fn(),
  mockMutateAsync: vi.fn(),
  mockUseUpdateGroupe: vi.fn(),
  assignTagsDialogState: {
    open: false,
    onOpenChange: vi.fn<(open: boolean) => void>(),
    selectedGroupes: [] as Array<{ id: string; nom?: string; notes?: string }>,
    onAssignTags: vi.fn<(tags: string[]) => Promise<void>>(),
  },
  assignResponsableDialogState: {
    open: false,
    onOpenChange: vi.fn<(open: boolean) => void>(),
    selectedGroupes: [] as Array<{ id: string; nom?: string; notes?: string }>,
    onAssign: vi.fn<(commercialId?: string, csmId?: string) => Promise<void>>(),
  },
  mockFrom: vi.fn(),
}))

vi.mock("@/lib/debug", () => ({
  debug: {
    error: mockDebugError,
    log: vi.fn(),
    warn: vi.fn(),
  },
}))

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
}))

vi.mock("lucide-react", () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />
  return {
    X: Icon,
    Download: Icon,
    Trash2: Icon,
    UserPlus: Icon,
    Tags: Icon,
  }
})

vi.mock("./AssignTagsDialog", () => ({
  AssignTagsDialog: (props: {
    open: boolean
    onOpenChange: (open: boolean) => void
    selectedGroupes: Array<{ id: string; nom?: string; notes?: string }>
    onAssignTags: (tags: string[]) => Promise<void>
  }) => {
    assignTagsDialogState.open = props.open
    assignTagsDialogState.onOpenChange = props.onOpenChange
    assignTagsDialogState.selectedGroupes = props.selectedGroupes
    assignTagsDialogState.onAssignTags = props.onAssignTags
    return <div data-testid="assign-tags-dialog">{props.open ? "open" : "closed"}</div>
  },
}))

vi.mock("./AssignResponsableDialog", () => ({
  AssignResponsableDialog: (props: {
    open: boolean
    onOpenChange: (open: boolean) => void
    selectedGroupes: Array<{ id: string; nom?: string; notes?: string }>
    onAssign: (commercialId?: string, csmId?: string) => Promise<void>
  }) => {
    assignResponsableDialogState.open = props.open
    assignResponsableDialogState.onOpenChange = props.onOpenChange
    assignResponsableDialogState.selectedGroupes = props.selectedGroupes
    assignResponsableDialogState.onAssign = props.onAssign
    return <div data-testid="assign-responsable-dialog">{props.open ? "open" : "closed"}</div>
  },
}))

vi.mock("@/hooks/crm/useGroupes", () => ({
  useUpdateGroupe: () => mockUseUpdateGroupe(),
}))

vi.mock("@/hooks/shared/use-toast", () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}))

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock("@/integrations/supabase/client", () => {
  const result = { data: null, error: null }
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
    upsert: vi.fn(() => builder),
    single: vi.fn(async () => result),
    maybeSingle: vi.fn(async () => result),
    then: (resolve: (value: typeof result) => unknown) => Promise.resolve(resolve(result)),
    catch: vi.fn(),
  }
  mockFrom.mockReturnValue(builder)
  return {
    supabase: {
      from: mockFrom,
      auth: {
        getSession: vi.fn(async () => ({ data: { session: AUTH_STATE.session }, error: null })),
        getUser: vi.fn(async () => ({ data: { user: AUTH_STATE.user }, error: null })),
      },
    },
  }
})

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

describe("BulkActionsBarGroupes", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseUpdateGroupe.mockReturnValue({ mutateAsync: mockMutateAsync })
    assignTagsDialogState.open = false
    assignTagsDialogState.selectedGroupes = []
    assignResponsableDialogState.open = false
    assignResponsableDialogState.selectedGroupes = []
    vi.stubGlobal("confirm", vi.fn(() => true))
  })

  it("crée bien un wrapper QueryClientProvider compatible renderHook", () => {
    const Wrapper = createWrapper()

    const { result } = renderHook(() => 42, { wrapper: Wrapper })

    expect(result.current).toBe(42)
  })

  it("n'affiche rien quand aucun groupe n'est sélectionné", () => {
    const Wrapper = createWrapper()

    const { container } = render(
      <BulkActionsBarGroupes
        selectedGroupes={[]}
        groupes={GROUPES}
        onClearSelection={vi.fn()}
        onExport={vi.fn()}
        onDelete={vi.fn()}
      />,
      { wrapper: Wrapper }
    )

    expect(container.firstChild).toBeNull()
    expect(screen.queryByText(/sélectionné/)).toBeNull()
  })

  it("affiche le compteur, les actions et transmet uniquement les groupes sélectionnés aux dialogs", () => {
    const Wrapper = createWrapper()

    render(
      <BulkActionsBarGroupes
        selectedGroupes={["g1", "g3"]}
        groupes={GROUPES}
        onClearSelection={vi.fn()}
        onExport={vi.fn()}
        onDelete={vi.fn()}
      />,
      { wrapper: Wrapper }
    )

    expect(screen.getByText("2 groupes sélectionnés")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /exporter/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /assigner/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^tags$/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /supprimer/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /fermer/i })).toBeInTheDocument()
    expect(assignTagsDialogState.selectedGroupes).toEqual([GROUPES[0], GROUPES[2]])
    expect(assignResponsableDialogState.selectedGroupes).toEqual([GROUPES[0], GROUPES[2]])
  })

  it("déclenche l'export avec les ids sélectionnés", () => {
    const Wrapper = createWrapper()
    const onExport = vi.fn()

    render(
      <BulkActionsBarGroupes
        selectedGroupes={["g1", "g2"]}
        groupes={GROUPES}
        onClearSelection={vi.fn()}
        onExport={onExport}
        onDelete={vi.fn()}
      />,
      { wrapper: Wrapper }
    )

    fireEvent.click(screen.getByRole("button", { name: /exporter/i }))

    expect(onExport).toHaveBeenCalledTimes(1)
    expect(onExport).toHaveBeenCalledWith(["g1", "g2"])
  })

  it("ouvre les dialogs d'assignation et de tags", async () => {
    const Wrapper = createWrapper()

    render(
      <BulkActionsBarGroupes
        selectedGroupes={["g1", "g2"]}
        groupes={GROUPES}
        onClearSelection={vi.fn()}
        onExport={vi.fn()}
        onDelete={vi.fn()}
      />,
      { wrapper: Wrapper }
    )

    expect(assignResponsableDialogState.open).toBe(false)
    expect(assignTagsDialogState.open).toBe(false)

    fireEvent.click(screen.getByRole("button", { name: /assigner/i }))
    await waitFor(() => expect(assignResponsableDialogState.open).toBe(true))

    fireEvent.click(screen.getByRole("button", { name: /^tags$/i }))
    await waitFor(() => expect(assignTagsDialogState.open).toBe(true))
  })

  it("déclenche la suppression après confirmation", () => {
    const Wrapper = createWrapper()
    const onDelete = vi.fn()

    render(
      <BulkActionsBarGroupes
        selectedGroupes={["g1", "g2"]}
        groupes={GROUPES}
        onClearSelection={vi.fn()}
        onExport={vi.fn()}
        onDelete={onDelete}
      />,
      { wrapper: Wrapper }
    )

    fireEvent.click(screen.getByRole("button", { name: /supprimer/i }))

    expect(globalThis.confirm).toHaveBeenCalledWith("Voulez-vous vraiment supprimer 2 groupe(s) ?")
    expect(onDelete).toHaveBeenCalledTimes(1)
    expect(onDelete).toHaveBeenCalledWith(["g1", "g2"])
  })

  it("ne supprime pas si la confirmation est refusée", () => {
    vi.stubGlobal("confirm", vi.fn(() => false))
    const Wrapper = createWrapper()
    const onDelete = vi.fn()

    render(
      <BulkActionsBarGroupes
        selectedGroupes={["g1", "g2"]}
        groupes={GROUPES}
        onClearSelection={vi.fn()}
        onExport={vi.fn()}
        onDelete={onDelete}
      />,
      { wrapper: Wrapper }
    )

    fireEvent.click(screen.getByRole("button", { name: /supprimer/i }))

    expect(onDelete).not.toHaveBeenCalled()
  })

  it("efface la sélection via le bouton fermer", () => {
    const Wrapper = createWrapper()
    const onClearSelection = vi.fn()

    render(
      <BulkActionsBarGroupes
        selectedGroupes={["g1"]}
        groupes={GROUPES}
        onClearSelection={onClearSelection}
        onExport={vi.fn()}
        onDelete={vi.fn()}
      />,
      { wrapper: Wrapper }
    )

    fireEvent.click(screen.getByRole("button", { name: /fermer/i }))

    expect(onClearSelection).toHaveBeenCalledTimes(1)
  })

  it("assigne des tags en mettant à jour les notes de chaque groupe sélectionné", async () => {
    const Wrapper = createWrapper()
    mockMutateAsync.mockResolvedValue({ data: { id: "ok" }, error: null })

    render(
      <BulkActionsBarGroupes
        selectedGroupes={["g1", "g2"]}
        groupes={GROUPES}
        onClearSelection={vi.fn()}
        onExport={vi.fn()}
        onDelete={vi.fn()}
      />,
      { wrapper: Wrapper }
    )

    await act(async () => {
      await assignTagsDialogState.onAssignTags(["vip", "urgent"])
    })

    expect(mockMutateAsync).toHaveBeenCalledTimes(2)
    expect(mockMutateAsync).toHaveBeenNthCalledWith(1, {
      id: "g1",
      data: { notes: "Note initiale\n\nTags: #vip #urgent" },
    })
    expect(mockMutateAsync).toHaveBeenNthCalledWith(2, {
      id: "g2",
      data: { notes: "Tags: #vip #urgent" },
    })
  })

  it("journalise une erreur si l'assignation de tags échoue", async () => {
    const Wrapper = createWrapper()
    const tagError = new Error("assign tags failed")
    mockMutateAsync.mockRejectedValue(tagError)

    render(
      <BulkActionsBarGroupes
        selectedGroupes={["g1"]}
        groupes={GROUPES}
        onClearSelection={vi.fn()}
        onExport={vi.fn()}
        onDelete={vi.fn()}
      />,
      { wrapper: Wrapper }
    )

    await act(async () => {
      await assignTagsDialogState.onAssignTags(["vip"])
    })

    expect(mockDebugError).toHaveBeenCalledTimes(1)
    expect(mockDebugError).toHaveBeenCalledWith("Error assigning tags:", tagError)
  })

  it("assigne les responsables sur chaque groupe sélectionné", async () => {
    const Wrapper = createWrapper()
    mockMutateAsync.mockResolvedValue({ data: { id: "ok" }, error: null })

    render(
      <BulkActionsBarGroupes
        selectedGroupes={["g1", "g3"]}
        groupes={GROUPES}
        onClearSelection={vi.fn()}
        onExport={vi.fn()}
        onDelete={vi.fn()}
      />,
      { wrapper: Wrapper }
    )

    await act(async () => {
      await assignResponsableDialogState.onAssign("commercial-1", "csm-1")
    })

    expect(mockMutateAsync).toHaveBeenCalledTimes(2)
    expect(mockMutateAsync).toHaveBeenNthCalledWith(1, {
      id: "g1",
      data: {
        responsable_commercial_id: "commercial-1",
        responsable_csm_id: "csm-1",
      },
    })
    expect(mockMutateAsync).toHaveBeenNthCalledWith(2, {
      id: "g3",
      data: {
        responsable_commercial_id: "commercial-1",
        responsable_csm_id: "csm-1",
      },
    })
  })

  it("n'envoie que les champs de responsable fournis", async () => {
    const Wrapper = createWrapper()
    mockMutateAsync.mockResolvedValue({ data: { id: "ok" }, error: null })

    render(
      <BulkActionsBarGroupes
        selectedGroupes={["g2"]}
        groupes={GROUPES}
        onClearSelection={vi.fn()}
        onExport={vi.fn()}
        onDelete={vi.fn()}
      />,
      { wrapper: Wrapper }
    )

    await act(async () => {
      await assignResponsableDialogState.onAssign("commercial-only")
    })

    expect(mockMutateAsync).toHaveBeenCalledTimes(1)
    expect(mockMutateAsync).toHaveBeenCalledWith({
      id: "g2",
      data: {
        responsable_commercial_id: "commercial-only",
      },
    })
  })

  it("affiche un toast destructif et journalise en cas d'erreur lors de l'assignation des responsables", async () => {
    const Wrapper = createWrapper()
    const assignError = new Error("assign responsables failed")
    mockMutateAsync.mockRejectedValue(assignError)

    render(
      <BulkActionsBarGroupes
        selectedGroupes={["g1"]}
        groupes={GROUPES}
        onClearSelection={vi.fn()}
        onExport={vi.fn()}
        onDelete={vi.fn()}
      />,
      { wrapper: Wrapper }
    )

    await act(async () => {
      await assignResponsableDialogState.onAssign("commercial-x", "csm-x")
    })

    expect(mockDebugError).toHaveBeenCalledWith("Error assigning responsables:", assignError)
    expect(mockToast).toHaveBeenCalledTimes(1)
    expect(mockToast).toHaveBeenCalledWith({
      title: "Erreur",
      description: "Une erreur est survenue lors de l'assignation",
      variant: "destructive",
    })
  })
})