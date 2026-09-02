import React from "react"
import { render, screen, cleanup } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

const { PROSPECTS, mockFrom, useAllEtablissementsMock, navigateMock, formatNumberMock, calculateValueMock } = vi.hoisted(() => {
  const builder: any = {}
  builder.select = () => builder
  builder.eq = () => builder
  builder.gte = () => builder
  builder.lte = () => builder
  builder.in = () => builder
  builder.order = () => builder
  builder.limit = () => builder
  builder.insert = () => Promise.resolve({ data: {}, error: null })
  builder.update = () => builder
  builder.delete = () => builder
  builder.single = async () => ({ data: null, error: null })
  builder.maybeSingle = async () => ({ data: null, error: null })
  builder.then = (res: any, rej: any) => Promise.resolve({ data: null, error: null }).then(res, rej)
  builder.catch = (rej: any) => Promise.resolve({ data: null, error: null }).catch(rej)

  const mockFromFn = vi.fn(() => builder)
  const useAllEtablissementsFn = vi.fn()

  const navMock = vi.fn()

  const fmtMock = vi.fn((n: number | string) => String(n))
  const calcMock = vi.fn((p: any) => (typeof p?.customValue === "number" ? p.customValue : 0))

  const rows = [
    { id: "e1", statut: "Contacté", dpi: "ORBIS", nombre_passages_urgences_annuel: 1500, date_previsionnelle_signature: "2026-02-01", customValue: 2000 },
    { id: "e2", statut: "RDV pris", dpi: "Care4U", nombre_passages_urgences_annuel: 1000, date_previsionnelle_signature: "2026-05-01", customValue: 3000 },
    { id: "e3", statut: "Refus", dpi: undefined, nombre_passages_urgences_annuel: 250, customValue: 500 },
  ]

  return {
    PROSPECTS: rows,
    mockFrom: mockFromFn,
    useAllEtablissementsMock: useAllEtablissementsFn,
    navigateMock: navMock,
    formatNumberMock: fmtMock,
    calculateValueMock: calcMock,
  }
})

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: mockFrom },
}))

vi.mock("@/hooks/crm/useProspects", () => ({
  useAllEtablissements: useAllEtablissementsMock,
}))

vi.mock("@/lib/valueCalculations", () => ({
  calculateEtablissementValue: calculateValueMock,
}))

vi.mock("@/lib/utils", () => ({
  cn: (...c: string[]) => c.filter(Boolean).join(" "),
  formatNumber: formatNumberMock,
}))

vi.mock("react-router-dom", () => ({
  useNavigate: () => navigateMock,
}))

vi.mock("@/components/ui/badge", () => ({
  Badge: (props: any) => <span {...props} />,
  default: (props: any) => <span {...props} />,
}))

vi.mock("@/components/ui/accordion", () => ({
  Accordion: ({ children, ...rest }: any) => <div data-testid="Accordion" {...rest}>{children}</div>,
  AccordionContent: ({ children, ...rest }: any) => <div {...rest}>{children}</div>,
  AccordionItem: ({ children, ...rest }: any) => <div {...rest}>{children}</div>,
  AccordionTrigger: ({ children, ...rest }: any) => <button type="button" {...rest}>{children}</button>,
}))

vi.mock("@/components/ui/icon-circle", () => ({
  IconCircle: ({ children, ...rest }: any) => <div {...rest}>{children}</div>,
}))

vi.mock("@/components/ui/enhanced-card", () => ({
  EnhancedCard: ({ children, ...rest }: any) => <div {...rest}>{children}</div>,
  EnhancedCardContent: ({ children, ...rest }: any) => <div {...rest}>{children}</div>,
  EnhancedCardHeader: ({ children, ...rest }: any) => <div {...rest}>{children}</div>,
}))

vi.mock("@/components/dashboard/PhaseSection", () => ({
  PhaseSection: (props: any) => <div data-testid="PhaseSection" data-props={JSON.stringify(Object.keys(props))} />,
}))

vi.mock("@/components/dashboard/DpiAnalysisTabs", () => ({
  DpiAnalysisTabs: () => <div data-testid="DpiAnalysisTabs" />,
}))

vi.mock("framer-motion", () => ({
  motion: new Proxy(
    {},
    {
      get: () => (props: any) => <div {...props} />,
    }
  ),
}))

import { ProspectStatsDashboard } from "./ProspectStatsDashboard"

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

describe("ProspectStatsDashboard", () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it("affiche les métriques en succès avec les données agrégées correctes", () => {
    useAllEtablissementsMock.mockReturnValue({
      data: PROSPECTS,
      isLoading: false,
      isError: false,
      error: null,
    })

    renderWithClient(<ProspectStatsDashboard />)

    expect(screen.getByText("Pipeline")).toBeInTheDocument()
    expect(screen.getByText("Passages")).toBeInTheDocument()
    expect(screen.getByText("Valeur")).toBeInTheDocument()

    // Passages: 1500 + 1000 + 250 = 2750 -> Math.round(2.75k) = 3k
    expect(screen.getAllByText("3k")[0]).toBeInTheDocument()

    // Valeur: 2000 + 3000 + 500 = 5500 -> "5500€"
    expect(screen.getByText("5500€")).toBeInTheDocument()
  })

  it("affiche des valeurs par défaut pendant le chargement", () => {
    useAllEtablissementsMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    })

    renderWithClient(<ProspectStatsDashboard />)

    expect(screen.getByText("Pipeline")).toBeInTheDocument()
    // 0 passages -> 0k
    expect(screen.getAllByText("0k")[0]).toBeInTheDocument()
    // Valeur 0 -> "0€"
    expect(screen.getByText("0€")).toBeInTheDocument()
  })

  it("gère l'état d'erreur sans crasher et affiche 0", () => {
    useAllEtablissementsMock.mockReturnValue({
      data: null,
      isLoading: false,
      isError: true,
      error: { message: "x" },
    })

    renderWithClient(<ProspectStatsDashboard />)

    expect(screen.getByText("Pipeline")).toBeInTheDocument()
    expect(screen.getAllByText("0k")[0]).toBeInTheDocument()
    expect(screen.getByText("0€")).toBeInTheDocument()
  })
})