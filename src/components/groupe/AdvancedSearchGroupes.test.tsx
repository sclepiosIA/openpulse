import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { AdvancedSearchGroupes } from "./AdvancedSearchGroupes"

const {
  REGIONS_DATA,
  FALLBACK_REGIONS,
  mockUseRegions,
  mockFrom,
  onSearchMock,
} = vi.hoisted(() => ({
  REGIONS_DATA: [{ label: "Occitanie" }, { label: "Normandie" }],
  FALLBACK_REGIONS: ["Auvergne-Rhône-Alpes", "Bretagne"],
  mockUseRegions: vi.fn(),
  mockFrom: vi.fn(),
  onSearchMock: vi.fn(),
}))

vi.mock("@/hooks/system/useReferenceData", () => ({
  useRegions: mockUseRegions,
}))

vi.mock("@/config/referenceDataDefaults", () => ({
  FALLBACK_REGIONS,
}))

vi.mock("@/integrations/supabase/client", () => {
  const createBuilder = () => {
    const result = { data: null, error: null }
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      neq: vi.fn(() => builder),
      gt: vi.fn(() => builder),
      gte: vi.fn(() => builder),
      lt: vi.fn(() => builder),
      lte: vi.fn(() => builder),
      in: vi.fn(() => builder),
      ilike: vi.fn(() => builder),
      like: vi.fn(() => builder),
      or: vi.fn(() => builder),
      not: vi.fn(() => builder),
      is: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      range: vi.fn(() => builder),
      insert: vi.fn(() => builder),
      update: vi.fn(() => builder),
      upsert: vi.fn(() => builder),
      delete: vi.fn(() => builder),
      single: vi.fn(() => Promise.resolve(result)),
      maybeSingle: vi.fn(() => Promise.resolve(result)),
      then: (onFulfilled: (value: typeof result) => unknown, onRejected?: (reason: unknown) => unknown) =>
        Promise.resolve(result).then(onFulfilled, onRejected),
      catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve(result).catch(onRejected),
    }
    return builder
  }

  return {
    supabase: {
      from: mockFrom.mockImplementation(() => createBuilder()),
      auth: {
        getUser: vi.fn(() => Promise.resolve({ data: { user: { id: "u1" } }, error: null })),
        getSession: vi.fn(() => Promise.resolve({ data: { session: { user: { id: "u1" } } }, error: null })),
      },
    },
  }
})

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    className,
    variant,
    size,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; size?: string }) => (
    <button type="button" onClick={onClick} className={className} data-variant={variant} data-size={size} {...props}>
      {children}
    </button>
  ),
}))

vi.mock("@/components/ui/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}))

vi.mock("@/components/ui/label", () => ({
  Label: ({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) => <label htmlFor={htmlFor}>{children}</label>,
}))

vi.mock("@/components/ui/badge", () => ({
  Badge: ({
    children,
    onClick,
    className,
    variant,
  }: {
    children: React.ReactNode
    onClick?: () => void
    className?: string
    variant?: string
  }) => (
    <button type="button" onClick={onClick} className={className} data-variant={variant}>
      {children}
    </button>
  ),
}))

vi.mock("@/components/ui/dialog", () => {
  const DialogContext = React.createContext<{
    open: boolean
    onOpenChange: (value: boolean) => void
  }>({
    open: false,
    onOpenChange: () => {},
  })

  return {
    Dialog: ({
      open,
      onOpenChange,
      children,
    }: {
      open: boolean
      onOpenChange: (value: boolean) => void
      children: React.ReactNode
    }) => <DialogContext.Provider value={{ open, onOpenChange }}>{children}</DialogContext.Provider>,
    DialogTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => {
      const ctx = React.useContext(DialogContext)
      return (
        <div onClick={() => ctx.onOpenChange(true)}>
          {children}
        </div>
      )
    },
    DialogContent: ({ children, className }: { children: React.ReactNode; className?: string }) => {
      const ctx = React.useContext(DialogContext)
      return ctx.open ? <div className={className}>{children}</div> : null
    },
    DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
    DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
    DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  }
})

vi.mock("lucide-react", () => ({
  Search: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="search-icon" {...props} />,
  X: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="x-icon" {...props} />,
}))

vi.mock("@/lib/utils", () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" "),
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

function renderComponent() {
  const Wrapper = createWrapper()
  return render(<AdvancedSearchGroupes onSearch={onSearchMock} />, { wrapper: Wrapper })
}

describe("AdvancedSearchGroupes", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseRegions.mockReturnValue({ data: REGIONS_DATA })
  })

  it("affiche les régions issues de useRegions et lance une recherche avec des filtres métier complets", () => {
    renderComponent()

    expect(screen.getByText("Recherche avancée")).toBeInTheDocument()
    expect(screen.queryByText("Occitanie")).not.toBeInTheDocument()

    fireEvent.click(screen.getByText("Recherche avancée"))

    expect(screen.getByText("Affinez votre recherche avec des critères multiples")).toBeInTheDocument()
    expect(screen.getByText("Occitanie")).toBeInTheDocument()
    expect(screen.getByText("Normandie")).toBeInTheDocument()
    expect(screen.queryByText("Auvergne-Rhône-Alpes")).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText("Nom du groupe"), { target: { value: "Groupe Santé Sud" } })
    fireEvent.change(screen.getByLabelText("Date création (début)"), { target: { value: "2024-01-01" } })
    fireEvent.change(screen.getByLabelText("Date création (fin)"), { target: { value: "2024-12-31" } })

    fireEvent.click(screen.getByText("GHT"))
    fireEvent.click(screen.getByText("Occitanie"))
    fireEvent.click(screen.getByText("DPI"))

    fireEvent.change(screen.getByLabelText("Établissements min"), { target: { value: "5" } })
    fireEvent.change(screen.getByLabelText("Établissements max"), { target: { value: "20" } })
    fireEvent.change(screen.getByLabelText("Progression min (%)"), { target: { value: "35" } })
    fireEvent.change(screen.getByLabelText("Progression max (%)"), { target: { value: "90" } })
    fireEvent.change(screen.getByLabelText("Passages urgences min"), { target: { value: "1000" } })
    fireEvent.change(screen.getByLabelText("Passages urgences max"), { target: { value: "8000" } })
    fireEvent.change(screen.getByLabelText("Recherche dans notes/description"), { target: { value: "priorité imagerie" } })

    expect(screen.getByText("!")).toBeInTheDocument()

    fireEvent.click(screen.getByText("Rechercher"))

    expect(onSearchMock).toHaveBeenCalledTimes(1)
    expect(onSearchMock).toHaveBeenCalledWith({
      nom: "Groupe Santé Sud",
      dateCreationDebut: "2024-01-01",
      dateCreationFin: "2024-12-31",
      type: ["GHT"],
      region: ["Occitanie"],
      modules: ["DPI"],
      etablissementsMin: 5,
      etablissementsMax: 20,
      progressionMin: 35,
      progressionMax: 90,
      passagesUrgencesMin: 1000,
      passagesUrgencesMax: 8000,
      searchInNotes: "priorité imagerie",
    })

    expect(screen.queryByLabelText("Nom du groupe")).not.toBeInTheDocument()
  })

  it("utilise les régions fallback quand useRegions renvoie une liste vide et réinitialise les filtres", () => {
    mockUseRegions.mockReturnValue({ data: [] })

    renderComponent()

    fireEvent.click(screen.getByText("Recherche avancée"))

    expect(screen.getByText("Auvergne-Rhône-Alpes")).toBeInTheDocument()
    expect(screen.getByText("Bretagne")).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText("Nom du groupe"), { target: { value: "Temporaire" } })
    fireEvent.click(screen.getByText("Consortium"))
    fireEvent.click(screen.getByText("Bretagne"))
    fireEvent.click(screen.getByText("GED"))

    expect(screen.getByText("!")).toBeInTheDocument()

    fireEvent.click(screen.getByText("Réinitialiser"))

    expect(onSearchMock).toHaveBeenCalledTimes(1)
    expect(onSearchMock).toHaveBeenCalledWith({
      region: [],
      type: [],
      modules: [],
    })

    expect((screen.getByLabelText("Nom du groupe") as HTMLInputElement).value).toBe("")
  })

  it("permet de désélectionner un filtre tableau en cliquant deux fois", () => {
    renderComponent()

    fireEvent.click(screen.getByText("Recherche avancée"))

    const ghtBadge = screen.getByText("GHT")
    fireEvent.click(ghtBadge)
    fireEvent.click(ghtBadge)

    fireEvent.click(screen.getByText("Rechercher"))

    expect(onSearchMock).toHaveBeenCalledWith({
      region: [],
      type: [],
      modules: [],
    })
  })
})