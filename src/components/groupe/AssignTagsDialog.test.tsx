// @vitest-environment jsdom
import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { AssignTagsDialog } from "./AssignTagsDialog"

const {
  stableToast,
  stableUseToast,
  stableGroupes,
  stableOpenChange,
  stableAssignTags,
} = vi.hoisted(() => ({
  stableToast: vi.fn(),
  stableUseToast: vi.fn(),
  stableGroupes: [
    { id: "g1", nom: "Alpha" },
    { id: "g2", nom: "Beta" },
    { id: "g3", nom: "Gamma" },
    { id: "g4", nom: "Delta" },
  ],
  stableOpenChange: vi.fn(),
  stableAssignTags: vi.fn(),
}))

vi.mock("@/hooks/shared/use-toast", () => {
  stableUseToast.mockReturnValue({ toast: stableToast })
  return {
    useToast: stableUseToast,
  }
})

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({
    open,
    children,
  }: {
    open: boolean
    onOpenChange?: (open: boolean) => void
    children: React.ReactNode
  }) => (open ? <div data-testid="dialog-root">{children}</div> : null),
  DialogContent: ({
    children,
    className,
  }: {
    children: React.ReactNode
    className?: string
  }) => <div data-testid="dialog-content" className={className}>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    type,
    ariaLabel,
    "aria-label": ariaLabelProp,
  }: {
    children: React.ReactNode
    onClick?: () => void
    disabled?: boolean
    type?: "button" | "submit" | "reset"
    ariaLabel?: string
    "aria-label"?: string
  }) => (
    <button type={type ?? "button"} onClick={onClick} disabled={disabled} aria-label={ariaLabelProp ?? ariaLabel}>
      {children}
    </button>
  ),
}))

vi.mock("@/components/ui/input", () => ({
  Input: ({
    value,
    onChange,
    onKeyDown,
    placeholder,
  }: {
    value?: string
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
    onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void
    placeholder?: string
  }) => (
    <input
      value={value}
      onChange={onChange}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
    />
  ),
}))

vi.mock("@/components/ui/badge", () => ({
  Badge: ({
    children,
    onClick,
    variant,
    className,
  }: {
    children: React.ReactNode
    onClick?: () => void
    variant?: string
    className?: string
  }) => (
    <button data-variant={variant} className={className} onClick={onClick} type="button">
      {children}
    </button>
  ),
}))

vi.mock("lucide-react", () => ({
  X: ({
    onClick,
    className,
  }: {
    onClick?: () => void
    className?: string
  }) => <button type="button" aria-label="remove-tag" className={className} onClick={onClick}>x</button>,
  Plus: () => <span>+</span>,
}))

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })
}

function renderDialog(
  props?: Partial<React.ComponentProps<typeof AssignTagsDialog>>
) {
  const queryClient = createTestQueryClient()

  return render(
    <QueryClientProvider client={queryClient}>
      <AssignTagsDialog
        open={true}
        onOpenChange={stableOpenChange}
        selectedGroupes={stableGroupes}
        onAssignTags={stableAssignTags}
        {...props}
      />
    </QueryClientProvider>
  )
}

describe("AssignTagsDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    stableUseToast.mockReturnValue({ toast: stableToast })
  })

  it("affiche le titre, les tags prédéfinis, l'aperçu des groupes et l'état initial désactivé", () => {
    renderDialog()

    expect(screen.getByText("Assigner des tags à 4 groupes")).toBeInTheDocument()
    expect(screen.getByText("Tags prédéfinis")).toBeInTheDocument()
    expect(screen.getByText("Prioritaire")).toBeInTheDocument()
    expect(screen.getByText("En retard")).toBeInTheDocument()
    expect(screen.getByText("À surveiller")).toBeInTheDocument()
    expect(screen.getByText("Nouveau client")).toBeInTheDocument()
    expect(screen.getByText("Alpha, Beta, Gamma et 1 autre(s)")).toBeInTheDocument()

    const assignButton = screen.getByRole("button", { name: "Assigner les tags" })
    expect(assignButton).toBeDisabled()

    const addButton = screen.getByRole("button", { name: "Ajouter" })
    expect(addButton).toBeDisabled()
  })

  it("permet de sélectionner un tag prédéfini puis de l'assigner avec fermeture et toast de succès", async () => {
    const user = userEvent.setup()
    renderDialog()

    await user.click(screen.getByText("Prioritaire"))

    expect(screen.getByText("Tags sélectionnés (1)")).toBeInTheDocument()
    expect(screen.getAllByText("Prioritaire").length).toBeGreaterThan(0)

    const assignButton = screen.getByRole("button", { name: "Assigner les tags" })
    expect(assignButton).not.toBeDisabled()

    await user.click(assignButton)

    expect(stableAssignTags).toHaveBeenCalledTimes(1)
    expect(stableAssignTags).toHaveBeenCalledWith(["Prioritaire"])
    expect(stableOpenChange).toHaveBeenCalledWith(false)
    expect(stableToast).toHaveBeenCalledWith({
      title: "Tags assignés",
      description: "1 tag(s) assigné(s) à 4 groupe(s)",
    })

    expect(screen.queryByText("Tags sélectionnés (1)")).not.toBeInTheDocument()
  })

  it("permet d'ajouter un tag personnalisé via le bouton puis de le retirer", async () => {
    const user = userEvent.setup()
    renderDialog()

    const input = screen.getByPlaceholderText("Nom du tag...")
    const addButton = screen.getByRole("button", { name: "Ajouter" })

    await user.type(input, "VIP")
    expect(addButton).not.toBeDisabled()

    await user.click(addButton)

    expect(screen.getByText("Tags sélectionnés (1)")).toBeInTheDocument()
    expect(screen.getByDisplayValue("")).toBeInTheDocument()
    expect(screen.getAllByText("VIP").length).toBeGreaterThan(0)

    await user.click(screen.getByRole("button", { name: "remove-tag" }))

    expect(screen.queryByText("Tags sélectionnés (1)")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Assigner les tags" })).toBeDisabled()
  })

  it("ajoute un tag personnalisé avec Entrée sans dupliquer un tag existant", async () => {
    renderDialog()

    const input = screen.getByPlaceholderText("Nom du tag...") as HTMLInputElement

    fireEvent.change(input, { target: { value: "Urgent" } })
    fireEvent.keyDown(input, { key: "Enter", code: "Enter", charCode: 13 })

    expect(screen.getByText("Tags sélectionnés (1)")).toBeInTheDocument()
    expect(screen.getAllByText("Urgent").length).toBeGreaterThan(0)
    expect(input.value).toBe("")

    fireEvent.change(input, { target: { value: "Urgent" } })
    fireEvent.keyDown(input, { key: "Enter", code: "Enter", charCode: 13 })

    expect(screen.getByText("Tags sélectionnés (1)")).toBeInTheDocument()
    expect(screen.getAllByText("Urgent").length).toBeGreaterThan(0)
  })

  it("bascule un tag prédéfini au second clic", async () => {
    const user = userEvent.setup()
    renderDialog()

    const predefinedTag = screen.getByText("En retard")

    await user.click(predefinedTag)
    expect(screen.getByText("Tags sélectionnés (1)")).toBeInTheDocument()

    await user.click(screen.getAllByText("En retard")[0])
    expect(screen.queryByText("Tags sélectionnés (1)")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Assigner les tags" })).toBeDisabled()
  })

  it("ferme le dialogue avec Annuler", async () => {
    const user = userEvent.setup()
    renderDialog()

    await user.click(screen.getByRole("button", { name: "Annuler" }))

    expect(stableOpenChange).toHaveBeenCalledTimes(1)
    expect(stableOpenChange).toHaveBeenCalledWith(false)
    expect(stableAssignTags).not.toHaveBeenCalled()
  })

  it("n'affiche rien quand open vaut false", () => {
    renderDialog({ open: false })

    expect(screen.queryByTestId("dialog-root")).not.toBeInTheDocument()
    expect(screen.queryByText("Assigner des tags à 4 groupes")).not.toBeInTheDocument()
  })

  it("gère le cas singulier pour un seul groupe", () => {
    renderDialog({
      selectedGroupes: [{ id: "g1", nom: "Alpha" }],
    })

    expect(screen.getByText("Assigner des tags à 1 groupe")).toBeInTheDocument()
    expect(screen.getByText("Alpha")).toBeInTheDocument()
  })

  it("n'assigne pas si aucun tag n'est sélectionné et le bouton reste désactivé", () => {
    renderDialog()

    const assignButton = screen.getByRole("button", { name: "Assigner les tags" })
    expect(assignButton).toBeDisabled()

    expect(stableAssignTags).not.toHaveBeenCalled()
    expect(stableToast).not.toHaveBeenCalled()
  })
})