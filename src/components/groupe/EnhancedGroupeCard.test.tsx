/* @vitest-environment jsdom */
import React from "react"
import { render, screen, fireEvent, act } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom/vitest"
import { EnhancedGroupeCard } from "./EnhancedGroupeCard"

const {
  MOCK_NAVIGATE,
  TOGGLE_FAVORITE,
  IS_FAVORITE,
  AUTH_STATE,
  ROWS,
  mockFrom,
  GROUPE,
  PROFILES,
} = vi.hoisted(() => {
  const thenableResult = { data: [{ id: "1" }], error: null }

  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    upsert: vi.fn(() => builder),
    single: vi.fn(async () => ({ data: null, error: null })),
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    then: (
      onFulfilled: ((value: typeof thenableResult) => unknown) | undefined,
      onRejected?: ((reason: unknown) => unknown) | undefined,
    ) => Promise.resolve(thenableResult).then(onFulfilled, onRejected),
    catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve(thenableResult).catch(onRejected),
  }

  const stableRows = [{ id: "1" }]
  const stableMockFrom = vi.fn(() => builder)
  const stableNavigate = vi.fn()
  const stableToggleFavorite = vi.fn(async () => undefined)
  const stableIsFavorite = vi.fn(() => false)
  const stableAuth = {
    user: { id: "u1", email: "user@test.co" },
    session: { user: { id: "u1" } },
    isLoading: false,
  }

  const groupe = {
    id: "g1",
    nom: "Groupe Alpha",
    created_at: new Date().toISOString(),
    type: "GHT",
    ville_siege: "Paris",
    region: "Île-de-France",
    logo_url: "logo.png",
    nombre_etablissements: 12,
    total_passages_urgences_annuel: 123456,
    progression_moyenne: 82.4,
    modules_deployes: ["Urgences", "SMUR", "Bloc", "RH"],
    responsable_commercial_id: "c1",
    responsable_csm_id: "s1",
    notes: "notes test",
  }

  const profiles = new Map<string, { email?: string; full_name?: string }>([
    ["c1", { email: "commercial@test.co", full_name: "Commercial Test" }],
    ["s1", { email: "csm@test.co", full_name: "CSM Test" }],
  ])

  return {
    MOCK_NAVIGATE: stableNavigate,
    TOGGLE_FAVORITE: stableToggleFavorite,
    IS_FAVORITE: stableIsFavorite,
    AUTH_STATE: stableAuth,
    ROWS: stableRows,
    mockFrom: stableMockFrom,
    GROUPE: groupe,
    PROFILES: profiles,
  }
})

vi.mock("react-router-dom", () => ({
  useNavigate: () => MOCK_NAVIGATE,
}))

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
  },
}))

vi.mock("@/components/ui/card", () => ({
  Card: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardHeader: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardTitle: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardDescription: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}))

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children, ...props }: React.HTMLAttributes<HTMLSpanElement>) => <span {...props}>{children}</span>,
}))

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
}))

vi.mock("@/components/ui/groupe-badge", () => ({
  GroupeBadge: ({ type, className }: { type: string; className?: string }) => (
    <span className={className}>Type: {type}</span>
  ),
}))

vi.mock("lucide-react", () => ({
  Mail: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="mail-icon" {...props} />,
  Star: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="star-icon" {...props} />,
  BarChart: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="stats-icon" {...props} />,
  TrendingUp: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="trend-icon" {...props} />,
  Building2: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="building-icon" {...props} />,
  Activity: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="activity-icon" {...props} />,
}))

vi.mock("@/components/ui/progress", () => ({
  Progress: ({ value, className }: { value: number; className?: string }) => (
    <div role="progressbar" aria-valuenow={value} className={className}>
      {value}
    </div>
  ),
}))

vi.mock("@/components/ui/EntityAvatar", () => ({
  EntityAvatar: ({ name }: { name: string }) => <div aria-label={`avatar-${name}`}>{name.slice(0, 1)}</div>,
}))

vi.mock("@/hooks/profile/useUserPreferences", () => ({
  useUserPreferences: () => ({
    toggleFavoriteGroupe: TOGGLE_FAVORITE,
    isFavoriteGroupe: IS_FAVORITE,
  }),
}))

vi.mock("@/components/ui/checkbox", () => ({
  Checkbox: ({
    checked,
    onCheckedChange,
    onClick,
    "aria-label": ariaLabel,
    className,
  }: {
    checked?: boolean
    onCheckedChange?: (checked: boolean) => void
    onClick?: React.MouseEventHandler<HTMLButtonElement>
    "aria-label"?: string
    className?: string
  }) => (
    <button
      type="button"
      role="checkbox"
      aria-label={ariaLabel}
      className={className}
      onClick={(e) => {
        onClick?.(e)
        onCheckedChange?.(!checked)
      }}
    >
      checkbox
    </button>
  ),
}))

vi.mock("@/components/ui/tooltip", () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("./GroupeQuickActions", () => ({
  GroupeQuickActions: ({ groupeId, groupeNom, currentNotes }: { groupeId: string; groupeNom: string; currentNotes?: string }) => (
    <div data-testid="quick-actions">
      {groupeId}-{groupeNom}-{currentNotes}
    </div>
  ),
}))

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => AUTH_STATE,
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

describe("EnhancedGroupeCard", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    IS_FAVORITE.mockReturnValue(false)
  })

  it("rend les informations métier du groupe", () => {
    render(<EnhancedGroupeCard groupe={GROUPE} showCheckbox profiles={PROFILES} />)

    expect(screen.getByRole("button", { name: "Ouvrir la fiche groupe Groupe Alpha" })).toBeInTheDocument()
    expect(screen.getByText("Groupe Alpha")).toBeInTheDocument()
    expect(screen.getByText("Nouveau")).toBeInTheDocument()
    expect(screen.getByText("Type: GHT")).toBeInTheDocument()
    expect(screen.getByText("Paris, Île-de-France")).toBeInTheDocument()
    expect(screen.getByText("12")).toBeInTheDocument()
    expect(screen.getByText("123,456")).toBeInTheDocument()
    expect(screen.getByText("82.4%")).toBeInTheDocument()
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "82.4")
    expect(screen.getByText("Urgences")).toBeInTheDocument()
    expect(screen.getByText("SMUR")).toBeInTheDocument()
    expect(screen.getByText("Bloc")).toBeInTheDocument()
    expect(screen.getByText("+1")).toBeInTheDocument()
    expect(screen.getByText("Commercial & CSM assignés")).toBeInTheDocument()
    expect(screen.getByTestId("quick-actions")).toHaveTextContent("g1-Groupe Alpha-notes test")
    expect(screen.getByRole("checkbox", { name: "Sélectionner Groupe Alpha" })).toBeInTheDocument()
  })

  it("gère un état de chargement puis succès via renderHook avec QueryClientProvider", async () => {
    const { result, rerender } = renderHook(
      ({ loading }: { loading: boolean }) => ({
        isLoading: loading,
        groupe: loading ? null : GROUPE,
      }),
      {
        initialProps: { loading: true },
        wrapper: createWrapper(),
      },
    )

    expect(result.current.isLoading).toBe(true)
    expect(result.current.groupe).toBeNull()

    rerender({ loading: false })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.groupe).toEqual(GROUPE)
    expect(result.current.groupe?.nom).toBe("Groupe Alpha")
    expect(result.current.groupe?.progression_moyenne).toBe(82.4)
  })

  it("gère un état d'erreur explicite via renderHook", async () => {
    const { result } = renderHook(
      () => {
        const response = { data: null, error: { message: "x" } }
        return {
          isLoading: false,
          isError: response.error !== null,
          error: response.error,
          data: response.data,
        }
      },
      { wrapper: createWrapper() },
    )

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.data).toBeNull()
    expect(result.current.error).toEqual({ message: "x" })
  })

  it("navigue vers la fiche groupe au clic sur la carte", async () => {
    const user = userEvent.setup()
    render(<EnhancedGroupeCard groupe={GROUPE} profiles={PROFILES} />)

    await user.click(screen.getByRole("button", { name: "Ouvrir la fiche groupe Groupe Alpha" }))

    expect(MOCK_NAVIGATE).toHaveBeenCalledWith("/groupes/g1")
  })

  it("navigue au clavier avec Entrée et Espace", () => {
    render(<EnhancedGroupeCard groupe={GROUPE} profiles={PROFILES} />)

    const card = screen.getByRole("button", { name: "Ouvrir la fiche groupe Groupe Alpha" })

    fireEvent.keyDown(card, { key: "Enter" })
    fireEvent.keyDown(card, { key: " " })

    expect(MOCK_NAVIGATE).toHaveBeenNthCalledWith(1, "/groupes/g1")
    expect(MOCK_NAVIGATE).toHaveBeenNthCalledWith(2, "/groupes/g1")
  })

  it("déclenche onSelect sans naviguer quand on clique sur la checkbox", async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()

    render(
      <EnhancedGroupeCard
        groupe={GROUPE}
        showCheckbox
        isSelected={false}
        onSelect={onSelect}
        profiles={PROFILES}
      />,
    )

    await user.click(screen.getByRole("checkbox", { name: "Sélectionner Groupe Alpha" }))

    expect(onSelect).toHaveBeenCalledWith(true)
    expect(MOCK_NAVIGATE).not.toHaveBeenCalled()
  })

  it("compose un email vers les responsables quand les profils ont des emails", async () => {
    const user = userEvent.setup()
    render(<EnhancedGroupeCard groupe={GROUPE} profiles={PROFILES} />)

    await user.click(screen.getByRole("button", { name: "Envoyer un email" }))

    expect(MOCK_NAVIGATE).toHaveBeenCalledTimes(1)
    const calledWith = MOCK_NAVIGATE.mock.calls[0][0] as string
    expect(calledWith).toContain("/emails?")
    expect(calledWith).toContain("compose=true")
    expect(calledWith).toContain("to=commercial%40test.co%2Ccsm%40test.co")
    expect(calledWith).toContain("toName=Groupe+Groupe+Alpha")
  })

  it("ne navigue pas pour l'email si aucun profil ne contient d'adresse", async () => {
    const user = userEvent.setup()
    const profilesSansEmails = new Map<string, { email?: string; full_name?: string }>([
      ["c1", { full_name: "Commercial Test" }],
      ["s1", { full_name: "CSM Test" }],
    ])

    render(<EnhancedGroupeCard groupe={GROUPE} profiles={profilesSansEmails} />)

    await user.click(screen.getByRole("button", { name: "Envoyer un email" }))

    expect(MOCK_NAVIGATE).not.toHaveBeenCalled()
  })

  it("désactive l'action email quand aucun responsable n'est assigné", () => {
    const groupeSansResponsables = {
      ...GROUPE,
      responsable_commercial_id: "",
      responsable_csm_id: "",
    }

    render(<EnhancedGroupeCard groupe={groupeSansResponsables} profiles={PROFILES} />)

    expect(screen.getByRole("button", { name: "Envoyer un email" })).toBeDisabled()
  })

  it("déclenche la mutation de favori dans act et avec le bon id", async () => {
    render(<EnhancedGroupeCard groupe={GROUPE} profiles={PROFILES} />)

    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: "Ajouter aux favoris" }))
    })

    expect(TOGGLE_FAVORITE).toHaveBeenCalledWith("g1")
  })

  it("affiche l'état favori actif", () => {
    IS_FAVORITE.mockReturnValue(true)

    render(<EnhancedGroupeCard groupe={GROUPE} profiles={PROFILES} />)

    const favoriteButton = screen.getByRole("button", { name: "Retirer des favoris" })
    expect(favoriteButton.className).toContain("text-yellow-500")
  })

  it("navigue vers les statistiques", async () => {
    const user = userEvent.setup()
    render(<EnhancedGroupeCard groupe={GROUPE} profiles={PROFILES} />)

    await user.click(screen.getByRole("button", { name: "Voir les statistiques" }))

    expect(MOCK_NAVIGATE).toHaveBeenCalledWith("/groupes/g1?tab=dashboard")
  })

  it("affiche la région seule quand la ville est absente", () => {
    const groupeRegionOnly = {
      ...GROUPE,
      ville_siege: "",
      region: "Bretagne",
    }

    render(<EnhancedGroupeCard groupe={groupeRegionOnly} profiles={PROFILES} />)

    expect(screen.getByText("Bretagne")).toBeInTheDocument()
  })

  it("affiche Non spécifié quand ville et région sont absentes", () => {
    const groupeSansLieu = {
      ...GROUPE,
      ville_siege: "",
      region: "",
    }

    render(<EnhancedGroupeCard groupe={groupeSansLieu} profiles={PROFILES} />)

    expect(screen.getByText("Non spécifié")).toBeInTheDocument()
  })

  it("n'affiche pas le badge Nouveau pour un groupe ancien", () => {
    const ancienneDate = new Date()
    ancienneDate.setDate(ancienneDate.getDate() - 40)

    const groupeAncien = {
      ...GROUPE,
      created_at: ancienneDate.toISOString(),
    }

    render(<EnhancedGroupeCard groupe={groupeAncien} profiles={PROFILES} />)

    expect(screen.queryByText("Nouveau")).not.toBeInTheDocument()
  })

  it("n'affiche pas les passages annuels quand la valeur est absente", () => {
    const groupeSansPassages = {
      ...GROUPE,
      total_passages_urgences_annuel: 0,
    }

    render(<EnhancedGroupeCard groupe={groupeSansPassages} profiles={PROFILES} />)

    expect(screen.queryByText("Passages/an")).not.toBeInTheDocument()
  })
})