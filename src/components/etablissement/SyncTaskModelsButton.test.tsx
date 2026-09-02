// @vitest-environment jsdom
import React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { SyncTaskModelsButton } from "./SyncTaskModelsButton"

const {
  ETABLISSEMENT,
  RPC_SUCCESS_DATA,
  mockToast,
  mockUseToast,
  mockUseEtablissement,
  mockRpc,
  mockDebugError,
} = vi.hoisted(() => ({
  ETABLISSEMENT: {
    id: "eta-1",
    nom: "Clinique Atlas",
    statut: "Production",
    ville: "Lyon",
    region: "Auvergne-Rhône-Alpes",
  },
  RPC_SUCCESS_DATA: [
    {
      etablissement_nom: "Clinique Atlas",
      statut_etablissement: "Production",
      taches_creees: 12,
      taches_supprimees: 5,
    },
  ],
  mockToast: vi.fn(),
  mockUseToast: vi.fn(),
  mockUseEtablissement: vi.fn(),
  mockRpc: vi.fn(),
  mockDebugError: vi.fn(),
}))

vi.mock("@/lib/debug", () => ({
  debug: {
    error: mockDebugError,
  },
}))

vi.mock("@/hooks/shared/use-toast", () => ({
  useToast: () => mockUseToast(),
}))

vi.mock("@/hooks/crm/useEtablissements", () => ({
  useEtablissement: (id: string) => mockUseEtablissement(id),
}))

vi.mock("@/lib/supabaseBrowser", () => ({
  supabase: {
    rpc: mockRpc,
  },
}))

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    className,
  }: {
    children: React.ReactNode
    onClick?: () => void
    disabled?: boolean
    className?: string
  }) => (
    <button onClick={onClick} disabled={disabled} className={className}>
      {children}
    </button>
  ),
}))

vi.mock("@/components/ui/badge", () => ({
  Badge: ({
    children,
    className,
  }: {
    children: React.ReactNode
    className?: string
  }) => <span className={className}>{children}</span>,
}))

vi.mock("@/components/ui/dialog", () => {
  const DialogContext = React.createContext<{
    open: boolean
    onOpenChange: (open: boolean) => void
  }>({ open: false, onOpenChange: () => undefined })

  return {
    Dialog: ({
      children,
      open,
      onOpenChange,
    }: {
      children: React.ReactNode
      open: boolean
      onOpenChange: (open: boolean) => void
    }) => (
      <DialogContext.Provider value={{ open, onOpenChange }}>
        {children}
      </DialogContext.Provider>
    ),
    DialogTrigger: ({
      children,
    }: {
      children: React.ReactElement<{ onClick?: () => void }>
      asChild?: boolean
    }) => {
      const ctx = React.useContext(DialogContext)
      return React.cloneElement(children, {
        onClick: () => ctx.onOpenChange(true),
      })
    },
    DialogContent: ({
      children,
      className,
    }: {
      children: React.ReactNode
      className?: string
    }) => {
      const ctx = React.useContext(DialogContext)
      if (!ctx.open) return null
      return <div className={className}>{children}</div>
    },
    DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
    DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  }
})

vi.mock("@/components/security/AdminActionButton", () => ({
  AdminActionButton: ({
    children,
    onConfirm,
  }: {
    children: React.ReactNode
    onConfirm?: () => void
  }) => <button onClick={onConfirm}>{children}</button>,
}))

vi.mock("lucide-react", () => ({
  Loader2: () => <svg data-testid="loader-icon" />,
  RefreshCw: () => <svg data-testid="refresh-icon" />,
  CheckCircle2: () => <svg data-testid="success-icon" />,
  AlertTriangle: () => <svg data-testid="warning-icon" />,
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

describe("SyncTaskModelsButton", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseToast.mockReturnValue({ toast: mockToast })
    mockUseEtablissement.mockReturnValue({ data: ETABLISSEMENT })
  })

  it("n'affiche rien si l'établissement est absent", () => {
    mockUseEtablissement.mockReturnValue({ data: null })

    const { container } = render(
      <SyncTaskModelsButton etablissementId="eta-1" />,
      { wrapper: createWrapper() }
    )

    expect(container).toBeEmptyDOMElement()
  })

  it("affiche les infos de l'établissement, lance la synchronisation et montre le résultat métier", async () => {
    const user = userEvent.setup()

    let resolveRpc: ((value: { data: typeof RPC_SUCCESS_DATA; error: null }) => void) | null = null
    mockRpc.mockImplementation(
      () =>
        new Promise<{ data: typeof RPC_SUCCESS_DATA; error: null }>((resolve) => {
          resolveRpc = resolve
        })
    )

    const onTasksUpdated = vi.fn()

    render(
      <SyncTaskModelsButton etablissementId="eta-1" onTasksUpdated={onTasksUpdated} />,
      { wrapper: createWrapper() }
    )

    await user.click(screen.getByRole("button", { name: /synchroniser avec les modèles/i }))

    expect(screen.getByText("Clinique Atlas")).toBeInTheDocument()
    expect(screen.getAllByText("Production")[0]).toBeInTheDocument()
    expect(screen.getByText("Lyon, Auvergne-Rhône-Alpes")).toBeInTheDocument()
    expect(screen.getByText(/Cette action va supprimer définitivement toutes les tâches existantes/i)).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /lancer la synchronisation/i }))

    expect(mockRpc).toHaveBeenCalledWith("sync_all_tasks_with_models", {
      p_etablissement_id: "eta-1",
    })

    expect(screen.getByRole("button", { name: /synchronisation en cours/i })).toBeDisabled()

    if (resolveRpc) {
      resolveRpc({ data: RPC_SUCCESS_DATA, error: null })
    }

    await waitFor(() => {
      expect(screen.getByText("Synchronisation terminée")).toBeInTheDocument()
    })

    expect(screen.getByText("Établissement :")).toBeInTheDocument()
    expect(screen.getAllByText("Clinique Atlas")[1]).toBeInTheDocument()
    expect(screen.getByText("Tâches supprimées :")).toBeInTheDocument()
    expect(screen.getByText("5")).toBeInTheDocument()
    expect(screen.getByText("Tâches créées :")).toBeInTheDocument()
    expect(screen.getByText("12")).toBeInTheDocument()

    expect(mockToast).toHaveBeenCalledWith({
      title: "Synchronisation réussie",
      description: "5 tâches supprimées, 12 tâches créées selon les modèles actifs",
    })
    expect(onTasksUpdated).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole("button", { name: /fermer/i }))

    await waitFor(() => {
      expect(screen.queryByText("Synchronisation terminée")).not.toBeInTheDocument()
    })
  })

  it("gère une erreur RPC avec toast destructif et log debug", async () => {
    const user = userEvent.setup()

    const rpcError = { message: "x" }
    mockRpc.mockResolvedValue({ data: null, error: rpcError })

    const onTasksUpdated = vi.fn()

    render(
      <SyncTaskModelsButton etablissementId="eta-1" onTasksUpdated={onTasksUpdated} />,
      { wrapper: createWrapper() }
    )

    await user.click(screen.getByRole("button", { name: /synchroniser avec les modèles/i }))
    await user.click(screen.getByRole("button", { name: /lancer la synchronisation/i }))

    await waitFor(() => {
      expect(mockDebugError).toHaveBeenCalledWith("Error syncing task models:", rpcError)
    })

    expect(mockToast).toHaveBeenCalledWith({
      title: "Erreur",
      description: "Impossible de synchroniser les tâches avec les modèles",
      variant: "destructive",
    })
    expect(onTasksUpdated).not.toHaveBeenCalled()
    expect(screen.queryByText("Synchronisation terminée")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: /lancer la synchronisation/i })).toBeEnabled()
  })
})