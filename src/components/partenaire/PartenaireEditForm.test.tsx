// @vitest-environment jsdom
import React from "react"
import { render, screen, waitFor, fireEvent, act, renderHook } from "@testing-library/react"
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query"
import { PartenaireEditForm } from "./PartenaireEditForm"

const {
  AUTH_STATE,
  PROFILES_LOADING_RESULT,
  PROFILES_SUCCESS_RESULT,
  PROFILES_ERROR_RESULT,
  PARTENAIRE,
  MUTATION_IDLE_RESULT,
  MUTATION_PENDING_RESULT,
  mutateAsyncMock,
  invalidateQueriesMock,
  partFormPropsSpy,
  entityLogoPropsSpy,
  debugErrorMock,
  navigateMock,
  mockFrom,
} = vi.hoisted(() => {
  const AUTH_STATE = {
    user: { id: "u1", email: "t@t.co" },
    session: { user: { id: "u1" } },
    isLoading: false,
  }

  const PROFILES_LOADING_RESULT = {
    data: undefined,
    isLoading: true,
    isError: false,
    error: null,
  }

  const PROFILES_SUCCESS_RESULT = {
    data: [
      { id: "p1", email: "owner@demo.co", first_name: "Ada", last_name: "Lovelace", role: "admin" },
      { id: "p2", email: "biz@demo.co", first_name: "Grace", last_name: "Hopper", role: "manager" },
    ],
    isLoading: false,
    isError: false,
    error: null,
  }

  const PROFILES_ERROR_RESULT = {
    data: null,
    isLoading: false,
    isError: true,
    error: { message: "x" },
  }

  const PARTENAIRE = {
    id: "part-1",
    nom: "Clinique Demo",
    type_partenaire: "institutionnel",
    logo_url: "https://img/logo.png",
    sous_type: "hopital",
    adresse: "12 rue des Lilas",
    code_postal: "75001",
    ville: "Paris",
    region: "IDF",
    pays: "France",
    telephone: "0102030405",
    email: "contact@clinique.demo",
    site_web: "https://clinique.demo",
    email_domains: ["clinique.demo"],
    statut_relation: "prospect",
    date_debut_partenariat: "2024-01-10",
    date_fin_partenariat: "",
    responsable_marque_id: "p1",
    engagement_score: 8,
    dernier_contact: "2024-04-01",
    prochaine_action: "2024-05-01",
    valeur_partenariat: 1200,
    notes: "note initiale",
    tags: ["sante", "prioritaire"],
  }

  const MUTATION_IDLE_RESULT = {
    mutateAsync: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
  }

  const MUTATION_PENDING_RESULT = {
    mutateAsync: vi.fn(),
    isPending: true,
    isError: false,
    error: null,
  }

  return {
    AUTH_STATE,
    PROFILES_LOADING_RESULT,
    PROFILES_SUCCESS_RESULT,
    PROFILES_ERROR_RESULT,
    PARTENAIRE,
    MUTATION_IDLE_RESULT,
    MUTATION_PENDING_RESULT,
    mutateAsyncMock: vi.fn(),
    invalidateQueriesMock: vi.fn(),
    partFormPropsSpy: vi.fn(),
    entityLogoPropsSpy: vi.fn(),
    debugErrorMock: vi.fn(),
    navigateMock: vi.fn(),
    mockFrom: vi.fn(),
  }
})

vi.mock("@/integrations/supabase/client", () => {
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
    match: vi.fn(() => builder),
    single: vi.fn(async () => ({ data: null, error: null })),
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    then: (resolve: (value: { data: null; error: null }) => unknown) => Promise.resolve(resolve({ data: null, error: null })),
    catch: vi.fn(() => builder),
  }
  mockFrom.mockReturnValue(builder)
  return {
    supabase: {
      from: mockFrom,
      auth: {
        getSession: vi.fn(async () => ({ data: { session: AUTH_STATE.session }, error: null })),
        getUser: vi.fn(async () => ({ data: { user: AUTH_STATE.user }, error: null })),
        onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      },
    },
  }
})

vi.mock("@/lib/debug", () => ({
  debug: {
    error: debugErrorMock,
    log: vi.fn(),
    warn: vi.fn(),
  },
}))

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom")
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

vi.mock("@/hooks/profile/useProfilesWithRoles", () => ({
  useProfilesWithRoles: vi.fn(() => PROFILES_SUCCESS_RESULT),
}))

vi.mock("@/hooks/crm/usePartenaires", () => ({
  useUpdatePartenaire: vi.fn(() => ({
    mutateAsync: mutateAsyncMock,
    isPending: false,
    isError: false,
    error: null,
  })),
}))

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, onOpenChange, children }: { open: boolean; onOpenChange: (open: boolean) => void; children: React.ReactNode }) => (
    <div data-testid="dialog" data-open={String(open)}>
      <button type="button" onClick={() => onOpenChange(false)}>close-dialog</button>
      {children}
    </div>
  ),
  DialogContent: ({ children }: { children: React.ReactNode }) => <div data-testid="dialog-content">{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h1>{children}</h1>,
}))

vi.mock("@/components/ui/EntityLogoUpload", () => ({
  EntityLogoUpload: (props: {
    entityType: string
    entityId: string
    entityName: string
    currentLogoUrl: string | null
    onLogoChange: (url: string | null) => void
    size: string
  }) => {
    entityLogoPropsSpy(props)
    return (
      <button
        type="button"
        data-testid="logo-upload"
        onClick={() => {
          props.onLogoChange("https://img/new-logo.png")
        }}
      >
        logo-upload-{props.entityType}-{props.entityId}-{props.entityName}-{props.currentLogoUrl ?? "none"}-{props.size}
      </button>
    )
  },
}))

vi.mock("@/components/partenaire/PartenaireForm", () => ({
  PartenaireForm: (props: {
    form: {
      getValues: () => Record<string, unknown>
    }
    onSubmit: (data: {
      nom: string
      type_partenaire: string
      logo_url: string
      sous_type: string
      adresse: string
      code_postal: string
      ville: string
      region: string
      pays: string
      telephone: string
      email: string
      site_web: string
      email_domains: string[]
      statut_relation: string
      date_debut_partenariat: string
      date_fin_partenariat: string
      responsable_marque_id: string
      engagement_score: number
      dernier_contact: string
      prochaine_action: string
      valeur_partenariat: number | undefined
      notes: string
      tags: string[]
    }) => Promise<void>
    onCancel: () => void
    submitLabel: string
    isLoading: boolean
    allProfiles: Array<{ id: string; email: string }> | undefined | null
  }) => {
    partFormPropsSpy(props)
    return (
      <div>
        <div data-testid="submit-label">{props.submitLabel}</div>
        <div data-testid="loading-state">{String(props.isLoading)}</div>
        <div data-testid="profiles-count">{String(props.allProfiles ? props.allProfiles.length : 0)}</div>
        <div data-testid="form-nom">{String(props.form.getValues().nom ?? "")}</div>
        <div data-testid="form-ville">{String(props.form.getValues().ville ?? "")}</div>
        <div data-testid="form-logo">{String(props.form.getValues().logo_url ?? "")}</div>
        <button
          type="button"
          data-testid="submit-form"
          onClick={() => {
            void props.onSubmit({
              nom: "Clinique Modifiee",
              type_partenaire: "institutionnel",
              logo_url: "",
              sous_type: "",
              adresse: "",
              code_postal: "",
              ville: "",
              region: "",
              pays: "France",
              telephone: "",
              email: "",
              site_web: "",
              email_domains: ["demo.co"],
              statut_relation: "prospect",
              date_debut_partenariat: "",
              date_fin_partenariat: "",
              responsable_marque_id: "none",
              engagement_score: 0,
              dernier_contact: "",
              prochaine_action: "",
              valeur_partenariat: undefined,
              notes: "",
              tags: ["urgent"],
            })
          }}
        >
          submit
        </button>
        <button
          type="button"
          data-testid="cancel-form"
          onClick={props.onCancel}
        >
          cancel
        </button>
      </div>
    )
  },
}))

vi.mock("@/lib/validations", () => {
  const schema = {
    safeParse: (values: unknown) => ({ success: true, data: values }),
    safeParseAsync: async (values: unknown) => ({ success: true, data: values }),
  }
  return {
    UpdatePartenaireSchema: schema,
  }
})

function createClient() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })
  vi.spyOn(client, "invalidateQueries").mockImplementation(invalidateQueriesMock)
  return client
}

function createWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

function renderComponent(
  overrides?: Partial<React.ComponentProps<typeof PartenaireEditForm>>
) {
  const queryClient = createClient()
  const onOpenChange = vi.fn()
  const props: React.ComponentProps<typeof PartenaireEditForm> = {
    partenaire: PARTENAIRE,
    open: true,
    onOpenChange,
    ...overrides,
  }

  const view = render(
    <QueryClientProvider client={queryClient}>
      <PartenaireEditForm {...props} />
    </QueryClientProvider>
  )

  return { ...view, onOpenChange, queryClient }
}

describe("PartenaireEditForm", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    MUTATION_IDLE_RESULT.mutateAsync = mutateAsyncMock
    MUTATION_PENDING_RESULT.mutateAsync = mutateAsyncMock
  })

  it("expose un QueryClient via renderHook avec le wrapper demandé", () => {
    const client = createClient()
    const wrapper = createWrapper(client)

    const { result } = renderHook(() => useQueryClient(), { wrapper })

    expect(result.current).toBe(client)
  })

  it("affiche les données du partenaire et l'état de chargement des profils", async () => {
    const profilesModule = await import("@/hooks/profile/useProfilesWithRoles")
    vi.mocked(profilesModule.useProfilesWithRoles).mockReturnValue(PROFILES_LOADING_RESULT)

    renderComponent()

    expect(screen.getByText("Modifier le partenaire")).toBeInTheDocument()
    expect(screen.getByText("Modifiez les informations du partenaire")).toBeInTheDocument()
    expect(screen.getByTestId("dialog")).toHaveAttribute("data-open", "true")
    expect(screen.getByTestId("submit-label")).toHaveTextContent("Enregistrer les modifications")
    expect(screen.getByTestId("profiles-count")).toHaveTextContent("0")
    expect(screen.getByTestId("form-nom")).toHaveTextContent("Clinique Demo")
    expect(screen.getByTestId("form-ville")).toHaveTextContent("Paris")
    expect(screen.getByTestId("form-logo")).toHaveTextContent("https://img/logo.png")

    await waitFor(() => {
      expect(entityLogoPropsSpy).toHaveBeenCalled()
    })

    const calls = entityLogoPropsSpy.mock.calls
    const logoProps = calls[calls.length - 1][0]
    expect(logoProps.entityType).toBe("partenaire")
    expect(logoProps.entityId).toBe("part-1")
    expect(logoProps.entityName).toBe("Clinique Demo")
    expect(logoProps.currentLogoUrl).toBe("https://img/logo.png")
    expect(logoProps.size).toBe("lg")
  })

  it("passe les profils au formulaire et invalide le cache quand le logo change", async () => {
    const profilesModule = await import("@/hooks/profile/useProfilesWithRoles")
    vi.mocked(profilesModule.useProfilesWithRoles).mockReturnValue(PROFILES_SUCCESS_RESULT)

    renderComponent()

    expect(screen.getByTestId("profiles-count")).toHaveTextContent("2")

    await act(async () => {
      fireEvent.click(screen.getByTestId("logo-upload"))
    })

    await waitFor(() => {
      expect(invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ["partenaire", "part-1"] })
    })

    const lastLogoProps = entityLogoPropsSpy.mock.calls[entityLogoPropsSpy.mock.calls.length - 1][0]
    expect(lastLogoProps.currentLogoUrl).toBe("https://img/new-logo.png")
  })

  it("soumet les données transformées puis ferme la modale en succès", async () => {
    const crmModule = await import("@/hooks/crm/usePartenaires")
    vi.mocked(crmModule.useUpdatePartenaire).mockReturnValue(MUTATION_IDLE_RESULT)

    mutateAsyncMock.mockResolvedValueOnce({ id: "part-1" })

    const { onOpenChange } = renderComponent()

    await act(async () => {
      fireEvent.click(screen.getByTestId("submit-form"))
    })

    expect(mutateAsyncMock).toHaveBeenCalledWith({
      id: "part-1",
      nom: "Clinique Modifiee",
      type_partenaire: "institutionnel",
      logo_url: null,
      sous_type: null,
      adresse: null,
      code_postal: null,
      ville: null,
      region: null,
      pays: "France",
      telephone: null,
      email: null,
      site_web: null,
      email_domains: ["demo.co"],
      statut_relation: "prospect",
      date_debut_partenariat: null,
      date_fin_partenariat: null,
      responsable_marque_id: null,
      engagement_score: 0,
      dernier_contact: null,
      prochaine_action: null,
      valeur_partenariat: null,
      notes: null,
      tags: ["urgent"],
    })

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })
  })

  it("gère l'erreur de mutation sans fermer la modale", async () => {
    const crmModule = await import("@/hooks/crm/usePartenaires")
    vi.mocked(crmModule.useUpdatePartenaire).mockReturnValue({
      mutateAsync: mutateAsyncMock,
      isPending: false,
      isError: true,
      error: { message: "x" },
    })

    const error = new Error("x")
    mutateAsyncMock.mockRejectedValueOnce(error)

    const { onOpenChange } = renderComponent()

    await act(async () => {
      fireEvent.click(screen.getByTestId("submit-form"))
    })

    await waitFor(() => {
      expect(debugErrorMock).toHaveBeenCalledWith("Error updating partenaire:", error)
    })

    expect(onOpenChange).not.toHaveBeenCalledWith(false)
  })

  it("affiche l'état isLoading de la mutation", async () => {
    const crmModule = await import("@/hooks/crm/usePartenaires")
    vi.mocked(crmModule.useUpdatePartenaire).mockReturnValue(MUTATION_PENDING_RESULT)

    renderComponent()

    expect(screen.getByTestId("loading-state")).toHaveTextContent("true")
  })

  it("ferme la modale au cancel", () => {
    const { onOpenChange } = renderComponent()

    fireEvent.click(screen.getByTestId("cancel-form"))

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("rend sans logo uploader si partenaire est null et ne soumet rien", async () => {
    const crmModule = await import("@/hooks/crm/usePartenaires")
    vi.mocked(crmModule.useUpdatePartenaire).mockReturnValue(MUTATION_IDLE_RESULT)

    renderComponent({ partenaire: null })

    expect(screen.queryByTestId("logo-upload")).not.toBeInTheDocument()
    expect(screen.getByTestId("form-nom")).toHaveTextContent("")

    await act(async () => {
      fireEvent.click(screen.getByTestId("submit-form"))
    })

    await waitFor(() => {
      expect(mutateAsyncMock).not.toHaveBeenCalled()
    })
  })

  it("expose l'état d'erreur des profils via le hook mocké sans casser le rendu", async () => {
    const profilesModule = await import("@/hooks/profile/useProfilesWithRoles")
    vi.mocked(profilesModule.useProfilesWithRoles).mockReturnValue(PROFILES_ERROR_RESULT)

    renderComponent()

    expect(screen.getByTestId("profiles-count")).toHaveTextContent("0")
    expect(screen.getByText("Modifier le partenaire")).toBeInTheDocument()
    expect(partFormPropsSpy).toHaveBeenCalled()
    const props = partFormPropsSpy.mock.calls[partFormPropsSpy.mock.calls.length - 1][0]
    expect(props.allProfiles).toBeNull()
  })
})