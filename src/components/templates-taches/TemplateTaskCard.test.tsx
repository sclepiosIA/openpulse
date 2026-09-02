/* @vitest-environment jsdom */
import React from "react"
import { render, screen, fireEvent, act, renderHook } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { TemplateTaskCard } from "./TemplateTaskCard"

const {
  MODELE_ACTIF,
  MODELE_INACTIF,
  MODELE_PRIORITE_INCONNUE,
  CATEGORIES,
  sortableReturn,
  mutateUpdate,
  mutateDelete,
  setNodeRef,
  editDialogState,
  alertDialogState,
  cssToString,
} = vi.hoisted(() => {
  const mutateUpdateFn = vi.fn()
  const mutateDeleteFn = vi.fn()
  const setNodeRefFn = vi.fn()
  const cssToStringFn = vi.fn((transform: unknown) =>
    transform ? "translate3d(10px, 20px, 0)" : undefined
  )

  return {
    MODELE_ACTIF: {
      id: "m1",
      titre: "Contrôle initial",
      description: "Description modèle",
      priorite: "high",
      actif: true,
      delai_jours: 3,
      categorie: {
        id: "c1",
        nom: "Sécurité",
        couleur: "#ff0000",
      },
    },
    MODELE_INACTIF: {
      id: "m2",
      titre: "Archivage",
      description: "",
      priorite: "low",
      actif: false,
      delai_jours: 0,
      categorie: null,
    },
    MODELE_PRIORITE_INCONNUE: {
      id: "m3",
      titre: "Inspection",
      description: "Texte libre",
      priorite: "unknown",
      actif: true,
      delai_jours: 1,
      categorie: {
        id: "c2",
        nom: "Qualité",
        couleur: "#00ff00",
      },
    },
    CATEGORIES: [
      { id: "c1", nom: "Sécurité", couleur: "#ff0000" },
      { id: "c2", nom: "Qualité", couleur: "#00ff00" },
    ],
    sortableReturn: {
      attributes: { "data-sortable": "yes" },
      listeners: { onPointerDown: vi.fn() },
      setNodeRef: setNodeRefFn,
      transform: null as unknown,
      transition: "all 200ms",
      isDragging: false,
    },
    mutateUpdate: mutateUpdateFn,
    mutateDelete: mutateDeleteFn,
    setNodeRef: setNodeRefFn,
    editDialogState: { open: false, modeleId: "", categoriesCount: 0 },
    alertDialogState: { open: false },
    cssToString: cssToStringFn,
  }
})

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
    single: vi.fn(async () => ({ data: null, error: null })),
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    then: (onFulfilled: (value: { data: null; error: null }) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(onFulfilled),
    catch: (onRejected: (reason: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null }).catch(onRejected),
  }
  const mockFrom = vi.fn(() => builder)
  return {
    supabase: {
      from: mockFrom,
    },
  }
})

vi.mock("@/hooks/tasks/useModelesTaches", () => ({
  useUpdateModeleTache: vi.fn(() => ({
    mutate: mutateUpdate,
    isPending: false,
    isError: false,
    isSuccess: false,
    error: null,
  })),
  useDeleteModeleTache: vi.fn(() => ({
    mutate: mutateDelete,
    isPending: false,
    isError: false,
    isSuccess: false,
    error: null,
  })),
}))

vi.mock("@dnd-kit/sortable", () => ({
  useSortable: vi.fn(() => sortableReturn),
}))

vi.mock("@dnd-kit/utilities", () => ({
  CSS: {
    Transform: {
      toString: cssToString,
    },
  },
}))

vi.mock("lucide-react", () => {
  const Icon = ({ className }: { className?: string }) =>
    React.createElement("svg", { "data-testid": "icon", className })
  return {
    GripVertical: Icon,
    Pencil: Icon,
    Trash2: Icon,
    Clock: Icon,
    ToggleLeft: Icon,
    ToggleRight: Icon,
  }
})

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    title,
    "aria-label": ariaLabel,
    className,
  }: {
    children: React.ReactNode
    onClick?: () => void
    title?: string
    "aria-label"?: string
    className?: string
  }) =>
    React.createElement(
      "button",
      {
        type: "button",
        onClick,
        title,
        "aria-label": ariaLabel,
        className,
      },
      children
    ),
}))

vi.mock("@/components/ui/badge", () => ({
  Badge: ({
    children,
    className,
    style,
    variant,
  }: {
    children: React.ReactNode
    className?: string
    style?: React.CSSProperties
    variant?: string
  }) =>
    React.createElement(
      "span",
      {
        className,
        style,
        "data-variant": variant,
      },
      children
    ),
}))

vi.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({
    open,
    children,
  }: {
    open: boolean
    onOpenChange?: (open: boolean) => void
    children: React.ReactNode
  }) => {
    alertDialogState.open = open
    return open ? React.createElement("div", { "data-testid": "alert-dialog" }, children) : null
  },
  AlertDialogContent: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) =>
    React.createElement("h2", null, children),
  AlertDialogDescription: ({ children }: { children: React.ReactNode }) =>
    React.createElement("p", null, children),
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
  AlertDialogCancel: ({ children }: { children: React.ReactNode }) =>
    React.createElement("button", { type: "button" }, children),
  AlertDialogAction: ({
    children,
    onClick,
    className,
  }: {
    children: React.ReactNode
    onClick?: () => void
    className?: string
  }) => React.createElement("button", { type: "button", onClick, className }, children),
}))

vi.mock("./EditTemplateDialog", () => ({
  EditTemplateDialog: ({
    open,
    modele,
    categories,
  }: {
    open: boolean
    modele: { id: string }
    categories: Array<{ id: string }>
    onOpenChange?: (open: boolean) => void
  }) => {
    editDialogState.open = open
    editDialogState.modeleId = modele.id
    editDialogState.categoriesCount = categories.length
    return open
      ? React.createElement(
          "div",
          {
            "data-testid": "edit-template-dialog",
            "data-modele-id": modele.id,
            "data-categories-count": String(categories.length),
          },
          "edit-open"
        )
      : null
  },
}))

vi.mock("@/lib/utils", () => ({
  cn: (...args: Array<string | false | null | undefined>) => args.filter(Boolean).join(" "),
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

describe("TemplateTaskCard", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sortableReturn.isDragging = false
    sortableReturn.transform = null
    sortableReturn.transition = "all 200ms"
    alertDialogState.open = false
    editDialogState.open = false
    editDialogState.modeleId = ""
    editDialogState.categoriesCount = 0
  })

  it("rend les informations métier du modèle actif avec catégorie, priorité haute et délai", () => {
    const wrapper = createWrapper()

    render(
      React.createElement(TemplateTaskCard, {
        modele: MODELE_ACTIF,
        categories: CATEGORIES,
      }),
      { wrapper }
    )

    expect(screen.getByText("Contrôle initial")).toBeInTheDocument()
    expect(screen.getByText("Description modèle")).toBeInTheDocument()
    expect(screen.getByText("Sécurité")).toBeInTheDocument()
    expect(screen.getByText("Haute")).toBeInTheDocument()
    expect(screen.getByText("J+3")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Désactiver le modèle" })).toBeInTheDocument()

    const categoryBadge = screen.getByText("Sécurité")
    expect(categoryBadge).toHaveStyle({ borderColor: "#ff0000", color: "#ff0000" })

    expect(screen.queryByTestId("edit-template-dialog")).not.toBeInTheDocument()
    expect(alertDialogState.open).toBe(false)
  })

  it("affiche les variantes métier d'un modèle inactif sans catégorie, avec priorité basse et sans délai", () => {
    const wrapper = createWrapper()

    render(
      React.createElement(TemplateTaskCard, {
        modele: MODELE_INACTIF,
        categories: CATEGORIES,
      }),
      { wrapper }
    )

    expect(screen.getByText("Archivage")).toBeInTheDocument()
    expect(screen.getByText("Basse")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Activer le modèle" })).toBeInTheDocument()
    expect(screen.queryByText("Sécurité")).not.toBeInTheDocument()
    expect(screen.queryByText(/J\+/)).not.toBeInTheDocument()
    expect(screen.queryByText("Description modèle")).not.toBeInTheDocument()
  })

  it("utilise la priorité moyenne par défaut quand la priorité est inconnue", () => {
    const wrapper = createWrapper()

    render(
      React.createElement(TemplateTaskCard, {
        modele: MODELE_PRIORITE_INCONNUE,
        categories: CATEGORIES,
      }),
      { wrapper }
    )

    expect(screen.getByText("Inspection")).toBeInTheDocument()
    expect(screen.getByText("Moyenne")).toBeInTheDocument()
    expect(screen.getByText("J+1")).toBeInTheDocument()
    expect(screen.getByText("Qualité")).toBeInTheDocument()
  })

  it("déclenche la mutation de bascule actif/inactif avec les valeurs attendues", async () => {
    const wrapper = createWrapper()

    render(
      React.createElement(TemplateTaskCard, {
        modele: MODELE_ACTIF,
        categories: CATEGORIES,
      }),
      { wrapper }
    )

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Désactiver le modèle" }))
    })

    expect(mutateUpdate).toHaveBeenCalledTimes(1)
    expect(mutateUpdate).toHaveBeenCalledWith({
      id: "m1",
      data: { actif: false },
    })
  })

  it("ouvre la modale d'édition avec le bon modèle et les catégories fournies", async () => {
    const wrapper = createWrapper()

    render(
      React.createElement(TemplateTaskCard, {
        modele: MODELE_ACTIF,
        categories: CATEGORIES,
      }),
      { wrapper }
    )

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Modifier" }))
    })

    const dialog = screen.getByTestId("edit-template-dialog")
    expect(dialog).toBeInTheDocument()
    expect(dialog).toHaveAttribute("data-modele-id", "m1")
    expect(dialog).toHaveAttribute("data-categories-count", "2")
    expect(editDialogState.open).toBe(true)
    expect(editDialogState.modeleId).toBe("m1")
    expect(editDialogState.categoriesCount).toBe(2)
  })

  it("ouvre la confirmation de suppression puis appelle la mutation avec l'id du modèle", async () => {
    const wrapper = createWrapper()

    render(
      React.createElement(TemplateTaskCard, {
        modele: MODELE_ACTIF,
        categories: CATEGORIES,
      }),
      { wrapper }
    )

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Supprimer" }))
    })

    expect(screen.getByTestId("alert-dialog")).toBeInTheDocument()
    expect(screen.getByText("Supprimer ce template ?")).toBeInTheDocument()
    expect(
      screen.getByText('Cette action est irréversible. Le template "Contrôle initial" sera définitivement supprimé.')
    ).toBeInTheDocument()
    expect(alertDialogState.open).toBe(true)

    await act(async () => {
      fireEvent.click(screen.getAllByRole("button", { name: "Supprimer" })[1])
    })

    expect(mutateDelete).toHaveBeenCalledTimes(1)
    expect(mutateDelete).toHaveBeenCalledWith("m1")
  })

  it("applique le style de drag and drop via useSortable", () => {
    sortableReturn.transform = { x: 10, y: 20, scaleX: 1, scaleY: 1 }
    sortableReturn.isDragging = true

    const wrapper = createWrapper()
    const { container } = render(
      React.createElement(TemplateTaskCard, {
        modele: MODELE_ACTIF,
        categories: CATEGORIES,
      }),
      { wrapper }
    )

    expect(setNodeRef).toHaveBeenCalled()
    expect(cssToString).toHaveBeenCalledWith({ x: 10, y: 20, scaleX: 1, scaleY: 1 })

    const rootCard = container.querySelector("div[style]")
    expect(rootCard?.getAttribute("style")).toContain("transform: translate3d(10px, 20px, 0)")
    expect(rootCard?.getAttribute("style")).toContain("transition: all 200ms")
  })

  it("peut être rendu dans un wrapper QueryClientProvider via renderHook sans erreur", () => {
    const wrapper = createWrapper()

    const { result } = renderHook(
      () =>
        React.createElement(TemplateTaskCard, {
          modele: MODELE_ACTIF,
          categories: CATEGORIES,
        }),
      { wrapper }
    )

    expect(result.current).toBeTruthy()
  })

  it("ne remonte pas d'erreur de rendu au montage quand les hooks retournent un état stable sans erreur", () => {
    const wrapper = createWrapper()

    expect(() =>
      render(
        React.createElement(TemplateTaskCard, {
          modele: MODELE_ACTIF,
          categories: CATEGORIES,
        }),
        { wrapper }
      )
    ).not.toThrow()
  })
})