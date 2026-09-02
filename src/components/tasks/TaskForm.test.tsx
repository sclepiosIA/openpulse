// @vitest-environment jsdom
import React from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook } from "@testing-library/react"
import { TaskForm } from "./TaskForm"

const {
  PROFILES,
  AUTH_STATE,
  mockMutateAsync,
  mockUseUpdateTache,
  mockUseProfiles,
  mockDebugError,
  mockNavigate,
  mockFrom,
} = vi.hoisted(() => {
  const PROFILES = [
    { id: "p1", prenom: "Jean", nom: "Dupont" },
    { id: "p2", prenom: "Marie", nom: "Curie" },
  ]

  const AUTH_STATE = {
    user: { id: "u1", email: "t@t.co" },
    session: { user: { id: "u1" } },
    isLoading: false,
  }

  const mockMutateAsync = vi.fn()
  const mockUseUpdateTache = vi.fn()
  const mockUseProfiles = vi.fn()
  const mockDebugError = vi.fn()
  const mockNavigate = vi.fn()

  const createBuilder = () => {
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
      single: vi.fn(async () => ({ data: null, error: null })),
      maybeSingle: vi.fn(async () => ({ data: null, error: null })),
      then: (onFulfilled: (value: { data: null; error: null }) => unknown) =>
        Promise.resolve({ data: null, error: null }).then(onFulfilled),
      catch: (onRejected: (reason: unknown) => unknown) =>
        Promise.resolve({ data: null, error: null }).catch(onRejected),
    }
    return builder
  }

  const mockFrom = vi.fn(() => createBuilder())

  return {
    PROFILES,
    AUTH_STATE,
    mockMutateAsync,
    mockUseUpdateTache,
    mockUseProfiles,
    mockDebugError,
    mockNavigate,
    mockFrom,
  }
})

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
    auth: {
      getSession: vi.fn(async () => ({ data: { session: AUTH_STATE.session }, error: null })),
      getUser: vi.fn(async () => ({ data: { user: AUTH_STATE.user }, error: null })),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
  },
}))

vi.mock("@/lib/debug", () => ({
  debug: {
    error: mockDebugError,
    log: vi.fn(),
    warn: vi.fn(),
  },
}))

vi.mock("@/lib/utils", () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" "),
}))

vi.mock("@/hooks/tasks/useTaches", () => ({
  useUpdateTache: mockUseUpdateTache,
}))

vi.mock("@/hooks/profile/useProfiles", () => ({
  useProfiles: mockUseProfiles,
}))

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => AUTH_STATE,
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => AUTH_STATE,
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom")
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock("lucide-react", () => ({
  CalendarIcon: () => <svg data-testid="calendar-icon" />,
  Edit: () => <svg data-testid="edit-icon" />,
  UserPlus: () => <svg data-testid="userplus-icon" />,
}))

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    type = "button",
    disabled,
    className,
    variant,
    size,
  }: {
    children: React.ReactNode
    onClick?: React.MouseEventHandler<HTMLButtonElement>
    type?: "button" | "submit" | "reset"
    disabled?: boolean
    className?: string
    variant?: string
    size?: string
  }) => (
    <button type={type} onClick={onClick} disabled={disabled} className={className} data-variant={variant} data-size={size}>
      {children}
    </button>
  ),
}))

vi.mock("@/components/ui/input", () => ({
  Input: ({
    id,
    value,
    onChange,
    required,
  }: {
    id?: string
    value?: string
    onChange?: React.ChangeEventHandler<HTMLInputElement>
    required?: boolean
  }) => <input id={id} value={value} onChange={onChange} required={required} />,
}))

vi.mock("@/components/ui/textarea", () => ({
  Textarea: ({
    id,
    value,
    onChange,
    rows,
  }: {
    id?: string
    value?: string
    onChange?: React.ChangeEventHandler<HTMLTextAreaElement>
    rows?: number
  }) => <textarea id={id} value={value} onChange={onChange} rows={rows} />,
}))

vi.mock("@/components/ui/label", () => ({
  Label: ({
    children,
    htmlFor,
  }: {
    children: React.ReactNode
    htmlFor?: string
  }) => <label htmlFor={htmlFor}>{children}</label>,
}))

vi.mock("@/components/ui/dialog", () => {
  const DialogContext = React.createContext<{
    open: boolean
    onOpenChange: (open: boolean) => void
  }>({ open: false, onOpenChange: () => undefined })

  return {
    Dialog: ({
      open,
      onOpenChange,
      children,
    }: {
      open: boolean
      onOpenChange: (open: boolean) => void
      children: React.ReactNode
    }) => <DialogContext.Provider value={{ open, onOpenChange }}>{children}</DialogContext.Provider>,
    DialogTrigger: ({
      children,
    }: {
      children: React.ReactElement<{ onClick?: React.MouseEventHandler }>
      asChild?: boolean
    }) => {
      const ctx = React.useContext(DialogContext)
      return React.cloneElement(children, {
        onClick: (e: React.MouseEvent) => {
          children.props.onClick?.(e)
          ctx.onOpenChange(true)
        },
      })
    },
    DialogContent: ({ children }: { children: React.ReactNode; className?: string }) => {
      const ctx = React.useContext(DialogContext)
      return ctx.open ? <div>{children}</div> : null
    },
    DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  }
})

vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => <>{children}</>,
  PopoverContent: ({ children }: { children: React.ReactNode; className?: string }) => <div>{children}</div>,
}))

vi.mock("@/components/ui/calendar", () => ({
  Calendar: ({
    onSelect,
  }: {
    mode: string
    selected?: Date
    onSelect?: (date: Date) => void
    initialFocus?: boolean
  }) => (
    <button type="button" onClick={() => onSelect?.(new Date("2024-06-15T00:00:00.000Z"))}>
      Choisir le 15 juin 2024
    </button>
  ),
}))

vi.mock("@/components/ui/select", () => {
  const SelectContext = React.createContext<{
    value: string
    onValueChange: (value: string) => void
  }>({ value: "", onValueChange: () => undefined })

  return {
    Select: ({
      value,
      onValueChange,
      children,
    }: {
      value: string
      onValueChange: (value: string) => void
      children: React.ReactNode
    }) => <SelectContext.Provider value={{ value, onValueChange }}>{children}</SelectContext.Provider>,
    SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    SelectValue: ({ placeholder }: { placeholder?: string }) => {
      const ctx = React.useContext(SelectContext)
      return <span>{ctx.value || placeholder}</span>
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
        <button type="button" onClick={() => ctx.onValueChange(value)}>
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

describe("TaskForm", () => {
  const tache = {
    id: "task-1",
    titre: "Préparer le dossier",
    description: "Rassembler les pièces",
    priorite: "medium" as const,
    echeance: "2024-05-10",
    responsable_id: "p1",
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseProfiles.mockReturnValue({ data: PROFILES, isLoading: false, isError: false, error: null })
    mockUseUpdateTache.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
      isError: false,
      error: null,
    })
  })

  it("expose un état de chargement puis succès puis erreur via les hooks mockés avec renderHook", async () => {
    const wrapper = createWrapper()

    mockUseProfiles
      .mockReturnValueOnce({ data: undefined, isLoading: true, isError: false, error: null })
      .mockReturnValueOnce({ data: PROFILES, isLoading: false, isError: false, error: null })
      .mockReturnValueOnce({ data: null, isLoading: false, isError: true, error: { message: "x" } })

    const loadingHook = renderHook(() => mockUseProfiles(), { wrapper })
    expect(loadingHook.result.current.isLoading).toBe(true)
    expect(loadingHook.result.current.data).toBeUndefined()

    const successHook = renderHook(() => mockUseProfiles(), { wrapper })
    expect(successHook.result.current.isLoading).toBe(false)
    expect(successHook.result.current.isError).toBe(false)
    expect(successHook.result.current.data).toEqual(PROFILES)
    expect(successHook.result.current.data[0]).toMatchObject({
      id: "p1",
      prenom: "Jean",
      nom: "Dupont",
    })

    const errorHook = renderHook(() => mockUseProfiles(), { wrapper })
    expect(errorHook.result.current.isError).toBe(true)
    expect(errorHook.result.current.error).toEqual({ message: "x" })
    expect(errorHook.result.current.data).toBeNull()
  })

  it("soumet en mode edit avec les valeurs métier modifiées et ferme la boîte", async () => {
    mockMutateAsync.mockResolvedValue({ data: { id: "task-1" }, error: null })

    render(<TaskForm tache={tache} mode="edit" />)

    fireEvent.click(screen.getByRole("button", { name: /modifier/i }))

    expect(screen.getByText("Modifier la tâche")).toBeInTheDocument()
    expect(screen.getByDisplayValue("Préparer le dossier")).toBeInTheDocument()
    expect(screen.getByDisplayValue("Rassembler les pièces")).toBeInTheDocument()
    expect(screen.getByText("Jean Dupont")).toBeInTheDocument()
    expect(screen.getByText("Marie Curie")).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText("Titre"), { target: { value: "Dossier finalisé" } })
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Pièces vérifiées et classées" } })

    fireEvent.click(screen.getByRole("button", { name: "Haute" }))
    fireEvent.click(screen.getByRole("button", { name: "Choisir le 15 juin 2024" }))
    fireEvent.click(screen.getByRole("button", { name: "Marie Curie" }))

    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }))

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        id: "task-1",
        data: {
          titre: "Dossier finalisé",
          description: "Pièces vérifiées et classées",
          priorite: "high",
          echeance: "2024-06-15",
          responsable_id: "p2",
        },
      })
    })

    await waitFor(() => {
      expect(screen.queryByText("Modifier la tâche")).not.toBeInTheDocument()
    })
  })

  it("soumet en mode assign sans envoyer les champs d'édition et convertit 'none' en undefined", async () => {
    mockMutateAsync.mockResolvedValue({ data: { id: "task-1" }, error: null })

    render(<TaskForm tache={tache} mode="assign" />)

    fireEvent.click(screen.getByRole("button", { name: /assigner/i }))

    expect(screen.getByText("Assigner la tâche")).toBeInTheDocument()
    expect(screen.queryByLabelText("Titre")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Description")).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Aucun responsable" }))
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }))

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        id: "task-1",
        data: {
          echeance: "2024-05-10",
          responsable_id: undefined,
        },
      })
    })
  })

  it("affiche l'état pending sur le bouton de soumission", () => {
    mockUseUpdateTache.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: true,
      isError: false,
      error: null,
    })

    render(<TaskForm tache={tache} mode="edit" />)

    fireEvent.click(screen.getByRole("button", { name: /modifier/i }))

    const submitButton = screen.getByRole("button", { name: "Enregistrement..." })
    expect(submitButton).toBeDisabled()
  })

  it("journalise l'erreur si la mutation échoue et laisse la boîte ouverte", async () => {
    const failure = new Error("mise à jour impossible")
    mockMutateAsync.mockRejectedValue(failure)

    render(<TaskForm tache={tache} mode="edit" />)

    fireEvent.click(screen.getByRole("button", { name: /modifier/i }))
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }))

    await waitFor(() => {
      expect(mockDebugError).toHaveBeenCalledWith("Erreur lors de la mise à jour:", failure)
    })

    expect(screen.getByText("Modifier la tâche")).toBeInTheDocument()
  })
})