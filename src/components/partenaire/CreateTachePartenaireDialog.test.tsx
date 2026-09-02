// @vitest-environment jsdom
import React from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { CreateTachePartenaireDialog } from "./CreateTachePartenaireDialog"

const {
  profilesData,
  categoriesData,
  toastSpy,
  mutateAsyncSpy,
  debugErrorSpy,
} = vi.hoisted(() => ({
  profilesData: [
    { id: "p1", prenom: "Jean", nom: "Dupont" },
    { id: "p2", prenom: "Marie", nom: "Curie" },
  ],
  categoriesData: [
    { id: "c1", nom: "Support" },
    { id: "c2", nom: "Maintenance" },
  ],
  toastSpy: vi.fn(),
  mutateAsyncSpy: vi.fn(),
  debugErrorSpy: vi.fn(),
}))

vi.mock("@/lib/debug", () => ({
  debug: {
    error: debugErrorSpy,
  },
}))

vi.mock("@/lib/utils", () => ({
  cn: (...args: Array<string | false | null | undefined>) => args.filter(Boolean).join(" "),
}))

vi.mock("@/hooks/shared/use-toast", () => ({
  useToast: () => ({
    toast: toastSpy,
  }),
}))

vi.mock("@/hooks/profile/useProfiles", () => ({
  useProfiles: () => ({
    data: profilesData,
    isLoading: false,
    isError: false,
  }),
}))

vi.mock("@/hooks/catalogue/useCategories", () => ({
  useCategories: () => ({
    data: categoriesData,
    isLoading: false,
    isError: false,
  }),
}))

vi.mock("@/hooks/tasks/useTachesPartenaire", () => ({
  useCreateTachePartenaire: () => ({
    mutateAsync: mutateAsyncSpy,
    isPending: false,
    isError: false,
  }),
}))

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h1>{children}</h1>,
}))

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    type = "button",
    onClick,
    disabled,
    className,
  }: {
    children: React.ReactNode
    type?: "button" | "submit" | "reset"
    onClick?: React.MouseEventHandler<HTMLButtonElement>
    disabled?: boolean
    className?: string
  }) => (
    <button type={type} onClick={onClick} disabled={disabled} className={className}>
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
  }: {
    id?: string
    value?: string
    onChange?: React.ChangeEventHandler<HTMLInputElement>
    placeholder?: string
  }) => <input id={id} value={value} onChange={onChange} placeholder={placeholder} />,
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
  }: {
    id?: string
    value?: string
    onChange?: React.ChangeEventHandler<HTMLTextAreaElement>
    placeholder?: string
  }) => <textarea id={id} value={value} onChange={onChange} placeholder={placeholder} />,
}))

vi.mock("@/components/ui/select", () => {
  const ReactLocal = React
  return {
    Select: ({
      value,
      onValueChange,
      children,
    }: {
      value?: string
      onValueChange?: (value: string) => void
      children: React.ReactNode
    }) => {
      const items: Array<{ value: string; label: string }> = []

      const collect = (node: React.ReactNode): void => {
        ReactLocal.Children.forEach(node, (child) => {
          if (!ReactLocal.isValidElement(child)) return
          const props = child.props as { children?: React.ReactNode; value?: string }
          if (typeof props.value === "string") {
            const label =
              typeof props.children === "string"
                ? props.children
                : ReactLocal.Children.toArray(props.children).join("")
            items.push({ value: props.value, label })
          }
          if (props.children) collect(props.children)
        })
      }

      collect(children)

      return (
        <select
          data-testid="select"
          value={value}
          onChange={(e) => onValueChange?.(e.target.value)}
        >
          {items.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      )
    },
    SelectTrigger: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
    SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    SelectItem: ({
      children,
      value,
    }: {
      children: React.ReactNode
      value: string
    }) => <option value={value}>{children}</option>,
  }
})

vi.mock("@/components/ui/calendar", () => ({
  Calendar: ({
    onSelect,
  }: {
    onSelect?: (date: Date | undefined) => void
  }) => (
    <button type="button" onClick={() => onSelect?.(new Date("2025-03-15T00:00:00.000Z"))}>
      pick-date
    </button>
  ),
}))

vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("lucide-react", () => ({
  CalendarIcon: () => <svg data-testid="calendar-icon" />,
}))

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

describe("CreateTachePartenaireDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("affiche les champs, catégories et responsables", () => {
    renderWithClient(
      <CreateTachePartenaireDialog
        partenaireId="partner-1"
        triggerButton={<button>Ouvrir</button>}
      />,
    )

    expect(screen.getByText("Créer une nouvelle tâche partenaire")).toBeInTheDocument()
    expect(screen.getByLabelText("Titre *")).toHaveValue("")
    expect(screen.getByLabelText("Description")).toHaveValue("")
    expect(screen.getByText("Support")).toBeInTheDocument()
    expect(screen.getByText("Maintenance")).toBeInTheDocument()
    expect(screen.getByText("Jean Dupont")).toBeInTheDocument()
    expect(screen.getByText("Marie Curie")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Créer la tâche" })).toBeInTheDocument()
  })

  it("affiche une erreur toast si le titre est vide", async () => {
    renderWithClient(
      <CreateTachePartenaireDialog
        partenaireId="partner-1"
        triggerButton={<button>Ouvrir</button>}
      />,
    )

    const selects = screen.getAllByTestId("select")
    fireEvent.change(selects[0], { target: { value: "c1" } })
    fireEvent.click(screen.getByRole("button", { name: "Créer la tâche" }))

    await waitFor(() => {
      expect(toastSpy).toHaveBeenCalledWith({
        title: "Erreur",
        description: "Le titre est obligatoire",
        variant: "destructive",
      })
    })

    expect(mutateAsyncSpy).not.toHaveBeenCalled()
  })

  it("affiche une erreur toast si la catégorie est absente", async () => {
    renderWithClient(
      <CreateTachePartenaireDialog
        partenaireId="partner-1"
        triggerButton={<button>Ouvrir</button>}
      />,
    )

    fireEvent.change(screen.getByLabelText("Titre *"), { target: { value: "  Nouvelle tâche  " } })
    fireEvent.click(screen.getByRole("button", { name: "Créer la tâche" }))

    await waitFor(() => {
      expect(toastSpy).toHaveBeenCalledWith({
        title: "Erreur",
        description: "La catégorie est obligatoire",
        variant: "destructive",
      })
    })

    expect(mutateAsyncSpy).not.toHaveBeenCalled()
  })

  it("soumet les valeurs métier formatées et affiche un toast de succès", async () => {
    mutateAsyncSpy.mockResolvedValueOnce({ id: "task-1" })

    renderWithClient(
      <CreateTachePartenaireDialog
        partenaireId="partner-42"
        triggerButton={<button>Ouvrir</button>}
      />,
    )

    fireEvent.change(screen.getByLabelText("Titre *"), { target: { value: "  Relancer partenaire  " } })
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "  Envoyer un récapitulatif  " },
    })

    const selects = screen.getAllByTestId("select")
    fireEvent.change(selects[0], { target: { value: "c2" } })
    fireEvent.change(selects[1], { target: { value: "high" } })
    fireEvent.click(screen.getByRole("button", { name: "pick-date" }))
    fireEvent.change(selects[2], { target: { value: "p2" } })

    fireEvent.click(screen.getByRole("button", { name: "Créer la tâche" }))

    await waitFor(() => {
      expect(mutateAsyncSpy).toHaveBeenCalledWith({
        partenaire_id: "partner-42",
        titre: "Relancer partenaire",
        description: "Envoyer un récapitulatif",
        priorite: "high",
        categorie_id: "c2",
        echeance: "2025-03-15",
        responsable_id: "p2",
      })
    })

    expect(toastSpy).toHaveBeenCalledWith({
      title: "Tâche créée",
      description: "La nouvelle tâche a été ajoutée avec succès",
    })

    expect(screen.getByLabelText("Titre *")).toHaveValue("")
    expect(screen.getByLabelText("Description")).toHaveValue("")
  })

  it("envoie responsable_id undefined si non assigné et description undefined si vide", async () => {
    mutateAsyncSpy.mockResolvedValueOnce({ id: "task-2" })

    renderWithClient(
      <CreateTachePartenaireDialog
        partenaireId="partner-77"
        triggerButton={<button>Ouvrir</button>}
      />,
    )

    fireEvent.change(screen.getByLabelText("Titre *"), { target: { value: "Créer devis" } })

    const selects = screen.getAllByTestId("select")
    fireEvent.change(selects[0], { target: { value: "c1" } })

    fireEvent.click(screen.getByRole("button", { name: "Créer la tâche" }))

    await waitFor(() => {
      expect(mutateAsyncSpy).toHaveBeenCalledWith({
        partenaire_id: "partner-77",
        titre: "Créer devis",
        description: undefined,
        priorite: "medium",
        categorie_id: "c1",
        echeance: undefined,
        responsable_id: undefined,
      })
    })
  })

  it("gère une erreur de création avec debug et toast destructif", async () => {
    const failure = new Error("x")
    mutateAsyncSpy.mockRejectedValueOnce(failure)

    renderWithClient(
      <CreateTachePartenaireDialog
        partenaireId="partner-9"
        triggerButton={<button>Ouvrir</button>}
      />,
    )

    fireEvent.change(screen.getByLabelText("Titre *"), { target: { value: "Appeler client" } })

    const selects = screen.getAllByTestId("select")
    fireEvent.change(selects[0], { target: { value: "c1" } })

    fireEvent.click(screen.getByRole("button", { name: "Créer la tâche" }))

    await waitFor(() => {
      expect(debugErrorSpy).toHaveBeenCalledWith("Erreur lors de la création:", failure)
    })

    expect(toastSpy).toHaveBeenCalledWith({
      title: "Erreur",
      description: "Impossible de créer la tâche",
      variant: "destructive",
    })
  })
})