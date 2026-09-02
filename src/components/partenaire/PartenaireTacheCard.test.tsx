/* @vitest-environment jsdom */
import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { PartenaireTacheCard } from "./PartenaireTacheCard"

const { TASK_BASE, TASK_ARCHIVED, onStatusChange, onArchive } = vi.hoisted(() => ({
  TASK_BASE: {
    id: "task-1",
    titre: "Préparer le dossier",
    description: "Rassembler les pièces justificatives",
    statut: "En cours",
    priorite: "high",
    archive: false,
    echeance: "2024-06-15T00:00:00.000Z",
    categories_taches: { nom: "Administratif" },
    responsable_profile: { prenom: "Jean", nom: "Dupont" },
  },
  TASK_ARCHIVED: {
    id: "task-2",
    titre: "Clôturer le suivi",
    description: null,
    statut: "Terminé",
    priorite: "low",
    archive: true,
    echeance: null,
    categories_taches: null,
    responsable_profile: null,
  },
  onStatusChange: vi.fn(),
  onArchive: vi.fn(),
}))

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-content" className={className}>
      {children}
    </div>
  ),
}))

vi.mock("@/components/ui/badge", () => ({
  Badge: ({
    children,
    variant,
    className,
  }: {
    children: React.ReactNode
    variant?: string
    className?: string
  }) => (
    <span data-testid="badge" data-variant={variant} className={className}>
      {children}
    </span>
  ),
}))

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    title,
    variant,
    size,
  }: {
    children: React.ReactNode
    onClick?: () => void
    title?: string
    variant?: string
    size?: string
  }) => (
    <button data-variant={variant} data-size={size} title={title} onClick={onClick}>
      {children}
    </button>
  ),
}))

vi.mock("@/components/ui/select", () => ({
  Select: ({
    children,
    value,
    onValueChange,
  }: {
    children: React.ReactNode
    value?: string
    onValueChange?: (value: string) => void
  }) => (
    <div data-testid="select-root">
      <select
        aria-label="statut"
        data-testid="status-select"
        value={value}
        onChange={(e) => onValueChange?.(e.target.value)}
      >
        <option value="A faire">À faire</option>
        <option value="En cours">En cours</option>
        <option value="Bloqué">Bloqué</option>
        <option value="Terminé">Terminé</option>
      </select>
      {children}
    </div>
  ),
  SelectTrigger: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="select-trigger" className={className}>
      {children}
    </div>
  ),
  SelectValue: () => <span data-testid="select-value" />,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <div data-testid={`select-item-${value}`}>{children}</div>
  ),
}))

vi.mock("lucide-react", () => {
  const Icon =
    (name: string) =>
    ({ className }: { className?: string }) =>
      <svg data-testid={name} className={className} />
  return {
    Calendar: Icon("calendar-icon"),
    User: Icon("user-icon"),
    Archive: Icon("archive-icon"),
    ArchiveRestore: Icon("archive-restore-icon"),
    CheckCircle2: Icon("check-icon"),
    Clock: Icon("clock-icon"),
    AlertTriangle: Icon("alert-icon"),
    Circle: Icon("circle-icon"),
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

describe("PartenaireTacheCard", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("affiche les informations métier de la tâche active avec les bons badges et métadonnées", () => {
    const Wrapper = createWrapper()

    render(
      <PartenaireTacheCard
        tache={TASK_BASE}
        onStatusChange={onStatusChange}
        onArchive={onArchive}
      />,
      { wrapper: Wrapper }
    )

    expect(screen.getByText("Préparer le dossier")).toBeInTheDocument()
    expect(screen.getByText("Rassembler les pièces justificatives")).toBeInTheDocument()
    expect(screen.getByText("Haute")).toBeInTheDocument()
    expect(screen.getByText("Administratif")).toBeInTheDocument()
    expect(screen.getByText("Jean Dupont")).toBeInTheDocument()
    expect(screen.getByText("15/06/2024")).toBeInTheDocument()
    expect(screen.getByTestId("clock-icon")).toBeInTheDocument()
    expect(screen.getByTestId("calendar-icon")).toBeInTheDocument()
    expect(screen.getByTestId("user-icon")).toBeInTheDocument()
    expect(screen.queryByText("Archivé")).not.toBeInTheDocument()

    const select = screen.getByTestId("status-select")
    expect(select).toHaveValue("En cours")

    const archiveButton = screen.getByTitle("Archiver")
    expect(archiveButton).toBeInTheDocument()
    expect(screen.getByTestId("archive-icon")).toBeInTheDocument()
  })

  it("déclenche onStatusChange avec l'id réel et le nouveau statut choisi", () => {
    const Wrapper = createWrapper()

    render(
      <PartenaireTacheCard
        tache={TASK_BASE}
        onStatusChange={onStatusChange}
        onArchive={onArchive}
      />,
      { wrapper: Wrapper }
    )

    fireEvent.change(screen.getByTestId("status-select"), { target: { value: "Bloqué" } })

    expect(onStatusChange).toHaveBeenCalledTimes(1)
    expect(onStatusChange).toHaveBeenCalledWith("task-1", "Bloqué")
  })

  it("déclenche onArchive avec l'état courant non archivé", () => {
    const Wrapper = createWrapper()

    render(
      <PartenaireTacheCard
        tache={TASK_BASE}
        onStatusChange={onStatusChange}
        onArchive={onArchive}
      />,
      { wrapper: Wrapper }
    )

    fireEvent.click(screen.getByTitle("Archiver"))

    expect(onArchive).toHaveBeenCalledTimes(1)
    expect(onArchive).toHaveBeenCalledWith("task-1", false)
  })

  it("affiche l'état archivé, le bon icône de statut terminé et permet le désarchivage", () => {
    const Wrapper = createWrapper()

    render(
      <PartenaireTacheCard
        tache={TASK_ARCHIVED}
        onStatusChange={onStatusChange}
        onArchive={onArchive}
      />,
      { wrapper: Wrapper }
    )

    expect(screen.getByText("Clôturer le suivi")).toBeInTheDocument()
    expect(screen.getByText("Basse")).toBeInTheDocument()
    expect(screen.getByText("Archivé")).toBeInTheDocument()
    expect(screen.getByTestId("check-icon")).toBeInTheDocument()
    expect(screen.getByTitle("Désarchiver")).toBeInTheDocument()
    expect(screen.getByTestId("archive-restore-icon")).toBeInTheDocument()
    expect(screen.queryByTestId("calendar-icon")).not.toBeInTheDocument()
    expect(screen.queryByTestId("user-icon")).not.toBeInTheDocument()

    fireEvent.click(screen.getByTitle("Désarchiver"))

    expect(onArchive).toHaveBeenCalledWith("task-2", true)
  })

  it("affiche un badge de priorité libre quand la priorité n'est pas standard", () => {
    const Wrapper = createWrapper()
    const customTask = {
      ...TASK_BASE,
      id: "task-3",
      priorite: "urgent",
      statut: "A faire",
    }

    render(
      <PartenaireTacheCard
        tache={customTask}
        onStatusChange={onStatusChange}
        onArchive={onArchive}
      />,
      { wrapper: Wrapper }
    )

    expect(screen.getByText("urgent")).toBeInTheDocument()
    expect(screen.getByTestId("circle-icon")).toBeInTheDocument()
  })
})