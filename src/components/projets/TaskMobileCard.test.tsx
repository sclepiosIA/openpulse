import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { TaskMobileCard } from "./TaskMobileCard"

const {
  taskBase,
  taskOverdue,
  taskWithoutExtras,
  formatDateFrMock,
  isOverdueMock,
  getPriorityLabelFrMock,
  getStatusLabelFrMock,
  cnMock,
} = vi.hoisted(() => ({
  taskBase: {
    id: "task-1",
    titre: "Préparer le dossier",
    statut: "En cours",
    priorite: "high",
    echeance: "2024-03-15",
    etablissement_id: "eta-1",
    etablissements: { nom: "Clinique A" },
    categories_taches: { nom: "Administratif", couleur: "#00aa88" },
    responsable_profile: {
      prenom: "Alice",
      nom: "Martin",
      avatar_url: "/avatar.png",
    },
  },
  taskOverdue: {
    id: "task-2",
    titre: "Tâche en retard",
    statut: "A faire",
    priorite: "low",
    echeance: "2024-02-01",
    etablissement_id: "eta-2",
    etablissements: { nom: "Hôpital B" },
    categories_taches: { nom: "Urgent", couleur: "#ff8800" },
    responsable_profile: {
      prenom: "Bob",
      nom: "Durand",
      avatar_url: "",
    },
  },
  taskWithoutExtras: {
    id: "task-3",
    titre: "Clôturer la checklist",
    statut: "Terminé",
    priorite: "urgent",
    echeance: null,
    etablissement_id: "eta-3",
    etablissements: null,
    categories_taches: null,
    responsable_profile: null,
  },
  formatDateFrMock: vi.fn(),
  isOverdueMock: vi.fn(),
  getPriorityLabelFrMock: vi.fn(),
  getStatusLabelFrMock: vi.fn(),
  cnMock: vi.fn(),
}))

vi.mock("@/components/ui/badge", () => ({
  Badge: ({
    children,
    className,
    style,
  }: {
    children: React.ReactNode
    className?: string
    style?: React.CSSProperties
  }) => (
    <span data-testid="badge" className={className} style={style}>
      {children}
    </span>
  ),
}))

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    className,
    "aria-label": ariaLabel,
  }: {
    children: React.ReactNode
    onClick?: React.MouseEventHandler<HTMLButtonElement>
    className?: string
    "aria-label"?: string
  }) => (
    <button type="button" className={className} onClick={onClick} aria-label={ariaLabel}>
      {children}
    </button>
  ),
}))

vi.mock("@/components/ui/avatar", () => ({
  Avatar: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="avatar" className={className}>
      {children}
    </div>
  ),
  AvatarImage: ({ src }: { src?: string }) => <img data-testid="avatar-image" src={src} alt="" />,
  AvatarFallback: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <span data-testid="avatar-fallback" className={className}>
      {children}
    </span>
  ),
}))

vi.mock("@/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value: string
    onValueChange?: (value: string) => void
    children: React.ReactNode
  }) => (
    <div data-testid="select-root" data-value={value}>
      <button type="button" data-testid="select-change" onClick={() => onValueChange?.("Terminé")}>
        change-status
      </button>
      {children}
    </div>
  ),
  SelectTrigger: ({
    children,
    className,
    onClick,
  }: {
    children: React.ReactNode
    className?: string
    onClick?: React.MouseEventHandler<HTMLDivElement>
  }) => (
    <div data-testid="select-trigger" className={className} onClick={onClick}>
      {children}
    </div>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => <div data-testid="select-content">{children}</div>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => (
    <div data-testid={`select-item-${value}`}>{children}</div>
  ),
}))

vi.mock("lucide-react", () => ({
  Calendar: ({ className }: { className?: string }) => <svg data-testid="icon-calendar" className={className} />,
  Edit: ({ className }: { className?: string }) => <svg data-testid="icon-edit" className={className} />,
  Archive: ({ className }: { className?: string }) => <svg data-testid="icon-archive" className={className} />,
  CheckCircle2: ({ className }: { className?: string }) => <svg data-testid="icon-check" className={className} />,
  Clock: ({ className }: { className?: string }) => <svg data-testid="icon-clock" className={className} />,
  XCircle: ({ className }: { className?: string }) => <svg data-testid="icon-x" className={className} />,
  AlertCircle: ({ className }: { className?: string }) => <svg data-testid="icon-alert" className={className} />,
}))

vi.mock("@/lib/utils", () => ({
  cn: (...args: Array<string | false | null | undefined>) => cnMock(...args),
}))

vi.mock("@/lib/projetsUtils", () => ({
  formatDateFr: (value: string) => formatDateFrMock(value),
  isOverdue: (echeance: string | null, statut: string) => isOverdueMock(echeance, statut),
  getPriorityLabelFr: (priority: string) => getPriorityLabelFrMock(priority),
  getStatusLabelFr: (status: string) => getStatusLabelFrMock(status),
}))

describe("TaskMobileCard", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    cnMock.mockImplementation((...args: Array<string | false | null | undefined>) => args.filter(Boolean).join(" "))
    formatDateFrMock.mockReturnValue("15/03/2024")
    isOverdueMock.mockReturnValue(false)
    getPriorityLabelFrMock.mockImplementation((priority: string) => {
      if (priority === "high") return "Haute"
      if (priority === "low") return "Basse"
      if (priority === "urgent") return "Urgente"
      return "Inconnue"
    })
    getStatusLabelFrMock.mockImplementation((status: string) => {
      if (status === "En cours") return "En cours"
      if (status === "A faire") return "À faire"
      if (status === "Terminé") return "Terminé"
      return status
    })
  })

  it("affiche les informations métier principales et déclenche les callbacks d'action", () => {
    const onStatusChange = vi.fn()
    const onClick = vi.fn()
    const onEdit = vi.fn()
    const onArchive = vi.fn()
    const getEtablissementColor = vi.fn().mockReturnValue("#3366ff")

    render(
      <TaskMobileCard
        task={taskBase}
        onStatusChange={onStatusChange}
        getEtablissementColor={getEtablissementColor}
        onClick={onClick}
        onEdit={onEdit}
        onArchive={onArchive}
      />,
    )

    expect(isOverdueMock).toHaveBeenCalledWith("2024-03-15", "En cours")
    expect(getEtablissementColor).toHaveBeenCalledWith("eta-1", "Clinique A")
    expect(formatDateFrMock).toHaveBeenCalledWith("2024-03-15")
    expect(getPriorityLabelFrMock).toHaveBeenCalledWith("high")
    expect(getStatusLabelFrMock).toHaveBeenCalledWith("En cours")

    expect(screen.getByText("Préparer le dossier")).toBeInTheDocument()
    expect(screen.getByText("15/03/2024")).toBeInTheDocument()
    expect(screen.getByText("Alice")).toBeInTheDocument()
    expect(screen.getByTestId("avatar-fallback")).toHaveTextContent("AM")
    expect(screen.getByTitle("Haute")).toBeInTheDocument()
    expect(screen.getByTestId("icon-clock")).toBeInTheDocument()
    expect(screen.getByTestId("select-root")).toHaveAttribute("data-value", "En cours")
    expect(screen.getByTestId("select-trigger")).toHaveTextContent("En cours")

    const badges = screen.getAllByTestId("badge")
    expect(badges).toHaveLength(2)
    expect(badges[0]).toHaveTextContent("Clinique A")
    expect(badges[0]).toHaveStyle({ borderColor: "#3366ff", color: "#3366ff" })
    expect(badges[1]).toHaveTextContent("Administratif")
    expect(badges[1]).toHaveStyle({ borderColor: "#00aa88", color: "#00aa88" })

    fireEvent.click(screen.getByText("Préparer le dossier"))
    expect(onClick).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByTestId("select-change"))
    expect(onStatusChange).toHaveBeenCalledWith("task-1", "Terminé")

    fireEvent.click(screen.getByLabelText("Modifier"))
    expect(onEdit).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByLabelText("Archiver"))
    expect(onArchive).toHaveBeenCalledTimes(1)
  })

  it("affiche l'état en retard, la date formatée, le texte retard et l'icône par défaut pour un statut non mappé", () => {
    isOverdueMock.mockReturnValue(true)
    formatDateFrMock.mockReturnValue("01/02/2024")

    const getEtablissementColor = vi.fn().mockReturnValue("#aa22cc")

    render(
      <TaskMobileCard
        task={taskOverdue}
        onStatusChange={vi.fn()}
        getEtablissementColor={getEtablissementColor}
      />,
    )

    expect(screen.getByText("Tâche en retard")).toBeInTheDocument()
    expect(screen.getByText("01/02/2024")).toBeInTheDocument()
    expect(screen.getByText("(retard)")).toBeInTheDocument()
    expect(screen.getByText("Bob")).toBeInTheDocument()
    expect(screen.getByTestId("avatar-fallback")).toHaveTextContent("BD")
    expect(screen.getByTitle("Basse")).toBeInTheDocument()
    expect(screen.getByTestId("icon-alert")).toBeInTheDocument()
    expect(screen.getByTestId("select-trigger")).toHaveTextContent("À faire")

    const badges = screen.getAllByTestId("badge")
    expect(badges).toHaveLength(2)
    expect(badges[0]).toHaveTextContent("Hôpital B")
    expect(badges[0]).toHaveStyle({ borderColor: "#aa22cc", color: "#aa22cc" })
    expect(badges[1]).toHaveTextContent("Urgent")
    expect(badges[1]).toHaveStyle({ borderColor: "#ff8800", color: "#ff8800" })

    expect(cnMock).toHaveBeenCalled()
    expect(cnMock.mock.calls[0]).toContain("border-l-success")
    expect(cnMock.mock.calls[0]).toContain("bg-destructive/5 border-destructive/20")
  })

  it("gère l'absence de responsable, d'échéance, de badges et affiche l'icône terminé", () => {
    const getEtablissementColor = vi.fn().mockReturnValue("#000000")

    render(
      <TaskMobileCard
        task={taskWithoutExtras}
        onStatusChange={vi.fn()}
        getEtablissementColor={getEtablissementColor}
      />,
    )

    expect(isOverdueMock).toHaveBeenCalledWith(null, "Terminé")
    expect(getEtablissementColor).toHaveBeenCalledWith("eta-3", "")
    expect(formatDateFrMock).not.toHaveBeenCalled()

    expect(screen.getByText("Clôturer la checklist")).toBeInTheDocument()
    expect(screen.getByText("Non planifié")).toBeInTheDocument()
    expect(screen.queryByTestId("avatar")).not.toBeInTheDocument()
    expect(screen.queryAllByTestId("badge")).toHaveLength(0)
    expect(screen.getByTestId("icon-check")).toBeInTheDocument()
    expect(screen.getByTestId("select-trigger")).toHaveTextContent("Terminé")
    expect(screen.getByTitle("Urgente")).toBeInTheDocument()

    expect(cnMock.mock.calls[0]).toContain("border-l-destructive")
    expect(cnMock.mock.calls[1]).toContain("w-2 h-2 rounded-full")
    expect(cnMock.mock.calls[2]).not.toContain("text-destructive font-medium")
  })
})