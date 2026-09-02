/* @vitest-environment jsdom */
import React from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { PartenaireTaches } from "./PartenaireTaches"

const {
  TASKS,
  CATEGORIES,
  toastSpy,
  mutateUpdateAsync,
  mutateArchiveAsync,
  cardPropsSpy,
  createDialogSpy,
  debugErrorSpy,
} = vi.hoisted(() => ({
  TASKS: [
    {
      id: "t1",
      titre: "Préparer dossier",
      description: "documents urgents",
      categorie_id: "cat-1",
      priorite: "low",
      statut: "A faire",
      archive: false,
      created_at: "2024-01-01T10:00:00.000Z",
      echeance: "2024-06-20",
      date_realisation: null,
    },
    {
      id: "t2",
      titre: "Valider contrat",
      description: "suivi client",
      categorie_id: "cat-2",
      priorite: "high",
      statut: "En cours",
      archive: false,
      created_at: "2024-02-01T10:00:00.000Z",
      echeance: "2024-06-10",
      date_realisation: null,
    },
    {
      id: "t3",
      titre: "Ancienne tâche",
      description: "archivee",
      categorie_id: "cat-1",
      priorite: "medium",
      statut: "Terminé",
      archive: true,
      created_at: "2023-12-01T10:00:00.000Z",
      echeance: null,
      date_realisation: "2024-01-15",
    },
  ],
  CATEGORIES: [
    { id: "cat-1", nom: "Administratif" },
    { id: "cat-2", nom: "Commercial" },
  ],
  toastSpy: vi.fn(),
  mutateUpdateAsync: vi.fn(),
  mutateArchiveAsync: vi.fn(),
  cardPropsSpy: vi.fn(),
  createDialogSpy: vi.fn(),
  debugErrorSpy: vi.fn(),
}))

vi.mock("@/lib/debug", () => ({
  debug: {
    error: debugErrorSpy,
    log: vi.fn(),
    warn: vi.fn(),
  },
}))

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-content" className={className}>
      {children}
    </div>
  ),
}))

vi.mock("@/components/ui/button", () => ({
  Button: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
}))

vi.mock("@/components/ui/input", () => ({
  Input: ({
    value,
    onChange,
    placeholder,
    className,
  }: {
    value?: string
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
    placeholder?: string
    className?: string
  }) => (
    <input
      data-testid="search-input"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={className}
    />
  ),
}))

vi.mock("@/components/ui/label", () => ({
  Label: ({ children, htmlFor, className }: { children: React.ReactNode; htmlFor?: string; className?: string }) => (
    <label htmlFor={htmlFor} className={className}>
      {children}
    </label>
  ),
}))

vi.mock("@/components/ui/switch", () => ({
  Switch: ({
    checked,
    onCheckedChange,
    id,
  }: {
    checked?: boolean
    onCheckedChange?: (v: boolean) => void
    id?: string
  }) => (
    <button
      data-testid="archive-switch"
      id={id}
      aria-pressed={checked}
      onClick={() => onCheckedChange?.(!checked)}
    >
      {checked ? "on" : "off"}
    </button>
  ),
}))

vi.mock("@/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value?: string
    onValueChange?: (value: string) => void
    children: React.ReactNode
  }) => (
    <div data-testid="select-root" data-value={value}>
      {React.Children.map(children, (child) =>
        React.isValidElement(child) ? React.cloneElement(child, { onValueChange } as Record<string, unknown>) : child,
      )}
    </div>
  ),
  SelectTrigger: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
  SelectContent: ({
    children,
    onValueChange,
  }: {
    children: React.ReactNode
    onValueChange?: (value: string) => void
  }) => <div>{React.Children.map(children, (child) => React.isValidElement(child) ? React.cloneElement(child, { onValueChange } as Record<string, unknown>) : child)}</div>,
  SelectItem: ({
    value,
    children,
    onValueChange,
  }: {
    value: string
    children: React.ReactNode
    onValueChange?: (value: string) => void
  }) => (
    <button data-testid={`select-item-${value}`} onClick={() => onValueChange?.(value)}>
      {children}
    </button>
  ),
}))

vi.mock("lucide-react", () => {
  const Icon = ({ className }: { className?: string }) => <svg data-testid="icon" className={className} />
  return {
    Clock: Icon,
    AlertTriangle: Icon,
    Plus: Icon,
    Calendar: Icon,
    Search: Icon,
    ArrowDown: Icon,
  }
})

vi.mock("@/hooks/tasks/useTachesPartenaire", () => ({
  useTachesPartenaire: vi.fn(),
  useUpdateTachePartenaire: vi.fn(),
  useArchiveTachePartenaire: vi.fn(),
}))

vi.mock("@/hooks/catalogue/useCategories", () => ({
  useCategories: vi.fn(),
}))

vi.mock("@/hooks/shared/use-toast", () => ({
  useToast: () => ({ toast: toastSpy }),
}))

vi.mock("./CreateTachePartenaireDialog", () => ({
  CreateTachePartenaireDialog: ({
    partenaireId,
    triggerButton,
  }: {
    partenaireId: string
    triggerButton: React.ReactNode
  }) => {
    createDialogSpy(partenaireId)
    return <div data-testid="create-dialog">{triggerButton}</div>
  },
}))

vi.mock("./PartenaireTacheCard", () => ({
  PartenaireTacheCard: ({
    tache,
    onStatusChange,
    onArchive,
  }: {
    tache: { id: string; titre: string; archive: boolean }
    onStatusChange: (id: string, status: "A faire" | "En cours" | "Bloqué" | "Terminé") => Promise<void>
    onArchive: (id: string, archived: boolean) => Promise<void>
  }) => {
    cardPropsSpy(tache)
    return (
      <div data-testid={`task-card-${tache.id}`}>
        <span>{tache.titre}</span>
        <button data-testid={`finish-${tache.id}`} onClick={() => void onStatusChange(tache.id, "Terminé")}>
          finish
        </button>
        <button data-testid={`status-en-cours-${tache.id}`} onClick={() => void onStatusChange(tache.id, "En cours")}>
          encours
        </button>
        <button data-testid={`archive-${tache.id}`} onClick={() => void onArchive(tache.id, tache.archive)}>
          archive
        </button>
      </div>
    )
  },
}))

const { useTachesPartenaire, useUpdateTachePartenaire, useArchiveTachePartenaire } = await import(
  "@/hooks/tasks/useTachesPartenaire"
)
const { useCategories } = await import("@/hooks/catalogue/useCategories")

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
}

describe("PartenaireTaches", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(useTachesPartenaire).mockImplementation((_partenaireId: string, showArchived?: boolean) => ({
      data: showArchived ? TASKS : TASKS.filter((t) => !t.archive),
    }))

    vi.mocked(useCategories).mockReturnValue({
      data: CATEGORIES,
    })

    vi.mocked(useUpdateTachePartenaire).mockReturnValue({
      mutateAsync: mutateUpdateAsync,
    })

    vi.mocked(useArchiveTachePartenaire).mockReturnValue({
      mutateAsync: mutateArchiveAsync,
    })
  })

  it("affiche les tâches non archivées par défaut et les catégories", () => {
    render(<PartenaireTaches partenaireId="partner-1" />, { wrapper: createWrapper() })

    expect(screen.getByText("Tâches du partenaire")).toBeInTheDocument()
    expect(screen.getByText("Préparer dossier")).toBeInTheDocument()
    expect(screen.getByText("Valider contrat")).toBeInTheDocument()
    expect(screen.queryByText("Ancienne tâche")).not.toBeInTheDocument()
    expect(screen.getByTestId("select-item-cat-1")).toBeInTheDocument()
    expect(screen.getByTestId("select-item-cat-2")).toBeInTheDocument()
    expect(createDialogSpy).toHaveBeenCalledWith("partner-1")
  })

  it("filtre par recherche et catégorie", async () => {
    render(<PartenaireTaches partenaireId="partner-1" />, { wrapper: createWrapper() })

    fireEvent.change(screen.getByTestId("search-input"), { target: { value: "contrat" } })

    expect(screen.getByText("Valider contrat")).toBeInTheDocument()
    expect(screen.queryByText("Préparer dossier")).not.toBeInTheDocument()

    fireEvent.change(screen.getByTestId("search-input"), { target: { value: "" } })
    fireEvent.click(screen.getByTestId("select-item-cat-1"))

    await waitFor(() => {
      expect(screen.getByText("Préparer dossier")).toBeInTheDocument()
    })
    expect(screen.queryByText("Valider contrat")).not.toBeInTheDocument()
  })

  it("affiche les archives quand le switch est activé", async () => {
    render(<PartenaireTaches partenaireId="partner-1" />, { wrapper: createWrapper() })

    expect(screen.queryByText("Ancienne tâche")).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId("archive-switch"))

    await waitFor(() => {
      expect(screen.getByText("Ancienne tâche")).toBeInTheDocument()
    })
  })

  it("met à jour une tâche en terminé, archive automatiquement et affiche un toast", async () => {
    mutateUpdateAsync.mockResolvedValueOnce({})

    render(<PartenaireTaches partenaireId="partner-1" />, { wrapper: createWrapper() })

    fireEvent.click(screen.getByTestId("finish-t1"))

    await waitFor(() => {
      expect(mutateUpdateAsync).toHaveBeenCalledTimes(1)
    })

    const firstCall = mutateUpdateAsync.mock.calls[0]?.[0] as {
      id: string
      data: { statut: string; archive: boolean; date_realisation: string }
    }

    expect(firstCall.id).toBe("t1")
    expect(firstCall.data.statut).toBe("Terminé")
    expect(firstCall.data.archive).toBe(true)
    expect(firstCall.data.date_realisation).toMatch(/^\d{4}-\d{2}-\d{2}$/)

    expect(toastSpy).toHaveBeenCalledWith({
      title: "Tâche mise à jour",
      description: "Tâche terminée et archivée automatiquement",
    })
  })

  it("met à jour une tâche vers un statut non terminé et désarchive", async () => {
    mutateUpdateAsync.mockResolvedValueOnce({})

    render(<PartenaireTaches partenaireId="partner-1" />, { wrapper: createWrapper() })

    fireEvent.click(screen.getByTestId("status-en-cours-t1"))

    await waitFor(() => {
      expect(mutateUpdateAsync).toHaveBeenCalledWith({
        id: "t1",
        data: {
          statut: "En cours",
          date_realisation: null,
          archive: false,
        },
      })
    })

    expect(toastSpy).toHaveBeenCalledWith({
      title: "Tâche mise à jour",
      description: "Statut: En cours",
    })
  })

  it("archive ou désarchive une tâche", async () => {
    mutateArchiveAsync.mockResolvedValueOnce({})

    render(<PartenaireTaches partenaireId="partner-1" />, { wrapper: createWrapper() })

    fireEvent.click(screen.getByTestId("archive-t1"))

    await waitFor(() => {
      expect(mutateArchiveAsync).toHaveBeenCalledWith({
        id: "t1",
        archive: true,
      })
    })
  })

  it("gère les erreurs de mise à jour avec debug et toast destructif", async () => {
    const error = new Error("x")
    mutateUpdateAsync.mockRejectedValueOnce(error)

    render(<PartenaireTaches partenaireId="partner-1" />, { wrapper: createWrapper() })

    fireEvent.click(screen.getByTestId("finish-t1"))

    await waitFor(() => {
      expect(debugErrorSpy).toHaveBeenCalledWith("Erreur mise à jour tâche:", error)
    })

    expect(toastSpy).toHaveBeenCalledWith({
      title: "Erreur",
      description: "Impossible de mettre à jour",
      variant: "destructive",
    })
  })

  it("gère les erreurs d'archivage avec toast destructif", async () => {
    mutateArchiveAsync.mockRejectedValueOnce(new Error("x"))

    render(<PartenaireTaches partenaireId="partner-1" />, { wrapper: createWrapper() })

    fireEvent.click(screen.getByTestId("archive-t1"))

    await waitFor(() => {
      expect(toastSpy).toHaveBeenCalledWith({
        title: "Erreur",
        description: "Impossible de modifier l'archivage",
        variant: "destructive",
      })
    })
  })

  it("affiche l'état vide quand aucune tâche ne correspond", async () => {
    render(<PartenaireTaches partenaireId="partner-1" />, { wrapper: createWrapper() })

    fireEvent.change(screen.getByTestId("search-input"), { target: { value: "introuvable" } })

    await waitFor(() => {
      expect(screen.getByText("Aucune tâche trouvée")).toBeInTheDocument()
    })
    expect(screen.getByText("Ajustez les filtres ou créez de nouvelles tâches")).toBeInTheDocument()
  })
})