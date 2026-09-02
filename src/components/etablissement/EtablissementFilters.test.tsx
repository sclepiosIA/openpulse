import React from "react"
import { render, screen, within, fireEvent } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { EtablissementFilters } from "./EtablissementFilters"

const {
  PROFILES_OK,
  REGIONS_OK,
  FALLBACK_REGIONS,
  ENUMS,
  useProfilesWithRolesMock,
  useRegionsMock,
  onCloseMock,
  setSearchParamsMock,
  getInitialSearchParams,
  setInitialSearchParams,
} = vi.hoisted(() => {
  const PROFILES_OK = [
    { id: "u_com_1", prenom: "Camille", nom: "Martin", role: "commercial" as const },
    { id: "u_cp_1", prenom: "Chloe", nom: "Durand", role: "chef_projet" as const },
    { id: "u_csm_1", prenom: "Sam", nom: "Petit", role: "csm" as const },
    { id: "u_other_1", prenom: "Alex", nom: "Roux", role: "admin" as const },
  ]

  const REGIONS_OK = [{ label: "Occitanie" }, { label: "Bretagne" }]

  const FALLBACK_REGIONS = ["Ile-de-France", "Normandie"]

  const ENUMS = {
    statut_etablissement: ["actif", "inactif"],
    type_etablissement: ["hopital", "clinique"],
    type_dpi: ["dpi_a", "dpi_b"],
  }

  const useProfilesWithRolesMock = vi.fn()
  const useRegionsMock = vi.fn()

  const onCloseMock = vi.fn()
  const setSearchParamsMock = vi.fn()

  let initialSearchParams = new URLSearchParams()

  const getInitialSearchParams = () => initialSearchParams
  const setInitialSearchParams = (value: URLSearchParams) => {
    initialSearchParams = value
  }

  return {
    PROFILES_OK,
    REGIONS_OK,
    FALLBACK_REGIONS,
    ENUMS,
    useProfilesWithRolesMock,
    useRegionsMock,
    onCloseMock,
    setSearchParamsMock,
    getInitialSearchParams,
    setInitialSearchParams,
  }
})

vi.mock("@/hooks/profile/useProfilesWithRoles", () => ({
  useProfilesWithRoles: () => useProfilesWithRolesMock(),
}))

vi.mock("@/hooks/system/useReferenceData", () => ({
  useRegions: () => useRegionsMock(),
}))

vi.mock("@/config/referenceDataDefaults", () => ({
  FALLBACK_REGIONS,
}))

vi.mock("@/integrations/supabase/types", () => ({
  Constants: { public: { Enums: ENUMS } },
}))

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom")
  return {
    ...actual,
    useSearchParams: () => {
      const sp = getInitialSearchParams()
      return [sp, setSearchParamsMock] as const
    },
  }
})

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, "aria-label": ariaLabel, title, ...rest }: React.PropsWithChildren<{ onClick?: () => void; "aria-label"?: string; title?: string }>) => (
    <button onClick={onClick} aria-label={ariaLabel} title={title} {...rest}>
      {children}
    </button>
  ),
}))

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: React.PropsWithChildren) => <div data-testid="card">{children}</div>,
  CardHeader: ({ children }: React.PropsWithChildren) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children }: React.PropsWithChildren) => <h2>{children}</h2>,
  CardContent: ({ children }: React.PropsWithChildren) => <div data-testid="card-content">{children}</div>,
}))

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: React.PropsWithChildren) => <span data-testid="badge">{children}</span>,
}))

vi.mock("lucide-react", () => ({
  X: () => <span aria-hidden="true">x</span>,
}))

vi.mock("@/components/ui/select", () => {
  const React = require("react") as typeof import("react")

  type Ctx = {
    value: string
    onValueChange: (v: string) => void
    open: boolean
    setOpen: (o: boolean) => void
  }

  const SelectContext = React.createContext<Ctx | null>(null)

  function Select({ value, onValueChange, children }: { value: string; onValueChange: (v: string) => void; children: React.ReactNode }) {
    const [open, setOpen] = React.useState(false)
    return <SelectContext.Provider value={{ value, onValueChange, open, setOpen }}>{children}</SelectContext.Provider>
  }

  function useCtx() {
    const ctx = React.useContext(SelectContext)
    if (!ctx) throw new Error("Select components must be used within Select")
    return ctx
  }

  function SelectTrigger({ children }: { children: React.ReactNode }) {
    const { open, setOpen } = useCtx()
    return (
      <button type="button" onClick={() => setOpen(!open)}>
        {children}
      </button>
    )
  }

  function SelectValue({ placeholder }: { placeholder?: string }) {
    const { value } = useCtx()
    return <span>{value || placeholder || ""}</span>
  }

  function SelectContent({ children }: { children: React.ReactNode }) {
    const { open } = useCtx()
    if (!open) return null
    return <div role="listbox">{children}</div>
  }

  function SelectItem({ value, children }: { value: string; children: React.ReactNode }) {
    const { onValueChange, setOpen } = useCtx()
    return (
      <button
        type="button"
        role="option"
        onClick={() => {
          onValueChange(value)
          setOpen(false)
        }}
      >
        {children}
      </button>
    )
  }

  return { Select, SelectTrigger, SelectValue, SelectContent, SelectItem }
})

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

describe("EtablissementFilters", () => {
  it("affiche l'état de chargement (données manquantes) et utilise les régions fallback", () => {
    setInitialSearchParams(new URLSearchParams())
    setSearchParamsMock.mockClear()
    onCloseMock.mockClear()

    useProfilesWithRolesMock.mockReturnValue({ data: undefined, isLoading: true, isError: false })
    useRegionsMock.mockReturnValue({ data: undefined, isLoading: true, isError: false })

    renderWithClient(<EtablissementFilters onClose={onCloseMock} />)

    expect(screen.getByText("Filtres des établissements")).toBeTruthy()

    fireEvent.click(screen.getByText("Région").closest("div")?.querySelector("button") as HTMLButtonElement)
    const listbox = screen.getByRole("listbox")
    for (const region of FALLBACK_REGIONS) {
      expect(within(listbox).getByRole("option", { name: region })).toBeTruthy()
    }
  })

  it("succès: initialise depuis l'URL, affiche les badges actifs, permet de supprimer un filtre puis d'appliquer", () => {
    setInitialSearchParams(
      new URLSearchParams({
        statut: "actif",
        type: "hopital",
        region: "Occitanie",
      }),
    )
    setSearchParamsMock.mockClear()
    onCloseMock.mockClear()

    useProfilesWithRolesMock.mockReturnValue({ data: PROFILES_OK, isLoading: false, isError: false })
    useRegionsMock.mockReturnValue({ data: REGIONS_OK, isLoading: false, isError: false })

    renderWithClient(<EtablissementFilters onClose={onCloseMock} />)

    expect(screen.getByText("Filtres actifs (3)")).toBeTruthy()

    const badges = screen.getAllByTestId("badge")
    const badgeText = badges.map((b) => (b.textContent ?? "").replace(/\s+/g, " ").trim()).join(" | ")
    expect(badgeText.includes("statut: actif")).toBe(true)
    expect(badgeText.includes("type: hopital")).toBe(true)
    expect(badgeText.includes("region: Occitanie")).toBe(true)

    const badgeStatut = badges.find((b) => (b.textContent ?? "").includes("statut: actif"))
    expect(badgeStatut).toBeTruthy()
    const clearBtn = within(badgeStatut as HTMLElement).getAllByRole("button")[0]
    fireEvent.click(clearBtn)

    expect(screen.getByText("Filtres actifs (2)")).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Appliquer les filtres" }))

    expect(setSearchParamsMock).toHaveBeenCalledTimes(1)
    const arg = setSearchParamsMock.mock.calls[0]?.[0] as URLSearchParams
    expect(arg.get("statut")).toBe(null)
    expect(arg.get("type")).toBe("hopital")
    expect(arg.get("region")).toBe("Occitanie")
    expect(onCloseMock).toHaveBeenCalledTimes(1)
  })

  it("erreur: remonte isError via hooks et reste stable au rendu; 'Tout effacer' vide l'URL et ferme", () => {
    setInitialSearchParams(new URLSearchParams({ dpi: "dpi_a", commercial: "u_com_1" }))
    setSearchParamsMock.mockClear()
    onCloseMock.mockClear()

    useProfilesWithRolesMock.mockReturnValue({ data: null, isLoading: false, isError: true, error: { message: "profiles error" } })
    useRegionsMock.mockReturnValue({ data: null, isLoading: false, isError: true, error: { message: "regions error" } })

    renderWithClient(<EtablissementFilters onClose={onCloseMock} />)

    expect(screen.getByText("Filtres actifs (2)")).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Tout effacer" }))

    expect(setSearchParamsMock).toHaveBeenCalledTimes(1)
    const arg = setSearchParamsMock.mock.calls[0]?.[0] as URLSearchParams
    expect(arg.toString()).toBe("")
    expect(onCloseMock).toHaveBeenCalledTimes(1)
  })
})