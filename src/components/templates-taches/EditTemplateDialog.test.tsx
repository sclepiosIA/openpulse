// @vitest-environment jsdom
import React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderHook } from "@testing-library/react"
import { EditTemplateDialog } from "./EditTemplateDialog"

const {
  MODELE,
  UPDATED_MODELE,
  CATEGORIES,
  AUTH_STATE,
  mockMutateAsync,
  mockUseUpdateModeleTache,
  toastSuccess,
  toastError,
  navigateMock,
  mockFrom,
} = vi.hoisted(() => ({
  MODELE: {
    id: "tmpl-1",
    titre: "Relance initiale",
    description: "Contacter le client pour un premier suivi",
    categorie_id: "cat-1",
    priorite: "medium" as const,
    delai_jours: 5,
  },
  UPDATED_MODELE: {
    id: "tmpl-2",
    titre: "Visite de contrôle",
    description: "Préparer la visite et envoyer le rappel",
    categorie_id: "cat-2",
    priorite: "high" as const,
    delai_jours: 12,
  },
  CATEGORIES: [
    { id: "cat-1", nom: "Commercial", couleur: "#ff0000" },
    { id: "cat-2", nom: "Technique", couleur: "#00ff00" },
  ],
  AUTH_STATE: {
    user: { id: "u1", email: "test@example.co" },
    session: { user: { id: "u1" } },
    isLoading: false,
  },
  mockMutateAsync: vi.fn(),
  mockUseUpdateModeleTache: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  navigateMock: vi.fn(),
  mockFrom: vi.fn(),
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
    single: vi.fn(async () => ({ data: null, error: null })),
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    then: (resolve: (value: { data: null; error: null }) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(resolve),
    catch: (reject: (reason: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null }).catch(reject),
  }

  mockFrom.mockImplementation(() => builder)

  return {
    supabase: {
      from: mockFrom,
    },
  }
})

vi.mock("@/hooks/tasks/useModelesTaches", () => ({
  useUpdateModeleTache: mockUseUpdateModeleTache,
}))

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock("sonner", () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}))

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom")
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({
    open,
    children,
  }: {
    open: boolean
    children: React.ReactNode
    onOpenChange?: (open: boolean) => void
  }) => (open ? <div data-testid="dialog-root">{children}</div> : null),
  DialogContent: ({
    children,
    className,
  }: {
    children: React.ReactNode
    className?: string
  }) => <div data-testid="dialog-content" className={className}>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}))

vi.mock("@/components/ui/input", () => ({
  Input: React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
    (props, ref) => <input ref={ref} {...props} />
  ),
}))

vi.mock("@/components/ui/textarea", () => ({
  Textarea: React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
    (props, ref) => <textarea ref={ref} {...props} />
  ),
}))

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) => (
    <button {...props}>{children}</button>
  ),
}))

vi.mock("@/components/ui/form", async () => {
  const rhf = await vi.importActual<typeof import("react-hook-form")>("react-hook-form")

  return {
    Form: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    FormControl: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    FormDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    FormItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    FormLabel: ({ children }: { children: React.ReactNode }) => <label>{children}</label>,
    FormMessage: () => <div />,
    FormField: ({
      control,
      name,
      render: renderProp,
    }: {
      control: unknown
      name: string
      render: (props: { field: ReturnType<typeof rhf.useController>["field"] }) => React.ReactNode
    }) => {
      const controller = rhf.useController({
        name,
        control: control as Parameters<typeof rhf.useController>[0]["control"],
      })
      return <>{renderProp({ field: controller.field })}</>
    },
  }
})

vi.mock("@/components/ui/select", () => {
  const SelectContext = React.createContext<{
    value?: string
    onValueChange?: (value: string) => void
  }>({})

  return {
    Select: ({
      value,
      onValueChange,
      children,
    }: {
      value?: string
      onValueChange?: (value: string) => void
      children: React.ReactNode
    }) => (
      <SelectContext.Provider value={{ value, onValueChange }}>
        <div>{children}</div>
      </SelectContext.Provider>
    ),
    SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    SelectValue: ({ placeholder }: { placeholder?: string }) => {
      const ctx = React.useContext(SelectContext)
      return <span>{ctx.value || placeholder || ""}</span>
    },
    SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    SelectItem: ({
      value,
      children,
    }: {
      value: string
      children: React.ReactNode
    }) => {
      const ctx = React.useContext(SelectContext)
      return (
        <button type="button" onClick={() => ctx.onValueChange?.(value)}>
          {children}
        </button>
      )
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

describe("EditTemplateDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseUpdateModeleTache.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
      isError: false,
      error: null,
    })
    mockMutateAsync.mockResolvedValue({ data: MODELE, error: null })
  })

  it("expose un état de mutation success via le hook mocké avec renderHook", () => {
    const wrapper = createWrapper()

    const { result } = renderHook(() => mockUseUpdateModeleTache(), { wrapper })

    expect(result.current.isPending).toBe(false)
    expect(result.current.isError).toBe(false)
    expect(typeof result.current.mutateAsync).toBe("function")
  })

  it("affiche les valeurs métier initiales du modèle dans le formulaire", () => {
    render(
      <EditTemplateDialog
        open={true}
        onOpenChange={vi.fn()}
        modele={MODELE}
        categories={CATEGORIES}
      />
    )

    expect(screen.getByText("Modifier le template")).toBeInTheDocument()
    expect(screen.getByDisplayValue("Relance initiale")).toBeInTheDocument()
    expect(
      screen.getByDisplayValue("Contacter le client pour un premier suivi")
    ).toBeInTheDocument()
    expect(screen.getByDisplayValue("5")).toBeInTheDocument()
    expect(screen.getByText("Commercial")).toBeInTheDocument()
    expect(screen.getByText("medium")).toBeInTheDocument()
  })

  it("réinitialise le formulaire quand le modèle change et que le dialog est ouvert", async () => {
    const onOpenChange = vi.fn()

    const { rerender } = render(
      <EditTemplateDialog
        open={true}
        onOpenChange={onOpenChange}
        modele={MODELE}
        categories={CATEGORIES}
      />
    )

    expect(screen.getByDisplayValue("Relance initiale")).toBeInTheDocument()
    expect(screen.getByDisplayValue("5")).toBeInTheDocument()

    rerender(
      <EditTemplateDialog
        open={true}
        onOpenChange={onOpenChange}
        modele={UPDATED_MODELE}
        categories={CATEGORIES}
      />
    )

    await waitFor(() => {
      expect(screen.getByDisplayValue("Visite de contrôle")).toBeInTheDocument()
      expect(
        screen.getByDisplayValue("Préparer la visite et envoyer le rappel")
      ).toBeInTheDocument()
      expect(screen.getByDisplayValue("12")).toBeInTheDocument()
      expect(screen.getByText("high")).toBeInTheDocument()
      expect(screen.getByText("Technique")).toBeInTheDocument()
    })
  })

  it("soumet les nouvelles valeurs et ferme le dialog au succès", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()

    render(
      <EditTemplateDialog
        open={true}
        onOpenChange={onOpenChange}
        modele={MODELE}
        categories={CATEGORIES}
      />
    )

    const titreInput = screen.getByDisplayValue("Relance initiale")
    const descriptionInput = screen.getByDisplayValue(
      "Contacter le client pour un premier suivi"
    )
    const delaiInput = screen.getByDisplayValue("5")

    await user.clear(titreInput)
    await user.type(titreInput, "Appel de qualification")
    await user.clear(descriptionInput)
    await user.type(descriptionInput, "Vérifier le besoin et planifier la suite")
    await user.clear(delaiInput)
    await user.type(delaiInput, "8")

    await user.click(screen.getByText("Technique"))
    await user.click(screen.getByText("Haute"))
    await user.click(screen.getByRole("button", { name: "Enregistrer" }))

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        id: "tmpl-1",
        data: {
          titre: "Appel de qualification",
          description: "Vérifier le besoin et planifier la suite",
          categorie_id: "cat-2",
          priorite: "high",
          delai_jours: 8,
        },
      })
    })

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("affiche l'état de chargement pendant l'enregistrement", () => {
    mockUseUpdateModeleTache.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: true,
      isError: false,
      error: null,
    })

    render(
      <EditTemplateDialog
        open={true}
        onOpenChange={vi.fn()}
        modele={MODELE}
        categories={CATEGORIES}
      />
    )

    expect(screen.getByRole("button", { name: "Enregistrement..." })).toBeDisabled()
  })

  it("expose un état d'erreur du hook mocké avec renderHook", () => {
    const wrapper = createWrapper()
    const mutationError = { message: "x" }

    mockUseUpdateModeleTache.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
      isError: true,
      error: mutationError,
      data: null,
    })

    const { result } = renderHook(() => mockUseUpdateModeleTache(), { wrapper })

    expect(result.current.isError).toBe(true)
    expect(result.current.error).toEqual({ message: "x" })
    expect(result.current.data ?? null).toBeNull()
  })
})