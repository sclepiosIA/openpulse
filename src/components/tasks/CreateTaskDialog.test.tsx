// @vitest-environment jsdom
import React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, fireEvent, waitFor, act, renderHook } from "@testing-library/react"

const {
  PROFILES,
  CATEGORIES,
  ETABLISSEMENT,
  TOAST_FN,
  MUTATE_ASYNC,
  DEBUG_ERROR,
  PHASE_NAME,
  ALLOWED_CATEGORIES,
  MUTATION_STATE,
} = vi.hoisted(() => ({
  PROFILES: [
    { id: "p1", prenom: "Alice", nom: "Martin" },
    { id: "p2", prenom: "Bob", nom: "Durand" },
  ],
  CATEGORIES: [
    { id: "c1", nom: "Administratif" },
    { id: "c2", nom: "Commercial" },
    { id: "c3", nom: "Technique" },
  ],
  ETABLISSEMENT: { id: "e1", statut: "prospection" },
  TOAST_FN: vi.fn(),
  MUTATE_ASYNC: vi.fn(),
  DEBUG_ERROR: vi.fn(),
  PHASE_NAME: "phase-prospection",
  ALLOWED_CATEGORIES: ["Administratif", "Commercial"],
  MUTATION_STATE: { isPending: false },
}))

vi.mock("@/lib/debug", () => ({
  debug: {
    error: DEBUG_ERROR,
  },
}))

vi.mock("@/lib/utils", () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" "),
}))

vi.mock("@/hooks/tasks/useTaches", () => ({
  useCreateTache: vi.fn(() => ({
    mutateAsync: MUTATE_ASYNC,
    get isPending() {
      return MUTATION_STATE.isPending
    },
  })),
}))

vi.mock("@/hooks/profile/useProfiles", () => ({
  useProfiles: vi.fn(() => ({ data: PROFILES })),
}))

vi.mock("@/hooks/catalogue/useCategories", () => ({
  useCategories: vi.fn(() => ({ data: CATEGORIES })),
}))

vi.mock("@/hooks/crm/useEtablissements", () => ({
  useEtablissement: vi.fn(() => ({ data: ETABLISSEMENT })),
}))

vi.mock("@/hooks/shared/use-toast", () => ({
  useToast: vi.fn(() => ({ toast: TOAST_FN })),
}))

vi.mock("@/config/phases", () => ({
  getPhaseByStatus: vi.fn(() => PHASE_NAME),
  getCumulativeCategoriesUpToPhase: vi.fn(() => ALLOWED_CATEGORIES),
}))

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    type = "button",
    onClick,
    disabled,
    className,
    variant,
  }: {
    children: React.ReactNode
    type?: "button" | "submit" | "reset"
    onClick?: React.MouseEventHandler<HTMLButtonElement>
    disabled?: boolean
    className?: string
    variant?: string
  }) => (
    <button type={type} onClick={onClick} disabled={disabled} className={className} data-variant={variant}>
      {children}
    </button>
  ),
}))

vi.mock("@/components/ui/input", () => ({
  Input: ({
    id,
    value,
    onChange,
    placeholder,
    required,
  }: {
    id?: string
    value?: string
    onChange?: React.ChangeEventHandler<HTMLInputElement>
    placeholder?: string
    required?: boolean
  }) => <input id={id} value={value} onChange={onChange} placeholder={placeholder} required={required} />,
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

vi.mock("@/components/ui/textarea", () => ({
  Textarea: ({
    id,
    value,
    onChange,
    placeholder,
    rows,
  }: {
    id?: string
    value?: string
    onChange?: React.ChangeEventHandler<HTMLTextAreaElement>
    placeholder?: string
    rows?: number
  }) => <textarea id={id} value={value} onChange={onChange} placeholder={placeholder} rows={rows} />,
}))

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({
    children,
  }: {
    children: React.ReactNode
    open: boolean
    onOpenChange: (open: boolean) => void
  }) => <div>{children}</div>,
  DialogTrigger: ({
    children,
  }: {
    children: React.ReactNode
    asChild?: boolean
  }) => <div>{children}</div>,
  DialogContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}))

vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => <div>{children}</div>,
  PopoverContent: ({ children }: { children: React.ReactNode; className?: string; align?: string }) => <div>{children}</div>,
}))

vi.mock("lucide-react", () => ({
  CalendarIcon: () => <svg data-testid="calendar-icon" />,
}))

vi.mock("@/components/ui/calendar", () => ({
  Calendar: ({
    onSelect,
  }: {
    mode?: string
    selected?: Date
    onSelect?: (date: Date | undefined) => void
    locale?: unknown
    initialFocus?: boolean
  }) => (
    <button type="button" onClick={() => onSelect?.(new Date("2025-05-20T00:00:00.000Z"))}>
      Choisir le 20 mai 2025
    </button>
  ),
}))

vi.mock("@/components/ui/select", () => {
  const SelectContext = React.createContext<{
    value?: string
    onValueChange?: (value: string) => void
  }>({})

  function Select({
    value,
    onValueChange,
    children,
  }: {
    value?: string
    onValueChange?: (value: string) => void
    children: React.ReactNode
  }) {
    return <SelectContext.Provider value={{ value, onValueChange }}>{children}</SelectContext.Provider>
  }

  function SelectTrigger({ children }: { children: React.ReactNode }) {
    return <div>{children}</div>
  }

  function SelectValue({ placeholder }: { placeholder?: string }) {
    return <span>{placeholder}</span>
  }

  function SelectContent({ children }: { children: React.ReactNode }) {
    return <div>{children}</div>
  }

  function SelectItem({
    value,
    children,
  }: {
    value: string
    children: React.ReactNode
  }) {
    const ctx = React.useContext(SelectContext)
    return (
      <button type="button" onClick={() => ctx.onValueChange?.(value)}>
        {children}
      </button>
    )
  }

  return {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
  }
})

import { CreateTaskDialog } from "./CreateTaskDialog"

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

describe("CreateTaskDialog", () => {
  beforeEach(() => {
    TOAST_FN.mockReset()
    MUTATE_ASYNC.mockReset()
    DEBUG_ERROR.mockReset()
    MUTATION_STATE.isPending = false
  })

  it("monte dans un QueryClientProvider sans erreur", () => {
    const wrapper = createWrapper()
    const { result } = renderHook(() => React.useState("ok"), { wrapper })
    expect(result.current[0]).toBe("ok")
  })

  it("affiche les champs, filtre les catégories selon la phase et montre les responsables", () => {
    const Wrapper = createWrapper()

    render(
      <Wrapper>
        <CreateTaskDialog etablissementId="e1" triggerButton={<button type="button">Ouvrir</button>} />
      </Wrapper>
    )

    expect(screen.getByText("Créer une nouvelle tâche")).toBeInTheDocument()
    expect(screen.getByLabelText("Titre *")).toBeInTheDocument()
    expect(screen.getByLabelText("Description")).toBeInTheDocument()
    expect(screen.getByText("Catégorie *")).toBeInTheDocument()
    expect(screen.getByText("Priorité")).toBeInTheDocument()
    expect(screen.getByText("Responsable")).toBeInTheDocument()

    expect(screen.getByText("Administratif")).toBeInTheDocument()
    expect(screen.getByText("Commercial")).toBeInTheDocument()
    expect(screen.queryByText("Technique")).not.toBeInTheDocument()

    expect(
      screen.getByText('Catégories limitées selon la phase "prospection" de l\'établissement')
    ).toBeInTheDocument()

    expect(screen.getByText("Non assigné")).toBeInTheDocument()
    expect(screen.getByText("Alice Martin")).toBeInTheDocument()
    expect(screen.getByText("Bob Durand")).toBeInTheDocument()
  })

  it("affiche une erreur toast si le titre est vide", async () => {
    const Wrapper = createWrapper()

    render(
      <Wrapper>
        <CreateTaskDialog etablissementId="e1" />
      </Wrapper>
    )

    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: "Créer la tâche" }).closest("form") as HTMLFormElement)
    })

    expect(TOAST_FN).toHaveBeenCalledWith({
      title: "Erreur",
      description: "Le titre est obligatoire",
      variant: "destructive",
    })
    expect(MUTATE_ASYNC).not.toHaveBeenCalled()
  })

  it("affiche une erreur toast si la catégorie est absente", async () => {
    const Wrapper = createWrapper()

    render(
      <Wrapper>
        <CreateTaskDialog etablissementId="e1" />
      </Wrapper>
    )

    fireEvent.change(screen.getByLabelText("Titre *"), { target: { value: "Préparer dossier" } })

    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: "Créer la tâche" }).closest("form") as HTMLFormElement)
    })

    expect(TOAST_FN).toHaveBeenCalledWith({
      title: "Erreur",
      description: "La catégorie est obligatoire",
      variant: "destructive",
    })
    expect(MUTATE_ASYNC).not.toHaveBeenCalled()
  })

  it("crée une tâche avec les valeurs métier attendues puis réinitialise le formulaire", async () => {
    MUTATE_ASYNC.mockResolvedValueOnce({ data: { id: "t1" }, error: null })
    const Wrapper = createWrapper()

    render(
      <Wrapper>
        <CreateTaskDialog etablissementId="e1" />
      </Wrapper>
    )

    fireEvent.change(screen.getByLabelText("Titre *"), { target: { value: "  Appeler le client  " } })
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "  Confirmer le rendez-vous  " } })
    fireEvent.click(screen.getByText("Commercial"))
    fireEvent.click(screen.getByText("Haute"))
    fireEvent.click(screen.getByText("Choisir le 20 mai 2025"))
    fireEvent.click(screen.getByText("Bob Durand"))

    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: "Créer la tâche" }).closest("form") as HTMLFormElement)
    })

    expect(MUTATE_ASYNC).toHaveBeenCalledWith({
      etablissement_id: "e1",
      titre: "Appeler le client",
      description: "Confirmer le rendez-vous",
      priorite: "high",
      statut: "A faire",
      categorie_id: "c2",
      echeance: "2025-05-20",
      responsable_id: "p2",
      ordre: 999,
    })

    expect(TOAST_FN).toHaveBeenCalledWith({
      title: "Tâche créée",
      description: "La nouvelle tâche a été ajoutée avec succès",
    })

    await waitFor(() => {
      expect(screen.getByLabelText("Titre *")).toHaveValue("")
      expect(screen.getByLabelText("Description")).toHaveValue("")
    })
  })

  it("envoie responsable_id à undefined quand aucun responsable n'est assigné", async () => {
    MUTATE_ASYNC.mockResolvedValueOnce({ data: { id: "t2" }, error: null })
    const Wrapper = createWrapper()

    render(
      <Wrapper>
        <CreateTaskDialog etablissementId="e1" />
      </Wrapper>
    )

    fireEvent.change(screen.getByLabelText("Titre *"), { target: { value: "Créer devis" } })
    fireEvent.click(screen.getByText("Administratif"))

    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: "Créer la tâche" }).closest("form") as HTMLFormElement)
    })

    expect(MUTATE_ASYNC).toHaveBeenCalledWith({
      etablissement_id: "e1",
      titre: "Créer devis",
      description: undefined,
      priorite: "medium",
      statut: "A faire",
      categorie_id: "c1",
      echeance: undefined,
      responsable_id: undefined,
      ordre: 999,
    })
  })

  it("affiche l'état de chargement sur le bouton pendant la mutation", () => {
    MUTATION_STATE.isPending = true
    const Wrapper = createWrapper()

    render(
      <Wrapper>
        <CreateTaskDialog etablissementId="e1" />
      </Wrapper>
    )

    expect(screen.getByRole("button", { name: "Création..." })).toBeDisabled()
  })

  it("gère l'erreur de création avec debug et toast destructif", async () => {
    const error = new Error("x")
    MUTATE_ASYNC.mockRejectedValueOnce(error)
    const Wrapper = createWrapper()

    render(
      <Wrapper>
        <CreateTaskDialog etablissementId="e1" />
      </Wrapper>
    )

    fireEvent.change(screen.getByLabelText("Titre *"), { target: { value: "Relancer prospect" } })
    fireEvent.click(screen.getByText("Commercial"))

    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: "Créer la tâche" }).closest("form") as HTMLFormElement)
    })

    expect(DEBUG_ERROR).toHaveBeenCalledWith("Erreur lors de la création:", error)
    expect(TOAST_FN).toHaveBeenCalledWith({
      title: "Erreur",
      description: "Impossible de créer la tâche",
      variant: "destructive",
    })
  })
})