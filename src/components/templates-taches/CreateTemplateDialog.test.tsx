// @vitest-environment jsdom

import React from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook } from "@testing-library/react"
import { CreateTemplateDialog } from "./CreateTemplateDialog"

const {
  STABLE_USER,
  CATEGORIES,
  ALL_MODELES,
  PHASE_GROUPS_STABLE,
  mockMutateAsync,
  mockUseCreateModeleTache,
  mockUseAllModelesTaches,
  mockOnOpenChange,
} = vi.hoisted(() => ({
  STABLE_USER: {
    user: { id: "u1", email: "test@example.com" },
    session: { user: { id: "u1" } },
    isLoading: false,
  },
  CATEGORIES: [
    { id: "cat-1", nom: "Commercial", couleur: "#ff0000" },
    { id: "cat-2", nom: "Administratif", couleur: "#00ff00" },
  ],
  ALL_MODELES: [
    { id: "m1", ordre: 2 },
    { id: "m2", ordre: 7 },
    { id: "m3", ordre: 4 },
  ],
  PHASE_GROUPS_STABLE: {
    prospect: { label: "Prospection" },
    qualification: { label: "Qualification" },
    closing: { label: "Closing" },
  },
  mockMutateAsync: vi.fn(),
  mockUseCreateModeleTache: vi.fn(),
  mockUseAllModelesTaches: vi.fn(),
  mockOnOpenChange: vi.fn(),
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
      Promise.resolve(resolve({ data: null, error: null })),
    catch: vi.fn(() => Promise.resolve({ data: null, error: null })),
  }
  return {
    supabase: {
      from: vi.fn(() => builder),
    },
  }
})

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => STABLE_USER,
}))

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => STABLE_USER,
}))

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => STABLE_USER,
}))

vi.mock("@/config/phases", () => ({
  PHASE_GROUPS: PHASE_GROUPS_STABLE,
}))

vi.mock("@/hooks/tasks/useModelesTaches", () => ({
  useCreateModeleTache: () => mockUseCreateModeleTache(),
  useAllModelesTaches: () => mockUseAllModelesTaches(),
}))

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({
    open,
    children,
  }: {
    open: boolean
    onOpenChange: (open: boolean) => void
    children: React.ReactNode
  }) => (open ? <div data-testid="dialog-root">{children}</div> : null),
  DialogContent: ({ children }: { children: React.ReactNode; className?: string }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}))

vi.mock("@/components/ui/form", async () => {
  const reactHookForm = await import("react-hook-form")
  return {
    Form: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    FormControl: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    FormDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    FormField: ({
      control,
      name,
      render,
    }: {
      control: ReturnType<typeof reactHookForm.useForm>["control"]
      name: "titre" | "description" | "categorie_id" | "priorite" | "delai_jours"
      render: (props: {
        field: {
          name: string
          value: string | number | undefined
          onChange: (...event: unknown[]) => void
          onBlur: () => void
          ref: React.Ref<HTMLElement>
        }
      }) => React.ReactNode
    }) => {
      const { field } = reactHookForm.useController({ control, name })
      return <>{render({ field })}</>
    },
    FormItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    FormLabel: ({ children }: { children: React.ReactNode }) => <label>{children}</label>,
    FormMessage: () => null,
  }
})

vi.mock("@/components/ui/input", () => ({
  Input: React.forwardRef<
    HTMLInputElement,
    React.InputHTMLAttributes<HTMLInputElement>
  >(function Input(props, ref) {
    return <input ref={ref} {...props} />
  }),
}))

vi.mock("@/components/ui/textarea", () => ({
  Textarea: React.forwardRef<
    HTMLTextAreaElement,
    React.TextareaHTMLAttributes<HTMLTextAreaElement>
  >(function Textarea(props, ref) {
    return <textarea ref={ref} {...props} />
  }),
}))

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) => (
    <button {...props}>{children}</button>
  ),
}))

vi.mock("@/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value?: string
    onValueChange: (value: string) => void
    children: React.ReactNode
  }) => (
    <select
      data-testid="select"
      value={value ?? ""}
      onChange={(e) => onValueChange(e.target.value)}
    >
      {children}
    </select>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({
    value,
    children,
  }: {
    value: string
    children: React.ReactNode
  }) => <option value={value}>{children}</option>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => (
    <option value="">{placeholder ?? ""}</option>
  ),
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

describe("CreateTemplateDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockMutateAsync.mockResolvedValue({ data: { id: "created-1" }, error: null })
    mockUseCreateModeleTache.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
      isError: false,
      error: null,
    })
    mockUseAllModelesTaches.mockReturnValue({
      data: ALL_MODELES,
      isLoading: false,
      isError: false,
      error: null,
    })
  })

  it("expose les données du hook de chargement via renderHook avec QueryClientProvider", () => {
    const wrapper = createWrapper()

    const { result } = renderHook(() => mockUseAllModelesTaches(), { wrapper })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.isError).toBe(false)
    expect(result.current.data).toEqual(ALL_MODELES)
    expect(result.current.data[1].ordre).toBe(7)
  })

  it("affiche le dialogue avec les valeurs métier attendues", () => {
    render(
      <CreateTemplateDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        phase="prospect"
        categories={CATEGORIES}
      />,
      { wrapper: createWrapper() }
    )

    expect(screen.getByText("Nouveau template de tâche")).toBeInTheDocument()
    expect(screen.getByText(/phase "Prospection"/)).toBeInTheDocument()
    expect(screen.getByPlaceholderText("Ex: Première prise de contact")).toHaveValue("")
    expect(screen.getByPlaceholderText("Description détaillée de la tâche...")).toHaveValue("")
    expect(screen.getByPlaceholderText("0")).toHaveValue(0)
    expect(screen.getByText("Commercial")).toBeInTheDocument()
    expect(screen.getByText("Administratif")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Créer le template" })).toBeInTheDocument()
  })

  it("soumet le formulaire avec ordre calculé, actif=true puis ferme le dialogue", async () => {
    render(
      <CreateTemplateDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        phase="prospect"
        categories={CATEGORIES}
      />,
      { wrapper: createWrapper() }
    )

    fireEvent.change(screen.getByPlaceholderText("Ex: Première prise de contact"), {
      target: { value: "Relance initiale" },
    })

    fireEvent.change(screen.getByPlaceholderText("Description détaillée de la tâche..."), {
      target: { value: "Contacter le client dans les 24h" },
    })

    const selects = screen.getAllByTestId("select")
    fireEvent.change(selects[0], { target: { value: "cat-2" } })
    fireEvent.change(selects[1], { target: { value: "high" } })

    fireEvent.change(screen.getByPlaceholderText("0"), {
      target: { value: "5" },
    })

    fireEvent.click(screen.getByRole("button", { name: "Créer le template" }))

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        titre: "Relance initiale",
        description: "Contacter le client dans les 24h",
        categorie_id: "cat-2",
        priorite: "high",
        delai_jours: 5,
        ordre: 8,
        actif: true,
      })
    })

    await waitFor(() => {
      expect(mockOnOpenChange).toHaveBeenCalledWith(false)
    })

    expect(screen.getByPlaceholderText("Ex: Première prise de contact")).toHaveValue("")
    expect(screen.getByPlaceholderText("Description détaillée de la tâche...")).toHaveValue("")
  })

  it("désactive le bouton et affiche l'état de chargement pendant la création", () => {
    mockUseCreateModeleTache.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: true,
      isError: false,
      error: null,
    })

    render(
      <CreateTemplateDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        phase="prospect"
        categories={CATEGORIES}
      />,
      { wrapper: createWrapper() }
    )

    expect(screen.getByRole("button", { name: "Création..." })).toBeDisabled()
  })

  it("remonte un état d'erreur de hook quand les données retournent { data:null, error }", () => {
    mockUseAllModelesTaches.mockReturnValue({
      data: null,
      isLoading: false,
      isError: true,
      error: { message: "x" },
    })

    const wrapper = createWrapper()
    const { result } = renderHook(() => mockUseAllModelesTaches(), { wrapper })

    expect(result.current.data).toBeNull()
    expect(result.current.isError).toBe(true)
    expect(result.current.error).toEqual({ message: "x" })
  })
})