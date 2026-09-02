import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

const {
  ETABS_SUCCESS,
  calcValue,
  formatNumberMock,
  navigateMock,
  stageCardOnClicks,
  debugLog,
  debugWarn,
  useAllEtablissementsMock,
} = vi.hoisted(() => {
  const ETABS_SUCCESS = [
    { id: "e1", statut: "Prospect" },
    { id: "e2", statut: "Prospect" },
    { id: "e3", statut: "Contacté" },
    { id: "e4", statut: "RDV pris" },
    { id: "e5", statut: "Vendu" },
  ] as const

  const calcValue = vi.fn((etab: { id: string }) => {
    const map: Record<string, number> = { e1: 100, e2: 200, e3: 300, e4: 400, e5: 500 }
    return map[etab.id] ?? 0
  })

  const formatNumberMock = vi.fn((n: number) => String(n))

  const navigateMock = vi.fn()

  const stageCardOnClicks = new Map<string, () => void>()

  const debugLog = vi.fn()
  const debugWarn = vi.fn()

  const useAllEtablissementsMock = vi.fn<
    [],
    { data: ReadonlyArray<{ id: string; statut: string }> | null; isLoading?: boolean; isError?: boolean; error?: { message: string } | null }
  >()

  return {
    ETABS_SUCCESS,
    calcValue,
    formatNumberMock,
    navigateMock,
    stageCardOnClicks,
    debugLog,
    debugWarn,
    useAllEtablissementsMock,
  }
})

vi.mock("react-router-dom", () => ({
  useNavigate: () => navigateMock,
}))

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <div data-testid="card-title">{children}</div>,
  CardDescription: ({ children }: { children: React.ReactNode }) => <div data-testid="card-description">{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div data-testid="card-content">{children}</div>,
}))

vi.mock("lucide-react", () => {
  const Icon = ({ "data-testid": dataTestId }: { "data-testid"?: string }) => <span data-testid={dataTestId ?? "icon"} />
  return {
    Target: Icon,
    Phone: Icon,
    Calendar: Icon,
    Users: Icon,
    FileText: Icon,
    Handshake: Icon,
    CheckCircle2: Icon,
    Clock: Icon,
    TrendingUp: Icon,
    Activity: Icon,
    Zap: Icon,
  }
})

vi.mock("@/hooks/crm/useProspects", () => ({
  useAllEtablissements: () => useAllEtablissementsMock(),
}))

vi.mock("@/components/pipeline/StageCard", () => ({
  StageCard: ({ stage, onClick }: { stage: { name: string; count: number; value: number; percentage: number }; onClick: () => void }) => {
    stageCardOnClicks.set(stage.name, onClick)
    return (
      <button type="button" data-testid={`stage-${stage.name}`} onClick={onClick}>
        <span data-testid={`stage-name-${stage.name}`}>{stage.name}</span>
        <span data-testid={`stage-count-${stage.name}`}>{String(stage.count)}</span>
        <span data-testid={`stage-value-${stage.name}`}>{String(stage.value)}</span>
        <span data-testid={`stage-percentage-${stage.name}`}>{String(stage.percentage)}</span>
      </button>
    )
  },
}))

vi.mock("@/lib/valueCalculations", () => ({
  calculateEtablissementValue: (etab: { id: string }) => calcValue(etab),
}))

vi.mock("@/lib/utils", () => ({
  formatNumber: (n: number) => formatNumberMock(n),
}))

vi.mock("@/lib/debug", () => ({
  debug: {
    log: (...args: unknown[]) => debugLog(...args),
    warn: (...args: unknown[]) => debugWarn(...args),
  },
}))

vi.mock("@/integrations/supabase/client", () => {
  const builder: Record<string, unknown> = {}
  const chain = () => builder
  const methods = [
    "select",
    "eq",
    "neq",
    "gt",
    "gte",
    "lt",
    "lte",
    "in",
    "order",
    "limit",
    "range",
    "insert",
    "update",
    "delete",
    "upsert",
    "maybeSingle",
    "single",
  ] as const

  for (const m of methods) builder[m] = chain
  builder.then = (onFulfilled: (v: unknown) => unknown) => Promise.resolve({ data: null, error: null }).then(onFulfilled)
  builder.catch = (onRejected: (e: unknown) => unknown) => Promise.resolve({ data: null, error: null }).catch(onRejected)

  const mockFrom = vi.fn(() => builder)

  return {
    supabase: {
      from: mockFrom,
      auth: {
        getSession: vi.fn(async () => ({ data: { session: { user: { id: "u1" } } }, error: null })),
        getUser: vi.fn(async () => ({ data: { user: { id: "u1", email: "t@t.co" } }, error: null })),
        onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
        signOut: vi.fn(async () => ({ error: null })),
      },
    },
  }
})

import { PipelineVisualization } from "./PipelineVisualization"

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })
}

function renderWithClient(ui: React.ReactElement) {
  const client = createQueryClient()
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

describe("PipelineVisualization", () => {
  it("chargement -> succès: affiche les totaux, les stages filtrés, calcule les pourcentages et navigue au clic", () => {
    useAllEtablissementsMock.mockReturnValueOnce({ data: null, isLoading: true, isError: false, error: null })
    const { rerender } = renderWithClient(<PipelineVisualization />)

    expect(screen.getByText(/Pipeline Commercial Global/i)).toBeInTheDocument()
    expect(screen.getByTestId("card-description").textContent).toContain("0 établissements")

    useAllEtablissementsMock.mockReturnValueOnce({ data: ETABS_SUCCESS, isLoading: false, isError: false, error: null })
    rerender(
      <QueryClientProvider client={createQueryClient()}>
        <PipelineVisualization />
      </QueryClientProvider>
    )

    expect(calcValue).toHaveBeenCalledTimes(ETABS_SUCCESS.length)

    const totalValue = 100 + 200 + 300 + 400 + 500
    expect(formatNumberMock).toHaveBeenCalledWith(totalValue)
    expect(screen.getByTestId("card-description").textContent).toContain("5 établissements")
    expect(screen.getByTestId("card-description").textContent).toContain(String(totalValue))

    expect(screen.getByTestId("stage-Prospect")).toBeInTheDocument()
    expect(screen.getByTestId("stage-Contacté")).toBeInTheDocument()
    expect(screen.getByTestId("stage-RDV pris")).toBeInTheDocument()
    expect(screen.getByTestId("stage-Vendu")).toBeInTheDocument()

    expect(screen.queryByTestId("stage-Production")).toBeNull()

    expect(screen.getByTestId("stage-count-Prospect").textContent).toBe("2")
    expect(screen.getByTestId("stage-value-Prospect").textContent).toBe("300")
    expect(screen.getByTestId("stage-percentage-Prospect").textContent).toBe("40")

    expect(screen.getByTestId("stage-count-Contacté").textContent).toBe("1")
    expect(screen.getByTestId("stage-value-Contacté").textContent).toBe("300")
    expect(screen.getByTestId("stage-percentage-Contacté").textContent).toBe("20")

    expect(screen.getByTestId("stage-count-RDV pris").textContent).toBe("1")
    expect(screen.getByTestId("stage-value-RDV pris").textContent).toBe("400")
    expect(screen.getByTestId("stage-percentage-RDV pris").textContent).toBe("20")

    expect(screen.getByTestId("stage-count-Vendu").textContent).toBe("1")
    expect(screen.getByTestId("stage-value-Vendu").textContent).toBe("500")
    expect(screen.getByTestId("stage-percentage-Vendu").textContent).toBe("20")

    const debutCycleButton = screen.getByText("Début de cycle").closest("button")
    const phaseActiveButton = screen.getByText("Phase active").closest("button")
    const phaseFinaleButton = screen.getByText("Phase finale").closest("button")
    if (!debutCycleButton || !phaseActiveButton || !phaseFinaleButton) throw new Error("Phase buttons not found")

    expect(debutCycleButton.textContent).toContain("3")
    expect(phaseActiveButton.textContent).toContain("1")
    expect(phaseFinaleButton.textContent).toContain("1")

    fireEvent.click(screen.getByTestId("stage-Contacté"))
    expect(navigateMock).toHaveBeenCalledWith("/etablissements?statut=Contact%C3%A9")

    fireEvent.click(debutCycleButton)
    expect(navigateMock).toHaveBeenCalledWith("/etablissements?statut=Prospect%2CContact%C3%A9%2CAttente%20RDV")

    fireEvent.click(phaseActiveButton)
    expect(navigateMock).toHaveBeenCalledWith(
      "/etablissements?statut=RDV%20pris%2CAttente%20post%20RDV%2CDans%20les%20RDV%2CEtude%20%C3%A9mise%2CDans%20les%20RDV%20post%20EME%2CN%C3%A9gociation%2CContractualisation"
    )

    fireEvent.click(phaseFinaleButton)
    expect(navigateMock).toHaveBeenCalledWith(
      "/etablissements?statut=Vendu%2CContractuel%2CConformit%C3%A9%2CD%C3%A9ploiement%2CFormation%2CGo-Live%2CProduction"
    )
  })

  it("erreur du hook: ne plante pas et affiche 0 établissement / 0 €", () => {
    useAllEtablissementsMock.mockReturnValueOnce({ data: null, isLoading: false, isError: true, error: { message: "x" } })
    renderWithClient(<PipelineVisualization />)

    expect(screen.getByText(/Pipeline Commercial Global/i)).toBeInTheDocument()
    expect(screen.getByTestId("card-description").textContent).toContain("0 établissements")
    expect(formatNumberMock).toHaveBeenCalledWith(0)

    expect(screen.queryByTestId("stage-Prospect")).toBeNull()
    expect(screen.getByText("Début de cycle").closest("button")?.textContent).toContain("0")
    expect(screen.getByText("Phase active").closest("button")?.textContent).toContain("0")
    expect(screen.getByText("Phase finale").closest("button")?.textContent).toContain("0")
  })
})